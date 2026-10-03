// Avance ponderado (legacy: comun/obra.js avanceDe_, admin/servidor.js avanceObra_).
//
// Cada partida pesa según su complejidad (peso), no según cuántas son: "Protección" y "Tile de piso y muro" no
// valen lo mismo. Solo cuentan las TERMINADAS; las que van en curso se reportan aparte, como la parte clara de
// la barra. Los pesos son de esfuerzo, no de dinero: por eso el PM ve el mismo porcentaje que el dueño sin que se
// rompa la muralla financiera.
import type { AvanceDia, EstadoPartida } from './cronograma';

/** El estado actual de una partida: terminada si alguna vez se marcó terminada; en curso si tuvo avance. */
export function estadoDePartida(registros: readonly Pick<AvanceDia, 'estado'>[]): EstadoPartida {
  if (registros.some((r) => r.estado === 'terminada')) return 'terminada';
  if (registros.some((r) => r.estado === 'en_progreso')) return 'en_progreso';
  return 'sin_iniciar';
}

export interface PartidaPeso {
  readonly peso: number;
  readonly estado: EstadoPartida;
}

export interface Avance {
  /** Parte terminada, de 0 a 1. */
  readonly pct: number;
  /** Parte en curso, de 0 a 1. */
  readonly curso: number;
}

/** El peso de una partida: el de su plantilla, o 1 si no tiene uno válido. */
export const pesoValido = (peso: number | null | undefined): number => (peso && peso > 0 ? peso : 1);

export function avancePonderado(partidas: readonly PartidaPeso[]): Avance {
  const total = partidas.reduce((a, p) => a + p.peso, 0);
  if (!total) return { pct: 0, curso: 0 };
  const suma = (estado: EstadoPartida) =>
    partidas.filter((p) => p.estado === estado).reduce((a, p) => a + p.peso, 0);
  return { pct: suma('terminada') / total, curso: suma('en_progreso') / total };
}

export interface EspacioAvance {
  readonly id: string;
  readonly generales: boolean;
  readonly partidas: readonly { readonly id: string; readonly peso: number }[];
}

export interface AvanceObra extends Avance {
  readonly porEspacio: readonly (Avance & { readonly espacioId: string; readonly generales: boolean })[];
}

/** El avance de una obra, total y por espacio, con el estado de cada partida sacado de su avance. */
export function avanceDeObra(espacios: readonly EspacioAvance[], avance: readonly AvanceDia[]): AvanceObra {
  const porPartida = new Map<string, AvanceDia[]>();
  for (const a of avance) porPartida.set(a.partidaId, [...(porPartida.get(a.partidaId) ?? []), a]);
  const todas: PartidaPeso[] = [];
  const porEspacio = espacios.map((e) => {
    const ps = e.partidas.map((p) => ({
      peso: pesoValido(p.peso),
      estado: estadoDePartida(porPartida.get(p.id) ?? []),
    }));
    todas.push(...ps);
    return { espacioId: e.id, generales: e.generales, ...avancePonderado(ps) };
  });
  return { ...avancePonderado(todas), porEspacio };
}
