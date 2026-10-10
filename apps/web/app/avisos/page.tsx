// Los avisos abiertos de los PMs, para que el dueño los conteste (fase 2, paso 6c; legacy: la cola de bloqueos del
// inicio del administrador y duResponderBloqueo). Los que llevan más tiempo primero, con su compromiso de respuesta.
// Una lista mínima: las pantallas del dueño llegan en la fase 3.
import { avisosAbiertos } from '@ijm/servidor';
import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { Marco, estilos } from '../componentes/marco';
import { ResponderAviso } from './responder-aviso';

export default async function AvisosAbiertos() {
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => avisosAbiertos(tx), acceso);
  const lista = r.ok ? r.datos : [];
  const [t, ta, formato] = await Promise.all([
    getTranslations('avisosAbiertos'),
    getTranslations('aviso'),
    getFormatter(),
  ]);
  return (
    <Marco titulo={t('titulo')}>
      <Link href="/" className="text-sm font-medium text-marca">
        {t('volver')}
      </Link>
      {lista.length === 0 ? <p className={estilos.tarjeta}>{t('ninguno')}</p> : null}
      <ul className="flex flex-col gap-3">
        {lista.map((a) => (
          <li
            key={a.id}
            className={`${estilos.tarjeta} flex flex-col gap-2 ${a.fueraDeSla ? 'border-red-300' : ''}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">{ta(`tipos.${a.tipo}`)}</p>
              <p className="shrink-0 text-xs text-slate-500">{a.folio}</p>
            </div>
            <p className="text-sm text-slate-700">
              {t('obraPm', { folio: a.obra.folio, cliente: a.obra.cliente, pm: a.pm })}
            </p>
            <p className={`text-sm font-medium ${a.fueraDeSla ? 'text-red-700' : 'text-slate-600'}`}>
              {t(a.fueraDeSla ? 'horasFuera' : 'horas', {
                horas: a.horas,
                cuando: formato.dateTime(new Date(a.creadoEn), {
                  weekday: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                }),
              })}
            </p>
            {a.detiene ? <p className="text-sm font-semibold text-red-700">{t('detiene')}</p> : null}
            <p className="text-slate-800">{a.descripcion}</p>
            {a.fotos.length ? (
              <ul className="grid grid-cols-3 gap-2">
                {a.fotos.map((f) => (
                  <li key={f}>
                    <a href={`/fotos/${f}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- un enlace firmado de pocos minutos, no se optimiza */}
                      <img
                        src={`/fotos/${f}`}
                        alt=""
                        className="aspect-square w-full rounded-lg bg-slate-100 object-cover"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            <ResponderAviso avisoId={a.id} />
          </li>
        ))}
      </ul>
    </Marco>
  );
}
