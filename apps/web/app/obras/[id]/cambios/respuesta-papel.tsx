'use client';
// Registrar la respuesta que el cliente dio fuera del portal (firmada en papel, por correo): aprobada o no aprobada,
// con su nombre (D-067).
import { useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import { registrarRespuesta } from '../../../acciones/cambios';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';

export function RespuestaPapel({ obraId, ordenId }: { obraId: string; ordenId: string }) {
  const t = useTranslations('cambios');
  const [abierto, setAbierto] = useState(false);
  const [resultado, accion, enviando] = useActionState(registrarRespuesta.bind(null, obraId, ordenId), null);

  if (!abierto)
    return (
      <button
        type="button"
        className="min-h-11 self-start px-1 text-sm font-semibold text-marca underline"
        onClick={() => setAbierto(true)}
      >
        {t('registrarPapel')}
      </button>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // con el botón que se tocó: dice si aprobó o no
        const f = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => accion(f));
      }}
      className="flex flex-col gap-3 border-t border-slate-100 pt-3"
    >
      <p className="text-sm text-slate-700">{t('papelAyuda')}</p>
      <label className={estilos.etiqueta}>
        {t('quienRespondio')}
        <input name="nombre" required maxLength={120} className={estilos.campo} />
      </label>
      <label className={estilos.etiqueta}>
        {t('comentario')}
        <input name="comentario" maxLength={200} className={estilos.campo} />
      </label>
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <div className="grid grid-cols-2 gap-2">
        <button type="submit" name="decision" value="aprobada" disabled={enviando} className={estilos.boton}>
          {t('aprobo')}
        </button>
        <button
          type="submit"
          name="decision"
          value="rechazada"
          disabled={enviando}
          className={estilos.botonSecundario}
        >
          {t('noAprobo')}
        </button>
      </div>
    </form>
  );
}
