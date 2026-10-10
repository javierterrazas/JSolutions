'use client';
// Sin acceso (quitaron el celular o dieron de baja al miembro): el teléfono borra la copia y el PIN local (D-047).
import { useEffect } from 'react';
import { borrarCopia } from '@/lib/copia-telefono';

export function BorrarCopia() {
  useEffect(() => {
    borrarCopia().catch(() => {});
  }, []);
  return null;
}
