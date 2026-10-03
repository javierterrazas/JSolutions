// Carga el sistema legacy (Apps Script) dentro de una máquina virtual de Node para compararlo con packages/core.
// Hace lo mismo que legacy/pruebas/harness.js, pero sin rutas fijas de /tmp ni de /home/claude:
// simula lo mínimo de Google (hojas, caché, candado, propiedades) y deja controlar "ahora".
//
// Se cargan los archivos construidos (App_Dueno.gs, App_PM.gs): son los que se publican en Apps Script.

import { readFileSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RAIZ_LEGACY = fileURLToPath(new URL('../../../../legacy/', import.meta.url));

/** Una hoja: la primera fila son los encabezados, como en Google Sheets. */
export type Hoja = unknown[][];
export type Libro = Record<string, Hoja>;

export type AppLegacy = 'Dueno' | 'PM';

export interface OpcionesLegacy {
  /** Las hojas del libro. Por defecto, un libro vacío. */
  libro?: Libro;
  /** El momento que el legacy ve como "ahora". Por defecto, el reloj real. */
  ahora?: Date;
  /** Sesiones ya abiertas, token → usuario: para llamar las funciones públicas (du*, pm*) que piden token. */
  sesiones?: Record<string, string>;
}

/** El ámbito global del legacy: sus funciones quedan como propiedades. */
export type ContextoLegacy = Record<string, unknown>;

function hojaSimulada(datos: Hoja) {
  const fila = (r: number): unknown[] => {
    while (datos.length < r) datos.push([]);
    return datos[r - 1] as unknown[];
  };
  return {
    getDataRange: () => ({ getValues: () => datos.map((r) => r.slice()) }),
    getLastRow: () => {
      let k = datos.length;
      while (k > 1 && (datos[k - 1] ?? []).every((c) => c === '' || c === null || c === undefined)) k--;
      return k;
    },
    getRange: (r: number, c: number, nr = 1, nc = 1) => ({
      getValue: () => (datos[r - 1] ?? [])[c - 1],
      setValue: (v: unknown) => {
        fila(r)[c - 1] = v;
      },
      setValues: (valores: unknown[][]) =>
        valores.forEach((renglon, i) =>
          renglon.forEach((v, j) => {
            fila(r + i)[c - 1 + j] = v;
          }),
        ),
      getValues: () =>
        Array.from({ length: nr }, (_, i) => (datos[r - 1 + i] ?? []).slice(c - 1, c - 1 + nc)),
    }),
    appendRow: (v: unknown[]) => {
      datos.push(v);
    },
    deleteRow: (r: number) => {
      datos.splice(r - 1, 1);
    },
  };
}

// Apps Script entrega los bytes con signo
const conSigno = (b: Buffer) => Array.from(b, (n) => (n > 127 ? n - 256 : n));
const sinSigno = (bytes: number[]) => Buffer.from(bytes.map((n) => n & 255));

/** Una clase Date cuyo "ahora" es fijo. Las fechas con argumentos se comportan igual que siempre. */
function relojFijo(ahora: Date): DateConstructor {
  const t = ahora.getTime();
  class DateFijo extends Date {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(t);
      else super(...(args as [string]));
    }
    static override now() {
      return t;
    }
  }
  return DateFijo as DateConstructor;
}

export function cargarLegacy(app: AppLegacy, opciones: OpcionesLegacy = {}): ContextoLegacy {
  // una copia: el legacy escribe en sus hojas, y cada carga debe empezar con los mismos datos
  const libro = structuredClone(opciones.libro ?? {});
  const cache: Record<string, string> = {};
  // auth_() del legacy acepta una sesión guardada en la caché con el prefijo de su app
  for (const [token, usuario] of Object.entries(opciones.sesiones ?? {})) {
    cache['du_' + token] = usuario;
    cache['pm_' + token] = usuario;
  }
  const propiedades: Record<string, string> = {};
  const p2 = (n: number) => String(n).padStart(2, '0');

  const contexto: ContextoLegacy = {
    console,
    SpreadsheetApp: {
      openById: () => ({ getSheetByName: (n: string) => (libro[n] ? hojaSimulada(libro[n]) : null) }),
      flush: () => {},
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k: string) => cache[k] ?? null,
        put: (k: string, v: string) => {
          cache[k] = v;
        },
        remove: (k: string) => {
          delete cache[k];
        },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => propiedades[k] ?? null,
        setProperty(k: string, v: unknown) {
          propiedades[k] = String(v);
          return this;
        },
      }),
    },
    Session: { getScriptTimeZone: () => 'America/Chicago' },
    Utilities: {
      computeHmacSha256Signature: (v: string, k: string) =>
        conSigno(createHmac('sha256', String(k)).update(String(v)).digest()),
      base64EncodeWebSafe: (x: string | number[]) =>
        (typeof x === 'string' ? Buffer.from(x, 'utf8') : sinSigno(x))
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_'),
      base64DecodeWebSafe: (s: string) =>
        conSigno(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
      newBlob: (bytes: number[]) => ({ getDataAsString: () => sinSigno(bytes ?? []).toString('utf8') }),
      // como el de Apps Script: sustituye yyyy, MM, dd, HH, mm, ss en cualquier patrón (en la zona del proceso)
      formatDate: (d: Date, _zona: string, f: string) =>
        f.replace(/yyyy|MM|dd|HH|mm|ss/g, (t) =>
          String(
            {
              yyyy: d.getFullYear(),
              MM: p2(d.getMonth() + 1),
              dd: p2(d.getDate()),
              HH: p2(d.getHours()),
              mm: p2(d.getMinutes()),
              ss: p2(d.getSeconds()),
            }[t],
          ),
        ),
      getUuid: () => randomUUID(),
      base64Decode: () => [],
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    MailApp: { sendEmail: () => {} },
    Logger: { log: () => {} },
    HtmlService: {},
    DriveApp: {},
  };
  if (opciones.ahora) contexto.Date = relojFijo(opciones.ahora);

  const archivo = app === 'Dueno' ? 'App_Dueno.gs' : 'App_PM.gs';
  const codigo = readFileSync(RAIZ_LEGACY + 'app/' + archivo, 'utf8');
  vm.createContext(contexto);
  // __limpiarMemo: como el __n() de las pruebas del legacy, olvida lo leído para volver a leer las hojas
  const limpiarMemo = '\nfunction __limpiarMemo() { for (const k in _memo) delete _memo[k]; }';
  vm.runInContext(codigo + limpiarMemo, contexto, { filename: archivo });
  return contexto;
}

/** Toma una función del legacy por su nombre, o falla si no existe. */
export function funcionLegacy<F extends (...args: never[]) => unknown>(
  ctx: ContextoLegacy,
  nombre: string,
): F {
  const f = ctx[nombre];
  if (typeof f !== 'function') throw new Error(`El legacy no define ${nombre}`);
  return f as F;
}

/** El día local (zona del proceso) de una fecha, como "2026-10-05". */
export function diaLocal(d: Date): string {
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
