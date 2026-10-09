'use client';
// Cerrar el día (fase 2, paso 4): en qué se trabajó y qué quedó terminado, quién de la cuadrilla estuvo, si llegó el
// sub, las fotos y las notas; o "hoy no hubo trabajo" con su motivo. Primero se guarda el cierre; después se suben
// las fotos una por una, cada una con su número (D-007), y la que falle se reintenta sin repetir las demás.
import type { ResultadoCierre } from '@ijm/servidor';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { comprimirFoto } from '@/lib/comprimir';
import { cerrarElDia, subirFotoDeCierre } from '../../../acciones/cierre';
import { estilos } from '../../../componentes/marco';
import { MensajeError, type Problema } from '../../../componentes/mensaje-error';

export interface DatosFormularioCierre {
  readonly obraId: string;
  readonly dia: string;
  readonly tardio: boolean;
  readonly espacios: readonly {
    id: string;
    nombre: string;
    partidas: readonly {
      id: string;
      nombre: string;
      enCurso: boolean;
      hito: string | null;
      faltaInspeccion: boolean;
    }[];
  }[];
  readonly trabajadores: readonly {
    id: string;
    nombre: string;
    puesto: string | null;
    tipoPago: 'hora' | 'dia';
  }[];
  readonly subs: readonly { ordenId: string; sub: string; alcance: string }[];
  readonly motivos: readonly string[];
}

interface Foto {
  readonly clave: number;
  readonly blob: Blob;
  readonly url: string;
  readonly tomadaEn: string;
}

type EstadoFoto = 'pendiente' | 'subiendo' | 'lista' | 'fallo';

