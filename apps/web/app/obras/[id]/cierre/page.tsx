// Cerrar el día de una obra (fase 2, paso 4). Solo el PM de la obra. Con ?dia=AAAA-MM-DD, uno de los días que le
// faltó cerrar (los últimos 2 laborables); la regla la revisa cerrarDia al guardar.
import { datosParaCierre } from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { comoMiembro, exigirAcceso } from '@/lib/acceso';
import { Marco, estilos } from '../../../componentes/marco';
import { FormularioCierre } from './formulario-cierre';

export default async function Cierre({ params, searchParams }: PageProps<'/obras/[id]/cierre'>) {
  const { id } = await params;
  const { dia } = await searchParams;
  const acceso = await exigirAcceso();
  if (acceso.yo.rol !== 'pm') redirect('/');
  const r = await comoMiembro(
    (tx) => datosParaCierre(tx, { obraId: id, dia: typeof dia === 'string' ? dia : null }),
    acceso,
  );
  if (!r.ok || !r.datos) notFound();
  const d = r.datos;
  const [t, formato, idioma] = await Promise.all([getTranslations('cierre'), getFormatter(), getLocale()]);
  const nombreDia = formato.dateTime(new Date(`${d.dia}T12:00:00`), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Marco titulo={d.tardio ? t('tituloTardio', { dia: nombreDia }) : t('titulo')}>
      <Link href="/" className="text-sm font-medium text-marca">
        {t('volver')}
      </Link>
      <p className="text-slate-700">{t('obra', { folio: d.obra.folio, cliente: d.obra.cliente })}</p>
      {d.yaCerrado ? (
        <p role="status" className={estilos.tarjeta}>
          {t('yaCerrado')}
        </p>
      ) : (
        <FormularioCierre
          datos={{
            obraId: d.obra.id,
            dia: d.dia,
            tardio: d.tardio,
            espacios: d.espacios.map((e) => ({
              id: e.id,
              nombre: e.nombre,
              partidas: e.partidas.map((p) => ({
                id: p.id,
                nombre: (idioma === 'en' ? p.nombre.en : null) ?? p.nombre.es,
                enCurso: p.estado === 'en_progreso',
                hito: p.hito,
                faltaInspeccion: p.faltaInspeccion,
              })),
            })),
            trabajadores: d.trabajadores,
            subs: d.subs.map((s) => ({ ordenId: s.ordenId, sub: s.sub, alcance: s.alcance })),
            motivos: d.motivos,
          }}
        />
      )}
    </Marco>
  );
}
