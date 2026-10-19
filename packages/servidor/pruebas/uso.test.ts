// El uso de la app (D-101), con supabase/seed.sql: el dueño de IJM administra la plataforma; el seed trae minutos de
// uso de los PMs de las dos empresas. "Hoy" de las pruebas es el lunes 12 de octubre de 2026 en Austin.
import { afterAll, describe, expect, it } from 'vitest';
import { cerrarDia, registrarUso, usoDeLaPlataforma } from '../src/index';
import { codigo, como, enAustin, MIEMBROS, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 18);

describe('el uso de la app', () => {
  it('cada aviso cuenta un minuto, y dos seguidos no se duplican', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      // la tabla no se lee directo: se ve con la función de la plataforma, desde hoy
      const deCarlos = async () => {
        await como(tx, USUARIOS.duenoA);
        const { empresas } = await usoDeLaPlataforma(tx, { dias: 7 });
        const x = empresas.flatMap((e) => e.personas).find((y) => y.id === MIEMBROS.carlos);
        await como(tx, USUARIOS.carlos);
        return x ? { minutos: x.minutos, sesiones: x.sesiones } : null;
      };
      const antes = (await deCarlos()) ?? { minutos: 0, sesiones: 0 };
      await registrarUso(tx);
      await registrarUso(tx);
      expect(await deCarlos()).toEqual({ minutos: antes.minutos + 1, sesiones: antes.sesiones + 1 });
    }));

  it('quien administra ve cada empresa y cada persona: su tiempo, lo que capturó y cuánto tarda en cerrar', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      // un cierre que tardó 45 segundos en capturarse
      const [p] = await tx<{ id: string }[]>`
        select id from partidas_obra where obra_id = ${OBRAS.a1Carlos} and nombre_es = 'Rough de plomería'`;
      await cerrarDia(
        tx,
        {
          obraId: OBRAS.a1Carlos,
          partidas: [p!.id],
          fotosPorSubir: 1,
          iniciado: '2026-10-12T22:59:15.000Z',
          capturado: '2026-10-12T23:00:00.000Z',
        },
        LUNES,
      );
      await como(tx, USUARIOS.duenoA);
      const { desde, empresas } = await usoDeLaPlataforma(tx, { dias: 30 }, LUNES);
      expect(desde).toBe('2026-09-13');
      const ijm = empresas.find((e) => e.nombre === 'IJM Construction')!;
      const carlos = ijm.personas.find((x) => x.id === MIEMBROS.carlos)!;
      expect(carlos).toMatchObject({ rol: 'pm', segundosCierre: 45 });
      expect(carlos.minutos).toBeGreaterThan(0);
      expect(carlos.cierres).toBeGreaterThanOrEqual(1);
      expect(ijm.minutos).toBe(ijm.personas.reduce((a, x) => a + x.minutos, 0));
      // también ve las otras empresas
      expect(empresas.length).toBeGreaterThan(1);
    }));

  it('solo quien administra la plataforma lo ve', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      expect(await codigo(tx, () => usoDeLaPlataforma(tx, {}, LUNES))).toBe('solo_plataforma');
      await como(tx, USUARIOS.duenoB);
      expect(await codigo(tx, () => usoDeLaPlataforma(tx, {}, LUNES))).toBe('solo_plataforma');
    }));
});
