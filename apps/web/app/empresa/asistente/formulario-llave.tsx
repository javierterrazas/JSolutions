'use client';
// Crear una llave para conectar un asistente (D-114). El enlace con la llave se ve solo aquí, una vez: la base guarda
// su huella, así que no se puede volver a mostrar.
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { crearLlave } from '../../acciones/asistente';
import { enviarSinVaciar } from '../../componentes/enviar';
import { estilos } from '../../componentes/marco';
import { MensajeError } from '../../componentes/mensaje-error';

export function FormularioLlave() {
  const t = useTranslations('asistente');
  const [resultado, accion, enviando] = useActionState(crearLlave, null);
  const [copiado, setCopiado] = useState(false);

  if (resultado?.ok) {
    const { enlace, nombre } = resultado.datos;
    const copiar = async () => {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    };
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-marca/30 bg-white p-4">
        <p className="font-semibold text-marca">{t('enlaceTitulo', { nombre })}</p>
        <p className="text-sm font-medium text-amber-800">{t('enlaceUnaVez')}</p>
        <input
          readOnly
          value={enlace}
          aria-label={t('copiar')}
          onFocus={(e) => e.currentTarget.select()}
          className={`${estilos.campo} text-sm`}
        />
        <button type="button" onClick={copiar} className={estilos.boton}>
          {copiado ? t('copiado') : t('copiar')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviarSinVaciar(accion)} className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <h2 className="font-semibold text-marca">{t('nueva')}</h2>
      <label className={estilos.etiqueta}>
        {t('nombre')}
        <input
          name="nombre"
          required
          maxLength={60}
          defaultValue="Claude"
          autoComplete="off"
          className={estilos.campo}
        />
        <span className="text-sm font-normal text-slate-600">{t('nombreAyuda')}</span>
      </label>
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {t('crear')}
      </button>
    </form>
  );
}
