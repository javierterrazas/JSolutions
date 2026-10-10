// Calidad en obra (fase 2, paso 6a; legacy: pm/servidor.js pmInspeccion, pmPruebaInicio, pmPruebaFin y la pantalla
// de calidad de PM.html): la inspección de un punto de control en un espacio y la prueba de inundación de 24 h.
// Solo el PM de la obra. Las reglas están en @ijm/core (calidad.ts); aquí se leen y se escriben, bajo RLS.
//
// Las fotos se registran aparte, con registrarFoto (refTipo 'inspeccion' o 'prueba_agua'), en la misma
// transacción: si una no sube, no queda nada a medias.
import {
  calificarInspeccion,
  cerrarPruebaAgua as horasDePrueba,
  ErrorDeNegocio,
  estadoDePartida,
  validarInicioPruebaAgua,
} from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import type { Nombre } from './consultas-obra';
import { uuid, validarEntrada } from './entrada';
import { leerSesion, type Sesion } from './sesion';

/** La obra, si es del PM y no se ha entregado; si no, `obra_no_encontrada`. */
async function obraDelPm(tx: Tx, s: Sesion, obraId: string) {
  const [o] = await tx<{ id: string; folio: string; cliente: string }[]>`
    select id, folio, cliente from obras
    where id = ${obraId} and pm_id = ${s.miembroId} and estado <> 'entregada'`;
  if (!o) throw new ErrorDeNegocio('obra_no_encontrada');
  return o;
}

async function espacioDe(tx: Tx, obraId: string, espacioId: string) {
  const [e] = await tx<{ id: string; nombre: string }[]>`
    select id, nombre from espacios where id = ${espacioId} and obra_id = ${obraId}`;
  if (!e) throw new ErrorDeNegocio('espacio_no_encontrado');
  return e;
}

export interface PruebaAgua {
  readonly id: string;
  readonly inicio: string;
  readonly fin: string | null;
  readonly resultado: 'en_curso' | 'sin_fugas' | 'con_fuga';
}

/** La prueba que manda en un espacio: la que está en curso, o la más reciente. */
async function pruebasDe(tx: Tx, obraId: string): Promise<Map<string, PruebaAgua>> {
  const filas = await tx<
    { id: string; espacio_id: string; inicio: Date; fin: Date | null; resultado: PruebaAgua['resultado'] }[]
  >`
    select id, espacio_id, inicio, fin, resultado from pruebas_agua
    where obra_id = ${obraId}
    order by (resultado = 'en_curso'), inicio`;
  // la última de cada espacio gana: la que está en curso, o la más reciente
  return new Map(
    filas.map((p) => [
      p.espacio_id,
      {
        id: p.id,
        inicio: p.inicio.toISOString(),
        fin: p.fin?.toISOString() ?? null,
        resultado: p.resultado,
      },
    ]),
  );
}

/** Si el espacio ya tiene una prueba terminada sin fuga: la condición para aprobar el punto que la exige (PC3). */
async function haySinFugas(tx: Tx, espacioId: string) {
  const [p] =
    await tx`select 1 from pruebas_agua where espacio_id = ${espacioId} and resultado = 'sin_fugas'`;
  return !!p;
}

// ------------------------------------------------------------------ lo que leen las pantallas

export interface UltimaInspeccion {
  readonly resultado: 'aprobado' | 'con_defectos';
  readonly realizadaEn: string;
  readonly puntosOk: number;
  readonly puntosTotal: number;
}

export interface DatosCalidad {
  readonly obra: { id: string; folio: string; cliente: string };
  /** Cada espacio con los puntos de control de sus partidas y la prueba de agua, si alguno la exige. */
  readonly espacios: readonly {
    id: string;
    nombre: string;
    hitos: readonly {
      id: string;
      clave: string;
      nombre: Nombre;
      exigePruebaAgua: boolean;
      /** Alguna de sus partidas ya empezó: la inspección está por hacerse (si no está aprobada). */
      enCurso: boolean;
      ultima: UltimaInspeccion | null;
    }[];
    necesitaPrueba: boolean;
    prueba: PruebaAgua | null;
  }[];
}

