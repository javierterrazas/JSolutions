'use client';
// En el inicio del PM, con señal: guarda en el teléfono la copia para trabajar sin señal y confirma el PIN local
// (D-047), y le pide al service worker que guarde otra vez la app, por si cambió la versión o el idioma.
import type { CopiaSinSenal } from '@ijm/servidor';
import { useEffect } from 'react';
import { guardarCopia } from '@/lib/copia-telefono';

export function GuardarCopia({ copia }: { copia: CopiaSinSenal }) {
  useEffect(() => {
    guardarCopia(copia).catch(() => {
      // sin IndexedDB la app funciona igual con señal; solo no se podrá abrir sin ella
    });
    navigator.serviceWorker?.ready
      .then((r) => r.active?.postMessage({ tipo: 'guardar-app', idioma: document.documentElement.lang }))
      .catch(() => {});
  }, [copia]);
  return null;
}
