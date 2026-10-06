'use client';
// El enlace de una invitación recién creada, para mandarlo: copiarlo o compartirlo (WhatsApp, mensaje, correo).
// Solo se ve aquí: la base guarda su hash, así que una invitación pendiente ya no se puede volver a mostrar.
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { EnlaceDeInvitacion } from '../acciones/equipo';
import { estilos } from '../componentes/marco';

export function EnlaceInvitacion({ invitacion }: { invitacion: EnlaceDeInvitacion }) {
  const t = useTranslations('equipo');
  const [copiado, setCopiado] = useState(false);
  const puedeCompartir = typeof navigator !== 'undefined' && 'share' in navigator;

  async function copiar() {
    await navigator.clipboard.writeText(invitacion.enlace);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-marca/30 bg-white p-4">
      <p className="font-semibold text-marca">{t('enlaceTitulo', { nombre: invitacion.nombre })}</p>
      <p className="text-sm text-slate-600">{t('enlaceTexto')}</p>
      <input
        readOnly
        value={invitacion.enlace}
        aria-label={t('copiar')}
        onFocus={(e) => e.currentTarget.select()}
        className={`${estilos.campo} text-sm`}
      />
      <div className="flex gap-2">
        <button type="button" onClick={copiar} className={`${estilos.boton} flex-1`}>
          {copiado ? t('copiado') : t('copiar')}
        </button>
        {puedeCompartir ? (
          <button
            type="button"
            onClick={() => navigator.share({ url: invitacion.enlace }).catch(() => {})}
            className={estilos.botonSecundario}
          >
            {t('compartir')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
