'use client';
// Marcar corregido un detalle del punch list, con confirmación (legacy: cerrarPunch), y guardar la medida verificada
// de un espacio (legacy: guardarMedida).
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { guardarMedida, marcarCorregido } from '../../../acciones/entrega';
import { enviarSinVaciar } from '../../../componentes/enviar';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';

export function BotonCorregido({ obraId, punchId }: { obraId: string; punchId: string }) {
  const t = useTranslations('entrega');
  const [r, accion, enviando] = useActionState(marcarCorregido.bind(null, { obraId, punchId }), null);
  return (
    <form
      action={accion}
      onSubmit={(e) => {
        if (!window.confirm(t('confirmarCorregido'))) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <MensajeError problema={r && !r.ok ? r : null} />
      <button type="submit" disabled={enviando} className={estilos.botonSecundario}>
        {t('marcarCorregido')}
      </button>
    </form>
  );
}

export function FormularioMedida({
  obraId,
  espacioId,
  pies2,
  lineales,
}: {
  obraId: string;
  espacioId: string;
  pies2: number | null;
  lineales: number | null;
}) {
  const t = useTranslations('entrega');
  const [r, accion, enviando] = useActionState(guardarMedida.bind(null, { obraId, espacioId }), null);
  return (
    <form onSubmit={enviarSinVaciar(accion)} className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <label className={estilos.etiqueta}>
          {t('pies2')}
          <input
            name="pies2"
            inputMode="decimal"
            defaultValue={pies2 ?? ''}
            required
            className={estilos.campo}
          />
        </label>
        <label className={estilos.etiqueta}>
          {t('lineales')}
          <input
            name="lineales"
            inputMode="decimal"
            defaultValue={lineales ?? ''}
            className={estilos.campo}
          />
        </label>
      </div>
      {r?.ok ? (
        <p role="status" className="text-sm font-medium text-emerald-800">
          {t('medidaGuardada')}
        </p>
      ) : null}
      <MensajeError problema={r && !r.ok ? r : null} />
      <button type="submit" disabled={enviando} className={estilos.botonSecundario}>
        {t('guardarMedida')}
      </button>
    </form>
  );
}
