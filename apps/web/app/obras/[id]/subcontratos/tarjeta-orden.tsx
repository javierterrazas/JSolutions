'use client';
// Una orden de trabajo (D-074): el sub, la partida, el alcance, las fechas, en qué va (emitida, confirmada por el sub,
// aprobada por el PM, pagada o cancelada), su precio, lo pagado y el saldo. Pagarle al sub contra ella (con los
// avisos del legacy, que se confirman uno por uno), anular un pago con su motivo, o cancelarla si no tiene pagos.
import type { Nombre, OrdenDeTrabajo } from '@ijm/servidor';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { startTransition, useActionState, useRef, useState } from 'react';
import { formatoDinero } from '@/lib/dinero';
import { anularPagoSub, cancelarOrden, pagarSub, reprogramarOrden } from '../../../acciones/subcontratos';
import { enviarSinVaciar } from '../../../componentes/enviar';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';

const COLOR: Record<OrdenDeTrabajo['estado'], string> = {
  emitida: 'bg-amber-100 text-amber-900',
  confirmada: 'bg-sky-100 text-sky-900',
  aprobada: 'bg-emerald-100 text-emerald-900',
  pagada: 'bg-slate-200 text-slate-800',
  cancelada: 'bg-red-100 text-red-900',
};
const CONCEPTOS = ['anticipo', 'parcial', 'liquidacion'] as const;
const METODOS = ['transferencia', 'cheque', 'zelle', 'efectivo', 'tarjeta', 'tarjeta_empresa'] as const;

