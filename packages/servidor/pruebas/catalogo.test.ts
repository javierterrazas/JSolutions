// El catálogo del dueño: tipos de obra con sus partidas y etapas nuevas (legacy: duCrearTipo, duClonarSecuencia,
// duGuardarPartida), a nombre de usuarios reales, contra la base local.
import { afterAll, describe, expect, it } from 'vitest';
import {
  agregarEspacio,
  cambiarActivaPartida,
  cambiarActivoTipo,
  catalogoDeTipos,
  copiarTipoObra,
  crearEtapa,
  crearTipoObra,
  datosParaObraNueva,
  guardarPartidaCatalogo,
  renombrarTipoObra,
  tipoParaEditar,
  type Tx,
} from '../src/index';
import { codigo, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const idDe = async (tx: Tx, tabla: 'tipos_espacio' | 'etapas' | 'oficios', nombre: string) =>
  (await tx<{ id: string }[]>`select id from ${tx(tabla)} where nombre_es = ${nombre}`)[0]!.id;

describe('tipos de obra', () => {
  it('crea uno en blanco: las partidas en su orden, el tamaño repartido, y se ofrece en una obra nueva', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { tipoId } = await crearTipoObra(tx, {
        nombre: ' Piso de cemento ',
        nombreEn: '',
        partidas: ['Protección', 'Desbaste y pulido', '', 'Sellador'],
        tamano: 40,
      });
      const [t] =
        await tx`select nombre_es, nombre_en, es_generales, activo from tipos_espacio where id = ${tipoId}`;
      expect(t).toEqual({ nombre_es: 'Piso de cemento', nombre_en: null, es_generales: false, activo: true });
      const ps = await tx`select orden, nombre_es, peso, dias, responsable from plantillas_partida
                          where tipo_espacio_id = ${tipoId} order by orden`;
      expect(ps).toEqual([
        { orden: 1, nombre_es: 'Protección', peso: '13.00', dias: 1, responsable: 'cuadrilla' },
        { orden: 2, nombre_es: 'Desbaste y pulido', peso: '13.00', dias: 1, responsable: 'cuadrilla' },
        { orden: 3, nombre_es: 'Sellador', peso: '13.00', dias: 1, responsable: 'cuadrilla' },
      ]);
      const obra = await datosParaObraNueva(tx);
      expect(obra.tipos.find((x) => x.id === tipoId)).toMatchObject({ partidas: 3 });
    }));

  it('sin nombre, con un nombre que ya existe o sin partidas, no crea nada', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const antes = (await tx`select count(*)::int as n from tipos_espacio`)[0]!.n;
      expect(await codigo(tx, () => crearTipoObra(tx, { nombre: ' ', partidas: ['a'] }))).toBe(
        'tipo_sin_nombre',
      );
      expect(await codigo(tx, () => crearTipoObra(tx, { nombre: 'baño', partidas: ['a'] }))).toBe(
        'tipo_repetido',
      );
      expect(await codigo(tx, () => crearTipoObra(tx, { nombre: 'Lavandería', partidas: [' '] }))).toBe(
        'tipo_sin_partidas',
      );
      expect((await tx`select count(*)::int as n from tipos_espacio`)[0]!.n).toBe(antes);
    }));

  it('copia las partidas activas de otro tipo, con todo lo suyo', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const bano = await idDe(tx, 'tipos_espacio', 'Baño');
      const { tipoId } = await copiarTipoObra(tx, { desdeId: bano, nombre: 'Medio baño' });
      const columnas = (id: string) => tx`
        select orden, nombre_es, hito_id, peso, dias, responsable, oficio_id, paralelo, espera, etapa_id
        from plantillas_partida where tipo_espacio_id = ${id} and activa order by orden`;
      expect(await columnas(tipoId)).toEqual(await columnas(bano));
      expect(await codigo(tx, () => copiarTipoObra(tx, { desdeId: bano, nombre: 'Medio baño' }))).toBe(
        'tipo_repetido',
      );
    }));

  it('se renombra; se da de baja y ya no se ofrece; Generales de obra no se da de baja', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const bano = await idDe(tx, 'tipos_espacio', 'Baño');
      await renombrarTipoObra(tx, { tipoId: bano, nombre: 'Baño completo', nombreEn: 'Full bath' });
      expect((await tipoParaEditar(tx, { tipoId: bano }))!.tipo.nombre).toEqual({
        es: 'Baño completo',
        en: 'Full bath',
      });
      await cambiarActivoTipo(tx, { tipoId: bano, activo: false });
      expect((await datosParaObraNueva(tx)).tipos.some((x) => x.id === bano)).toBe(false);
      expect(
        await codigo(tx, () =>
          agregarEspacio(tx, { obraId: OBRAS.a1Carlos, tipoEspacioId: bano, pies2: 40 }),
        ),
      ).toBe('tipo_espacio_inexistente');
      const generales = (await tx<{ id: string }[]>`select id from tipos_espacio where es_generales`)[0]!.id;
      expect(await codigo(tx, () => cambiarActivoTipo(tx, { tipoId: generales, activo: false }))).toBe(
        'tipo_generales',
      );
      const lista = await catalogoDeTipos(tx);
      expect(lista.tipos.map((x) => [x.generales, x.activo])).toEqual([
        [true, true],
        [false, false],
      ]);
    }));

  it('el PM no edita el catálogo', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      expect(await codigo(tx, () => crearTipoObra(tx, { nombre: 'Lavandería', partidas: ['a'] }))).toBe(
        'solo_dueno',
      );
      expect(await codigo(tx, () => catalogoDeTipos(tx))).toBe('solo_dueno');
    }));
});

