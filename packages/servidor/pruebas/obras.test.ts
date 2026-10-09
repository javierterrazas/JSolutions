// Crear obra y guardar su presupuesto (adaptadas de legacy/pruebas/prueba_obligatorios.js y prueba_presupuesto.js),
// a nombre de usuarios reales, contra la base local.
import { afterAll, describe, expect, it } from 'vitest';
import { agregarEspacio, crearObra, guardarPresupuesto, type Tx } from '../src/index';
import { codigo, como, EMPRESA_A, MIEMBROS, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

async function tipoBano(tx: Tx) {
  return (await tx<{ id: string }[]>`select id from tipos_espacio where nombre_es = 'Baño'`)[0]!.id;
}
const datos = (tipo: string) => ({
  cliente: 'Familia Integración',
  telefono: '512-555-0177',
  direccion: '500 Server St',
  pmId: MIEMBROS.carlos,
  inicio: '2026-11-02',
  finEstimada: '2026-12-11',
  contrato: 28000,
  espacios: [{ tipoEspacioId: tipo, nombre: '', pies2: 45 }],
});

describe('crear obra', () => {
  it('crea la obra con folio, contrato, Generales primero y la copia de partidas de cada espacio', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const r = await crearObra(tx, datos(await tipoBano(tx)));
      expect(r).toMatchObject({ ok: true, folio: 'OB-004' });
      if (!r.ok) return;
      const [obra] = await tx`select estado, empresa_id, creado_por from obras where id = ${r.obraId}`;
      expect(obra).toEqual({ estado: 'sin_presupuesto', empresa_id: EMPRESA_A, creado_por: MIEMBROS.duenoA });
      const [fin] = await tx`select contrato_original from obras_finanzas where obra_id = ${r.obraId}`;
      expect(fin!.contrato_original).toBe('28000.00');
      const espacios = await tx`select e.nombre, e.pies2_cotizados, t.es_generales,
                                       (select count(*)::int from partidas_obra p where p.espacio_id = e.id) as partidas
                                from espacios e join tipos_espacio t on t.id = e.tipo_espacio_id
                                where e.obra_id = ${r.obraId} order by e.orden`;
      expect(espacios).toEqual([
        { nombre: 'Generales de obra', pies2_cotizados: '0.00', es_generales: true, partidas: 0 },
        { nombre: 'Baño', pies2_cotizados: '45.00', es_generales: false, partidas: 2 },
      ]);
    }));

  it('dice todo lo que falta en un solo error, y no guarda nada', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const antes = (await tx`select count(*)::int as n from obras`)[0]!.n;
      expect(await codigo(tx, () => crearObra(tx, {}))).toBe('faltan');
      expect((await tx`select count(*)::int as n from obras`)[0]!.n).toBe(antes);
    }));

  it('el mismo cliente en la misma dirección pide confirmar; confirmado, sí la crea', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const d = datos(await tipoBano(tx));
      expect((await crearObra(tx, d)).ok).toBe(true);
      expect(await crearObra(tx, { ...d, direccion: ' 500 server st ' })).toMatchObject({
        ok: false,
        confirmar: 'obra_duplicada',
      });
      expect((await crearObra(tx, { ...d, confirmado: ['obra_duplicada'] })).ok).toBe(true);
    }));

  it('el PM no da de alta obras; el PM tiene que ser un PM activo', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const d = datos(await tipoBano(tx));
      expect(await codigo(tx, () => crearObra(tx, d))).toBe('solo_dueno');
      await como(tx, USUARIOS.duenoA);
      expect(await codigo(tx, () => crearObra(tx, { ...d, pmId: MIEMBROS.duenoA }))).toBe('pm_no_activo');
    }));

  it('datos mal formados: un solo error con cada problema', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      expect(await codigo(tx, () => crearObra(tx, { inicio: '30/10/2026', pmId: 'carlos' } as never))).toBe(
        'datos_invalidos',
      );
    }));
});

