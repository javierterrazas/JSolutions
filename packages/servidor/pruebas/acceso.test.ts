// Entrar: la invitación, el celular verificado y el PIN (D-024, D-038), contra la base y la API de Auth locales.
// Equivale a legacy/pruebas/prueba_pin.py en lo que no es pantalla: el PIN de cada rol, el límite de intentos y
// que darlo de baja corte el acceso.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  canjearInvitacion,
  cambiarActivo,
  cerrarDispositivo,
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
  DOMINIO_DE_PRUEBA,
  MIEMBROS,
  probarComo,
  servidor,
  USUARIOS,
} from './apoyo';

// la primera llamada a la API local lee su dirección con `supabase status`, que tarda
beforeAll(() => authLocal(), 60_000);

afterAll(async () => {
  await borrarUsuariosDePrueba();
  await servidor.sql.end();
});

const usuarioDeCorreo = (correo: string) => authLocal().usuarioDeCorreo(correo);
let n = 0;
const correoNuevo = () => `pm${Date.now()}-${n++}${DOMINIO_DE_PRUEBA}`;

/** El dueño A invita a un PM nuevo; el PM canjea en su celular y queda con su identidad. */
async function pmConCelular(tx: Tx): Promise<{ userId: string; llave: Llave }> {
  await como(tx, USUARIOS.duenoA);
  const inv = await invitarPm(tx, { nombre: 'PM Nuevo', correo: correoNuevo() }, usuarioDeCorreo);
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
        { nombre: '  Pedro Ruiz ', correo: correoNuevo(), idioma: 'en' },
        usuarioDeCorreo,
      );
      expect(inv.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const [m] =
        await tx`select nombre, rol, idioma, activo, creado_por from miembros where id = ${inv.miembroId}`;
      expect(m).toEqual({
        nombre: 'Pedro Ruiz',
        rol: 'pm',
        idioma: 'en',
        activo: true,
        creado_por: MIEMBROS.duenoA,
      });
      const pedro = (await equipo(tx)).find((x) => x.id === inv.miembroId)!;
      expect(pedro).toMatchObject({ dispositivos: [], invitacion: { id: expect.any(String) } });
    }));

  it('un correo que ya es de un miembro, de cualquier empresa, no se invita', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      for (const correo of ['pm1@empresa-a.test', 'PM1@empresa-b.test '])
        expect(await codigo(tx, () => invitarPm(tx, { nombre: 'X', correo }, usuarioDeCorreo)), correo).toBe(
          'correo_ya_registrado',
        );
    }));

  it('el PM no invita; un correo mal escrito es datos_invalidos', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      expect(
        await codigo(tx, () => invitarPm(tx, { nombre: 'X', correo: correoNuevo() }, usuarioDeCorreo)),
      ).toBe('solo_dueno');
      await como(tx, USUARIOS.duenoA);
      expect(
        await codigo(tx, () => invitarPm(tx, { nombre: 'X', correo: 'no-es-correo' }, usuarioDeCorreo)),
      ).toBe('datos_invalidos');
    }));
});

describe('canjear la invitación', () => {
  it('el celular queda verificado, una sola vez', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const inv = await invitarPm(tx, { nombre: 'PM Nuevo', correo: correoNuevo() }, usuarioDeCorreo);
      await sinIdentidad(tx);
      const c = await canjearInvitacion(tx, { token: inv.token, nombreDispositivo: 'iPhone de Pedro' });
      expect(c.correo).toContain(DOMINIO_DE_PRUEBA);
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
      const { hasta } = await fijarPin(tx, { ...llave, pin: '2468' });
      expect((hasta.getTime() - Date.now()) / 3600_000).toBeCloseTo(16, 0);
      expect(await estadoDispositivo(tx, llave)).toBe('abierto');
      expect(await codigo(tx, () => fijarPin(tx, { ...llave, pin: '1357' }))).toBe('pin_ya_fijado');
    }));

  it('el dueño usa 6 dígitos y su sesión dura 12 horas', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const inv = await reinvitar(tx, { miembroId: MIEMBROS.duenoA });
      await sinIdentidad(tx);
      const c = await canjearInvitacion(tx, { token: inv.token });
      await como(tx, c.userId);
      const llave = { dispositivoId: c.dispositivoId, secreto: c.secreto };
      expect(await codigo(tx, () => fijarPin(tx, { ...llave, pin: '2468' }))).toBe('pin_invalido');
      const { hasta } = await fijarPin(tx, { ...llave, pin: '482915' });
      expect((hasta.getTime() - Date.now()) / 3600_000).toBeCloseTo(12, 0);
    }));

  it('cerrado, pide el PIN: el bueno lo abre; 5 fallidos seguidos bloquean, aunque luego llegue el bueno', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { llave } = await pmConCelular(tx);
      await fijarPin(tx, { ...llave, pin: '2468' });
      await cerrarDispositivo(tx, llave);
      expect(await estadoDispositivo(tx, llave)).toBe('cerrado');

      expect(await entrarConPin(tx, { ...llave, pin: '1111' })).toEqual({
        resultado: 'pin_incorrecto',
        quedan: 4,
      });
      expect(await entrarConPin(tx, { ...llave, pin: '2468' })).toMatchObject({ resultado: 'ok' });
      expect(await estadoDispositivo(tx, llave)).toBe('abierto');

      // el bueno reinicia la cuenta; un fallido cierra lo que estaba abierto
      for (const quedan of [4, 3, 2, 1])
        expect(await entrarConPin(tx, { ...llave, pin: '9999' })).toEqual({
          resultado: 'pin_incorrecto',
          quedan,
        });
      expect(await estadoDispositivo(tx, llave)).toBe('cerrado');
      expect(await entrarConPin(tx, { ...llave, pin: '9999' })).toMatchObject({ resultado: 'pin_bloqueado' });
      expect(await entrarConPin(tx, { ...llave, pin: '2468' })).toMatchObject({ resultado: 'pin_bloqueado' });
      expect(await estadoDispositivo(tx, llave)).toBe('cerrado');
    }));

  it('otro aparato sin invitación no entra: ni sin llave, ni con la llave equivocada, ni con la de otro', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { llave } = await pmConCelular(tx);
      await fijarPin(tx, { ...llave, pin: '2468' });
      const otro = { dispositivoId: llave.dispositivoId, secreto: 'y'.repeat(43) };
      expect(await estadoDispositivo(tx, otro)).toBe('invalido');
      expect(await entrarConPin(tx, { ...otro, pin: '2468' })).toEqual({ resultado: 'dispositivo_invalido' });
      expect(await estadoDispositivo(tx, { dispositivoId: 'no', secreto: 'no' })).toBe('invalido');
      // la llave buena, en manos de otro usuario
      await como(tx, USUARIOS.carlos);
      expect(await estadoDispositivo(tx, llave)).toBe('invalido');
      expect(await entrarConPin(tx, { ...llave, pin: '2468' })).toEqual({
        resultado: 'dispositivo_invalido',
      });
    }));
});

describe('quitar un celular y dar de baja', () => {
  it('el dueño quita el celular de un PM: deja de servir en ese instante', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { userId, llave } = await pmConCelular(tx);
      await fijarPin(tx, { ...llave, pin: '2468' });
      await como(tx, USUARIOS.duenoA);
      await revocarDispositivo(tx, { dispositivoId: llave.dispositivoId });
      await como(tx, userId);
      expect(await estadoDispositivo(tx, llave)).toBe('invalido');
      expect(await entrarConPin(tx, { ...llave, pin: '2468' })).toEqual({
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
      await fijarPin(tx, { ...llave, pin: '2468' });
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
