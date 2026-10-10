'use client';
// Contestar un aviso: la respuesta le llega al PM en su inicio y el aviso se cierra.
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { contestarAviso } from '../acciones/avisos';
import { enviarSinVaciar } from '../componentes/enviar';
import { estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';

export function ResponderAviso({ avisoId }: { avisoId: string }) {
  const t = useTranslations('avisosAbiertos');
  const [r, accion, enviando] = useActionState(contestarAviso.bind(null, avisoId), null);
  return (
    <form onSubmit={enviarSinVaciar(accion)} className="mt-1 flex flex-col gap-2 border-t pt-3">
      <label className={estilos.etiqueta}>
        {t('respuesta')}
        <textarea
          name="respuesta"
          required
          rows={3}
          maxLength={1000}
          placeholder={t('respuestaEjemplo')}
          className={`${estilos.campo} py-2`}
        />
      </label>
      <MensajeError problema={r && !r.ok ? r : null} />
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {t('contestar')}
      </button>
    </form>
  );
}
