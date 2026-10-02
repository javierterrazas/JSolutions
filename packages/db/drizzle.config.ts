// drizzle-kit solo se usa para revisar que el esquema de Drizzle corresponda a la base (introspect / check).
// Las migraciones se escriben a mano en SQL, en supabase/migrations/: ahí viven RLS, funciones y políticas.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/esquema/index.ts',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  },
});
