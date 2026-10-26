// Los enlaces que la app da para mandar o pegar en otro lado: una invitación, o la conexión del asistente (D-114). Van
// en la dirección por la que entró quien los creó (el dueño, o quien administra la plataforma, D-080).
import 'server-only';
import { headers } from 'next/headers';

/** La dirección completa de una ruta de la app (`/invitacion/…`). */
export async function enlaceDeLaApp(ruta: string): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const protocolo =
    h.get('x-forwarded-proto') ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https');
  return `${protocolo}://${host}${ruta}`;
}

export const enlaceDeInvitacion = (token: string): Promise<string> => enlaceDeLaApp(`/invitacion/${token}`);
