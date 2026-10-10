'use client';
// Tomar fotos con la cámara, comprimidas en el teléfono (lib/comprimir.ts), con su vista previa y "Quitar". Lo usan
// la inspección y la prueba de agua; el cierre tiene el suyo, que además las manda a la cola.
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { comprimirFoto } from '@/lib/comprimir';
import { estilos } from './marco';

export interface FotoTomada {
  readonly clave: number;
  readonly blob: Blob;
  readonly url: string;
}

/** Las fotos como archivos, para mandarlas en un FormData con el nombre `foto`. */
export function agregarAlFormulario(formulario: FormData, fotos: readonly FotoTomada[]) {
  formulario.delete('foto');
  fotos.forEach((f, i) => formulario.append('foto', f.blob, `foto-${i + 1}.jpg`));
}

export function CampoFotos({
  fotos,
  alCambiar,
  una = false,
  etiqueta,
}: {
  fotos: readonly FotoTomada[];
  alCambiar: (fotos: readonly FotoTomada[]) => void;
  /** Solo una foto (la del nivel del agua): tomar otra la reemplaza. */
  una?: boolean;
  etiqueta?: string;
}) {
  const t = useTranslations('fotos');
  const camara = useRef<HTMLInputElement>(null);

  async function agregar(archivos: FileList | null) {
    const nuevas: FotoTomada[] = [];
    let clave = Math.max(0, ...fotos.map((f) => f.clave));
    for (const archivo of Array.from(archivos ?? [])) {
      const blob = await comprimirFoto(archivo);
      nuevas.push({ clave: ++clave, blob, url: URL.createObjectURL(blob) });
    }
    alCambiar(una ? nuevas.slice(-1) : [...fotos, ...nuevas]);
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={camara}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={!una}
        hidden
        onChange={(e) => {
          void agregar(e.target.files);
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
                onClick={() => {
                  URL.revokeObjectURL(f.url);
                  alCambiar(fotos.filter((x) => x.clave !== f.clave));
                }}
                className="absolute right-1 bottom-1 rounded-full bg-white/90 px-2 text-xs font-medium text-red-700"
              >
                {t('quitar')}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" onClick={() => camara.current?.click()} className={estilos.botonSecundario}>
        {etiqueta ?? t('tomar')}
      </button>
      {una ? null : <p className="text-xs text-slate-500">{t('n', { n: fotos.length })}</p>}
    </div>
  );
}
