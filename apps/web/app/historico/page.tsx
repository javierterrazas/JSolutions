// El histórico de las obras cerradas, para el dueño (D-087; legacy: el histórico del tablero): cómo le ha ido, la
// tendencia de sus últimas obras, los promedios por tipo de obra y por mes, lo que cuesta cada etapa según el tamaño y
// lo que más mueve el precio (D-095; de ahí sale el costo sugerido al cotizar), las garantías y cada obra cerrada.
// Lleva dinero: solo el dueño. D-107: la ganancia por día y el ranking de las obras cerradas, cada una con su análisis.
import { CRITERIOS_HISTORICO, type CriterioHistorico, ordenarObrasCerradas } from '@ijm/core';
import { historicoDeObras } from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { comoMiembro, exigirDuenoCon } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { Marco, estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';

/** Las columnas de la tabla que ordenan, con su título (D-109). */
const COLUMNAS: readonly (readonly [
  CriterioHistorico,
  'gananciaDia' | 'margen' | 'ganancia' | 'dias' | 'entrega',
])[] = [
  ['ganancia_dia', 'gananciaDia'],
  ['margen', 'margen'],
  ['ganancia', 'ganancia'],
  ['dias', 'dias'],
  ['atraso', 'entrega'],
];

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-bold text-marca">{titulo}</h2>
      {children}
    </section>
  );
}

function Cifra({ titulo, valor, nota }: { titulo: string; valor: string; nota?: ReactNode }) {
  return (
    <div className={`${estilos.tarjeta} flex flex-col gap-0.5`}>
      <span className="text-sm text-slate-600">{titulo}</span>
      <span className="text-2xl font-bold">{valor}</span>
      {nota ? <span className="text-xs">{nota}</span> : null}
    </div>
  );
}

