'use server';
// Los cobros al cliente de una obra (D-071): el dueño registra cada pago, y lo corrige o anula con su motivo.
import { anular, corregir, registrarCobro } from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirDuenoCon, type Resultado } from '@/lib/acceso';

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim() || null;
/** "1,250" o "$1250.50" → 1250.5; vacío → null; basura → NaN (lo rechaza el servidor). */
const numero = (f: FormData, campo: string) => {
  const limpio = String(f.get(campo) ?? '').replace(/[$,\s]/g, '');
  return limpio === '' ? null : Number(limpio);
};

function refrescar(obraId: string) {
  revalidatePath(`/obras/${obraId}/cobros`);
  revalidatePath(`/obras/${obraId}/seguimiento`);
}

export async function registrarPago(
  obraId: string,
  _previo: Resultado<{ folio: string }> | null,
  f: FormData,
): Promise<Resultado<{ folio: string }>> {
  const r = await comoMiembro(
    (tx) =>
      registrarCobro(tx, {
        obraId,
        fecha: texto(f, 'fecha'),
        concepto: texto(f, 'concepto') as never,
        monto: numero(f, 'monto'),
        metodo: texto(f, 'metodo') as never,
        referencia: texto(f, 'referencia'),
        ordenCambioId: texto(f, 'ordenCambio'),
      }),
    await exigirDuenoCon('dinero'),
  );
  if (!r.ok) return r;
  refrescar(obraId);
  revalidatePath(`/obras/${obraId}/cambios`);
  return { ok: true, datos: { folio: r.datos.folio } };
}

export async function corregirPago(
  ids: { obraId: string; cobroId: string },
  _previo: Resultado<void> | null,
  f: FormData,
): Promise<Resultado<void>> {
  const monto = numero(f, 'monto');
  if (!(Number(monto) > 0)) return { ok: false, codigo: 'monto_invalido' };
  const r = await comoMiembro(
    (tx) =>
      corregir(tx, {
        tabla: 'cobros',
        registroId: ids.cobroId,
        cambios: { monto, concepto: texto(f, 'concepto'), referencia: texto(f, 'referencia') },
        motivo: String(f.get('motivo') ?? ''),
      }),
    await exigirDuenoCon('dinero'),
  );
  if (!r.ok) return r;
  refrescar(ids.obraId);
  return { ok: true, datos: undefined };
}

export async function anularPago(
  ids: { obraId: string; cobroId: string },
  _previo: Resultado<void> | null,
  f: FormData,
): Promise<Resultado<void>> {
  const r = await comoMiembro(
    (tx) => anular(tx, { tabla: 'cobros', registroId: ids.cobroId, motivo: String(f.get('motivo') ?? '') }),
    await exigirDuenoCon('dinero'),
  );
  if (!r.ok) return r;
  refrescar(ids.obraId);
  return { ok: true, datos: undefined };
}
