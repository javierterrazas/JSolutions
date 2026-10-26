'use client';
// Poner la salida que un trabajador olvidó, o anular una checada, cada una con su motivo (D-117).
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { anularLaChecada, ponerSalida } from '../acciones/checada';
import { enviarSinVaciar } from '../componentes/enviar';
import { estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';

export function PonerSalida({ entradaId }: { entradaId: string }) {
  const t = useTranslations('checadas');
  const [r, accion, enviando] = useActionState(ponerSalida.bind(null, entradaId), null);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-marca underline">{t('ponerSalida')}</summary>
      <form onSubmit={enviarSinVaciar(accion)} className="mt-2 flex flex-col gap-2">
        <label className={estilos.etiqueta}>
          {t('hora')}
          <input name="hora" type="time" required className={estilos.campo} />
        </label>
        <label className={estilos.etiqueta}>
          {t('motivo')}
          <input name="motivo" required minLength={3} maxLength={300} className={estilos.campo} />
        </label>
        <MensajeError problema={r && !r.ok ? r : null} />
        <button type="submit" disabled={enviando} className={estilos.boton}>
          {t('guardarSalida')}
        </button>
      </form>
    </details>
  );
}

export function AnularChecada({ checadaId }: { checadaId: string }) {
  const t = useTranslations('checadas');
  const [r, accion, enviando] = useActionState(anularLaChecada.bind(null, checadaId), null);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-red-700 underline">{t('anular')}</summary>
      <form onSubmit={enviarSinVaciar(accion)} className="mt-2 flex flex-col gap-2">
        <label className={estilos.etiqueta}>
          {t('motivo')}
          <input name="motivo" required minLength={3} maxLength={300} className={estilos.campo} />
        </label>
        <MensajeError problema={r && !r.ok ? r : null} />
        <button type="submit" disabled={enviando} className={`${estilos.botonSecundario} text-red-700`}>
          {t('confirmarAnular')}
        </button>
      </form>
    </details>
  );
}
