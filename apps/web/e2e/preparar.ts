// Antes de las pruebas de pantalla, la base local vuelve a quedar como la deja el seed: cada prueba sabe qué hay.
// En la integración continua la base acaba de crearse y se salta (E2E_SIN_RESET=1).
import { execSync } from 'node:child_process';

export default function preparar(): void {
  if (process.env.E2E_SIN_RESET) return;
  execSync('pnpm exec supabase db reset', { stdio: 'inherit' });
}
