'use client';
// El logo, el color y el fondo del ícono de la empresa (D-078), con la vista previa del ícono como se verá en el
// teléfono.
import type { MarcaDeEmpresa } from '@ijm/servidor';
import { useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import { guardarMarcaEmpresa } from '../acciones/marca';
import { estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';

export function FormularioMarca({ marca }: { marca: MarcaDeEmpresa }) {
  const t = useTranslations('miEmpresa');
  const [resultado, accion, enviando] = useActionState(guardarMarcaEmpresa, null);
  const [color, setColor] = useState(marca.color);
  const version = resultado?.ok ? resultado.datos.version : marca.version;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        startTransition(() => accion(f));
      }}
      className="flex flex-col gap-4"
    >
      <div className={`${estilos.tarjeta} flex items-center gap-4`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- el ícono lo genera la app */}
        <img
          src={`/marca/${marca.empresaId}/icono/192?v=${version}`}
          alt={t('vistaPrevia')}
          className="size-20 rounded-2xl shadow"
        />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{marca.nombre}</p>
          <p className="text-sm text-slate-700">{t('vistaPreviaAyuda')}</p>
        </div>
      </div>

      <label className={estilos.etiqueta}>
        {t('logo')}
        <input
          name="logo"
          type="file"
          accept="image/png,image/jpeg"
          className="text-base file:mr-3 file:min-h-11 file:rounded-xl file:border-2 file:border-marca/30 file:bg-white file:px-4 file:font-semibold file:text-marca"
        />
        <span className="text-sm font-normal text-slate-600">{t('logoAyuda')}</span>
      </label>
      {marca.conLogo ? (
        <label className="flex min-h-11 items-center gap-3 text-base text-slate-800">
          <input name="quitarLogo" type="checkbox" className="size-6" />
          {t('quitarLogo')}
        </label>
      ) : null}

      <label className={estilos.etiqueta}>
        {t('color')}
        <span className="flex items-center gap-3">
          <input
            name="color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-12 w-20 cursor-pointer rounded-xl border border-slate-400 bg-white"
          />
          <span className="font-mono text-sm text-slate-700">{color}</span>
        </span>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-base font-medium text-slate-800">{t('fondo')}</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input
            name="fondo"
            type="radio"
            value="blanco"
            defaultChecked={marca.fondoBlanco}
            className="size-5"
          />
          {t('fondoBlanco')}
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input
            name="fondo"
            type="radio"
            value="color"
            defaultChecked={!marca.fondoBlanco}
            className="size-5"
          />
          {t('fondoColor')}
        </label>
      </fieldset>

      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      {resultado?.ok ? (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-900">
          {t('guardado')}
        </p>
      ) : null}
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {enviando ? t('guardando') : t('guardar')}
      </button>
      <p className="text-sm text-slate-700">{t('instalarAyuda')}</p>
    </form>
  );
}
