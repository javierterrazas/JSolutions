// Entrar a la app: el PIN de cada rol, cuánto abre la sesión y el límite de intentos (D-024, D-038).
// Las mismas constantes viven en la base (supabase/migrations/20261007000100_acceso.sql), que es la muralla.
import { ErrorDeNegocio } from './errores';

export type Rol = 'dueno' | 'admin' | 'pm';

/** El PM, 4 dígitos (como el legacy); el dueño y el administrador, 6, porque ven el dinero. */
export const LARGO_PIN: Readonly<Record<Rol, number>> = { pm: 4, dueno: 6, admin: 6 };

/** Por cuántas horas abre la sesión el PIN: la jornada del PM, como el legacy (HORAS_SESION). */
export const HORAS_DESBLOQUEO: Readonly<Record<Rol, number>> = { pm: 16, dueno: 12, admin: 12 };

/**
 * 5 intentos fallidos seguidos bloquean 15 minutos (legacy: MAX_INTENTOS, BLOQUEO_SEG). Cada bloqueo seguido, sin un
 * PIN bueno entre ellos, dura más: 15 minutos, 1 hora y después 24 horas (D-055). Lo aplica la base.
 */
export const MAX_INTENTOS_PIN = 5;
export const MINUTOS_BLOQUEO_PIN = [15, 60, 24 * 60] as const;

/** Cuántos días vale una invitación sin usarse. */
export const DIAS_INVITACION = 7;

/** Los PIN que más se usan sin ser repetidos ni escaleras: líneas y cruces del teclado, y algunos conocidos. */
const PIN_COMUNES = new Set([
  '2580', '0852', '1470', '0741', '3690', '0963', '1379', '9731', '1397', '7931',
  '147258', '258369', '159753', '357951', '147852', '741852', '963852', '789456', '102030', '010203',
]); // prettier-ignore

/**
 * Revisa el PIN que elige un miembro. Lanza `pin_invalido` si no son solo dígitos del largo de su rol, y
 * `pin_debil` si es fácil de adivinar (D-055; el legacy solo rechazaba los dos primeros):
 * - un dígito repetido (0000) o una escalera de 1 en 1 o de 2 en 2 (1234, 9876, 2468, 1357);
 * - solo dos dígitos distintos (1212, 1122, 6969, 2000);
 * - de 4 dígitos, un año (1940 a 2039);
 * - de 6, una mitad repetida (123123) o tres pares (112233);
 * - uno de los más usados del teclado (2580, 147258…).
 */
export function validarPin(pin: string, rol: Rol): void {
  const largo = LARGO_PIN[rol];
  if (!new RegExp(`^[0-9]{${largo}}$`).test(pin)) throw new ErrorDeNegocio('pin_invalido', { largo });
  const d = [...pin].map(Number);
  const pasos = new Set(d.slice(1).map((x, i) => x - d[i]!));
  const escalera = pasos.size === 1 && Math.abs([...pasos][0]!) <= 2;
  const dosDigitos = new Set(d).size <= 2;
  const anio = largo === 4 && Number(pin) >= 1940 && Number(pin) <= 2039;
  const repetido =
    largo === 6 && (pin.slice(0, 3) === pin.slice(3) || (d[0] === d[1] && d[2] === d[3] && d[4] === d[5]));
  if (escalera || dosDigitos || anio || repetido || PIN_COMUNES.has(pin))
    throw new ErrorDeNegocio('pin_debil');
}

// ------------------------------------------------------------------ el celular de un miembro (D-083)
/**
 * Los miembros se dan de alta con su celular, no con su correo. Su cuenta de Auth lleva una dirección interna que sale
 * del número: nadie la ve ni recibe nada en ella (el dominio .invalid no existe), solo sirve para abrir la sesión del
 * celular verificado, como antes con el correo.
 */
export const DOMINIO_CELULAR = 'celular.invalid';

/**
 * Un celular en formato internacional (+15125550101), o null si no lo parece. Diez dígitos son de EE. UU. (+1); de
 * otro país se escribe con su +.
 */
export function normalizarCelular(texto: string): string | null {
  const limpio = texto.trim();
  const digitos = limpio.replace(/\D/g, '');
  if (limpio.startsWith('+')) return digitos.length >= 8 && digitos.length <= 15 ? `+${digitos}` : null;
  if (digitos.length === 10) return `+1${digitos}`;
  if (digitos.length === 11 && digitos.startsWith('1')) return `+${digitos}`;
  return null;
}

/** La dirección interna de Auth de un celular ya normalizado. */
export const correoDeCelular = (celular: string): string =>
  `${celular.replace(/\D/g, '')}@${DOMINIO_CELULAR}`;

/** El celular de una dirección interna; null si es un correo de verdad (los miembros de antes). */
export function celularDeCorreo(correo: string | null | undefined): string | null {
  const sufijo = `@${DOMINIO_CELULAR}`;
  if (!correo?.endsWith(sufijo)) return null;
  const digitos = correo.slice(0, -sufijo.length);
  return /^\d+$/.test(digitos) ? `+${digitos}` : null;
}

/** Un celular para mostrarlo: (512) 555-0101 si es de EE. UU.; si no, tal cual. */
export function formatoCelular(celular: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(celular);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : celular;
}
