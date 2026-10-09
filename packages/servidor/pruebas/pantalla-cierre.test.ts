// Lo que lee la pantalla de cerrar el día (fase 2, paso 4), con los datos de supabase/seed.sql: Carlos lleva OB-001,
// en obra desde el lunes 5 de octubre de 2026, con la demolición del baño terminada y el sub de plomería esperado
// desde el miércoles 7.
import { afterAll, describe, expect, it } from 'vitest';
import { cerrarDia, datosParaCierre } from '../src/index';
import { como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

describe('la pantalla de cerrar el día', () => {
  it('trae solo las partidas por terminar, la cuadrilla, el sub esperado y los motivos', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const d = (await datosParaCierre(tx, { obraId: OBRAS.a1Carlos }, enAustin('2026-10-08')))!;
      expect(d).toMatchObject({ dia: '2026-10-08', tardio: false, yaCerrado: false });
      expect(d.diasSinCierre).toEqual(['2026-10-06', '2026-10-07']);
      const partidas = d.espacios.flatMap((e) => e.partidas);
      // la demolición ya está terminada: no se ofrece
      expect(partidas.map((p) => p.nombre.es)).not.toContain('Demolición');
      expect(partidas.length).toBeGreaterThan(0);
      expect(partidas.every((p) => p.estado === 'sin_iniciar' || p.estado === 'en_progreso')).toBe(true);
      expect(d.trabajadores.length).toBeGreaterThan(0);
      expect(d.trabajadores.every((t) => t.tipoPago === 'hora' || t.tipoPago === 'dia')).toBe(true);
      expect(d.trabajadores.flatMap((t) => Object.keys(t))).not.toContain('tarifa');
      expect(d.subs).toEqual([expect.objectContaining({ alcance: 'Rough de plomería del baño' })]);
      expect(d.motivos).toContain('clima');
    }));

  it('un día olvidado se pide con ?dia; uno ya cerrado lo dice', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const tarde = (await datosParaCierre(
        tx,
        { obraId: OBRAS.a1Carlos, dia: '2026-10-07' },
        enAustin('2026-10-08'),
      ))!;
      expect(tarde).toMatchObject({ dia: '2026-10-07', tardio: true, yaCerrado: false });
      const cerrado = (await datosParaCierre(
        tx,
        { obraId: OBRAS.a1Carlos, dia: '2026-10-05' },
        enAustin('2026-10-08'),
      ))!;
      expect(cerrado.yaCerrado).toBe(true);
    }));

  it('después de cerrar: el día queda cerrado, la partida trabajada va en curso y el sub ya no se pregunta', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const ahora = enAustin('2026-10-08', 17);
      const d = (await datosParaCierre(tx, { obraId: OBRAS.a1Carlos }, ahora))!;
      const partida = d.espacios[0]!.partidas[0]!;
      await cerrarDia(
        tx,
        {
          obraId: OBRAS.a1Carlos,
          partidas: [partida.id],
          subs: [{ ordenTrabajoId: d.subs[0]!.ordenId, llego: true }],
          fotosPorSubir: 1,
        },
        ahora,
      );
      const despues = (await datosParaCierre(tx, { obraId: OBRAS.a1Carlos }, ahora))!;
      expect(despues.yaCerrado).toBe(true);
      expect(despues.espacios.flatMap((e) => e.partidas).find((p) => p.id === partida.id)?.estado).toBe(
        'en_progreso',
      );
      expect(despues.subs).toEqual([]);
    }));

  it('la obra de otro PM no se abre', () =>
    probarComo(USUARIOS.luis, async (tx) => {
      expect(await datosParaCierre(tx, { obraId: OBRAS.a1Carlos }, enAustin('2026-10-08'))).toBeNull();
      await como(tx, USUARIOS.duenoB);
      expect(await datosParaCierre(tx, { obraId: OBRAS.a1Carlos }, enAustin('2026-10-08'))).toBeNull();
    }));
});
