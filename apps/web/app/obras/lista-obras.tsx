'use client';
// La lista de obras con sus filtros (D-100; lo pidió el dueño): por estado (en curso, entregadas, todas), un buscador
// (folio, cliente o dirección), el periodo (en curso, por su inicio; entregadas, por su entrega) y el PM. Los filtros
// van en la dirección (?estado=…&q=…&periodo=…&pm=…): al abrir una obra y regresar, la lista sigue igual. En curso,
// primero las atrasadas y luego las que se entregan antes; entregadas, la más reciente primero.
import { sumarDias } from '@ijm/core';
import type { ObraDeLaLista, ResumenDeObra, Semaforo } from '@ijm/servidor';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { estilos } from '../componentes/marco';

const COLOR: Record<Semaforo, string> = {
  verde: 'text-emerald-700',
  amarillo: 'text-amber-700',
  rojo: 'text-red-700',
};
const ESTADOS = ['curso', 'entregadas', 'todas'] as const;
const PERIODOS = ['mes', 'trimestre', 'anio', 'todo'] as const;
type Estado = (typeof ESTADOS)[number];

export interface ObraConResumen extends ObraDeLaLista {
  readonly resumen: ResumenDeObra | null;
}

const elegido = <T extends string>(valor: string | null, opciones: readonly T[], porOmision: T): T =>
  (opciones as readonly string[]).includes(valor ?? '') ? (valor as T) : porOmision;
