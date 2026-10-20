'use client';
// "¿Quién de la cuadrilla estuvo?" en el cierre (D-104): primero la cuadrilla de esta obra (los que trabajaron en sus
// últimos cierres), "Igual que el último cierre" para llenarla de un toque, y un buscador para agregar a alguien más.
// Lo que ya lleva cada uno ese día en otras obras sigue limitando lo que se le puede poner (D-093).
import { useFormatter, useTranslations } from 'next-intl';
import { type Dispatch, type SetStateAction, useState } from 'react';
import { estilos } from '../../../componentes/marco';

export interface TrabajadorDelCierre {
  readonly id: string;
  readonly nombre: string;
  readonly puesto: string | null;
  readonly tipoPago: 'hora' | 'dia';
  /** Lo que ya lleva ese día en otras obras (D-093); una copia sin señal vieja no lo trae. */
  readonly yaLleva?: number;
  /** El último día que trabajó en esta obra (D-104); una copia sin señal vieja no lo trae. */
  readonly reciente?: string | null;
}

export interface UltimoCierre {
  readonly dia: string;
  readonly cuadrilla: readonly { trabajadorId: string; cantidad: number }[];
}

/** Sin acentos ni mayúsculas, para buscar "jose" y encontrar a José. */
const sinAcentos = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Cuánto le queda ese día sin pasar de 16 horas o de un día, con lo que ya lleva en otras obras. */
const topeDe = (w: TrabajadorDelCierre) => {
  const ya = w.yaLleva ?? 0;
  return w.tipoPago === 'hora' ? Math.max(0, 16 - ya) : Math.max(0, 1 - ya);
};

