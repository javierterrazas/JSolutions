// Los administradores de una empresa (D-112), con supabase/seed.sql: el dueño de IJM, Carlos y Luis (PMs). El dueño
// invita administradores y cambia roles; un administrador hace todo lo del dueño, menos eso, dar de baja a otro
// administrador o quitarle el celular al dueño.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cambiarActivo,
  cambiarRol,
  canjearInvitacion,
  equipo,
  invitarPm,
  leerSesion,
  reinvitar,
  revocarDispositivo,
  sinIdentidad,
} from '../src/index';
import { authLocal, celularNuevo, codigo, como, MIEMBROS, probarComo, servidor, USUARIOS } from './apoyo';

beforeAll(() => authLocal(), 60_000);
afterAll(() => servidor.sql.end());

const usuarioDeCorreo = (correo: string) => authLocal().usuarioDeCorreo(correo);

describe('los administradores', () => {
  it('el dueño invita a un administrador y cambia a un PM a administrador y de regreso', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const inv = await invitarPm(
        tx,
        { nombre: 'Ana Oficina', celular: celularNuevo(), rol: 'admin' },
        usuarioDeCorreo,
      );
      const ana = (await equipo(tx)).find((m) => m.id === inv.miembroId)!;
      expect(ana).toMatchObject({ nombre: 'Ana Oficina', rol: 'admin' });

      await cambiarRol(tx, { miembroId: MIEMBROS.luis, rol: 'admin' });
      expect((await equipo(tx)).find((m) => m.id === MIEMBROS.luis)!.rol).toBe('admin');
      await como(tx, USUARIOS.luis);
      expect((await leerSesion(tx)).esDuenoOAdmin).toBe(true);

      await como(tx, USUARIOS.duenoA);
      await cambiarRol(tx, { miembroId: MIEMBROS.luis, rol: 'pm' });
      expect((await equipo(tx)).find((m) => m.id === MIEMBROS.luis)!.rol).toBe('pm');
      // al dueño no se le cambia el rol
      expect(await codigo(tx, () => cambiarRol(tx, { miembroId: MIEMBROS.duenoA, rol: 'admin' }))).toBe(
        'miembro_invalido',
      );
    }));

  it('un administrador invita PMs, pero no administradores, no cambia roles ni da de baja a otro administrador', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      await cambiarRol(tx, { miembroId: MIEMBROS.luis, rol: 'admin' });
      await cambiarRol(tx, { miembroId: MIEMBROS.carlos, rol: 'admin' });
      await como(tx, USUARIOS.luis);

      await invitarPm(tx, { nombre: 'PM de Luis', celular: celularNuevo() }, usuarioDeCorreo);
      expect(
        await codigo(tx, () =>
          invitarPm(tx, { nombre: 'Otro admin', celular: celularNuevo(), rol: 'admin' }, usuarioDeCorreo),
        ),
      ).toBe('solo_el_dueno');
      expect(await codigo(tx, () => cambiarRol(tx, { miembroId: MIEMBROS.carlos, rol: 'pm' }))).toBe(
        'solo_el_dueno',
      );
      expect(await codigo(tx, () => cambiarActivo(tx, { miembroId: MIEMBROS.carlos, activo: false }))).toBe(
        'miembro_invalido',
      );
    }));

  it('un administrador no le quita el celular al dueño; el dueño sí puede quitar el de un administrador', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      // un celular del dueño: se reinvita a sí mismo y canjea la invitación
      const inv = await reinvitar(tx, { miembroId: MIEMBROS.duenoA });
      await sinIdentidad(tx);
      const c = await canjearInvitacion(tx, { token: inv.token, nombreDispositivo: 'iPhone del dueño' });
      const delDueno = { id: c.dispositivoId };
      await como(tx, USUARIOS.duenoA);
      await cambiarRol(tx, { miembroId: MIEMBROS.luis, rol: 'admin' });
      await como(tx, USUARIOS.luis);
      expect(await codigo(tx, () => revocarDispositivo(tx, { dispositivoId: delDueno.id }))).toBe(
        'dispositivo_invalido',
      );
      await como(tx, USUARIOS.duenoA);
      await revocarDispositivo(tx, { dispositivoId: delDueno.id });
    }));
});
