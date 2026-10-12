'use server';
// La cuadrilla del dueño (D-061): dar de alta, editar, cambiar el salario y dar de baja o reactivar.
import { altaTrabajador, cambiarActivoTrabajador, cambiarTarifa, editarTrabajador } from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirDueno, type Resultado } from '@/lib/acceso';

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim() || null;
/** "$1,250.50" o "1250.5" → 1250.5; vacío → null. */
const monto = (f: FormData, campo: string) => {
  const limpio = String(f.get(campo) ?? '').replace(/[$,\s]/g, '');
  return limpio === '' ? null : Number(limpio);
};
const tipoPago = (f: FormData): 'hora' | 'dia' | null => {
  const v = texto(f, 'tipoPago');
  return v === 'hora' || v === 'dia' ? v : null;
};

function hecho<T>(r: Resultado<T>): Resultado {
  if (!r.ok) return r;
  revalidatePath('/cuadrilla');
  return { ok: true, datos: undefined };
}

export async function darDeAlta(_previo: Resultado | null, f: FormData): Promise<Resultado> {
  const entrada = {
    nombre: texto(f, 'nombre'),
    puesto: texto(f, 'puesto'),
    tipoPago: tipoPago(f),
    tarifa: monto(f, 'tarifa'),
    telefono: texto(f, 'telefono'),
  };
  return hecho(await comoMiembro((tx) => altaTrabajador(tx, entrada), await exigirDueno()));
}

export async function guardarTrabajador(
  trabajadorId: string,
  _previo: Resultado | null,
  f: FormData,
): Promise<Resultado> {
  const entrada = {
    trabajadorId,
    nombre: texto(f, 'nombre'),
    puesto: texto(f, 'puesto'),
    telefono: texto(f, 'telefono'),
    tipoPago: tipoPago(f),
  };
  return hecho(await comoMiembro((tx) => editarTrabajador(tx, entrada), await exigirDueno()));
}

export async function nuevoSalario(
  trabajadorId: string,
  _previo: Resultado | null,
  f: FormData,
): Promise<Resultado> {
  const entrada = { trabajadorId, tarifa: monto(f, 'tarifa'), vigenteDesde: texto(f, 'desde') };
  return hecho(await comoMiembro((tx) => cambiarTarifa(tx, entrada), await exigirDueno()));
}

export async function cambiarActivo(
  trabajadorId: string,
  activo: boolean,
  _previo: Resultado | null,
): Promise<Resultado> {
  return hecho(
    await comoMiembro((tx) => cambiarActivoTrabajador(tx, { trabajadorId, activo }), await exigirDueno()),
  );
}
