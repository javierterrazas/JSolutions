// La cola del teléfono: guarda en IndexedDB (almacen.ts), envía con las acciones de la cola (acciones/cola.ts) y
// sigue las reglas de cola.ts. Las pantallas se enteran de cada cambio con `alCambiar`.
//
// La cola es del miembro que entró en este teléfono (D-054): cada registro lleva quién lo capturó, y solo se envía y se
// muestra lo suyo. Si el teléfono pasa a otro miembro, lo del anterior se queda apartado (no se borra) hasta que él
// vuelva a entrar aquí.
import { enviarAviso, enviarCierre, enviarFoto, enviarGasto } from '@/app/acciones/cola';
import { guardar, leer, quitar, todos } from './almacen';
import {
  type Almacen,
  conLimite,
  type ElementoCola,
  ESPERA_FOTO_MS,
  type FinDeCola,
  procesarCola,
  type Rechazo,
} from './cola';

const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

/** Para que una pantalla se entere cuando la cola cambia. Devuelve cómo dejar de escuchar. */
export function alCambiar(fn: () => void): () => void {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

const MIEMBRO = 'miembroDeLaCola';

async function miembroDeLaCola(): Promise<string | null> {
  return (await leer<{ clave: string; valor: string }>('datos', MIEMBRO))?.valor ?? null;
}

/** Quién entró en este teléfono: lo hacen las pantallas del PIN (con señal y sin señal). */
export async function fijarMiembroDeLaCola(miembroId: string): Promise<void> {
  await guardar('datos', { clave: MIEMBRO, valor: miembroId });
  avisar();
}

/** Lo del miembro que entró (lo que no dice de quién es, de una versión anterior, también). */
async function delMiembro<T extends { miembroId?: string }>(lista: Promise<T[]>): Promise<T[]> {
  const [m, xs] = await Promise.all([miembroDeLaCola(), lista]);
  return xs.filter((x) => !m || !x.miembroId || x.miembroId === m);
}

const almacen: Almacen = {
  elementos: () => delMiembro(todos<ElementoCola>('cola')),
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

export const pendientes = () => delMiembro(todos<ElementoCola>('cola'));
export const rechazados = () => delMiembro(todos<Rechazo>('rechazados'));
export async function descartarRechazo(id: string) {
  await quitar('rechazados', id);
  avisar();
}

let orden = 0;
/** El orden de llegada: la hora, y un contador para dos en el mismo milisegundo. */
export const siguienteN = () => Date.now() * 1000 + (orden++ % 1000);

/** A la cola, a nombre del miembro que entró en este teléfono. */
export async function encolar(...elementos: ElementoCola[]) {
  const m = await miembroDeLaCola();
  for (const e of elementos) await guardar('cola', m ? { ...e, miembroId: m } : e);
  avisar();
}

/** Cómo terminó la última pasada; `sin_sesion` hace que la pantalla pida el PIN. */
export let ultimoFin: FinDeCola | null = null;
let enCurso: Promise<FinDeCola> | null = null;

/** Un envío de la cola, con su límite de espera: si no contesta, la cola se detiene como sin señal. */
function enviar(e: ElementoCola) {
  if (e.tipo === 'cierre') return conLimite(enviarCierre(e.entrada));
  if (e.tipo === 'gasto') return conLimite(enviarGasto(e.entrada));
  if (e.tipo === 'aviso') return conLimite(enviarAviso(e.entrada));
  const f = new FormData();
  f.set('foto', e.foto, `foto-${e.indice}.jpg`);
  f.set('tomadaEn', e.tomadaEn);
  return conLimite(enviarFoto(e.clave, e.indice, f, e.de ?? 'cierre'), ESPERA_FOTO_MS);
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
