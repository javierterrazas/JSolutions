// Lo que leen las pantallas del dueño para la obra nueva y su presupuesto (D-039), con los datos de supabase/seed.sql.
import { afterAll, describe, expect, it } from 'vitest';
import {
  crearObra,
  datosParaObraNueva,
  guardarPresupuesto,
  obrasDeLaEmpresa,
  presupuestoParaCapturar,
} from '../src/index';
import { codigo, como, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

describe('las pantallas del dueño leen', () => {
  it('para la obra nueva: los tipos de espacio sin Generales, con sus partidas, y los PMs activos', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const d = await datosParaObraNueva(tx);
      expect(d.tipos.map((t) => t.nombre.es)).not.toContain('Generales de obra');
      expect(d.tipos.find((t) => t.nombre.es === 'Baño')?.partidas).toBeGreaterThan(0);
      // el PM dado de baja no aparece; los de la otra empresa tampoco
      expect(d.pms.map((p) => p.nombre)).toEqual(['Carlos Méndez', 'Luis Ramírez']);
    }));

  it('las obras de su empresa, y solo de la suya', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const obras = await obrasDeLaEmpresa(tx);
      expect(obras.map((o) => o.folio).sort()).toEqual(['OB-001', 'OB-002', 'OB-003']);
      expect(obras.find((o) => o.id === OBRAS.a1Carlos)).toMatchObject({
        pm: 'Carlos Méndez',
        estado: 'en_obra',
      });
      await como(tx, USUARIOS.duenoB);
      expect((await obrasDeLaEmpresa(tx)).map((o) => o.folio)).toEqual(['OB-001']);
    }));

  it('el presupuesto por capturar: cada espacio con sus etapas y el monto que ya tiene', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { tipos, pms } = await datosParaObraNueva(tx);
      const bano = tipos.find((t) => t.nombre.es === 'Baño')!;
      const r = await crearObra(tx, {
        cliente: 'Familia Pantalla',
        telefono: '512-555-0188',
        direccion: '77 Screen Rd',
        pmId: pms[0]!.id,
        inicio: '2026-11-02',
        finEstimada: '2026-12-11',
        contrato: 30000,
        espacios: [{ tipoEspacioId: bano.id, nombre: 'Baño principal', pies2: 60 }],
      });
      if (!r.ok) throw new Error('no se creó');
      const p = (await presupuestoParaCapturar(tx, { obraId: r.obraId }))!;
      expect(p.obra).toMatchObject({ folio: r.folio, estado: 'sin_presupuesto' });
      expect(p.espacios.map((e) => [e.nombre, e.generales])).toEqual([
        ['Generales de obra', true],
        ['Baño principal', false],
      ]);
      expect(p.total).toBe(0);
      const banoPrincipal = p.espacios[1]!;
      expect(banoPrincipal.etapas.every((x) => x.monto === 0 && x.partidas > 0)).toBe(true);

      // lo que guarda el dueño es lo que vuelve a leer
      const etapa = banoPrincipal.etapas[0]!;
      const g = await guardarPresupuesto(tx, {
        obraId: r.obraId,
        lineas: [{ espacioId: banoPrincipal.id, etapaId: etapa.etapaId, monto: 4500 }],
      });
      expect(g.completo).toBe(true);
      const despues = (await presupuestoParaCapturar(tx, { obraId: r.obraId }))!;
      expect(despues.total).toBe(4500);
      expect(despues.obra.estado).toBe('lista_para_arranque');
      expect(despues.espacios[1]!.etapas[0]!.monto).toBe(4500);
    }));

  it('el PM no lee nada de esto; la obra de otra empresa no se encuentra', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      expect(await codigo(tx, () => datosParaObraNueva(tx))).toBe('solo_dueno');
      expect(await codigo(tx, () => obrasDeLaEmpresa(tx))).toBe('solo_dueno');
      expect(await codigo(tx, () => presupuestoParaCapturar(tx, { obraId: OBRAS.a1Carlos }))).toBe(
        'solo_dueno',
      );
      await como(tx, USUARIOS.duenoB);
      expect(await presupuestoParaCapturar(tx, { obraId: OBRAS.a1Carlos })).toBeNull();
    }));
});
