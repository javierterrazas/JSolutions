// La ubicación de la obra para la checada (D-117): el punto y el radio dentro del que los trabajadores pueden checar.
// Se fija con la ubicación de quien está en la obra (el dueño, el administrador o el PM de la obra).
import { geocercaDeObra } from '@ijm/servidor';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { comoMiembro, exigirAccesoCon } from '@/lib/acceso';
import { Marco, estilos } from '../../../componentes/marco';
import { FijarUbicacion } from './fijar-ubicacion';

export default async function Ubicacion({ params }: PageProps<'/obras/[id]/ubicacion'>) {
  const { id } = await params;
  const acceso = await exigirAccesoCon('checada');
  const r = await comoMiembro((tx) => geocercaDeObra(tx, { obraId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const g = r.datos;
  const t = await getTranslations('ubicacion');
  const volver =
    acceso.yo.rol === 'pm'
      ? { href: '/', texto: t('volverInicio') }
      : { href: `/obras/${id}/seguimiento`, texto: t('volverObra') };
  return (
    <Marco titulo={t('titulo')} subtitulo={`${g.obra.folio} · ${g.obra.cliente}`} volver={volver}>
      <p className="text-sm text-slate-700">{t('ayuda')}</p>
      <div className={`${estilos.tarjeta} flex flex-col gap-1 text-sm`}>
        {g.lat !== null && g.lng !== null ? (
          <>
            <p className="font-semibold text-emerald-800">{t('fijada', { metros: g.radio })}</p>
            <a
              href={`https://maps.google.com/?q=${g.lat},${g.lng}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-marca underline"
            >
              {t('verMapa')}
            </a>
          </>
        ) : (
          <p className="font-semibold text-amber-800">{t('sinFijar')}</p>
        )}
      </div>
      <FijarUbicacion obraId={g.obra.id} radio={g.radio} />
    </Marco>
  );
}
