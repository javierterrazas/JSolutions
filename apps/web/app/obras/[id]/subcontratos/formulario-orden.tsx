'use client';
// Emitir órdenes de trabajo a un sub (D-074; varias de una vez, D-091): se eligen sus partidas, cada una con sus fechas
// y su precio cerrado, con un mismo alcance. Si al sub le faltan papeles, lo dice y deja emitirlas de todos modos.
import type { Nombre, SubcontratosDeObra } from '@ijm/servidor';
import { useLocale, useTranslations } from 'next-intl';
import { startTransition, useActionState, useRef, useState } from 'react';
import { emitirOrden } from '../../../acciones/subcontratos';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';
import { AvisosPapeles } from '../../../subcontratistas/avisos-papeles';

export function FormularioOrden({
  obraId,
  hoy,
  subs,
  espacios,
}: {
  obraId: string;
  hoy: string;
  subs: SubcontratosDeObra['subs'];
  espacios: SubcontratosDeObra['espacios'];
}) {
  const t = useTranslations('subcontratos');
  const idioma = useLocale();
  const nombre = (n: Nombre) => (idioma === 'en' ? n.en : null) ?? n.es;
  const [resultado, accion, enviando] = useActionState(emitirOrden.bind(null, obraId), null);
  const [abierto, setAbierto] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const [visto, setVisto] = useState<typeof resultado>(null);
  const [confirmado, setConfirmado] = useState<string[]>([]);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const formulario = useRef<HTMLFormElement>(null);

  const emitidas =
    resultado?.ok && resultado.datos.ok && resultado !== visto ? resultado.datos.ordenes : null;
  const papeles = resultado?.ok && !resultado.datos.ok && resultado !== visto ? resultado.datos : null;
  const enviar = (extra: string[] = []) => {
    if (!formulario.current) return;
    const todos = [...confirmado, ...extra];
    setConfirmado(todos);
    const f = new FormData(formulario.current);
    f.set('confirmado', todos.join(','));
    startTransition(() => accion(f));
  };
  const elegir = (id: string, si: boolean) =>
    setElegidas((xs) => (si ? [...xs, id] : xs.filter((x) => x !== id)));

  if (emitidas)
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-900">
          {t('emitidas', { n: emitidas.length, folios: emitidas.map((o) => o.folio).join(', ') })}
        </p>
        <button
          type="button"
          className={estilos.botonSecundario}
          onClick={() => {
            setVisto(resultado);
            setConfirmado([]);
            setElegidas([]);
            setVuelta((v) => v + 1);
          }}
        >
          {t('otra')}
        </button>
      </div>
    );

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className={estilos.boton}>
        {t('nueva')}
      </button>
    );

  const campo = 'flex flex-col gap-1 text-sm font-medium text-slate-800';
  return (
    <form
      key={vuelta}
      ref={formulario}
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
      className={`${estilos.tarjeta} flex flex-col gap-3`}
    >
      <h2 className="font-semibold text-marca">{t('nueva')}</h2>
      {subs.length === 0 ? <p className="text-sm text-amber-900">{t('sinSubs')}</p> : null}
      <label className={estilos.etiqueta}>
        {t('sub')}
        <select
          name="sub"
          required
          defaultValue=""
          className={estilos.campo}
          onChange={() => setConfirmado([])}
        >
          <option value="" disabled>
            {t('elegirSub')}
          </option>
          {subs.map((s) => (
            <option key={s.id} value={s.id}>
              {t('subOficio', { sub: s.nombre, oficio: nombre(s.oficio) })}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-base font-medium text-slate-800">{t('partidas')}</legend>
        <p className="text-sm text-slate-600">{t('partidasAyuda')}</p>
        {espacios.map((e) => (
          <div key={e.id} className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-slate-700">{e.nombre}</p>
            {e.partidas.map((p) => {
              const si = elegidas.includes(p.id);
              return (
                <div
                  key={p.id}
                  role="group"
                  aria-label={nombre(p.nombre)}
                  className={si ? 'rounded-xl border border-marca/40 bg-marca/5 p-2' : ''}
                >
                  <label className="flex min-h-11 items-center gap-3">
                    <input
                      type="checkbox"
                      name="partida"
                      value={p.id}
                      checked={si}
                      onChange={(x) => elegir(p.id, x.target.checked)}
                      className="size-5 accent-marca"
                    />
                    {nombre(p.nombre)}
                  </label>
                  {si ? (
                    <div className="grid grid-cols-2 gap-2">
                      <label className={campo}>
                        {t('inicio')}
                        <input
                          name={`inicio-${p.id}`}
                          type="date"
                          required
                          defaultValue={hoy}
                          className={estilos.campo}
                        />
                      </label>
                      <label className={campo}>
                        {t('fin')}
                        <input
                          name={`fin-${p.id}`}
                          type="date"
                          required
                          defaultValue={hoy}
                          className={estilos.campo}
                        />
                      </label>
                      <label className={`${campo} col-span-2`}>
                        {t('precio')}
                        <input
                          name={`precio-${p.id}`}
                          inputMode="decimal"
                          required
                          placeholder="0.00"
                          className={estilos.campo}
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </fieldset>
      <label className={estilos.etiqueta}>
        {t('alcance')}
        <textarea
          name="alcance"
          required
          rows={2}
          maxLength={2000}
          placeholder={t('alcanceEjemplo')}
          className={`${estilos.campo} py-2`}
        />
      </label>
      {papeles ? (
        <div role="alert" className="flex flex-col gap-2 rounded-xl bg-amber-50 p-3 text-amber-900">
          <p className="font-semibold">{t('papelesConfirmar')}</p>
          <AvisosPapeles avisos={papeles.avisos} />
          <button
            type="button"
            disabled={enviando}
            onClick={() => enviar(['papeles'])}
            className="min-h-12 rounded-xl bg-amber-800 px-4 font-semibold text-white disabled:opacity-50"
          >
            {t('emitirAsi')}
          </button>
        </div>
      ) : null}
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className={`${estilos.botonSecundario} flex-1`}
        >
          {t('cancelar')}
        </button>
        <button type="submit" disabled={enviando || !elegidas.length} className={`${estilos.boton} flex-1`}>
          {elegidas.length > 1 ? t('emitirVarias', { n: elegidas.length }) : t('emitir')}
        </button>
      </div>
    </form>
  );
}
