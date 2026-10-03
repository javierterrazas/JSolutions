// Lee el libro de Excel del legacy (legacy/app/Gestion_Obra_IJM.xlsx) igual que lo hacía su
// legacy/pruebas/preparar_libro.py con openpyxl, pero sin Python: descomprime el .xlsx con zlib y convierte cada
// hoja en renglones. Las fechas salen como Date a la medianoche local (la zona del proceso), como las dejaba
// openpyxl + harness.js. Solo cubre lo que usa ese libro: texto en línea o compartido, números y fechas.
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import type { Libro } from './legacy';

/** Los archivos de un .zip, por nombre. */
function descomprimir(zip: Buffer): Map<string, Buffer> {
  const archivos = new Map<string, Buffer>();
  // fin del directorio central: firma 0x06054b50, buscada desde el final
  let fin = zip.length - 22;
  while (fin >= 0 && zip.readUInt32LE(fin) !== 0x06054b50) fin--;
  if (fin < 0) throw new Error('No es un archivo .zip');
  const total = zip.readUInt16LE(fin + 10);
  let p = zip.readUInt32LE(fin + 16);
  for (let i = 0; i < total; i++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error('Directorio central dañado');
    const metodo = zip.readUInt16LE(p + 10);
    const comprimido = zip.readUInt32LE(p + 20);
    const largoNombre = zip.readUInt16LE(p + 28);
    const largoExtra = zip.readUInt16LE(p + 30);
    const largoComentario = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const nombre = zip.toString('utf8', p + 46, p + 46 + largoNombre);
    const inicio = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const datos = zip.subarray(inicio, inicio + comprimido);
    archivos.set(nombre, metodo === 0 ? datos : inflateRawSync(datos));
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return archivos;
}

const decodificar = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const textoDe = (xml: string) =>
  decodificar([...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));

/** Los estilos que son fechas: formatos integrados 14–22 y 45–47, o personalizados con día, mes o año. */
function estilosDeFecha(estilos: string): boolean[] {
  const propios = new Map<number, string>();
  for (const m of estilos.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g)) {
    propios.set(Number(m[1]), decodificar(m[2]!));
  }
  const xfs = estilos.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '';
  return [...xfs.matchAll(/<xf [^>]*?numFmtId="(\d+)"/g)].map((m) => {
    const id = Number(m[1]);
    if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47)) return true;
    const formato = (propios.get(id) ?? '').replace(/"[^"]*"/g, '').toLowerCase();
    return /[dy]/.test(formato);
  });
}

/** Número de serie de Excel → Date local (como openpyxl: sin zona, y harness.js lo leía como hora local). */
function fechaDeSerie(serie: number): Date {
  const dias = Math.floor(serie);
  const segundos = Math.round((serie - dias) * 86400);
  const base = new Date(Date.UTC(1899, 11, 30) + dias * 86400000);
  return new Date(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate(),
    Math.floor(segundos / 3600),
    Math.floor((segundos % 3600) / 60),
    segundos % 60,
  );
}

const columna = (ref: string) =>
  [...ref.replace(/\d+$/, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

export function leerLibro(ruta: string): Libro {
  const zip = descomprimir(readFileSync(ruta));
  const leer = (n: string) => zip.get(n)?.toString('utf8') ?? '';
  const compartidos = [...leer('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    textoDe(m[1]!),
  );
  const fechas = estilosDeFecha(leer('xl/styles.xml'));
  const relaciones = new Map(
    [...leer('xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*>/g)].map((m) => [
      m[0].match(/Id="([^"]+)"/)![1]!,
      m[0].match(/Target="([^"]+)"/)![1]!.replace(/^\/?xl\//, ''),
    ]),
  );
  const libro: Libro = {};
  for (const m of leer('xl/workbook.xml').matchAll(/<sheet [^>]*>/g)) {
    const nombre = decodificar(m[0].match(/name="([^"]*)"/)![1]!);
    const archivo = relaciones.get(m[0].match(/r:id="([^"]+)"/)![1]!)!;
    const renglones: unknown[][] = [];
    for (const r of leer('xl/' + archivo).matchAll(
      /<row [^>]*?r="(\d+)"[^>]*>([\s\S]*?)<\/row>|<row [^>]*?r="(\d+)"[^>]*\/>/g,
    )) {
      const n = Number(r[1] ?? r[3]) - 1;
      const fila: unknown[] = [];
      for (const c of (r[2] ?? '').matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const atributos = c[2] ?? '';
        const cuerpo = c[3] ?? '';
        const tipo = atributos.match(/t="([^"]+)"/)?.[1];
        const estilo = Number(atributos.match(/s="(\d+)"/)?.[1] ?? 0);
        const v = cuerpo.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let valor: unknown = '';
        if (tipo === 's') valor = compartidos[Number(v)] ?? '';
        else if (tipo === 'inlineStr' || tipo === 'str')
          valor = tipo === 'str' ? decodificar(v ?? '') : textoDe(cuerpo);
        else if (tipo === 'b') valor = v === '1';
        else if (v !== undefined) valor = fechas[estilo] ? fechaDeSerie(Number(v)) : Number(v);
        fila[columna(c[1]!)] = valor;
      }
      renglones[n] = fila;
    }
    // como openpyxl: una cuadrícula completa, con '' en las celdas vacías
    // Array.from y no map: un renglón en blanco deja un hueco en el arreglo, y map se lo saltaría
    const ancho = Math.max(0, ...Array.from(renglones, (f) => (f ? f.length : 0)));
    libro[nombre] = Array.from({ length: renglones.length }, (_, i) =>
      Array.from({ length: ancho }, (_, j) => renglones[i]?.[j] ?? ''),
    );
  }
  return libro;
}
