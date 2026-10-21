// La bitácora de la obra para el PM (D-105), con supabase/seed.sql: en OB-001 Carlos cerró el lunes 5 de octubre con
// la demolición del baño terminada, Pedro 8 horas y el sub de plomería (Plomería Rápida), que llegó.
import { afterAll, describe, expect, it } from 'vitest';
import { bitacoraDeObra, cerrarDia, datosParaCierre } from '../src/index';
import { como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const HORA = 3600 * 1000;

describe('la bitácora de la obra', () => {
  it('el PM ve lo que cerró: partidas, cuadrilla, subs y notas, sin dinero', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const b = (await bitacoraDeObra(tx, { obraId: OBRAS.a1Carlos }))!;
      expect(b.obra.folio).toBe('OB-001');
      const lunes = b.dias.find((d) => d.dia === '2026-10-05')!;
      expect(lunes).toMatchObject({
        sinTrabajo: false,
        cuadrilla: [{ nombre: 'Pedro', tipoPago: 'hora', cantidad: 8 }],
        subs: [{ sub: 'Plomería Rápida', llego: true }],
      });
      expect(lunes.partidas).toEqual([
        expect.objectContaining({ espacio: 'Baño principal', terminada: true }),
      ]);
      expect(JSON.stringify(b)).not.toMatch(/costo|tarifa|precio|monto/);
    }));

  it('el sub sigue con su nombre aunque su orden ya se haya pagado', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      await tx`update ordenes_trabajo set estado = 'pagada'
               where obra_id = ${OBRAS.a1Carlos} and id in (select orden_trabajo_id from bitacora_subs)`;
      await como(tx, USUARIOS.carlos);
      const b = (await bitacoraDeObra(tx, { obraId: OBRAS.a1Carlos }))!;
      expect(b.dias.find((d) => d.dia === '2026-10-05')!.subs).toEqual([
        { sub: 'Plomería Rápida', llego: true },
      ]);
    }));

  it('lo más nuevo primero; el cierre propio se corrige 48 horas', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const martes = enAustin('2026-10-06', 18);
      const d = (await datosParaCierre(tx, { obraId: OBRAS.a1Carlos }, martes))!;
      await cerrarDia(
        tx,
        {
          obraId: OBRAS.a1Carlos,
          partidas: [d.espacios[0]!.partidas[0]!.id],
          incidencia: 'Llovió en la tarde',
          fotosPorSubir: 1,
        },
        martes,
      );
      const ahora = new Date();
      const b = (await bitacoraDeObra(tx, { obraId: OBRAS.a1Carlos }, ahora))!;
      expect(b.dias.map((x) => x.dia).slice(0, 2)).toEqual(['2026-10-06', '2026-10-05']);
      expect(b.dias[0]).toMatchObject({ incidencia: 'Llovió en la tarde', corregible: true });
      const despues = (await bitacoraDeObra(
        tx,
        { obraId: OBRAS.a1Carlos },
        new Date(ahora.getTime() + 49 * HORA),
      ))!;
      expect(despues.dias[0]!.corregible).toBe(false);
    }));

  it('la obra de otro PM no se abre', () =>
    probarComo(USUARIOS.luis, async (tx) => {
      expect(await bitacoraDeObra(tx, { obraId: OBRAS.a1Carlos })).toBeNull();
    }));
});
