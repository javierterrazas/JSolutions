import type { ReactNode } from 'react';

// Las pantallas llegan en las fases 2 y 3, con next-intl: ningún texto visible queda fijo en el código.
export default function RaizLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
