// El usuario de base del servidor (D-027): sin tomar el rol no puede tocar nada, y un "reset role" lo regresa a
// no poder tocar nada. Así un camino de código que olvide la identidad falla en vez de saltarse RLS.
import { afterAll, describe, expect, it } from 'vitest';
import { enNombreDe, leerSesion } from '../src/index';
import { codigo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

describe('la conexión del servidor', () => {
  it('entra como ijm_servidor, y sin la identidad de un usuario no lee ninguna tabla', async () => {
    expect((await servidor.sql`select current_user as u`)[0]!.u).toBe('ijm_servidor');
    await expect(servidor.sql`select count(*) from obras`).rejects.toThrow(/permission denied/);
    await expect(servidor.sql`select count(*) from cobros`).rejects.toThrow(/permission denied/);
  });

  it('con la identidad lee lo del usuario; después de "reset role", nada', () =>
    expect(
      enNombreDe(servidor, { userId: USUARIOS.carlos }, async (tx) => {
        expect((await tx`select count(*)::int as n from obras`)[0]!.n).toBe(1);
        await tx`reset role`;
        await tx`select count(*) from obras`;
      }),
    ).rejects.toThrow(/permission denied/));

  it('un usuario sin empresa no tiene sesión', () =>
    enNombreDe(servidor, { userId: 'c0000000-0000-4000-8000-000000000001' }, async (tx) => {
      expect(await codigo(tx, () => leerSesion(tx))).toBe('sin_acceso');
    }));

  it('la sesión trae el calendario y el "hoy" de la empresa', () =>
    enNombreDe(servidor, { userId: USUARIOS.carlos }, async (tx) => {
      const s = await leerSesion(tx, new Date('2026-11-27T04:30:00Z'));
      expect(s).toMatchObject({ rol: 'pm', zona: 'America/Chicago', hoy: '2026-11-26' });
      // IJM descansa Thanksgiving y trabaja Nochebuena (supabase/seed.sql)
      expect(s.calendario.feriados.has('2026-11-26')).toBe(true);
      expect(s.calendario.feriados.has('2026-12-24')).toBe(false);
      expect(s.calendario.laborables.has(6)).toBe(true);
    }));
});
