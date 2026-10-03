import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as esquema from './esquema/index';

/** La base local de `supabase start`. En cualquier otro entorno, DATABASE_URL es obligatoria. */
export const URL_BASE_LOCAL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/**
 * Abre una conexión a PostgreSQL con el esquema de Drizzle.
 * Ojo: el usuario de esta URL decide qué se salta RLS. La app usa la sesión del usuario; el `service role`
 * solo se usa en migraciones, importación y tareas programadas.
 */
export function conectar(url: string, maxConexiones = 5) {
  const cliente = postgres(url, { max: maxConexiones, onnotice: () => {} });
  return { db: drizzle(cliente, { schema: esquema }), cliente };
}

export type Conexion = ReturnType<typeof conectar>;
