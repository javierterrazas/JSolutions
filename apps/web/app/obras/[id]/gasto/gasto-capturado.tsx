'use client';
// Un gasto que el PM ya registró: adjuntarle el recibo si no lo tiene, y corregirlo o anularlo dentro de 48 horas
// (legacy: subirRec y verCorregibles de PM.html). Nada se borra: queda el registro de qué cambió y por qué.
import type { CategoriaGasto, GastoDelPm } from '@ijm/servidor';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import { anularGasto, corregirGasto, subirRecibo } from '../../../acciones/gastos';
import { agregarAlFormulario, CampoFotos, type FotoTomada } from '../../../componentes/campo-fotos';
import { enviarSinVaciar } from '../../../componentes/enviar';
import { formatoDinero } from '@/lib/dinero';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';
import { CATEGORIAS, type DatosFormularioGasto } from './formulario-gasto';

export function GastoCapturado({
  obraId,
  gasto: g,
  espacios,
}: {
  obraId: string;
  gasto: GastoDelPm;
  espacios: DatosFormularioGasto['espacios'];
}) {
  const t = useTranslations('gasto');
  const formato = useFormatter();
  const dinero = formatoDinero(useLocale());
  const ids = { obraId, gastoId: g.id };
  const [modo, setModo] = useState<'ver' | 'corregir' | 'anular'>('ver');
  const [recibo, setRecibo] = useState<readonly FotoTomada[]>([]);
  const [rRecibo, mandarRecibo, subiendo] = useActionState(subirRecibo.bind(null, ids), null);
  const [rCorregir, mandarCorreccion, corrigiendo] = useActionState(
    async (previo: Awaited<ReturnType<typeof corregirGasto>> | null, f: FormData) => {
      const r = await corregirGasto(ids, previo, f);
      if (r.ok) setModo('ver');
      return r;
    },
    null,
  );
  const [rAnular, mandarAnulacion, anulando] = useActionState(anularGasto.bind(null, ids), null);

  return (
    <li className={`${estilos.tarjeta} flex flex-col gap-2 ${g.conRecibo ? '' : 'border-amber-300'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">
          {t('montoProveedor', {
            monto: dinero.format(g.monto),
            proveedor: g.proveedor,
          })}
        </p>
        <p className="shrink-0 text-xs text-slate-500">{g.folio}</p>
      </div>
      <p className="text-sm text-slate-600">
        {t(g.descripcion ? 'diaDescripcion' : 'dia', {
          dia: formato.dateTime(new Date(`${g.dia}T12:00:00`), {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }),
          descripcion: g.descripcion ?? '',
        })}
      </p>
      {g.enRevision ? <p className="text-sm text-amber-800">{t('pendienteRevision')}</p> : null}

      {g.conRecibo ? null : (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-amber-800">{t('faltaRecibo')}</p>
          <CampoFotos fotos={recibo} alCambiar={setRecibo} una etiqueta={t('fotoRecibo')} />
          {recibo.length ? (
            <button
              type="button"
              disabled={subiendo}
              onClick={() => {
                const f = new FormData();
                agregarAlFormulario(f, recibo);
                startTransition(() => {
                  mandarRecibo(f);
                });
              }}
              className={estilos.boton}
            >
              {t('adjuntarRecibo')}
            </button>
          ) : null}
          <MensajeError problema={rRecibo && !rRecibo.ok ? rRecibo : null} />
        </div>
      )}

      {g.corregible && modo === 'ver' ? (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setModo('corregir')}
            className="min-h-11 px-2 text-sm font-medium text-marca"
          >
            {t('corregir')}
          </button>
          <button
            type="button"
            onClick={() => setModo('anular')}
            className="min-h-11 px-2 text-sm font-medium text-red-700"
          >
            {t('anular')}
          </button>
        </div>
      ) : null}

      {modo === 'corregir' ? (
        <form onSubmit={enviarSinVaciar(mandarCorreccion)} className="flex flex-col gap-3 border-t pt-3">
          <label className={estilos.etiqueta}>
            {t('monto')}
            <input name="monto" inputMode="decimal" defaultValue={g.monto} className={estilos.campo} />
          </label>
          <label className={estilos.etiqueta}>
            {t('partida')}
            <select name="partida" defaultValue={g.partidaId ?? ''} className={estilos.campo}>
              {g.partidaId ? null : <option value="">{t('sinPartida')}</option>}
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
          <label className={estilos.etiqueta}>
            {t('categoria')}
            <select name="categoria" defaultValue={g.categoria} className={estilos.campo}>
              {CATEGORIAS.map((c: CategoriaGasto) => (
                <option key={c} value={c}>
                  {t(`categorias.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <label className={estilos.etiqueta}>
            {t('proveedor')}
            <input name="proveedor" defaultValue={g.proveedor} maxLength={120} className={estilos.campo} />
          </label>
          <label className={estilos.etiqueta}>
            {t('descripcion')}
            <input
              name="descripcion"
              defaultValue={g.descripcion ?? ''}
              maxLength={200}
              className={estilos.campo}
            />
          </label>
          <label className={estilos.etiqueta}>
            {t('motivo')}
            <input name="motivo" required className={estilos.campo} />
          </label>
          <MensajeError problema={rCorregir && !rCorregir.ok ? rCorregir : null} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModo('ver')}
              className={`${estilos.botonSecundario} flex-1`}
            >
              {t('cancelar')}
            </button>
            <button type="submit" disabled={corrigiendo} className={`${estilos.boton} flex-1`}>
              {t('guardarCorreccion')}
            </button>
          </div>
        </form>
      ) : null}

      {modo === 'anular' ? (
        <form onSubmit={enviarSinVaciar(mandarAnulacion)} className="flex flex-col gap-3 border-t pt-3">
          <p className="text-sm text-slate-700">{t('anularAyuda')}</p>
          <label className={estilos.etiqueta}>
            {t('motivo')}
            <input name="motivo" required className={estilos.campo} />
          </label>
          <MensajeError problema={rAnular && !rAnular.ok ? rAnular : null} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModo('ver')}
              className={`${estilos.botonSecundario} flex-1`}
            >
              {t('cancelar')}
            </button>
            <button type="submit" disabled={anulando} className={`${estilos.boton} flex-1 bg-red-700`}>
              {t('anularConfirmar')}
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
