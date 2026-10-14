// Una empresa nueva en la plataforma (D-080; antes, el script alta-empresa.mjs).
import { DIAS_PRUEBA, sumarDias } from '@ijm/core';
import { hoyDeLaPlataforma } from '@ijm/servidor';
import { getTranslations } from 'next-intl/server';
import { exigirPlataforma } from '@/lib/plataforma';
import { Marco } from '../../componentes/marco';
import { FormularioAlta } from './formulario-alta';

export default async function NuevaEmpresa() {
  await exigirPlataforma();
  const t = await getTranslations('plataforma');
  return (
    <Marco titulo={t('nueva')} volver={{ href: '/plataforma', texto: t('volverLista') }}>
      <p className="text-slate-700">{t('nuevaAyuda')}</p>
      <FormularioAlta venceEl={sumarDias(hoyDeLaPlataforma(), DIAS_PRUEBA)} />
    </Marco>
  );
}
