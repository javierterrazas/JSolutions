// Las reglas de la app sin señal (fase 2, paso 5c; D-047), sin IndexedDB ni pantalla: qué día es hoy en la zona de
// la empresa, qué se ofrece para cerrar con la copia del teléfono, y el PIN local.
//
// El PIN local es solo un candado del teléfono (D-038): el teléfono guarda una huella del PIN (PBKDF2), nunca el
// PIN, y la revisa con las mismas reglas que la base: 5 intentos fallidos bloquean 15 minutos y abre por las horas
// de la jornada. Con 4 dígitos no resiste a quien tenga el celular y sepa de computadoras; pero sin el servidor no
// se escribe nada en la base, y la copia no lleva dinero.
import { type Dia, HORAS_DESBLOQUEO, hoyEn, MAX_INTENTOS_PIN, MINUTOS_BLOQUEO_PIN } from '@ijm/core';
import type { CopiaSinSenal } from '@ijm/servidor';
import type { ElementoCola } from './cola';

// ------------------------------------------------------------------ el día y lo que se cierra

export type ObraDeLaCopia = CopiaSinSenal['obras'][number];

/** Cómo está hoy una obra de la copia: por cerrar, ya cerrada en el servidor, o cerrada en el teléfono. */
export type EstadoDeHoy = 'por_cerrar' | 'cerrado' | 'en_el_telefono';

export function estadoDeHoy(obra: ObraDeLaCopia, hoy: Dia, cola: readonly ElementoCola[]): EstadoDeHoy {
  if (obra.cerrados.includes(hoy)) return 'cerrado';
  const enCola = cola.some(
    (e) => e.tipo === 'cierre' && e.entrada.obraId === obra.datos.obra.id && e.etiqueta.dia === hoy,
  );
  return enCola ? 'en_el_telefono' : 'por_cerrar';
}

/**
 * Lo que la copia ofrece para cerrar hoy: el día de hoy (sin señal no se cierran días olvidados), y solo los subs
 * cuya orden ya empezó.
 */
export function datosDeHoy(obra: ObraDeLaCopia, hoy: Dia) {
  return {
    ...obra.datos,
    dia: hoy,
    tardio: false,
    subs: obra.datos.subs.filter((s) => s.inicio !== null && s.inicio <= hoy),
  };
}

export const hoyDeLaCopia = (copia: Pick<CopiaSinSenal, 'zona'>, ahora: Date): Dia =>
  hoyEn(ahora, copia.zona);

// ------------------------------------------------------------------ el PIN local

export interface PinLocal {
  readonly miembroId: string;
  readonly largo: number;
  /** La sal y la huella, en base64. */
  readonly sal: string;
  readonly huella: string;
  readonly intentos: number;
  readonly bloqueadoHasta: string | null;
  readonly abiertoHasta: string | null;
}

export const ITERACIONES_PIN = 100_000;

const base64 = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))));
const deBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** La huella del PIN con su sal (PBKDF2-SHA256), en base64. */
export async function huellaDePin(pin: string, sal: string): Promise<string> {
  const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: deBase64(sal), iterations: ITERACIONES_PIN },
    llave,
    256,
  );
  return base64(bits);
}

/** Una sal nueva y la huella del PIN: lo que guarda el teléfono cuando el PIN se escribe con señal. */
export async function nuevaHuella(pin: string): Promise<{ sal: string; huella: string }> {
  const sal = base64(crypto.getRandomValues(new Uint8Array(16)));
  return { sal, huella: await huellaDePin(pin, sal) };
}

/** El PIN local recién confirmado por el servidor: sin intentos fallidos y abierto por la jornada del PM. */
export function pinConfirmado(
  miembroId: string,
  largo: number,
  h: { sal: string; huella: string },
  ahora: Date,
): PinLocal {
  return {
    miembroId,
    largo,
    ...h,
    intentos: 0,
    bloqueadoHasta: null,
    abiertoHasta: new Date(ahora.getTime() + HORAS_DESBLOQUEO.pm * 3600_000).toISOString(),
  };
}

export const estaAbierto = (p: PinLocal, ahora: Date) => !!p.abiertoHasta && new Date(p.abiertoHasta) > ahora;

export type ResultadoPinLocal =
  | { readonly ok: true }
  | { readonly ok: false; readonly codigo: 'pin_incorrecto'; readonly datos: { readonly quedan: number } }
  | { readonly ok: false; readonly codigo: 'pin_bloqueado'; readonly datos: { readonly hasta: string } };

/**
 * Lo que pasa al escribir el PIN sin señal, ya comparada su huella (`coincide`): abre por la jornada, cuenta un
 * intento fallido, o bloquea. Mientras está bloqueado, ni el PIN correcto abre.
 */
export function revisarPinLocal(
  p: PinLocal,
  coincide: boolean,
  ahora: Date,
): { pin: PinLocal; resultado: ResultadoPinLocal } {
  if (p.bloqueadoHasta && new Date(p.bloqueadoHasta) > ahora)
    return { pin: p, resultado: { ok: false, codigo: 'pin_bloqueado', datos: { hasta: p.bloqueadoHasta } } };
  if (coincide)
    return {
      pin: {
        ...p,
        intentos: 0,
        bloqueadoHasta: null,
        abiertoHasta: new Date(ahora.getTime() + HORAS_DESBLOQUEO.pm * 3600_000).toISOString(),
      },
      resultado: { ok: true },
    };
  const intentos = p.intentos + 1;
  if (intentos >= MAX_INTENTOS_PIN) {
    const hasta = new Date(ahora.getTime() + MINUTOS_BLOQUEO_PIN * 60_000).toISOString();
    return {
      pin: { ...p, intentos: 0, bloqueadoHasta: hasta, abiertoHasta: null },
      resultado: { ok: false, codigo: 'pin_bloqueado', datos: { hasta } },
    };
  }
  return {
    pin: { ...p, intentos, bloqueadoHasta: null },
    resultado: { ok: false, codigo: 'pin_incorrecto', datos: { quedan: MAX_INTENTOS_PIN - intentos } },
  };
}
