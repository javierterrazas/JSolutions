'use server';
// Los subcontratistas de la empresa (D-073): el dueño los da de alta, los edita con sus papeles, y los da de baja o
// los reactiva.
import type { AvisoPapeles } from '@ijm/core';
import { cambiarActivoSub, guardarSubcontratista } from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirDuenoCon, type Resultado } from '@/lib/acceso';

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim() || null;

export async function guardarSub(
  subId: string | null,
  _previo: Resultado<{ avisos: AvisoPapeles[] }> | null,
  f: FormData,
): Promise<Resultado<{ avisos: AvisoPapeles[] }>> {
  const r = await comoMiembro(
    (tx) =>
      guardarSubcontratista(tx, {
        subId,
        nombre: texto(f, 'nombre'),
        oficioId: texto(f, 'oficio'),
        telefono: texto(f, 'telefono'),
        contacto: texto(f, 'contacto'),
        correo: texto(f, 'correo'),
        seguroVence: texto(f, 'seguro'),
        licencia: texto(f, 'licencia'),
        licenciaVence: texto(f, 'licenciaVence'),
        w9: f.get('w9') === 'on',
      }),
    await exigirDuenoCon('subcontratistas'),
  );
  if (!r.ok) return r;
  revalidatePath('/subcontratistas');
  return { ok: true, datos: { avisos: r.datos.avisos } };
}

export async function alternarSub(
  subId: string,
  activo: boolean,
  _previo: Resultado<{ abiertas: number }> | null,
): Promise<Resultado<{ abiertas: number }>> {
  const r = await comoMiembro(
    (tx) => cambiarActivoSub(tx, { subId, activo }),
    await exigirDuenoCon('subcontratistas'),
  );
  if (r.ok) revalidatePath('/subcontratistas');
  return r;
}
