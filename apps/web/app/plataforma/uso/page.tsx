// El uso de la app (D-101): solo para quien administra la plataforma. Por empresa y por persona, en los últimos 7, 30
// o 90 días: los días que la abrió, el tiempo, las veces que entró, la última vez, lo que capturó y cuánto tarda cada
// PM en cerrar el día (la meta del piloto: menos de 60 segundos). Y de cada empresa, sus obras cerradas y en curso y
// su ticket promedio (D-111).
import { usoDeLaPlataforma } from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { comoMiembro } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { exigirPlataforma } from '@/lib/plataforma';
import { Marco, estilos } from '../../componentes/marco';
import { MensajeError } from '../../componentes/mensaje-error';

const PERIODOS = [7, 30, 90] as const;

export default async function UsoDeLaApp({ searchParams }: PageProps<'/plataforma/uso'>) {
  const consulta = await searchParams;
  const dias = PERIODOS.find((p) => String(p) === consulta.dias) ?? 7;
  const acceso = await exigirPlataforma();
  const r = await comoMiembro((tx) => usoDeLaPlataforma(tx, { dias }), acceso);
  const [t, formato, idioma] = await Promise.all([getTranslations('uso'), getFormatter(), getLocale()]);
  const dinero = (n: number) => formatoDinero(idioma).format(n);
  const volver = { href: '/plataforma', texto: t('volver') };
  if (!r.ok)
    return (
      <Marco titulo={t('titulo')} volver={volver}>
        <MensajeError problema={r} />
      </Marco>
    );
  const tiempo = (min: number) =>
    min >= 60 ? t('horasMinutos', { h: Math.floor(min / 60), m: min % 60 }) : t('minutos', { n: min });

  return (
    <Marco titulo={t('titulo')} volver={volver}>
      <p className="text-sm text-slate-600">{t('ayuda')}</p>
      <nav className="grid grid-cols-3 gap-1">
        {PERIODOS.map((p) => (
          <Link
            key={p}
            href={`/plataforma/uso?dias=${p}`}
            aria-current={p === dias ? 'page' : undefined}
            className={`flex min-h-11 items-center justify-center rounded-xl border text-sm font-semibold ${p === dias ? 'border-marca bg-marca text-white' : 'border-slate-300 bg-white text-slate-700'}`}
          >
            {t('ultimosDias', { n: p })}
          </Link>
        ))}
      </nav>
      {r.datos.empresas.map((e) => (
        <section key={e.id} className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-marca">{e.nombre}</h2>
          <p className="text-sm text-slate-700">
            {t('resumenEmpresa', { tiempo: tiempo(e.minutos), activas: e.activas, total: e.personas.length })}
          </p>
          <p className="text-sm font-medium text-slate-800">
            {t('obrasEmpresa', {
              cerradas: e.obras.cerradas,
              periodo: e.obras.cerradasPeriodo,
              enCurso: e.obras.enCurso,
            })}
          </p>
          <p className="text-sm text-slate-700">
            {t('ticketEmpresa', {
              cerradas: e.obras.ticketCerradas === null ? '—' : dinero(e.obras.ticketCerradas),
              enCurso: e.obras.ticketEnCurso === null ? '—' : dinero(e.obras.ticketEnCurso),
            })}
          </p>
          <ul className="flex flex-col gap-2">
            {e.personas.map((p) => (
              <li key={p.id} className={`${estilos.tarjeta} flex flex-col gap-1 text-sm`}>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {t('persona', { nombre: p.nombre, rol: t(`roles.${p.rol}`) })}
                  </span>
                  <span className="font-semibold">{tiempo(p.minutos)}</span>
                </span>
                <span className="text-slate-700">
                  {p.minutos
                    ? t('uso', {
                        dias: p.dias,
                        sesiones: p.sesiones,
                        promedio: tiempo(Math.round(p.minutos / Math.max(1, p.dias))),
                      })
                    : t('noEntro')}
                </span>
                <span className="text-slate-600">
                  {p.ultimoUso
                    ? t('ultimaVez', { cuando: formato.relativeTime(p.ultimoUso, new Date()) })
                    : t('nunca')}
                </span>
                <span className="text-slate-700">
                  {t('acciones', {
                    cierres: p.cierres,
                    gastos: p.gastos,
                    avisos: p.avisos,
                    fotos: p.fotos,
                    cobros: p.cobros,
                  })}
                </span>
                {p.segundosCierre !== null ? (
                  <span className={p.segundosCierre <= 60 ? 'text-emerald-800' : 'text-amber-800'}>
                    {t('cierreTarda', { s: p.segundosCierre })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Marco>
  );
}
