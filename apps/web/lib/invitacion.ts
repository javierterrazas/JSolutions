// El token de una invitación a partir de lo que el miembro pega: el enlace completo (como llega por WhatsApp, a veces
// con texto alrededor) o solo el token. En el iPhone, la app instalada no comparte las cookies de Safari ni tiene barra
// de direcciones: la invitación se pega dentro de ella, en la pantalla sin acceso (D-057).

/** El token, o null si lo pegado no trae una invitación. */
export function tokenDeInvitacion(texto: string): string | null {
  const enlace = texto.match(/\/invitacion\/([A-Za-z0-9_-]{20,})/);
  if (enlace) return enlace[1]!;
  const solo = texto.trim();
  return /^[A-Za-z0-9_-]{20,}$/.test(solo) ? solo : null;
}
