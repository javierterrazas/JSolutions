'use client';
// Cerrar la obra (D-085): el día de la entrega y los meses de garantía. Si falta algo grave, la primera vez no
// cierra: muestra lo que falta y pide confirmar.
import { useTranslations } from 'next-intl';
import { startTransition, useActionState, useRef } from 'react';
import { cerrarLaObra } from '../../../acciones/cierre-obra';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';

export function FormularioCierreObra({
  obraId,
  hoy,
  inicio,
}: {
  obraId: string;
  hoy: string;
  inicio: string;
}) {
  const t = useTranslations('cerrarObra');
  const [r, accion, enviando] = useActionState(cerrarLaObra.bind(null, obraId), null);
  const forma = useRef<HTMLFormElement>(null);
  const pideConfirmar = r?.ok && !r.datos.ok;

  const enviar = (forzar: boolean) => {
    const f = new FormData(forma.current!);
    if (forzar) f.set('forzar', 'si');
    startTransition(() => accion(f));
  };

  if (r?.ok && r.datos.ok)
    return (
      <p role="status" className="rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-900">
        {t('cerrada')}
      </p>
    );
  return (
    <form
      ref={forma}
      onSubmit={(e) => {
        e.preventDefault();
        enviar(false);
      }}
      className={`${estilos.tarjeta} flex flex-col gap-3`}
    >
      <h2 className="font-semibold text-marca">{t('cerrarTitulo')}</h2>
      <label className={estilos.etiqueta}>
        {t('fechaEntrega')}
        <input
          name="fechaEntrega"
          type="date"
          required
          defaultValue={hoy}
          min={inicio}
          max={hoy}
          className={estilos.campo}
        />
      </label>
      <label className={estilos.etiqueta}>
        {t('garantia')}
        <input
          name="garantiaMeses"
          type="number"
          inputMode="numeric"
          min={0}
          max={120}
          defaultValue={12}
          className={estilos.campo}
        />
      </label>
      <p className="text-sm text-slate-600">{t('ayuda')}</p>
      <MensajeError problema={r && !r.ok ? r : null} />
      {pideConfirmar ? (
        <div className="flex flex-col gap-2">
          <p className={estilos.error}>{t('confirmar')}</p>
          <button
            type="button"
            disabled={enviando}
            onClick={() => enviar(true)}
            className="min-h-12 rounded-xl bg-red-700 px-4 font-semibold text-white disabled:opacity-50"
          >
            {t('cerrarDeTodosModos')}
          </button>
        </div>
      ) : (
        <button type="submit" disabled={enviando} className={estilos.boton}>
          {t('cerrar')}
        </button>
      )}
    </form>
  );
}
