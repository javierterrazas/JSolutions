// La empresa de quien abre la pantalla, para el encabezado del marco: su nombre y su logo (D-065, D-078). Lo apunta la
// revisión de acceso (lib/acceso), que ya lo leyó de la base en la misma petición: el marco no hace otra consulta. Vive
// aparte de lib/acceso porque el marco también lo importan componentes del teléfono, que no pueden importar código
// del servidor; `cache` de React lo hace de esta petición nada más.
import { cache } from 'react';

export interface EmpresaDeLaPeticion {
  readonly nombre: string;
  /** Sin id, el encabezado no muestra logo. */
  readonly id?: string;
  readonly conLogo?: boolean;
  /** La versión de su marca, para pedir el logo nuevo cuando cambia. */
  readonly version?: number;
}

const caja = cache((): { empresa: EmpresaDeLaPeticion | null } => ({ empresa: null }));

export function recordarEmpresa(empresa: EmpresaDeLaPeticion | null): void {
  caja().empresa = empresa;
}

/** Null si la petición no tiene sesión de una empresa (la invitación, sin acceso). */
export function empresaDeLaPeticion(): EmpresaDeLaPeticion | null {
  return caja().empresa;
}
