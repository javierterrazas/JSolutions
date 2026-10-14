// Los indicadores de la empresa, para el dueño (D-075; legacy: el tablero de kpis_): arriba los seis del lunes, lo
// primero que hay que ver; abajo los 19 por proceso, cada uno con su valor, su meta, su semáforo y qué revela. Lleva
// dinero: solo el dueño o el administrador.
import type { Indicador } from '@ijm/core';
import {
  congelarPlanSemanal,
  type CumplimientoDelPlan,
  cumplimientoDelPlan,
  indicadoresDeLaEmpresa,
} from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { Marco, estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';

const COLOR: Record<Indicador['semaforo'], { borde: string; punto: string; texto: string }> = {
  verde: { borde: 'border-emerald-300', punto: 'bg-emerald-600', texto: 'text-emerald-800' },
  ambar: { borde: 'border-amber-300', punto: 'bg-amber-500', texto: 'text-amber-800' },
  rojo: { borde: 'border-red-300', punto: 'bg-red-600', texto: 'text-red-800' },
  info: { borde: 'border-slate-200', punto: 'bg-slate-400', texto: 'text-slate-800' },
};
const PROCESOS = ['P3', 'P4', 'P5', 'P6'] as const;

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-marca">{titulo}</h2>
      {children}
    </section>
  );
}

