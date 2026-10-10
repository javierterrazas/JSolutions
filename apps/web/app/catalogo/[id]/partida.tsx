'use client';
// Una partida del tipo de obra: su resumen en un renglón, y editarla o darla de baja. Las dadas de baja se ven
// apagadas, con "Reactivar".
import type { PartidaDelCatalogo } from '@ijm/servidor';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { cambiarActivaDePartida } from '../../acciones/catalogo';
import { estilos } from '../../componentes/marco';
import { MensajeError } from '../../componentes/mensaje-error';
import { FormularioPartida, type Opciones } from './formulario-partida';

export function Partida({
  tipoId,
  partida: p,
  opciones,
  nombre,
}: {
  tipoId: string;
  partida: PartidaDelCatalogo;
  opciones: Opciones;
  nombre: string;
}) {
  const t = useTranslations('catalogo');
  const [editando, setEditando] = useState(false);
  const [resultado, accion, enviando] = useActionState(
    cambiarActivaDePartida.bind(null, p.id, !p.activa),
    null,
  );
  if (editando)
    return (
      <li>
        <FormularioPartida
          tipoId={tipoId}
          partida={p}
          opciones={opciones}
          alCerrar={() => {
            setEditando(false);
          }}
        />
      </li>
    );
  const de = (lista: readonly { id: string; nombre: string }[], id: string | null) =>
    lista.find((x) => x.id === id)?.nombre;
  const detalle = [
    t('dias', { n: p.dias }),
    p.espera ? t('espera', { n: p.espera }) : null,
    p.responsable === 'subcontratista'
      ? (de(opciones.oficios, p.oficioId) ?? t('responsable.subcontratista'))
      : t(`responsable.${p.responsable}`),
    p.paralelo ? t('conLaAnterior') : null,
  ].filter(Boolean);
  return (
    <li className={`${estilos.tarjeta} flex flex-col gap-1 ${p.activa ? '' : 'opacity-60'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">
          {p.activa ? `${p.orden}. ` : null}
          {nombre}
        </p>
        <p className="shrink-0 text-sm text-slate-600">{t('peso', { peso: p.peso })}</p>
      </div>
      <p className="text-sm text-slate-700">{detalle.join(' · ')}</p>
      <p className="text-sm text-slate-600">
        {de(opciones.etapas, p.etapaId) ?? t('sinEtapa')}
        {p.hitoId ? ` · ${de(opciones.hitos, p.hitoId) ?? ''}` : null}
      </p>
      {p.activa ? null : <p className="text-sm text-slate-600">{t('partidaDeBaja')}</p>}
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <div className="flex justify-end gap-2">
        {p.activa ? (
          <button
            type="button"
            onClick={() => {
              setEditando(true);
            }}
            className="min-h-11 px-2 text-sm font-medium text-marca"
          >
            {t('editar')}
          </button>
        ) : null}
        <form action={accion}>
          <button
            type="submit"
            disabled={enviando}
            className={`min-h-11 px-2 text-sm font-medium ${p.activa ? 'text-red-700' : 'text-marca'}`}
          >
            {p.activa ? t('darDeBaja') : t('reactivar')}
          </button>
        </form>
      </div>
    </li>
  );
}