function PagoHecho({
  obraId,
  pago,
  anulable,
}: {
  obraId: string;
  pago: OrdenDeTrabajo['pagos'][number];
  anulable: boolean;
}) {
  const t = useTranslations('subcontratos');
  const tg = useTranslations('gasto');
  const formato = useFormatter();
  const dinero = formatoDinero(useLocale());
  const [anulando, setAnulando] = useState(false);
  const [r, anular, enviando] = useActionState(anularPagoSub.bind(null, obraId, pago.id), null);
  return (
    <li className="flex flex-col gap-1 border-t border-slate-100 pt-2 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span>
          {t('pagoLinea', {
            dia: formato.dateTime(new Date(`${pago.fecha}T12:00:00`), { dateStyle: 'medium' }),
            concepto: t(`conceptos.${pago.concepto}`),
          })}
        </span>
        <span className="font-semibold">{dinero.format(pago.monto)}</span>
      </div>
      {anulable && !anulando ? (
        <button
          type="button"
          onClick={() => setAnulando(true)}
          className="min-h-10 self-end px-1 font-medium text-red-700"
        >
          {tg('anular')}
        </button>
      ) : null}
      {anulando ? (
        <form onSubmit={enviarSinVaciar(anular)} className="flex flex-col gap-2">
          <label className={estilos.etiqueta}>
            {tg('motivo')}
            <input name="motivo" required className={estilos.campo} />
          </label>
          <MensajeError problema={r && !r.ok ? r : null} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAnulando(false)}
              className={`${estilos.botonSecundario} flex-1`}
            >
              {tg('cancelar')}
            </button>
            <button type="submit" disabled={enviando} className={`${estilos.boton} flex-1 bg-red-700`}>
              {tg('anularConfirmar')}
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

export function TarjetaOrden({
  obraId,
  orden: o,
  hoy,
  cerrada,
}: {
  obraId: string;
  orden: OrdenDeTrabajo;
  hoy: string;
  cerrada: boolean;
}) {
  const t = useTranslations('subcontratos');
  const formato = useFormatter();
  const idioma = useLocale();
  const dinero = formatoDinero(idioma);
  const nombre = (n: Nombre) => (idioma === 'en' ? n.en : null) ?? n.es;
  const dia = (d: string) => formato.dateTime(new Date(`${d}T12:00:00`), { day: 'numeric', month: 'short' });
  const [pagando, setPagando] = useState(false);
  const [reprogramando, setReprogramando] = useState(false);
  const [rReprogramar, reprogramar, enviandoReprogramar] = useActionState(
    async (previo: Awaited<ReturnType<typeof reprogramarOrden>> | null, f: FormData) => {
      const r = await reprogramarOrden(obraId, o.id, previo, f);
      if (r.ok) setReprogramando(false);
      return r;
    },
    null,
  );
  const [confirmado, setConfirmado] = useState<string[]>([]);
  const formulario = useRef<HTMLFormElement>(null);
  const [rPago, pagar, enviandoPago] = useActionState(
    async (previo: Awaited<ReturnType<typeof pagarSub>> | null, f: FormData) => {
      const r = await pagarSub(obraId, o.id, previo, f);
      if (r.ok && r.datos.ok) {
        setPagando(false);
        setConfirmado([]);
      }
      return r;
    },
    null,
  );
  const [rCancelar, cancelar, cancelando] = useActionState(cancelarOrden.bind(null, obraId, o.id), null);
  const aviso = rPago?.ok && !rPago.datos.ok ? rPago.datos : null;
  const enviar = (extra: string[] = []) => {
    if (!formulario.current) return;
    const todos = [...confirmado, ...extra];
    setConfirmado(todos);
    const f = new FormData(formulario.current);
    f.set('confirmado', todos.join(','));
    startTransition(() => pagar(f));
  };
  const abierta = !cerrada && o.estado !== 'cancelada';

  return (
    <li className={`${estilos.tarjeta} flex flex-col gap-2 ${o.estado === 'cancelada' ? 'opacity-70' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{t('folioSub', { folio: o.folio, sub: o.sub.nombre })}</span>
        <span className={`rounded-full px-2 py-0.5 text-sm font-semibold ${COLOR[o.estado]}`}>
          {t(`estados.${o.estado}`)}
        </span>
      </div>
      <p className="text-sm text-slate-700">
        {t('partidaDe', { espacio: o.espacio, partida: nombre(o.partida) })}
      </p>
      <p className="text-slate-900">{o.alcance}</p>
      <p className="flex flex-wrap gap-x-3 text-sm text-slate-700">
        <span>{t('fechas', { inicio: dia(o.inicio), fin: dia(o.fin) })}</span>
        {o.sePresento === false ? <span className="font-semibold text-red-700">{t('noLlego')}</span> : null}
        {o.faltas ? <span className="text-amber-800">{t('faltas', { n: o.faltas })}</span> : null}
      </p>
      <dl className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2 text-center text-sm">
        <div>
          <dt className="text-slate-600">{t('precio')}</dt>
          <dd className="font-semibold">{dinero.format(o.precio)}</dd>
        </div>
        <div>
          <dt className="text-slate-600">{t('pagado')}</dt>
          <dd className="font-semibold text-emerald-800">{dinero.format(o.pagado)}</dd>
        </div>
        <div>
          <dt className="text-slate-600">{t('saldo')}</dt>
          <dd className={`font-semibold ${o.saldo > 0 ? 'text-amber-800' : ''}`}>{dinero.format(o.saldo)}</dd>
        </div>
      </dl>
      {o.pagos.length ? (
        <ul className="flex flex-col gap-1">
          {o.pagos.map((p) => (
            <PagoHecho key={p.id} obraId={obraId} pago={p} anulable={!cerrada} />
          ))}
        </ul>
      ) : null}

      {pagando ? (
        <form
          ref={formulario}
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
          className="flex flex-col gap-3 border-t border-slate-100 pt-3"
        >
          <div className="grid grid-cols-2 gap-2">
            <label className={estilos.etiqueta}>
              {t('monto')}
              <input
                name="monto"
                inputMode="decimal"
                required
                defaultValue={o.saldo > 0 ? o.saldo : ''}
                className={estilos.campo}
              />
            </label>
            <label className={estilos.etiqueta}>
              {t('fecha')}
              <input
                name="fecha"
                type="date"
                required
                max={hoy}
                defaultValue={hoy}
                className={estilos.campo}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className={estilos.etiqueta}>
              {t('concepto')}
              <select
                name="concepto"
                defaultValue={o.pagado ? 'parcial' : 'anticipo'}
                onChange={() => setConfirmado([])}
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
          <label className={estilos.etiqueta}>
            {t('referencia')}
            <input name="referencia" maxLength={200} className={estilos.campo} />
          </label>
          {aviso ? (
            <div role="alert" className="flex flex-col gap-2 rounded-xl bg-amber-50 p-3 text-amber-900">
              <p>
                {t(`avisos.${aviso.confirmar}`, {
                  total: dinero.format(aviso.total ?? 0),
                  precio: dinero.format(o.precio),
                })}
              </p>
              <button
                type="button"
                disabled={enviandoPago}
                onClick={() => enviar([aviso.confirmar])}
                className="min-h-12 rounded-xl bg-amber-800 px-4 font-semibold text-white disabled:opacity-50"
              >
                {t('pagarAsi')}
              </button>
            </div>
          ) : null}
          <MensajeError problema={rPago && !rPago.ok ? rPago : null} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPagando(false);
                setConfirmado([]);
              }}
              className={`${estilos.botonSecundario} flex-1`}
            >
              {t('cancelar')}
            </button>
            <button type="submit" disabled={enviandoPago} className={`${estilos.boton} flex-1`}>
              {t('registrarPago')}
            </button>
          </div>
        </form>
      ) : null}

      {rPago?.ok && rPago.datos.ok && !pagando ? (
        <p role="status" className="text-sm font-semibold text-emerald-800">
          {t('pagoRegistrado', { folio: rPago.datos.folio })}
        </p>
      ) : null}
      <MensajeError problema={rCancelar && !rCancelar.ok ? rCancelar : null} />
      {reprogramando ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            startTransition(() => reprogramar(f));
          }}
          className="flex flex-col gap-3 border-t border-slate-100 pt-3"
        >
          <p className="text-sm text-slate-700">{t('reprogramarAyuda')}</p>
          <div className="grid grid-cols-2 gap-2">
            <label className={estilos.etiqueta}>
              {t('nuevoInicio')}
              <input name="inicio" type="date" required defaultValue={hoy} className={estilos.campo} />
            </label>
            <label className={estilos.etiqueta}>
              {t('nuevoFin')}
              <input name="fin" type="date" defaultValue={hoy} className={estilos.campo} />
            </label>
          </div>
          <label className={estilos.etiqueta}>
            {t('motivo')}
            <input name="motivo" required minLength={5} maxLength={500} className={estilos.campo} />
          </label>
          <MensajeError problema={rReprogramar && !rReprogramar.ok ? rReprogramar : null} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setReprogramando(false)}
              className={`${estilos.botonSecundario} flex-1`}
            >
              {t('cancelar')}
            </button>
            <button type="submit" disabled={enviandoReprogramar} className={`${estilos.boton} flex-1`}>
              {t('reprogramar')}
            </button>
          </div>
        </form>
      ) : null}
      {rReprogramar?.ok && !reprogramando ? (
        <p role="status" className="text-sm font-semibold text-emerald-800">
          {rReprogramar.datos.falto ? t('reprogramadaConFalta') : t('reprogramada')}
        </p>
      ) : null}

      {abierta && !pagando && !reprogramando ? (
        <div className="grid grid-cols-2 gap-2">
          {o.estado === 'emitida' || o.estado === 'confirmada' ? (
            <button type="button" onClick={() => setReprogramando(true)} className={estilos.botonSecundario}>
              {t('reprogramar')}
            </button>
          ) : null}
          {o.estado !== 'pagada' ? (
            <button type="button" onClick={() => setPagando(true)} className={estilos.botonSecundario}>
              {t('pagar')}
            </button>
          ) : null}
          {o.pagos.length === 0 && o.estado !== 'pagada' ? (
            <button
              type="button"
              disabled={cancelando}
              onClick={() => startTransition(() => cancelar())}
              className={`${estilos.botonSecundario} text-red-700`}
            >
              {t('cancelarOrden')}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
