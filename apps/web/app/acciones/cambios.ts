'use server';
// Las órdenes de cambio de una obra (D-067): el dueño las emite (también desde un aviso del PM), las corrige mientras
// el cliente no responde (D-103) y registra la respuesta que el cliente le dio en papel. La del portal la manda el
// cliente con su enlace (acciones/portal.ts).
import {
  crearOrdenCambio,
  editarOrdenCambio,
  responderCambioDueno,
  type ResultadoOrdenDeCambio,
} from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirDueno, type Resultado } from '@/lib/acceso';

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim() || null;
/** "1,250" o "$1250.50" → 1250.5; vacío → null. */
const numero = (f: FormData, campo: string) => {
  const limpio = String(f.get(campo) ?? '').replace(/[$,\s]/g, '');
  return limpio === '' ? null : Number(limpio);
};
/** Lo que el formulario manda de la orden, igual al emitir que al corregir. */
const deLaOrden = (f: FormData) => ({
  motivo: texto(f, 'motivo') as never,
  descripcion: texto(f, 'descripcion'),
  hallazgo: texto(f, 'hallazgo'),
  costo: numero(f, 'costo'),
  precio: numero(f, 'precio'),
  dias: numero(f, 'dias') ?? 0,
  condicion: (texto(f, 'condicion') ?? 'al_autorizar') as never,
  forzar: f.get('forzar') === '1',
});

export async function emitirCambio(
  obraId: string,
  _previo: Resultado<ResultadoOrdenDeCambio> | null,
  f: FormData,
): Promise<Resultado<ResultadoOrdenDeCambio>> {
  const r = await comoMiembro(
    (tx) =>
      crearOrdenCambio(tx, {
        obraId,
        ...deLaOrden(f),
        avisoId: texto(f, 'avisoId'),
        respuestaAviso: texto(f, 'respuestaAviso'),
      }),
    await exigirDueno(),
  );
  if (r.ok && r.datos.ok) {
    revalidatePath(`/obras/${obraId}/cambios`);
    if (f.get('avisoId')) revalidatePath('/avisos');
  }
  return r;
}

export async function editarCambio(
  obraId: string,
  ordenId: string,
  _previo: Resultado<ResultadoOrdenDeCambio> | null,
  f: FormData,
): Promise<Resultado<ResultadoOrdenDeCambio>> {
  const r = await comoMiembro(
    (tx) => editarOrdenCambio(tx, { ordenId, ...deLaOrden(f) }),
    await exigirDueno(),
  );
  if (r.ok && r.datos.ok) revalidatePath(`/obras/${obraId}/cambios`);
  return r;
}

export async function registrarRespuesta(
  obraId: string,
  ordenId: string,
  _previo: Resultado<void> | null,
  f: FormData,
): Promise<Resultado<void>> {
  const r = await comoMiembro(
    (tx) =>
      responderCambioDueno(tx, {
        ordenId,
        decision: f.get('decision') === 'aprobada' ? 'aprobada' : 'rechazada',
        nombre: texto(f, 'nombre'),
        comentario: texto(f, 'comentario'),
      }),
    await exigirDueno(),
  );
  if (r.ok) {
    revalidatePath(`/obras/${obraId}/cambios`);
    revalidatePath(`/obras/${obraId}/seguimiento`);
  }
  return r;
}
