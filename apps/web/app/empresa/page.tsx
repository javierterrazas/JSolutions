// "Mi empresa", para el dueño (D-078): el logo (llena todo el ícono, D-082) y el color con que su equipo instala la
// app, y el logo que sale arriba de cada pantalla y en el portal del cliente.
import { marcaDeMiEmpresa } from '@ijm/servidor';
import { getTranslations } from 'next-intl/server';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { Marco } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';
import { FormularioMarca } from './formulario-marca';

export default async function MiEmpresa() {
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => marcaDeMiEmpresa(tx), acceso);
  const t = await getTranslations('miEmpresa');
  return (
    <Marco titulo={t('titulo')} volver={{ href: '/', texto: t('volver') }}>
      <p className="text-sm text-slate-700">{t('ayuda')}</p>
      {r.ok ? <FormularioMarca marca={r.datos} /> : <MensajeError problema={r} />}
    </Marco>
  );
}
