'use client';
// Registrar un retrabajo o un reclamo de garantía (D-090). El reclamo solo en una obra entregada, y sin días perdidos:
// su costo se pone al atenderlo.
import type { CAUSAS_NO_CALIDAD as Causas } from '@ijm/servidor';
import { useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import { registrarRetrabajo } from '../../../acciones/posventa';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';

/** Los de la base (el tipo los revisa contra el servidor). */
const CAUSAS = [
  'error_instalacion',
  'error_especificacion',
  'error_estimacion',
  'material_defectuoso',
  'falta_supervision',
] as const satisfies typeof Causas;

export function FormularioNoCalidad({
  obraId,
  entregada,
  subs,
}: {
  obraId: string;
  entregada: boolean;
  subs: readonly { id: string; nombre: string }[];
}) {
  const t = useTranslations('retrabajos');
  const [resultado, accion, enviando] = useActionState(registrarRetrabajo.bind(null, obraId), null);
  const [tipo, setTipo] = useState<'retrabajo' | 'garantia'>(entregada ? 'garantia' : 'retrabajo');
  const [vuelta, setVuelta] = useState(0);
  const [visto, setVisto] = useState<typeof resultado>(null);

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
          }}
        >
          {t('otro')}
        </button>
      </div>
    );
  const retrabajo = tipo === 'retrabajo';
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
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">{t('tipo')}</legend>
        {(['retrabajo', 'garantia'] as const).map((x) => (
          <label
            key={x}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2 text-center font-medium ${tipo === x ? 'border-marca bg-marca/10' : 'border-slate-300'} ${x === 'garantia' && !entregada ? 'opacity-50' : ''}`}
          >
            <input
              type="radio"
              name="tipo"
              value={x}
              checked={tipo === x}
              disabled={x === 'garantia' && !entregada}
              onChange={() => setTipo(x)}
            />
            {t(`tipos.${x}`)}
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-slate-600">
        {retrabajo ? t('ayudaRetrabajo') : t('ayudaGarantia')}
        {entregada ? null : ` ${t('garantiaAlEntregar')}`}
      </p>
      <label className={estilos.etiqueta}>
        {t('descripcion')}
        <textarea name="descripcion" required minLength={4} rows={3} className={`${estilos.campo} py-2`} />
      </label>
      <label className={estilos.etiqueta}>
        {t('causa')}
        <select name="causa" defaultValue="" className={estilos.campo}>
          <option value="">{t('sinCausa')}</option>
          {CAUSAS.map((c) => (
            <option key={c} value={c}>
              {t(`causas.${c}`)}
            </option>
          ))}
        </select>
      </label>
      {subs.length ? (
        <label className={estilos.etiqueta}>
          {t('sub')}
          <select name="sub" defaultValue="" className={estilos.campo}>
            <option value="">{t('sinSub')}</option>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {retrabajo ? (
        <div className="grid grid-cols-2 gap-2">
          <label className={estilos.etiqueta}>
            {t('costo')}
            <input name="costo" inputMode="decimal" placeholder="0.00" className={estilos.campo} />
          </label>
          <label className={estilos.etiqueta}>
            {t('dias')}
            <input
              name="dias"
              type="number"
              inputMode="numeric"
              min={0}
              max={365}
              placeholder="0"
              className={estilos.campo}
            />
          </label>
        </div>
      ) : null}
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {retrabajo ? t('registrarRetrabajo') : t('registrarGarantia')}
      </button>
    </form>
  );
}
