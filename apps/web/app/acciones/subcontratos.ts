'use server';
// Los subcontratos de una obra (D-074): el dueño emite órdenes de trabajo (varias de una vez, D-091), las cancela, y
// les paga a los subs contra su orden, confirmando los avisos uno por uno; la recibida se liquida con un toque.
import {
  anular,
  cancelarOrdenTrabajo,
  emitirOrdenesTrabajo,
  registrarPagoSub,
  reprogramarOrdenTrabajo,
  type ResultadoOrdenesTrabajo,
  type ResultadoPagoSub,
} from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirDuenoCon, type Resultado } from '@/lib/acceso';

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim() || null;
/** "1,250" o "$1250.50" → 1250.5; vacío → null. */
const numero = (f: FormData, campo: string) => {
  const limpio = String(f.get(campo) ?? '').replace(/[$,\s]/g, '');
  return limpio === '' ? null : Number(limpio);
};
/** Los avisos que ya confirmó, separados por comas. */
const confirmado = (f: FormData) =>
  String(f.get('confirmado') ?? '')
    .split(',')
    .filter(Boolean);

function refrescar(obraId: string) {
  revalidatePath(`/obras/${obraId}/subcontratos`);
  revalidatePath(`/obras/${obraId}/seguimiento`);
}

/** Las partidas elegidas, cada una con sus campos `inicio-<id>`, `fin-<id>` y `precio-<id>`. */
export async function emitirOrden(
  obraId: string,
  _previo: Resultado<ResultadoOrdenesTrabajo> | null,
  f: FormData,
): Promise<Resultado<ResultadoOrdenesTrabajo>> {
  const partidas = f.getAll('partida').map((x) => {
    const id = String(x);
    return {
      partidaId: id,
      inicio: texto(f, `inicio-${id}`),
      fin: texto(f, `fin-${id}`),
      precio: numero(f, `precio-${id}`),
    };
  });
  const r = await comoMiembro(
    (tx) =>
      emitirOrdenesTrabajo(tx, {
        obraId,
        subId: texto(f, 'sub'),
        alcance: texto(f, 'alcance'),
        partidas,
        confirmado: confirmado(f),
      }),
    await exigirDuenoCon('subcontratistas'),
  );
  if (r.ok && r.datos.ok) refrescar(obraId);
  return r;
}

export async function cancelarOrden(
  obraId: string,
  ordenId: string,
  _previo: Resultado<void> | null,
): Promise<Resultado<void>> {
  const r = await comoMiembro(
    (tx) => cancelarOrdenTrabajo(tx, { ordenId }),
    await exigirDuenoCon('subcontratistas'),
  );
  if (r.ok) refrescar(obraId);
  return r;
}

export async function pagarSub(
  obraId: string,
  ordenId: string,
  _previo: Resultado<ResultadoPagoSub> | null,
  f: FormData,
): Promise<Resultado<ResultadoPagoSub>> {
  const r = await comoMiembro(
    (tx) =>
      registrarPagoSub(tx, {
        ordenId,
        fecha: texto(f, 'fecha'),
        concepto: texto(f, 'concepto') as never,
        monto: numero(f, 'monto'),
        metodo: (texto(f, 'metodo') ?? 'transferencia') as never,
        referencia: texto(f, 'referencia'),
        confirmado: confirmado(f),
      }),
    await exigirDuenoCon('subcontratistas'),
  );
  if (r.ok && r.datos.ok) refrescar(obraId);
  return r;
}

/** Reprograma una orden (el sub no llegó o cambió la fecha), con su motivo. */
export async function reprogramarOrden(
  obraId: string,
  ordenId: string,
  _previo: Resultado<{ faltas: number; falto: boolean }> | null,
  f: FormData,
): Promise<Resultado<{ faltas: number; falto: boolean }>> {
  const r = await comoMiembro(
    (tx) =>
      reprogramarOrdenTrabajo(tx, {
        ordenId,
        inicio: texto(f, 'inicio'),
        fin: texto(f, 'fin'),
        motivo: texto(f, 'motivo'),
      }),
    await exigirDuenoCon('subcontratistas'),
  );
  if (r.ok) refrescar(obraId);
  return r;
}

export async function anularPagoSub(
  obraId: string,
  pagoId: string,
  _previo: Resultado<void> | null,
  f: FormData,
): Promise<Resultado<void>> {
  const r = await comoMiembro(
    (tx) => anular(tx, { tabla: 'pagos_sub', registroId: pagoId, motivo: String(f.get('motivo') ?? '') }),
    await exigirDuenoCon('subcontratistas'),
  );
  if (!r.ok) return r;
  refrescar(obraId);
  return { ok: true, datos: undefined };
}
