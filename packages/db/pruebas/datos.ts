// Datos mínimos para probar el modelo: una empresa con su dueño, un PM, un tipo de espacio y una obra con un
// espacio y una partida. Se crean dentro de una transacción que la prueba revierte al terminar: la base local
// queda como estaba.
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';

type Tx = postgres.TransactionSql;

/** Corre fn dentro de una transacción y la revierte siempre, pase o falle la prueba. */
export async function enTransaccionRevertida(
  cliente: postgres.Sql,
  fn: (tx: Tx) => Promise<void>,
): Promise<void> {
  const revertir = new Error('revertir');
  try {
    await cliente.begin(async (tx) => {
      await fn(tx);
      throw revertir;
    });
  } catch (e) {
    if (e !== revertir) throw e;
  }
}

/** Ejecuta fn dentro de un savepoint y devuelve el error de PostgreSQL, si hubo. La transacción sigue viva. */
export async function errorDe(tx: Tx, fn: (tx: Tx) => Promise<unknown>): Promise<string | null> {
  try {
    await tx.savepoint(fn);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function usuarioAuth(tx: Tx): Promise<string> {
  const id = randomUUID();
  await tx`insert into auth.users (id, email, aud, role) values (${id}, ${id + '@prueba.test'}, 'authenticated', 'authenticated')`;
  return id;
}

export interface EmpresaDePrueba {
  empresa: string;
  dueno: string;
  pm: string;
  tipoEspacio: string;
  obra: string;
  espacio: string;
  partida: string;
}

export async function crearEmpresaDePrueba(tx: Tx, nombre = 'Empresa de prueba'): Promise<EmpresaDePrueba> {
  const [e] = await tx`insert into empresas (nombre) values (${nombre}) returning id`;
  const empresa = e!.id as string;
  const [d] = await tx`insert into miembros (empresa_id, user_id, rol, nombre)
                       values (${empresa}, ${await usuarioAuth(tx)}, 'dueno', 'Dueño') returning id`;
  const [p] = await tx`insert into miembros (empresa_id, user_id, rol, nombre)
                       values (${empresa}, ${await usuarioAuth(tx)}, 'pm', 'PM') returning id`;
  const [t] =
    await tx`insert into tipos_espacio (empresa_id, nombre_es) values (${empresa}, 'Baño') returning id`;
  const [o] = await tx`insert into obras (empresa_id, folio, cliente, telefono_cliente, direccion, pm_id,
                                          fecha_inicio, fecha_fin_estimada)
                       values (${empresa}, 'OB-001', 'Cliente', '512-555-0100', 'Austin', ${p!.id},
                               '2026-10-05', '2026-10-30') returning id`;
  const [s] = await tx`insert into espacios (empresa_id, obra_id, tipo_espacio_id, nombre, pies2_cotizados)
                       values (${empresa}, ${o!.id}, ${t!.id}, 'Baño principal', 45) returning id`;
  const [x] = await tx`insert into partidas_obra (empresa_id, obra_id, espacio_id, nombre_es)
                       values (${empresa}, ${o!.id}, ${s!.id}, 'Demolición') returning id`;
  return {
    empresa,
    dueno: d!.id,
    pm: p!.id,
    tipoEspacio: t!.id,
    obra: o!.id,
    espacio: s!.id,
    partida: x!.id,
  };
}
