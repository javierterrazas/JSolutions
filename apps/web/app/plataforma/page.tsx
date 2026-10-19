// La plataforma (D-080): las empresas que usan J Solutions, con su plan, su vencimiento y cuánto la usan. Solo quien
// la administra. De cada empresa, solo su cuenta: nada de sus obras, sus clientes ni su dinero.
import { empresasDeLaPlataforma } from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { comoMiembro } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { exigirPlataforma } from '@/lib/plataforma';
import { Marco, estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';
import { COLOR_ESTADO } from './estados';

export default async function Plataforma() {
  const acceso = await exigirPlataforma();
  const r = await comoMiembro((tx) => empresasDeLaPlataforma(tx), acceso);
  const [t, idioma, formato] = await Promise.all([
    getTranslations('plataforma'),
    getLocale(),
    getFormatter(),
  ]);
  const dinero = formatoDinero(idioma);
  // un día de negocio a mediodía, para que ninguna zona horaria lo mueva de día
  const fecha = (d: string) => formato.dateTime(new Date(`${d}T12:00:00`), { dateStyle: 'medium' });
  const volver = { href: '/', texto: t('volver') };
  if (!r.ok)
    return (
      <Marco titulo={t('titulo')} volver={volver}>
        <MensajeError problema={r} />
      </Marco>
    );
  const empresas = r.datos;
  // lo que entra al mes: de las que pagan (no a prueba, no suspendidas), el anual entre 12
  const alMes = empresas
    .filter((e) => !e.enPrueba && e.estado !== 'suspendida')
    .reduce((a, e) => a + (e.ciclo === 'anual' ? e.precio / 12 : e.precio), 0);

  return (
    <Marco titulo={t('titulo')} volver={volver}>
      <div className="grid grid-cols-2 gap-2">
        <div className={`${estilos.tarjeta} flex flex-col`}>
          <span className="text-sm text-slate-600">{t('empresas')}</span>
          <span className="text-2xl font-bold">{empresas.length}</span>
        </div>
        <div className={`${estilos.tarjeta} flex flex-col`}>
          <span className="text-sm text-slate-600">{t('alMes')}</span>
          <span className="text-2xl font-bold">{dinero.format(alMes)}</span>
        </div>
      </div>
      <Link href="/plataforma/nueva" className={`${estilos.boton} flex items-center justify-center`}>
        {t('nueva')}
      </Link>
      {/* cuánto usa la app cada empresa y cada persona (D-101) */}
      <Link href="/plataforma/uso" className={`${estilos.botonSecundario} flex items-center justify-center`}>
        {t('usoDeLaApp')}
      </Link>
      <ul className="flex flex-col gap-2">
        {empresas.map((e) => (
          <li key={e.id}>
            <Link href={`/plataforma/${e.id}`} className={`${estilos.tarjeta} flex flex-col gap-1`}>
              <span className="flex items-start justify-between gap-2">
                <span className="font-semibold">{e.nombre}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-sm font-semibold ${COLOR_ESTADO[e.estado]}`}
                >
                  {t(`estados.${e.estado}`)}
                </span>
              </span>
              <span className="text-sm text-slate-700">
                {t('planPrecio', {
                  plan: t(`planes.${e.plan}`),
                  precio: dinero.format(e.precio),
                  ciclo: t(`ciclos.${e.ciclo}`),
                })}
              </span>
              <span className="text-sm text-slate-700">
                {e.venceEl ? t('vence', { dia: fecha(e.venceEl) }) : t('sinVencimiento')}
              </span>
              <span className="text-sm text-slate-600">
                {t('usoLinea', {
                  uso: t('uso', { pms: e.pms, obras: e.obrasEnCurso }),
                  ultimo: e.ultimoUso
                    ? t('ultimoUso', { dia: formato.relativeTime(e.ultimoUso, new Date()) })
                    : t('nuncaEntro'),
                })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Marco>
  );
}
