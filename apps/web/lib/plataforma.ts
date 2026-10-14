// Las pantallas de la plataforma (D-080): entra quien la administra, con su celular y su PIN como cualquier miembro.
import 'server-only';
import { esAdminPlataforma } from '@ijm/servidor';
import { redirect } from 'next/navigation';
import { type Acceso, comoMiembro, exigirAcceso } from './acceso';

/** Exige que quien entra administre la plataforma; si no, a su inicio. */
export async function exigirPlataforma(): Promise<Acceso> {
  const a = await exigirAcceso();
  const r = await comoMiembro((tx) => esAdminPlataforma(tx), a);
  if (!r.ok || !r.datos) redirect('/');
  return a;
}
