'use client';
// La checada de un trabajador en su tarjeta (D-117): si ya la tiene en su celular (y cuándo checó), o si tiene una
// invitación pendiente; mandarle una invitación (el enlace se ve una vez, para mandarlo por WhatsApp) y quitársela.
import { useFormatter, useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import { invitarAChecar, quitarChecada } from '../acciones/checada';
import { estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';

export function ChecadaDelTrabajador({
  trabajador,
  acceso,
}: {
  trabajador: { id: string; nombre: string };
  acceso: { estado: 'activo' | 'pendiente'; dispositivo: string | null; ultimoUso: string | null } | null;
}) {
  const t = useTranslations('checada');
  const formato = useFormatter();
  const [r, invitar, invitando] = useActionState(
    invitarAChecar.bind(null, trabajador.id, trabajador.nombre),
    null,
  );
  const [copiado, setCopiado] = useState(false);
  const enlace = r?.ok ? r.datos.enlace : null;
  const puedeCompartir = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <div className="flex flex-col gap-2 border-t border-slate-100 pt-2 text-sm">
      <p className="text-slate-700">
        {acceso?.estado === 'activo'
          ? t('enSuCelular', {
              dispositivo: acceso.dispositivo ?? '',
              uso: acceso.ultimoUso
                ? formato.dateTime(new Date(acceso.ultimoUso), {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : '—',
            })
          : acceso?.estado === 'pendiente'
            ? t('pendiente')
            : t('sinChecada')}
      </p>
      {enlace ? (
        <div className="flex flex-col gap-2 rounded-xl border border-marca/30 p-3">
          <p className="font-medium text-marca">{t('enlaceTitulo', { nombre: trabajador.nombre })}</p>
          <input
            readOnly
            value={enlace}
            aria-label={t('copiar')}
            onFocus={(e) => e.currentTarget.select()}
            className={`${estilos.campo} text-sm`}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(enlace);
                setCopiado(true);
              }}
              className={`${estilos.boton} flex-1`}
            >
              {copiado ? t('copiado') : t('copiar')}
            </button>
            {puedeCompartir ? (
              <button
                type="button"
                onClick={() => navigator.share({ url: enlace }).catch(() => {})}
                className={estilos.botonSecundario}
              >
                {t('compartir')}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={invitando}
            onClick={() => startTransition(() => invitar())}
            className={`${estilos.botonSecundario} ${acceso?.estado === 'activo' ? '' : 'col-span-2'}`}
          >
            {acceso?.estado === 'activo' ? t('otroCelular') : t('invitar')}
          </button>
          {acceso?.estado === 'activo' ? (
            <button
              type="button"
              onClick={() => startTransition(() => quitarChecada(trabajador.id))}
              className={`${estilos.botonSecundario} text-red-700`}
            >
              {t('quitar')}
            </button>
          ) : null}
        </div>
      )}
      <MensajeError problema={r && !r.ok ? r : null} />
    </div>
  );
}
