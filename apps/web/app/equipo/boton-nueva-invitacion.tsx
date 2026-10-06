'use client';
// Una invitación nueva para un miembro (un celular nuevo, o porque olvidó su PIN): anula la pendiente y muestra el
// enlace para mandarlo.
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { nuevaInvitacion } from '../acciones/equipo';
import { estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';
import { EnlaceInvitacion } from './enlace-invitacion';

export function BotonNuevaInvitacion({ miembro }: { miembro: { id: string; nombre: string } }) {
  const t = useTranslations('equipo');
  const [resultado, accion, enviando] = useActionState(nuevaInvitacion.bind(null, miembro), null);
  if (resultado?.ok) return <EnlaceInvitacion invitacion={resultado.datos} />;
  return (
    <form action={accion} className="flex flex-col gap-2">
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <button type="submit" disabled={enviando} className={estilos.botonSecundario}>
        {t('nuevaInvitacion')}
      </button>
    </form>
  );
}
