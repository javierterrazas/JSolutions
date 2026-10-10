// La copia de lo que el PM necesita para cerrar el día sin señal (fase 2, paso 5c; D-047): sus obras, cada una con
// lo que pide la pantalla de cierre. El teléfono la guarda cada vez que el PM abre su inicio con señal. No lleva
// dinero: es lo mismo que el PM ya ve con señal.
import { type Dia, sumarLaborables } from '@ijm/core';
import type { Tx } from './conexion';
import { type DatosCierre, datosParaCierre } from './pantalla-cierre';
import { leerSesion } from './sesion';

/** Hasta cuántos días laborables adelante guarda la copia los subs esperados: una semana sin señal. */
export const DIAS_DE_SUBS_EN_LA_COPIA = 6;

export interface CopiaSinSenal {
  /** Cuándo se hizo la copia (ISO). */
  readonly hecha: string;
  readonly miembro: { readonly id: string; readonly nombre: string };
  /** La zona de la empresa: "hoy" se calcula en el teléfono con ella. */
  readonly zona: string;
  readonly obras: readonly {
    readonly datos: DatosCierre;
    /** Los días ya cerrados de la última semana: hoy, si ya se cerró, no se vuelve a ofrecer. */
    readonly cerrados: readonly Dia[];
  }[];
}

/** La copia del PM; null para el dueño o el administrador, que no cierran días. */
export async function copiaSinSenal(tx: Tx, ahora = new Date()): Promise<CopiaSinSenal | null> {
  const s = await leerSesion(tx, ahora);
  if (s.rol !== 'pm') return null;
  const [yo] = await tx<{ nombre: string }[]>`select nombre from miembros where id = ${s.miembroId}`;
  const obras = await tx<{ id: string }[]>`
    select id from obras where pm_id = ${s.miembroId} and estado <> 'entregada' order by folio`;
  const subsHasta = sumarLaborables(s.hoy, DIAS_DE_SUBS_EN_LA_COPIA, s.calendario);
  const lista: CopiaSinSenal['obras'][number][] = [];
  for (const o of obras) {
    const datos = await datosParaCierre(tx, { obraId: o.id, subsHasta }, ahora);
    if (!datos) continue;
    const cerrados = await tx<{ dia: Dia }[]>`
      select to_char(dia, 'YYYY-MM-DD') as dia from bitacora
      where obra_id = ${o.id} and estado = 'vigente' and dia >= ${s.hoy}::date - 7
      order by dia`;
    lista.push({ datos, cerrados: cerrados.map((c) => c.dia) });
  }
  return {
    hecha: ahora.toISOString(),
    miembro: { id: s.miembroId, nombre: yo?.nombre ?? '' },
    zona: s.zona,
    obras: lista,
  };
}
