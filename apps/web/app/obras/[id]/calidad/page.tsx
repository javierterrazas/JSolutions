// La calidad de una obra, para su PM (fase 2, paso 6a; legacy: la pantalla de calidad de PM.html): cada espacio con
// los puntos de control de sus partidas y cómo está su inspección, y la prueba de inundación donde un punto la exige.
import { datosParaCalidad } from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { comoMiembro, exigirAcceso } from '@/lib/acceso';
import { Marco, estilos } from '../../../componentes/marco';
import { PruebaAgua } from './prueba-agua';

export default async function Calidad({ params }: PageProps<'/obras/[id]/calidad'>) {
  const { id } = await params;
  const acceso = await exigirAcceso();
  if (acceso.yo.rol !== 'pm') redirect('/');
  const r = await comoMiembro((tx) => datosParaCalidad(tx, { obraId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const d = r.datos;
  const [t, formato, idioma] = await Promise.all([getTranslations('calidad'), getFormatter(), getLocale()]);
  const nombre = (n: { es: string; en: string | null }) => (idioma === 'en' ? n.en : null) ?? n.es;
  const ahora = new Date().toISOString();

  return (
    <Marco titulo={t('titulo')}>
      <Link href="/" className="text-sm font-medium text-marca">
        {t('volver')}
      </Link>
      <p className="text-slate-700">{t('obra', { folio: d.obra.folio, cliente: d.obra.cliente })}</p>
      {d.espacios.length === 0 ? <p className="text-slate-600">{t('sinPuntos')}</p> : null}
      {d.espacios.map((e) => (
        <section key={e.id} className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-marca">{e.nombre}</h2>
          <ul className="flex flex-col gap-2">
            {e.hitos.map((h) => {
              const aprobada = h.ultima?.resultado === 'aprobado';
              return (
                <li key={h.id} className={`${estilos.tarjeta} flex flex-col gap-2`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold">
                      {h.clave} {nombre(h.nombre)}
                    </p>
                    <p
                      className={`shrink-0 text-sm font-medium ${aprobada ? 'text-emerald-700' : h.ultima ? 'text-red-700' : h.enCurso ? 'text-amber-700' : 'text-slate-500'}`}
                    >
                      {aprobada
                        ? t('aprobada')
                        : h.ultima
                          ? t('conDefectos')
                          : h.enCurso
                            ? t('pendiente')
                            : t('todaviaNo')}
                    </p>
                  </div>
                  {h.ultima ? (
                    <p className="text-sm text-slate-600">
                      {t('ultima', {
                        dia: formato.dateTime(new Date(h.ultima.realizadaEn), { dateStyle: 'medium' }),
                        ok: h.ultima.puntosOk,
                        total: h.ultima.puntosTotal,
                      })}
                    </p>
                  ) : null}
                  <Link
                    href={`/obras/${d.obra.id}/calidad/inspeccion?${new URLSearchParams({ espacio: e.id, hito: h.id })}`}
                    className={`${aprobada ? estilos.botonSecundario : estilos.boton} flex items-center justify-center`}
                  >
                    {aprobada || h.ultima ? t('inspeccionarOtraVez') : t('inspeccionar')}
                  </Link>
                </li>
              );
            })}
          </ul>
          {e.necesitaPrueba ? (
            <PruebaAgua
              key={`${e.prueba?.id}|${e.prueba?.resultado}`}
              obraId={d.obra.id}
              espacioId={e.id}
              prueba={e.prueba}
              ahora={ahora}
            />
          ) : null}
        </section>
      ))}
    </Marco>
  );
}
