'use client';
// Registra el service worker, que hace instalable la app y la abre sin señal (D-047). Solo en producción: en
// desarrollo guardaría versiones viejas de las páginas.
import { useEffect } from 'react';

export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // sin service worker la app funciona igual con señal, solo que no se instala ni abre sin señal
    });
  }, []);
  return null;
}
