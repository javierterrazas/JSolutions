// El marco de cada pantalla en el teléfono: el nombre de la app, el título y, abajo, el idioma.
import type { ReactNode } from 'react';
import { NOMBRE_APP } from '../marca';
import { SelectorDeIdioma } from '../selector-de-idioma';

export function Marco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold tracking-wide text-marca/70 uppercase">{NOMBRE_APP}</p>
        <h1 className="text-2xl font-bold text-marca">{titulo}</h1>
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
  botonSecundario: 'min-h-11 rounded-xl border border-marca/30 px-4 text-sm font-medium text-marca',
  campo: 'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base',
  etiqueta: 'flex flex-col gap-1 text-sm font-medium text-slate-700',
  error: 'rounded-xl bg-red-50 p-3 text-sm text-red-800',
} as const;
