// Entrar: la invitación, el celular verificado y el PIN (D-024, D-038), contra la base y la API de Auth locales.
// Equivale a legacy/pruebas/prueba_pin.py en lo que no es pantalla: el PIN de cada rol, el límite de intentos y
// que darlo de baja corte el acceso.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  canjearInvitacion,
  cambiarActivo,
  cerrarDispositivo,
  conectarServidor,
  entrarConPin,
  equipo,
  estadoDispositivo,
  fijarPin,
  invitarPm,
  leerSesion,
  quienSoy,
  reinvitar,
  revocarDispositivo,
  sinIdentidad,
  anularInvitacion,
  type Llave,
  type Tx,
} from '../src/index';
import {
  authLocal,
  borrarUsuariosDePrueba,
  codigo,
  como,
  celularNuevo,
  EMPRESA_A,
  MIEMBROS,
  probarComo,
  servidor,
  USUARIOS,
} from './apoyo';

// la primera llamada a la API local lee su dirección con `supabase status`, que tarda
beforeAll(() => authLocal(), 60_000);
// cada prueba llama a la API de Auth (crear usuarios), que a veces tarda más de los 5 s de siempre
vi.setConfig({ testTimeout: 20_000 });

afterAll(async () => {
  await borrarUsuariosDePrueba();
  await servidor.sql.end();
});

const usuarioDeCorreo = (correo: string) => authLocal().usuarioDeCorreo(correo);

/** El dueño A invita a un PM nuevo; el PM canjea en su celular y queda con su identidad. */
async function pmConCelular(tx: Tx): Promise<{ userId: string; llave: Llave }> {
  await como(tx, USUARIOS.duenoA);
  const inv = await invitarPm(tx, { nombre: 'PM Nuevo', celular: celularNuevo() }, usuarioDeCorreo);
  await sinIdentidad(tx);
  const c = await canjearInvitacion(tx, { token: inv.token, nombreDispositivo: 'iPhone de prueba' });
  await como(tx, c.userId);
  return { userId: c.userId, llave: { dispositivoId: c.dispositivoId, secreto: c.secreto } };
}

describe('invitar', () => {
  it('el dueño da de alta al PM y le crea una invitación pendiente, que se ve en su equipo', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const inv = await invitarPm(
        tx,
        { nombre: '  Pedro Ruiz ', celular: '(555) 010-2030', correo: 'pedro@correo.test', idioma: 'en' },
        usuarioDeCorreo,
      );
      expect(inv.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const [m] = await tx`
        select nombre, rol, idioma, activo, creado_por, telefono, correo_avisos from miembros
        where id = ${inv.miembroId}`;
      expect(m).toEqual({
        nombre: 'Pedro Ruiz',
        rol: 'pm',
        idioma: 'en',
        activo: true,
        creado_por: MIEMBROS.duenoA,
        telefono: '+15550102030',
        correo_avisos: 'pedro@correo.test',
      });
      const pedro = (await equipo(tx)).find((x) => x.id === inv.miembroId)!;
      expect(pedro).toMatchObject({
        telefono: '+15550102030',
        dispositivos: [],
        invitacion: { id: expect.any(String) },
      });
    }));

  it('un celular que ya es de un miembro no se invita otra vez, escrito como sea (D-083)', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const cel = celularNuevo();
      await invitarPm(tx, { nombre: 'X', celular: cel }, usuarioDeCorreo);
      expect(
        await codigo(tx, () => invitarPm(tx, { nombre: 'Y', celular: `+1 ${cel}` }, usuarioDeCorreo)),
      ).toBe('celular_ya_registrado');
    }));

  it('el PM no invita; un celular incompleto o un correo mal escrito no pasan', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      expect(
        await codigo(tx, () => invitarPm(tx, { nombre: 'X', celular: celularNuevo() }, usuarioDeCorreo)),
      ).toBe('solo_dueno');
      await como(tx, USUARIOS.duenoA);
      expect(
        await codigo(tx, () => invitarPm(tx, { nombre: 'X', celular: '555-0101' }, usuarioDeCorreo)),
      ).toBe('celular_invalido');
      expect(
        await codigo(tx, () =>
          invitarPm(tx, { nombre: 'X', celular: celularNuevo(), correo: 'no-es-correo' }, usuarioDeCorreo),
        ),
      ).toBe('datos_invalidos');
    }));
});

