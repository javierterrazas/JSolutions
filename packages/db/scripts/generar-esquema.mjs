// Genera el esquema de Drizzle desde la base local (que a su vez sale de supabase/migrations/).
// Uso: pnpm db:esquema   (con `pnpm db:start` corriendo y las migraciones aplicadas con `pnpm db:reset`)
//
// drizzle-kit pull deja cuatro cosas que no sirven aquí, y este script las corrige:
//   · referencia auth.users como `users`, que no existe: se cambia por `authUsers` de drizzle-orm/supabase;
//   · genera relations.ts con propiedades repetidas (varias llaves al mismo destino): no se usa, se borra;
//   · deja una migración .sql y su carpeta meta: las migraciones se escriben a mano, se borran;
//   · deja las columnas bytea como `unknown(...)`, que no existe: se cambian por un tipo bytea propio.

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
// drizzle-kit no conoce bytea (el logo de la empresa, D-078): la deja como `unknown(...)`, que no existe
const conBytea = /\bunknown\(["']/.test(esquema);
esquema = esquema
  .replace(/\bunknown\((["'])/g, 'bytea($1')
  .replace(/^\s*\/\/ TODO: failed to parse database type 'bytea'\r?\n/gm, '');
esquema =
  '// ARCHIVO GENERADO por `pnpm db:esquema` desde supabase/migrations/. No lo edites: cambia la migración y\n' +
  '// vuelve a generarlo.\n' +
  "import { authUsers } from 'drizzle-orm/supabase';\n" +
  (conBytea
    ? "import { customType } from 'drizzle-orm/pg-core';\n" +
      "const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });\n"
    : '') +
  esquema;
writeFileSync(destino + 'schema.ts', esquema);

ejecutar('pnpm exec prettier --write src/esquema/generado');
