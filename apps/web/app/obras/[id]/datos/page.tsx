// Corregir los datos del alta de una obra (D-064): el cliente, su teléfono, la dirección y las notas, o cambiarle el
// PM. Solo el dueño o el administrador.
import { datosDeObra } from '@ijm/servidor';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { Marco } from '../../../componentes/marco';
import { FormularioDatos } from './formulario-datos';

export default async function DatosObra({ params }: PageProps<'/obras/[id]/datos'>) {
  const { id } = await params;
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => datosDeObra(tx, { obraId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const t = await getTranslations('datosObra');

  return (
    <Marco
      titulo={t('titulo')}
      subtitulo={r.datos.folio}
      volver={{ href: `/obras/${id}/seguimiento`, texto: t('volver') }}
    >
      <FormularioDatos obra={r.datos} />
    </Marco>
  );
}
