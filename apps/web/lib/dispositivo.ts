// El nombre con que el dueño reconoce un celular en su equipo, a partir del navegador que canjeó la invitación.

export function nombreDelDispositivo(agente: string | null): string {
  const a = agente ?? '';
  if (/iPhone/.test(a)) return 'iPhone';
  if (/iPad/.test(a)) return 'iPad';
  if (/Android/.test(a)) return /Mobile/.test(a) ? 'Android' : 'Tablet Android';
  if (/Windows/.test(a)) return 'Windows';
  if (/Macintosh|Mac OS X/.test(a)) return 'Mac';
  return 'Celular';
}

/** El id de la sesión de Auth que trae un token de acceso (sin verificarlo: lo acaba de emitir Auth). */
export function sesionDelToken(token: string): string | null {
  try {
    const carga = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as {
      session_id?: unknown;
    };
    return typeof carga.session_id === 'string' ? carga.session_id : null;
  } catch {
    return null;
  }
}