describe('guardar el presupuesto por etapa', () => {
  async function obraNueva(tx: Tx) {
    const r = await crearObra(tx, datos(await tipoBano(tx)));
    if (!r.ok) throw new Error('no se creó');
    const etapas = await tx<{ espacio: string; etapa: string | null }[]>`
      select distinct p.espacio_id as espacio, p.etapa_id as etapa from partidas_obra p where p.obra_id = ${r.obraId}`;
    return { obraId: r.obraId, etapas };
  }

  it('completo: la obra pasa a lista para arranque; sin una etapa, queda en $0 con su rastro y regresa', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { obraId, etapas } = await obraNueva(tx);
      const lineas = etapas.map((x, i) => ({
        espacioId: x.espacio,
        etapaId: x.etapa,
        monto: 1000 * (i + 1),
      }));
      expect(await guardarPresupuesto(tx, { obraId, lineas })).toEqual({
        completo: true,
        faltan: [],
        total: 3000,
      });
      expect((await tx`select estado from obras where id = ${obraId}`)[0]!.estado).toBe(
        'lista_para_arranque',
      );

      // sin la segunda etapa: queda en cero (nada se borra) y deja rastro
      const r = await guardarPresupuesto(tx, {
        obraId,
        lineas: lineas.slice(0, 1),
        motivo: 'El cliente quitó la plomería',
      });
      expect(r.total).toBe(1000);
      const montos = await tx`select monto from presupuesto_etapas where obra_id = ${obraId} order by monto`;
      expect(montos.map((m) => m.monto)).toEqual(['0.00', '1000.00']);
      const [rastro] = await tx`select accion, campo, antes, despues, motivo, creado_por from correcciones
                                where tabla = 'presupuesto_etapas' order by creado_en desc limit 1`;
      expect(rastro).toEqual({
        accion: 'editar',
        campo: 'monto',
        antes: '2000',
        despues: '0',
        motivo: 'El cliente quitó la plomería',
        creado_por: MIEMBROS.duenoA,
      });

      // sin nada: incompleto, la obra regresa a sin presupuesto
      expect((await guardarPresupuesto(tx, { obraId, lineas: [] })).completo).toBe(false);
      expect((await tx`select estado from obras where id = ${obraId}`)[0]!.estado).toBe('sin_presupuesto');
    }));

  it('rechaza montos negativos y etapas que no son del espacio; el PM no presupuesta', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { obraId, etapas } = await obraNueva(tx);
      const e = etapas[0]!;
      expect(
        await codigo(tx, () =>
          guardarPresupuesto(tx, { obraId, lineas: [{ espacioId: e.espacio, etapaId: e.etapa, monto: -5 }] }),
        ),
      ).toBe('monto_negativo');
      expect(
        await codigo(tx, () =>
          guardarPresupuesto(tx, {
            obraId,
            lineas: [{ espacioId: e.espacio, etapaId: OBRAS.a1Carlos, monto: 5 }],
          }),
        ),
      ).toBe('etapa_no_es_del_espacio');
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => guardarPresupuesto(tx, { obraId, lineas: [] }))).toBe('solo_dueno');
    }));

  it('una obra ya entregada no se presupuesta', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      expect(await codigo(tx, () => guardarPresupuesto(tx, { obraId: OBRAS.a3Entregada, lineas: [] }))).toBe(
        'obra_cerrada',
      );
    }));
});

describe('agregar un espacio a una obra que ya existe', () => {
  it('llega al final, con las partidas de su tipo; su presupuesto se captura después', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const tipo = await tipoBano(tx);
      const { espacioId } = await agregarEspacio(tx, {
        obraId: OBRAS.a1Carlos,
        tipoEspacioId: tipo,
        pies2: 30,
      });
      const espacios = await tx`
        select e.id, e.nombre, e.pies2_cotizados,
               (select count(*)::int from partidas_obra p where p.espacio_id = e.id) as partidas
        from espacios e where e.obra_id = ${OBRAS.a1Carlos} order by e.orden`;
      expect(espacios.at(-1)).toEqual({
        id: espacioId,
        nombre: 'Baño',
        pies2_cotizados: '30.00',
        partidas: 2,
      });
    }));

  it('pide pies²; no en una obra entregada ni con Generales; el PM no agrega espacios', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const tipo = await tipoBano(tx);
      const [gen] = await tx<{ id: string }[]>`select id from tipos_espacio where es_generales`;
      expect(
        await codigo(tx, () => agregarEspacio(tx, { obraId: OBRAS.a1Carlos, tipoEspacioId: tipo })),
      ).toBe('faltan_pies2');
      expect(
        await codigo(tx, () =>
          agregarEspacio(tx, { obraId: OBRAS.a3Entregada, tipoEspacioId: tipo, pies2: 20 }),
        ),
      ).toBe('obra_cerrada');
      expect(
        await codigo(tx, () =>
          agregarEspacio(tx, { obraId: OBRAS.a1Carlos, tipoEspacioId: gen!.id, pies2: 20 }),
        ),
      ).toBe('tipo_espacio_inexistente');
      await como(tx, USUARIOS.carlos);
      expect(
        await codigo(tx, () =>
          agregarEspacio(tx, { obraId: OBRAS.a1Carlos, tipoEspacioId: tipo, pies2: 20 }),
        ),
      ).toBe('solo_dueno');
    }));
});
