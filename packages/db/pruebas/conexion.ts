// Conexión para las pruebas que usan la base local (`supabase start`).
import { URL_BASE_LOCAL, conectar, type Conexion } from '../src/index';

export function conexionDePrueba(): Conexion {
  return conectar(process.env.DATABASE_URL ?? URL_BASE_LOCAL);
}
