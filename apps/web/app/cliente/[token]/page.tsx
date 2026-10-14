// El portal del cliente (D-066): con el enlace que le mandó la empresa, el cliente ve cómo va su remodelación, sin
// cuenta ni PIN. El avance, en qué va cada espacio, la entrega comprometida, los días trabajados del último mes y
// las fotos que el PM o el dueño marcaron para él; y sus órdenes de cambio, que aprueba con su firma (D-067). Del
// dinero, solo lo que se le cobra; nada de lo interno de la obra.
import { type CambioDelPortal, empresaDelPortal, portalCliente, sinUsuario } from '@ijm/servidor';
import type { Metadata } from 'next';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { estadoDeAcceso } from '@/lib/acceso';
import { recordarEmpresa } from '@/lib/empresa-de-la-peticion';
import { formatoDinero } from '@/lib/dinero';
import { servidor } from '@/lib/servidor';
import { Marco, estilos } from '../../componentes/marco';
import { FirmarCambio } from './firmar-cambio';

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
  // alguien del equipo que abrió el enlace en su celular (en la app instalada no hay barra de direcciones): le deja
  // regresar a la app. El cliente no tiene sesión y no lo ve (D-072). Antes que el portal, que pone su empresa.
  const delEquipo = (await estadoDeAcceso().catch(() => null))?.estado;
  const p = await sinUsuario(servidor(), (tx) => portalCliente(tx, { token })).catch(() => null);
  const [t, tc, tco, formato, idioma] = await Promise.all([
    getTranslations('portal'),
    getTranslations('cambios'),
    getTranslations('cobros'),
    getFormatter(),
    getLocale(),
  ]);
  const volver = delEquipo && delEquipo !== 'invalido' ? { href: '/', texto: t('volverApp') } : undefined;
  if (!p)
    return (
      <Marco titulo={t('noDisponible')} volver={volver}>
        <p className={estilos.tarjeta}>{t('noDisponibleTexto')}</p>
      </Marco>
    );
  // su empresa, con su logo (D-078)
  const marca = await sinUsuario(servidor(), (tx) => empresaDelPortal(tx, { token })).catch(() => null);
  recordarEmpresa({ nombre: p.empresa, ...(marca ?? {}) });

  const nombre = (n: { es: string; en: string | null }) => (idioma === 'en' ? n.en : null) ?? n.es;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  // un día de negocio a mediodía, para que ninguna zona horaria lo mueva de día
  const dia = (d: string) =>
    formato.dateTime(new Date(`${d}T12:00:00`), { weekday: 'long', day: 'numeric', month: 'long' });
  const fecha = (d: string) => formato.dateTime(new Date(`${d}T12:00:00`), { dateStyle: 'long' });

  const dinero = (n: number) => formatoDinero(idioma).format(n);
  const condicion = (c: string | null) =>
    c && tc.has(`condiciones.${c}` as never) ? tc(`condiciones.${c}` as never) : (c ?? '—');

  // sus órdenes de cambio: las por aprobar arriba; el contrato suma las autorizadas
  const { contrato, ordenes } = p.cambios;
  const autorizado = ordenes
    .filter((o) => o.estado === 'autorizada' || o.estado === 'facturada')
    .reduce((a, o) => a + o.precio, 0);
  const pagado = p.pagos.reduce((a, x) => a + x.monto, 0);
  const porAprobar = ordenes.filter((o) => o.estado === 'propuesta' && !o.respuesta);
  const respondidas = ordenes.filter((o) => o.estado !== 'propuesta' || o.respuesta);
  const Orden = ({ o, children }: { o: CambioDelPortal; children?: ReactNode }) => (
    <article className={`${estilos.tarjeta} flex flex-col gap-2`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{o.folio}</span>
        <span className="text-slate-700">{tc(`motivos.${o.motivo}` as never)}</span>
      </div>
      <p className="text-lg text-slate-900">{o.descripcion}</p>
      <dl className="flex flex-col gap-1 text-slate-800">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-600">{t('precio')}</dt>
          <dd className="text-right font-semibold">{t('precioValor', { precio: dinero(o.precio) })}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-600">{t('fecha')}</dt>
          <dd className="text-right">{o.dias ? t('mueveDias', { n: o.dias }) : t('noMueve')}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-600">{t('pago')}</dt>
          <dd className="text-right">{condicion(o.condicion)}</dd>
        </div>
        {contrato !== null && o.estado === 'propuesta' ? (
          <div className="flex justify-between gap-3 border-t border-slate-100 pt-1">
            <dt className="text-slate-600">{t('nuevoTotal')}</dt>
            <dd className="text-right font-semibold">{dinero(contrato + autorizado + o.precio)}</dd>
          </div>
        ) : null}
      </dl>
      {children}
    </article>
  );

  // lo que va en curso, sin repetir, y si nada va en curso, las etapas que siguen
  const unicos = (xs: string[]) => [...new Set(xs)];
  const enProceso = unicos(p.espacios.flatMap((e) => e.enCurso.map(nombre)));
  const siguen = unicos(
    p.espacios.filter((e) => e.estado !== 'terminado' && e.etapa).map((e) => nombre(e.etapa!)),
  );
  const terminado = p.espacios.length > 0 && p.espacios.every((e) => e.estado === 'terminado');

  // las fotos por día, en el orden en que llegan (lo más nuevo primero)
  const fotosPorDia: { dia: string; fotos: string[] }[] = [];
  for (const f of p.fotos) {
    const ultimo = fotosPorDia.at(-1);
    if (ultimo?.dia === f.dia) ultimo.fotos.push(f.id);
    else fotosPorDia.push({ dia: f.dia, fotos: [f.id] });
  }

  return (
    <Marco titulo={p.obra.cliente} subtitulo={p.obra.direccion} volver={volver}>
      {porAprobar.length ? (
        <Seccion titulo={t('porAprobar', { n: porAprobar.length })}>
          <p className="text-slate-700">{t('porAprobarAyuda')}</p>
          {porAprobar.map((o) => (
            <Orden key={o.id} o={o}>
              <FirmarCambio token={token} ordenId={o.id} />
            </Orden>
          ))}
        </Seccion>
      ) : null}

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

      {/* en qué se está trabajando, sin los espacios de la obra (lo pidió el dueño, D-069) */}
      <Seccion titulo={t('espacios')}>
        <div className={`${estilos.tarjeta} flex flex-col gap-2`}>
          {terminado ? (
            <p className="font-semibold text-emerald-800">{t('todoTerminado')}</p>
          ) : (
            <>
              <p className="font-semibold">{t('enProceso')}</p>
              {enProceso.length ? (
                <ul className="list-disc pl-5 text-slate-800">
                  {enProceso.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-700">
                  {siguen.length ? t('nadaEnProceso', { etapas: siguen.join(', ') }) : t('porEmpezar')}
                </p>
              )}
            </>
          )}
        </div>
      </Seccion>

      <Seccion titulo={t('trabajado')}>
        {p.dias.length === 0 ? <p className={estilos.tarjeta}>{t('sinDias')}</p> : null}
        <ul className="flex flex-col gap-2">
          {p.dias.map((d) => (
            <li key={d.dia} className={`${estilos.tarjeta} flex flex-col gap-1`}>
              <p className="font-semibold first-letter:uppercase">{dia(d.dia)}</p>
              {/* solo el trabajo, sin el espacio (D-069); el mismo trabajo en dos espacios, una vez */}
              {unicos(
                d.partidas.map((x) =>
                  t(x.terminada ? 'partidaTerminada' : 'partida', { partida: nombre(x.partida) }),
                ),
              ).map((x) => (
                <p key={x} className="text-slate-700">
                  {x}
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

      {respondidas.length ? (
        <Seccion titulo={t('cambios')}>
          {respondidas.map((o) => (
            <Orden key={o.id} o={o}>
              <p
                className={`font-semibold ${o.estado === 'rechazada' ? 'text-slate-700' : 'text-emerald-800'}`}
              >
                {o.respuesta
                  ? t(o.respuesta.decision === 'aprobada' ? 'aprobadaPor' : 'noAprobadaPor', {
                      nombre: o.respuesta.nombre,
                      dia: formato.dateTime(new Date(o.respuesta.cuando), { dateStyle: 'long' }),
                    })
                  : tc(`estados.${o.estado}` as never)}
              </p>
            </Orden>
          ))}
        </Seccion>
      ) : null}

      {/* sus pagos (D-071): lo que lleva pagado y su saldo */}
      {contrato !== null || p.pagos.length ? (
        <Seccion titulo={t('pagos')}>
          <dl className={`${estilos.tarjeta} flex flex-col gap-1`}>
            {contrato !== null ? (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-600">{t('totalConCambios')}</dt>
                <dd>{dinero(contrato + autorizado)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-slate-600">{t('pagado')}</dt>
              <dd className="text-emerald-800">{dinero(pagado)}</dd>
            </div>
            {contrato !== null ? (
              <div className="flex justify-between gap-3 border-t border-slate-100 pt-1 text-lg font-bold">
                <dt>{t('saldo')}</dt>
                <dd>{dinero(contrato + autorizado - pagado)}</dd>
              </div>
            ) : null}
          </dl>
          <ul className="flex flex-col gap-2">
            {p.pagos.map((x) => (
              <li key={x.folio} className={`${estilos.tarjeta} flex items-baseline justify-between gap-3`}>
                <span>
                  <span className="block font-semibold">
                    {tco.has(`conceptos.${x.concepto}` as never)
                      ? tco(`conceptos.${x.concepto}` as never)
                      : x.concepto}
                  </span>
                  <span className="text-sm text-slate-600">{fecha(x.fecha)}</span>
                </span>
                <span className="font-semibold">{dinero(x.monto)}</span>
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}

      <p className="text-sm text-slate-600">{t('privado', { empresa: p.empresa })}</p>
    </Marco>
  );
}
