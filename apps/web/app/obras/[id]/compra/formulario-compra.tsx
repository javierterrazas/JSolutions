'use client';
// El formulario de una compra de la oficina: monto, día, partida (opcional: sin ella va a Generales de obra),
// categoría, proveedor, qué se compró, cómo se pagó y la foto del recibo (opcional).
import type { MetodoPago } from '@ijm/servidor';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { startTransition, useActionState, useState } from 'react';
import { registrarCompra } from '../../../acciones/compras';
import { agregarAlFormulario, CampoFotos, type FotoTomada } from '../../../componentes/campo-fotos';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';
import { CATEGORIAS } from '../gasto/formulario-gasto';

/** Cómo pagó la oficina, en el orden en que más se usa. */
const METODOS: readonly MetodoPago[] = [
  'transferencia',
  'tarjeta',
  'cheque',
  'zelle',
  'efectivo',
  'tarjeta_empresa',
];

export function FormularioCompra({
  obraId,
  hoy,
  espacios,
}: {
  obraId: string;
  hoy: string;
  espacios: readonly { id: string; nombre: string; partidas: readonly { id: string; nombre: string }[] }[];
}) {
  const t = useTranslations('compra');
  const tg = useTranslations('gasto');
  const [recibo, setRecibo] = useState<readonly FotoTomada[]>([]);
  // otra compra: el formulario vuelve vacío y deja de mostrar la que ya se registró
  const [vuelta, setVuelta] = useState(0);
  const [resultado, accion, enviando] = useActionState(registrarCompra.bind(null, obraId), null);
  const [vista, setVista] = useState<typeof resultado>(null);

  if (resultado?.ok && resultado !== vista)
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="rounded-2xl bg-emerald-50 p-4 text-lg font-semibold text-emerald-900">
          {t('registrada', { folio: resultado.datos.folio })}
        </p>
        <button
          type="button"
          onClick={() => {
            setRecibo([]);
            setVista(resultado);
            setVuelta((v) => v + 1);
          }}
          className={estilos.boton}
        >
          {t('otra')}
        </button>
        <Link
          href={`/obras/${obraId}/seguimiento`}
          className={`${estilos.botonSecundario} flex items-center justify-center`}
        >
          {t('volver')}
        </Link>
      </div>
    );

  return (
    <form
      key={vuelta}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        agregarAlFormulario(f, recibo);
        startTransition(() => accion(f));
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-2">
        <label className={estilos.etiqueta}>
          {tg('monto')}
          <input
            name="monto"
            inputMode="decimal"
            required
            placeholder="0.00"
            autoComplete="off"
            className={estilos.campo}
          />
        </label>
        <label className={estilos.etiqueta}>
          {t('dia')}
          <input name="dia" type="date" required max={hoy} defaultValue={hoy} className={estilos.campo} />
        </label>
      </div>
      <label className={estilos.etiqueta}>
        {tg('partida')}
        <select name="partidaId" defaultValue="" className={estilos.campo}>
          <option value="">{tg('sinPartida')}</option>
          {espacios.map((e) => (
            <optgroup key={e.id} label={e.nombre}>
              {e.partidas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={estilos.etiqueta}>
          {tg('categoria')}
          <select name="categoria" defaultValue="material" className={estilos.campo}>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {tg(`categorias.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={estilos.etiqueta}>
          {t('metodo')}
          <select name="metodoPago" defaultValue="transferencia" className={estilos.campo}>
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {t(`metodos.${m}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={estilos.etiqueta}>
        {tg('proveedor')}
        <input
          name="proveedor"
          required
          maxLength={200}
          placeholder={tg('proveedorEjemplo')}
          autoComplete="off"
          className={estilos.campo}
        />
      </label>
      <label className={estilos.etiqueta}>
        {tg('descripcion')}
        <input
          name="descripcion"
          required
          maxLength={2000}
          placeholder={tg('descripcionEjemplo')}
          autoComplete="off"
          className={estilos.campo}
        />
      </label>
      <fieldset className={`${estilos.tarjeta} flex flex-col gap-3`}>
        <legend className="px-1 font-semibold text-marca">{t('recibo')}</legend>
        <CampoFotos fotos={recibo} alCambiar={setRecibo} una etiqueta={tg('fotoRecibo')} />
      </fieldset>
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {enviando ? t('registrando') : t('registrar')}
      </button>
    </form>
  );
}
