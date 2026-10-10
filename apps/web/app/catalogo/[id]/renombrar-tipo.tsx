'use client';
// Cambiar el nombre de un tipo de obra. Los espacios que ya existen conservan el suyo.
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { renombrarTipo } from '../../acciones/catalogo';
import { estilos } from '../../componentes/marco';
import { enviarSinVaciar } from '../../componentes/enviar';
import { MensajeError } from '../../componentes/mensaje-error';

export function RenombrarTipo({
  tipoId,
  nombre,
}: {
  tipoId: string;
  nombre: { es: string; en: string | null };
}) {
  const t = useTranslations('catalogo');
  const [abierto, setAbierto] = useState(false);
  const [resultado, accion, enviando] = useActionState(
    async (previo: Awaited<ReturnType<typeof renombrarTipo>> | null, formulario: FormData) => {
      const r = await renombrarTipo(tipoId, previo, formulario);
      if (r.ok) setAbierto(false);
      return r;
    },
    null,
  );
  if (!abierto)
    return (
      <button
        type="button"
        onClick={() => {
          setAbierto(true);
        }}
        className="self-start text-sm font-medium text-marca"
      >
        {t('renombrar')}
      </button>
    );
  return (
    <form onSubmit={enviarSinVaciar(accion)} className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <label className={estilos.etiqueta}>
        {t('nombreTipo')}
        <input name="nombre" required maxLength={80} defaultValue={nombre.es} className={estilos.campo} />
      </label>
      <label className={estilos.etiqueta}>
        {t('nombreEn')}
        <input name="nombreEn" maxLength={80} defaultValue={nombre.en ?? ''} className={estilos.campo} />
      </label>
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
          }}
          className={`${estilos.botonSecundario} flex-1`}
        >
          {t('cancelar')}
        </button>
        <button type="submit" disabled={enviando} className={`${estilos.boton} flex-1`}>
          {t('guardar')}
        </button>
      </div>
    </form>
  );
}
