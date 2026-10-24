// El asistente del dueño (D-114), con supabase/seed.sql: el dueño de IJM (que también administra la plataforma), Carlos
// (PM) y OB-001 (Familia García: contrato de $24,000, el baño con la demolición presupuestada en $975 de costo). El
// módulo nace apagado; aquí se prende dentro de cada prueba.
import { MODULOS } from '@ijm/core';
import { afterAll, describe, expect, it } from 'vitest';
import {
  anotarConsultaAsistente,
  atenderMcp,
  cambiarRol,
  correrHerramienta,
  crearLlaveAsistente,
  etapasParaAnalizar,
  guardarModulos,
  herramientasDelAsistente,
  llavesDelAsistente,
  obrasParaAnalizar,
  quienConsultaConLlave,
  quitarLlaveAsistente,
  sinIdentidad,
  type Tx,
} from '../src/index';
import { codigo, como, EMPRESA_A, MIEMBROS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const conAsistente = (tx: Tx, modulos: readonly string[] = MODULOS) =>
  guardarModulos(tx, { empresaId: EMPRESA_A, modulos: modulos as never });

/** La llave, vista sin sesión (como llega el asistente); luego otra vez como el dueño. */
async function sinSesion<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  await sinIdentidad(tx);
  try {
    return await fn();
  } finally {
    await como(tx, USUARIOS.duenoA);
  }
}

describe('las llaves del asistente', () => {
  it('solo el dueño, con el módulo, crea una llave; sirve hasta que la quita', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      // el módulo nace apagado
      expect(await codigo(tx, () => crearLlaveAsistente(tx, { nombre: 'Claude' }))).toBe(
        'modulo_no_incluido',
      );
      await conAsistente(tx);
      const { id, llave } = await crearLlaveAsistente(tx, { nombre: 'Claude del celular' });
      expect(llave).toMatch(/^jsa_[\w-]{32}$/);
      const { llaves } = await llavesDelAsistente(tx);
      expect(llaves).toEqual([
        expect.objectContaining({
          id,
          nombre: 'Claude del celular',
          inicio: llave.slice(0, 8),
          quitada: null,
        }),
      ]);
      // la llave misma no se guarda
      expect(JSON.stringify(llaves)).not.toContain(llave);

      const quien = await sinSesion(tx, () => quienConsultaConLlave(tx, llave));
      expect(quien).toMatchObject({ llaveId: id, empresaId: EMPRESA_A, idioma: 'es' });
      expect(await sinSesion(tx, () => quienConsultaConLlave(tx, `jsa_${'x'.repeat(32)}`))).toBeNull();

      await quitarLlaveAsistente(tx, { llaveId: id });
      expect(await sinSesion(tx, () => quienConsultaConLlave(tx, llave))).toBeNull();
      expect((await llavesDelAsistente(tx)).llaves[0]!.quitada).not.toBeNull();
    }));

  it('un administrador o un PM no crean llaves; si el dueño apaga el módulo, la llave deja de servir', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      await conAsistente(tx);
      const { llave } = await crearLlaveAsistente(tx, { nombre: 'Claude' });
      await cambiarRol(tx, { miembroId: MIEMBROS.luis, rol: 'admin' });
      await como(tx, USUARIOS.luis);
      expect(await codigo(tx, () => crearLlaveAsistente(tx, { nombre: 'Mía' }))).toBe('solo_el_dueno');
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => llavesDelAsistente(tx))).toBe('solo_el_dueno');

      await como(tx, USUARIOS.duenoA);
      await conAsistente(
        tx,
        MODULOS.filter((m) => m !== 'asistente'),
      );
      expect(await sinSesion(tx, () => quienConsultaConLlave(tx, llave))).toBeNull();
    }));

  it('cada consulta queda anotada, y con más de 60 en un minuto la llave espera', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      await conAsistente(tx);
      const { id, llave } = await crearLlaveAsistente(tx, { nombre: 'Claude' });
      await sinSesion(tx, async () => {
        for (let i = 0; i < 60; i++)
          await anotarConsultaAsistente(tx, {
            llaveId: id,
            herramienta: 'obras',
            argumentos: { i },
            ok: true,
            milisegundos: 12,
          });
        expect(await codigo(tx, () => quienConsultaConLlave(tx, llave))).toBe('demasiadas_consultas');
      });
      const { llaves, consultas } = await llavesDelAsistente(tx);
      expect(llaves[0]!.consultas).toBe(60);
      expect(consultas[0]).toMatchObject({ llave: 'Claude', herramienta: 'obras', ok: true });
    }));
});