export function CuadrillaDelCierre({
  trabajadores,
  ultimoCierre,
  cuadrilla,
  setCuadrilla,
  ofrecerUltimo,
}: {
  trabajadores: readonly TrabajadorDelCierre[];
  /** undefined: una copia sin señal de antes de D-104; se muestra a todos, como antes. */
  ultimoCierre: UltimoCierre | null | undefined;
  cuadrilla: Record<string, string>;
  setCuadrilla: Dispatch<SetStateAction<Record<string, string>>>;
  /** "Igual que el último cierre": no al corregir un cierre, que ya viene con lo suyo. */
  ofrecerUltimo: boolean;
}) {
  const t = useTranslations('cierre');
  const formato = useFormatter();
  const [visibles, setVisibles] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        ultimoCierre === undefined
          ? trabajadores.map((w) => w.id)
          : trabajadores.filter((w) => w.reciente || cuadrilla[w.id]).map((w) => w.id),
      ),
  );
  const [busqueda, setBusqueda] = useState('');
  const [usado, setUsado] = useState(false);

  const porId = new Map(trabajadores.map((w) => [w.id, w]));
  const mostrar = (ids: readonly string[]) => setVisibles((v) => new Set([...v, ...ids]));
  // los de esta obra primero, el más reciente arriba; los agregados después, por nombre
  const lista = trabajadores
    .filter((w) => visibles.has(w.id))
    .sort((a, b) => (b.reciente ?? '').localeCompare(a.reciente ?? '') || a.nombre.localeCompare(b.nombre));
  const ocultos = trabajadores.filter((w) => !visibles.has(w.id));
  const q = sinAcentos(busqueda.trim());
  const encontrados = q
    ? ocultos.filter((w) => sinAcentos(`${w.nombre} ${w.puesto ?? ''}`).includes(q)).slice(0, 8)
    : [];

  const cantidadTexto = (w: TrabajadorDelCierre, n: number) =>
    w.tipoPago === 'hora' ? t('horasN', { n }) : n >= 1 ? t('diaCompleto') : t('medioDia');
  const ultimo = ultimoCierre?.cuadrilla.filter((c) => porId.has(c.trabajadorId)) ?? [];

  return (
    <fieldset className={`${estilos.tarjeta} flex flex-col gap-2`}>
      <legend className="px-1 font-semibold text-marca">{t('cuadrilla')}</legend>

      {ofrecerUltimo && ultimoCierre && ultimo.length && !usado ? (
        <button
          type="button"
          className={`${estilos.botonSecundario} flex flex-col items-start gap-0.5 py-2 text-left`}
          onClick={() => {
            setCuadrilla((c) => ({
              ...c,
              ...Object.fromEntries(
                ultimo.map(({ trabajadorId, cantidad }) => [
                  trabajadorId,
                  String(Math.min(cantidad, topeDe(porId.get(trabajadorId)!))),
                ]),
              ),
            }));
            mostrar(ultimo.map((c) => c.trabajadorId));
            setUsado(true);
          }}
        >
          <span>
            {t('igualQueUltimo', {
              dia: formato.dateTime(new Date(`${ultimoCierre.dia}T12:00:00`), {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              }),
            })}
          </span>
          <span className="text-sm font-normal text-slate-600">
            {ultimo
              .map(
                (c) =>
                  `${porId.get(c.trabajadorId)!.nombre} ${cantidadTexto(porId.get(c.trabajadorId)!, c.cantidad)}`,
              )
              .join(' · ')}
          </span>
        </button>
      ) : null}

      {lista.length === 0 ? <p className="text-sm text-slate-600">{t('sinCuadrillaObra')}</p> : null}
      {lista.map((w) => {
        const ya = w.yaLleva ?? 0;
        const tope = topeDe(w);
        const pasa = Number(cuadrilla[w.id] || 0) > tope;
        return (
          <div key={w.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">
                {w.nombre}
                {w.puesto ? <span className="block text-xs text-slate-500">{w.puesto}</span> : null}
                {ya ? (
                  <span className="block text-xs font-medium text-amber-800">
                    {w.tipoPago === 'hora'
                      ? t('yaLlevaHoras', { horas: ya, quedan: tope })
                      : ya >= 1
                        ? t('yaLlevaDia')
                        : t('yaLlevaMedioDia')}
                  </span>
                ) : null}
              </span>
              {w.tipoPago === 'hora' ? (
                <label className="flex items-center gap-2 text-sm">
                  {t('horas')}
                  <input
                    value={cuadrilla[w.id] ?? ''}
                    onChange={(e) => setCuadrilla((c) => ({ ...c, [w.id]: e.target.value }))}
                    inputMode="decimal"
                    aria-invalid={pasa}
                    className={`${estilos.campo} w-20 text-center ${pasa ? 'border-red-600' : ''}`}
                  />
                </label>
              ) : (
                <select
                  value={cuadrilla[w.id] ?? '0'}
                  onChange={(e) => setCuadrilla((c) => ({ ...c, [w.id]: e.target.value }))}
                  className={`${estilos.campo} w-36`}
                >
                  <option value="0">{t('noVino')}</option>
                  {tope >= 1 ? <option value="1">{t('diaCompleto')}</option> : null}
                  {tope >= 0.5 ? <option value="0.5">{t('medioDia')}</option> : null}
                </select>
              )}
            </div>
            {pasa && w.tipoPago === 'hora' ? (
              <p className="text-xs font-medium text-red-700">{t('pasaDe16', { quedan: tope })}</p>
            ) : null}
          </div>
        );
      })}

      {ocultos.length ? (
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-2">
          <label className={estilos.etiqueta}>
            {t('agregarTrabajador')}
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={t('buscarTrabajador')}
              autoComplete="off"
              className={estilos.campo}
            />
          </label>
          {q && encontrados.length === 0 ? (
            <p className="text-sm text-slate-600">{t('nadieConEseNombre')}</p>
          ) : null}
          {encontrados.length ? (
            <ul className="flex flex-col gap-1">
              {encontrados.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 text-left"
                    onClick={() => {
                      mostrar([w.id]);
                      setBusqueda('');
                    }}
                  >
                    <span>
                      {w.nombre}
                      {w.puesto ? <span className="block text-xs text-slate-500">{w.puesto}</span> : null}
                    </span>
                    <span className="font-semibold text-marca">{t('agregar')}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {!q ? (
            <button
              type="button"
              className="self-start text-sm font-semibold text-marca underline"
              onClick={() => mostrar(ocultos.map((w) => w.id))}
            >
              {t('verTodos', { n: ocultos.length })}
            </button>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}
