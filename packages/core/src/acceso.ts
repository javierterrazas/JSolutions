// Entrar a la app: el PIN de cada rol, cuánto abre la sesión y el límite de intentos (D-024, D-038).
// Las mismas constantes viven en la base (supabase/migrations/20261007000100_acceso.sql), que es la muralla.
import { ErrorDeNegocio } from './errores';

export type Rol = 'dueno' | 'admin' | 'pm';

/** El PM, 4 dígitos (como el legacy); el dueño y el administrador, 6, porque ven el dinero. */
export const LARGO_PIN: Readonly<Record<Rol, number>> = { pm: 4, dueno: 6, admin: 6 };

/** Por cuántas horas abre la sesión el PIN: la jornada del PM, como el legacy (HORAS_SESION). */
export const HORAS_DESBLOQUEO: Readonly<Record<Rol, number>> = { pm: 16, dueno: 12, admin: 12 };

/** 5 intentos fallidos seguidos bloquean 15 minutos (legacy: MAX_INTENTOS, BLOQUEO_SEG). */
export const MAX_INTENTOS_PIN = 5;
export const MINUTOS_BLOQUEO_PIN = 15;

/** Cuántos días vale una invitación sin usarse. */
export const DIAS_INVITACION = 7;

/**
 * Revisa el PIN que elige un miembro. Lanza `pin_invalido` si no son solo dígitos del largo de su rol, y
 * `pin_debil` si es fácil de adivinar: un solo dígito repetido (0000) o una escalera (1234, 9876).
 */
export function validarPin(pin: string, rol: Rol): void {
  const largo = LARGO_PIN[rol];
  if (!new RegExp(`^[0-9]{${largo}}$`).test(pin)) throw new ErrorDeNegocio('pin_invalido', { largo });
  const d = [...pin].map(Number);
  const pasos = new Set(d.slice(1).map((x, i) => x - d[i]!));
  if (pasos.size === 1 && [0, 1, -1].includes([...pasos][0]!)) throw new ErrorDeNegocio('pin_debil');
}