describe('canjear la invitación', () => {
  it('el celular queda verificado, una sola vez', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const inv = await invitarPm(tx, { nombre: 'PM Nuevo', celular: celularNuevo() }, usuarioDeCorreo);
      await sinIdentidad(tx);
      const c = await canjearInvitacion(tx, { token: inv.token, nombreDispositivo: 'iPhone de Pedro' });
      expect(c.correo).toMatch(/^\d+@celular\.invalid$/);
      expect(c.secreto).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(await codigo(tx, () => canjearInvitacion(tx, { token: inv.token }))).toBe('invitacion_invalida');
      await como(tx, USUARIOS.duenoA);
      const yo = (await equipo(tx)).find((x) => x.id === inv.miembroId)!;
      expect(yo.dispositivos.map((d) => d.nombre)).toEqual(['iPhone de Pedro']);
      expect(yo.invitacion).toBeNull();
    }));

  it('no sirve un token inventado, anulado, vencido, ni el de un miembro dado de baja', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const canjear = async (token: string) => {
        await sinIdentidad(tx);
        const r = await codigo(tx, () => canjearInvitacion(tx, { token }));
        await como(tx, USUARIOS.duenoA);
        return r;
      };
      expect(await canjear('x'.repeat(43))).toBe('invitacion_invalida');

      const anulada = await reinvitar(tx, { miembroId: MIEMBROS.luis });
      const [inv] = await tx<{ id: string }[]>`
        select id from invitaciones where miembro_id = ${MIEMBROS.luis} and anulada_en is null and usada_en is null`;
      await anularInvitacion(tx, { invitacionId: inv!.id });
      expect(await canjear(anulada.token)).toBe('invitacion_invalida');

      const vieja = await reinvitar(
        tx,
        { miembroId: MIEMBROS.luis },
        new Date(Date.now() - 8 * 24 * 3600 * 1000),
      );
      expect(await canjear(vieja.token)).toBe('invitacion_invalida');

      // una nueva anula la anterior
      const primera = await reinvitar(tx, { miembroId: MIEMBROS.luis });
      const segunda = await reinvitar(tx, { miembroId: MIEMBROS.luis });
      expect(await canjear(primera.token)).toBe('invitacion_invalida');

      await cambiarActivo(tx, { miembroId: MIEMBROS.luis, activo: false });
      expect(await canjear(segunda.token)).toBe('invitacion_invalida');
    }));

  it('al dueño y a los administradores solo los reinvita el dueño; cada quien se reinvita a sí mismo (D-055)', async () => {
    // la empresa A no tiene administrador: la prueba le da uno al usuario sin empresa del seed, como postgres
    const admin = conectarServidor(
      process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
      1,
    );
    const REVERTIR = new Error('revertir');
    const SIN_EMPRESA = 'c0000000-0000-4000-8000-000000000001';
    try {
      await admin.sql.begin(async (tx) => {
        const [nuevo] = await tx<{ id: string }[]>`
          insert into miembros (empresa_id, user_id, rol, nombre, idioma)
          values (${EMPRESA_A}, ${SIN_EMPRESA}, 'admin', 'Admin de prueba', 'es') returning id`;
        const adminId = nuevo!.id;
        await como(tx, SIN_EMPRESA);
        expect(await codigo(tx, () => reinvitar(tx, { miembroId: MIEMBROS.duenoA }))).toBe(
          'miembro_invalido',
        );
        // a un PM y a sí mismo, sí
        await reinvitar(tx, { miembroId: MIEMBROS.carlos });
        await reinvitar(tx, { miembroId: adminId });
        // el dueño, a todos
        await como(tx, USUARIOS.duenoA);
        await reinvitar(tx, { miembroId: adminId });
        await reinvitar(tx, { miembroId: MIEMBROS.duenoA });
        throw REVERTIR;
      });
    } catch (e) {
      if (e !== REVERTIR) throw e;
    } finally {
      await admin.sql.end();
    }
  });

  it('el PM no reinvita a nadie; no se reinvita a un miembro de otra empresa', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      expect(await codigo(tx, () => reinvitar(tx, { miembroId: MIEMBROS.carlos }))).toBe('solo_dueno');
      await como(tx, USUARIOS.duenoB);
      expect(await codigo(tx, () => reinvitar(tx, { miembroId: MIEMBROS.carlos }))).toBe('miembro_no_activo');
    }));
});

