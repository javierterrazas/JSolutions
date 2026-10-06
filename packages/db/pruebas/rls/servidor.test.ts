// Segunda revisión independiente del paso 4 (D-027): lo que el SERVIDOR (rol servidor_app) puede hacer a nombre de
// un usuario. Cada prueba corresponde a un hallazgo comprobado por el revisor, y se corre dentro de una
// transacción que se revierte.
import type postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { conexionDePrueba } from '../conexion';
import { comoServidor, enTransaccionRevertida, errorDe } from '../datos';
import { EMPRESAS, MIEMBROS, OBRAS, USERS } from '../usuarios';

const { cliente: base } = conexionDePrueba();
afterAll(() => base.end());

type Tx = postgres.TransactionSql;
const DUENA_B_USER = 'b0000000-0000-4000-8000-000000000001';

const ordenEmitida = async (tx: Tx) =>
  (await tx`select id from ordenes_trabajo where obra_id = ${OBRAS.a1Carlos} and estado = 'emitida'`)[0]!
    .id as string;

describe('A1 · la marca de importación es solo para el importador', () => {
  it('el servidor no la puede usar para saltarse folios ni columnas protegidas', () =>
    enTransaccionRevertida(base, async (tx) => {
      await comoServidor(tx, USERS.carlos);
      await tx`select set_config('ijm.importando', 'si', true)`;
      const [p] = await tx`select id from punch_list where obra_id = ${OBRAS.a1Carlos}`;
      expect(
        await errorDe(tx, (t) => t`update punch_list set folio = 'PUN-9999' where id = ${p!.id}`),
      ).toMatch(/no se puede cambiar|no puede cambiar/);
      const [b] = await tx`insert into bitacora (empresa_id, folio, obra_id, dia)
                           values (${EMPRESAS.a}, 'BIT-0500', ${OBRAS.a1Carlos}, '2026-10-12') returning folio`;
      expect(b!.folio).not.toBe('BIT-0500');
    }));

  it('el importador conserva el folio del legacy y el contador avanza hasta él', () =>
    enTransaccionRevertida(base, async (tx) => {
      await tx`select set_config('ijm.importando', 'si', true)`;
      await tx`insert into bitacora (empresa_id, folio, obra_id, dia)
               values (${EMPRESAS.a}, 'BIT-0500', ${OBRAS.a1Carlos}, '2026-10-12')`;
      await tx`select set_config('ijm.importando', '', true)`;
      const [b] = await tx`insert into bitacora (empresa_id, obra_id, dia)
                           values (${EMPRESAS.a}, ${OBRAS.a1Carlos}, '2026-10-13') returning folio`;
      expect(b!.folio).toBe('BIT-0501');
    }));
});

describe('A2 · el PM solo confirma y aprueba una orden de trabajo, a su nombre', () => {
  it('no reescribe alcance, fechas ni subcontratista', () =>
    enTransaccionRevertida(base, async (tx) => {
      const ot = await ordenEmitida(tx);
      await comoServidor(tx, USERS.carlos);
      for (const cambio of [
        (t: Tx) => t`update ordenes_trabajo set alcance = 'Reescrito' where id = ${ot}`,
        (t: Tx) => t`update ordenes_trabajo set fin_programado = '2027-12-31' where id = ${ot}`,
        (t: Tx) => t`update ordenes_trabajo set faltas = 3 where id = ${ot}`,
      ]) {
        expect(await errorDe(tx, cambio)).toMatch(/El PM no puede cambiar/);
      }
    }));

  it('no aprueba a nombre del dueño, y sí a su nombre', () =>
    enTransaccionRevertida(base, async (tx) => {
      const ot = await ordenEmitida(tx);
      await comoServidor(tx, USERS.carlos);
      expect(
        await errorDe(
          tx,
          (t) => t`update ordenes_trabajo set estado = 'aprobada', aprobada_en = now(),
                                   aprobada_por = ${MIEMBROS.duenoA} where id = ${ot}`,
        ),
      ).toMatch(/row-level security/);
      expect(
        await errorDe(
          tx,
          (t) => t`update ordenes_trabajo set estado = 'aprobada', aprobada_en = now(),
                                   aprobada_por = ${MIEMBROS.carlos} where id = ${ot}`,
        ),
      ).toBeNull();
    }));

  it('no regresa una orden aprobada', () =>
    enTransaccionRevertida(base, async (tx) => {
      const ot = await ordenEmitida(tx);
      await comoServidor(tx, USERS.carlos);
      await tx`update ordenes_trabajo set estado = 'aprobada', aprobada_en = now(), aprobada_por = ${MIEMBROS.carlos}
               where id = ${ot}`;
      expect(
        await errorDe(tx, (t) => t`update ordenes_trabajo set estado = 'emitida' where id = ${ot}`),
      ).toMatch(/no puede regresar/);
    }));
});

