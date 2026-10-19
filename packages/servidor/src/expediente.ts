// Lo que el expediente de una obra (D-102) necesita y ninguna pantalla del dueño leía: las inspecciones con sus
// defectos, las pruebas de agua y el punch list. Lo demás del expediente sale de las funciones de siempre
// (seguimientoDeObra con todos los días, cambiosDeObra, cobrosDeObra, subcontratosDeObra, retrabajosDeObra…). Solo el
// dueño o el administrador.
import type { Dia } from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import type { Nombre } from './consultas-obra';
import { uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion } from './sesion';

export interface CalidadDeLaObra {
  readonly inspecciones: readonly {
    readonly espacio: string;
    readonly clave: string;
    readonly hito: Nombre;
    readonly resultado: 'aprobado' | 'con_defectos';
    readonly puntosOk: number;
    readonly puntosTotal: number;
    readonly realizada: Date;
    /** Las preguntas que no cumplieron. */
    readonly defectos: readonly string[];
  }[];
  readonly pruebas: readonly {
    readonly espacio: string;
    readonly inicio: Date;
    readonly fin: Date | null;
    readonly resultado: 'en_curso' | 'sin_fugas' | 'con_fuga';
  }[];
  readonly punch: readonly {
    readonly folio: string;
    readonly item: string;
    readonly responsable: string | null;
    readonly compromiso: Dia;
    readonly abierto: boolean;
    readonly cerrado: Date | null;
  }[];
}

/** Las inspecciones, las pruebas de agua y el punch list de una obra, en orden; null si no existe. */
export async function calidadDeLaObra(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<CalidadDeLaObra | null> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  exigirDueno(await leerSesion(tx, ahora));
  const [obra] = await tx`select 1 from obras where id = ${obraId}`;
  if (!obra) return null;
  const inspecciones = await tx<
    {
      id: string;
      espacio: string;
      clave: string;
      es: string;
      en: string | null;
      resultado: 'aprobado' | 'con_defectos';
      ok: number;
      total: number;
      realizada: Date;
    }[]
  >`
    select i.id, e.nombre as espacio, h.clave, h.nombre_es as es, h.nombre_en as en, i.resultado,
           i.puntos_ok as ok, i.puntos_total as total, i.realizada_en as realizada
    from inspecciones i join espacios e on e.id = i.espacio_id join hitos_calidad h on h.id = i.hito_id
    where i.obra_id = ${obraId} order by i.realizada_en`;
  const defectos = await tx<{ inspeccion: string; texto: string }[]>`
    select inspeccion_id as inspeccion, texto_es as texto from inspeccion_respuestas
    where obra_id = ${obraId} and respuesta = 'no_cumple'`;
  const pruebas = await tx<CalidadDeLaObra['pruebas'][number][]>`
    select e.nombre as espacio, p.inicio, p.fin, p.resultado
    from pruebas_agua p join espacios e on e.id = p.espacio_id
    where p.obra_id = ${obraId} order by p.inicio`;
  const punch = await tx<
    {
      folio: string;
      item: string;
      responsable: string | null;
      compromiso: Dia;
      estado: string;
      cerrado: Date | null;
    }[]
  >`
    select folio, item, responsable, to_char(fecha_compromiso, 'YYYY-MM-DD') as compromiso, estado,
           cerrado_en as cerrado
    from punch_list where obra_id = ${obraId} order by fecha_compromiso, folio`;
  return {
    inspecciones: inspecciones.map((i) => ({
      espacio: i.espacio,
      clave: i.clave,
      hito: { es: i.es, en: i.en },
      resultado: i.resultado,
      puntosOk: i.ok,
      puntosTotal: i.total,
      realizada: i.realizada,
      defectos: defectos.filter((d) => d.inspeccion === i.id).map((d) => d.texto),
    })),
    pruebas,
    punch: punch.map(({ estado, ...p }) => ({ ...p, abierto: estado === 'abierto' })),
  };
}