describe('el PIN', () => {
  it('el PM elige un PIN de 4 dígitos que no sea fácil, una sola vez; con él queda abierto', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { llave } = await pmConCelular(tx);
      expect(await estadoDispositivo(tx, llave)).toBe('sin_pin');
      expect(await codigo(tx, () => fijarPin(tx, { ...llave, pin: '482915' }))).toBe('pin_invalido');
      expect(await codigo(tx, () => fijarPin(tx, { ...llave, pin: '1234' }))).toBe('pin_debil');
      const { hasta } = await fijarPin(tx, { ...llave, pin: '5170' });
      expect((hasta.getTime() - Date.now()) / 3600_000).toBeCloseTo(16, 0);
      expect(await estadoDispositivo(tx, llave)).toBe('abierto');
      expect(await codigo(tx, () => fijarPin(tx, { ...llave, pin: '3859' }))).toBe('pin_ya_fijado');
    }));

  it('el dueño usa 6 dígitos y su sesión dura 12 horas', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const inv = await reinvitar(tx, { miembroId: MIEMBROS.duenoA });
      await sinIdentidad(tx);
      const c = await canjearInvitacion(tx, { token: inv.token });
      await como(tx, c.userId);
      const llave = { dispositivoId: c.dispositivoId, secreto: c.secreto };
      expect(await codigo(tx, () => fijarPin(tx, { ...llave, pin: '5170' }))).toBe('pin_invalido');
      const { hasta } = await fijarPin(tx, { ...llave, pin: '482915' });
      expect((hasta.getTime() - Date.now()) / 3600_000).toBeCloseTo(12, 0);
    }));

  it('cerrado, pide el PIN: el bueno lo abre; 5 fallidos seguidos bloquean, aunque luego llegue el bueno', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { llave } = await pmConCelular(tx);
      await fijarPin(tx, { ...llave, pin: '5170' });
      await cerrarDispositivo(tx, llave);
      expect(await estadoDispositivo(tx, llave)).toBe('cerrado');

      expect(await entrarConPin(tx, { ...llave, pin: '1111' })).toEqual({
        resultado: 'pin_incorrecto',
        quedan: 4,
      });
      expect(await entrarConPin(tx, { ...llave, pin: '5170' })).toMatchObject({ resultado: 'ok' });
      expect(await estadoDispositivo(tx, llave)).toBe('abierto');

      // el bueno reinicia la cuenta; un fallido cierra lo que estaba abierto
      for (const quedan of [4, 3, 2, 1])
        expect(await entrarConPin(tx, { ...llave, pin: '9999' })).toEqual({
          resultado: 'pin_incorrecto',
          quedan,
        });
      expect(await estadoDispositivo(tx, llave)).toBe('cerrado');
      expect(await entrarConPin(tx, { ...llave, pin: '9999' })).toMatchObject({ resultado: 'pin_bloqueado' });
      expect(await entrarConPin(tx, { ...llave, pin: '5170' })).toMatchObject({ resultado: 'pin_bloqueado' });
      expect(await estadoDispositivo(tx, llave)).toBe('cerrado');
    }));

  it('cada bloqueo seguido dura más: 15 minutos, 1 hora y 24 horas; un PIN bueno vuelve a empezar (D-055)', async () => {
    // para que "pase el tiempo" entre bloqueos hace falta mover bloqueado_hasta, que nadie de la app puede tocar: la
    // prueba entra como postgres, toma la identidad como siempre, y la deja (reset role) solo para eso
    const admin = conectarServidor(
      process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
      1,
    );
    const REVERTIR = new Error('revertir');
    try {
      await admin.sql.begin(async (tx) => {
        const { userId, llave } = await pmConCelular(tx);
        await fijarPin(tx, { ...llave, pin: '5170' });
        const bloquear = async () => {
          for (let i = 0; i < 4; i++) await entrarConPin(tx, { ...llave, pin: '9999' });
          const r = await entrarConPin(tx, { ...llave, pin: '9999' });
          expect(r.resultado).toBe('pin_bloqueado');
          const [ya] = await tx<{ ahora: Date }[]>`select now() as ahora`;
          return (new Date((r as { hasta: string }).hasta).getTime() - ya!.ahora.getTime()) / 60_000;
        };
        const pasaElBloqueo = async () => {
          await tx`reset role`;
          await tx`update dispositivos set bloqueado_hasta = now() - interval '1 second' where id = ${llave.dispositivoId}`;
          await como(tx, userId);
        };
        expect(await bloquear()).toBeCloseTo(15, 5);
        await pasaElBloqueo();
        expect(await bloquear()).toBeCloseTo(60, 5);
        await pasaElBloqueo();
        expect(await bloquear()).toBeCloseTo(24 * 60, 5);
        await pasaElBloqueo();
        expect(await bloquear()).toBeCloseTo(24 * 60, 5);
        // el PIN bueno reinicia la cuenta: el siguiente bloqueo vuelve a ser de 15 minutos
        await pasaElBloqueo();
        expect(await entrarConPin(tx, { ...llave, pin: '5170' })).toMatchObject({ resultado: 'ok' });
        expect(await bloquear()).toBeCloseTo(15, 5);
        throw REVERTIR;
      });
    } catch (e) {
      if (e !== REVERTIR) throw e;
    } finally {
      await admin.sql.end();
    }
  });

  it('otro aparato sin invitación no entra: ni sin llave, ni con la llave equivocada, ni con la de otro', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { llave } = await pmConCelular(tx);
      await fijarPin(tx, { ...llave, pin: '5170' });
      const otro = { dispositivoId: llave.dispositivoId, secreto: 'y'.repeat(43) };
      expect(await estadoDispositivo(tx, otro)).toBe('invalido');
      expect(await entrarConPin(tx, { ...otro, pin: '5170' })).toEqual({ resultado: 'dispositivo_invalido' });
      expect(await estadoDispositivo(tx, { dispositivoId: 'no', secreto: 'no' })).toBe('invalido');
      // la llave buena, en manos de otro usuario
      await como(tx, USUARIOS.carlos);
      expect(await estadoDispositivo(tx, llave)).toBe('invalido');
      expect(await entrarConPin(tx, { ...llave, pin: '5170' })).toEqual({
        resultado: 'dispositivo_invalido',
      });
    }));
});

