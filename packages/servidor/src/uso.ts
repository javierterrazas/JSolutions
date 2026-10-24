// El uso de la app (D-101; solo lo ve quien administra la plataforma): cada minuto que la app está abierta y a la
// vista se registra (registrarUso), y la plataforma ve, por empresa y por persona, los días que entró, el tiempo, las
// veces, la última vez, lo que capturó y cuánto tarda cada PM en cerrar el día. Nada de lo que escriben, ni dónde
// están: los minutos salen del aviso de la app; lo que hicieron, de sus propios registros.
import { type Dia, ErrorDeNegocio, hoyEn, sumarDias } from '@ijm/core';
import postgres from 'postgres';
import { z } from 'zod';
import type { Tx } from './conexion';
import { validarEntrada } from './entrada';

/** La app está abierta y a la vista: un minuto más de uso de quien tiene la sesión (sin sesión, nada). */
export async function registrarUso(tx: Tx): Promise<void> {
  await tx`select public.registrar_uso()`;
}

export interface UsoDePersona {
  readonly id: string;
  readonly nombre: string;
  readonly rol: 'dueno' | 'admin' | 'pm';
  readonly activo: boolean;
  /** Los días que abrió la app en el periodo. */
  readonly dias: number;
  readonly minutos: number;
  /** Las veces que entró (una vez más tras 15 minutos sin usarla). */
  readonly sesiones: number;
  readonly ultimoUso: Date | null;
  readonly cierres: number;
  readonly gastos: number;
  readonly avisos: number;
  readonly fotos: number;
  readonly cobros: number;
  /** Lo que tarda en promedio en cerrar el día, en segundos; null si no hay cierres medidos. */
  readonly segundosCierre: number | null;
}

export interface UsoDeEmpresa {
  readonly id: string;
  readonly nombre: string;
  readonly minutos: number;
  /** Cuántas personas abrieron la app en el periodo. */
  readonly activas: number;
  readonly personas: readonly UsoDePersona[];
  /**
   * Sus obras (D-111): las cerradas en total y en el periodo, las que van en curso, y el ticket promedio (el contrato
   * final de las cerradas; el contrato de las que van en curso). Null sin obras.
   */
  readonly obras: {
    readonly cerradas: number;
    readonly cerradasPeriodo: number;
    readonly enCurso: number;
    readonly ticketCerradas: number | null;
    readonly ticketEnCurso: number | null;
  };
}

/** El uso de cada empresa y de cada persona en los últimos `dias` (7, 30 o 90). Solo quien administra. */
export async function usoDeLaPlataforma(
  tx: Tx,
  entrada: { dias?: number } = {},
  ahora = new Date(),
): Promise<{ desde: Dia; empresas: UsoDeEmpresa[] }> {
  const { dias } = validarEntrada(
    z.object({ dias: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(7) }),
    entrada,
  );
  // el día de quien administra (Austin): los últimos 7 días son hoy y los 6 anteriores
  const desde = sumarDias(hoyEn(ahora, 'America/Chicago'), -(dias - 1));
  const filas = await tx<
    {
      empresa_id: string;
      empresa: string;
      miembro_id: string;
      nombre: string;
      rol: UsoDePersona['rol'];
      activo: boolean;
      dias: number;
      minutos: number;
      sesiones: number;
      ultimo_uso: Date | null;
      cierres: number;
      gastos: number;
      avisos: number;
      fotos: number;
      cobros: number;
      segundos_cierre: number | null;
    }[]
  >`select * from public.plataforma_uso(${desde})`.catch((e: unknown) => {
    if (e instanceof postgres.PostgresError && e.message === 'solo_plataforma')
      throw new ErrorDeNegocio('solo_plataforma');
    throw e;
  });
  const obras = new Map(
    (
      await tx<
        {
          empresa_id: string;
          cerradas: number;
          cerradas_periodo: number;
          en_curso: number;
          ticket_cerradas: string | null;
          ticket_en_curso: string | null;
        }[]
      >`
        select * from public.plataforma_obras_de_empresas(${desde})`
    ).map((o) => [
      o.empresa_id,
      {
        cerradas: o.cerradas,
        cerradasPeriodo: o.cerradas_periodo,
        enCurso: o.en_curso,
        ticketCerradas: o.ticket_cerradas === null ? null : Number(o.ticket_cerradas),
        ticketEnCurso: o.ticket_en_curso === null ? null : Number(o.ticket_en_curso),
      },
    ]),
  );
  const empresas = new Map<string, { id: string; nombre: string; personas: UsoDePersona[] }>();
  for (const f of filas) {
    const e = empresas.get(f.empresa_id) ?? { id: f.empresa_id, nombre: f.empresa, personas: [] };
    // los que no están activos solo salen si usaron la app en el periodo
    if (f.activo || f.minutos) {
      e.personas.push({
        id: f.miembro_id,
        nombre: f.nombre,
        rol: f.rol,
        activo: f.activo,
        dias: f.dias,
        minutos: f.minutos,
        sesiones: f.sesiones,
        ultimoUso: f.ultimo_uso,
        cierres: f.cierres,
        gastos: f.gastos,
        avisos: f.avisos,
        fotos: f.fotos,
        cobros: f.cobros,
        segundosCierre: f.segundos_cierre,
      });
    }
    empresas.set(f.empresa_id, e);
  }
  return {
    desde,
    empresas: [...empresas.values()]
      .map((e) => ({
        ...e,
        minutos: e.personas.reduce((a, p) => a + p.minutos, 0),
        activas: e.personas.filter((p) => p.minutos > 0).length,
        obras: obras.get(e.id) ?? {
          cerradas: 0,
          cerradasPeriodo: 0,
          enCurso: 0,
          ticketCerradas: null,
          ticketEnCurso: null,
        },
      }))
      .sort((a, b) => b.minutos - a.minutos || a.nombre.localeCompare(b.nombre)),
  };
}