describe('A3 · el usuario de base del servidor', () => {
  it('entra, no se salta RLS, no hereda nada por sí solo y solo puede tomar servidor_app', async () => {
    const [r] = await base`
      select rolcanlogin as entra, rolbypassrls as salta_rls, rolinherit as hereda, rolsuper as super,
             array(select b.rolname from pg_auth_members m join pg_roles b on b.oid = m.roleid
                   where m.member = r.oid order by 1) as roles
      from pg_roles r where rolname = 'ijm_servidor'`;
    expect(r).toEqual({
      entra: true,
      salta_rls: false,
      hereda: false,
      super: false,
      roles: ['servidor_app'],
    });
  });

  it('servidor_app tampoco se salta RLS', async () => {
    const [r] = await base`select rolbypassrls, rolcanlogin from pg_roles where rolname = 'servidor_app'`;
    expect(r).toEqual({ rolbypassrls: false, rolcanlogin: false });
  });
});

describe('M1 y M3 · quién y cuándo los pone la base', () => {
  it('el dueño no crea registros a nombre de un PM ni con fecha inventada', () =>
    enTransaccionRevertida(base, async (tx) => {
      const [esp] = await tx`select id from espacios where obra_id = ${OBRAS.a1Carlos} limit 1`;
      await comoServidor(tx, USERS.duenoA);
      const [g] =
        await tx`insert into gastos (empresa_id, obra_id, espacio_id, dia, proveedor, monto, metodo_pago,
                                               origen, creado_por, creado_en)
                           values (${EMPRESAS.a}, ${OBRAS.a1Carlos}, ${esp!.id}, '2026-10-12', 'Casino', 5000,
                                   'tarjeta_empresa', 'oficina', ${MIEMBROS.carlos}, '2001-01-01')
                           returning creado_por, creado_en > now() - interval '1 minute' as ahora`;
      expect(g).toEqual({ creado_por: MIEMBROS.duenoA, ahora: true });
    }));
});

