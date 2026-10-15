'use client';
// Una orden de cambio aprobada que el PM tiene que hacer (D-081): "Ya la hice" abre una nota y la cámara; al
// guardarla pasa a hechas, y el cliente la ve en su portal con las fotos.
import { useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import { marcarHecho } from './acciones/cambio-hecho';
import { agregarAlFormulario, CampoFotos, type FotoTomada } from './componentes/campo-fotos';
import { estilos } from './componentes/marco';
import { MensajeError } from './componentes/mensaje-error';

export function CambioPorHacer({ ordenId }: { ordenId: string }) {
  const t = useTranslations('inicioPm');
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState('');
  const [fotos, setFotos] = useState<readonly FotoTomada[]>([]);
  const [r, accion, enviando] = useActionState(marcarHecho.bind(null, ordenId), null);

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className={`${estilos.boton} mt-1`}>
        {t('yaLaHice')}
      </button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData();
        f.set('nota', nota);
        agregarAlFormulario(f, fotos);
        startTransition(() => accion(f));
      }}
      className="mt-1 flex flex-col gap-3"
    >
      <label className={estilos.etiqueta}>
        {t('notaCambio')}
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          maxLength={500}
          rows={2}
          className={`${estilos.campo} py-2`}
        />
      </label>
      <CampoFotos fotos={fotos} alCambiar={setFotos} />
      <p className="text-sm text-slate-600">{t('fotosCambioAyuda')}</p>
      <MensajeError problema={r && !r.ok ? r : null} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className={`${estilos.botonSecundario} flex-1`}
        >
          {t('cancelar')}
        </button>
        <button type="submit" disabled={enviando} className={`${estilos.boton} flex-1`}>
          {enviando ? t('guardando') : t('marcarHecha')}
        </button>
      </div>
    </form>
  );
}
