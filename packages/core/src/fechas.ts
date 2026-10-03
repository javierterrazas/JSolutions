// Días de negocio y calendario laboral (regla 5 de CLAUDE.md, D-006, D-028).
//
// Un día de negocio es un texto "AAAA-MM-DD": el día local de la empresa. Nunca un Date, que lleva hora y zona,
// y con el que el legacy tuvo un error de un día. Toda la aritmética se hace sobre el número de día, sin horas.

/** Un día de negocio: "2026-10-05". */
export type Dia = string;

/** Días de la semana como en ISO 8601: 1 = lunes … 7 = domingo. */
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * El calendario laboral de una empresa: qué días de la semana se trabaja y qué feriados se descansan. Un feriado
 * que la empresa decide trabajar no va en `feriados`.
 */
export interface Calendario {
  readonly laborables: ReadonlySet<DiaSemana>;
  readonly feriados: ReadonlySet<Dia>;
}

export function calendario(laborables: readonly DiaSemana[], feriados: readonly Dia[] = []): Calendario {
  if (!laborables.length) throw new Error('El calendario necesita al menos un día laborable');
  feriados.forEach(validarDia);
  return { laborables: new Set(laborables), feriados: new Set(feriados) };
}

/** El calendario del legacy: de lunes a viernes, sin feriados. Solo para la paridad. */
export const CALENDARIO_LEGACY = calendario([1, 2, 3, 4, 5]);

/** El de una empresa nueva: de lunes a sábado, sin feriados (D-028). */
export const CALENDARIO_POR_DEFECTO = calendario([1, 2, 3, 4, 5, 6]);

// ------------------------------------------------------------------ el día como número
const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_DIA = 86_400_000;

export function esDia(texto: unknown): texto is Dia {
  if (typeof texto !== 'string') return false;
  const m = FORMATO.exec(texto);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return (
    d.getUTCFullYear() === Number(m[1]) &&
    d.getUTCMonth() === Number(m[2]) - 1 &&
    d.getUTCDate() === Number(m[3])
  );
}

export function validarDia(texto: string): Dia {
  if (!esDia(texto)) throw new Error(`"${texto}" no es un día AAAA-MM-DD válido`);
  return texto;
}

/** Días desde 1970-01-01. Solo aritmética: no hay horas ni zonas. */
function numero(dia: Dia): number {
  const m = FORMATO.exec(dia);
  if (!m) throw new Error(`"${dia}" no es un día AAAA-MM-DD`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_DIA;
}

function deNumero(n: number): Dia {
  return new Date(n * MS_DIA).toISOString().slice(0, 10);
}

export const sumarDias = (dia: Dia, n: number): Dia => deNumero(numero(dia) + n);

/** Días naturales de a hasta b (negativo si b es antes). */
export const diasEntre = (a: Dia, b: Dia): number => numero(b) - numero(a);

export function diaSemana(dia: Dia): DiaSemana {
  // 1970-01-01 fue jueves
  return (((((numero(dia) + 3) % 7) + 7) % 7) + 1) as DiaSemana;
}

export const compararDias = (a: Dia, b: Dia): number => (a < b ? -1 : a > b ? 1 : 0);
export const masTarde = (a: Dia, b: Dia): Dia => (a > b ? a : b);
export const masTemprano = (a: Dia, b: Dia): Dia => (a < b ? a : b);

// ------------------------------------------------------------------ hoy, en la zona de la empresa
/** El día local de un instante en una zona horaria, por ejemplo America/Chicago. */
export function diaEnZona(instante: Date, zona: string): Dia {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

/** "Hoy" para la empresa. El instante llega como argumento: las reglas nunca leen el reloj por su cuenta. */
export const hoyEn = (ahora: Date, zona: string): Dia => diaEnZona(ahora, zona);

// ------------------------------------------------------------------ días laborables
export function esLaborable(dia: Dia, cal: Calendario): boolean {
  return cal.laborables.has(diaSemana(dia)) && !cal.feriados.has(dia);
}

/** El mismo día si es laborable; si no, el siguiente que lo sea (hab0_ del legacy). */
export function primerLaborable(dia: Dia, cal: Calendario): Dia {
  let d = dia;
  for (let i = 0; !esLaborable(d, cal); i++) {
    if (i > 366) throw new Error('El calendario no tiene días laborables');
    d = sumarDias(d, 1);
  }
  return d;
}

/** n días laborables después de `dia` (masHab_ y sumarHabiles_ del legacy). Con n = 0, el mismo día. */
export function sumarLaborables(dia: Dia, n: number, cal: Calendario): Dia {
  let d = dia;
  for (let k = 0; k < n;) {
    d = sumarDias(d, 1);
    if (esLaborable(d, cal)) k++;
  }
  return d;
}

/** n días laborables antes de `dia` (menosHab_ del legacy). */
export function restarLaborables(dia: Dia, n: number, cal: Calendario): Dia {
  let d = dia;
  for (let k = 0; k < n;) {
    d = sumarDias(d, -1);
    if (esLaborable(d, cal)) k++;
  }
  return d;
}

/** Días laborables después de a, hasta b inclusive (habilesEntre_ del legacy). Cero si b no es después de a. */
export function laborablesEntre(a: Dia, b: Dia, cal: Calendario): number {
  let n = 0;
  for (let d = sumarDias(a, 1); d <= b; d = sumarDias(d, 1)) if (esLaborable(d, cal)) n++;
  return n;
}

// ------------------------------------------------------------------ semanas
/** El lunes de la semana de `dia`. */
export const lunesDe = (dia: Dia): Dia => sumarDias(dia, 1 - diaSemana(dia));

/** El domingo de la semana de `dia`: la semana de trabajo termina el último día laborable antes de él. */
export const domingoDe = (dia: Dia): Dia => sumarDias(lunesDe(dia), 6);
