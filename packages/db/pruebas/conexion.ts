// Conexión para las pruebas que usan la base local (`supabase start`).
import { URL_BASE_LOCAL, conectar, type Conexion } from '../src/index';

export function conexionDePrueba(maxConexiones?: number): Conexion {
  return conectar(process.env.DATABASE_URL ?? URL_BASE_LOCAL, maxConexiones);
}
