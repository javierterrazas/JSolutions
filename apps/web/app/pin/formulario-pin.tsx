'use client';
// Elegir el PIN (dos veces) o escribirlo para entrar. Antes de enviarlo, el teléfono guarda su huella por confirmar:
// si el servidor lo acepta, el inicio la vuelve el PIN para abrir la app sin señal (D-047).
import { useTranslations } from 'next-intl';
import { type FormEvent, startTransition, useActionState } from 'react';
import { pinPorConfirmar } from '@/lib/copia-telefono';
import { elegirPin, entrarConPin } from '../acciones/entrar';
import { estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';
import { CampoPin } from './campo-pin';

export function FormularioPin({ modo, largo }: { modo: 'elegir' | 'entrar'; largo: number }) {
  const t = useTranslations('pin');
  const [resultado, accion, enviando] = useActionState(modo === 'elegir' ? elegirPin : entrarConPin, null);
  // como enviarSinVaciar, pero espera a guardar la huella
  async function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = new FormData(e.currentTarget);
    // sin IndexedDB la app entra igual; solo no podrá abrirse sin señal
    await pinPorConfirmar(String(formulario.get('pin') ?? '')).catch(() => {});
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
