// Las checadas de la cuadrilla, para el dueño o el administrador (D-117): las de un día (hoy, o el que se elija), por
// trabajador, con su obra, la hora, qué tan lejos del punto checó, su selfie y lo que se le contó; las que no tienen
// salida (de hoy o de días anteriores), para ponerla con su motivo; y anular una que estuvo mal.
import { type ChecadaDelDia, checadasDelDia } from '@ijm/servidor';
import { sumarDias } from '@ijm/core';
import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { comoMiembro, exigirDuenoCon } from '@/lib/acceso';
import { Marco, estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';
import { AnularChecada, PonerSalida } from './formularios';

export default async function Checadas({ searchParams }: PageProps<'/checadas'>) {
  const consulta = await searchParams;
  const pedido =
    typeof consulta.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(consulta.dia) ? consulta.dia : null;
  const acceso = await exigirDuenoCon('checada');
  const r = await comoMiembro((tx) => checadasDelDia(tx, { dia: pedido }), acceso);
  const [t, formato] = await Promise.all([getTranslations('checadas'), getFormatter()]);
  const volver = { href: '/', texto: t('volver') };
  if (!r.ok)
    return (
      <Marco titulo={t('titulo')} volver={volver}>
        <MensajeError problema={r} />
      </Marco>
    );
  const { hoy, dia, checadas, sinSalidaAntes } = r.datos;
  const hora = (d: Date) => formato.dateTime(d, { hour: 'numeric', minute: '2-digit' });
  const fecha = (d: string, largo = false) =>
    formato.dateTime(
      new Date(`${d}T12:00:00`),
      largo
        ? { weekday: 'long', day: 'numeric', month: 'long' }
        : { weekday: 'short', day: 'numeric', month: 'short' },
    );
  const selfie = (id: string) => (
    <a href={`/checadas/${id}/foto`} target="_blank" rel="noreferrer" className="shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/checadas/${id}/foto`}
        alt={t('selfie')}
        className="size-14 rounded-xl bg-slate-100 object-cover"
      />
    </a>
  );
  const tarjeta = (c: ChecadaDelDia, conDia = false) => (
    <li key={c.entradaId} className={`${estilos.tarjeta} flex flex-col gap-2 text-sm`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{c.trabajador}</span>
        <span className="text-slate-600">{c.obra.folio}</span>
      </div>
      <div className="flex items-center gap-3">
        {c.entradaConFoto ? selfie(c.entradaId) : null}
        <div className="flex flex-col">
          <span>
            {t('entrada', { hora: hora(c.entrada.en) })}
            {conDia
              ? ` · ${formato.dateTime(c.entrada.en, { weekday: 'short', day: 'numeric', month: 'short' })}`
              : ''}
          </span>
          {c.entrada.distancia !== null ? (
            <span className="text-xs text-slate-500">{t('distancia', { metros: c.entrada.distancia })}</span>
          ) : null}
          {c.entradaDespues ? <span className="text-xs text-amber-800">{t('enviadaDespues')}</span> : null}
        </div>
      </div>
      {c.salida ? (
        <div className="flex items-center gap-3">
          {c.salida.conFoto ? selfie(c.salida.id) : null}
          <div className="flex flex-col">
            <span>
              {t('salida', { hora: hora(c.salida.en) })}
              {c.horas !== null ? ` · ${t('contado', { n: c.horas })}` : ''}
            </span>
            {c.salida.origen === 'correccion' ? (
              <span className="text-xs text-amber-800">
                {t('corregida', { motivo: c.salida.motivo ?? '' })}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <p className="font-semibold text-amber-800">{t('sinSalida')}</p>
          <PonerSalida entradaId={c.entradaId} />
        </>
      )}
      <AnularChecada checadaId={c.entradaId} />
    </li>
  );
  const enLaObra = checadas.filter((c) => !c.salida).length;

  return (
    <Marco titulo={t('titulo')} volver={volver} subtitulo={fecha(dia, true)}>
      <p className="text-sm text-slate-600">{t('ayuda')}</p>
      <nav className="grid grid-cols-3 gap-2">
        <Link
          href={`/checadas?dia=${sumarDias(dia, -1)}`}
          className={`${estilos.botonSecundario} flex items-center justify-center`}
        >
          {t('anterior')}
        </Link>
        <Link href="/checadas" className={`${estilos.botonSecundario} flex items-center justify-center`}>
          {t('hoy')}
        </Link>
        {dia < hoy ? (
          <Link
            href={`/checadas?dia=${sumarDias(dia, 1)}`}
            className={`${estilos.botonSecundario} flex items-center justify-center`}
          >
            {t('siguiente')}
          </Link>
        ) : (
          <span />
        )}
      </nav>
      <p className="font-medium text-slate-700">
        {t('resumen', { checaron: new Set(checadas.map((c) => c.trabajadorId)).size, dentro: enLaObra })}
      </p>
      {checadas.length === 0 ? <p className={estilos.tarjeta}>{t('ninguna')}</p> : null}
      <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2">{checadas.map((c) => tarjeta(c))}</ul>

      {sinSalidaAntes.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold text-amber-800">
            {t('sinSalidaAntes', { n: sinSalidaAntes.length })}
          </h2>
          <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
            {sinSalidaAntes.map((c) => tarjeta(c, true))}
          </ul>
        </section>
      ) : null}
    </Marco>
  );
}
