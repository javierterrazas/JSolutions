// El seguimiento de una obra para el dueño (D-062), con los datos de supabase/seed.sql. OB-001 de Carlos: el baño
// tiene la demolición terminada (peso 2 de 5) y presupuestados $1,500 en Demolición; se gastaron $120 (Home Depot,
// Generales) y $2,500 (Ferguson, baño) en material, 8 horas de Pedro a $22.50 y órdenes de trabajo por $2,000 y $300.
// "Hoy" es el lunes 12 de octubre de 2026 en Austin.
import { afterAll, describe, expect, it } from 'vitest';
import {
  cambiarTarifa,
  repartirCuadrilla,
  resumenDeObras,
  seguimientoDeObra,
  semaforoDePresupuesto,
} from '../src/index';
import { codigo, como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 9);

describe('el seguimiento de una obra', () => {
  it('cómo va: los datos del cliente, el avance, en qué etapa va cada espacio y el plazo', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const s = (await seguimientoDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!;
      expect(s.obra).toMatchObject({
        folio: 'OB-001',
        cliente: 'Familia García',
        telefono: '512-555-0101',
        direccion: '1200 Oak St, Austin, TX',
        pm: 'Carlos Méndez',
        estado: 'en_obra',
        notas: null,
        contrato: 24000,
        inicio: '2026-10-05',
        // la orden de cambio autorizada le suma un día a la del alta
        entregaOriginal: '2026-10-30',
        entregaComprometida: '2026-10-31',
        atraso: 0,
      });
      expect(s.avance).toEqual({ pct: 0.4, curso: 0, terminadas: 1, total: 2 });
      expect(s.espacios.find((e) => e.nombre === 'Baño principal')).toMatchObject({
        pct: 0.4,
        estado: 'en_curso',
        etapa: { es: 'Plomería', en: 'Plumbing' },
        enCurso: [],
      });
    }));

  it('el presupuesto contra lo gastado, por etapa: material, cuadrilla a su tarifa del día y subcontratos', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const s = (await seguimientoDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!;
      // lo gastado se compara contra el costo de la etapa ($975), no contra su precio ($1,500) (D-084)
      expect(s.presupuesto).toMatchObject({ total: 975, gastado: 5100, semaforo: 'rojo' });
      expect(s.presupuesto.usado).toBeCloseTo(5100 / 975, 6);
      // el contrato de $24,000 contra $975 de costo; en el proyectado, la demolición cuenta su costo ($975, gastó
      // $180) y lo demás, lo que ya se gastó sin presupuesto ($5,100 − $180)
      expect(s.presupuesto.margenEsperado).toBeCloseTo(1 - 975 / 24000, 6);
      expect(s.presupuesto.margenProyectado).toBeCloseTo(1 - (975 + 5100 - 180) / 24000, 6);
      const demolicion = s.presupuesto.porEtapa.find((x) => x.etapa?.es === 'Demolición')!;
      expect(demolicion).toMatchObject({
        espacio: 'Baño principal',
        presupuesto: 975,
        precio: 1500,
        cuadrilla: 180,
        total: 180,
      });
      expect(s.presupuesto.porEtapa.find((x) => x.etapa?.es === 'Plomería')).toMatchObject({ sub: 2300 });
      expect(s.cuadrilla).toEqual({
        horas: 8,
        dias: 0,
        costo: 180,
        porTrabajador: [
          {
            nombre: 'Pedro',
            tipoPago: 'hora',
            cantidad: 8,
            costo: 180,
            // su cierre solo tuvo la demolición: las 8 horas van ahí (D-077)
            porEtapa: [{ etapa: { es: 'Demolición', en: 'Demolition' }, cantidad: 8 }],
          },
        ],
      });

      // un aumento desde hoy no cambia lo ya trabajado (D-031)
      const [pedro] = await tx<{ id: string }[]>`select id from trabajadores where nombre = 'Pedro'`;
      await cambiarTarifa(tx, { trabajadorId: pedro!.id, tarifa: 30 }, LUNES);
      expect((await seguimientoDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.cuadrilla.costo).toBe(180);
    }));

  it('el día a día: lo que capturó el PM cada día, y los días laborables que no se cerraron', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const s = (await seguimientoDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!;
      // del lunes 12 al lunes 5, sin el domingo
      expect(s.dias.map((d) => d.dia)).toEqual([
        '2026-10-12',
        '2026-10-10',
        '2026-10-09',
        '2026-10-08',
        '2026-10-07',
        '2026-10-06',
        '2026-10-05',
      ]);
      expect(s.dias[0]).toMatchObject({ folio: null, partidas: [], cuadrilla: [] });
      expect(s.dias.at(-1)).toMatchObject({
        folio: 'BIT-0001',
        partidas: [
          { espacio: 'Baño principal', partida: { es: 'Demolición y retiro de escombro' }, terminada: true },
        ],
        cuadrilla: [{ nombre: 'Pedro', tipoPago: 'hora', cantidad: 8, costo: 180 }],
        subs: [{ sub: 'Plomería Rápida', llego: true }],
        gastos: [
          { proveedor: 'Home Depot', monto: 120, origen: 'pm' },
          { proveedor: 'Ferguson', monto: 2500, origen: 'oficina' },
        ],
        fotos: 1,
      });
      expect(s.hayMasDias).toBe(false);
    }));

  it('la lista de obras trae de cada una su avance, presupuesto usado, entrega y atraso; el PM no ve nada de esto', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const r = await resumenDeObras(tx, LUNES);
      expect(r.get(OBRAS.a1Carlos)).toEqual({
        avance: 0.4,
        usado: 5100 / 975,
        semaforo: 'rojo',
        entrega: '2026-10-31',
        atraso: 0,
      });
      expect(r.has(OBRAS.a3Entregada)).toBe(false);
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => seguimientoDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))).toBe(
        'solo_dueno',
      );
      expect(await codigo(tx, () => resumenDeObras(tx, LUNES))).toBe('solo_dueno');
    }));

  it('el semáforo del presupuesto: rojo si ya se pasó, amarillo si se gasta más rápido de lo que avanza', () => {
    expect(semaforoDePresupuesto(1200, 1000, 0.9)).toBe('rojo');
    expect(semaforoDePresupuesto(600, 1000, 0.4)).toBe('amarillo');
    expect(semaforoDePresupuesto(500, 1000, 0.4)).toBe('verde');
    expect(semaforoDePresupuesto(100, 0, 0)).toBeNull();
  });
});

