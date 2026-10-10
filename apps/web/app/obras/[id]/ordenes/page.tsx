// Las órdenes de trabajo de una obra que esperan algo del PM (fase 2, paso 6d; legacy: "Falta que confirmen" y
// "Subs en obra" de la pantalla de la obra en PM.html): las que falta que el sub confirme por escrito, y las del sub
// que ya llegó, para aprobar su trabajo. Sin precios: el PM nunca ve lo que se le paga al sub.
import { ordenesDelPm, type OrdenDelPm } from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { comoMiembro, exigirAcceso } from '@/lib/acceso';
import { Marco, estilos } from '../../../componentes/marco';
import { BotonOrden } from './boton-orden';

export default async function Ordenes({ params }: PageProps<'/obras/[id]/ordenes'>) {
  const { id } = await params;
  const acceso = await exigirAcceso();
  if (acceso.yo.rol !== 'pm') redirect('/');
  const r = await comoMiembro((tx) => ordenesDelPm(tx, { obraId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const d = r.datos;
  const [t, formato, idioma] = await Promise.all([getTranslations('ordenes'), getFormatter(), getLocale()]);
  const nombre = (n: { es: string; en: string | null } | null) =>
    n ? ((idioma === 'en' ? n.en : null) ?? n.es) : '';
  const dia = (d: string) =>
    formato.dateTime(new Date(`${d}T12:00:00`), { weekday: 'short', day: 'numeric', month: 'short' });

  const tarjeta = (o: OrdenDelPm, que: 'confirmar' | 'aprobar') => (
    <li
      key={o.id}
      className={`${estilos.tarjeta} flex flex-col gap-2 ${que === 'confirmar' ? 'border-amber-300' : ''}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">{o.sub}</p>
        <p className="shrink-0 text-xs text-slate-500">{o.folio}</p>
      </div>
      <p className="text-sm text-slate-600">
        {t('oficioPartida', { oficio: nombre(o.oficio), espacio: o.espacio, partida: nombre(o.partida) })}
      </p>
      <p className="text-sm text-slate-800">{o.alcance}</p>
      <p className="text-sm text-slate-600">{t('fechas', { inicio: dia(o.inicio), fin: dia(o.fin) })}</p>
      {o.telefono ? (
        <a
          href={`tel:${o.telefono}`}
          className={`${estilos.botonSecundario} flex items-center justify-center`}
        >
          {t('llamar', { telefono: o.telefono })}
        </a>
      ) : null}
      <BotonOrden obraId={d.obra.id} ordenId={o.id} que={que} />
    </li>
  );

  return (
    <Marco titulo={t('titulo')}>
      <Link href="/" className="text-sm font-medium text-marca">
        {t('volver')}
      </Link>
      <p className="text-slate-700">{t('obra', { folio: d.obra.folio, cliente: d.obra.cliente })}</p>
      {d.porConfirmar.length === 0 && d.porAprobar.length === 0 ? (
        <p className={estilos.tarjeta}>{t('nada')}</p>
      ) : null}
      {d.porConfirmar.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-marca">{t('porConfirmar')}</h2>
          <p className="text-sm text-slate-600">{t('porConfirmarAyuda')}</p>
          <ul className="flex flex-col gap-3">{d.porConfirmar.map((o) => tarjeta(o, 'confirmar'))}</ul>
        </section>
      ) : null}
      {d.porAprobar.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-marca">{t('porAprobar')}</h2>
          <p className="text-sm text-slate-600">{t('porAprobarAyuda')}</p>
          <ul className="flex flex-col gap-3">{d.porAprobar.map((o) => tarjeta(o, 'aprobar'))}</ul>
        </section>
      ) : null}
    </Marco>
  );
}
