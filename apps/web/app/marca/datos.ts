// La marca de una empresa para su manifiesto, sus íconos y su logo (D-078). El teléfono los pide sin las cookies de la
// app, así que van por el id de la empresa en la dirección; "general" es J Solutions, antes de entrar.
import 'server-only';
import { marcaPublica, sinUsuario } from '@ijm/servidor';
import { servidor } from '@/lib/servidor';
import { MARCA_GENERAL, type MarcaDelIcono } from '../iconos/dibujo';

export const GENERAL = 'general';

export async function marcaDe(empresa: string): Promise<(MarcaDelIcono & { version: number }) | null> {
  if (empresa === GENERAL) return { ...MARCA_GENERAL, version: 1 };
  if (!/^[0-9a-f-]{36}$/i.test(empresa)) return null;
  return sinUsuario(servidor(), (tx) => marcaPublica(tx, { empresaId: empresa })).catch(() => null);
}

/** Las direcciones de la marca de una empresa, con su versión para que el teléfono no use la vieja. */
export const rutasDeMarca = (empresa: string, version: number) => ({
  manifiesto: `/marca/${empresa}/manifest?v=${version}`,
  icono: (tam: string) => `/marca/${empresa}/icono/${tam}?v=${version}`,
  logo: `/marca/${empresa}/logo?v=${version}`,
});
