'use client';
// Un pago del cliente ya registrado: corregirlo (monto, concepto, referencia) o anularlo, siempre con motivo. Nada se
// borra: queda el registro de qué cambió y por qué (D-071).
import type { CobroDeObra } from '@ijm/servidor';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { formatoDinero } from '@/lib/dinero';
import { anularPago, corregirPago } from '../../../acciones/cobros';
import { enviarSinVaciar } from '../../../componentes/enviar';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';
import { CONCEPTOS } from './formulario-cobro';

export function CobroRegistrado({
  obraId,
  cobro: c,
  corregible,
}: {
  obraId: string;
  cobro: CobroDeObra;
  corregible: boolean;
}) {
  const t = useTranslations('cobros');
  const tg = useTranslations('gasto');
  const formato = useFormatter();
  const dinero = formatoDinero(useLocale());
  const ids = { obraId, cobroId: c.id };
  const [modo, setModo] = useState<'ver' | 'corregir' | 'anular'>('ver');
  const [rCorregir, mandarCorreccion, corrigiendo] = useActionState(
    async (previo: Awaited<ReturnType<typeof corregirPago>> | null, f: FormData) => {
      const r = await corregirPago(ids, previo, f);
      if (r.ok) setModo('ver');
      return r;
    },
    null,
  );
  const [rAnular, mandarAnulacion, anulando] = useActionState(anularPago.bind(null, ids), null);

  return (
    <li className={`${estilos.tarjeta} flex flex-col gap-2`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">
          {t('montoConcepto', {
            monto: dinero.format(c.monto),
            concepto: c.ordenCambio
              ? t('conceptoOrden', { folio: c.ordenCambio })
              : t(`conceptos.${c.concepto}`),
          })}
        </p>
        <p className="shrink-0 text-xs text-slate-500">{c.folio}</p>
      </div>
      <p className="text-sm text-slate-700">
        {t('cuandoComo', {
          dia: formato.dateTime(new Date(`${c.fecha}T12:00:00`), { dateStyle: 'medium' }),
          metodo: t.has(`metodos.${c.metodo}` as never) ? t(`metodos.${c.metodo}` as never) : c.metodo,
        })}
        {c.referencia ? ` · ${c.referencia}` : ''}
      </p>

      {corregible && modo === 'ver' ? (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setModo('corregir')}
            className="min-h-11 px-2 text-sm font-medium text-marca"
          >
            {tg('corregir')}
          </button>
          <button
            type="button"
            onClick={() => setModo('anular')}
            className="min-h-11 px-2 text-sm font-medium text-red-700"
          >
            {tg('anular')}
          </button>
        </div>
      ) : null}

      {modo === 'corregir' ? (
        <form onSubmit={enviarSinVaciar(mandarCorreccion)} className="flex flex-col gap-3 border-t pt-3">
          <label className={estilos.etiqueta}>
            {t('monto')}
            <input name="monto" inputMode="decimal" defaultValue={c.monto} className={estilos.campo} />
          </label>
          <label className={estilos.etiqueta}>
            {t('concepto')}
            <select name="concepto" defaultValue={c.concepto} className={estilos.campo}>
              {CONCEPTOS.map((x) => (
                <option key={x} value={x}>
                  {t(`conceptos.${x}`)}
                </option>
              ))}
            </select>
          </label>
          <label className={estilos.etiqueta}>
            {t('referencia')}
            <input
              name="referencia"
              defaultValue={c.referencia ?? ''}
              maxLength={200}
              className={estilos.campo}
            />
          </label>
          <label className={estilos.etiqueta}>
            {tg('motivo')}
            <input name="motivo" required className={estilos.campo} />
          </label>
          <MensajeError problema={rCorregir && !rCorregir.ok ? rCorregir : null} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModo('ver')}
              className={`${estilos.botonSecundario} flex-1`}
            >
              {tg('cancelar')}
            </button>
            <button type="submit" disabled={corrigiendo} className={`${estilos.boton} flex-1`}>
              {tg('guardarCorreccion')}
            </button>
          </div>
        </form>
      ) : null}

      {modo === 'anular' ? (
        <form onSubmit={enviarSinVaciar(mandarAnulacion)} className="flex flex-col gap-3 border-t pt-3">
          <p className="text-sm text-slate-700">{t('anularAyuda')}</p>
          <label className={estilos.etiqueta}>
            {tg('motivo')}
            <input name="motivo" required className={estilos.campo} />
          </label>
          <MensajeError problema={rAnular && !rAnular.ok ? rAnular : null} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModo('ver')}
              className={`${estilos.botonSecundario} flex-1`}
            >
              {tg('cancelar')}
            </button>
            <button type="submit" disabled={anulando} className={`${estilos.boton} flex-1 bg-red-700`}>
              {tg('anularConfirmar')}
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
