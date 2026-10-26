// Conectar un asistente, para el dueño (D-114): sus llaves (crear una, ver cuándo se usó, quitarla), cómo conectarlo
// a Claude, y las últimas consultas que hizo el asistente. Solo con el módulo; solo el dueño, no el administrador.
import { llavesDelAsistente } from '@ijm/servidor';
import { getFormatter, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { quitarLlave } from '@/app/acciones/asistente';
import { comoMiembro, exigirDuenoCon } from '@/lib/acceso';
import { Marco, estilos } from '../../componentes/marco';
import { MensajeError } from '../../componentes/mensaje-error';
import { FormularioLlave } from './formulario-llave';

export default async function Asistente() {
  const acceso = await exigirDuenoCon('asistente');
  if (acceso.yo.rol !== 'dueno') redirect('/empresa');
  const r = await comoMiembro((tx) => llavesDelAsistente(tx), acceso);
  const [t, formato] = await Promise.all([getTranslations('asistente'), getFormatter()]);
  const volver = { href: '/empresa', texto: t('volver') };
  if (!r.ok)
    return (
      <Marco titulo={t('titulo')} volver={volver}>
        <MensajeError problema={r} />
      </Marco>
    );
  const { llaves, consultas } = r.datos;
  const cuando = (d: Date) =>
    formato.dateTime(d, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const vigentes = llaves.filter((l) => !l.quitada);
  const quitadas = llaves.filter((l) => l.quitada);

  return (
    <Marco titulo={t('titulo')} volver={volver}>
      <p className="text-sm text-slate-700">{t('ayuda')}</p>
      <section className={`${estilos.tarjeta} flex flex-col gap-2 text-sm text-slate-700`}>
        <h2 className="font-semibold text-marca">{t('comoTitulo')}</h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5">
          <li>{t('paso1')}</li>
          <li>{t('paso2')}</li>
          <li>{t('paso3')}</li>
          <li>{t('paso4')}</li>
        </ol>
        <p className="text-slate-600">{t('seguridad')}</p>
      </section>

      <FormularioLlave />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-marca">{t('llaves')}</h2>
        {vigentes.length === 0 ? <p className={estilos.tarjeta}>{t('sinLlaves')}</p> : null}
        <ul className="flex flex-col gap-2">
          {vigentes.map((l) => (
            <li key={l.id} className={`${estilos.tarjeta} flex flex-col gap-1 text-sm`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{l.nombre}</span>
                <span className="font-mono text-xs text-slate-500">
                  {t('inicioLlave', { inicio: l.inicio })}
                </span>
              </div>
              <p className="text-slate-700">
                {[
                  t('creada', { fecha: cuando(l.creada) }),
                  l.ultimoUso ? t('usada', { fecha: cuando(l.ultimoUso) }) : t('sinUso'),
                ].join(' · ')}
              </p>
              <p className="text-slate-600">{t('consultas', { n: l.consultas })}</p>
              <form action={quitarLlave.bind(null, l.id)}>
                <button type="submit" className={`${estilos.botonSecundario} w-full text-red-700`}>
                  {t('quitar')}
                </button>
              </form>
            </li>
          ))}
        </ul>
        {quitadas.length ? (
          <p className="text-sm text-slate-500">
            {t('quitadas', { nombres: quitadas.map((l) => l.nombre).join(', ') })}
          </p>
        ) : null}
      </section>

      {consultas.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold text-marca">{t('ultimasConsultas')}</h2>
          <ul className={`${estilos.tarjeta} flex flex-col gap-1 text-sm`}>
            {consultas.map((c, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className={c.ok ? 'text-slate-700' : 'text-red-700'}>
                  {[
                    t.has(`herramientas.${c.herramienta}` as 'herramientas.obras')
                      ? t(`herramientas.${c.herramienta}` as 'herramientas.obras')
                      : c.herramienta,
                    typeof c.argumentos.folio === 'string' ? c.argumentos.folio : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span className="shrink-0 text-slate-500">{cuando(c.en)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Marco>
  );
}