/** La pantalla de calidad de una obra del PM; null si no es suya. */
export async function datosParaCalidad(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<DatosCalidad | null> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  const s = await leerSesion(tx, ahora);
  const obra = await obraDelPm(tx, s, obraId).catch(() => null);
  if (!obra) return null;
  const espacios = await tx<{ id: string; nombre: string }[]>`
    select id, nombre from espacios where obra_id = ${obraId} order by orden`;
  const partidas = await tx<{ id: string; espacio_id: string; hito_id: string }[]>`
    select id, espacio_id, hito_id from partidas_obra
    where obra_id = ${obraId} and estado = 'activa' and hito_id is not null`;
  const avance = await tx<{ partida: string; estado: 'en_progreso' | 'terminada' }[]>`
    select partida_obra_id as partida, estado from avance where obra_id = ${obraId} and estado_registro = 'vigente'`;
  const hitos = new Map(
    (
      await tx<{ id: string; clave: string; es: string; en: string | null; agua: boolean; orden: number }[]>`
        select id, clave, nombre_es as es, nombre_en as en, exige_prueba_agua as agua, orden from hitos_calidad`
    ).map((h) => [h.id, h]),
  );
  const inspecciones = await tx<
    {
      espacio_id: string;
      hito_id: string;
      resultado: UltimaInspeccion['resultado'];
      realizada_en: Date;
      puntos_ok: number;
      puntos_total: number;
    }[]
  >`
    select espacio_id, hito_id, resultado, realizada_en, puntos_ok, puntos_total from inspecciones
    where obra_id = ${obraId} order by realizada_en`;
  const ultima = new Map(inspecciones.map((i) => [`${i.espacio_id}|${i.hito_id}`, i]));
  const pruebas = await pruebasDe(tx, obraId);

  return {
    obra,
    espacios: espacios
      .map((e) => {
        const suyas = partidas.filter((p) => p.espacio_id === e.id);
        const ids = [...new Set(suyas.map((p) => p.hito_id))]
          .filter((id) => hitos.has(id))
          .sort((a, b) => hitos.get(a)!.orden - hitos.get(b)!.orden);
        const lista = ids.map((id) => {
          const h = hitos.get(id)!;
          const u = ultima.get(`${e.id}|${id}`);
          return {
            id,
            clave: h.clave,
            nombre: { es: h.es, en: h.en },
            exigePruebaAgua: h.agua,
            enCurso: suyas.some(
              (p) =>
                p.hito_id === id &&
                estadoDePartida(avance.filter((a) => a.partida === p.id)) !== 'sin_iniciar',
            ),
            ultima: u
              ? {
                  resultado: u.resultado,
                  realizadaEn: u.realizada_en.toISOString(),
                  puntosOk: u.puntos_ok,
                  puntosTotal: u.puntos_total,
                }
              : null,
          };
        });
        return {
          id: e.id,
          nombre: e.nombre,
          hitos: lista,
          necesitaPrueba: lista.some((h) => h.exigePruebaAgua),
          prueba: pruebas.get(e.id) ?? null,
        };
      })
      .filter((e) => e.hitos.length),
  };
}

export interface DatosInspeccion {
  readonly obra: { id: string; folio: string; cliente: string };
  readonly espacio: { id: string; nombre: string };
  readonly hito: { id: string; clave: string; nombre: Nombre; exigePruebaAgua: boolean };
  /** Las preguntas del punto de control, en orden. */
  readonly puntos: readonly { id: string; texto: Nombre; requiereFoto: boolean }[];
  /** La prueba de agua del espacio, si el punto la exige. */
  readonly prueba: PruebaAgua | null;
}

