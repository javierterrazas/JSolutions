'use client';
// Emitir una orden de trabajo a un sub (D-074): por una partida, con alcance, fechas y precio cerrado. Si al sub le
// faltan papeles, lo dice y deja emitirla de todos modos.
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
  const formulario = useRef<HTMLFormElement>(null);

  const emitida = resultado?.ok && resultado.datos.ok && resultado !== visto ? resultado.datos : null;
  const papeles = resultado?.ok && !resultado.datos.ok && resultado !== visto ? resultado.datos : null;
  const enviar = (extra: string[] = []) => {
    if (!formulario.current) return;
    const todos = [...confirmado, ...extra];
    setConfirmado(todos);
    const f = new FormData(formulario.current);
    f.set('confirmado', todos.join(','));
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
            setConfirmado([]);
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
      <label className={estilos.etiqueta}>
        {t('partida')}
        <select name="partida" required defaultValue="" className={estilos.campo}>
          <option value="" disabled>
            {t('elegirPartida')}
          </option>
          {espacios.map((e) => (
            <optgroup key={e.id} label={e.nombre}>
              {e.partidas.map((p) => (
                <option key={p.id} value={p.id}>
                  {nombre(p.nombre)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
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
      <div className="grid grid-cols-2 gap-2">
        <label className={estilos.etiqueta}>
          {t('inicio')}
          <input name="inicio" type="date" required defaultValue={hoy} className={estilos.campo} />
        </label>
        <label className={estilos.etiqueta}>
          {t('fin')}
          <input name="fin" type="date" required defaultValue={hoy} className={estilos.campo} />
        </label>
      </div>
      <label className={estilos.etiqueta}>
        {t('precio')}
        <input name="precio" inputMode="decimal" required placeholder="0.00" className={estilos.campo} />
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
        <button type="submit" disabled={enviando} className={`${estilos.boton} flex-1`}>
          {t('emitir')}
        </button>
      </div>
    </form>
  );
}
