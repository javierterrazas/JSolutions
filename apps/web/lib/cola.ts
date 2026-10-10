// La cola de lo que el PM capturó y falta enviar (fase 2, paso 5; legacy: PM.html procesarCola y su prueba
// legacy/pruebas/prueba_cola.js). Nada se pierde nunca:
//   · se envía en orden, uno por uno;
//   · un error de red o del servidor no descarta nada: se queda y se reintenta después (y lo de atrás espera);
//   · un rechazo de negocio (una regla) no se arregla reintentando: sale de la cola y se le muestra al PM con su
//     razón, y lo de atrás sigue;
//   · si la sesión venció, se detiene sin perder nada hasta que vuelva a entrar.
// Un cierre o un gasto lleva su clave de envío (D-042, D-049) y sus fotos esperan detrás de él: si se rechaza, sus
// fotos salen con él.
import type { EntradaCierre, EntradaGasto } from '@ijm/servidor';

export interface CierreEnCola {
  readonly id: string;
  /** El orden de llegada a la cola. */
  readonly n: number;
  readonly tipo: 'cierre';
  readonly etiqueta: { readonly obra: string; readonly dia: string };
  /** Con `claveEnvio` = `id`. */
  readonly entrada: EntradaCierre;
  readonly intentos: number;
}

/** Un gasto del PM (D-049), con su recibo detrás como foto. */
export interface GastoEnCola {
  readonly id: string;
  readonly n: number;
  readonly tipo: 'gasto';
  readonly etiqueta: { readonly obra: string; readonly dia: string; readonly monto?: number };
  /** Con `claveEnvio` = `id`. */
  readonly entrada: EntradaGasto;
  readonly intentos: number;
}

export interface FotoEnCola {
  readonly id: string;
  readonly n: number;
  readonly tipo: 'foto';
  readonly etiqueta: { readonly obra: string; readonly dia: string };
  /** De qué es: un cierre o el recibo de un gasto. Las fotos que guardó una versión anterior no lo dicen: son de un cierre. */
  readonly de?: 'cierre' | 'gasto';
  /** La clave de envío de su cierre o su gasto. */
  readonly clave: string;
  readonly indice: number;
  readonly foto: Blob;
  readonly tomadaEn: string;
  readonly intentos: number;
}

export type ElementoCola = CierreEnCola | GastoEnCola | FotoEnCola;

export interface Rechazo {
  readonly id: string;
  readonly cuando: string;
  readonly tipo: ElementoCola['tipo'];
  readonly etiqueta: ElementoCola['etiqueta'];
  readonly codigo: string;
  readonly datos?: Readonly<Record<string, unknown>>;
  /** Las fotos que salieron de la cola con su cierre rechazado. */
  readonly fotos: number;
}

/** Lo que contesta el servidor a un envío. Un error de red no contesta: lanza. */
export type Respuesta =
  | { readonly ok: true }
  | { readonly ok: false; readonly codigo: string; readonly datos?: Readonly<Record<string, unknown>> };

export interface Almacen {
  elementos(): Promise<ElementoCola[]>;
  guardar(e: ElementoCola): Promise<void>;
  quitar(id: string): Promise<void>;
  rechazar(r: Rechazo): Promise<void>;
}

/** Cómo terminó una pasada: se vació, se quedó esperando la señal, o espera a que el PM vuelva a entrar. */
export type FinDeCola = 'vacia' | 'sin_red' | 'sin_sesion';

/** El código con que el servidor dice que la sesión ya no sirve: el PM tiene que volver a entrar. */
export const SIN_SESION = 'sesion';

export async function procesarCola(
  almacen: Almacen,
  enviar: (e: ElementoCola) => Promise<Respuesta>,
  ahora: () => Date = () => new Date(),
): Promise<FinDeCola> {
  for (;;) {
    const todos = await almacen.elementos();
    // una foto nunca sale antes que su cierre o su gasto, aunque haya tomado turno antes
    const turno = (x: ElementoCola) => {
      if (x.tipo !== 'foto') return x.n;
      const suyo = todos.find((p) => p.tipo !== 'foto' && p.id === x.clave);
      return suyo && suyo.n > x.n ? suyo.n + 0.5 : x.n;
    };
    const [e] = todos.sort((a, b) => turno(a) - turno(b));
    if (!e) return 'vacia';
    let r: Respuesta;
    try {
      r = await enviar(e);
    } catch {
      await almacen.guardar({ ...e, intentos: e.intentos + 1 });
      return 'sin_red';
    }
    if (r.ok) {
      await almacen.quitar(e.id);
      continue;
    }
    if (r.codigo === SIN_SESION) return 'sin_sesion';
    // negocio: sale, con sus fotos si es un cierre o un gasto, y se le avisa al PM
    const fotos =
      e.tipo !== 'foto'
        ? (await almacen.elementos()).filter((x) => x.tipo === 'foto' && x.clave === e.id)
        : [];
    for (const f of fotos) await almacen.quitar(f.id);
    await almacen.quitar(e.id);
    await almacen.rechazar({
      id: e.id,
      cuando: ahora().toISOString(),
      tipo: e.tipo,
      etiqueta: e.etiqueta,
      codigo: r.codigo,
      ...(r.datos ? { datos: r.datos } : {}),
      fotos: fotos.length,
    });
  }
}
