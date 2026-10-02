// Genera el esquema de Drizzle desde la base local (que a su vez sale de supabase/migrations/).
// Uso: pnpm db:esquema   (con `pnpm db:start` corriendo y las migraciones aplicadas con `pnpm db:reset`)
//
// drizzle-kit pull deja tres cosas que no sirven aquí, y este script las corrige:
//   · referencia auth.users como `users`, que no existe: se cambia por `authUsers` de drizzle-orm/supabase;
//   · genera relations.ts con propiedades repetidas (varias llaves al mismo destino): no se usa, se borra;
//   · deja una migración .sql y su carpeta meta: las migraciones se escriben a mano, se borran.

import { execSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const destino = raiz + 'src/esquema/generado/';
const ejecutar = (cmd) => execSync(cmd, { cwd: raiz, stdio: 'inherit' });

rmSync(destino, { recursive: true, force: true });
// drizzle-kit dibuja una barra de progreso: se guarda su salida y solo se muestra si falla
try {
  execSync('pnpm exec drizzle-kit pull', { cwd: raiz, stdio: 'pipe' });
} catch (e) {
  process.stderr.write(String(e.stdout ?? '') + String(e.stderr ?? ''));
  throw e;
}

rmSync(destino + 'meta', { recursive: true, force: true });
rmSync(destino + 'relations.ts', { force: true });
for (const f of readdirSync(destino)) if (f.endsWith('.sql')) rmSync(destino + f);

let esquema = readFileSync(destino + 'schema.ts', 'utf8');
esquema = esquema.replace(/foreignColumns: \[users\.id\]/g, 'foreignColumns: [authUsers.id]');
esquema =
  '// ARCHIVO GENERADO por `pnpm db:esquema` desde supabase/migrations/. No lo edites: cambia la migración y\n' +
  '// vuelve a generarlo.\n' +
  "import { authUsers } from 'drizzle-orm/supabase';\n" +
  esquema;
writeFileSync(destino + 'schema.ts', esquema);

ejecutar('pnpm exec prettier --write src/esquema/generado');
