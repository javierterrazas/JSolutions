// La marca de cada empresa (D-078): el dueño cambia su color, el fondo del ícono y su logo; el manifiesto y los íconos
// la leen sin sesión, por el id de la empresa; el PM la ve en su encabezado.
import { afterAll, describe, expect, it } from 'vitest';
import {
  empresaDelPortal,
  guardarMarca,
  marcaDeMiEmpresa,
  marcaPublica,
  quienSoy,
  sinIdentidad,
  tipoDeImagen,
} from '../src/index';
import { codigo, como, EMPRESA_A, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

// lo mínimo para que se reconozca: la firma de un PNG y de un JPEG
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

describe('la marca de la empresa', () => {
  it('reconoce el tipo de imagen por sus bytes, no por su nombre', () => {
    expect(tipoDeImagen(PNG)).toBe('image/png');
    expect(tipoDeImagen(JPEG)).toBe('image/jpeg');
    expect(tipoDeImagen(new TextEncoder().encode('<svg></svg>'))).toBeNull();
  });

  it('el dueño cambia el color, el fondo y el logo; cada cambio sube la versión', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const antes = await marcaDeMiEmpresa(tx);
      expect(antes).toMatchObject({ empresaId: EMPRESA_A, nombre: 'IJM Construction', conLogo: false });
      const r = await guardarMarca(tx, { color: '#0F766E', fondoBlanco: false, logo: PNG });
      expect(r.version).toBe(antes.version + 1);
      expect(await marcaDeMiEmpresa(tx)).toMatchObject({
        color: '#0f766e',
        fondoBlanco: false,
        conLogo: true,
      });

      // sin logo en la entrada, se queda el que hay; con null, se quita
      await guardarMarca(tx, { color: '#0f766e', fondoBlanco: true });
      expect((await marcaDeMiEmpresa(tx)).conLogo).toBe(true);
      await guardarMarca(tx, { color: '#0f766e', fondoBlanco: true, logo: null });
      expect((await marcaDeMiEmpresa(tx)).conLogo).toBe(false);
    }));

  it('sin sesión, la marca pública trae nombre, color y logo; el portal sabe de qué empresa es', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      await guardarMarca(tx, { color: '#0f766e', fondoBlanco: true, logo: JPEG });
      await sinIdentidad(tx);
      const m = (await marcaPublica(tx, { empresaId: EMPRESA_A }))!;
      expect(m).toMatchObject({
        nombre: 'IJM Construction',
        color: '#0f766e',
        logoTipo: 'image/jpeg',
        fondoBlanco: true,
      });
      expect([...m.logo!]).toEqual([...JPEG]);
      expect(await marcaPublica(tx, { empresaId: 'e0000000-0000-4000-8000-000000000099' })).toBeNull();
      expect(await empresaDelPortal(tx, { token: 'enlace-de-prueba-cliente-garcia-2026' })).toEqual({
        id: EMPRESA_A,
        conLogo: true,
        version: m.version,
      });
      expect(await empresaDelPortal(tx, { token: 'un-enlace-que-no-existe-00000' })).toBeNull();
    }));

  it('el PM la ve en "quién soy"; no la cambia; un logo que no es imagen o pesa de más, no', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      expect(
        await codigo(tx, () =>
          guardarMarca(tx, { color: '#000000', fondoBlanco: true, logo: new Uint8Array([1, 2, 3]) }),
        ),
      ).toBe('logo_invalido');
      const pesado = new Uint8Array(1024 * 1024 + 1);
      pesado.set(PNG);
      expect(
        await codigo(tx, () => guardarMarca(tx, { color: '#000000', fondoBlanco: true, logo: pesado })),
      ).toBe('logo_pesado');
      expect(await codigo(tx, () => guardarMarca(tx, { color: 'rojo', fondoBlanco: true }))).toBe(
        'datos_invalidos',
      );
      await como(tx, USUARIOS.carlos);
      expect((await quienSoy(tx)).marca).toMatchObject({ color: '#1d3557', conLogo: false });
      expect(await codigo(tx, () => guardarMarca(tx, { color: '#000000', fondoBlanco: true }))).toBe(
        'solo_dueno',
      );
    }));
});
