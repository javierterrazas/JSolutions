'use client';
// Elegir el PIN (dos veces) o escribirlo para entrar. Antes de enviarlo, el teléfono del PM guarda su huella por
// confirmar: si el servidor lo acepta, el inicio la vuelve el PIN para abrir la app sin señal (D-047). Solo el PM
// trabaja sin señal: en el teléfono de nadie más queda la huella, que con 4 o 6 dígitos revela el PIN (D-054). Y la
// cola del teléfono queda a nombre de quien entra: lo que otro dejó pendiente se aparta, no se envía como suyo.
import { useTranslations } from 'next-intl';
import { type FormEvent, startTransition, useActionState } from 'react';
import { fijarMiembroDeLaCola } from '@/lib/cola-telefono';
import { borrarCopia, pinPorConfirmar } from '@/lib/copia-telefono';
import { elegirPin, entrarConPin } from '../acciones/entrar';
import { estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';
import { CampoPin } from './campo-pin';

export function FormularioPin({
  modo,
  largo,
  miembroId,
  esPm,
}: {
  modo: 'elegir' | 'entrar';
  largo: number;
  miembroId: string;
  esPm: boolean;
}) {
  const t = useTranslations('pin');
  const [resultado, accion, enviando] = useActionState(modo === 'elegir' ? elegirPin : entrarConPin, null);
  // como enviarSinVaciar, pero espera a guardar la huella
  async function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = new FormData(e.currentTarget);
    // sin IndexedDB la app entra igual; solo no podrá abrirse sin señal
    await fijarMiembroDeLaCola(miembroId).catch(() => {});
    await (esPm ? pinPorConfirmar(String(formulario.get('pin') ?? '')) : borrarCopia()).catch(() => {});
    startTransition(() => {
      accion(formulario);
    });
  }
  return (
    <form onSubmit={(e) => void alEnviar(e)} className="flex flex-col gap-4">
      <CampoPin nombre="pin" etiqueta={t('etiqueta')} largo={largo} />
      {modo === 'elegir' ? <CampoPin nombre="repetir" etiqueta={t('repetir')} largo={largo} /> : null}
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {modo === 'elegir' ? t('guardar') : t('entrar')}
      </button>
    </form>
  );
}
