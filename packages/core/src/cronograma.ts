// El cronograma se calcula, no se dibuja (legacy: comun/cronograma.js y el tablero de admin/servidor.js).
//
// Cada partida trae su duración en días laborables, si arranca junto con la anterior (paralelo) y los días de
// espera antes (fabricación del countertop, del vidrio). Con eso y el día de inicio sale el PLAN. Con lo que el PM
// reporta cada día sale la PREVISIÓN: si algo se atrasa, todo lo que sigue se recorre y la entrega prevista se
// mueve antes de que pase. Los espacios corren en paralelo; la última partida de Generales (limpieza final) va
// después de todos.
import {
  type Calendario,
  type Dia,
  laborablesEntre,
  masTarde,
  primerLaborable,
  sumarLaborables,
} from './fechas';

export type Responsable = 'cuadrilla' | 'pm' | 'subcontratista';
export type EstadoPartida = 'sin_iniciar' | 'en_progreso' | 'terminada';

/** Una partida activa de un espacio, en su orden de trabajo. */
export interface PartidaCrono {
  readonly id: string;
  readonly dias: number;
  readonly paralelo: boolean;
  readonly espera: number;
  readonly responsable: Responsable;
  /** El oficio, si la hace un subcontratista. */
  readonly oficioId: string | null;
}

export interface EspacioCrono {
  readonly id: string;
  /** El espacio "Generales de obra": su última partida va después de todos los espacios. */
  readonly generales: boolean;
  readonly partidas: readonly PartidaCrono[];
}

/** Lo que pasó de verdad con una partida: el primer día con avance y el primer día que se marcó terminada. */
export interface Real {
  readonly ini: Dia | null;
  readonly fin: Dia | null;
}

export interface FilaCrono {
  readonly partidaId: string;
  readonly espacioId: string;
  readonly responsable: Responsable;
  readonly oficioId: string | null;
  readonly dias: number;
  readonly espera: number;
  readonly ini: Dia;
  readonly fin: Dia;
  readonly estado: EstadoPartida;
}

export interface Cronograma {
  readonly filas: readonly FilaCrono[];
  readonly fin: Dia | null;
}

/**
 * Calcula fechas de todas las partidas. Con `hoy` nulo es el plan puro; con `hoy`, la previsión: lo pendiente no
 * arranca en el pasado y lo que va en curso no termina antes de hoy (calcularCrono_ del legacy).
 */
export function calcularCronograma(
  inicio: Dia,
  espacios: readonly EspacioCrono[],
  real: ReadonlyMap<string, Real>,
  hoy: Dia | null,
  cal: Calendario,
): Cronograma {
  const filas: FilaCrono[] = [];

  const cadena = (
    esp: EspacioCrono,
    lista: readonly PartidaCrono[],
    arranque: Dia,
    todosParalelos: boolean,
  ) => {
    let base = arranque;
    let finGrupo: Dia | null = null;
    lista.forEach((p, i) => {
      const dias = Math.max(1, p.dias);
      const espera = Math.max(0, p.espera);
      const paralelo = todosParalelos || (i > 0 && p.paralelo);
      if (i > 0 && !paralelo) {
        base = sumarLaborables(finGrupo!, 1, cal);
        finGrupo = null;
      }
      let ini = espera ? sumarLaborables(base, espera, cal) : base;
      let fin = sumarLaborables(ini, dias - 1, cal);
      let estado: EstadoPartida = 'sin_iniciar';
      const r = real.get(p.id);
      if (r?.fin) {
        ini = primerLaborable(r.ini ?? r.fin, cal);
        fin = primerLaborable(r.fin, cal);
        estado = 'terminada';
      } else if (r?.ini) {
        ini = primerLaborable(r.ini, cal);
        fin = sumarLaborables(ini, dias - 1, cal);
        if (hoy && fin < hoy) fin = hoy;
        estado = 'en_progreso';
      } else if (hoy && ini < hoy) {
        // lo pendiente no arranca en el pasado
        ini = hoy;
        fin = sumarLaborables(ini, dias - 1, cal);
      }
      finGrupo = finGrupo ? masTarde(finGrupo, fin) : fin;
      filas.push({
        partidaId: p.id,
        espacioId: esp.id,
        responsable: p.responsable,
        oficioId: p.oficioId,
        dias,
        espera,
        ini,
        fin,
        estado,
      });
    });
    return finGrupo as Dia | null;
  };

  let finEspacios: Dia | null = null;
  for (const e of espacios.filter((x) => !x.generales)) {
    const f = cadena(e, e.partidas, inicio, false);
    if (f) finEspacios = finEspacios ? masTarde(finEspacios, f) : f;
  }
  for (const e of espacios.filter((x) => x.generales)) {
    if (!e.partidas.length) continue;
    const antes = e.partidas.slice(0, -1);
    const ultima = e.partidas.slice(-1);
    const f = antes.length ? cadena(e, antes, inicio, true) : null;
    const tope = [finEspacios, f]
      .filter((x): x is Dia => x !== null)
      .reduce<Dia | null>((m, x) => (m ? masTarde(m, x) : x), null);
    cadena(e, ultima, tope ? sumarLaborables(tope, 1, cal) : inicio, false);
  }
  const fin = filas.reduce<Dia | null>((m, x) => (m ? masTarde(m, x.fin) : x.fin), null);
  return { filas, fin };
}

