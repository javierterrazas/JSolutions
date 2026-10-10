'use client';
// Marcar revisada una compra del PM arriba de su límite. Queda en la auditoría.
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { revisarGasto } from '../acciones/gastos';
import { estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';

export function BotonRevisado({ gastoId }: { gastoId: string }) {
  const t = useTranslations('revisionGastos');
  const [r, accion, enviando] = useActionState(revisarGasto.bind(null, gastoId), null);
  return (
    <form action={accion} className="mt-2 flex flex-col gap-2">
      <MensajeError problema={r && !r.ok ? r : null} />
      <button type="submit" disabled={enviando} className={estilos.botonSecundario}>
        {t('marcarRevisado')}
      </button>
    </form>
  );
}