/** La pantalla de una inspección; null si la obra no es del PM o el espacio no es de la obra. */
export async function datosParaInspeccion(
  tx: Tx,
  entrada: { obraId: string; espacioId: string; hitoId: string },
  ahora = new Date(),
): Promise<DatosInspeccion | null> {
  const e = validarEntrada(z.object({ obraId: uuid, espacioId: uuid, hitoId: uuid }), entrada);
  const s = await leerSesion(tx, ahora);
  const obra = await obraDelPm(tx, s, e.obraId).catch(() => null);
  if (!obra) return null;
  const espacio = await espacioDe(tx, e.obraId, e.espacioId).catch(() => null);
  const [h] = await tx<{ id: string; clave: string; es: string; en: string | null; agua: boolean }[]>`
    select id, clave, nombre_es as es, nombre_en as en, exige_prueba_agua as agua
    from hitos_calidad where id = ${e.hitoId} and activo`;
  if (!espacio || !h) return null;
  const puntos = await tx<{ id: string; es: string; en: string | null; foto: boolean }[]>`
    select id, texto_es as es, texto_en as en, requiere_foto as foto from puntos_control
    where hito_id = ${e.hitoId} and activo order by orden, texto_es`;
  return {
    obra,
    espacio,
    hito: { id: h.id, clave: h.clave, nombre: { es: h.es, en: h.en }, exigePruebaAgua: h.agua },
    puntos: puntos.map((p) => ({ id: p.id, texto: { es: p.es, en: p.en }, requiereFoto: p.foto })),
    prueba: h.agua ? ((await pruebasDe(tx, e.obraId)).get(e.espacioId) ?? null) : null,
  };
}

// ------------------------------------------------------------------ la inspección

const EntradaInspeccion = z.object({
  obraId: uuid,
  espacioId: uuid,
  hitoId: uuid,
  cumple: z.array(uuid).default([]),
  noAplica: z.array(uuid).default([]),
  fotos: z.number().int().min(0),
});
export type EntradaInspeccion = z.input<typeof EntradaInspeccion>;

/**
 * Registra la inspección de un punto de control en un espacio (legacy: pmInspeccion). El servidor la califica
 * contra la lista REAL de preguntas; cada pregunta queda con su respuesta y su texto. Lo que no se marcó como
 * cumplido ni como "No aplica" es un defecto. Errores: los de calificarInspeccion (`inspeccion_sin_foto`,
 * `hito_sin_preguntas`, `ninguno_aplica`, `falta_prueba_agua`), `obra_no_encontrada`, `espacio_no_encontrado`,
 * `hito_inexistente`.
 */
export async function registrarInspeccion(
  tx: Tx,
  entrada: EntradaInspeccion,
  ahora = new Date(),
): Promise<{ inspeccionId: string; resultado: 'aprobado' | 'con_defectos'; defectos: number }> {
  const e = validarEntrada(EntradaInspeccion, entrada);
  const s = await leerSesion(tx, ahora);
  await obraDelPm(tx, s, e.obraId);
  await espacioDe(tx, e.obraId, e.espacioId);
  const [hito] = await tx<{ agua: boolean }[]>`
    select exige_prueba_agua as agua from hitos_calidad where id = ${e.hitoId} and activo`;
  if (!hito) throw new ErrorDeNegocio('hito_inexistente', { hito: e.hitoId });
  const puntos = await tx<{ id: string; texto: string; foto: boolean }[]>`
    select id, texto_es as texto, requiere_foto as foto from puntos_control
    where hito_id = ${e.hitoId} and activo order by orden, texto_es`;

  const r = calificarInspeccion({
    puntos: puntos.map((p) => ({ id: p.id, requiereFoto: p.foto })),
    cumple: e.cumple,
    noAplica: e.noAplica,
    fotos: e.fotos,
    exigePruebaAgua: hito.agua,
    pruebaAguaSinFugas: hito.agua && (await haySinFugas(tx, e.espacioId)),
  });

  // la partida que se inspecciona: la primera de ese punto en el espacio que no se ha terminado
  const candidatas = await tx<{ id: string }[]>`
    select id from partidas_obra
    where espacio_id = ${e.espacioId} and hito_id = ${e.hitoId} and estado = 'activa' order by orden`;
  const avance = await tx<{ partida: string; estado: 'en_progreso' | 'terminada' }[]>`
    select partida_obra_id as partida, estado from avance
    where obra_id = ${e.obraId} and estado_registro = 'vigente'`;
  const partida =
    candidatas.find((p) => estadoDePartida(avance.filter((a) => a.partida === p.id)) !== 'terminada') ??
    candidatas[0];

  const [insp] = await tx<{ id: string }[]>`
    insert into inspecciones (empresa_id, obra_id, espacio_id, hito_id, partida_obra_id, resultado, puntos_ok,
                              puntos_total, realizada_en)
    values (${s.empresaId}, ${e.obraId}, ${e.espacioId}, ${e.hitoId}, ${partida?.id ?? null}, ${r.resultado},
            ${r.puntosOk}, ${r.puntosTotal}, ${ahora})
    returning id`;
  await tx`insert into inspeccion_respuestas ${tx(
    puntos.map((p) => ({
      empresa_id: s.empresaId,
      obra_id: e.obraId,
      inspeccion_id: insp!.id,
      punto_control_id: p.id,
      texto_es: p.texto,
      respuesta: r.noAplica.includes(p.id) ? 'no_aplica' : r.defectos.includes(p.id) ? 'no_cumple' : 'cumple',
    })),
  )}`;
  return { inspeccionId: insp!.id, resultado: r.resultado, defectos: r.defectos.length };
}

