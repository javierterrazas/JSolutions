// Lo que necesitan las pantallas del PIN: cómo está el celular, cuántos dígitos lleva el PIN de su dueño, y quién es
// (para que la cola del teléfono sea suya y la huella del PIN se guarde solo para el PM, D-054).
import 'server-only';
import { esErrorDeNegocio, LARGO_PIN } from '@ijm/core';
import { estadoDispositivo, quienSoy, type EstadoDispositivo } from '@ijm/servidor';
import { redirect } from 'next/navigation';
import { conLlave } from '@/lib/acceso';

export async function estadoParaPin(): Promise<{
  estado: EstadoDispositivo;
  largo: number;
  miembroId: string;
  esPm: boolean;
}> {
  try {
    return await conLlave(async (tx, llave) => {
      const estado = await estadoDispositivo(tx, llave);
      const yo = await quienSoy(tx);
      return { estado, largo: LARGO_PIN[yo.rol], miembroId: yo.miembroId, esPm: yo.rol === 'pm' };
    });
  } catch (e) {
    if (esErrorDeNegocio(e)) redirect('/sin-acceso');
    throw e;
  }
}
