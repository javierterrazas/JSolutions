'use server';
// Los feriados de la empresa (D-108): darlos de alta, uno por uno o los de Estados Unidos de un año, y marcar si se
// trabajan.
import { agregarFeriado, agregarFeriadosDeEstadosUnidos, cambiarFeriado } from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirDueno, type Resultado } from '@/lib/acceso';

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim() || null;

function hecho<T>(r: Resultado<T>): Resultado<T> {
  if (r.ok) revalidatePath('/empresa/feriados');
  return r;
}

export async function nuevoFeriado(_previo: Resultado<void> | null, f: FormData): Promise<Resultado<void>> {
  const entrada = {
    dia: texto(f, 'dia') ?? '',
    nombre: texto(f, 'nombre') ?? '',
    nombreEn: texto(f, 'nombreEn'),
  };
  return hecho(await comoMiembro((tx) => agregarFeriado(tx, entrada), await exigirDueno()));
}

export async function feriadosDeEstadosUnidos(
  anio: number,
  _previo: Resultado<{ agregados: number }> | null,
): Promise<Resultado<{ agregados: number }>> {
  return hecho(await comoMiembro((tx) => agregarFeriadosDeEstadosUnidos(tx, { anio }), await exigirDueno()));
}

export async function marcarFeriado(feriadoId: string, seTrabaja: boolean): Promise<void> {
  await comoMiembro((tx) => cambiarFeriado(tx, { feriadoId, seTrabaja }), await exigirDueno());
  revalidatePath('/empresa/feriados');
}
