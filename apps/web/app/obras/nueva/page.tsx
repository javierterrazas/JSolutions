import { datosParaObraNueva } from '@ijm/servidor';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { Marco } from '../../componentes/marco';
import { FormularioObra } from './formulario-obra';

export default async function ObraNueva() {
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => datosParaObraNueva(tx), acceso);
  const [t, to, idioma] = await Promise.all([
    getTranslations('obraNueva'),
    getTranslations('obras'),
    getLocale(),
  ]);
  const datos = r.ok ? r.datos : { tipos: [], pms: [] };
  return (
    <Marco titulo={t('titulo')}>
      <Link href="/obras" className="text-sm font-medium text-marca">
        {to('titulo')}
      </Link>
      <FormularioObra
        tipos={datos.tipos.map((x) => ({
          id: x.id,
          nombre: (idioma === 'en' ? x.nombre.en : null) ?? x.nombre.es,
          partidas: x.partidas,
        }))}
        pms={datos.pms}
      />
    </Marco>
  );
}
