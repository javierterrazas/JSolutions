// "Esta semana" del dueño, la semana del PM y el cumplimiento semanal del plan (legacy: admin/servidor.js
// estaSemana_, congelarSemana_, ppcSemanaPasada_; pm/servidor.js semanaPM_, diasSinCierre_).
import type { CronogramaObra, FilaCrono, Real } from './cronograma';
import {
  type Calendario,
  type Dia,
  domingoDe,
  esLaborable,
  lunesDe,
  masTarde,
  masTemprano,
  primerLaborable,
  restarLaborables,
  sumarDias,
  sumarLaborables,
} from './fechas';

export type EstadoOrden = 'emitida' | 'confirmada' | 'aprobada' | 'pagada' | 'cancelada';

export interface OrdenSemana {
  readonly id: string;
  readonly obraId: string;
  readonly subId: string;
  readonly partidaId: string;
  readonly estado: EstadoOrden;
  readonly inicio: Dia | null;
  readonly fin: Dia | null;
}

export interface SubSemana {
  readonly id: string;
  readonly oficioId: string;
  readonly activo: boolean;
}

/** Lo único que estas reglas leen de un cronograma: sus filas (sirve el plan o el de una obra). */
type ConFilas = { readonly filas: readonly FilaCrono[] };

const vigente = (o: OrdenSemana) => o.estado !== 'cancelada' && o.estado !== 'pagada';

export interface PorProgramar {
  readonly obraId: string;
  readonly espacioId: string;
  readonly partidaId: string;
  readonly inicio: Dia;
  readonly fin: Dia;
  /** Un subcontratista activo de ese oficio, para sugerirlo. */
  readonly subSugerido: string | null;
}

export interface Choque {
  readonly subId: string;
  readonly obras: readonly [string, string];
  readonly dia: Dia;
}

export interface EstaSemana {
  readonly porProgramar: readonly PorProgramar[];
  readonly sinConfirmar: readonly OrdenSemana[];
  readonly choques: readonly Choque[];
}

/**
 * Lo del dueño para esta semana:
 *  · subs por programar: partidas de un sub que arrancan en los próximos 5 días laborables y no tienen orden;
 *  · confirmaciones faltantes: órdenes emitidas que arrancan en los próximos 2 días laborables;
 *  · choques: el mismo sub en dos obras con fechas que se enciman.
 */
export function estaSemana(
  obras: readonly { readonly id: string; readonly cronograma: ConFilas }[],
  ordenes: readonly OrdenSemana[],
  subs: readonly SubSemana[],
  hoyCalendario: Dia,
  cal: Calendario,
): EstaSemana {
  const hoy = primerLaborable(hoyCalendario, cal);
  const tope = sumarLaborables(hoy, 5, cal);
  const en2 = sumarLaborables(hoy, 2, cal);
  const vivas = ordenes.filter(vigente);

  const porProgramar: PorProgramar[] = [];
  for (const obra of obras) {
    for (const f of obra.cronograma.filas) {
      if (f.responsable !== 'subcontratista' || f.estado === 'terminada' || f.ini > tope) continue;
      if (vivas.some((o) => o.obraId === obra.id && o.partidaId === f.partidaId)) continue;
      const sub = subs.find((s) => s.activo && s.oficioId === f.oficioId);
      porProgramar.push({
        obraId: obra.id,
        espacioId: f.espacioId,
        partidaId: f.partidaId,
        inicio: f.ini,
        fin: f.fin,
        subSugerido: sub?.id ?? null,
      });
    }
  }
  porProgramar.sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0));

  const sinConfirmar = vivas.filter((o) => {
    if (o.estado !== 'emitida' || !o.inicio) return false;
    const d = primerLaborable(o.inicio, cal);
    return d >= hoy && d <= en2;
  });

  const choques: Choque[] = [];
  const activas = vivas.filter(
    (o) =>
      (o.estado === 'emitida' || o.estado === 'confirmada') &&
      o.inicio !== null &&
      primerLaborable(o.fin ?? o.inicio, cal) >= hoy,
  );
  activas.forEach((a, i) =>
    activas.slice(i + 1).forEach((b) => {
      if (a.subId !== b.subId || a.obraId === b.obraId) return;
      const ini = masTarde(a.inicio!, b.inicio!);
      const fin = masTemprano(a.fin ?? a.inicio!, b.fin ?? b.inicio!);
      if (primerLaborable(ini, cal) <= primerLaborable(fin, cal)) {
        choques.push({ subId: a.subId, obras: [a.obraId, b.obraId], dia: ini });
      }
    }),
  );

  return { porProgramar, sinConfirmar, choques };
}

// ------------------------------------------------------------------ cumplimiento semanal del plan (PPC)
export interface PartidaPlaneada {
  readonly partidaId: string;
  readonly espacioId: string;
  readonly finPrevisto: Dia;
}

/**
 * Lo que el cronograma prevé terminar en la semana de `hoy`, para congelarlo el lunes (o la primera vez que se
 * abre la app en la semana). Lo que ya se terminó antes de hoy no entra.
 */
