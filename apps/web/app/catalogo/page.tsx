// El catálogo, para el dueño: los tipos de obra con sus partidas, uno nuevo, y las etapas del presupuesto.
import { catalogoDeTipos } from '@ijm/servidor';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { Marco, estilos } from '../componentes/marco';
import { NuevaEtapa } from './nueva-etapa';
import { NuevoTipo } from './nuevo-tipo';

export default async function Catalogo() {
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => catalogoDeTipos(tx), acceso);
  const datos = r.ok ? r.datos : { tipos: [], etapas: [] };
  const [t, idioma] = await Promise.all([getTranslations('catalogo'), getLocale()]);
  const nombre = (n: { es: string; en: string | null }) => (idioma === 'en' ? n.en : null) ?? n.es;
  return (
    <Marco titulo={t('titulo')}>
      <Link href="/" className="text-sm font-medium text-marca">
        {t('volver')}
      </Link>
      <p className="text-sm text-slate-600">{t('ayuda')}</p>
      <ul className="flex flex-col gap-2">
        {datos.tipos.map((x) => (
          <li key={x.id}>
            <Link
              href={`/catalogo/${x.id}`}
              className={`${estilos.tarjeta} flex items-baseline justify-between gap-2 ${x.activo ? '' : 'opacity-60'}`}
            >
              <span className="font-semibold">{nombre(x.nombre)}</span>
              <span className="text-sm text-slate-600">
                {x.activo ? t('partidas', { n: x.partidas }) : t('dadoDeBaja')}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <NuevoTipo
        tipos={datos.tipos
          .filter((x) => x.activo && x.partidas > 0)
          .map((x) => ({ id: x.id, nombre: nombre(x.nombre) }))}
      />
      <h2 className="mt-2 text-lg font-bold text-marca">{t('etapas')}</h2>
      <p className="text-sm text-slate-600">{t('etapasAyuda')}</p>
      <p className="text-slate-700">{datos.etapas.map((e) => nombre(e.nombre)).join(' · ')}</p>
      <NuevaEtapa key={datos.etapas.length} />
    </Marco>
  );
}
