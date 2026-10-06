// Lo que necesitan las pantallas del PIN: cómo está el celular y cuántos dígitos lleva el PIN de su dueño.
import 'server-only';
import { esErrorDeNegocio, LARGO_PIN } from '@ijm/core';
import { estadoDispositivo, quienSoy, type EstadoDispositivo } from '@ijm/servidor';
import { redirect } from 'next/navigation';
import { conLlave } from '@/lib/acceso';

export async function estadoParaPin(): Promise<{ estado: EstadoDispositivo; largo: number }> {
  try {
    return await conLlave(async (tx, llave) => ({
      estado: await estadoDispositivo(tx, llave),
      largo: LARGO_PIN[(await quienSoy(tx)).rol],
    }));
  } catch (e) {
    if (esErrorDeNegocio(e)) redirect('/sin-acceso');
    throw e;
  }
}