export function planDeLaSemana(cronograma: ConFilas, hoyCalendario: Dia, cal: Calendario): PartidaPlaneada[] {
  const lunes = lunesDe(hoyCalendario);
  const domingo = domingoDe(hoyCalendario);
  const hoy = primerLaborable(hoyCalendario, cal);
  return cronograma.filas
    .filter((f) => f.fin >= lunes && f.fin <= domingo && !(f.estado === 'terminada' && f.fin < hoy))
    .map((f) => ({ partidaId: f.partidaId, espacioId: f.espacioId, finPrevisto: f.fin }));
}

export interface Cumplimiento {
  readonly plan: number;
  readonly hecho: number;
  readonly ppc: number;
}

/**
 * Cumplimiento del plan de una semana: de lo congelado ese lunes, cuánto se terminó a más tardar el domingo.
 * Nulo si no hubo plan.
 */
export function cumplimientoSemanal(
  plan: readonly { readonly partidaId: string }[],
  real: ReadonlyMap<string, Real>,
  lunes: Dia,
  cal: Calendario,
): Cumplimiento | null {
  if (!plan.length) return null;
  const domingo = domingoDe(lunes);
  const hecho = plan.filter((p) => {
    const fin = real.get(p.partidaId)?.fin;
    return !!fin && primerLaborable(fin, cal) <= domingo;
  }).length;
  return { plan: plan.length, hecho, ppc: hecho / plan.length };
}

// ------------------------------------------------------------------ la semana del PM
export interface DiaDelPM {
  readonly dia: Dia;
  /** Las partidas que el cronograma prevé trabajar ese día. */
  readonly partidas: readonly string[];
  /** Las órdenes de trabajo cuyo sub arranca ese día. */
  readonly llegan: readonly string[];
}

/**
 * Qué toca cada día laborable de los próximos `dias` y qué sub llega. No guarda nada: sale del cronograma.
 * El legacy mostraba 5 días (de lunes a viernes); con el sábado laborable conviene pedir 6.
 */
export function semanaDelPM(
  cronograma: CronogramaObra,
  ordenes: readonly OrdenSemana[],
  hoyCalendario: Dia,
  cal: Calendario,
  dias = 5,
): { dias: DiaDelPM[]; prevFin: Dia | null } {
  const hoy = primerLaborable(hoyCalendario, cal);
  const vivas = ordenes.filter(vigente);
  const out: DiaDelPM[] = [];
  for (let i = 0; i < dias; i++) {
    const d = sumarLaborables(hoy, i, cal);
    out.push({
      dia: d,
      partidas: cronograma.filas
        .filter((f) => f.estado !== 'terminada' && f.ini <= d && f.fin >= d)
        .map((f) => f.partidaId),
      llegan: vivas.filter((o) => o.inicio && primerLaborable(o.inicio, cal) === d).map((o) => o.id),
    });
  }
  return { dias: out, prevFin: cronograma.prevFin };
}

/** Un cierre de día de la obra: su día y si hubo trabajo (si se marcaron partidas). */
export interface CierreDia {
  readonly dia: Dia;
  readonly conTrabajo: boolean;
}

/**
 * Los días que al PM se le olvidó cerrar y todavía puede cerrar él mismo: los últimos 2 días laborables antes de
 * hoy, desde el primer día con trabajo. Solo en obras en curso.
 */
export function diasSinCierre(
  cierres: readonly CierreDia[],
  obraEnCurso: boolean,
  hoy: Dia,
  cal: Calendario,
  ventana = 2,
): Dia[] {
  if (!obraEnCurso) return [];
  const trabajo = cierres.filter((c) => c.conTrabajo);
  if (!trabajo.length) return [];
  const primero = trabajo.reduce((m, c) => (c.dia < m ? c.dia : m), trabajo[0]!.dia);
  const cerrados = new Set(cierres.map((c) => c.dia));
  const out: Dia[] = [];
  for (let k = ventana; k >= 1; k--) {
    const d = restarLaborables(hoy, k, cal);
    if (d >= primero && !cerrados.has(d)) out.push(d);
  }
  return out;
}

/**
 * La racha del PM: cuántos días laborables seguidos cerró, contando hacia atrás desde hoy (o desde ayer, si hoy
 * todavía no cierra). Los días que la empresa no trabaja no la cortan (legacy: construirDatos_, que solo saltaba
 * sábado y domingo; aquí, el calendario de la empresa, D-028).
 */
export function rachaDeCierres(cerrados: readonly Dia[], hoy: Dia, cal: Calendario, hasta = 180): number {
  const hechos = new Set(cerrados);
  let dia = hechos.has(hoy) ? hoy : sumarDias(hoy, -1);
  let racha = 0;
  for (let i = 0; i < hasta; i++, dia = sumarDias(dia, -1)) {
    if (!esLaborable(dia, cal)) continue;
    if (!hechos.has(dia)) break;
    racha++;
  }
  return racha;
}