/** Un registro de avance vigente: la partida se marcó en progreso o terminada ese día. */
export interface AvanceDia {
  readonly partidaId: string;
  readonly estado: 'en_progreso' | 'terminada';
  readonly dia: Dia;
}

/** Lo real de cada partida: el primer día con cualquier avance y el primer día que se marcó terminada. */
export function realDeAvance(avance: readonly AvanceDia[]): Map<string, Real> {
  const real = new Map<string, { ini: Dia | null; fin: Dia | null }>();
  for (const a of avance) {
    const x = real.get(a.partidaId) ?? { ini: null, fin: null };
    if (!x.ini || a.dia < x.ini) x.ini = a.dia;
    if (a.estado === 'terminada' && (!x.fin || a.dia < x.fin)) x.fin = a.dia;
    real.set(a.partidaId, x);
  }
  return real;
}

export interface FilaObra extends FilaCrono {
  readonly planIni: Dia;
  readonly planFin: Dia;
}

export interface CronogramaObra {
  readonly filas: readonly FilaObra[];
  readonly planFin: Dia | null;
  readonly prevFin: Dia | null;
}

/** Plan y previsión de una obra: cada partida con sus fechas planeadas y previstas (cronogramaObra_). */
export function cronogramaObra(
  fechaInicio: Dia,
  espacios: readonly EspacioCrono[],
  avance: readonly AvanceDia[],
  hoy: Dia,
  cal: Calendario,
): CronogramaObra {
  const inicio = primerLaborable(fechaInicio, cal);
  const plan = calcularCronograma(inicio, espacios, new Map(), null, cal);
  const prev = calcularCronograma(inicio, espacios, realDeAvance(avance), primerLaborable(hoy, cal), cal);
  return {
    filas: prev.filas.map((f, i) => ({ ...f, planIni: plan.filas[i]!.ini, planFin: plan.filas[i]!.fin })),
    planFin: plan.fin,
    prevFin: prev.fin,
  };
}

/**
 * Al dar de alta: la fecha de entrega que sale de las plantillas de los espacios elegidos, y cuántos días
 * laborables toma (duProponerEntrega).
 */
export function proponerEntrega(
  inicio: Dia,
  espacios: readonly (readonly PartidaCrono[])[],
  generales: readonly PartidaCrono[],
  cal: Calendario,
): { fecha: Dia; dias: number } | null {
  const ini = primerLaborable(inicio, cal);
  const lista: EspacioCrono[] = espacios
    .map((partidas, i) => ({ id: 'espacio-' + i, generales: false, partidas }))
    .concat([{ id: 'generales', generales: true, partidas: generales }]);
  const r = calcularCronograma(ini, lista, new Map(), null, cal);
  if (!r.fin) return null;
  return { fecha: r.fin, dias: laborablesEntre(ini, r.fin, cal) + 1 };
}

// ------------------------------------------------------------------ atraso (tablero del dueño)
/** La fecha comprometida: la entrega estimada más los días de las órdenes de cambio autorizadas. */
export const fechaComprometida = (finEstimada: Dia, diasOrdenesCambio: number, cal: Calendario): Dia =>
  sumarLaborables(finEstimada, diasOrdenesCambio, cal);

/** Días laborables que ya pasaron desde la fecha comprometida, mientras la obra no se entregue. */
export const atraso = (comprometida: Dia, hoy: Dia, entregada: boolean, cal: Calendario): number =>
  !entregada && hoy > comprometida ? laborablesEntre(comprometida, hoy, cal) : 0;

/** Días laborables que la entrega prevista pasa de la fecha comprometida. */
export const atrasoPrevisto = (comprometida: Dia, prevFin: Dia | null, cal: Calendario): number =>
  prevFin && prevFin > comprometida ? laborablesEntre(comprometida, prevFin, cal) : 0;

/** Qué parte de la obra debería ir hecha hoy si el avance fuera parejo hasta la fecha comprometida (0 a 1). */
export function avanceEsperado(inicio: Dia, comprometida: Dia, hoy: Dia, cal: Calendario): number {
  const plan = laborablesEntre(inicio, comprometida, cal) + 1;
  if (!plan || hoy < inicio) return 0;
  return Math.min(1, (laborablesEntre(inicio, hoy, cal) + 1) / plan);
}
