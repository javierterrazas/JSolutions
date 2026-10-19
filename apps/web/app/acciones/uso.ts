'use server';
// El uso de la app (D-101): un minuto más de quien tiene la sesión. Sin sesión abierta, nada.
import { registrarUso } from '@ijm/servidor';
import { comoMiembro, estadoDeAcceso } from '@/lib/acceso';

export async function registrarMiUso(): Promise<void> {
  const a = await estadoDeAcceso().catch(() => null);
  if (a?.estado !== 'abierto') return;
  await comoMiembro((tx) => registrarUso(tx), a.acceso);
}
