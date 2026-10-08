// Vuelve a generar la plantilla estándar de datos iniciales (D-039) en docs/plantilla/. Correr después de cambiar
// src/importar/plantilla.ts: una prueba revisa que el archivo esté al día.
//
//   pnpm plantilla
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generarPlantilla } from '../src/importar/plantilla';

const destino = fileURLToPath(
  new URL('../../../docs/plantilla/Plantilla_datos_iniciales_J_Solutions.xlsx', import.meta.url),
);
writeFileSync(destino, generarPlantilla());
console.log(`Plantilla generada: ${destino}`);
