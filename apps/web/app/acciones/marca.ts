'use server';
// La marca de la empresa (D-078): el dueño sube su logo, elige su color y el fondo del ícono.
import { guardarMarca, LOGO_MAXIMO } from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirDueno, type Resultado } from '@/lib/acceso';

export async function guardarMarcaEmpresa(
  _previo: Resultado<{ version: number }> | null,
  f: FormData,
): Promise<Resultado<{ version: number }>> {
  const archivo = f.get('logo');
  let logo: Uint8Array<ArrayBuffer> | null | undefined;
  if (f.get('quitarLogo') === 'on') logo = null;
  else if (archivo instanceof File && archivo.size) {
    if (archivo.size > LOGO_MAXIMO) return { ok: false, codigo: 'logo_pesado' };
    logo = new Uint8Array(await archivo.arrayBuffer());
  }
  const r = await comoMiembro(
    (tx) =>
      guardarMarca(tx, {
        color: String(f.get('color') ?? ''),
        logo,
      }),
    await exigirDueno(),
  );
  // el logo y el nombre salen en todas las pantallas
  if (r.ok) revalidatePath('/', 'layout');
  return r;
}
