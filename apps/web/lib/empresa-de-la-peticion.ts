// El nombre de la empresa de quien abre la pantalla, para el encabezado del marco. Lo apunta la revisión de acceso
// (lib/acceso), que ya lo leyó de la base en la misma petición: el marco no hace otra consulta. Vive aparte de
// lib/acceso porque el marco también lo importan componentes del teléfono, que no pueden importar código del
// servidor; `cache` de React lo hace de esta petición nada más.
import { cache } from 'react';

const caja = cache((): { nombre: string | null } => ({ nombre: null }));

export function recordarEmpresa(nombre: string | null): void {
  caja().nombre = nombre;
}

/** Null si la petición no tiene sesión de una empresa (la invitación, sin acceso). */
export function empresaDeLaPeticion(): string | null {
  return caja().nombre;
}
