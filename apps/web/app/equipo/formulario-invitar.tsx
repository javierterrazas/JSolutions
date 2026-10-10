'use client';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { invitar } from '../acciones/equipo';
import { enviarSinVaciar } from '../componentes/enviar';
import { estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';
import { EnlaceInvitacion } from './enlace-invitacion';

export function FormularioInvitar() {
  const t = useTranslations();
  const [resultado, accion, enviando] = useActionState(invitar, null);
  if (resultado?.ok) return <EnlaceInvitacion invitacion={resultado.datos} />;
  return (
    <form onSubmit={enviarSinVaciar(accion)} className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <h2 className="font-semibold text-marca">{t('equipo.invitarTitulo')}</h2>
      <label className={estilos.etiqueta}>
        {t('equipo.nombre')}
        <input name="nombre" required maxLength={80} autoComplete="off" className={estilos.campo} />
      </label>
      <label className={estilos.etiqueta}>
        {t('equipo.correo')}
        <input name="correo" type="email" required autoComplete="off" className={estilos.campo} />
      </label>
      <label className={estilos.etiqueta}>
        {t('equipo.idiomaApp')}
        <select name="idioma" defaultValue="es" className={estilos.campo}>
          <option value="es">{t('idioma.es')}</option>
          <option value="en">{t('idioma.en')}</option>
        </select>
      </label>
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {t('equipo.invitar')}
      </button>
    </form>
  );
}
