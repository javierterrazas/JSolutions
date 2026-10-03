// Quién es el usuario de la operación y en qué calendario trabaja su empresa.
import { type Calendario, calendario, type Dia, type DiaSemana, ErrorDeNegocio, hoyEn } from '@ijm/core';
import type { Tx } from './conexion';

export interface Sesion {
  readonly miembroId: string;
  readonly empresaId: string;
  readonly rol: 'dueno' | 'admin' | 'pm';
  readonly esDuenoOAdmin: boolean;
  readonly zona: string;
  readonly calendario: Calendario;
  readonly ahora: Date;
  readonly hoy: Dia;
}

/**
 * La sesión del usuario, leída con su propia identidad (RLS). Sin miembro activo de una empresa activa no hay
 * acceso: `sin_acceso`. Los feriados que la empresa trabaja no cuentan como descanso (D-028).
 */
export async function leerSesion(tx: Tx, ahora = new Date()): Promise<Sesion> {
  const [s] = await tx<{ miembro: string | null; empresa: string | null; rol: Sesion['rol'] | null }[]>`
    select public.miembro_actual() as miembro, public.empresa_actual() as empresa, public.rol_actual() as rol`;
  if (!s?.miembro || !s.empresa || !s.rol) throw new ErrorDeNegocio('sin_acceso');
  const [e] = await tx<{ zona: string }[]>`select zona_horaria as zona from public.empresa_actual_datos`;
  const [c] = await tx<{ dias: number[] }[]>`select dias_laborables as dias from public.configuracion_pm`;
  const feriados = await tx<{ dia: Dia }[]>`
    select to_char(dia, 'YYYY-MM-DD') as dia from public.feriados where not se_trabaja`;
  const zona = e?.zona ?? 'America/Chicago';
  return {
    miembroId: s.miembro,
    empresaId: s.empresa,
    rol: s.rol,
    esDuenoOAdmin: s.rol === 'dueno' || s.rol === 'admin',
    zona,
    calendario: calendario(
      (c?.dias ?? [1, 2, 3, 4, 5, 6]) as DiaSemana[],
      feriados.map((f) => f.dia),
    ),
    ahora,
    hoy: hoyEn(ahora, zona),
  };
}

/** Solo dueño o administrador. */
export function exigirDueno(s: Sesion): void {
  if (!s.esDuenoOAdmin) throw new ErrorDeNegocio('solo_dueno');
}
