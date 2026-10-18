'use client';
// La unidad con que se cotiza una etapa (D-086): por pie², por pie lineal o fija por espacio (D-095). Se guarda al
// elegirla.
import { useTranslations } from 'next-intl';
import { startTransition, useActionState } from 'react';
import { cambiarUnidad } from '../acciones/catalogo';
import { estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';

export function UnidadEtapa({
  etapaId,
  nombre,
  unidad,
}: {
  etapaId: string;
  nombre: string;
  unidad: 'pie2' | 'pie_lineal' | 'fijo';
}) {
  const t = useTranslations('catalogo');
  const [r, accion, enviando] = useActionState(cambiarUnidad.bind(null, etapaId), null);
  return (
    <li className={`${estilos.tarjeta} flex flex-col gap-1`}>
      <label className="grid grid-cols-[1fr_10rem] items-center gap-2">
        <span className="font-medium">{nombre}</span>
        <select
          name="unidad"
          defaultValue={unidad}
          disabled={enviando}
          aria-label={t('unidadDe', { etapa: nombre })}
          onChange={(e) => {
            const f = new FormData();
            f.set('unidad', e.target.value);
            startTransition(() => accion(f));
          }}
          className={estilos.campo}
        >
          <option value="pie2">{t('unidades.pie2')}</option>
          <option value="pie_lineal">{t('unidades.pie_lineal')}</option>
          <option value="fijo">{t('unidades.fijo')}</option>
        </select>
      </label>
      <MensajeError problema={r && !r.ok ? r : null} />
    </li>
  );
}
