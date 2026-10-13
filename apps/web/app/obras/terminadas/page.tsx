// Las obras terminadas del PM, mientras dura su garantía (D-060): cuándo se entregó, hasta cuándo dura la garantía y
// sus fotos, para una visita de garantía sin abrir muros. Solo lectura y sin dinero; la base decide cuáles son.
import { obrasEnGarantia } from '@ijm/servidor';
import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { comoMiembro, exigirAcceso } from '@/lib/acceso';
import { Marco, estilos } from '../../componentes/marco';
import { MensajeError } from '../../componentes/mensaje-error';

export default async function ObrasTerminadas() {
  const acceso = await exigirAcceso();
  if (acceso.yo.rol !== 'pm') redirect('/obras');
  const r = await comoMiembro((tx) => obrasEnGarantia(tx), acceso);
  const [t, formato] = await Promise.all([getTranslations('terminadas'), getFormatter()]);
  // un día de negocio a mediodía, para que ninguna zona horaria lo mueva de día
  const dia = (d: string) =>
    formato.dateTime(new Date(`${d}T12:00:00`), { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Marco titulo={t('titulo')} volver={{ href: '/', texto: t('volver') }}>
      <p className="text-sm text-slate-600">{t('ayuda')}</p>
      {!r.ok ? <MensajeError problema={r} /> : null}
      {r.ok && r.datos.length === 0 ? <p className={estilos.tarjeta}>{t('vacio')}</p> : null}
      {r.ok
        ? r.datos.map((o) => (
            <article key={o.id} className={`${estilos.tarjeta} flex flex-col gap-2`}>
              <h2 className="font-semibold">{t('obra', { folio: o.folio, cliente: o.cliente })}</h2>
              <p className="text-sm text-slate-600">{o.direccion}</p>
              <p className="flex flex-wrap gap-x-3 text-sm text-slate-700">
                <span>{t('entregada', { dia: dia(o.entregada) })}</span>
                <span className={o.atraso ? 'font-medium text-red-700' : 'text-emerald-700'}>
                  {o.atraso ? t('tarde', { n: o.atraso }) : t('aTiempo')}
                </span>
              </p>
              <p className="flex flex-wrap gap-x-3 text-sm text-slate-700">
                <span className="font-medium">{t('garantia', { dia: dia(o.garantiaVence) })}</span>
                <span>{t('diasCerrados', { n: o.diasCerrados })}</span>
              </p>
              <Link
                href={`/obras/${o.id}/album`}
                className={`${estilos.botonSecundario} flex items-center justify-center`}
              >
                {t('verFotos')}
              </Link>
            </article>
          ))
        : null}
    </Marco>
  );
}
