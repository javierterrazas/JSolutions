// El histórico de las obras cerradas, para el dueño (D-087; legacy: el histórico del tablero): cómo le ha ido, la
// tendencia de sus últimas obras, los promedios por tipo de obra y por mes, lo que cuesta cada etapa según el tamaño y
// lo que más mueve el precio (D-095; de ahí sale el costo sugerido al cotizar), las garantías y cada obra cerrada.
// Lleva dinero: solo el dueño.
import { historicoDeObras } from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { Marco, estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';

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

export default async function Historico() {
  const acceso = await exigirDueno();
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
  // un día de negocio a mediodía, para que ninguna zona horaria lo mueva de día
  const dia = (d: string) => formato.dateTime(new Date(`${d}T12:00:00`), { dateStyle: 'medium' });
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
  const tend = h.resumen.tendencia;
  return (
    <Marco titulo={t('titulo')} volver={volver}>
      <p className="text-sm text-slate-700">{t('contexto', { n: total.n })}</p>
      <div className="grid grid-cols-2 gap-2">
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
          titulo={t('ventaPie')}
          valor={porPie(total.ventaPie)}
          nota={t('costoPieNota', { costo: porPie(total.costoPie) })}
        />
      </div>
      {tend.margen !== null ? <p className="text-xs text-slate-600">{t('tendenciaAyuda')}</p> : null}

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

      <Seccion titulo={t('cerradas')}>
        <ul className="flex flex-col gap-2">
          {h.obras.map((o) => (
            <li key={o.obraId}>
              <Link
                href={`/obras/${o.obraId}/cerrar`}
                className={`${estilos.tarjeta} flex flex-col gap-1 text-sm`}
              >
                <span className="flex justify-between gap-2 font-semibold">
                  <span>{t('obraEncabezado', { folio: o.folio, cliente: o.cliente })}</span>
                  <span>{pct(o.margen)}</span>
                </span>
                <span className="text-slate-700">
                  {t('lineaObra', {
                    tipo: o.tipo || t('sinTipo'),
                    entrega: dia(o.entrega),
                    dias: dias(o.dias),
                  })}
                </span>
                <span className="text-slate-600">
                  {t('lineaObraDinero', {
                    contrato: dinero(o.contrato),
                    costo: dinero(o.costo),
                    desviacion: pct(o.desviacion),
                  })}
                </span>
                {o.reclamos || o.resena ? (
                  <span className="text-slate-600">
                    {t('lineaObraGarantia', {
                      reclamos: o.reclamos,
                      costo: dinero(o.costoGarantia),
                      resena: o.resena ? 'si' : 'no',
                    })}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </Seccion>
    </Marco>
  );
}
