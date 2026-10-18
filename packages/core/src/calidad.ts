// Calidad (legacy: pm/servidor.js pmInspeccion, pmPruebaInicio, pmPruebaFin, pmCerrarDia; admin/servidor.js
// duCierreTardio, duFotosCriticas). Puntos de control PC1–PC5: una partida con punto de control no se termina
// sin su inspección aprobada, en SU espacio.
import { ErrorDeNegocio } from './errores';

// ------------------------------------------------------------------ inspección
export interface PuntoControl {
  readonly id: string;
  readonly requiereFoto: boolean;
}

export interface ResultadoInspeccion {
  readonly resultado: 'aprobado' | 'con_defectos';
  readonly puntosOk: number;
  readonly puntosTotal: number;
  /** Los puntos que aplican y no se marcaron como cumplidos. */
  readonly defectos: readonly string[];
  /** Los puntos marcados "No aplica": salen del total, pero quedan registrados. */
  readonly noAplica: readonly string[];
}

/**
 * Califica una inspección contra la lista REAL del punto de control: el servidor no le cree al teléfono. "No
 * aplica" saca la pregunta del total; tiene que quedar al menos una que aplique. La foto se pide solo donde protege
 * ante un reclamo o una garantía (D-058): una por cada pregunta que pide foto y se marca como cumplida. Una
 * inspección sin ninguna así, o con defectos en ellas, se registra sin fotos. El punto de control que exige prueba
 * de agua (PC3) no se aprueba sin una prueba de 24 h sin fuga en ese espacio. Al volver a inspeccionar, la foto de lo
 * que ya cumplía la vez pasada ya cuenta (`conFotoPrevia`, D-092): solo se pide la de lo que se corrigió. Errores:
 * `hito_sin_preguntas`, `ninguno_aplica`, `inspeccion_sin_foto` (con cuántas `piden`), `falta_prueba_agua`.
 */
export function calificarInspeccion(c: {
  readonly puntos: readonly PuntoControl[];
  readonly cumple: readonly string[];
  readonly noAplica: readonly string[];
  readonly fotos: number;
  readonly exigePruebaAgua: boolean;
  readonly pruebaAguaSinFugas: boolean;
  readonly conFotoPrevia?: readonly string[];
}): ResultadoInspeccion {
  if (!c.puntos.length) throw new ErrorDeNegocio('hito_sin_preguntas');
  const noAplica = c.puntos.filter((p) => c.noAplica.includes(p.id)).map((p) => p.id);
  const aplican = c.puntos.filter((p) => !noAplica.includes(p.id));
  if (!aplican.length) throw new ErrorDeNegocio('ninguno_aplica');
  const piden = fotosQuePide(c.puntos, c.cumple, noAplica, c.conFotoPrevia).length;
  if (c.fotos < piden) throw new ErrorDeNegocio('inspeccion_sin_foto', { piden });
  const defectos = aplican.filter((p) => !c.cumple.includes(p.id)).map((p) => p.id);
  const ok = aplican.length - defectos.length;
  const aprobado = ok === aplican.length && !defectos.length;
  if (aprobado && c.exigePruebaAgua && !c.pruebaAguaSinFugas) throw new ErrorDeNegocio('falta_prueba_agua');
  return {
    resultado: aprobado ? 'aprobado' : 'con_defectos',
    puntosOk: ok,
    puntosTotal: aplican.length,
    defectos,
    noAplica,
  };
}

/** Los puntos que piden foto entre los que aplican. */
export const puntosConFoto = (puntos: readonly PuntoControl[], noAplica: readonly string[]): string[] =>
  puntos.filter((p) => p.requiereFoto && !noAplica.includes(p.id)).map((p) => p.id);

/**
 * Las fotos que pide una inspección (D-058): una por cada pregunta que pide foto, aplica y se marca cumplida, menos
 * las que ya tienen su foto de la inspección anterior (D-092).
 */
