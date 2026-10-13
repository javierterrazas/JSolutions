'use client';
// Emitir una orden de cambio (D-067; legacy: duCrearOC). Si el precio deja menos del margen mínimo, avisa y sugiere
// el precio que lo cumple: se puede usar el sugerido o emitirla así.
import type { CONDICIONES_PAGO as Condiciones, MotivoCambio } from '@ijm/servidor';
import { useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import { emitirCambio } from '../../../acciones/cambios';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';

/** Los de la base, en el orden en que más se usan (el tipo los revisa contra el servidor). */
const MOTIVOS_CAMBIO = [
  'condicion_oculta',
  'solicitud_cliente',
  'cambio_seleccion',
] as const satisfies readonly MotivoCambio[];
const CONDICIONES_PAGO = [
  'al_autorizar',
  'mitad_al_autorizar',
  'siguiente_hito',
  'contra_entrega',
] as const satisfies typeof Condiciones;

export function FormularioCambio({ obraId, hoy }: { obraId: string; hoy: string }) {
  const t = useTranslations('cambios');
  const [resultado, accion, enviando] = useActionState(emitirCambio.bind(null, obraId), null);
  const [precio, setPrecio] = useState('');
  const [vuelta, setVuelta] = useState(0);
  const [visto, setVisto] = useState<typeof resultado>(null);

  const emitida = resultado?.ok && resultado.datos.ok && resultado !== visto ? resultado.datos : null;
  const margenBajo = resultado?.ok && !resultado.datos.ok ? resultado.datos : null;
  const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

  const enviar = (form: HTMLFormElement, forzar: boolean) => {
    const f = new FormData(form);
    if (forzar) f.set('forzar', '1');
    startTransition(() => accion(f));
  };

  if (emitida)
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-900">
          {t('emitida', { folio: emitida.folio })}
        </p>
        <button
          type="button"
          className={estilos.botonSecundario}
          onClick={() => {
            setVisto(resultado);
            setPrecio('');
            setVuelta((v) => v + 1);
          }}
        >
          {t('otra')}
        </button>
      </div>
    );

  return (
    <form
      key={vuelta}
      onSubmit={(e) => {
        e.preventDefault();
        enviar(e.currentTarget, false);
      }}
      className={`${estilos.tarjeta} flex flex-col gap-3`}
    >
      <h2 className="font-semibold text-marca">{t('nueva')}</h2>
      <label className={estilos.etiqueta}>
        {t('motivo')}
        <select name="motivo" required defaultValue="" className={estilos.campo}>
          <option value="" disabled>
            {t('elegirMotivo')}
          </option>
          {MOTIVOS_CAMBIO.map((m) => (
            <option key={m} value={m}>
              {t(`motivos.${m}`)}
            </option>
          ))}
        </select>
      </label>
      <label className={estilos.etiqueta}>
        {t('descripcion')}
        <textarea
          name="descripcion"
          required
          rows={3}
          maxLength={2000}
          placeholder={t('descripcionEjemplo')}
          className={`${estilos.campo} py-2`}
        />
      </label>
      <label className={estilos.etiqueta}>
        {t('hallazgo')}
        <input name="hallazgo" type="date" required max={hoy} defaultValue={hoy} className={estilos.campo} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={estilos.etiqueta}>
          {t('costo')}
          <input name="costo" inputMode="decimal" required placeholder="0.00" className={estilos.campo} />
        </label>
        <label className={estilos.etiqueta}>
          {t('precio')}
          <input
            name="precio"
            inputMode="decimal"
            required
            placeholder="0.00"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className={estilos.campo}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className={estilos.etiqueta}>
          {t('dias')}
          <input name="dias" inputMode="numeric" defaultValue="0" className={estilos.campo} />
        </label>
        <label className={estilos.etiqueta}>
          {t('condicion')}
          <select name="condicion" defaultValue="al_autorizar" className={estilos.campo}>
            {CONDICIONES_PAGO.map((c) => (
              <option key={c} value={c}>
                {t(`condiciones.${c}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {margenBajo ? (
        <div role="alert" className="flex flex-col gap-2 rounded-xl bg-amber-50 p-3 text-amber-900">
          <p>
            {t('margenBajo', {
              margen: pct(margenBajo.margen),
              minimo: pct(margenBajo.minimo),
              sugerido: `$${margenBajo.sugerido.toLocaleString('en-US')}`,
            })}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={estilos.botonSecundario}
              onClick={() => setPrecio(String(margenBajo.sugerido))}
            >
              {t('usarSugerido')}
            </button>
            <button
              type="button"
              disabled={enviando}
              className="min-h-12 rounded-xl bg-amber-800 px-4 font-semibold text-white disabled:opacity-50"
              onClick={(e) => enviar(e.currentTarget.form!, true)}
            >
              {t('emitirAsi')}
            </button>
          </div>
        </div>
      ) : null}
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {enviando ? t('emitiendo') : t('emitir')}
      </button>
    </form>
  );
}
