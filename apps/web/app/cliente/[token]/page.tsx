// El portal del cliente (D-066): con el enlace que le mandó la empresa, el cliente ve cómo va su remodelación, sin
// cuenta ni PIN. El avance, en qué va cada espacio, la entrega comprometida, los días trabajados del último mes y
// las fotos que el PM o el dueño marcaron para él. Nada de dinero ni de lo interno de la obra.
import { portalCliente, sinUsuario } from '@ijm/servidor';
import type { Metadata } from 'next';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { recordarEmpresa } from '@/lib/empresa-de-la-peticion';
import { servidor } from '@/lib/servidor';
import { Marco, estilos } from '../../componentes/marco';

// un enlace privado: que ningún buscador lo guarde
export const metadata: Metadata = { robots: { index: false, follow: false } };

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-marca">{titulo}</h2>
      {children}
    </section>
  );
}

export default async function Portal({ params }: PageProps<'/cliente/[token]'>) {
  const { token } = await params;
  const p = await sinUsuario(servidor(), (tx) => portalCliente(tx, { token })).catch(() => null);
  const [t, formato, idioma] = await Promise.all([getTranslations('portal'), getFormatter(), getLocale()]);
  if (!p)
    return (
      <Marco titulo={t('noDisponible')}>
        <p className={estilos.tarjeta}>{t('noDisponibleTexto')}</p>
      </Marco>
    );
  recordarEmpresa(p.empresa);

  const nombre = (n: { es: string; en: string | null }) => (idioma === 'en' ? n.en : null) ?? n.es;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  // un día de negocio a mediodía, para que ninguna zona horaria lo mueva de día
  const dia = (d: string) =>
    formato.dateTime(new Date(`${d}T12:00:00`), { weekday: 'long', day: 'numeric', month: 'long' });
  const fecha = (d: string) => formato.dateTime(new Date(`${d}T12:00:00`), { dateStyle: 'long' });

  // las fotos por día, en el orden en que llegan (lo más nuevo primero)
  const fotosPorDia: { dia: string; fotos: string[] }[] = [];
  for (const f of p.fotos) {
    const ultimo = fotosPorDia.at(-1);
    if (ultimo?.dia === f.dia) ultimo.fotos.push(f.id);
    else fotosPorDia.push({ dia: f.dia, fotos: [f.id] });
  }

  return (
    <Marco titulo={p.obra.cliente} subtitulo={p.obra.direccion}>
      <div className={`${estilos.tarjeta} flex flex-col gap-3`}>
        <p className="text-3xl font-bold text-marca">{t('avance', { pct: pct(p.avance.pct) })}</p>
        <div
          className="flex h-4 overflow-hidden rounded-full bg-slate-200"
          role="img"
          aria-label={t('avance', { pct: pct(p.avance.pct) })}
        >
          <div className="bg-marca" style={{ width: pct(p.avance.pct) }} />
        </div>
        <p className="text-slate-700">
          {t('trabajos', { terminados: p.avance.terminadas, total: p.avance.total })}
        </p>
        {p.obra.entregada ? (
          <p className="font-semibold text-emerald-800">
            {t('entregada', {
              dia: fecha(p.obra.entregada.dia),
              garantia: fecha(p.obra.entregada.garantiaVence),
            })}
          </p>
        ) : (
          <p className="font-semibold text-slate-800">
            {t('entrega', { dia: fecha(p.obra.entregaComprometida) })}
          </p>
        )}
      </div>

      <Seccion titulo={t('espacios')}>
        <ul className="flex flex-col gap-2">
          {p.espacios.map((e) => (
            <li key={e.nombre} className={`${estilos.tarjeta} flex flex-col gap-1`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{e.nombre}</span>
                <span className="text-slate-700">{pct(e.pct)}</span>
              </div>
              <p className="text-slate-700">
                {e.estado === 'terminado'
                  ? t('terminado')
                  : e.enCurso.length
                    ? t('enCurso', { trabajos: e.enCurso.map(nombre).join(', ') })
                    : e.etapa
                      ? t(e.estado === 'sin_iniciar' ? 'empieza' : 'sigue', { etapa: nombre(e.etapa) })
                      : t('porEmpezar')}
              </p>
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo={t('trabajado')}>
        {p.dias.length === 0 ? <p className={estilos.tarjeta}>{t('sinDias')}</p> : null}
        <ul className="flex flex-col gap-2">
          {p.dias.map((d) => (
            <li key={d.dia} className={`${estilos.tarjeta} flex flex-col gap-1`}>
              <p className="font-semibold first-letter:uppercase">{dia(d.dia)}</p>
              {d.partidas.map((x, i) => (
                <p key={i} className="text-slate-700">
                  {t(x.terminada ? 'partidaTerminada' : 'partida', {
                    espacio: x.espacio,
                    partida: nombre(x.partida),
                  })}
                </p>
              ))}
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo={t('fotos')}>
        {fotosPorDia.length === 0 ? <p className={estilos.tarjeta}>{t('sinFotos')}</p> : null}
        {fotosPorDia.map((d) => (
          <div key={d.dia} className="flex flex-col gap-2">
            <p className="font-semibold text-slate-800 first-letter:uppercase">{dia(d.dia)}</p>
            <ul className="grid grid-cols-2 gap-2">
              {d.fotos.map((f) => (
                <li key={f}>
                  <a href={`/cliente/${token}/fotos/${f}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- un enlace firmado de pocos minutos, no se optimiza */}
                    <img
                      src={`/cliente/${token}/fotos/${f}`}
                      alt={t('fotoDe', { dia: dia(d.dia) })}
                      loading="lazy"
                      className="aspect-square w-full rounded-xl bg-slate-100 object-cover"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Seccion>

      <p className="text-sm text-slate-600">{t('privado', { empresa: p.empresa })}</p>
    </Marco>
  );
}
