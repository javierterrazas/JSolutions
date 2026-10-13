'use client';
// Responder una orden de cambio en el portal (D-067): para aprobarla, el cliente escribe su nombre y firma con el
// dedo; para no aprobarla, puede decir por qué. La firma viaja como PNG (data URL) y queda guardada como evidencia.
import { useTranslations } from 'next-intl';
import { type PointerEvent, type RefObject, startTransition, useActionState, useRef, useState } from 'react';
import { responderCambio } from '../../acciones/portal';
import { estilos } from '../../componentes/marco';
import { MensajeError } from '../../componentes/mensaje-error';

/** El recuadro donde firma con el dedo (o el mouse). Avisa cuántos trazos lleva. */
function Firma({
  lienzo,
  alTrazar,
}: {
  lienzo: RefObject<HTMLCanvasElement | null>;
  alTrazar: (n: number) => void;
}) {
  const t = useTranslations('portal');
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  const trazos = useRef(0);

  const punto = (e: PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  };
  const preparar = (c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d')!;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    return ctx;
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-base font-medium text-slate-800">{t('firma')}</span>
      <canvas
        ref={lienzo}
        width={600}
        height={220}
        aria-label={t('firmaAyuda')}
        className="h-36 w-full touch-none rounded-xl border-2 border-dashed border-slate-400 bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          ultimo.current = punto(e);
        }}
        onPointerMove={(e) => {
          if (!ultimo.current) return;
          const p = punto(e);
          const ctx = preparar(e.currentTarget);
          ctx.beginPath();
          ctx.moveTo(ultimo.current.x, ultimo.current.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ultimo.current = p;
        }}
        onPointerUp={() => {
          if (!ultimo.current) return;
          ultimo.current = null;
          trazos.current += 1;
          alTrazar(trazos.current);
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-600">{t('firmaAyuda')}</span>
        <button
          type="button"
          className="min-h-10 px-2 text-sm font-semibold text-marca underline"
          onClick={() => {
            const c = lienzo.current;
            if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
            trazos.current = 0;
            alTrazar(0);
          }}
        >
          {t('borrarFirma')}
        </button>
      </div>
    </div>
  );
}

export function FirmarCambio({ token, ordenId }: { token: string; ordenId: string }) {
  const t = useTranslations('portal');
  const [resultado, accion, enviando] = useActionState(responderCambio.bind(null, token, ordenId), null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [nombre, setNombre] = useState('');
  const [trazos, setTrazos] = useState(0);
  const [noAprobar, setNoAprobar] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        f.set('decision', noAprobar ? 'rechazada' : 'aprobada');
        if (!noAprobar && lienzo.current) f.set('firma', lienzo.current.toDataURL('image/png'));
        startTransition(() => accion(f));
      }}
      className="flex flex-col gap-3 border-t border-slate-100 pt-3"
    >
      <label className={estilos.etiqueta}>
        {t('nombreCompleto')}
        <input
          name="nombre"
          required
          maxLength={120}
          autoComplete="name"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className={estilos.campo}
        />
      </label>
      {noAprobar ? (
        <label className={estilos.etiqueta}>
          {t('porQue')}
          <textarea name="comentario" rows={3} maxLength={1000} className={`${estilos.campo} py-2`} />
        </label>
      ) : (
        <Firma lienzo={lienzo} alTrazar={setTrazos} />
      )}
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      {noAprobar ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={estilos.botonSecundario} onClick={() => setNoAprobar(false)}>
            {t('volverAprobar')}
          </button>
          <button
            type="submit"
            disabled={enviando || !nombre.trim()}
            className="min-h-12 rounded-xl bg-red-700 px-4 font-semibold text-white disabled:opacity-50"
          >
            {t('enviarNoAprobar')}
          </button>
        </div>
      ) : (
        <>
          <button
            type="submit"
            disabled={enviando || !nombre.trim() || trazos === 0}
            className={estilos.boton}
          >
            {enviando ? t('enviando') : t('aprobar')}
          </button>
          <p className="text-sm text-slate-600">{t('aprobarLegal')}</p>
          <button
            type="button"
            className="min-h-12 rounded-xl px-4 font-semibold text-red-700"
            onClick={() => setNoAprobar(true)}
          >
            {t('noAprobar')}
          </button>
        </>
      )}
    </form>
  );
}
