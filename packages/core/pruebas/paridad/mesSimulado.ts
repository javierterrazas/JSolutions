// El mes simulado del legacy (legacy/sim/): 5 semanas de obra con 2 PMs y 4 obras, corridas con el código real
// del legacy: cierres de día, atrasos, subs que no llegan, órdenes de cambio, cierres de obra. Es la mejor fuente
// de datos realistas para la paridad: además del estado final, se guarda el estado de las hojas al terminar cada
// día simulado, con obras arrancando, a medias, atrasadas y entregadas.
//
// El legacy es de solo lectura y sus scripts esperan /tmp y /home/claude: igual que legacy/correr_pruebas.sh, se
// copian a una carpeta temporal con las rutas cambiadas y se corren ahí. El resultado se guarda en caché,
// identificado por el contenido del legacy y de este archivo: si no cambian, el mes no se vuelve a simular.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Libro } from './legacy';
import { leerLibro } from './xlsx';

const LEGACY = fileURLToPath(new URL('../../../../legacy/', import.meta.url)).replace(/\\/g, '/');
const XLSX = LEGACY + 'app/Gestion_Obra_IJM.xlsx';
const FUENTES = [
  XLSX,
  LEGACY + 'app/App_Dueno.gs',
  LEGACY + 'app/App_PM.gs',
  LEGACY + 'pruebas/harness.js',
  ...readdirSync(LEGACY + 'sim').map((f) => LEGACY + 'sim/' + f),
  fileURLToPath(import.meta.url),
];

const p2 = (n: number) => String(n).padStart(2, '0');
/** Como datetime.isoformat() de openpyxl: hora local, sin zona. harness.js la lee como hora local. */
const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;

