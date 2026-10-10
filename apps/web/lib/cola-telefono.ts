// La cola del teléfono: guarda en IndexedDB (almacen.ts), envía con las acciones de la cola (acciones/cola.ts) y
// sigue las reglas de cola.ts. Las pantallas se enteran de cada cambio con `alCambiar`.
import { enviarCierre, enviarFoto, enviarGasto } from '@/app/acciones/cola';
import { guardar, quitar, todos } from './almacen';
import { type Almacen, type ElementoCola, type FinDeCola, procesarCola, type Rechazo } from './cola';

const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

/** Para que una pantalla se entere cuando la cola cambia. Devuelve cómo dejar de escuchar. */
export function alCambiar(fn: () => void): () => void {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

const almacen: Almacen = {
  elementos: () => todos<ElementoCola>('cola'),
  guardar: async (e) => {
    await guardar('cola', e);
    avisar();
  },
  quitar: async (id) => {
    await quitar('cola', id);
    avisar();
  },
  rechazar: async (r) => {
    await guardar('rechazados', r);
    avisar();
  },
};

export const pendientes = () => todos<ElementoCola>('cola');
export const rechazados = () => todos<Rechazo>('rechazados');
export async function descartarRechazo(id: string) {
  await quitar('rechazados', id);
  avisar();
}

let orden = 0;
/** El orden de llegada: la hora, y un contador para dos en el mismo milisegundo. */
export const siguienteN = () => Date.now() * 1000 + (orden++ % 1000);

export async function encolar(...elementos: ElementoCola[]) {
  for (const e of elementos) await guardar('cola', e);
  avisar();
}

/** Cómo terminó la última pasada; `sin_sesion` hace que la pantalla pida el PIN. */
export let ultimoFin: FinDeCola | null = null;
let enCurso: Promise<FinDeCola> | null = null;

function enviar(e: ElementoCola) {
  if (e.tipo === 'cierre') return enviarCierre(e.entrada);
  if (e.tipo === 'gasto') return enviarGasto(e.entrada);
  const f = new FormData();
  f.set('foto', e.foto, `foto-${e.indice}.jpg`);
  f.set('tomadaEn', e.tomadaEn);
  return enviarFoto(e.clave, e.indice, f, e.de ?? 'cierre');
}

/** Envía lo pendiente, en orden. Si ya se está enviando, espera esa misma pasada. */
export function enviarPendientes(): Promise<FinDeCola> {
  enCurso ??= procesarCola(almacen, enviar)
    .then((fin) => (ultimoFin = fin))
    .finally(() => {
      enCurso = null;
      avisar();
    });
  return enCurso;
}
