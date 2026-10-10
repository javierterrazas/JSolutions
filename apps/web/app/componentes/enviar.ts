// Enviar un formulario a su acción sin que React lo vacíe. Con `<form action>`, React lo regresa a sus valores
// iniciales al terminar, también cuando la acción lo rechaza: el dueño perdería lo que capturó.
import { type FormEvent, startTransition } from 'react';

export const enviarSinVaciar =
  (accion: (formulario: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formulario = new FormData(e.currentTarget);
    startTransition(() => {
      accion(formulario);
    });
  };
