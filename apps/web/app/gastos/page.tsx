// Las compras del PM arriba de su límite, para que el dueño las revise (fase 2, paso 6b; legacy: la lista del inicio
// del administrador y duRevisarGasto). Una lista mínima: las pantallas del dueño llegan en la fase 3.
import { gastosEnRevision } from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { Marco, estilos } from '../componentes/marco';
import { BotonRevisado } from './boton-revisado';

export default async function GastosEnRevision() {
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => gastosEnRevision(tx), acceso);
  const lista = r.ok ? r.datos : [];
  const [t, tg, formato, idioma] = await Promise.all([
    getTranslations('revisionGastos'),
    getTranslations('gasto'),
    getFormatter(),
    getLocale(),
  ]);
  const dinero = formatoDinero(idioma);
  return (
    <Marco titulo={t('titulo')}>
      <Link href="/" className="text-sm font-medium text-marca">
        {t('volver')}
      </Link>
      <p className="text-sm text-slate-600">{t('ayuda')}</p>
      {lista.length === 0 ? <p className={estilos.tarjeta}>{t('ninguno')}</p> : null}
      <ul className="flex flex-col gap-3">
        {lista.map((g) => (
          <li key={g.id} className={`${estilos.tarjeta} flex flex-col gap-1`}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">
                {tg('montoProveedor', {
                  monto: dinero.format(g.monto),
                  proveedor: g.proveedor,
                })}
              </p>
              <p className="shrink-0 text-xs text-slate-500">{g.folio}</p>
            </div>
            <p className="text-sm text-slate-700">
              {t('obraPm', { folio: g.obra.folio, cliente: g.obra.cliente, pm: g.pm })}
            </p>
            <p className="text-sm text-slate-600">
              {tg(g.descripcion ? 'diaDescripcion' : 'dia', {
                dia: formato.dateTime(new Date(`${g.dia}T12:00:00`), { dateStyle: 'medium' }),
                descripcion: g.descripcion ?? '',
              })}
            </p>
            <p className="text-sm text-slate-600">
              {t('categoriaRecibo', {
                categoria: tg(`categorias.${g.categoria}`),
                recibo: g.reciboId ? t('conRecibo') : t('sinRecibo'),
              })}
            </p>
            <BotonRevisado gastoId={g.id} />
          </li>
        ))}
      </ul>
    </Marco>
  );
}
