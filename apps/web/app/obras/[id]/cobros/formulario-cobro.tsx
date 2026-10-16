'use client';
// Registrar un pago del cliente (D-071): fecha (hoy por omisión), concepto, monto, cómo pagó y la referencia. El de una
// orden de cambio dice cuál, con lo que le falta por cobrar, y la deja facturada (D-089).
import type { CONCEPTOS_COBRO as Conceptos, METODOS_COBRO as Metodos, OrdenPorCobrar } from '@ijm/servidor';
import { useLocale, useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import { formatoDinero } from '@/lib/dinero';
import { registrarPago } from '../../../acciones/cobros';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';

/** Los de la base, en el orden en que más se usan (el tipo los revisa contra el servidor). */
export const CONCEPTOS = [
  'deposito',
  'hito',
  'orden_cambio',
  'liquidacion',
  'otro',
] as const satisfies typeof Conceptos;
export const METODOS = [
  'transferencia',
  'zelle',
  'cheque',
  'efectivo',
  'tarjeta',
] as const satisfies readonly (typeof Metodos)[number][];

export function FormularioCobro({
  obraId,
  hoy,
  ordenes,
}: {
  obraId: string;
  hoy: string;
  ordenes: readonly OrdenPorCobrar[];
}) {
  const t = useTranslations('cobros');
  const dinero = formatoDinero(useLocale());
  const [resultado, accion, enviando] = useActionState(registrarPago.bind(null, obraId), null);
  const [vuelta, setVuelta] = useState(0);
  const [visto, setVisto] = useState<typeof resultado>(null);
  const [concepto, setConcepto] = useState('hito');
  const [monto, setMonto] = useState('');
  const falta = (o: OrdenPorCobrar) => Math.max(0, Math.round((o.precio - o.cobrado) * 100) / 100);
  const elegir = (id: string) => {
    const o = ordenes.find((x) => x.id === id);
    if (o && falta(o)) setMonto(String(falta(o)));
  };

  if (resultado?.ok && resultado !== visto)
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-900">
          {t('registrado', { folio: resultado.datos.folio })}
        </p>
        <button
          type="button"
          className={estilos.botonSecundario}
          onClick={() => {
            setVisto(resultado);
            setVuelta((v) => v + 1);
            setConcepto('hito');
            setMonto('');
          }}
        >
          {t('otro')}
        </button>
      </div>
    );

  return (
    <form
      key={vuelta}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        startTransition(() => accion(f));
      }}
      className={`${estilos.tarjeta} flex flex-col gap-3`}
    >
      <h2 className="font-semibold text-marca">{t('nuevo')}</h2>
      <div className="grid grid-cols-2 gap-2">
        <label className={estilos.etiqueta}>
          {t('monto')}
          <input
            name="monto"
            inputMode="decimal"
            required
            placeholder="0.00"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className={estilos.campo}
          />
        </label>
        <label className={estilos.etiqueta}>
          {t('fecha')}
          <input name="fecha" type="date" required max={hoy} defaultValue={hoy} className={estilos.campo} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className={estilos.etiqueta}>
          {t('concepto')}
          <select
            name="concepto"
            value={concepto}
            onChange={(e) => {
              setConcepto(e.target.value);
              if (e.target.value === 'orden_cambio' && ordenes[0]) elegir(ordenes[0].id);
            }}
            className={estilos.campo}
          >
            {CONCEPTOS.map((c) => (
              <option key={c} value={c}>
                {t(`conceptos.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={estilos.etiqueta}>
          {t('metodo')}
          <select name="metodo" defaultValue="transferencia" className={estilos.campo}>
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {t(`metodos.${m}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {concepto === 'orden_cambio' ? (
        ordenes.length ? (
          <label className={estilos.etiqueta}>
            {t('ordenCambio')}
            <select
              name="ordenCambio"
              required
              defaultValue={ordenes[0]?.id}
              onChange={(e) => elegir(e.target.value)}
              className={estilos.campo}
            >
              {ordenes.map((o) => (
                <option key={o.id} value={o.id}>
                  {t('ordenOpcion', {
                    folio: o.folio,
                    descripcion: o.descripcion.length > 40 ? `${o.descripcion.slice(0, 40)}…` : o.descripcion,
                    falta: dinero.format(falta(o)),
                  })}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className={estilos.error}>{t('sinOrdenes')}</p>
        )
      ) : null}
      <label className={estilos.etiqueta}>
        {t('referencia')}
        <input
          name="referencia"
          maxLength={200}
          placeholder={t('referenciaEjemplo')}
          className={estilos.campo}
        />
      </label>
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {t('registrar')}
      </button>
    </form>
  );
}
