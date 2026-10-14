// La plataforma (D-080), con los datos de supabase/seed.sql: quien la administra es el dueño de IJM (empresa A); la
// otra empresa (B, Remodelaciones del Valle) está a prueba. Las fechas de vencimiento se ponen contra el día de hoy,
// porque el modo de solo lectura lo revisa la base con su reloj.
import { hoyEn, sumarDias } from '@ijm/core';
import { afterAll, describe, expect, it } from 'vitest';
import {
  altaDeEmpresa,
  cambiarActivaEmpresa,
  empresaDeLaPlataforma,
  empresasDeLaPlataforma,
  esAdminPlataforma,
  esSuscripcionVencida,
  guardarSuscripcion,
  miEmpresaSuspendida,
  miSuscripcion,
  quienSoy,
  registrarPagoPlataforma,
  reinvitarDueno,
  type Tx,
} from '../src/index';
import {
  authLocal,
  borrarUsuariosDePrueba,
  codigo,
  como,
  DOMINIO_DE_PRUEBA,
  probarComo,
  servidor,
  USUARIOS,
} from './apoyo';

afterAll(async () => {
  await borrarUsuariosDePrueba();
  await servidor.sql.end();
});

const EMPRESA_B = 'e000000b-0000-4000-8000-000000000000';
const hoy = hoyEn(new Date(), 'America/Chicago');

/** La suscripción de B con este vencimiento, puesta por quien administra; deja la identidad del dueño de B. */
async function bVenceEl(tx: Tx, venceEl: string | null) {
  await como(tx, USUARIOS.duenoA);
  await guardarSuscripcion(tx, {
    empresaId: EMPRESA_B,
    plan: 'basico',
    precio: 79,
    ciclo: 'mensual',
    enPrueba: false,
    venceEl,
  });
  await como(tx, USUARIOS.duenoB);
}

/** Si la escritura falla porque la empresa está en solo lectura. */
async function bloqueada(tx: Tx, fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await tx.savepoint(async () => {
      await fn();
    });
    return false;
  } catch (e) {
    if (esSuscripcionVencida(e)) return true;
    throw e;
  }
}

