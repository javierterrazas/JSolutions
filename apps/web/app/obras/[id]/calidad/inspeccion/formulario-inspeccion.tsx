'use client';
// Las preguntas del punto de control y sus fotos (legacy: vInspeccion y guardarInspeccion de PM.html). Se marca lo
// que sí cumple; "No aplica" saca la pregunta del total, pero queda registrada; lo que quede sin marcar es un
// defecto. La foto, solo donde protege (D-058): una por cada pregunta marcada "requiere foto" que cumple; si no hay
// ninguna así, la inspección se guarda sin fotos. Para que el PM revise lo menos posible (D-092): "Todo cumple" con
// un toque; al volver a inspeccionar, solo lo que falló (lo demás queda como estaba, con sus fotos); y lo que no
// aplicó en un espacio del mismo tipo ya viene marcado "No aplica".
import type { RespuestaPunto } from '@ijm/servidor';
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
  previa,
  noAplicaSugerido,
}: {
  ids: { obraId: string; espacioId: string; hitoId: string };
  puntos: readonly { id: string; texto: string; requiereFoto: boolean }[];
  previa: {
    resultado: 'aprobado' | 'con_defectos';
    respuestas: Readonly<Record<string, RespuestaPunto>>;
    conFoto: readonly string[];
  } | null;
  noAplicaSugerido: readonly string[];
}) {
  const t = useTranslations('calidad');
  const [respuestas, setRespuestas] = useState<Record<string, Respuesta>>(() =>
    Object.fromEntries(
      puntos.map((p) => {
        const antes = previa?.respuestas[p.id];
        if (antes) return [p.id, antes === 'no_cumple' ? null : antes];
        return [p.id, noAplicaSugerido.includes(p.id) ? 'no_aplica' : null];
      }),
    ),
  );
  // al volver a inspeccionar algo con defectos, de entrada solo lo que falló
  const fallaron =
    previa?.resultado === 'con_defectos'
      ? puntos.filter((p) => !previa.respuestas[p.id] || previa.respuestas[p.id] === 'no_cumple')
      : [];
  const [todas, setTodas] = useState(!fallaron.length);
  const [fotos, setFotos] = useState<readonly FotoTomada[]>([]);
  const [resultado, accion, enviando] = useActionState(guardarInspeccion.bind(null, ids), null);
  const [aviso, setAviso] = useState<string | null>(null);

  const conFoto = previa?.conFoto ?? [];
  const visibles = todas ? puntos : fallaron;
  const marcar = (id: string, r: Respuesta) =>
    setRespuestas((rs) => ({ ...rs, [id]: rs[id] === r ? null : r }));
  const todoCumple = () =>
    setRespuestas((rs) => ({
      ...rs,
      ...Object.fromEntries(visibles.filter((p) => rs[p.id] !== 'no_aplica').map((p) => [p.id, 'cumple'])),
    }));
  const aplican = puntos.filter((p) => respuestas[p.id] !== 'no_aplica');
  const defectos = aplican.filter((p) => respuestas[p.id] !== 'cumple');
  const piden = puntos.filter(
    (p) => p.requiereFoto && respuestas[p.id] === 'cumple' && !conFoto.includes(p.id),
  ).length;

  function guardar() {
    setAviso(null);
    // como el legacy: lo que el teléfono ya sabe se dice antes de enviar; el servidor lo vuelve a revisar
    if (!aplican.length) return setAviso(t('ningunoAplica'));
    if (fotos.length < piden) return setAviso(t('fotosFaltan', { n: piden - fotos.length }));
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
      <p className="text-sm text-slate-600">
        {fallaron.length && !todas ? t('soloFallaron', { n: fallaron.length }) : t('ayudaInspeccion')}
      </p>
      {!previa && noAplicaSugerido.length ? (
        <p className="text-sm text-slate-600">{t('noAplicaRecordado', { n: noAplicaSugerido.length })}</p>
      ) : null}
      <fieldset className={`${estilos.tarjeta} flex flex-col gap-2`}>
        <legend className="px-1 font-semibold text-marca">{t('revision')}</legend>
        {puntos.length === 0 ? <p className="text-sm text-slate-600">{t('sinPreguntas')}</p> : null}
        {visibles.length ? (
          <button type="button" onClick={todoCumple} className={estilos.botonSecundario}>
            {t('todoCumple')}
          </button>
        ) : null}
        {visibles.map((p) => {
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
                  {p.requiereFoto && !conFoto.includes(p.id) ? (
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
        {fallaron.length ? (
          <button
            type="button"
            onClick={() => setTodas((x) => !x)}
            className="min-h-11 self-start px-1 text-sm font-medium text-marca underline"
          >
            {todas ? t('verSoloFallaron', { n: fallaron.length }) : t('verTodas', { n: puntos.length })}
          </button>
        ) : null}
      </fieldset>
      <fieldset className={`${estilos.tarjeta} flex flex-col gap-3`}>
        <legend className="px-1 font-semibold text-marca">{t('fotos')}</legend>
        <p className="text-sm text-slate-600">
          {piden ? t('fotosPiden', { n: piden }) : t('fotosOpcionales')}
        </p>
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