describe('partidas del catálogo', () => {
  it('agrega una al final con todo lo suyo, y la edita', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const bano = await idDe(tx, 'tipos_espacio', 'Baño');
      const plomeria = await idDe(tx, 'oficios', 'Plomería');
      const etapa = await idDe(tx, 'etapas', 'Plomería');
      const { partidaId } = await guardarPartidaCatalogo(tx, {
        tipoId: bano,
        nombre: 'Instalación de regadera',
        dias: 2,
        responsable: 'subcontratista',
        oficioId: plomeria,
        paralelo: true,
        espera: 3,
        etapaId: etapa,
        peso: 4,
      });
      const leer = async () =>
        (await tipoParaEditar(tx, { tipoId: bano }))!.partidas.find((p) => p.id === partidaId);
      expect(await leer()).toMatchObject({
        orden: 3,
        dias: 2,
        responsable: 'subcontratista',
        oficioId: plomeria,
        paralelo: true,
        espera: 3,
        etapaId: etapa,
        peso: 4,
        activa: true,
      });
      // pasa a la cuadrilla: el oficio se va
      await guardarPartidaCatalogo(tx, {
        partidaId,
        tipoId: bano,
        nombre: 'Regadera',
        orden: 1,
        oficioId: plomeria,
      });
      expect(await leer()).toMatchObject({
        orden: 1,
        nombre: { es: 'Regadera', en: null },
        responsable: 'cuadrilla',
        oficioId: null,
        dias: 1,
        etapaId: null,
      });
    }));

  it('rechaza lo que no cuadra', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const bano = await idDe(tx, 'tipos_espacio', 'Baño');
      const base = { tipoId: bano, nombre: 'Nicho' };
      expect(await codigo(tx, () => guardarPartidaCatalogo(tx, { ...base, nombre: '' }))).toBe(
        'partida_sin_nombre',
      );
      expect(
        await codigo(tx, () => guardarPartidaCatalogo(tx, { ...base, nombre: 'rough de plomería' })),
      ).toBe('partida_repetida');
      expect(
        await codigo(tx, () => guardarPartidaCatalogo(tx, { ...base, responsable: 'subcontratista' })),
      ).toBe('falta_oficio');
      expect(await codigo(tx, () => guardarPartidaCatalogo(tx, { ...base, etapaId: bano }))).toBe(
        'etapa_inexistente',
      );
      expect(await codigo(tx, () => guardarPartidaCatalogo(tx, { ...base, hitoId: bano }))).toBe(
        'hito_inexistente',
      );
      expect(await codigo(tx, () => guardarPartidaCatalogo(tx, { ...base, dias: 0 }))).toBe(
        'datos_invalidos',
      );
    }));

  it('se da de baja: los espacios nuevos ya no la copian; al reactivarla no puede repetir nombre', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const bano = await idDe(tx, 'tipos_espacio', 'Baño');
      const [demo] = await tx<{ id: string }[]>`
        select id from plantillas_partida where tipo_espacio_id = ${bano} and nombre_es like 'Demolición%'`;
      await cambiarActivaPartida(tx, { partidaId: demo!.id, activa: false });
      const { espacioId } = await agregarEspacio(tx, {
        obraId: OBRAS.a1Carlos,
        tipoEspacioId: bano,
        pies2: 40,
      });
      const copiadas = await tx`select nombre_es from partidas_obra where espacio_id = ${espacioId}`;
      expect(copiadas).toEqual([{ nombre_es: 'Rough de plomería' }]);

      await guardarPartidaCatalogo(tx, { tipoId: bano, nombre: 'Demolición y retiro de escombro' });
      expect(await codigo(tx, () => cambiarActivaPartida(tx, { partidaId: demo!.id, activa: true }))).toBe(
        'partida_repetida',
      );
    }));
});

describe('etapas', () => {
  it('crea una al final y se puede usar en una partida; sin nombre o repetida, no', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { etapaId } = await crearEtapa(tx, { nombre: 'Pintura', nombreEn: 'Painting' });
      const [e] = await tx`select nombre_es, nombre_en, orden from etapas where id = ${etapaId}`;
      expect(e).toEqual({ nombre_es: 'Pintura', nombre_en: 'Painting', orden: 3 });
      expect((await catalogoDeTipos(tx)).etapas.map((x) => x.nombre.es)).toEqual([
        'Demolición',
        'Plomería',
        'Pintura',
      ]);
      expect(await codigo(tx, () => crearEtapa(tx, { nombre: ' ' }))).toBe('etapa_sin_nombre');
      expect(await codigo(tx, () => crearEtapa(tx, { nombre: 'pintura' }))).toBe('etapa_repetida');
      const bano = await idDe(tx, 'tipos_espacio', 'Baño');
      await guardarPartidaCatalogo(tx, { tipoId: bano, nombre: 'Pintar techo', etapaId });
    }));

  it('el PM no crea etapas', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      expect(await codigo(tx, () => crearEtapa(tx, { nombre: 'Pintura' }))).toBe('solo_dueno');
    }));
});