describe('la plataforma', () => {
  it('quien la administra ve cada empresa con su cuenta y su uso, sin nada de sus obras', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      expect(await esAdminPlataforma(tx)).toBe(true);
      const lista = await empresasDeLaPlataforma(tx);
      expect(lista.map((e) => e.nombre)).toEqual(['IJM Construction', 'Remodelaciones del Valle']);
      expect(lista[0]).toMatchObject({
        plan: 'pro',
        precio: 149,
        estado: 'activa',
        venceEl: null,
        dueno: 'Javier',
        correo: 'dueno@empresa-a.test',
        ultimoPago: { dia: '2026-10-01', monto: 149 },
      });
      expect(lista[0]!.pms).toBeGreaterThan(0);
      expect(lista[0]!.obras).toBeGreaterThan(0);
      expect(lista[1]).toMatchObject({ plan: 'basico', enPrueba: true, estado: 'prueba' });
      expect(Object.keys(lista[0]!)).not.toContain('contrato');
    }));

  it('nadie más: ni el dueño de otra empresa ni un PM', async () => {
    for (const u of [USUARIOS.duenoB, USUARIOS.carlos])
      await probarComo(u, async (tx) => {
        expect(await esAdminPlataforma(tx)).toBe(false);
        expect(await codigo(tx, () => empresasDeLaPlataforma(tx))).toBe('solo_plataforma');
        expect(
          await codigo(tx, () => cambiarActivaEmpresa(tx, { empresaId: EMPRESA_B, activa: false })),
        ).toBe('solo_plataforma');
        expect(await codigo(tx, () => reinvitarDueno(tx, { empresaId: EMPRESA_B }))).toBe('solo_plataforma');
      });
  });

  it('un pago extiende el vencimiento y quita la prueba; queda en su historial', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const vence = sumarDias(hoy, 30);
      await registrarPagoPlataforma(tx, {
        empresaId: EMPRESA_B,
        monto: 79,
        pagadoEl: hoy,
        metodo: 'zelle',
        referencia: 'Noviembre',
        venceEl: vence,
      });
      const r = (await empresaDeLaPlataforma(tx, { empresaId: EMPRESA_B }))!;
      expect(r.empresa).toMatchObject({ enPrueba: false, venceEl: vence, estado: 'activa' });
      expect(r.pagos[0]).toMatchObject({ monto: 79, pagadoEl: hoy, metodo: 'zelle', venceEl: vence });
      expect(r.pagos[0]!.venciaEl).toBe(sumarDias(hoy, 365));
      expect(
        await codigo(tx, () =>
          registrarPagoPlataforma(tx, {
            empresaId: EMPRESA_B,
            monto: 79,
            pagadoEl: hoy,
            metodo: 'zelle',
            venceEl: sumarDias(hoy, -1),
          }),
        ),
      ).toBe('vencimiento_antes_del_pago');
    }));

  it('por vencer, en gracia y en solo lectura: la empresa ve su estado; en solo lectura no guarda nada', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const cambiar = () => tx`update marcas_empresa set color = color`;

      await bVenceEl(tx, sumarDias(hoy, 3));
      expect(await miSuscripcion(tx)).toMatchObject({ estado: 'por_vencer', venceEl: sumarDias(hoy, 3) });
      expect(await bloqueada(tx, cambiar)).toBe(false);

      await bVenceEl(tx, sumarDias(hoy, -3));
      expect(await miSuscripcion(tx)).toMatchObject({
        estado: 'gracia',
        graciaHasta: sumarDias(hoy, 4),
      });
      expect(await bloqueada(tx, cambiar)).toBe(false);

      await bVenceEl(tx, sumarDias(hoy, -8));
      expect((await miSuscripcion(tx))!.estado).toBe('solo_lectura');
      expect(await bloqueada(tx, cambiar)).toBe(true);
      // ve todo
      expect((await tx`select id from obras`).length).toBeGreaterThan(0);
      // y la otra empresa no se entera
      await como(tx, USUARIOS.duenoA);
      expect(await bloqueada(tx, cambiar)).toBe(false);
    }));

  it('suspendida, nadie de la empresa entra; se le dice por qué', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      await cambiarActivaEmpresa(tx, { empresaId: EMPRESA_B, activa: false });
      expect((await empresaDeLaPlataforma(tx, { empresaId: EMPRESA_B }))!.empresa.estado).toBe('suspendida');
      await como(tx, USUARIOS.duenoB);
      expect(await codigo(tx, () => quienSoy(tx))).toBe('sin_acceso');
      expect(await miEmpresaSuspendida(tx)).toBe('Remodelaciones del Valle');
      await como(tx, USUARIOS.duenoA);
      await cambiarActivaEmpresa(tx, { empresaId: EMPRESA_B, activa: true });
      await como(tx, USUARIOS.duenoB);
      expect(await miEmpresaSuspendida(tx)).toBeNull();
      expect((await quienSoy(tx)).empresa).toBe('Remodelaciones del Valle');
    }));

  it('el alta de una empresa con su dueño y su suscripción, y otra invitación para el dueño', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const correo = `nueva${Date.now()}${DOMINIO_DE_PRUEBA}`;
      const usuarioDeCorreo = (c: string) => authLocal().usuarioDeCorreo(c);
      const inv = await altaDeEmpresa(
        tx,
        {
          empresa: 'Pisos del Norte',
          ciudad: 'Dallas, TX',
          dueno: 'Ana',
          correo,
          plan: 'basico',
          precio: 59,
          ciclo: 'mensual',
          enPrueba: true,
          venceEl: sumarDias(hoy, 14),
        },
        usuarioDeCorreo,
      );
      expect(inv.token.length).toBeGreaterThan(20);
      const nueva = (await empresaDeLaPlataforma(tx, { empresaId: inv.empresaId }))!.empresa;
      expect(nueva).toMatchObject({
        nombre: 'Pisos del Norte',
        dueno: 'Ana',
        correo,
        precio: 59,
        estado: 'prueba',
        pms: 0,
        obras: 0,
      });
      // el mismo correo no da de alta otra
      expect(
        await codigo(tx, () =>
          altaDeEmpresa(
            tx,
            {
              empresa: 'Otra',
              dueno: 'Ana',
              correo,
              plan: 'basico',
              precio: 0,
              ciclo: 'mensual',
              enPrueba: false,
              venceEl: null,
            },
            usuarioDeCorreo,
          ),
        ),
      ).toBe('correo_ya_registrado');

      const otra = await reinvitarDueno(tx, { empresaId: inv.empresaId });
      expect(otra.dueno).toBe('Ana');
      const [n] = await tx<{ vivas: number }[]>`
        select count(*) filter (where anulada_en is null)::int as vivas from invitaciones
        where empresa_id = ${inv.empresaId}`;
      // quien administra no lee las invitaciones de otra empresa (ni sus obras)
      expect(n!.vivas).toBe(0);
    }));
});
