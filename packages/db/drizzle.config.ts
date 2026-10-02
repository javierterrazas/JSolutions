// Las migraciones SQL de supabase/migrations/ son la fuente de verdad: ahí viven RLS, funciones y políticas.
// El esquema de Drizzle se GENERA desde la base local con `pnpm db:esquema` (drizzle-kit pull), nunca se edita a
// mano; la prueba packages/db/pruebas/integracion/esquema.test.ts falla si se quedó atrás de las migraciones.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  out: './src/esquema/generado',
  schemaFilter: ['public'],
  introspect: { casing: 'preserve' },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  },
});