const comparable = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function ListaObras({ obras, hoy }: { obras: readonly ObraConResumen[]; hoy: string }) {
  const t = useTranslations('obras');
  const formato = useFormatter();
  const ruta = usePathname();
  const params = useSearchParams();
  // los filtros viven aquí y se copian a la dirección de una vez (sin recargar): escribir rápido no pisa un cambio
  const [filtros, setFiltros] = useState(() => ({
    estado: elegido(params.get('estado'), ESTADOS, 'curso'),
    periodo: elegido(params.get('periodo'), PERIODOS, 'todo'),
    pm: params.get('pm') ?? '',
    q: params.get('q') ?? '',
  }));
  const { estado, periodo, pm, q } = filtros;
  useEffect(() => {
    const p = new URLSearchParams();
    if (estado !== 'curso') p.set('estado', estado);
    if (q.trim()) p.set('q', q.trim());
    if (periodo !== 'todo') p.set('periodo', periodo);
    if (pm) p.set('pm', pm);
    window.history.replaceState(null, '', `${ruta}${p.size ? `?${p}` : ''}`);
  }, [estado, periodo, pm, q, ruta]);
  const cambiar = (cambio: Partial<typeof filtros>) => setFiltros((f) => ({ ...f, ...cambio }));

  const entregada = (o: ObraConResumen) => o.estado === 'entregada';
  const enEstado = (o: ObraConResumen) =>
    estado === 'todas' || (estado === 'entregadas' ? entregada(o) : !entregada(o));
  const desde =
    periodo === 'mes'
      ? `${hoy.slice(0, 7)}-01`
      : periodo === 'trimestre'
        ? sumarDias(hoy, -91)
        : periodo === 'anio'
          ? `${hoy.slice(0, 4)}-01-01`
          : null;
  const fechaDe = (o: ObraConResumen) => (entregada(o) ? (o.entregada ?? o.inicio) : o.inicio);
  const busqueda = comparable(q.trim());
  const pms = [...new Map(obras.map((o) => [o.pmId, o.pm])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );
  const cuantas = (e: Estado) =>
    obras.filter((o) => e === 'todas' || (e === 'entregadas' ? entregada(o) : !entregada(o))).length;

  const lista = obras
    .filter(enEstado)
    .filter((o) => !desde || fechaDe(o) >= desde)
    .filter((o) => !pm || o.pmId === pm)
    .filter((o) => !busqueda || comparable(`${o.folio} ${o.cliente} ${o.direccion}`).includes(busqueda))
    .sort((a, b) => {
      // en curso primero; luego, las atrasadas y las que se entregan antes; entregadas, la más reciente primero
      if (entregada(a) !== entregada(b)) return entregada(a) ? 1 : -1;
      if (entregada(a)) return fechaDe(b).localeCompare(fechaDe(a));
      const atraso = (b.resumen?.atraso ?? 0) - (a.resumen?.atraso ?? 0);
      if (atraso) return atraso;
      return (a.resumen?.entrega ?? '9999').localeCompare(b.resumen?.entrega ?? '9999');
    });

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  // el día de negocio a mediodía, para que ninguna zona lo mueva de día
  const dia = (d: string) => formato.dateTime(new Date(`${d}T12:00:00`), { dateStyle: 'medium' });
  const boton = (activo: boolean) =>
    `min-h-11 shrink-0 rounded-full border px-3 text-sm font-semibold ${activo ? 'border-marca bg-marca text-white' : 'border-slate-300 bg-white text-slate-700'}`;

  return (
    // en la computadora, los filtros en una columna al costado y las obras en dos columnas (D-109); en el teléfono
    // los contenedores no cuentan y todo va uno debajo del otro, como siempre
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      <div className="contents lg:flex lg:flex-col lg:gap-3">
        <div role="tablist" aria-label={t('filtroEstado')} className="grid grid-cols-3 gap-1">
          {ESTADOS.map((e) => (
            <button
              key={e}
              type="button"
              role="tab"
              aria-selected={estado === e}
              onClick={() => cambiar({ estado: e })}
              className={`${boton(estado === e)} rounded-xl px-1`}
            >
              {t(`filtros.${e}`, { n: cuantas(e) })}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => cambiar({ q: e.target.value })}
          placeholder={t('buscar')}
          aria-label={t('buscar')}
          className={estilos.campo}
        />
        <div className={`grid gap-2 ${pms.length > 1 ? 'grid-cols-2 lg:grid-cols-1' : 'grid-cols-1'}`}>
          <select
            value={periodo}
            onChange={(e) => cambiar({ periodo: e.target.value as (typeof PERIODOS)[number] })}
            aria-label={t('filtroPeriodo')}
            className={estilos.campo}
          >
            {PERIODOS.map((p) => (
              <option key={p} value={p}>
                {t(`periodos.${p}`)}
              </option>
            ))}
          </select>
          {pms.length > 1 ? (
            <select
              value={pm}
              onChange={(e) => cambiar({ pm: e.target.value })}
              aria-label={t('filtroPm')}
              className={estilos.campo}
            >
              <option value="">{t('todosLosPm')}</option>
              {pms.map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {obras.length === 0 ? (
        <p className="text-slate-600">{t('ninguna')}</p>
      ) : lista.length === 0 ? (
        <p className="text-slate-600">{t('ningunaConFiltros')}</p>
      ) : (
        <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
          {lista.map((o) => {
            const x = o.resumen;
            return (
              <li key={o.id}>
                <Link
                  href={`/obras/${o.id}/seguimiento`}
                  className={`${estilos.tarjeta} flex flex-col gap-1`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      {t('encabezado', { folio: o.folio, cliente: o.cliente })}
                    </span>
                    <span className="text-sm text-slate-600">{t(`estado.${o.estado}`)}</span>
                  </span>
                  <span className="text-sm text-slate-600">{o.direccion}</span>
                  <span className="text-sm text-slate-600">
                    {t('pm', { nombre: o.pm, fecha: dia(o.inicio) })}
                    {x ? t('entrega', { fecha: dia(x.entrega) }) : null}
                    {o.entregada ? t('entregadaEl', { fecha: dia(o.entregada) }) : null}
                  </span>
                  {x ? (
                    <span className="flex flex-wrap gap-x-3 text-sm font-medium">
                      <span className={x.semaforo ? COLOR[x.semaforo] : 'text-slate-700'}>
                        {x.usado === null
                          ? t('resumenSinPresupuesto', { avance: pct(x.avance) })
                          : t('resumen', { avance: pct(x.avance), usado: pct(x.usado) })}
                      </span>
                      {x.atraso ? <span className="text-red-700">{t('tarde', { n: x.atraso })}</span> : null}
                    </span>
                  ) : null}
                </Link>
                <Link
                  href={`/obras/${o.id}/album`}
                  className="mt-1 inline-block px-1 text-sm font-medium text-marca underline"
                >
                  {t('album')}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
