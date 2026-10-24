// El desempeño de un manager, para el dueño (D-106): sus números en cuatro grupos (disciplina, plazos, dinero y
// calidad) en los últimos 30, 90 o 365 días, cada uno con su meta y el de toda la empresa al lado, y sus obras. Con
// pocos datos el número se muestra sin semáforo.
import { GRUPOS_PM, type MetricaDeDesempeno, type MetricaPM, type Semaforo } from '@ijm/core';
import { desempenoDeUnManager, PERIODOS_DESEMPENO } from '@ijm/servidor';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { comoMiembro, exigirDuenoCon } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { Marco, estilos } from '../../componentes/marco';

const COLOR: Record<Semaforo, string> = {
  verde: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  ambar: 'border-amber-300 bg-amber-50 text-amber-900',
  rojo: 'border-red-300 bg-red-50 text-red-900',
  info: 'border-slate-200 bg-white text-slate-900',
};

export default async function DesempenoDelManager({ params, searchParams }: PageProps<'/equipo/[id]'>) {
  const { id } = await params;
  const consulta = await searchParams;
  const dias = PERIODOS_DESEMPENO.find((d) => String(d) === consulta.dias) ?? 90;
  const acceso = await exigirDuenoCon('desempeno');
  const r = await comoMiembro((tx) => desempenoDeUnManager(tx, { miembroId: id, dias }), acceso);
  if (!r.ok || !r.datos) notFound();
  const d = r.datos;
  const [t, to, idioma] = await Promise.all([
    getTranslations('desempeno'),
    getTranslations('obras'),
    getLocale(),
  ]);
  const dinero = (n: number) => formatoDinero(idioma).format(n);
  const empresa = new Map(d.empresa.map((m) => [m.clave, m]));
  // los textos por métrica llevan sus propios valores: la clave se arma con la métrica
  const tm = t as unknown as (clave: string, valores: Record<string, string | number>) => string;

  const valor = (m: MetricaDeDesempeno, v: number | null) => {
    if (v === null) return '—';
    if (m.formato === 'pct') return `${Math.round(v * 100)}%`;
    return tm(`valores.${m.clave}`, {
      n: m.formato === 'num1' ? Math.round(v * 10) / 10 : Math.round(v),
    });
  };

  return (
    <Marco
      titulo={d.manager.nombre}
      subtitulo={t('titulo')}
      volver={{ href: '/equipo', texto: t('volver') }}
      ancho
    >
      <nav aria-label={t('periodo')} className="grid grid-cols-3 gap-2">
        {PERIODOS_DESEMPENO.map((p) => (
          <Link
            key={p}
            href={`/equipo/${id}?dias=${p}`}
            aria-current={p === dias ? 'page' : undefined}
            className={`flex min-h-11 items-center justify-center rounded-xl border-2 text-sm font-semibold ${p === dias ? 'border-marca bg-marca text-white' : 'border-marca/30 bg-white text-marca'}`}
          >
            {t(`periodos.${p}`)}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-slate-600">{t('ayuda')}</p>

      {/* en la computadora, los cuatro grupos en dos columnas (D-109) */}
      <div className="contents lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        {(Object.entries(GRUPOS_PM) as [keyof typeof GRUPOS_PM, readonly MetricaPM[]][]).map(
          ([grupo, claves]) => (
            <section key={grupo} className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-marca">{t(`grupos.${grupo}`)}</h2>
              {claves.map((k) => {
                const m = d.manager.metricas.find((x) => x.clave === k)!;
                const e = empresa.get(k)!;
                return (
                  <article
                    key={k}
                    className={`flex flex-col gap-1 rounded-2xl border p-4 ${COLOR[m.semaforo]}`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-medium">{t(`nombres.${k}`)}</h3>
                      <span className="shrink-0 text-2xl font-bold">{valor(m, m.valor)}</span>
                    </div>
                    <p className="text-sm opacity-80">
                      {t('metaYEmpresa', { meta: valor(m, m.meta), empresa: valor(e, e.valor) })}
                    </p>
                    {m.valor !== null ? (
                      <p className="text-sm opacity-80">
                        {tm(`detalles.${k}`, {
                          ...m.datos,
                          ...(k === 'retrabajos' ? { costo: dinero(m.datos.costo ?? 0) } : {}),
                        })}
                      </p>
                    ) : (
                      <p className="text-sm opacity-80">{t('sinDatos')}</p>
                    )}
                    {m.pocosDatos ? <p className="text-sm font-medium">{t('pocosDatos')}</p> : null}
                  </article>
                );
              })}
            </section>
          ),
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-marca">{t('susObras', { n: d.manager.obras.length })}</h2>
        {d.manager.obras.length === 0 ? <p className={estilos.tarjeta}>{t('sinObras')}</p> : null}
        <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2">
          {d.manager.obras.map((o) => (
            <li key={o.id}>
              <Link
                href={`/obras/${o.id}/seguimiento`}
                className={`${estilos.tarjeta} flex flex-col gap-0.5 text-sm`}
              >
                <span className="font-semibold">
                  {to('encabezado', { folio: o.folio, cliente: o.cliente })}
                </span>
                <span className="text-slate-600">
                  {[
                    to(`estado.${o.estado}` as never),
                    o.avance !== null ? t('avance', { pct: Math.round(o.avance * 100) }) : null,
                    o.atraso ? t('tarde', { n: o.atraso }) : null,
                    o.presupuesto === 'rojo' ? t('presupuestoRojo') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Marco>
  );
}