describe('M2 · lo que el PM puede editar es una lista cerrada', () => {
  it('no cambia la medida cotizada ni el nombre del espacio; sí verifica la medida a su nombre', () =>
    enTransaccionRevertida(base, async (tx) => {
      const [esp] =
        await tx`select id from espacios where obra_id = ${OBRAS.a1Carlos} and pies2_cotizados > 0`;
      await comoServidor(tx, USERS.carlos);
      expect(
        await errorDe(
          tx,
          (t) => t`update espacios set pies2_cotizados = 999, pies2_verificados = 48,
                                   verificado_por = ${MIEMBROS.carlos}, verificado_en = now() where id = ${esp!.id}`,
        ),
      ).toMatch(/El PM no puede cambiar pies2_cotizados/);
      expect(
        await errorDe(
          tx,
          (t) => t`update espacios set pies2_verificados = 48, verificado_por = ${MIEMBROS.carlos},
                                   verificado_en = now() where id = ${esp!.id}`,
        ),
      ).toBeNull();
    }));

  it('no marca su gasto como revisado, ni toca uno que el dueño ya revisó', () =>
    enTransaccionRevertida(base, async (tx) => {
      const [g] = await tx`select id from gastos where obra_id = ${OBRAS.a1Carlos} and origen = 'pm'`;
      await comoServidor(tx, USERS.carlos);
      expect(
        await errorDe(tx, (t) => t`update gastos set revision = 'revisado' where id = ${g!.id}`),
      ).toMatch(/El PM no puede cambiar revision/);
      // el dueño lo revisa (como conexión administrativa: sin rol de usuario y sin identidad)
      await tx`reset role`;
      await tx`select set_config('request.jwt.claims', '', true)`;
      await tx`update gastos set revision = 'revisado' where id = ${g!.id}`;
      await comoServidor(tx, USERS.carlos);
      const r = await tx`update gastos set monto = 1 where id = ${g!.id} returning 1`;
      expect(r.length).toBe(0);
    }));

  it('no borra la evidencia de un cierre tardío ni cambia su día', () =>
    enTransaccionRevertida(base, async (tx) => {
      const [b] = await tx`select id from bitacora where obra_id = ${OBRAS.a1Carlos}`;
      await comoServidor(tx, USERS.carlos);
      for (const col of ['enviado_en', 'tardio', 'dia'] as const) {
        const valor = col === 'tardio' ? true : '2026-10-01';
        expect(
          await errorDe(tx, (t) => t`update bitacora set ${t(col)} = ${valor} where id = ${b!.id}`),
          col,
        ).toMatch(/El PM no puede cambiar/);
      }
      expect(
        await errorDe(
          tx,
          (t) => t`update bitacora set incidencia = 'Llovió por la tarde' where id = ${b!.id}`,
        ),
      ).toBeNull();
    }));
});

describe('M4 y B4 · lo que el PM cuelga de un registro tiene que ser suyo o visible para él', () => {
  it('no cuelga una foto del recibo de una compra de la oficina ni de una orden de cambio', () =>
    enTransaccionRevertida(base, async (tx) => {
      const [oficina] =
        await tx`select id from gastos where obra_id = ${OBRAS.a1Carlos} and origen = 'oficina'`;
      const [oc] =
        await tx`select id from ordenes_cambio where obra_id = ${OBRAS.a1Carlos} and estado = 'propuesta'`;
      await comoServidor(tx, USERS.carlos);
      const foto = (tipo: string, ref: string) => (t: Tx) =>
        t`insert into fotos (empresa_id, obra_id, ref_tipo, ref_id, indice, storage_path)
          values (${EMPRESAS.a}, ${OBRAS.a1Carlos}, ${tipo}, ${ref}, 9, ${`${EMPRESAS.a}/${OBRAS.a1Carlos}/x/${ref}-9.jpg`})`;
      expect(await errorDe(tx, foto('gasto', oficina!.id))).toMatch(/row-level security/);
      expect(await errorDe(tx, foto('orden_cambio', oc!.id))).toMatch(
        /no corresponde a un registro de su obra/,
      );
    }));

  it('validar_foto no sirve de oráculo: el mismo mensaje exista o no el registro de otra empresa', () =>
    enTransaccionRevertida(base, async (tx) => {
      const [deB] = await tx`select id from bitacora where empresa_id = ${EMPRESAS.b} limit 1`;
      await comoServidor(tx, USERS.carlos);
      const foto = (ref: string) => (t: Tx) =>
        t`insert into fotos (empresa_id, obra_id, ref_tipo, ref_id, indice, storage_path)
          values (${EMPRESAS.b}, ${OBRAS.b1}, 'bitacora', ${ref}, 9, ${`${EMPRESAS.b}/${OBRAS.b1}/x/${ref}-9.jpg`})`;
      const real = await errorDe(tx, foto(deB!.id));
      const inventado = await errorDe(tx, foto('00000000-0000-4000-8000-000000000000'));
      expect(real).toMatch(/no corresponde a un registro de su obra/);
      expect(inventado).toBe(real);
    }));

  it('no registra la llegada de un sub con una orden ya pagada, ni cuelga partidas del cierre del dueño', () =>
    enTransaccionRevertida(base, async (tx) => {
      const [pagada] =
        await tx`select id from ordenes_trabajo where obra_id = ${OBRAS.a1Carlos} and estado = 'pagada'`;
      const [partida] = await tx`select id from partidas_obra where obra_id = ${OBRAS.a1Carlos} limit 1`;
      const [delDueno] = await tx`insert into bitacora (empresa_id, obra_id, dia, creado_por)
                                  values (${EMPRESAS.a}, ${OBRAS.a1Carlos}, '2026-10-14', ${MIEMBROS.duenoA})
                                  returning id`;
      await comoServidor(tx, USERS.carlos);
      const [suya] = await tx`insert into bitacora (empresa_id, obra_id, dia)
                              values (${EMPRESAS.a}, ${OBRAS.a1Carlos}, '2026-10-15') returning id`;
      expect(
        await errorDe(
          tx,
          (t) => t`insert into bitacora_subs (empresa_id, obra_id, bitacora_id, orden_trabajo_id, llego)
                                   values (${EMPRESAS.a}, ${OBRAS.a1Carlos}, ${suya!.id}, ${pagada!.id}, true)`,
        ),
      ).toMatch(/row-level security/);
      expect(
        await errorDe(
          tx,
          (t) => t`insert into bitacora_partidas (empresa_id, obra_id, bitacora_id, partida_obra_id)
                                   values (${EMPRESAS.a}, ${OBRAS.a1Carlos}, ${delDueno!.id}, ${partida!.id})`,
        ),
      ).toMatch(/row-level security/);
      expect(
        await errorDe(
          tx,
          (t) => t`insert into bitacora_partidas (empresa_id, obra_id, bitacora_id, partida_obra_id)
                                   values (${EMPRESAS.a}, ${OBRAS.a1Carlos}, ${suya!.id}, ${partida!.id})`,
        ),
      ).toBeNull();
    }));
});

