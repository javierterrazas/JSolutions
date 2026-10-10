// El punch list y la medida verificada (fase 2, paso 6e; legacy: pmPunch, pmCerrarPunch, pmMedida; D-014), con los
// datos de supabase/seed.sql: en OB-001 de Carlos hay un detalle abierto (silicón disparejo, compromiso 30 de
// octubre) y el baño se cotizó en 45 pies².
import { afterAll, describe, expect, it } from 'vitest';
import { agregarPunch, cerrarPunch, datosParaEntrega, verificarMedida, type Tx } from '../src/index';
import { codigo, como, enAustin, MIEMBROS, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const espacio = async (tx: Tx, nombre: string) =>
  (
    await tx<
      { id: string }[]
    >`select id from espacios where obra_id = ${OBRAS.a1Carlos} and nombre = ${nombre}`
  )[0]!.id;

describe('el punch list', () => {
  it('anota el detalle con 7 días hábiles para corregirlo, y el PM lo ve en su lista', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      // viernes 9 de octubre de 2026; la semana del PM incluye el sábado (D-028)
      const r = await agregarPunch(
        tx,
        {
          obraId: OBRAS.a1Carlos,
          item: '  Rayón en el espejo  ',
          origen: 'expectativa',
          responsable: ' Cuadrilla ',
        },
        enAustin('2026-10-09'),
      );
      expect(r).toMatchObject({ folio: expect.stringMatching(/^PUN-/), compromiso: '2026-10-17' });
      const [p] =
        await tx`select item, origen, responsable, estado, creado_por from punch_list where id = ${r.punchId}`;
      expect(p).toEqual({
        item: 'Rayón en el espejo',
        origen: 'expectativa',
        responsable: 'Cuadrilla',
        estado: 'abierto',
        creado_por: MIEMBROS.carlos,
      });
      const d = (await datosParaEntrega(tx, { obraId: OBRAS.a1Carlos }, enAustin('2026-10-09')))!;
      expect(d.abiertos.map((x) => x.item)).toEqual(['Rayón en el espejo', 'Silicón disparejo en el vanity']);
    }));

  it('pasado el compromiso, está vencido; corregido, pasa a los cerrados', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const tarde = (await datosParaEntrega(tx, { obraId: OBRAS.a1Carlos }, enAustin('2026-11-02')))!;
      const silicon = tarde.abiertos.find((x) => x.item.startsWith('Silicón'))!;
      expect(silicon.vencido).toBe(true);
      await cerrarPunch(tx, { punchId: silicon.id });
      const d = (await datosParaEntrega(tx, { obraId: OBRAS.a1Carlos }))!;
      expect(d.abiertos).toEqual([]);
      expect(d.cerrados).toEqual([
        expect.objectContaining({ id: silicon.id, cerradoEn: expect.any(String) }),
      ]);
      expect(await codigo(tx, () => cerrarPunch(tx, { punchId: silicon.id }))).toBe('punch_no_encontrado');
    }));

  it('sin detalle, o en la obra de otro, no', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      expect(await codigo(tx, () => agregarPunch(tx, { obraId: OBRAS.a1Carlos, item: 'Mal' }))).toBe(
        'punch_sin_detalle',
      );
      expect(
        await codigo(tx, () => agregarPunch(tx, { obraId: OBRAS.a2Luis, item: 'Rayón en la puerta' })),
      ).toBe('obra_no_encontrada');
    }));
});

describe('la medida verificada', () => {
  it('se guarda aparte de la cotizada, con quién y cuándo, y deja su rastro', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const bano = await espacio(tx, 'Baño principal');
      await verificarMedida(tx, { espacioId: bano, pies2: 48.5, piesLineales: 22 });
      const [e] = await tx`
        select pies2_cotizados, pies2_verificados, pies_lineales_verificados, verificado_por, verificado_en is not null as cuando
        from espacios where id = ${bano}`;
      expect(e).toEqual({
        pies2_cotizados: '45.00',
        pies2_verificados: '48.50',
        pies_lineales_verificados: '22.00',
        verificado_por: MIEMBROS.carlos,
        cuando: true,
      });
      await como(tx, USUARIOS.duenoA);
      const [c] = await tx`
        select accion, campo, antes, despues from correcciones where registro_id = ${bano} order by creado_en desc limit 1`;
      expect(c).toEqual({ accion: 'medida_verificada', campo: 'pies2', antes: '45', despues: '48.5' });
      await como(tx, USUARIOS.carlos);
      const d = (await datosParaEntrega(tx, { obraId: OBRAS.a1Carlos }))!;
      expect(d.medidas).toEqual([
        expect.objectContaining({ nombre: 'Baño principal', pies2Verificados: 48.5 }),
      ]);
    }));

  it('sin pies², en Generales de obra o en la obra de otro, no', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const bano = await espacio(tx, 'Baño principal');
      const generales = await espacio(tx, 'Generales de obra');
      expect(await codigo(tx, () => verificarMedida(tx, { espacioId: bano, pies2: 0 }))).toBe(
        'medida_invalida',
      );
      expect(await codigo(tx, () => verificarMedida(tx, { espacioId: generales, pies2: 10 }))).toBe(
        'espacio_no_encontrado',
      );
      await como(tx, USUARIOS.luis);
      expect(await codigo(tx, () => verificarMedida(tx, { espacioId: bano, pies2: 40 }))).toBe(
        'espacio_no_encontrado',
      );
    }));
});
