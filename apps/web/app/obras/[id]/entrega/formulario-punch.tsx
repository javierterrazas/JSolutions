'use client';
// Anotar un detalle del recorrido con el cliente (legacy: vEntrega y agregarPunch de PM.html): qué señaló, si es un
// defecto, un cambio de alcance o una expectativa, quién lo corrige y una foto opcional.
import type { OrigenPunch } from '@ijm/servidor';
import { useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import { anotarPunch } from '../../../acciones/entrega';
import { agregarAlFormulario, CampoFotos, type FotoTomada } from '../../../componentes/campo-fotos';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';

const ORIGENES: readonly OrigenPunch[] = ['defecto', 'cambio_alcance', 'expectativa'];

export function FormularioPunch({ obraId }: { obraId: string }) {
  const t = useTranslations('entrega');
  const [item, setItem] = useState('');
  const [origen, setOrigen] = useState<OrigenPunch>('defecto');
  const [responsable, setResponsable] = useState('');
  const [foto, setFoto] = useState<readonly FotoTomada[]>([]);
  const [r, accion, enviando] = useActionState(
    async (previo: Awaited<ReturnType<typeof anotarPunch>> | null, f: FormData) => {
      const res = await anotarPunch(obraId, previo, f);
      // listo para el siguiente detalle
      if (res.ok) {
        setItem('');
        setResponsable('');
        setFoto([]);
      }
      return res;
    },
    null,
  );

  function agregar() {
    const f = new FormData();
    f.set('item', item);
    f.set('origen', origen);
    f.set('responsable', responsable);
    agregarAlFormulario(f, foto);
    startTransition(() => {
      accion(f);
    });
  }

  const opcion = (activo: boolean) =>
    `min-h-11 flex-1 rounded-xl px-2 text-sm font-medium ${activo ? 'bg-marca text-white' : 'border border-marca/30 text-marca'}`;
  return (
    <fieldset className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <legend className="px-1 font-semibold text-marca">{t('agregarDetalle')}</legend>
      <textarea
        value={item}
        onChange={(e) => setItem(e.target.value)}
        rows={3}
        maxLength={500}
        aria-label={t('detalle')}
        placeholder={t('detalleEjemplo')}
        className={`${estilos.campo} py-2`}
      />
      <div className="flex flex-col gap-1">
        <p className={estilos.etiqueta}>{t('queEs')}</p>
        <div className="flex gap-2">
          {ORIGENES.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={origen === o}
              onClick={() => setOrigen(o)}
              className={opcion(origen === o)}
            >
              {t(`origenes.${o}`)}
            </button>
          ))}
        </div>
      </div>
      <label className={estilos.etiqueta}>
        {t('quienCorrige')}
        <input
          value={responsable}
          onChange={(e) => setResponsable(e.target.value)}
          maxLength={120}
          placeholder={t('quienEjemplo')}
          className={estilos.campo}
        />
      </label>
      <CampoFotos fotos={foto} alCambiar={setFoto} una etiqueta={t('fotoDetalle')} />
      {r?.ok ? (
        <p role="status" className="text-sm font-medium text-emerald-800">
          {t('agregado')}
        </p>
      ) : null}
      <MensajeError problema={r && !r.ok ? r : null} />
      <button type="button" disabled={enviando} onClick={agregar} className={estilos.boton}>
        {t('agregar')}
      </button>
    </fieldset>
  );
}