export const fotosQuePide = (
  puntos: readonly PuntoControl[],
  cumple: readonly string[],
  noAplica: readonly string[],
  conFotoPrevia: readonly string[] = [],
): string[] =>
  puntosConFoto(puntos, noAplica).filter((id) => cumple.includes(id) && !conFotoPrevia.includes(id));

/** Las 38 preguntas de los puntos de control PC1–PC5 de la plantilla estándar (legacy: PUNTOS_ESTANDAR_). */
const PUNTOS_ESTANDAR = [
  'Estructura visible sin daño por agua ni termita',
  'Material de la plomería existente identificado (galvanizado, PEX, cobre)',
  'Cableado sin aluminio; GFCI presente donde aplica',
  'Subpiso nivelado, sin pudrición ni capas previas de tile',
  'El extractor existente descarga al exterior, no al ático',
  'Muros medidos a nivel y plomo',
  'Sin evidencia de moho ni humedad previa',
  'Hallazgos levantados como aviso el mismo día',
  'Prueba de presión de plomería sostenida',
  'Drenaje con pendiente y ventilación conectada',
  'Ubicaciones verificadas contra plano: regadera, desagües, salidas',
  'Blocking para barras, banco, nichos, toallero y vanity',
  'Circuitos dedicados y GFCI en su lugar',
  'Extractor con ducto aislado al exterior y damper',
  'Alturas de salidas verificadas contra el diseño de tile',
  'FOTO PANORÁMICA DE CADA MURO COMPLETO antes de cubrir',
  'Sistema aplicado según instrucciones del fabricante',
  'Refuerzo en esquinas, juntas y penetraciones',
  'Pre-pendiente y pendiente correctas hacia el desagüe',
  'Desagüe con brida y sello correctos',
  'PRUEBA DE INUNDACIÓN DE 24 HORAS documentada',
  'Sin perforaciones posteriores a la prueba',
  'Tile a nivel, a plomo y con juntas alineadas',
  'Sin piezas huecas (golpear con nudillo)',
  'Lechada uniforme, sin faltantes y curada',
  'Sellador en los cambios de plano, no lechada',
  'Gabinetes nivelados, a plomo y anclados a blocking',
  'Puertas y cajones con holgura pareja',
  'Superficie a nivel antes de tomar plantilla de countertop',
  'Plomería probada: llaves, desagües, sanitario, sin fugas bajo vanity',
  'Puerta de regadera alineada, sellada y sin roce',
  'Iluminación y extractor funcionando (extractor probado con papel)',
  'Tomacorrientes probados; GFCI disparado y reseteado',
  'Cajones y puertas ajustados',
  'Silicón parejo en todas las uniones',
  'Pintura sin marcas y tapas de registro colocadas',
  'Limpieza profunda hecha, incluye interior de gabinetes y vidrios',
  'Fotos finales para portafolio, misma toma que las del día 1',
];

/**
 * En cuáles la foto es lo que protege (legacy: FOTO_CRITICA_): cómo estaba antes de empezar (daños y plomería
 * existentes), lo que se tapa y no se vuelve a ver (presión, muros abiertos, impermeabilización, anclaje de
 * gabinetes) y cómo se entregó (sin fugas, las fotos finales). La prueba de inundación lleva sus propias fotos.
 */
const FOTO_CRITICA = [
  'Estructura visible sin daño por agua ni termita',
  'Material de la plomería existente identificado (galvanizado, PEX, cobre)',
  'Prueba de presión de plomería sostenida',
  'FOTO PANORÁMICA DE CADA MURO COMPLETO antes de cubrir',
  'Refuerzo en esquinas, juntas y penetraciones',
  'Desagüe con brida y sello correctos',
  'Gabinetes nivelados, a plomo y anclados a blocking',
  'Plomería probada: llaves, desagües, sanitario, sin fugas bajo vanity',
  'Fotos finales para portafolio, misma toma que las del día 1',
];

/** Sin acentos, mayúsculas ni espacios de más: el libro de IJM escribe "dano" y "plomeria". */
const comparable = (t: string) =>
  t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const ESTANDAR = new Set(PUNTOS_ESTANDAR.map(comparable));
