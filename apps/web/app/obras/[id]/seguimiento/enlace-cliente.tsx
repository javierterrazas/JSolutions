'use client';
// El enlace del portal del cliente (D-066), en el seguimiento de la obra: crearlo, copiarlo o compartirlo, y
// desactivarlo. El enlace se ve una sola vez, al crearlo (la base guarda su hash); si se pierde, se crea otro y el
// anterior deja de servir.
import { useFormatter, useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { crearEnlace, desactivarEnlace } from '../../../acciones/portal';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';

export function EnlaceCliente({
  obraId,
  enlace,
}: {
  obraId: string;
  /** El vigente, sin su token; null si la obra no tiene. */
  enlace: { creado: string; accesos: number; ultimoAcceso: string | null } | null;
}) {
  const t = useTranslations('enlaceCliente');
  const formato = useFormatter();
  const [creado, crear, creando] = useActionState(crearEnlace.bind(null, obraId), null);
  const [anulado, anular, anulando] = useActionState(desactivarEnlace.bind(null, obraId), null);
  const [copiado, setCopiado] = useState(false);
  const cuando = (d: string) => formato.dateTime(new Date(d), { dateStyle: 'medium', timeStyle: 'short' });

  const url = creado?.ok ? `${window.location.origin}/cliente/${creado.datos.token}` : null;
  const problema = (creado && !creado.ok ? creado : null) ?? (anulado && !anulado.ok ? anulado : null);

  return (
    <section className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <h2 className="font-semibold text-marca">{t('titulo')}</h2>
      <p className="text-sm text-slate-700">{t('ayuda')}</p>

      {url ? (
        <div className="flex flex-col gap-2 rounded-xl bg-emerald-50 p-3">
          <p role="status" className="text-sm font-semibold text-emerald-900">
            {t('listo')}
          </p>
          <input
            readOnly
            value={url}
            aria-label={t('enlace')}
            onFocus={(e) => e.currentTarget.select()}
            className={`${estilos.campo} text-sm`}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={estilos.boton}
              onClick={() => {
                void navigator.clipboard?.writeText(url).then(() => setCopiado(true));
              }}
            >
              {copiado ? t('copiado') : t('copiar')}
            </button>
            <button
              type="button"
              className={estilos.botonSecundario}
              onClick={() => {
                if (navigator.share) void navigator.share({ url }).catch(() => {});
                else void navigator.clipboard?.writeText(url).then(() => setCopiado(true));
              }}
            >
              {t('compartir')}
            </button>
          </div>
          <p className="text-xs text-emerald-900">{t('unaVez')}</p>
        </div>
      ) : enlace ? (
        <p className="text-sm text-slate-700">
          {t('activo', { creado: cuando(enlace.creado) })}{' '}
          {enlace.ultimoAcceso
            ? t('visto', { n: enlace.accesos, ultimo: cuando(enlace.ultimoAcceso) })
            : t('nuncaVisto')}
        </p>
      ) : (
        <p className="text-sm text-slate-700">{t('sinEnlace')}</p>
      )}

      <MensajeError problema={problema} />
      <form action={crear}>
        <button type="submit" disabled={creando} className={`${estilos.botonSecundario} w-full`}>
          {enlace || url ? t('crearOtro') : t('crear')}
        </button>
      </form>
      {enlace && !url ? (
        <form action={anular}>
          <button
            type="submit"
            disabled={anulando}
            className="min-h-12 w-full rounded-xl px-4 font-semibold text-red-700"
          >
            {t('desactivar')}
          </button>
        </form>
      ) : null}
    </section>
  );
}
