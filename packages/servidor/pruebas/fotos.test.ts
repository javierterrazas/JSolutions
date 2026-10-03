// Subir una foto numerada (adaptada de legacy/pruebas/prueba_fotos_despues.js): el teléfono sube a Storage con la
// sesión del PM, el servidor la registra con su número y un reintento no la duplica. Y el enlace firmado para verla.
import { afterAll, describe, expect, it } from 'vitest';
import { cerrarDia, enlaceDeFoto, registrarFoto, rutaParaFoto, type FirmarEnlace } from '../src/index';
import {
  clienteDe,
  clienteServicio,
  codigo,
  como,
  enAustin,
  OBRAS,
  probarComo,
  servidor,
  USUARIOS,
} from './apoyo';

const subidas: string[] = [];
afterAll(async () => {
  if (subidas.length) await clienteServicio().storage.from('fotos').remove(subidas);
  await servidor.sql.end();
});

const JPG = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
async function subir(correo: string, ruta: string) {
  const { error } = await (await clienteDe(correo)).storage.from('fotos').upload(ruta, JPG);
  if (error) throw error;
  subidas.push(ruta);
}
const firmar: FirmarEnlace = async (ruta, segundos) => {
  const { data, error } = await clienteServicio().storage.from('fotos').createSignedUrl(ruta, segundos);
  if (error) throw error;
  return data.signedUrl;
};
const LUNES = enAustin('2026-10-12', 18);

describe('fotos numeradas del cierre', () => {
  it('se registran con su número; un reintento no duplica; no pasan de las comprometidas', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const rough = (
        await tx<
          { id: string }[]
        >`select id from partidas_obra where obra_id = ${OBRAS.a1Carlos} and orden = 2`
      )[0]!.id;
      const cierre = await cerrarDia(
        tx,
        { obraId: OBRAS.a1Carlos, partidas: [rough], fotosPorSubir: 2 },
        LUNES,
      );
      const ref = { refTipo: 'bitacora' as const, refId: cierre.bitacoraId };

      const { ruta } = await rutaParaFoto(tx, ref);
      expect(ruta.startsWith(`e000000a-0000-4000-8000-000000000000/${OBRAS.a1Carlos}/bitacora/`)).toBe(true);
      await subir('pm1@empresa-a.test', ruta);

      const primera = await registrarFoto(tx, { ...ref, indice: 1, ruta });
      expect(primera).toMatchObject({ repetida: false, pendientes: 1 });
      // la señal falló y el teléfono la vuelve a mandar
      expect(await registrarFoto(tx, { ...ref, indice: 1, ruta })).toEqual({
        fotoId: primera.fotoId,
        repetida: true,
        pendientes: 1,
      });
      expect(await codigo(tx, () => registrarFoto(tx, { ...ref, indice: 3, ruta }))).toBe(
        'foto_no_comprometida',
      );
    }));

  it('solo se registra un archivo que existe y que subió el mismo usuario', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const rough = (
        await tx<
          { id: string }[]
        >`select id from partidas_obra where obra_id = ${OBRAS.a1Carlos} and orden = 2`
      )[0]!.id;
      const cierre = await cerrarDia(
        tx,
        { obraId: OBRAS.a1Carlos, partidas: [rough], fotosPorSubir: 2 },
        LUNES,
      );
      const ref = { refTipo: 'bitacora' as const, refId: cierre.bitacoraId };
      const { ruta: nunca } = await rutaParaFoto(tx, ref);
      expect(await codigo(tx, () => registrarFoto(tx, { ...ref, indice: 1, ruta: nunca }))).toBe(
        'foto_no_subida',
      );
      // un archivo que subió el dueño en esa carpeta no lo registra el PM como suyo
      const { ruta: delDueno } = await rutaParaFoto(tx, ref);
      await subir('dueno@empresa-a.test', delDueno);
      expect(await codigo(tx, () => registrarFoto(tx, { ...ref, indice: 2, ruta: delDueno }))).toBe(
        'foto_no_subida',
      );
    }));

  it('el enlace para verla dura minutos, y solo lo pide quien puede ver la foto', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const rough = (
        await tx<
          { id: string }[]
        >`select id from partidas_obra where obra_id = ${OBRAS.a1Carlos} and orden = 2`
      )[0]!.id;
      const cierre = await cerrarDia(
        tx,
        { obraId: OBRAS.a1Carlos, partidas: [rough], fotosPorSubir: 1 },
        LUNES,
      );
      const ref = { refTipo: 'bitacora' as const, refId: cierre.bitacoraId };
      const { ruta } = await rutaParaFoto(tx, ref);
      await subir('pm1@empresa-a.test', ruta);
      const { fotoId } = await registrarFoto(tx, { ...ref, indice: 1, ruta });

      const enlace = await enlaceDeFoto(tx, fotoId, firmar);
      expect(enlace.segundos).toBe(300);
      expect((await fetch(enlace.url)).status).toBe(200);
      await como(tx, USUARIOS.luis);
      expect(await codigo(tx, () => enlaceDeFoto(tx, fotoId, firmar))).toBe('foto_no_encontrada');
    }));
});