describe('B7 y PIN', () => {
  it('ni el dueño ni el admin desactivan su empresa', () =>
    enTransaccionRevertida(base, async (tx) => {
      await comoServidor(tx, DUENA_B_USER);
      expect(
        await errorDe(tx, (t) => t`update empresas set activa = false where id = ${EMPRESAS.b}`),
      ).toMatch(/no es una edición del dueño/);
      expect(
        await errorDe(
          tx,
          (t) => t`update empresas set nombre = 'Valle Remodelaciones' where id = ${EMPRESAS.b}`,
        ),
      ).toBeNull();
    }));

  it('el servidor tampoco lee el PIN, la llave ni el token: solo las funciones de acceso', () =>
    enTransaccionRevertida(base, async (tx) => {
      await comoServidor(tx, USERS.duenoA);
      for (const columna of ['pin_hash', 'secreto_hash', 'desbloqueado_hasta', 'sesion_id'])
        expect(await errorDe(tx, (t) => t`select ${t(columna)} from dispositivos`), columna).toMatch(
          /permission denied/,
        );
      expect(await errorDe(tx, (t) => t`select token_hash from invitaciones`)).toMatch(/permission denied/);
    }));

  it('ni escribe directo en miembros, dispositivos e invitaciones, ni da de alta empresas', () =>
    enTransaccionRevertida(base, async (tx) => {
      await comoServidor(tx, USERS.duenoA);
      expect(await errorDe(tx, (t) => t`update miembros set activo = false`)).toMatch(/permission denied/);
      expect(await errorDe(tx, (t) => t`update dispositivos set revocado_en = now()`)).toMatch(
        /permission denied/,
      );
      expect(await errorDe(tx, (t) => t`update invitaciones set anulada_en = now()`)).toMatch(
        /permission denied/,
      );
      expect(
        await errorDe(
          tx,
          (t) =>
            t`select public.alta_empresa('X', '', 'America/Chicago', 'es', ${USERS.duenoA}, 'X', 'x', now())`,
        ),
      ).toMatch(/permission denied/);
    }));
});
