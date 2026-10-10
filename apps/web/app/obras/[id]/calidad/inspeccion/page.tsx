// La inspección de un punto de control en un espacio (fase 2, paso 6a; legacy: vInspeccion de PM.html). Con
// ?espacio=…&hito=…. Si el punto exige la prueba de inundación (PC3), la muestra arriba, como el legacy.
import { datosParaInspeccion } from '@ijm/servidor';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { comoMiembro, exigirAcceso } from '@/lib/acceso';
import { Marco } from '../../../../componentes/marco';
import { PruebaAgua } from '../prueba-agua';
import { FormularioInspeccion } from './formulario-inspeccion';

export default async function Inspeccion({
  params,
  searchParams,
}: PageProps<'/obras/[id]/calidad/inspeccion'>) {
  const { id } = await params;
  const consulta = await searchParams;
  const espacio = typeof consulta.espacio === 'string' ? consulta.espacio : '';
  const hito = typeof consulta.hito === 'string' ? consulta.hito : '';
  const acceso = await exigirAcceso();
  if (acceso.yo.rol !== 'pm') redirect('/');
  const r = await comoMiembro(
    (tx) => datosParaInspeccion(tx, { obraId: id, espacioId: espacio, hitoId: hito }),
    acceso,
  );
  if (!r.ok || !r.datos) notFound();
  const d = r.datos;
  const [t, idioma] = await Promise.all([getTranslations('calidad'), getLocale()]);
  const nombre = (n: { es: string; en: string | null }) => (idioma === 'en' ? n.en : null) ?? n.es;

  return (
    <Marco titulo={`${d.hito.clave} ${nombre(d.hito.nombre)}`}>
      <Link href={`/obras/${d.obra.id}/calidad`} className="text-sm font-medium text-marca">
        {t('volverCalidad')}
      </Link>
      <p className="text-slate-700">
        {t('obraEspacio', { folio: d.obra.folio, cliente: d.obra.cliente, espacio: d.espacio.nombre })}
      </p>
      {d.hito.exigePruebaAgua ? (
        <PruebaAgua
          key={`${d.prueba?.id}|${d.prueba?.resultado}`}
          obraId={d.obra.id}
          espacioId={d.espacio.id}
          prueba={d.prueba}
          ahora={new Date().toISOString()}
        />
      ) : null}
      <FormularioInspeccion
        ids={{ obraId: d.obra.id, espacioId: d.espacio.id, hitoId: d.hito.id }}
        puntos={d.puntos.map((p) => ({ id: p.id, texto: nombre(p.texto), requiereFoto: p.requiereFoto }))}
      />
    </Marco>
  );
}
