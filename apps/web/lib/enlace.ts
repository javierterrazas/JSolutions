// El enlace de una invitación, en la dirección por la que entró quien la creó (el dueño en Equipo, o quien administra
// la plataforma, D-080).
import 'server-only';
import { headers } from 'next/headers';

export async function enlaceDeInvitacion(token: string): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const protocolo =
    h.get('x-forwarded-proto') ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https');
  return `${protocolo}://${host}/invitacion/${token}`;
}
