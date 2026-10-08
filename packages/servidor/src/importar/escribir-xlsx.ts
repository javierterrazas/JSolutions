// Escribe un libro de Excel (.xlsx) sin dependencias: el XML de cada hoja, comprimido en un .zip con zlib. Solo lo
// que necesita la plantilla de datos iniciales (D-039): texto, números y fechas, estilos fijos, anchos de columna,
// el primer renglón congelado y listas desplegables. Se abre en Excel, Google Sheets y LibreOffice.
import { crc32, deflateRawSync } from 'node:zlib';

export type Estilo =
  'normal' | 'encabezado' | 'ejemplo' | 'fecha' | 'ejemplo_fecha' | 'titulo' | 'parrafo' | 'llenar';

export type Valor = string | number | Date | null;
export interface Celda {
  readonly v: Valor;
  readonly estilo?: Estilo;
}

export interface HojaParaEscribir {
  readonly nombre: string;
  /** El ancho de cada columna, en caracteres. */
  readonly anchos: readonly number[];
  readonly filas: readonly (readonly (Celda | Valor)[])[];
  /** Congela el primer renglón (los encabezados). */
  readonly congelar?: boolean;
  /** Listas desplegables: el rango (p. ej. "H2:H500") y sus opciones. */
  readonly listas?: readonly { rango: string; opciones: readonly string[] }[];
}

// el orden de cellXfs en ESTILOS
const XF: Record<Estilo, number> = {
  normal: 0,
  encabezado: 1,
  ejemplo: 2,
  ejemplo_fecha: 3,
  fecha: 4,
  titulo: 5,
  parrafo: 6,
  llenar: 7,
};

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>
<fonts count="4">
<font><sz val="10"/><name val="Arial"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
<font><i/><sz val="10"/><color rgb="FF64748B"/><name val="Arial"/></font>
<font><b/><sz val="14"/><color rgb="FF1D3557"/><name val="Arial"/></font>
</fonts>
<fills count="5">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1D3557"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF4D6"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="2" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const letra = (i: number): string =>
  i < 26 ? String.fromCharCode(65 + i) : letra(Math.floor(i / 26) - 1) + letra(i % 26);

/** Una fecha (su día local) como número de serie de Excel. */
const serie = (d: Date) =>
  (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000;

function celda(ref: string, c: Celda | Valor): string {
  const { v, estilo } =
    c !== null && typeof c === 'object' && !(c instanceof Date) ? c : { v: c, estilo: undefined };
  const e = estilo ?? (v instanceof Date ? 'fecha' : 'normal');
  const s = XF[e] ? ` s="${XF[e]}"` : '';
  if (v === null || v === '') return XF[e] ? `<c r="${ref}"${s}/>` : '';
  if (typeof v === 'number') return `<c r="${ref}"${s}><v>${v}</v></c>`;
  if (v instanceof Date) return `<c r="${ref}"${s}><v>${serie(v)}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapar(v)}</t></is></c>`;
}

function hojaXml(h: HojaParaEscribir): string {
  const vista = h.congelar
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const columnas = `<cols>${h.anchos
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('')}</cols>`;
  const filas = h.filas
    .map((f, i) => `<row r="${i + 1}">${f.map((c, j) => celda(`${letra(j)}${i + 1}`, c)).join('')}</row>`)
    .join('');
  const listas = h.listas?.length
    ? `<dataValidations count="${h.listas.length}">${h.listas
        .map(
          (l) =>
            `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${l.rango}"><formula1>"${escapar(l.opciones.join(','))}"</formula1></dataValidation>`,
        )
        .join('')}</dataValidations>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${vista}${columnas}<sheetData>${filas}</sheetData>${listas}</worksheet>`;
}

/** Un .zip con los archivos dados (comprimidos con deflate). */
function zip(archivos: readonly [string, string][]): Buffer {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let desplazamiento = 0;
  for (const [nombre, contenido] of archivos) {
    const datos = Buffer.from(contenido, 'utf8');
    const comprimido = deflateRawSync(datos);
    const n = Buffer.from(nombre, 'utf8');
    const crc = crc32(datos);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comprimido.length, 20);
    central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    locales.push(local, n, comprimido);
    centrales.push(central, n);
    desplazamiento += local.length + n.length + comprimido.length;
  }
  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...locales, directorio, fin]);
}

export function escribirLibro(hojas: readonly HojaParaEscribir[]): Buffer {
  const tipos = hojas
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/hoja${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('');
  return zip([
    [
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${tipos}</Types>`,
    ],
    [
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${hojas
        .map((h, i) => `<sheet name="${escapar(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/hoja${i + 1}.xml"/>`,
        )
        .join(
          '',
        )}<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    ['xl/styles.xml', ESTILOS],
    ...hojas.map((h, i) => [`xl/worksheets/hoja${i + 1}.xml`, hojaXml(h)] as [string, string]),
  ]);
}