const CRITICA = new Set(FOTO_CRITICA.map(comparable));

/**
 * Si una pregunta del catálogo pide foto (D-058): las estándar, solo las críticas; las que agregó el dueño, lo que él
 * haya dicho (`deLaEmpresa`).
 */
export function pideFoto(texto: string, deLaEmpresa: boolean): boolean {
  const t = comparable(texto);
  return ESTANDAR.has(t) ? CRITICA.has(t) : deLaEmpresa;
}

/**
 * "Foto solo en lo crítico": deja la foto obligatoria en los puntos críticos de la plantilla estándar y la quita en
 * los demás puntos estándar. Los puntos que agregó el dueño no se tocan. Devuelve lo que cambia.
 */
export function fotosCriticas(
  puntos: readonly (PuntoControl & { readonly estandar: boolean; readonly critico: boolean })[],
): { cambios: { id: string; requiereFoto: boolean }[]; criticos: number } {
  const estandar = puntos.filter((p) => p.estandar);
  return {
    cambios: estandar
      .filter((p) => p.requiereFoto !== p.critico)
      .map((p) => ({ id: p.id, requiereFoto: p.critico })),
    criticos: estandar.filter((p) => p.critico).length,
  };
}

// ------------------------------------------------------------------ partidas con punto de control
/** Una inspección registrada: manda la última de cada punto de control en cada espacio. */
export interface InspeccionHecha {
  readonly espacioId: string;
  readonly hitoId: string;
  readonly resultado: 'aprobado' | 'con_defectos';
  /** Para ordenar: la más reciente manda. */
  readonly realizadaEn: string;
}

/**
 * Ninguna partida con punto de control se termina sin su inspección aprobada, revisada ESPACIO POR ESPACIO:
 * aprobar PC2 del baño no aprueba PC2 de la cocina. Una inspección por punto y espacio (D-092): si dos partidas del
 * espacio llevan el mismo punto (gabinetes y countertop con PC4), la aprobada sirve para las dos; no se repite.
 * Error: `falta_inspeccion`, con la partida, el espacio y el hito.
 */
export function exigirInspecciones(
  terminadas: readonly {
    readonly partidaId: string;
    readonly espacioId: string;
    readonly hitoId: string | null;
  }[],
  inspecciones: readonly InspeccionHecha[],
): void {
  for (const t of terminadas) {
    if (!t.hitoId) continue;
    const ultima = inspecciones
      .filter((i) => i.espacioId === t.espacioId && i.hitoId === t.hitoId)
      .reduce<InspeccionHecha | null>((m, i) => (!m || i.realizadaEn >= m.realizadaEn ? i : m), null);
    if (ultima?.resultado !== 'aprobado') {
      throw new ErrorDeNegocio('falta_inspeccion', {
        partida: t.partidaId,
        espacio: t.espacioId,
        hito: t.hitoId,
      });
    }
  }
}

// ------------------------------------------------------------------ prueba de inundación
/** Una sola prueba en curso por espacio, y arranca con la foto del nivel de agua. */
export function validarInicioPruebaAgua(c: { readonly fotos: number; readonly hayEnCurso: boolean }): void {
  if (!c.fotos) throw new ErrorDeNegocio('prueba_sin_foto');
  if (c.hayEnCurso) throw new ErrorDeNegocio('prueba_en_curso');
}

/**
 * Cierra la prueba con la foto del nivel. Menos de 23 horas no cuenta: cerrarla antes no prueba nada.
 * Devuelve las horas, con un decimal. Errores: `prueba_sin_foto`, `prueba_incompleta`.
 */
export function cerrarPruebaAgua(inicio: Date, ahora: Date, fotos: number): number {
  if (!fotos) throw new ErrorDeNegocio('prueba_sin_foto');
  const horas = Math.round(((ahora.getTime() - inicio.getTime()) / 3_600_000) * 10) / 10;
  if (horas < 23) throw new ErrorDeNegocio('prueba_incompleta', { horas });
  return horas;
}
