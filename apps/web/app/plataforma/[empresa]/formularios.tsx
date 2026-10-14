'use client';
// La cuenta de una empresa (D-080): cambiar su suscripción, anotar un pago, reinvitar a su dueño y suspenderla.
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import {
  cambiarActiva,
  guardarLaSuscripcion,
  registrarPago,
  reinvitarAlDueno,
} from '../../acciones/plataforma';
import { enviarSinVaciar } from '../../componentes/enviar';
import { estilos } from '../../componentes/marco';
import { MensajeError } from '../../componentes/mensaje-error';
import { EnlaceInvitacion } from '../../equipo/enlace-invitacion';
import { CamposSuscripcion, type ValoresSuscripcion } from '../campos-suscripcion';

const Listo = ({ texto }: { texto: string }) => (
  <p role="status" className="rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-900">
    {texto}
  </p>
);

export function FormularioSuscripcion({
  empresaId,
  valores,
  notas,
}: {
  empresaId: string;
  valores: ValoresSuscripcion;
  notas: string;
}) {
  const t = useTranslations('plataforma');
  const [r, accion, enviando] = useActionState(guardarLaSuscripcion.bind(null, empresaId), null);
  return (
    <form onSubmit={enviarSinVaciar(accion)} className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <h2 className="font-semibold text-marca">{t('suscripcion')}</h2>
      <CamposSuscripcion valores={valores} />
      <label className={estilos.etiqueta}>
        {t('notas')}
        <textarea
          name="notas"
          maxLength={500}
          defaultValue={notas}
          rows={2}
          className={`${estilos.campo} py-2`}
        />
      </label>
      <MensajeError problema={r && !r.ok ? r : null} />
      {r?.ok ? <Listo texto={t('guardado')} /> : null}
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {t('guardar')}
      </button>
    </form>
  );
}

export function FormularioPago({
  empresaId,
  monto,
  hoy,
  venceEl,
}: {
  empresaId: string;
  monto: number;
  hoy: string;
  venceEl: string;
}) {
  const t = useTranslations('plataforma');
  const [r, accion, enviando] = useActionState(registrarPago.bind(null, empresaId), null);
  return (
    <form onSubmit={enviarSinVaciar(accion)} className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <h2 className="font-semibold text-marca">{t('registrarPago')}</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className={estilos.etiqueta}>
          {t('monto')}
          <input
            name="monto"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            defaultValue={monto || ''}
            className={estilos.campo}
          />
        </label>
        <label className={estilos.etiqueta}>
          {t('pagadoEl')}
          <input
            name="pagadoEl"
            type="date"
            required
            max={hoy}
            defaultValue={hoy}
            className={estilos.campo}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={estilos.etiqueta}>
          {t('metodo')}
          <select name="metodo" defaultValue="zelle" className={estilos.campo}>
            {(['zelle', 'transferencia', 'efectivo', 'tarjeta', 'otro'] as const).map((m) => (
              <option key={m} value={m}>
                {t(`metodos.${m}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={estilos.etiqueta}>
          {t('referencia')}
          <input name="referencia" maxLength={120} className={estilos.campo} />
        </label>
      </div>
      <label className={estilos.etiqueta}>
        {t('cubreHasta')}
        <input name="venceEl" type="date" required defaultValue={venceEl} className={estilos.campo} />
        <span className="text-sm font-normal text-slate-600">{t('cubreHastaAyuda')}</span>
      </label>
      <MensajeError problema={r && !r.ok ? r : null} />
      {r?.ok ? <Listo texto={t('pagoRegistrado')} /> : null}
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {t('registrarPago')}
      </button>
    </form>
  );
}

export function ReinvitarDueno({ empresaId }: { empresaId: string }) {
  const t = useTranslations('plataforma');
  const [r, accion, enviando] = useActionState(reinvitarAlDueno.bind(null, empresaId), null);
  if (r?.ok) return <EnlaceInvitacion invitacion={r.datos} />;
  return (
    <form action={accion} className="flex flex-col gap-2">
      <MensajeError problema={r && !r.ok ? r : null} />
      <button type="submit" disabled={enviando} className={estilos.botonSecundario}>
        {t('reinvitar')}
      </button>
      <p className="text-sm text-slate-600">{t('reinvitarAyuda')}</p>
    </form>
  );
}

export function SuspenderEmpresa({ empresaId, activa }: { empresaId: string; activa: boolean }) {
  const t = useTranslations('plataforma');
  const [seguro, setSeguro] = useState(false);
  const [r, accion, enviando] = useActionState(cambiarActiva.bind(null, empresaId, !activa), null);
  if (activa && !seguro)
    return (
      <button type="button" onClick={() => setSeguro(true)} className={estilos.botonSecundario}>
        {t('suspender')}
      </button>
    );
  return (
    <form action={accion} className="flex flex-col gap-2">
      {activa ? <p className={estilos.error}>{t('suspenderSeguro')}</p> : null}
      <MensajeError problema={r && !r.ok ? r : null} />
      <div className="flex gap-2">
        {activa ? (
          <button
            type="button"
            onClick={() => setSeguro(false)}
            className={`${estilos.botonSecundario} flex-1`}
          >
            {t('cancelar')}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={enviando}
          className={
            activa ? 'min-h-12 flex-1 rounded-xl bg-red-700 px-4 font-semibold text-white' : estilos.boton
          }
        >
          {activa ? t('suspenderSi') : t('reactivar')}
        </button>
      </div>
    </form>
  );
}
