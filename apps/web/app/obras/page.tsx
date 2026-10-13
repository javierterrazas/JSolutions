// Las obras de la empresa, para el dueño: cada una con su estado y, de un vistazo, cuánto lleva, cuánto del
// presupuesto ha gastado y si va tarde (D-062). Tocarla abre su seguimiento.
import { obrasDeLaEmpresa, resumenDeObras, type Semaforo } from '@ijm/servidor';
import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { Marco, estilos } from '../componentes/marco';

const COLOR: Record<Semaforo, string> = {
  verde: 'text-emerald-700',
  amarillo: 'text-amber-700',
  rojo: 'text-red-700',
};

export default async function Obras() {
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => obrasDeLaEmpresa(tx), acceso);
  const resumen = await comoMiembro((tx) => resumenDeObras(tx), acceso);
  const obras = r.ok ? r.datos : [];
  const [t, ti, formato] = await Promise.all([
    getTranslations('obras'),
    getTranslations('inicio'),
    getFormatter(),
  ]);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  // el día de negocio a mediodía, para que ninguna zona lo mueva de día
  const dia = (d: string) => formato.dateTime(new Date(`${d}T12:00:00`), { dateStyle: 'medium' });
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
        {obras.map((o) => {
          const x = resumen.ok ? resumen.datos.get(o.id) : undefined;
          return (
            <li key={o.id}>
              <Link href={`/obras/${o.id}/seguimiento`} className={`${estilos.tarjeta} flex flex-col gap-1`}>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {t('encabezado', { folio: o.folio, cliente: o.cliente })}
                  </span>
                  <span className="text-sm text-slate-600">{t(`estado.${o.estado}`)}</span>
                </span>
                <span className="text-sm text-slate-600">{o.direccion}</span>
                <span className="text-sm text-slate-600">
                  {t('pm', { nombre: o.pm, fecha: dia(o.inicio) })}
                  {x ? t('entrega', { fecha: dia(x.entrega) }) : null}
                </span>
                {x ? (
                  <span className="flex flex-wrap gap-x-3 text-sm font-medium">
                    <span className={x.semaforo ? COLOR[x.semaforo] : 'text-slate-700'}>
                      {x.usado === null
                        ? t('resumenSinPresupuesto', { avance: pct(x.avance) })
                        : t('resumen', { avance: pct(x.avance), usado: pct(x.usado) })}
                    </span>
                    {x.atraso ? <span className="text-red-700">{t('tarde', { n: x.atraso })}</span> : null}
                  </span>
                ) : null}
              </Link>
              <Link
                href={`/obras/${o.id}/album`}
                className="mt-1 inline-block px-1 text-sm font-medium text-marca underline"
              >
                {t('album')}
              </Link>
            </li>
          );
        })}
      </ul>
    </Marco>
  );
}
