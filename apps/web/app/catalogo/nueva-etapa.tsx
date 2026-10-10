'use client';
// Una etapa nueva del presupuesto (Pintura): solo su nombre. Se vuelve a montar al crearse, para quedar cerrada.
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { crearEtapaNueva } from '../acciones/catalogo';
import { estilos } from '../componentes/marco';
import { enviarSinVaciar } from '../componentes/enviar';
import { MensajeError } from '../componentes/mensaje-error';

export function NuevaEtapa() {
  const t = useTranslations('catalogo');
  const [abierto, setAbierto] = useState(false);
  const [resultado, accion, enviando] = useActionState(crearEtapaNueva, null);
  if (!abierto)
    return (
      <button
        type="button"
        onClick={() => {
          setAbierto(true);
        }}
        className={estilos.botonSecundario}
      >
        {t('nuevaEtapa')}
      </button>
    );
  return (
    <form onSubmit={enviarSinVaciar(accion)} className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <p className="font-semibold text-marca">{t('nuevaEtapa')}</p>
      <label className={estilos.etiqueta}>
        {t('nombreEtapa')}
        <input
          name="nombre"
          required
          maxLength={80}
          placeholder={t('nombreEtapaEjemplo')}
          className={estilos.campo}
        />
      </label>
      <label className={estilos.etiqueta}>
        {t('nombreEn')}
        <input name="nombreEn" maxLength={80} className={estilos.campo} />
      </label>
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {t('crearEtapa')}
      </button>
    </form>
  );
}
