'use client';
// Atender un reclamo de garantía (D-090): lo que costó, y queda cerrado.
import { useTranslations } from 'next-intl';
import { startTransition, useActionState } from 'react';
import { cerrarLaGarantia } from '../../../acciones/posventa';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';

export function CerrarGarantia({ obraId, noCalidadId }: { obraId: string; noCalidadId: string }) {
  const t = useTranslations('retrabajos');
  const [r, accion, enviando] = useActionState(cerrarLaGarantia.bind(null, { obraId, noCalidadId }), null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        startTransition(() => accion(f));
      }}
      className="mt-1 flex flex-col gap-2 border-t border-slate-200 pt-2"
    >
      <p className="font-medium text-amber-900">{t('abierta')}</p>
      <div className="flex items-end gap-2">
        <label className={`${estilos.etiqueta} flex-1`}>
          {t('costoAtender')}
          <input name="costo" inputMode="decimal" placeholder="0.00" className={estilos.campo} />
        </label>
        <button type="submit" disabled={enviando} className={estilos.boton}>
          {t('cerrarGarantia')}
        </button>
      </div>
      <MensajeError problema={r && !r.ok ? r : null} />
    </form>
  );
}
