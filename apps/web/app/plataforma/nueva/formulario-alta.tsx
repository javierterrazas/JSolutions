'use client';
// El alta de una empresa con su dueño y su suscripción (D-080). Lista, el enlace para el dueño: se ve una sola vez.
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState } from 'react';
import { darDeAlta } from '../../acciones/plataforma';
import { enviarSinVaciar } from '../../componentes/enviar';
import { estilos } from '../../componentes/marco';
import { MensajeError } from '../../componentes/mensaje-error';
import { EnlaceInvitacion } from '../../equipo/enlace-invitacion';
import { CamposSuscripcion } from '../campos-suscripcion';

export function FormularioAlta({ venceEl }: { venceEl: string }) {
  const t = useTranslations('plataforma');
  const ti = useTranslations('idioma');
  const [r, accion, enviando] = useActionState(darDeAlta, null);
  if (r?.ok)
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-900">
          {t('altaLista')}
        </p>
        <EnlaceInvitacion invitacion={r.datos} />
        <Link
          href={`/plataforma/${r.datos.empresaId}`}
          className={`${estilos.botonSecundario} flex items-center justify-center`}
        >
          {t('verCuenta')}
        </Link>
      </div>
    );
  return (
    <form onSubmit={enviarSinVaciar(accion)} className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <label className={estilos.etiqueta}>
        {t('empresa')}
        <input name="empresa" required maxLength={120} className={estilos.campo} />
      </label>
      <label className={estilos.etiqueta}>
        {t('ciudad')}
        <input name="ciudad" maxLength={120} placeholder={t('ciudadEjemplo')} className={estilos.campo} />
      </label>
      <label className={estilos.etiqueta}>
        {t('dueno')}
        <input name="dueno" required maxLength={80} className={estilos.campo} />
      </label>
      <label className={estilos.etiqueta}>
        {t('celular')}
        <input name="celular" type="tel" inputMode="tel" required className={estilos.campo} />
        <span className="text-sm font-normal text-slate-600">{t('celularAyuda')}</span>
      </label>
      <label className={estilos.etiqueta}>
        {t('correoOpcional')}
        <input name="correo" type="email" className={estilos.campo} />
      </label>
      <label className={estilos.etiqueta}>
        {t('idioma')}
        <select name="idioma" defaultValue="es" className={estilos.campo}>
          <option value="es">{ti('es')}</option>
          <option value="en">{ti('en')}</option>
        </select>
      </label>
      <h2 className="mt-2 font-semibold text-marca">{t('suscripcion')}</h2>
      <CamposSuscripcion valores={{ plan: 'basico', precio: 0, ciclo: 'mensual', enPrueba: true, venceEl }} />
      <MensajeError problema={r && !r.ok ? r : null} />
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {t('darDeAlta')}
      </button>
    </form>
  );
}
