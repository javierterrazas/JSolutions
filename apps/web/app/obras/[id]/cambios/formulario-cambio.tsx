'use client';
// Emitir una orden de cambio (D-067; legacy: duCrearOC). Si el precio deja menos del margen mínimo, avisa y sugiere
// el precio que lo cumple: se puede usar el sugerido o emitirla así. El mismo formulario empieza una orden desde un
// aviso del PM, ya llenado con lo que él escribió, y corrige una orden que el cliente todavía no responde (D-103).
import type { CONDICIONES_PAGO as Condiciones, MotivoCambio } from '@ijm/servidor';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import { editarCambio, emitirCambio } from '../../../acciones/cambios';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';
import { AvisoDeLaOrden } from './aviso-de-la-orden';

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

/** El aviso del PM del que sale la orden. */
export interface AvisoParaOrden {
  readonly id: string;
  readonly folio: string;
  readonly tipo: string;
  readonly descripcion: string;
  readonly dia: string;
  readonly pm: string | null;
  readonly fotos: readonly string[];
  readonly motivo: MotivoCambio | null;
  readonly abierto: boolean;
}

/** La orden que se corrige. */
export interface OrdenParaEditar {
  readonly id: string;
  readonly folio: string;
  readonly motivo: MotivoCambio;
  readonly descripcion: string;
  readonly hallazgo: string;
  readonly costo: number;
  readonly precio: number;
  readonly dias: number;
  readonly condicion: string | null;
}

export function FormularioCambio({
  obraId,
  hoy,
  aviso,
  orden,
  alTerminar,
}: {
  obraId: string;
  hoy: string;
  aviso?: AvisoParaOrden | null;
  orden?: OrdenParaEditar;
  /** Al editar: cerrar el formulario (cancelado o guardado). */
  alTerminar?: () => void;
}) {
  const t = useTranslations('cambios');
  const [resultado, accion, enviando] = useActionState(
    orden ? editarCambio.bind(null, obraId, orden.id) : emitirCambio.bind(null, obraId),
    null,
  );
  const [precio, setPrecio] = useState(orden ? String(orden.precio) : '');
  const [vuelta, setVuelta] = useState(0);
  const [visto, setVisto] = useState<typeof resultado>(null);
  // el aviso que se contesta al emitir: al recargarse la página ya viene contestado
  const [contestado, setContestado] = useState<string | null>(null);

  const listo = resultado?.ok && resultado.datos.ok && resultado !== visto ? resultado.datos : null;
  const margenBajo = resultado?.ok && !resultado.datos.ok ? resultado.datos : null;
  const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

  const enviar = (form: HTMLFormElement, forzar: boolean) => {
    const f = new FormData(form);
    if (forzar) f.set('forzar', '1');
    if (aviso) {
      f.set('avisoId', aviso.id);
      // la base cambia {folio} por el de la orden
      if (aviso.abierto) f.set('respuestaAviso', t('respuestaAviso', { folio: '{folio}' }));
      setContestado(aviso.abierto ? aviso.folio : null);
    }
    startTransition(() => accion(f));
  };

  if (listo)
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-900">
          {orden
            ? t('editada', { folio: listo.folio })
            : contestado
              ? t('emitidaDelAviso', { folio: listo.folio, aviso: contestado })
              : t('emitida', { folio: listo.folio })}
        </p>
        {orden ? (
          <button type="button" className={estilos.botonSecundario} onClick={alTerminar}>
            {t('cerrar')}
          </button>
        ) : aviso ? (
          <Link
            href={`/obras/${obraId}/cambios`}
            className={`${estilos.botonSecundario} flex items-center justify-center`}
          >
            {t('otra')}
          </Link>
        ) : (
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
        )}
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
      <h2 className="font-semibold text-marca">
        {orden ? t('editarTitulo', { folio: orden.folio }) : t('nueva')}
      </h2>
      {orden ? <p className="text-sm text-slate-700">{t('editarAyuda')}</p> : null}
      {aviso ? (
        <>
          <AvisoDeLaOrden aviso={aviso} />
          <p className="text-sm text-slate-700">
            {aviso.abierto ? t('desdeAvisoAyuda') : t('desdeAvisoContestado')}
          </p>
        </>
      ) : null}
      <label className={estilos.etiqueta}>
        {t('motivo')}
        <select
          name="motivo"
          required
          defaultValue={orden?.motivo ?? aviso?.motivo ?? ''}
          className={estilos.campo}
        >
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
          rows={orden || aviso ? 5 : 3}
          maxLength={2000}
          defaultValue={orden?.descripcion ?? aviso?.descripcion ?? ''}
          placeholder={t('descripcionEjemplo')}
          className={`${estilos.campo} py-2`}
        />
      </label>
      <label className={estilos.etiqueta}>
        {t('hallazgo')}
        <input
          name="hallazgo"
          type="date"
          required
          max={hoy}
          defaultValue={orden?.hallazgo ?? aviso?.dia ?? hoy}
          className={estilos.campo}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={estilos.etiqueta}>
          {t('costo')}
          <input
            name="costo"
            inputMode="decimal"
            required
            placeholder="0.00"
            defaultValue={orden ? String(orden.costo) : undefined}
            className={estilos.campo}
          />
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
          <input
            name="dias"
            inputMode="numeric"
            defaultValue={String(orden?.dias ?? 0)}
            className={estilos.campo}
          />
        </label>
        <label className={estilos.etiqueta}>
          {t('condicion')}
          <select
            name="condicion"
            defaultValue={orden?.condicion ?? 'al_autorizar'}
            className={estilos.campo}
          >
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
              {orden ? t('guardarAsi') : t('emitirAsi')}
            </button>
          </div>
        </div>
      ) : null}
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      {orden ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={estilos.botonSecundario} onClick={alTerminar}>
            {t('cancelar')}
          </button>
          <button type="submit" disabled={enviando} className={estilos.boton}>
            {enviando ? t('guardando') : t('guardar')}
          </button>
        </div>
      ) : (
        <button type="submit" disabled={enviando} className={estilos.boton}>
          {enviando ? t('emitiendo') : t('emitir')}
        </button>
      )}
    </form>
  );
}

/** "Editar" en una orden que el cliente todavía no responde: abre el formulario con lo que tiene. */
export function EditarCambio({
  obraId,
  hoy,
  orden,
}: {
  obraId: string;
  hoy: string;
  orden: OrdenParaEditar;
}) {
  const t = useTranslations('cambios');
  const [abierto, setAbierto] = useState(false);
  if (!abierto)
    return (
      <button type="button" className={estilos.botonSecundario} onClick={() => setAbierto(true)}>
        {t('editar')}
      </button>
    );
  return <FormularioCambio obraId={obraId} hoy={hoy} orden={orden} alTerminar={() => setAbierto(false)} />;
}