export default async function Indicadores() {
  const acceso = await exigirDueno();
  // el plan de esta semana se congela al abrir, si nadie lo ha hecho (D-079)
  const plan = await comoMiembro(async (tx) => {
    await congelarPlanSemanal(tx);
    return cumplimientoDelPlan(tx);
  }, acceso);
  const r = await comoMiembro((tx) => indicadoresDeLaEmpresa(tx), acceso);
  const [t, idioma, formato] = await Promise.all([
    getTranslations('indicadores'),
    getLocale(),
    getFormatter(),
  ]);
  // un día de negocio a mediodía, para que ninguna zona horaria lo mueva de día
  const dia = (d: string) =>
    formato.dateTime(new Date(`${d}T12:00:00`), { weekday: 'short', day: 'numeric', month: 'short' });
  const dinero = formatoDinero(idioma);
  const numero = (n: number, decimales = 0) =>
    new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-MX', {
      maximumFractionDigits: decimales,
      minimumFractionDigits: decimales,
    }).format(n);
  const valor = (i: Indicador, x: number) =>
    i.formato === 'pct'
      ? `${numero(x * 100)}%`
      : i.formato === 'dinero'
        ? dinero.format(x)
        : i.formato === 'num1'
          ? numero(x, 1)
          : numero(x);
  const meta = (i: Indicador) =>
    i.direccion === 'info'
      ? null
      : t(i.direccion === 'mayor' ? 'metaMayor' : 'metaMenor', { meta: valor(i, i.meta) });
  const nombre = (i: Indicador) =>
    t(
      `nombres.${i.clave}` as never,
      {
        horas: numero(i.datos?.slaHoras ?? i.datos?.horas ?? 0),
      } as never,
    );
  const extra = (i: Indicador) => {
    if (!i.datos) return null;
    if (i.clave === 'garantias_por_obra' && i.datos.costo)
      return t('extraGarantias', { costo: dinero.format(i.datos.costo) });
    if (i.clave === 'no_calidad_sobre_contratos' && i.datos.diasPerdidos)
      return t('extraDias', { n: i.datos.diasPerdidos });
    return null;
  };

  if (!r.ok)
    return (
      <Marco titulo={t('titulo')} volver={{ href: '/', texto: t('volver') }}>
        <MensajeError problema={r} />
      </Marco>
    );
  const d = r.datos;
  const principales = d.indicadores.filter((i) => i.principal);

  return (
    <Marco titulo={t('titulo')} volver={{ href: '/', texto: t('volver') }}>
      <p className="text-sm text-slate-700">
        {t('contexto', { enCurso: d.obrasEnCurso, entregadas: d.obrasEntregadas })}
      </p>

      <Seccion titulo={t('principales')}>
        <ul className="grid grid-cols-2 gap-2">
          {principales.map((i) => (
            <li
              key={i.clave}
              className={`flex flex-col gap-1 rounded-2xl border-2 bg-white p-3 ${COLOR[i.semaforo].borde}`}
            >
              <span className="text-sm leading-tight text-slate-700">{nombre(i)}</span>
              <span className={`text-2xl font-bold ${COLOR[i.semaforo].texto}`}>
                {i.sinDatos ? '—' : valor(i, i.valor)}
              </span>
              {meta(i) ? <span className="text-xs text-slate-600">{meta(i)}</span> : null}
            </li>
          ))}
        </ul>
      </Seccion>

      {PROCESOS.map((p) => (
        <Seccion key={p} titulo={t(`procesos.${p}`)}>
          <ul className="flex flex-col gap-2">
            {d.indicadores
              .filter((i) => i.proceso === p)
              .map((i) => (
                <li key={i.clave} className={`${estilos.tarjeta} flex flex-col gap-1`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex items-start gap-2 font-semibold">
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 size-3 shrink-0 rounded-full ${COLOR[i.semaforo].punto}`}
                      />
                      {nombre(i)}
                    </span>
                    <span className={`shrink-0 text-lg font-bold ${COLOR[i.semaforo].texto}`}>
                      {i.sinDatos ? t('sinDatos') : valor(i, i.valor)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{t(`explicaciones.${i.clave}` as never)}</p>
                  <p className="flex flex-wrap gap-x-3 text-xs text-slate-600">
                    {meta(i) ? <span>{meta(i)}</span> : null}
                    <span>{t(`semaforos.${i.semaforo}`)}</span>
                    {extra(i) ? <span>{extra(i)}</span> : null}
                  </p>
                  {i.clave === 'cumplimiento_semanal' && plan.ok ? (
                    <DetalleDelPlan plan={plan.datos} dia={dia} idioma={idioma} t={t} />
                  ) : null}
                </li>
              ))}
          </ul>
        </Seccion>
      ))}
    </Marco>
  );
}

/** Lo que se prometió la semana pasada, por obra, y si se terminó a tiempo (D-079). */
function DetalleDelPlan({
  plan,
  dia,
  idioma,
  t,
}: {
  plan: CumplimientoDelPlan;
  dia: (d: string) => string;
  idioma: string;
  t: Awaited<ReturnType<typeof getTranslations<'indicadores'>>>;
}) {
  const hechas = plan.partidas.filter((p) => p.cumplida).length;
  const obras = [...new Set(plan.partidas.map((p) => p.folio))];
  return (
    <div className="flex flex-col gap-2 border-t border-slate-200 pt-2 text-sm">
      <p className="text-slate-700">{t('plan.estaSemana', { n: plan.estaSemana })}</p>
      {plan.partidas.length ? (
        <details>
          <summary className="cursor-pointer py-1 font-semibold text-marca">
            {t('plan.ver', { hechas, total: plan.partidas.length })}
          </summary>
          <p className="mt-1 text-slate-600">
            {t('plan.semana', { lunes: dia(plan.lunes), domingo: dia(plan.domingo) })}
          </p>
          {obras.map((folio) => (
            <div key={folio} className="mt-2 flex flex-col gap-1">
              <h3 className="font-semibold">{folio}</h3>
              <ul className="flex flex-col gap-1">
                {plan.partidas
                  .filter((p) => p.folio === folio)
                  .map((p, n) => (
                    <li key={n} className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className={`font-bold ${p.cumplida ? 'text-emerald-700' : 'text-red-700'}`}
                      >
                        {p.cumplida ? '✓' : '✗'}
                      </span>
                      <span className="flex flex-col">
                        <span>
                          {t('plan.linea', {
                            espacio: p.espacio,
                            partida: (idioma === 'en' && p.partida.en) || p.partida.es,
                          })}
                        </span>
                        <span className="text-xs text-slate-600">
                          {t('plan.detalle', {
                            prevista: t('plan.prevista', { dia: dia(p.finPrevisto) }),
                            resultado: p.terminadaEl
                              ? t(p.cumplida ? 'plan.terminada' : 'plan.tarde', { dia: dia(p.terminadaEl) })
                              : t('plan.pendiente'),
                          })}
                        </span>
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </details>
      ) : (
        <p className="text-slate-600">{t('plan.sinPlan')}</p>
      )}
    </div>
  );
}
