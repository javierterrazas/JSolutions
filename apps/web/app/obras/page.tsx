// Las obras de la empresa, para el dueño: cada una con su estado, y la entrada para dar de alta una nueva.
import { obrasDeLaEmpresa } from '@ijm/servidor';
import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { Marco, estilos } from '../componentes/marco';

export default async function Obras() {
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => obrasDeLaEmpresa(tx), acceso);
  const obras = r.ok ? r.datos : [];
  const [t, ti, formato] = await Promise.all([
    getTranslations('obras'),
    getTranslations('inicio'),
    getFormatter(),
  ]);
  return (
    <Marco titulo={t('titulo')}>
      <Link href="/" className="text-sm font-medium text-marca">
        {ti('hola', { nombre: acceso.yo.nombre })}
      </Link>
      <Link href="/obras/nueva" className={`${estilos.boton} flex items-center justify-center`}>
        {t('nueva')}
      </Link>
      {obras.length === 0 ? <p className="text-slate-600">{t('ninguna')}</p> : null}
      <ul className="flex flex-col gap-3">
        {obras.map((o) => (
          <li key={o.id}>
            <Link href={`/obras/${o.id}/presupuesto`} className={`${estilos.tarjeta} flex flex-col gap-1`}>
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {t('encabezado', { folio: o.folio, cliente: o.cliente })}
                </span>
                <span className="text-sm text-slate-600">{t(`estado.${o.estado}`)}</span>
              </span>
              <span className="text-sm text-slate-600">{o.direccion}</span>
              <span className="text-sm text-slate-600">
                {t('pm', {
                  nombre: o.pm,
                  // el día de negocio a mediodía, para que ninguna zona lo mueva de día
                  fecha: formato.dateTime(new Date(`${o.inicio}T12:00:00`), { dateStyle: 'medium' }),
                })}
              </span>
            </Link>
            <Link
              href={`/obras/${o.id}/album`}
              className="mt-1 inline-block px-1 text-sm font-medium text-marca underline"
            >
              {t('album')}
            </Link>
          </li>
        ))}
      </ul>
    </Marco>
  );
}
