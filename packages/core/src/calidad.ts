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
 * aplica" saca la pregunta del total; tiene que quedar al menos una que aplique. Sin fotos no se registra: lo que
 * se cubre hoy no se vuelve a ver. El punto de control que exige prueba de agua (PC3) no se aprueba sin una prueba
 * de 24 h sin fuga en ese espacio. Errores: `inspeccion_sin_foto`, `hito_sin_preguntas`, `ninguno_aplica`,
 * `falta_prueba_agua`.
 */
export function calificarInspeccion(c: {
  readonly puntos: readonly PuntoControl[];
  readonly cumple: readonly string[];
  readonly noAplica: readonly string[];
  readonly fotos: number;
  readonly exigePruebaAgua: boolean;
  readonly pruebaAguaSinFugas: boolean;
}): ResultadoInspeccion {
  if (!c.fotos) throw new ErrorDeNegocio('inspeccion_sin_foto');
  if (!c.puntos.length) throw new ErrorDeNegocio('hito_sin_preguntas');
  const noAplica = c.puntos.filter((p) => c.noAplica.includes(p.id)).map((p) => p.id);
  const aplican = c.puntos.filter((p) => !noAplica.includes(p.id));
  if (!aplican.length) throw new ErrorDeNegocio('ninguno_aplica');
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

/** Los puntos que piden foto entre los que aplican: la app del PM pide una por cada uno. */
export const puntosConFoto = (puntos: readonly PuntoControl[], noAplica: readonly string[]): string[] =>
  puntos.filter((p) => p.requiereFoto && !noAplica.includes(p.id)).map((p) => p.id);

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
 * aprobar PC2 del baño no aprueba PC2 de la cocina. Error: `falta_inspeccion`, con la partida, el espacio y el hito.
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
