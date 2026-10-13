// El marco de cada pantalla en el teléfono: el botón para volver, el nombre de la empresa, el título (con la obra
// debajo, si es de una) y, abajo, el idioma.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { empresaDeLaPeticion } from '@/lib/empresa-de-la-peticion';
import { NOMBRE_APP } from '../marca';
import { SelectorDeIdioma } from '../selector-de-idioma';

export interface Volver {
  readonly href: string;
  readonly texto: string;
}

export function Marco({
  titulo,
  subtitulo,
  volver,
  children,
}: {
  titulo: string;
  /** De qué obra es la pantalla: "OB-001 · Familia García". */
  subtitulo?: string;
  /** A dónde regresa el botón de arriba; sin él, la pantalla no lo lleva (el inicio, el PIN). */
  volver?: Volver;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex flex-col gap-3">
        {volver ? (
          <Link
            href={volver.href}
            className="flex min-h-12 items-center gap-2 self-start rounded-xl border-2 border-marca bg-white py-2 pr-4 pl-3 font-semibold text-marca active:bg-marca/10"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-5 shrink-0 fill-none stroke-current stroke-[2.5]"
            >
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {volver.texto}
          </Link>
        ) : null}
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold tracking-wide text-marca/80 uppercase">
            {empresaDeLaPeticion() ?? NOMBRE_APP}
          </p>
          <h1 className="text-2xl font-bold text-marca">{titulo}</h1>
          {subtitulo ? <p className="text-lg font-medium text-slate-800">{subtitulo}</p> : null}
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4">{children}</div>
      <SelectorDeIdioma />
    </main>
  );
}

export const estilos = {
  tarjeta: 'rounded-2xl border border-slate-200 bg-white p-4',
  boton:
    'min-h-12 rounded-xl bg-marca px-4 text-base font-semibold text-white disabled:opacity-50 active:opacity-80',
  botonSecundario:
    'min-h-12 rounded-xl border-2 border-marca/30 bg-white px-4 text-base font-semibold text-marca active:bg-marca/10',
  campo: 'min-h-12 w-full rounded-xl border border-slate-400 bg-white px-3 text-base',
  etiqueta: 'flex flex-col gap-1 text-base font-medium text-slate-800',
  error: 'rounded-xl bg-red-50 p-3 text-base text-red-800',
} as const;