describe('lo que el asistente analiza', () => {
  it('cada obra en un renglón y cada etapa con su presupuesto contra lo gastado', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const ob1 = (await obrasParaAnalizar(tx)).find((o) => o.folio === 'OB-001')!;
      expect(ob1).toMatchObject({ cliente: 'Familia García', pm: 'Carlos Méndez', contrato: 24_000 });
      expect(ob1.alta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ob1.gastado).toBeCloseTo(ob1.material + ob1.cuadrilla + ob1.subcontratos);
      expect(ob1.porCobrar).toBe(ob1.contratoFinal! - ob1.cobrado);

      const etapas = await etapasParaAnalizar(tx, { folio: 'ob-001' });
      const demolicion = etapas.find((x) => x.espacio === 'Baño principal' && x.etapa?.es === 'Demolición')!;
      expect(demolicion).toMatchObject({ folio: 'OB-001', presupuestado: 975, precio: 1500 });
      expect(demolicion.diferencia).toBeCloseTo(demolicion.gastado - 975);
      expect(etapas.every((x) => x.folio === 'OB-001')).toBe(true);
      expect(await etapasParaAnalizar(tx, { estado: 'cerradas', folio: 'OB-001' })).toEqual([]);

      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => obrasParaAnalizar(tx))).toBe('solo_dueno');
    }));
});

describe('la conexión MCP', () => {
  const contexto = (tx: Tx) => ({
    listar: () => herramientasDelAsistente(tx),
    llamar: (nombre: string, args: Record<string, unknown>) => correrHerramienta(tx, nombre, args, 'es'),
  });

  it('se presenta, lista sus herramientas de solo lectura y contesta una consulta', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const ctx = contexto(tx);
      const inicio = (await atenderMcp(
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
        ctx,
      )) as { result: { protocolVersion: string; serverInfo: { name: string }; instructions: string } };
      expect(inicio.result).toMatchObject({
        protocolVersion: '2025-03-26',
        serverInfo: { name: 'j-solutions' },
      });
      expect(await atenderMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx)).toBeNull();

      const lista = (await atenderMcp({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, ctx)) as {
        result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] };
      };
      const nombres = lista.result.tools.map((t) => t.name);
      expect(nombres).toEqual(expect.arrayContaining(['empresa', 'obras', 'etapas_de_obras', 'historico']));
      expect(lista.result.tools.every((t) => t.annotations.readOnlyHint)).toBe(true);

      const obras = (await atenderMcp(
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'obras', arguments: { estado: 'en_curso' } },
        },
        ctx,
      )) as { result: { content: { text: string }[]; isError: boolean } };
      expect(obras.result.isError).toBe(false);
      const filas = JSON.parse(obras.result.content[0]!.text) as { folio: string; estado: string }[];
      expect(filas.map((o) => o.folio)).toContain('OB-001');
      expect(filas.every((o) => o.estado !== 'entregada')).toBe(true);

      // el seguimiento no lleva el teléfono ni la dirección del cliente; los nombres van en su idioma
      const seg = (await atenderMcp(
        {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: { name: 'seguimiento_de_obra', arguments: { folio: 'OB-001' } },
        },
        ctx,
      )) as { result: { content: { text: string }[] } };
      const texto = seg.result.content[0]!.text;
      expect(texto).not.toContain('512-555-0101');
      expect(texto).not.toContain('Oak St');
      expect(texto).toContain('"etapa":"Demolición"');
    }));

  it('una obra que no existe es un error de la herramienta; una herramienta o un método que no existen, del protocolo', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const ctx = contexto(tx);
      const r = (await atenderMcp(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'seguimiento_de_obra', arguments: { folio: 'OB-999' } },
        },
        ctx,
      )) as { result: { isError: boolean; content: { text: string }[] } };
      expect(r.result).toMatchObject({
        isError: true,
        content: [{ text: 'No hay una obra con el folio OB-999.' }],
      });
      expect(
        await atenderMcp(
          { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'borrar_todo' } },
          ctx,
        ),
      ).toMatchObject({ error: { code: -32602 } });
      expect(await atenderMcp({ jsonrpc: '2.0', id: 3, method: 'resources/list' }, ctx)).toMatchObject({
        error: { code: -32601 },
      });
      // en lote, sin las notificaciones
      expect(
        await atenderMcp(
          [
            { jsonrpc: '2.0', id: 4, method: 'ping' },
            { jsonrpc: '2.0', method: 'notifications/initialized' },
          ],
          ctx,
        ),
      ).toEqual([{ jsonrpc: '2.0', id: 4, result: {} }]);
    }));

  it('sin el módulo de histórico, el asistente no ve sus herramientas', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      await conAsistente(
        tx,
        MODULOS.filter((m) => m !== 'historico'),
      );
      const nombres = (await herramientasDelAsistente(tx)).map((h) => h.name);
      expect(nombres).not.toContain('historico');
      expect(nombres).not.toContain('analisis_de_obra_cerrada');
      expect(await correrHerramienta(tx, 'historico', {}, 'es')).toBeNull();
    }));
});
