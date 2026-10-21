// El desempeño de los managers (D-106), con supabase/seed.sql: Carlos lleva OB-001 (en obra, cerrada el lunes 5 de
// octubre, con su PC1 aprobado a la primera) y la entregada; Luis, OB-002.
import { METRICAS_PM } from '@ijm/core';
import { afterAll, describe, expect, it } from 'vitest';
import { desempenoDeManagers, desempenoDeUnManager } from '../src/index';
import { codigo, como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const MARTES = enAustin('2026-10-20', 9);

describe('el desempeño de los managers', () => {
  it('cada PM con sus obras y sus diez números, y los de la empresa para comparar', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const d = await desempenoDeManagers(tx, { dias: 30 }, MARTES);
      expect(d).toMatchObject({ hoy: '2026-10-20', desde: '2026-09-21', dias: 30 });
      expect(d.empresa.map((m) => m.clave)).toEqual([...METRICAS_PM]);
      const carlos = d.managers.find((m) => m.obras.some((o) => o.id === OBRAS.a1Carlos))!;
      expect(carlos.metricas.map((m) => m.clave)).toEqual([...METRICAS_PM]);
      expect(carlos.obras.find((o) => o.id === OBRAS.a1Carlos)).toMatchObject({
        folio: 'OB-001',
        estado: 'en_obra',
      });
      // la obra de Luis no se le cuenta a Carlos
      expect(carlos.obras.map((o) => o.id)).not.toContain(OBRAS.a2Luis);
      // el 5 de octubre cerrado, los demás laborables hasta el lunes 19 sin cerrar
      const cierre = carlos.metricas.find((m) => m.clave === 'cierre_a_tiempo')!;
      expect(cierre.datos.esperados).toBeGreaterThan(10);
      expect(cierre.datos.aTiempo).toBeGreaterThanOrEqual(1);
      expect(cierre.semaforo).toBe('rojo');
      // el seed hace la inspección con la hora real: se mide al día de hoy
      const hoy = await desempenoDeManagers(tx, { dias: 365 });
      const carlosHoy = hoy.managers.find((m) => m.id === carlos.id)!;
      expect(carlosHoy.metricas.find((m) => m.clave === 'inspecciones_a_la_primera')).toMatchObject({
        // el PC1 de sus dos obras (la en curso y la entregada), los dos aprobados a la primera
        datos: { inspecciones: 2, aprobadas: 2 },
        pocosDatos: true,
        semaforo: 'info',
      });
    }));

  it('uno solo, por su id; quien no es manager no se encuentra; el PM no lo ve', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { managers } = await desempenoDeManagers(tx, {}, MARTES);
      const uno = await desempenoDeUnManager(tx, { miembroId: managers[0]!.id, dias: 365 }, MARTES);
      expect(uno).toMatchObject({ dias: 365, manager: { id: managers[0]!.id } });
      const [dueno] = await tx<{ id: string }[]>`select id from miembros where rol = 'dueno' limit 1`;
      expect(await desempenoDeUnManager(tx, { miembroId: dueno!.id }, MARTES)).toBeNull();
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => desempenoDeManagers(tx, {}, MARTES))).toBe('solo_dueno');
    }));
});