// ------------------------------------------------------------------ la prueba de inundación

const EntradaInicioPrueba = z.object({ obraId: uuid, espacioId: uuid, fotos: z.number().int().min(0) });

/**
 * Arranca la prueba de inundación de un espacio, con la foto del nivel (legacy: pmPruebaInicio). Una sola en curso
 * por espacio. Errores: `prueba_sin_foto`, `prueba_en_curso`, `obra_no_encontrada`, `espacio_no_encontrado`.
 */
export async function iniciarPruebaAgua(
  tx: Tx,
  entrada: z.input<typeof EntradaInicioPrueba>,
  ahora = new Date(),
): Promise<{ pruebaId: string }> {
  const e = validarEntrada(EntradaInicioPrueba, entrada);
  const s = await leerSesion(tx, ahora);
  await obraDelPm(tx, s, e.obraId);
  await espacioDe(tx, e.obraId, e.espacioId);
  const [enCurso] = await tx`
    select 1 from pruebas_agua where espacio_id = ${e.espacioId} and resultado = 'en_curso'`;
  validarInicioPruebaAgua({ fotos: e.fotos, hayEnCurso: !!enCurso });
  const [p] = await tx<{ id: string }[]>`
    insert into pruebas_agua (empresa_id, obra_id, espacio_id, inicio)
    values (${s.empresaId}, ${e.obraId}, ${e.espacioId}, ${ahora})
    returning id`;
  return { pruebaId: p!.id };
}

const EntradaFinPrueba = z.object({ pruebaId: uuid, hayFuga: z.boolean(), fotos: z.number().int().min(0) });

/**
 * Cierra la prueba con la foto del nivel: sin fuga o con fuga (legacy: pmPruebaFin). Menos de 23 horas no cuenta.
 * Errores: `prueba_sin_foto`, `prueba_incompleta` (con las horas), `prueba_no_encontrada`.
 */
export async function terminarPruebaAgua(
  tx: Tx,
  entrada: z.input<typeof EntradaFinPrueba>,
  ahora = new Date(),
): Promise<{ horas: number; resultado: 'sin_fugas' | 'con_fuga' }> {
  const e = validarEntrada(EntradaFinPrueba, entrada);
  const s = await leerSesion(tx, ahora);
  const [p] = await tx<{ obra_id: string; inicio: Date }[]>`
    select obra_id, inicio from pruebas_agua where id = ${e.pruebaId} and resultado = 'en_curso'`;
  if (!p) throw new ErrorDeNegocio('prueba_no_encontrada');
  await obraDelPm(tx, s, p.obra_id);
  const horas = horasDePrueba(p.inicio, ahora, e.fotos);
  const resultado = e.hayFuga ? 'con_fuga' : 'sin_fugas';
  const r = await tx`
    update pruebas_agua set fin = ${ahora}, resultado = ${resultado} where id = ${e.pruebaId}`;
  // la política solo deja cerrar la prueba a quien la arrancó
  if (!r.count) throw new ErrorDeNegocio('prueba_no_encontrada');
  return { horas, resultado };
}
