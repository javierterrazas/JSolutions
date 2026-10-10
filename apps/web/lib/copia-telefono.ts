// La copia para trabajar sin señal y el PIN local, en el teléfono (IndexedDB, bodega `datos`; D-047). Las reglas
// están en sin-senal.ts.
//
// El PIN se guarda en dos tiempos: al escribirlo, el formulario guarda su huella como "por confirmar"; si el PIN era
// correcto, el inicio se abre y la confirma. Así el teléfono nunca guarda la huella de un PIN que el servidor no
// aceptó, y nunca guarda el PIN.
import type { CopiaSinSenal } from '@ijm/servidor';
import { guardar, leer, quitar } from './almacen';
import { nuevaHuella, type PinLocal, pinConfirmado } from './sin-senal';

interface Registro<T> {
  readonly clave: string;
  readonly valor: T;
}

async function leerValor<T>(clave: string): Promise<T | null> {
  return (await leer<Registro<T>>('datos', clave))?.valor ?? null;
}
const guardarValor = <T>(clave: string, valor: T) => guardar<Registro<T>>('datos', { clave, valor });

export const leerCopia = () => leerValor<CopiaSinSenal>('copia');
export const leerPin = () => leerValor<PinLocal>('pin');
export const guardarPin = (p: PinLocal) => guardarValor('pin', p);

/** Cuánto vale una huella por confirmar: lo que tarda en abrirse el inicio después de escribir el PIN. */
const MINUTOS_POR_CONFIRMAR = 10;

/** Al escribir el PIN con señal: su huella, por confirmar. */
export async function pinPorConfirmar(pin: string): Promise<void> {
  const h = await nuevaHuella(pin);
  await guardarValor('pinPorConfirmar', { ...h, largo: pin.length, cuando: new Date().toISOString() });
}

/**
 * En el inicio del PM, ya con el PIN abierto en el servidor: guarda la copia y, si hay una huella reciente por
 * confirmar, la vuelve el PIN local. Si la copia es de otro miembro, el PIN local anterior ya no sirve.
 */
export async function guardarCopia(copia: CopiaSinSenal, ahora = new Date()): Promise<void> {
  await guardarValor('copia', copia);
  const actual = await leerPin();
  if (actual && actual.miembroId !== copia.miembro.id) await quitar('datos', 'pin');
  const pendiente = await leerValor<{ sal: string; huella: string; largo: number; cuando: string }>(
    'pinPorConfirmar',
  );
  if (!pendiente) return;
  await quitar('datos', 'pinPorConfirmar');
  if (ahora.getTime() - new Date(pendiente.cuando).getTime() > MINUTOS_POR_CONFIRMAR * 60_000) return;
  await guardarPin(pinConfirmado(copia.miembro.id, pendiente.largo, pendiente, ahora));
}

/** Sin acceso (quitaron el celular o dieron de baja al miembro): se borran la copia y el PIN local. */
export async function borrarCopia(): Promise<void> {
  await Promise.all(['copia', 'pin', 'pinPorConfirmar'].map((c) => quitar('datos', c)));
}