export function FormularioCierre({ datos }: { datos: DatosFormularioCierre }) {
  const t = useTranslations('cierre');
  const [enviando, iniciar] = useTransition();
  const [problema, setProblema] = useState<Problema | null>(null);
  const [sinTrabajo, setSinTrabajo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [notas, setNotas] = useState('');
  // las que van en curso vienen marcadas: casi siempre se sigue con ellas
  const [trabajadas, setTrabajadas] = useState<ReadonlySet<string>>(
    () => new Set(datos.espacios.flatMap((e) => e.partidas.filter((p) => p.enCurso).map((p) => p.id))),
  );
  const [terminadas, setTerminadas] = useState<ReadonlySet<string>>(new Set());
  const [cuadrilla, setCuadrilla] = useState<Record<string, string>>({});
  const [subs, setSubs] = useState<Record<string, boolean>>({});
  const [fotos, setFotos] = useState<readonly Foto[]>([]);
  const [cierre, setCierre] = useState<ResultadoCierre | null>(null);
  const [estadoFotos, setEstadoFotos] = useState<readonly EstadoFoto[]>([]);
  const camara = useRef<HTMLInputElement>(null);

  const alternar = (conjunto: ReadonlySet<string>, id: string) => {
    const nuevo = new Set(conjunto);
    if (nuevo.has(id)) nuevo.delete(id);
    else nuevo.add(id);
    return nuevo;
  };

  async function agregarFotos(archivos: FileList | null) {
    for (const archivo of Array.from(archivos ?? [])) {
      const blob = await comprimirFoto(archivo);
      setFotos((fs) => [
        ...fs,
        {
          clave: Math.max(0, ...fs.map((f) => f.clave)) + 1,
          blob,
          url: URL.createObjectURL(blob),
          tomadaEn: new Date().toISOString(),
        },
      ]);
    }
  }

  async function subirFotos(bitacoraId: string, cuales: readonly number[]) {
    for (const i of cuales) {
      setEstadoFotos((e) => e.map((x, j) => (j === i ? 'subiendo' : x)));
      const f = new FormData();
      f.set('foto', fotos[i]!.blob, `foto-${i + 1}.jpg`);
      f.set('tomadaEn', fotos[i]!.tomadaEn);
      let ok = false;
      try {
        ok = (await subirFotoDeCierre(bitacoraId, i + 1, f)).ok;
      } catch {
        // sin señal: queda para reintentar
      }
      setEstadoFotos((e) => e.map((x, j) => (j === i ? (ok ? 'lista' : 'fallo') : x)));
    }
  }

  function cerrar() {
    setProblema(null);
    iniciar(async () => {
      const r = await cerrarElDia(null, {
        obraId: datos.obraId,
        tardio: datos.tardio ? datos.dia : null,
        capturado: new Date().toISOString(),
        sinTrabajo,
        motivo: sinTrabajo ? ((motivo || null) as never) : null,
        incidencia: notas.trim() || null,
        partidas: sinTrabajo ? [] : [...trabajadas],
        terminadas: sinTrabajo ? [] : [...terminadas].filter((p) => trabajadas.has(p)),
        cuadrilla: sinTrabajo
          ? []
          : Object.entries(cuadrilla)
              .map(([trabajadorId, v]) => ({ trabajadorId, cantidad: Number(v) }))
              .filter((c) => c.cantidad > 0),
        subs: Object.entries(subs).map(([ordenTrabajoId, llego]) => ({ ordenTrabajoId, llego })),
        fotosPorSubir: fotos.length,
      });
      if (!r.ok) {
        setProblema(r);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        return;
      }
      setCierre(r.datos);
      setEstadoFotos(fotos.map(() => 'pendiente'));
      await subirFotos(
        r.datos.bitacoraId,
        fotos.map((_, i) => i),
      );
    });
  }

  if (cierre) {
    const hechas = estadoFotos.filter((e) => e === 'lista').length;
    const fallaron = estadoFotos.flatMap((e, i) => (e === 'fallo' ? [i] : []));
    const subiendo = estadoFotos.some((e) => e === 'pendiente' || e === 'subiendo');
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-2xl bg-emerald-50 p-4 text-lg font-semibold text-emerald-900">
          {t('listo')}
        </p>
        {estadoFotos.length ? (
          <p className="text-sm text-slate-700">
            {subiendo
              ? t('subiendo', { hechas, total: estadoFotos.length })
              : fallaron.length
                ? t('fotosFallaron', { n: fallaron.length })
                : t('fotosListas')}
          </p>
        ) : null}
        {!subiendo && fallaron.length ? (
          <button
            type="button"
            onClick={() => iniciar(() => subirFotos(cierre.bitacoraId, fallaron))}
            className={estilos.boton}
          >
            {t('reintentar')}
          </button>
        ) : null}
        <Link href="/" className={`${estilos.botonSecundario} flex items-center justify-center`}>
          {t('volver')}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        cerrar();
      }}
      className="flex flex-col gap-4"
    >
      <label className={`${estilos.tarjeta} flex items-center gap-3 font-medium`}>
        <input
          type="checkbox"
          checked={sinTrabajo}
          onChange={(e) => setSinTrabajo(e.target.checked)}
          className="size-5"
        />
        {t('sinTrabajo')}
      </label>

      {sinTrabajo ? (
        <label className={estilos.etiqueta}>
          {t('motivo')}
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className={estilos.campo}>
            <option value="">{t('elegirMotivo')}</option>
            {datos.motivos.map((m) => (
              <option key={m} value={m}>
                {t(`motivos.${m}` as never)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <fieldset className={`${estilos.tarjeta} flex flex-col gap-3`}>
            <legend className="px-1 font-semibold text-marca">{t('partidas')}</legend>
            <p className="text-sm text-slate-600">{t('partidasAyuda')}</p>
            {datos.espacios.length === 0 ? (
              <p className="text-sm text-slate-600">{t('sinPartidas')}</p>
            ) : null}
            {datos.espacios.map((esp) => (
              <div key={esp.id} className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-slate-800">{esp.nombre}</p>
                {esp.partidas.map((p) => (
                  <div key={p.id} className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={trabajadas.has(p.id)}
                        onChange={() => {
                          setTrabajadas((s) => alternar(s, p.id));
                          if (trabajadas.has(p.id))
                            setTerminadas((s) => new Set([...s].filter((x) => x !== p.id)));
                        }}
                        className="size-5"
                      />
                      <span className="flex-1">{p.nombre}</span>
                      {p.enCurso ? <span className="text-xs text-marca">{t('enCurso')}</span> : null}
                    </label>
                    {trabajadas.has(p.id) ? (
                      p.faltaInspeccion ? (
                        <p className="pl-8 text-xs text-amber-800">
                          {t('faltaInspeccion', { hito: p.hito ?? '' })}
                        </p>
                      ) : (
                        <label className="flex items-center gap-3 pl-8 text-sm">
                          <input
                            type="checkbox"
                            checked={terminadas.has(p.id)}
                            onChange={() => setTerminadas((s) => alternar(s, p.id))}
                            className="size-5"
                          />
                          {t('terminada')}
                        </label>
                      )
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </fieldset>

          {datos.trabajadores.length ? (
            <fieldset className={`${estilos.tarjeta} flex flex-col gap-2`}>
              <legend className="px-1 font-semibold text-marca">{t('cuadrilla')}</legend>
              {datos.trabajadores.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm">
                    {w.nombre}
                    {w.puesto ? <span className="block text-xs text-slate-500">{w.puesto}</span> : null}
                  </span>
                  {w.tipoPago === 'hora' ? (
                    <label className="flex items-center gap-2 text-sm">
                      {t('horas')}
                      <input
                        value={cuadrilla[w.id] ?? ''}
                        onChange={(e) => setCuadrilla((c) => ({ ...c, [w.id]: e.target.value }))}
                        inputMode="decimal"
                        className={`${estilos.campo} w-20 text-center`}
                      />
                    </label>
                  ) : (
                    <select
                      value={cuadrilla[w.id] ?? '0'}
                      onChange={(e) => setCuadrilla((c) => ({ ...c, [w.id]: e.target.value }))}
                      className={`${estilos.campo} w-36`}
                    >
                      <option value="0">{t('noVino')}</option>
                      <option value="1">{t('diaCompleto')}</option>
                      <option value="0.5">{t('medioDia')}</option>
                    </select>
                  )}
                </div>
              ))}
            </fieldset>
          ) : null}

          <fieldset className={`${estilos.tarjeta} flex flex-col gap-3`}>
            <legend className="px-1 font-semibold text-marca">{t('fotos')}</legend>
            <p className="text-sm text-slate-600">{t('fotosAyuda')}</p>
            <input
              ref={camara}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              hidden
              onChange={(e) => {
                void agregarFotos(e.target.files);
                e.target.value = '';
              }}
            />
            {fotos.length ? (
              <ul className="grid grid-cols-3 gap-2">
                {fotos.map((f) => (
                  <li key={f.clave} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- es una foto local, aún sin subir */}
                    <img src={f.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => setFotos((fs) => fs.filter((x) => x.clave !== f.clave))}
                      className="absolute right-1 bottom-1 rounded-full bg-white/90 px-2 text-xs font-medium text-red-700"
                    >
                      {t('quitarFoto')}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <button type="button" onClick={() => camara.current?.click()} className={estilos.botonSecundario}>
              {t('tomarFoto')}
            </button>
            <p className="text-xs text-slate-500">{t('nFotos', { n: fotos.length })}</p>
          </fieldset>
        </>
      )}

      {datos.subs.length ? (
        <fieldset className={`${estilos.tarjeta} flex flex-col gap-2`}>
          <legend className="px-1 font-semibold text-marca">{t('subs')}</legend>
          {datos.subs.map((s) => (
            <div key={s.ordenId} className="flex flex-col gap-1">
              <p className="text-sm">
                {s.sub}
                {s.alcance ? <span className="block text-xs text-slate-500">{s.alcance}</span> : null}
              </p>
              <div className="flex gap-2">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    aria-pressed={subs[s.ordenId] === v}
                    onClick={() => setSubs((x) => ({ ...x, [s.ordenId]: v }))}
                    className={`${estilos.botonSecundario} flex-1 aria-pressed:bg-marca aria-pressed:text-white`}
                  >
                    {v ? t('llego') : t('noLlego')}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      ) : null}

      <label className={estilos.etiqueta}>
        {t('notas')}
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          className={`${estilos.campo} py-2`}
        />
      </label>

      <MensajeError problema={problema} />
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {enviando ? t('cerrando') : t('cerrar')}
      </button>
    </form>
  );
}