export default async function Historico({ searchParams }: PageProps<'/historico'>) {
  const { orden: pedido } = await searchParams;
  const orden: CriterioHistorico = CRITERIOS_HISTORICO.find((c) => c === pedido) ?? 'ganancia_dia';
  const acceso = await exigirDuenoCon('historico');
  const r = await comoMiembro((tx) => historicoDeObras(tx), acceso);
  const [t, idioma, formato] = await Promise.all([getTranslations('historico'), getLocale(), getFormatter()]);
  const volver = { href: '/', texto: t('volver') };
  if (!r.ok)
    return (
      <Marco titulo={t('titulo')} volver={volver}>
        <MensajeError problema={r} />
      </Marco>
    );
  const h = r.datos;
  const dinero = (n: number) => formatoDinero(idioma).format(n);
  const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 1000) / 10}%`);
  const dias = (x: number | null) => (x === null ? '—' : t('dias', { n: Math.round(x) }));
  const porPie = (x: number | null) => (x === null ? '—' : t('porPie2', { monto: dinero(x) }));
  const nombre = (n: { es: string; en: string | null }) => (idioma === 'en' ? n.en : null) ?? n.es;
  // las etapas que más suben el costo al crecer el espacio: las que ya tienen base + tarifa (D-095)
  const mueven = h.costos
    .filter((c) => c.ajuste && c.ajuste.parteDelTamano >= 0.3)
    .sort((a, b) => b.ajuste!.por10 - a.ajuste!.por10)
    .slice(0, 6);
  const mes = (m: string) =>
    formato.dateTime(new Date(`${m}-15T12:00:00`), { month: 'long', year: 'numeric' });
  /** La tendencia, con su color: si subir es bueno (margen) o malo (desviación, días). */
  const tendencia = (x: number | null, subirEsBueno: boolean, texto: (v: string) => string) => {
    if (x === null) return null;
    const bien = subirEsBueno ? x >= 0 : x <= 0;
    return (
      <span className={bien ? 'text-emerald-700' : 'text-red-700'}>{texto(x >= 0 ? `+${x}` : `${x}`)}</span>
    );
  };

  if (!h.obras.length)
    return (
      <Marco titulo={t('titulo')} volver={volver}>
        <p className={estilos.tarjeta}>{t('sinObras')}</p>
      </Marco>
    );

  const total = h.resumen.total;
  const ordenadas = ordenarObrasCerradas(h.obras, orden);
  const tend = h.resumen.tendencia;
  return (
    <Marco titulo={t('titulo')} volver={volver} ancho>
      <p className="text-sm text-slate-700">{t('contexto', { n: total.n })}</p>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Cifra
          titulo={t('margen')}
          valor={pct(total.margen)}
          nota={tendencia(tend.margen === null ? null : Math.round(tend.margen * 1000) / 10, true, (v) =>
            t('tendenciaPuntos', { v }),
          )}
        />
        <Cifra
          titulo={t('desviacion')}
          valor={pct(total.desviacion)}
          nota={tendencia(
            tend.desviacion === null ? null : Math.round(tend.desviacion * 1000) / 10,
            false,
            (v) => t('tendenciaPuntos', { v }),
          )}
        />
        <Cifra
          titulo={t('duracion')}
          valor={dias(total.dias)}
          nota={tendencia(tend.dias === null ? null : Math.round(tend.dias), false, (v) =>
            t('tendenciaDias', { v }),
          )}
        />
        <Cifra
          titulo={t('gananciaDia')}
          valor={total.gananciaDia === null ? '—' : t('porDia', { monto: dinero(total.gananciaDia) })}
          nota={t('gananciaTotal', { monto: dinero(total.contrato - total.costo) })}
        />
        <Cifra
          titulo={t('ventaPie')}
          valor={porPie(total.ventaPie)}
          nota={t('costoPieNota', { costo: porPie(total.costoPie) })}
        />
      </div>
      {tend.margen !== null ? <p className="text-xs text-slate-600">{t('tendenciaAyuda')}</p> : null}

      <Seccion titulo={t('ranking')}>
        <p className="text-sm text-slate-700">{t('rankingAyuda')}</p>
        <nav aria-label={t('ordenarPor')} className="flex flex-wrap gap-2">
          {CRITERIOS_HISTORICO.map((c) => (
            <Link
              key={c}
              href={c === 'ganancia_dia' ? '/historico' : `/historico?orden=${c}`}
              aria-current={c === orden ? 'page' : undefined}
              className={`flex min-h-10 items-center rounded-full border-2 px-3 text-sm font-semibold ${c === orden ? 'border-marca bg-marca text-white' : 'border-marca/30 bg-white text-marca'}`}
            >
              {t(`criterios.${c}`)}
            </Link>
          ))}
        </nav>
        <ol className="flex flex-col gap-2 lg:hidden">
          {ordenadas.map((o, i) => (
            <li key={o.obraId}>
              <Link
                href={`/historico/${o.obraId}`}
                className={`${estilos.tarjeta} flex flex-col gap-1 text-sm`}
              >
                <span className="flex justify-between gap-2 font-semibold">
                  <span>
                    {t('lugar', { n: i + 1 })} {t('obraEncabezado', { folio: o.folio, cliente: o.cliente })}
                  </span>
                  <span>{o.gananciaDia === null ? '—' : t('porDia', { monto: dinero(o.gananciaDia) })}</span>
                </span>
                <span className="text-slate-700">
                  {t('lineaRanking', {
                    margen: pct(o.margen),
                    ganancia: dinero(o.ganancia),
                    dias: dias(o.dias),
                  })}
                </span>
                <span className={o.atraso > 0 ? 'text-red-700' : 'text-emerald-800'}>
                  {o.atraso > 0
                    ? t('entregadaTarde', { n: o.atraso })
                    : t('entregadaATiempo', { n: -o.atraso })}
                  {t('separador')}
                  {o.tipo || t('sinTipo')}
                </span>
              </Link>
            </li>
          ))}
        </ol>
        {/* en la computadora, una tabla con todas las columnas; el encabezado ordena (D-109) */}
        <div className={`${estilos.tarjeta} hidden overflow-x-auto p-0 lg:block`}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">{t('tabla.lugar')}</th>
                <th className="px-3 py-2 font-medium">{t('tabla.obra')}</th>
                <th className="px-3 py-2 font-medium">{t('tabla.tipo')}</th>
                <th className="px-3 py-2 font-medium">{t('tabla.pm')}</th>
                {COLUMNAS.map(([c, titulo]) => (
                  <th key={c} className="px-3 py-2 text-right font-medium">
                    <Link
                      href={c === 'ganancia_dia' ? '/historico' : `/historico?orden=${c}`}
                      aria-current={c === orden ? 'true' : undefined}
                      className={c === orden ? 'font-bold text-marca' : 'underline'}
                    >
                      {t(`tabla.${titulo}`)}
                      {c === orden ? ' ▾' : ''}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ordenadas.map((o, i) => (
                <tr key={o.obraId} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2">
                    <Link href={`/historico/${o.obraId}`} className="font-semibold text-marca underline">
                      {t('obraEncabezado', { folio: o.folio, cliente: o.cliente })}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{o.tipo || t('sinTipo')}</td>
                  <td className="px-3 py-2">{o.pm ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {o.gananciaDia === null ? '—' : t('porDia', { monto: dinero(o.gananciaDia) })}
                  </td>
                  <td className="px-3 py-2 text-right">{pct(o.margen)}</td>
                  <td className="px-3 py-2 text-right">{dinero(o.ganancia)}</td>
                  <td className="px-3 py-2 text-right">{o.dias}</td>
                  <td
                    className={`px-3 py-2 text-right ${o.atraso > 0 ? 'text-red-700' : 'text-emerald-800'}`}
                  >
                    {o.atraso > 0 ? t('tabla.tarde', { n: o.atraso }) : t('tabla.aTiempo', { n: -o.atraso })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      {/* en la computadora, lo demás en dos columnas (D-109) */}
      <div className="contents lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <Seccion titulo={t('porTipo')}>
          <ul className="flex flex-col gap-2">
            {h.resumen.porTipo.map((g) => (
              <li key={g.clave} className={`${estilos.tarjeta} flex flex-col gap-1 text-sm`}>
                <span className="flex justify-between gap-2 font-semibold">
                  <span>{g.clave || t('sinTipo')}</span>
                  <span>{t('obras', { n: g.n })}</span>
                </span>
                <span className="text-slate-700">
                  {t('lineaGrupo', {
                    margen: pct(g.margen),
                    desviacion: pct(g.desviacion),
                    dias: dias(g.dias),
                  })}
                </span>
                <span className="font-medium text-slate-800">
                  {t('gananciaDiaGrupo', {
                    monto: g.gananciaDia === null ? '—' : dinero(g.gananciaDia),
                  })}
                </span>
                <span className="text-slate-600">
                  {t('lineaPie', { venta: porPie(g.ventaPie), costo: porPie(g.costoPie) })}
                </span>
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion titulo={t('masMueven')}>
          <p className="text-sm text-slate-600">{t('masMuevenAyuda')}</p>
          {mueven.length ? (
            <ul className="flex flex-col gap-2">
              {mueven.map((c) => (
                <li
                  key={`${c.tipoEspacioId}-${c.etapaId}`}
                  className={`${estilos.tarjeta} flex justify-between gap-2 text-sm`}
                >
                  <span className="font-semibold">
                    {t('tipoEtapa', {
                      tipo: nombre(c.tipoEspacio),
                      etapa: c.etapa ? nombre(c.etapa) : t('otras'),
                    })}
                  </span>
                  <span className="text-right">
                    {t('mueve', {
                      monto: dinero(c.ajuste!.por10),
                      unidad: t(`unidadCorta.${c.ajuste!.medida}`),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">{t('sinMueven')}</p>
          )}
        </Seccion>

        <Seccion titulo={t('porUnidad')}>
          <p className="text-sm text-slate-600">{t('porUnidadAyuda')}</p>
          {h.costos.length ? (
            <ul className="flex flex-col gap-2">
              {h.costos.map((c) => (
                <li
                  key={`${c.tipoEspacioId}-${c.etapaId}`}
                  className={`${estilos.tarjeta} flex flex-col gap-1 text-sm`}
                >
                  <span className="flex justify-between gap-2 font-semibold">
                    <span>
                      {t('tipoEtapa', {
                        tipo: nombre(c.tipoEspacio),
                        etapa: c.etapa ? nombre(c.etapa) : t('otras'),
                      })}
                    </span>
                    <span className="text-right">
                      {c.unidad === 'fijo' || c.porUnidad === null
                        ? t('porEspacio', { monto: dinero(c.costoTipico) })
                        : t(c.unidad === 'pie_lineal' ? 'porPieLineal' : 'porPie2', {
                            monto: dinero(c.porUnidad),
                          })}
                    </span>
                  </span>
                  {c.ajuste ? (
                    <span className="text-slate-700">
                      {[
                        t('ajuste', {
                          base: dinero(Math.max(0, c.ajuste.base)),
                          tarifa: dinero(c.ajuste.tarifa),
                          unidad: t(`unidadCorta.${c.ajuste.medida}`),
                        }),
                        c.ajuste.parteDelTamano < 0.3
                          ? t('casiFija')
                          : t('parteTamano', { pct: pct(c.ajuste.parteDelTamano) }),
                      ].join(t('separador'))}
                    </span>
                  ) : (
                    <span className="text-slate-600">{t('faltanObras', { n: c.n })}</span>
                  )}
                  {c.sugerida ? (
                    <span className="font-medium text-amber-800">
                      {t(
                        c.sugerida === 'fijo'
                          ? 'sugerirFijo'
                          : c.sugerida === 'pie_lineal'
                            ? 'sugerirLineal'
                            : 'sugerirPie2',
                      )}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">{t('sinUnidad')}</p>
          )}
        </Seccion>

        <Seccion titulo={t('porMes')}>
          <ul className="flex flex-col gap-2">
            {h.resumen.porMes.map((g) => (
              <li key={g.clave} className={`${estilos.tarjeta} flex flex-col gap-1 text-sm`}>
                <span className="flex justify-between gap-2 font-semibold">
                  <span className="first-letter:uppercase">{mes(g.clave)}</span>
                  <span>{t('obras', { n: g.n })}</span>
                </span>
                <span className="text-slate-700">
                  {t('lineaMes', {
                    contrato: dinero(g.contrato),
                    costo: dinero(g.costo),
                    margen: pct(g.margen),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion titulo={t('garantias')}>
          <p className={`${estilos.tarjeta} text-sm`}>
            {t('lineaGarantias', {
              reclamos: h.garantias.reclamos,
              costo: dinero(h.garantias.costo),
              abiertos: h.garantias.abiertos,
              resenas: h.garantias.resenas,
              entregas: h.garantias.entregas,
            })}
          </p>
        </Seccion>
      </div>
    </Marco>
  );
}
