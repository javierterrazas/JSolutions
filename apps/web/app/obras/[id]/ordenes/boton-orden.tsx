'use client';
// Confirmar que el sub llega, o aprobar su trabajo. Aprobar pide confirmarlo (legacy: aprobarOT): con eso el sub
// puede cobrar.
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { accionOrden } from '../../../acciones/ordenes';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';

export function BotonOrden({
  obraId,
  ordenId,
  que,
}: {
  obraId: string;
  ordenId: string;
  que: 'confirmar' | 'aprobar';
}) {
  const t = useTranslations('ordenes');
  const [r, accion, enviando] = useActionState(accionOrden.bind(null, { obraId, ordenId, que }), null);
  return (
    <form
      action={accion}
      onSubmit={(e) => {
        if (que === 'aprobar' && !window.confirm(t('confirmarAprobar'))) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <MensajeError problema={r && !r.ok ? r : null} />
      <button
        type="submit"
        disabled={enviando}
        className={que === 'aprobar' ? estilos.boton : estilos.botonSecundario}
      >
        {que === 'confirmar' ? t('confirmo') : t('aprobar')}
      </button>
    </form>
  );
}
