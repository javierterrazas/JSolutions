'use client';
// Las preguntas del punto de control y sus fotos (legacy: vInspeccion y guardarInspeccion de PM.html). Se marca lo
// que sí cumple; "No aplica" saca la pregunta del total, pero queda registrada; lo que quede sin marcar es un
// defecto. Al menos una foto: lo que se cubre hoy no se vuelve a ver.
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { startTransition, useActionState, useState } from 'react';
import { guardarInspeccion } from '../../../../acciones/calidad';
import { agregarAlFormulario, CampoFotos, type FotoTomada } from '../../../../componentes/campo-fotos';
import { estilos } from '../../../../componentes/marco';
import { MensajeError } from '../../../../componentes/mensaje-error';

type Respuesta = 'cumple' | 'no_aplica' | null;

export function FormularioInspeccion({
  ids,
  puntos,
}: {
  ids: { obraId: string; espacioId: string; hitoId: string };
  puntos: readonly { id: string; texto: string; requiereFoto: boolean }[];
}) {
  const t = useTranslations('calidad');
  const [respuestas, setRespuestas] = useState<Record<string, Respuesta>>({});
  const [fotos, setFotos] = useState<readonly FotoTomada[]>([]);
  const [resultado, accion, enviando] = useActionState(guardarInspeccion.bind(null, ids), null);
  const [aviso, setAviso] = useState<string | null>(null);

  const marcar = (id: string, r: Respuesta) =>
    setRespuestas((rs) => ({ ...rs, [id]: rs[id] === r ? null : r }));
  const aplican = puntos.filter((p) => respuestas[p.id] !== 'no_aplica');
  const defectos = aplican.filter((p) => respuestas[p.id] !== 'cumple');

  function guardar() {
    setAviso(null);
    // como el legacy: lo que el teléfono ya sabe se dice antes de enviar; el servidor lo vuelve a revisar
    if (!aplican.length) return setAviso(t('ningunoAplica'));
    if (!fotos.length) return setAviso(t('sinFotos'));
    if (defectos.length && !window.confirm(t('confirmarDefectos', { n: defectos.length }))) return;
    const f = new FormData();
    for (const p of puntos) {
      if (respuestas[p.id] === 'cumple') f.append('cumple', p.id);
      if (respuestas[p.id] === 'no_aplica') f.append('noAplica', p.id);
    }
    agregarAlFormulario(f, fotos);
    startTransition(() => {
      accion(f);
    });
  }

  if (resultado?.ok)
    return (
      <div className="flex flex-col gap-3">
        <p
          role="status"
          className={`rounded-2xl p-4 text-lg font-semibold ${resultado.datos.resultado === 'aprobado' ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}
        >
          {resultado.datos.resultado === 'aprobado'
            ? t('guardadaAprobada')
            : t('guardadaConDefectos', { n: resultado.datos.defectos })}
        </p>
        <Link
          href={`/obras/${ids.obraId}/calidad`}
          className={`${estilos.boton} flex items-center justify-center`}
        >
          {t('volverCalidad')}
        </Link>
        <Link href="/" className={`${estilos.botonSecundario} flex items-center justify-center`}>
          {t('volver')}
        </Link>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">{t('ayudaInspeccion')}</p>
      <fieldset className={`${estilos.tarjeta} flex flex-col gap-2`}>
        <legend className="px-1 font-semibold text-marca">{t('revision')}</legend>
        {puntos.length === 0 ? <p className="text-sm text-slate-600">{t('sinPreguntas')}</p> : null}
        {puntos.map((p) => {
          const r = respuestas[p.id] ?? null;
          return (
            <div key={p.id} className="flex items-center gap-2 border-b border-slate-100 py-1 last:border-0">
              <button
                type="button"
                aria-pressed={r === 'cumple'}
                onClick={() => marcar(p.id, 'cumple')}
                className={`flex min-h-12 flex-1 items-center gap-3 rounded-xl px-2 text-left ${r === 'no_aplica' ? 'text-slate-400 line-through' : ''}`}
              >
                <span
                  aria-hidden
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg border-2 text-base font-bold ${r === 'cumple' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}
                >
                  {r === 'cumple' ? '✓' : r === 'no_aplica' ? '—' : ''}
                </span>
                <span className="flex flex-col">
                  <span>{p.texto}</span>
                  {p.requiereFoto ? (
                    <span className="text-xs text-slate-500">{t('requiereFoto')}</span>
                  ) : null}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={r === 'no_aplica'}
                onClick={() => marcar(p.id, 'no_aplica')}
                className={`min-h-11 shrink-0 rounded-lg px-2 text-xs font-medium ${r === 'no_aplica' ? 'bg-slate-700 text-white' : 'border border-slate-300 text-slate-600'}`}
              >
                {t('noAplica')}
              </button>
            </div>
          );
        })}
      </fieldset>
      <fieldset className={`${estilos.tarjeta} flex flex-col gap-3`}>
        <legend className="px-1 font-semibold text-marca">{t('fotos')}</legend>
        <p className="text-sm text-slate-600">{t('fotosAyuda')}</p>
        <CampoFotos fotos={fotos} alCambiar={setFotos} />
      </fieldset>
      {aviso ? (
        <p role="alert" className={estilos.error}>
          {aviso}
        </p>
      ) : null}
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <button type="button" disabled={enviando} onClick={guardar} className={estilos.boton}>
        {enviando ? t('guardando', { n: fotos.length }) : t('guardar')}
      </button>
    </div>
  );
}