describe('quitar un celular y dar de baja', () => {
  it('el dueño quita el celular de un PM: deja de servir en ese instante', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { userId, llave } = await pmConCelular(tx);
      await fijarPin(tx, { ...llave, pin: '5170' });
      await como(tx, USUARIOS.duenoA);
      await revocarDispositivo(tx, { dispositivoId: llave.dispositivoId });
      await como(tx, userId);
      expect(await estadoDispositivo(tx, llave)).toBe('invalido');
      expect(await entrarConPin(tx, { ...llave, pin: '5170' })).toEqual({
        resultado: 'dispositivo_invalido',
      });
    }));

  it('el PM quita los suyos, no los de otro; la dueña de otra empresa no toca los de esta', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { llave } = await pmConCelular(tx);
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => revocarDispositivo(tx, { dispositivoId: llave.dispositivoId }))).toBe(
        'dispositivo_invalido',
      );
      await como(tx, USUARIOS.duenoB);
      expect(await codigo(tx, () => revocarDispositivo(tx, { dispositivoId: llave.dispositivoId }))).toBe(
        'dispositivo_invalido',
      );
    }));

  it('el PM dado de baja con la sesión abierta pierde el acceso en ese instante; reactivado, vuelve', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { userId, llave } = await pmConCelular(tx);
      await fijarPin(tx, { ...llave, pin: '5170' });
      const { miembroId } = await quienSoy(tx);
      await como(tx, USUARIOS.duenoA);
      await cambiarActivo(tx, { miembroId, activo: false });
      await como(tx, userId);
      expect(await estadoDispositivo(tx, llave)).toBe('invalido');
      expect(await codigo(tx, () => leerSesion(tx))).toBe('sin_acceso');
      expect(await codigo(tx, () => quienSoy(tx))).toBe('sin_acceso');
      await como(tx, USUARIOS.duenoA);
      await cambiarActivo(tx, { miembroId, activo: true });
      await como(tx, userId);
      expect(await estadoDispositivo(tx, llave)).toBe('abierto');
    }));

  it('nadie da de baja al dueño ni a sí mismo; el PM no da de baja a nadie', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      expect(await codigo(tx, () => cambiarActivo(tx, { miembroId: MIEMBROS.duenoA, activo: false }))).toBe(
        'miembro_invalido',
      );
      await como(tx, USUARIOS.duenoB);
      expect(await codigo(tx, () => cambiarActivo(tx, { miembroId: MIEMBROS.carlos, activo: false }))).toBe(
        'miembro_invalido',
      );
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => cambiarActivo(tx, { miembroId: MIEMBROS.luis, activo: false }))).toBe(
        'solo_dueno',
      );
    }));
});

describe('el equipo', () => {
  it('el dueño ve solo a los de su empresa; el PM no lo ve', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const nombres = (await equipo(tx)).map((m) => m.nombre);
      expect(nombres[0]).toBe('Javier');
      expect(nombres).toContain('Carlos Méndez');
      expect(nombres).not.toContain('PM uno del Valle');
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => equipo(tx))).toBe('solo_dueno');
    }));
});
