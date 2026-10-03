// La conexión del servidor y la identidad de cada operación (D-026, D-027).
//
// El servidor se conecta como el usuario de base ijm_servidor, que por sí solo no puede leer ni escribir nada. Cada
// operación es UNA transacción que toma el rol servidor_app y la identidad del usuario: así RLS aplica a todo lo
// que escribe, y si un camino de código olvida tomar el rol, no puede tocar ningún dato.
import postgres from 'postgres';

export type Tx = postgres.TransactionSql;

export interface Servidor {
  readonly sql: postgres.Sql;
}

/** La conexión a la base. `url` lleva el usuario ijm_servidor y su contraseña (variable de entorno). */
export function conectarServidor(url: string, maxConexiones = 10): Servidor {
  return {
    sql: postgres(url, {
      max: maxConexiones,
      onnotice: () => {},
      // Los días de negocio llegan como texto "AAAA-MM-DD", nunca como Date: postgres los convertiría a la
      // medianoche UTC, que en Austin es el día anterior (regla 5, el error de un día del legacy).
      types: {
        dia: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
      },
    }),
  };
}

/** Un usuario ya identificado: su id de Supabase Auth. Verificar la sesión es de la capa web (fase 2). */
export interface Usuario {
  readonly userId: string;
}

/**
 * Toma el rol servidor_app y la identidad del usuario para el resto de la transacción. Fija las DOS variables que
 * lee auth.uid(): request.jwt.claim.sub manda sobre request.jwt.claims, y si quedara de antes se usaría la
 * identidad equivocada (D-027).
 */
export async function tomarIdentidad(tx: Tx, usuario: Usuario): Promise<void> {
  await tx`set local role servidor_app`;
  await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: usuario.userId, role: 'authenticated' })}, true),
                  set_config('request.jwt.claim.sub', ${usuario.userId}, true)`;
}

/** Ejecuta `fn` en una transacción, a nombre del usuario. Si algo falla, no queda nada a medias. */
export async function enNombreDe<T>(
  servidor: Servidor,
  usuario: Usuario,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return (await servidor.sql.begin(async (tx) => {
    await tomarIdentidad(tx, usuario);
    return fn(tx);
  })) as T;
}
