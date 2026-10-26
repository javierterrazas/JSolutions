// Los íconos de los botones de cada obra: dibujos de trazo, del color del texto. Acompañan al texto, no lo
// reemplazan: el lector de pantalla lee el texto y se salta el dibujo.

const TRAZOS = {
  gasto: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M9 8h6', 'M9 12h6', 'M9 16h3'],
  aviso: ['M12 4 2.5 20h19z', 'M12 10v4', 'M12 17v.5'],
  calidad: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M8 12.5l2.5 2.5 5.5-5.5'],
  subs: [
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    'M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5',
    'M16 4.3a3.5 3.5 0 0 1 0 6.4',
    'M18 14c2 .9 3.5 3 3.5 6',
  ],
  bitacora: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v5', 'M16 3v5', 'M8 14h3', 'M8 17h6'],
  entrega: ['M3 11l9-7 9 7', 'M5.5 9.5V20h13V9.5', 'M10 20v-5h4v5'],
  fotos: ['M3 8h4l2-3h6l2 3h4v12H3z', 'M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z'],
  ubicacion: [
    'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z',
    'M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  ],
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ nombre, className = 'size-6' }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`${className} shrink-0 fill-none stroke-current stroke-2`}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {TRAZOS[nombre].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
