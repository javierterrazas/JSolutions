'use client';
// El botón de canjear la invitación: mientras se canjea no se puede volver a tocar (D-115). Un segundo toque mandaba
// la invitación otra vez, ya usada, y la pantalla terminaba diciendo que no servía aunque sí se había canjeado.
import { useFormStatus } from 'react-dom';
import { estilos } from '../../componentes/marco';

export function BotonCanjear({ texto, enviando }: { texto: string; enviando: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${estilos.boton} w-full`}>
      {pending ? enviando : texto}
    </button>
  );
}
