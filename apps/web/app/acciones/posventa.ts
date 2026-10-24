'use server';
// Los retrabajos, las garantías y lo de después de la entrega (D-090). Llevan dinero: solo el dueño.
import {
  cerrarGarantia,
  marcarPosventa,
  type PasoPosventa,
  registrarNoCalidad,
  type ValorPaso,
} from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirDuenoCon, type Resultado } from '@/lib/acceso';

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim() || null;
/** "1,250" o "$1250.50" → 1250.5; vacío → 0; basura → NaN (lo rechaza el servidor). */
const numero = (f: FormData, campo: string) => {
  const limpio = String(f.get(campo) ?? '').replace(/[$,\s]/g, '');
  return limpio === '' ? 0 : Number(limpio);
};

function refrescar(obraId: string) {
  revalidatePath(`/obras/${obraId}/retrabajos`);
  revalidatePath(`/obras/${obraId}/seguimiento`);
  revalidatePath(`/obras/${obraId}/cerrar`);
  revalidatePath('/posventa');
  revalidatePath('/');
}

export async function registrarRetrabajo(
  obraId: string,
  _previo: Resultado<{ folio: string }> | null,
  f: FormData,
): Promise<Resultado<{ folio: string }>> {
  const r = await comoMiembro(
    (tx) =>
      registrarNoCalidad(tx, {
        obraId,
        tipo: texto(f, 'tipo') as never,
        causa: texto(f, 'causa') as never,
        subId: texto(f, 'sub'),
        costo: numero(f, 'costo'),
        diasPerdidos: numero(f, 'dias'),
        descripcion: String(f.get('descripcion') ?? ''),
      }),
    await exigirDuenoCon('posventa'),
  );
  if (!r.ok) return r;
  refrescar(obraId);
  return { ok: true, datos: { folio: r.datos.folio } };
}

export async function cerrarLaGarantia(
  ids: { obraId: string; noCalidadId: string },
  _previo: Resultado<void> | null,
  f: FormData,
): Promise<Resultado<void>> {
  const r = await comoMiembro(
    (tx) => cerrarGarantia(tx, { noCalidadId: ids.noCalidadId, costo: numero(f, 'costo') }),
    await exigirDuenoCon('posventa'),
  );
  if (!r.ok) return r;
  refrescar(ids.obraId);
  return { ok: true, datos: undefined };
}

export async function marcarPasoPosventa(
  obraId: string,
  paso: PasoPosventa,
  valor: ValorPaso,
): Promise<Resultado<void>> {
  const r = await comoMiembro(
    (tx) => marcarPosventa(tx, { obraId, paso, valor }),
    await exigirDuenoCon('posventa'),
  );
  if (!r.ok) return r;
  refrescar(obraId);
  return { ok: true, datos: undefined };
}
