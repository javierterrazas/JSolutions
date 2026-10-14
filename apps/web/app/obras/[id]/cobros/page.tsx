// Los cobros al cliente de una obra, para el dueño (D-071): el contrato con los cambios aprobados, lo cobrado y lo
// que falta; registrar cada pago, y corregirlo o anularlo con su motivo. Lleva dinero: solo el dueño o el
// administrador.
import { cobrosDeObra } from '@ijm/servidor';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { Marco, estilos } from '../../../componentes/marco';
import { CobroRegistrado } from './cobro-registrado';
import { FormularioCobro } from './formulario-cobro';

export default async function Cobros({ params }: PageProps<'/obras/[id]/cobros'>) {
  const { id } = await params;
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => cobrosDeObra(tx, { obraId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const c = r.datos;
  const [t, to, idioma] = await Promise.all([
    getTranslations('cobros'),
    getTranslations('obras'),
    getLocale(),
  ]);
  const dinero = (n: number) => formatoDinero(idioma).format(n);
  const pct = c.total ? Math.min(1, c.cobrado / c.total) : 0;

  return (
    <Marco
      titulo={t('titulo')}
      subtitulo={to('encabezado', { folio: c.obra.folio, cliente: c.obra.cliente })}
      volver={{ href: `/obras/${c.obra.id}/seguimiento`, texto: t('volver') }}
    >
      <div className={`${estilos.tarjeta} flex flex-col gap-3`}>
        <dl className="flex flex-col gap-1">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-600">{t('contrato')}</dt>
            <dd>{c.contrato !== null ? dinero(c.contrato) : '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-600">{t('cambios')}</dt>
            <dd>{dinero(c.cambios)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-slate-100 pt-1 font-semibold">
            <dt>{t('total')}</dt>
            <dd>{dinero(c.total)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-600">{t('cobrado')}</dt>
            <dd className="text-emerald-800">{dinero(c.cobrado)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-lg font-bold">
            <dt>{t('porCobrar')}</dt>
            <dd className={c.porCobrar > 0 ? 'text-amber-800' : 'text-emerald-800'}>{dinero(c.porCobrar)}</dd>
          </div>
        </dl>
        <div
          className="flex h-3 overflow-hidden rounded-full bg-slate-200"
          role="img"
          aria-label={t('pctCobrado', { pct: Math.round(pct * 100) })}
        >
          <div className="bg-emerald-600" style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
        <p className="text-sm text-slate-700">{t('pctCobrado', { pct: Math.round(pct * 100) })}</p>
      </div>

      {c.cerrada ? (
        <p className={estilos.tarjeta}>{t('cerrada')}</p>
      ) : (
        <FormularioCobro obraId={c.obra.id} hoy={c.hoy} />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold text-marca">{t('pagos')}</h2>
        {c.cobros.length === 0 ? <p className={estilos.tarjeta}>{t('sinPagos')}</p> : null}
        <ul className="flex flex-col gap-3">
          {c.cobros.map((x) => (
            <CobroRegistrado
              key={x.id}
              obraId={c.obra.id}
              cobro={x}
              corregible={!c.cerrada && !c.entregada}
            />
          ))}
        </ul>
      </section>
    </Marco>
  );
}
