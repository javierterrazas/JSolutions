'use client';
// Agregar una partida a un tipo de obra, o editarla (legacy: duGuardarPartida): su orden, cuántos días lleva, quién
// la hace, su etapa del presupuesto, su punto de control, si va junto con la anterior, la espera y su peso.
import type { PartidaDelCatalogo } from '@ijm/servidor';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { guardarPartida } from '../../acciones/catalogo';
import { estilos } from '../../componentes/marco';
import { enviarSinVaciar } from '../../componentes/enviar';
import { MensajeError } from '../../componentes/mensaje-error';

type Opcion = { id: string; nombre: string };
export interface Opciones {
  readonly etapas: readonly Opcion[];
  readonly hitos: readonly Opcion[];
  readonly oficios: readonly Opcion[];
}

const RESPONSABLES = ['cuadrilla', 'pm', 'subcontratista'] as const;

/**
 * Sin `partida`, es el botón "Agregar partida" que se abre en el formulario y se cierra al guardar. Con `partida`,
 * es el formulario de edición, abierto; `alCerrar` lo cierra al guardar o al cancelar.
 */
export function FormularioPartida({
  tipoId,
  partida,
  opciones,
  siguiente,
  alCerrar,
}: {
  tipoId: string;
  partida: PartidaDelCatalogo | null;
  opciones: Opciones;
  siguiente?: number;
  alCerrar?: () => void;
}) {
  const t = useTranslations('catalogo');
  const [abierto, setAbierto] = useState(partida !== null);
  const [responsable, setResponsable] = useState(partida?.responsable ?? 'cuadrilla');
  const cerrar = () => {
    if (alCerrar) alCerrar();
    else setAbierto(false);
  };
  const [resultado, accion, enviando] = useActionState(
    async (previo: Awaited<ReturnType<typeof guardarPartida>> | null, formulario: FormData) => {
      const r = await guardarPartida(tipoId, partida?.id ?? null, previo, formulario);
      if (r.ok) cerrar();
      return r;
    },
    null,
  );
  if (!abierto)
    return (
      <button
        type="button"
        onClick={() => {
          setAbierto(true);
        }}
        className={estilos.botonSecundario}
      >
        {t('agregarPartida')}
      </button>
    );
  const numeroCorto = `${estilos.campo} text-center`;
  return (
    <form onSubmit={enviarSinVaciar(accion)} className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <p className="font-semibold text-marca">{partida ? t('editarPartida') : t('agregarPartida')}</p>
      <label className={estilos.etiqueta}>
        {t('nombrePartida')}
        <input
          name="nombre"
          required
          maxLength={120}
          defaultValue={partida?.nombre.es ?? ''}
          className={estilos.campo}
        />
      </label>
      <label className={estilos.etiqueta}>
        {t('nombreEn')}
        <input
          name="nombreEn"
          maxLength={120}
          defaultValue={partida?.nombre.en ?? ''}
          className={estilos.campo}
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className={estilos.etiqueta}>
          {t('orden')}
          <input
            name="orden"
            inputMode="numeric"
            defaultValue={partida?.orden ?? siguiente ?? ''}
            className={numeroCorto}
          />
        </label>
        <label className={estilos.etiqueta}>
          {t('diasCampo')}
          <input name="dias" inputMode="numeric" defaultValue={partida?.dias ?? 1} className={numeroCorto} />
        </label>
        <label className={estilos.etiqueta}>
          {t('pesoCampo')}
          <input name="peso" inputMode="decimal" defaultValue={partida?.peso ?? 1} className={numeroCorto} />
        </label>
      </div>
      <label className={estilos.etiqueta}>
        {t('quien')}
        <select
          name="responsable"
          value={responsable}
          onChange={(e) => {
            setResponsable(e.target.value as typeof responsable);
          }}
          className={estilos.campo}
        >
          {RESPONSABLES.map((r) => (
            <option key={r} value={r}>
              {t(`responsable.${r}`)}
            </option>
          ))}
        </select>
      </label>
      {responsable === 'subcontratista' ? (
        <label className={estilos.etiqueta}>
          {t('oficio')}
          <select name="oficio" defaultValue={partida?.oficioId ?? ''} className={estilos.campo}>
            <option value="">{t('elegirOficio')}</option>
            {opciones.oficios.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className={estilos.etiqueta}>
        {t('etapa')}
        <select name="etapa" defaultValue={partida?.etapaId ?? ''} className={estilos.campo}>
          <option value="">{t('sinEtapa')}</option>
          {opciones.etapas.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={estilos.etiqueta}>
        {t('hito')}
        <select name="hito" defaultValue={partida?.hitoId ?? ''} className={estilos.campo}>
          <option value="">{t('sinHito')}</option>
          {opciones.hitos.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          name="paralelo"
          value="si"
          defaultChecked={partida?.paralelo ?? false}
          className="size-5"
        />
        {t('paraleloCampo')}
      </label>
      <label className={estilos.etiqueta}>
        {t('esperaCampo')}
        <input
          name="espera"
          inputMode="numeric"
          defaultValue={partida?.espera ?? 0}
          className={estilos.campo}
        />
        <span className="text-xs font-normal text-slate-500">{t('esperaAyuda')}</span>
      </label>
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <div className="flex gap-2">
        <button type="button" onClick={cerrar} className={`${estilos.botonSecundario} flex-1`}>
          {t('cancelar')}
        </button>
        <button type="submit" disabled={enviando} className={`${estilos.boton} flex-1`}>
          {t('guardar')}
        </button>
      </div>
    </form>
  );
}
