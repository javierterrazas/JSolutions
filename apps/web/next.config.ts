import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Lo que el navegador puede cargar (D-055): todo de la app misma, y las fotos desde Storage (/fotos/[id] redirige a
// un enlace firmado de Supabase). Next pone su código en etiquetas <script> en la página, por eso 'unsafe-inline';
// lo que cierra la puerta es que nada se carga de otro lado. Solo en producción: `next dev` necesita eval.
const storage = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : '';
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${storage}`,
  "connect-src 'self'",
  "font-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const config: NextConfig = {
  // los paquetes del monorepo se publican como TypeScript sin compilar
  transpilePackages: ['@ijm/core', '@ijm/db', '@ijm/servidor'],
  // las fotos del cierre pasan por una acción del servidor: llegan comprimidas (unos 500 KB), y el tope de Vercel
  // para una petición es 4.5 MB
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // siempre por https (en http, como en local, el navegador la ignora)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          ...(process.env.NODE_ENV === 'production' ? [{ key: 'Content-Security-Policy', value: CSP }] : []),
        ],
      },
      {
        // el service worker nunca se guarda en caché: cada versión nueva de la app llega en cuanto se publica
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default createNextIntlPlugin('./i18n/request.ts')(config);
