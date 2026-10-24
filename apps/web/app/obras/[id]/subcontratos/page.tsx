// Los subcontratos de una obra, para el dueño (D-074): lo comprometido con los subs, lo pagado y lo que se les debe;
// emitir órdenes de trabajo con precio cerrado, pagarles contra su orden y cancelar las que no tienen pagos. El PM
// confirma y aprueba las órdenes en su app. Lleva dinero: solo el dueño o el administrador.
import { subcontratosDeObra } from '@ijm/servidor';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { comoMiembro, exigirDuenoCon } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { Marco, estilos } from '../../../componentes/marco';
import { FormularioOrden } from './formulario-orden';
import { TarjetaOrden } from './tarjeta-orden';

export default async function Subcontratos({ params }: PageProps<'/obras/[id]/subcontratos'>) {
  const { id } = await params;
  const acceso = await exigirDuenoCon('subcontratistas');
  const r = await comoMiembro((tx) => subcontratosDeObra(tx, { obraId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const d = r.datos;
  const [t, to, idioma] = await Promise.all([
    getTranslations('subcontratos'),
    getTranslations('obras'),
    getLocale(),
  ]);
  const dinero = (n: number) => formatoDinero(idioma).format(n);

  return (
    <Marco
      titulo={t('titulo')}
      subtitulo={to('encabezado', { folio: d.obra.folio, cliente: d.obra.cliente })}
      volver={{ href: `/obras/${d.obra.id}/seguimiento`, texto: t('volver') }}
    >
      <p className="text-sm text-slate-700">{t('ayuda')}</p>
      <dl className={`${estilos.tarjeta} flex flex-col gap-1`}>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-600">{t('comprometido')}</dt>
          <dd>{dinero(d.comprometido)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-600">{t('pagado')}</dt>
          <dd className="text-emerald-800">{dinero(d.pagado)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-slate-100 pt-1 text-lg font-bold">
          <dt>{t('porPagar')}</dt>
          <dd className={d.saldo > 0 ? 'text-amber-800' : ''}>{dinero(d.saldo)}</dd>
        </div>
      </dl>

      {d.cerrada ? (
        <p className={estilos.tarjeta}>{t('cerrada')}</p>
      ) : (
        <FormularioOrden obraId={d.obra.id} hoy={d.hoy} subs={d.subs} espacios={d.espacios} />
      )}

      {d.ordenes.length === 0 ? <p className={estilos.tarjeta}>{t('ninguna')}</p> : null}
      <ul className="flex flex-col gap-3">
        {d.ordenes.map((o) => (
          <TarjetaOrden key={o.id} obraId={d.obra.id} orden={o} hoy={d.hoy} cerrada={d.cerrada} />
        ))}
      </ul>
    </Marco>
  );
}