/** Lo que hace correr_pruebas.sh con sed: las rutas fijas del legacy apuntan a la carpeta de trabajo. */
// En una sola pasada: en Linux la carpeta de trabajo misma está en /tmp, y un segundo reemplazo de "/tmp/" la
// duplicaría (/tmp/ijm-paridad/…/ijm-paridad/…).
export function cambiarRutas(codigo: string, trabajo: string, legacy = LEGACY): string {
  const rutas: Record<string, string> = {
    '/home/claude/ijm/': legacy + 'app/',
    '/tmp/sim/': trabajo + '/sim/',
    "'/tmp'": `'${trabajo}'`,
    '/tmp/': trabajo + '/',
  };
  return codigo.replace(/\/home\/claude\/ijm\/|\/tmp\/sim\/|'\/tmp'|\/tmp\//g, (m) => rutas[m]!);
}

/** Cambia un texto exacto o falla: si el legacy cambia, mejor enterarse que simular a medias. */
function reemplazar(codigo: string, antes: string, despues: string, archivo: string): string {
  if (!codigo.includes(antes)) throw new Error(`No encontré en ${archivo}: ${antes}`);
  return codigo.replace(antes, despues);
}

// En la copia de base.js: cada vez que el reloj simulado cambia de día, una foto de todas las hojas.
const RELOJ_ORIGINAL =
  "fija(fechaISO, hora) { AHORA = new RealDate(fechaISO + 'T' + hora + ':00').getTime(); },";
const RELOJ_CON_FOTOS =
  'fija(fechaISO, hora) { const d = iso(new RealDate(AHORA)); if (d !== fechaISO) FOTOS[d] = JSON.stringify(H.SHEETS);' +
  " AHORA = new RealDate(fechaISO + 'T' + hora + ':00').getTime(); },";

// Al final del reporte: el estado final y la foto de cada día.
const VOLCADO = `
;(() => {
  const fs = require('fs');
  fs.writeFileSync(__dirname + '/hojas.json', JSON.stringify(B.H.SHEETS));
  B.FOTOS[B.iso(B.reloj.ahora())] = JSON.stringify(B.H.SHEETS);
  fs.writeFileSync(__dirname + '/dias.json',
    '{' + Object.keys(B.FOTOS).sort().map(d => JSON.stringify(d) + ':' + B.FOTOS[d]).join(',') + '}');
})();
`;

let carpeta: string | undefined;

/**
 * Corre el mes simulado (solo si no está en caché) y devuelve la carpeta con sus resultados. Se simula en una
 * carpeta propia que se renombra al terminar: una corrida a medias, o dos al mismo tiempo, nunca dejan una carpeta
 * incompleta donde otra prueba la busque. Lo llama una vez el globalSetup de la paridad (preparar.ts).
 */
export function prepararMesSimulado(): string {
  if (carpeta) return carpeta;
  const huella = createHash('sha256');
  for (const f of FUENTES) huella.update(readFileSync(f));
  const destino = join(tmpdir(), 'ijm-paridad', huella.digest('hex').slice(0, 16)).replace(/\\/g, '/');

  if (!existsSync(destino + '/sim/dias.json')) {
    const trabajo = `${destino}.${process.pid}.${Date.now()}`;
    mkdirSync(trabajo + '/sim', { recursive: true });
    // el libro de ejemplo como lo dejaba preparar_libro.py
    const libro = leerLibro(XLSX);
    writeFileSync(
      trabajo + '/libro.json',
      JSON.stringify(
        Object.fromEntries(
          Object.entries(libro).map(([h, filas]) => [
            h,
            filas.map((f) => f.map((v) => (v instanceof Date ? { __d: isoLocal(v) } : v === '' ? null : v))),
          ]),
        ),
      ),
    );
    writeFileSync(
      trabajo + '/harness.js',
      cambiarRutas(readFileSync(LEGACY + 'pruebas/harness.js', 'utf8'), trabajo),
    );
    for (const f of readdirSync(LEGACY + 'sim')) {
      let codigo = cambiarRutas(readFileSync(LEGACY + 'sim/' + f, 'utf8'), trabajo);
      if (f === 'base.js') {
        codigo = reemplazar(codigo, 'const reloj = {', 'const FOTOS = {};\nconst reloj = {', f);
        codigo = reemplazar(codigo, RELOJ_ORIGINAL, RELOJ_CON_FOTOS, f);
        codigo = reemplazar(codigo, 'module.exports = { reloj,', 'module.exports = { FOTOS, reloj,', f);
      }
      if (f === 'reporte.js') codigo += VOLCADO;
      writeFileSync(trabajo + '/sim/' + f, codigo);
    }
    execFileSync(process.execPath, ['sim.js'], {
      cwd: trabajo + '/sim',
      env: { ...process.env, TZ: 'America/Chicago' },
      stdio: 'pipe',
      timeout: 600_000,
    });
    try {
      renameSync(trabajo, destino);
    } catch {
      if (existsSync(destino + '/sim/dias.json')) {
        // otra corrida terminó primero: se usa la suya
        rmSync(trabajo, { recursive: true, force: true });
      } else {
        // una caché incompleta (la limpieza de temporales de Windows vacía las carpetas y las deja): se reemplaza
        rmSync(destino, { recursive: true, force: true });
        renameSync(trabajo, destino);
      }
    }
  }
  const trabajo = destino;

  // El reporte del legacy lista los "hallazgos" del mes: su propia prueba exige cero. Si hay alguno, los datos no
  // sirven para comparar (por ejemplo, porque el libro se leyó mal).
  const reporte = JSON.parse(readFileSync(trabajo + '/sim/despues.json', 'utf8')) as { hallazgos: unknown[] };
  if (reporte.hallazgos.length) {
    throw new Error('El mes simulado dejó hallazgos: ' + JSON.stringify(reporte.hallazgos).slice(0, 500));
  }
  carpeta = trabajo;
  return trabajo;
}

// JSON.stringify convirtió cada Date en texto ISO (UTC, con Z): se regresan a Date
const ES_FECHA = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/;
const revivir = (crudo: Libro): Libro =>
  Object.fromEntries(
    Object.entries(crudo).map(([h, filas]) => [
      h,
      filas.map((f) =>
        f.map((v) => (typeof v === 'string' && ES_FECHA.test(v) ? new Date(v) : v === null ? '' : v)),
      ),
    ]),
  );

let final: Libro | undefined;
let porDia: Map<string, Libro> | undefined;

/** Las hojas del libro al terminar el mes simulado. */
export function mesSimulado(): Libro {
  final ??= revivir(JSON.parse(readFileSync(prepararMesSimulado() + '/sim/hojas.json', 'utf8')) as Libro);
  return final;
}

/** Las hojas al terminar cada día simulado, por día ("2026-10-05"). */
export function diasSimulados(): Map<string, Libro> {
  if (!porDia) {
    const crudo = JSON.parse(readFileSync(prepararMesSimulado() + '/sim/dias.json', 'utf8')) as Record<
      string,
      Libro
    >;
    porDia = new Map(Object.entries(crudo).map(([d, l]) => [d, revivir(l)]));
  }
  return porDia;
}