describe('el reparto de la cuadrilla entre las partidas del día (D-077)', () => {
  const partidas = new Map([
    ['demo', { espacio_id: 'bano', etapa_id: 'demolicion' }],
    ['plom', { espacio_id: 'bano', etapa_id: 'plomeria' }],
    ['tile', { espacio_id: 'cocina', etapa_id: 'azulejo' }],
  ]);
  const renglon = (extra: Record<string, unknown>) => ({
    obra_id: 'obra',
    espacio_id: 'bano',
    partida: 'demo',
    trabajador_id: 'pedro',
    cantidad: '8',
    dia: '2026-10-05',
    bitacora_id: 'bit1',
    ...extra,
  });

  it('las horas de un día van en partes iguales a las partidas que se trabajaron, cada una con su espacio y etapa', () => {
    const r = repartirCuadrilla(
      [renglon({})],
      [
        { bitacora_id: 'bit1', partida: 'demo' },
        { bitacora_id: 'bit1', partida: 'plom' },
        { bitacora_id: 'bit1', partida: 'tile' },
      ],
      partidas,
    );
    expect(r.map((x) => [x.partida, x.espacio_id, x.etapa, x.cantidad])).toEqual([
      ['demo', 'bano', 'demolicion', 8 / 3],
      ['plom', 'bano', 'plomeria', 8 / 3],
      ['tile', 'cocina', 'azulejo', 8 / 3],
    ]);
    expect(r.reduce((a, x) => a + x.cantidad, 0)).toBeCloseTo(8, 10);
  });

  it('sin cierre o sin partidas en el cierre, se queda en su partida', () => {
    const r = repartirCuadrilla(
      [renglon({ bitacora_id: null }), renglon({ bitacora_id: 'bit2', partida: 'plom' })],
      [],
      partidas,
    );
    expect(r.map((x) => [x.partida, x.etapa, x.cantidad])).toEqual([
      ['demo', 'demolicion', 8],
      ['plom', 'plomeria', 8],
    ]);
  });
});
