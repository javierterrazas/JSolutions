// El análisis de una obra cerrada (D-107): lo que dejó (ganancia, por día, margen), y dónde se fue el margen:
// presupuesto contra real en total, por rubro y por etapa, lo que sumaron las órdenes de cambio, lo que costaron los
// retrabajos y las garantías, y los días planeados contra los reales. Solo el dueño.
import { analisisDeObraCerrada } from '@ijm/servidor';
import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { comoMiembro, exigirDuenoCon } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { Marco, estilos } from '../../componentes/marco';

function Renglon({ titulo, valor, nota }: { titulo: ReactNode; valor: ReactNode; nota?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-slate-700">
        {titulo}
        {nota ? <span className="block text-xs text-slate-500">{nota}</span> : null}
      </span>
      <span className="shrink-0 font-semibold">{valor}</span>
    </div>
  );
}

export default async function AnalisisDeObra({ params }: PageProps<'/historico/[id]'>) {
  const { id } = await params;
  const acceso = await exigirDuenoCon('historico');
  const r = await comoMiembro((tx) => analisisDeObraCerrada(tx, { obraId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const a = r.datos;
  const o = a.obra;
  const [t, idioma, formato] = await Promise.all([
    getTranslations('analisisObra'),
    getLocale(),
    getFormatter(),
  ]);
  const dinero = (n: number) => formatoDinero(idioma).format(n);
  const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 1000) / 10}%`);
  const dia = (d: string) => formato.dateTime(new Date(`${d}T12:00:00`), { dateStyle: 'medium' });
  const nombre = (n: { es: string; en: string | null }) => (idioma === 'en' ? n.en : null) ?? n.es;
  /** Una diferencia contra lo presupuestado: rojo si se pasó, verde si sobró. */
  const diferencia = (real: number, plan: number) => {
    const d = real - plan;
    if (!d) return <span className="text-slate-600">{t('igual')}</span>;
    return (
      <span className={d > 0 ? 'text-red-700' : 'text-emerald-700'}>
        {d > 0 ? t('sePaso', { monto: dinero(d) }) : t('sobro', { monto: dinero(-d) })}
      </span>
    );
  };
  const pasadas = a.etapas.filter((e) => e.real - e.presupuestado > 0);

  return (
    <Marco
      titulo={t('titulo')}
      subtitulo={t('encabezado', { folio: o.folio, cliente: o.cliente })}
      volver={{ href: '/historico', texto: t('volver') }}
      ancho
    >
      <p className="text-sm text-slate-700">
        {t('contexto', { tipo: o.tipo || '—', pm: o.pm ?? '—', entrega: dia(o.entrega) })}
      </p>

      {/* en la computadora, en dos columnas (D-109) */}
      <div className="contents lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <section className={`${estilos.tarjeta} flex flex-col divide-y divide-slate-100`}>
          <h2 className="pb-2 font-semibold text-marca">{t('loQueDejo')}</h2>
          <Renglon
            titulo={t('gananciaDia')}
            valor={o.gananciaDia === null ? '—' : t('porDia', { monto: dinero(o.gananciaDia) })}
          />
          <Renglon titulo={t('ganancia')} valor={dinero(o.ganancia)} />
          <Renglon titulo={t('margen')} valor={pct(o.margen)} />
          <Renglon
            titulo={t('contratoFinal')}
            valor={dinero(o.contrato)}
            nota={t('contratoNota', {
              original: dinero(a.contratoOriginal),
              n: a.ordenesCambio.n,
              monto: dinero(a.ordenesCambio.monto),
            })}
          />
        </section>

        <section className={`${estilos.tarjeta} flex flex-col divide-y divide-slate-100`}>
          <h2 className="pb-2 font-semibold text-marca">{t('costo')}</h2>
          <Renglon
            titulo={t('costoReal')}
            valor={dinero(o.costo)}
            nota={diferencia(o.costo, a.presupuestado)}
          />
          <Renglon titulo={t('presupuestado')} valor={dinero(a.presupuestado)} />
          <Renglon titulo={t('materiales')} valor={dinero(a.materiales)} />
          <Renglon titulo={t('cuadrilla')} valor={dinero(a.cuadrilla)} />
          <Renglon titulo={t('subcontratos')} valor={dinero(a.subcontratos)} />
          <Renglon
            titulo={t('noCalidad')}
            valor={dinero(a.noCalidad.costo)}
            nota={t('noCalidadNota', {
              retrabajos: a.noCalidad.retrabajos,
              garantias: a.noCalidad.garantias,
            })}
          />
        </section>

        <section className={`${estilos.tarjeta} flex flex-col gap-1`}>
          <h2 className="font-semibold text-marca">{t('etapas')}</h2>
          <p className="text-sm text-slate-600">
            {pasadas.length ? t('etapasAyuda', { n: pasadas.length }) : t('ningunaSePaso')}
          </p>
          <ul className="flex flex-col divide-y divide-slate-100">
            {a.etapas.map((e, i) => (
              <li key={i}>
                <Renglon
                  titulo={t('espacioEtapa', {
                    espacio: e.espacio,
                    etapa: e.etapa ? nombre(e.etapa) : t('otras'),
                  })}
                  nota={t('realContraPlan', { real: dinero(e.real), plan: dinero(e.presupuestado) })}
                  valor={diferencia(e.real, e.presupuestado)}
                />
              </li>
            ))}
          </ul>
        </section>

        <section className={`${estilos.tarjeta} flex flex-col divide-y divide-slate-100`}>
          <h2 className="pb-2 font-semibold text-marca">{t('tiempo')}</h2>
          <Renglon titulo={t('diasReales')} valor={t('dias', { n: o.dias })} />
          <Renglon
            titulo={t('diasPlaneados')}
            valor={t('dias', { n: a.diasPlaneados })}
            nota={t('comprometida', { dia: dia(o.comprometida) })}
          />
          <Renglon
            titulo={t('entrega')}
            valor={
              <span className={o.atraso > 0 ? 'text-red-700' : 'text-emerald-700'}>
                {o.atraso > 0 ? t('tarde', { n: o.atraso }) : t('aTiempo', { n: -o.atraso })}
              </span>
            }
          />
        </section>
      </div>

      <Link
        href={`/obras/${o.obraId}/cerrar`}
        className={`${estilos.botonSecundario} flex items-center justify-center`}
      >
        {t('verCierre')}
      </Link>
    </Marco>
  );
}
