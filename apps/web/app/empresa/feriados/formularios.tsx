'use client';
// Agregar un feriado, o los de Estados Unidos de un año de un toque (D-108).
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { feriadosDeEstadosUnidos, nuevoFeriado } from '@/app/acciones/feriados';
import { enviarSinVaciar } from '../../componentes/enviar';
import { estilos } from '../../componentes/marco';
import { MensajeError } from '../../componentes/mensaje-error';

export function FeriadosDeEstadosUnidos({ anio }: { anio: number }) {
  const t = useTranslations('feriados');
  const [r, accion, enviando] = useActionState(feriadosDeEstadosUnidos.bind(null, anio), null);
  return (
    <form action={accion} className="flex flex-col gap-1">
      <button type="submit" disabled={enviando} className={`${estilos.botonSecundario} text-sm`}>
        {t('deEstadosUnidos', { anio })}
      </button>
      {r?.ok ? (
        <p role="status" className="text-center text-xs text-slate-600">
          {t('agregados', { n: r.datos.agregados })}
        </p>
      ) : null}
      <MensajeError problema={r && !r.ok ? r : null} />
    </form>
  );
}

export function AgregarFeriado() {
  const t = useTranslations('feriados');
  const [r, accion, enviando] = useActionState(nuevoFeriado, null);
  return (
    <form onSubmit={enviarSinVaciar(accion)} className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <h2 className="font-semibold text-marca">{t('agregar')}</h2>
      <label className={estilos.etiqueta}>
        {t('fecha')}
        <input name="dia" type="date" required className={estilos.campo} />
      </label>
      <label className={estilos.etiqueta}>
        {t('nombre')}
        <input
          name="nombre"
          required
          maxLength={80}
          placeholder={t('nombreEjemplo')}
          className={estilos.campo}
        />
      </label>
      <label className={estilos.etiqueta}>
        {t('nombreEn')}
        <input name="nombreEn" maxLength={80} className={estilos.campo} />
      </label>
      {r?.ok ? (
        <p role="status" className="text-sm font-semibold text-emerald-800">
          {t('agregado')}
        </p>
      ) : null}
      <MensajeError problema={r && !r.ok ? r : null} />
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {t('guardar')}
      </button>
    </form>
  );
}
