'use client';
// Elegir el PIN (dos veces) o escribirlo para entrar.
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { elegirPin, entrarConPin } from '../acciones/entrar';
import { estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';
import { CampoPin } from './campo-pin';

export function FormularioPin({ modo, largo }: { modo: 'elegir' | 'entrar'; largo: number }) {
  const t = useTranslations('pin');
  const [resultado, accion, enviando] = useActionState(modo === 'elegir' ? elegirPin : entrarConPin, null);
  return (
    <form action={accion} className="flex flex-col gap-4">
      <CampoPin nombre="pin" etiqueta={t('etiqueta')} largo={largo} />
      {modo === 'elegir' ? <CampoPin nombre="repetir" etiqueta={t('repetir')} largo={largo} /> : null}
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {modo === 'elegir' ? t('guardar') : t('entrar')}
      </button>
    </form>
  );
}
