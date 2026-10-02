// Los folios nunca se repiten, ni con escrituras simultáneas (D-005). El legacy llegó a repetir números al
// calcular el siguiente leyendo la última fila de la hoja.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conexionDePrueba } from '../conexion';

// una conexión por escritura simultánea
const { cliente } = conexionDePrueba(25);
let empresa = '';

beforeAll(async () => {
  const [e] = await cliente`insert into empresas (nombre) values ('Folios de prueba') returning id`;
  empresa = e!.id;
});

afterAll(async () => {
  // estas filas son solo de la prueba: se limpian para dejar la base local como estaba
  await cliente`delete from folios where empresa_id = ${empresa}`;
  await cliente`delete from empresas where id = ${empresa}`;
  await cliente.end();
});

const siguiente = (prefijo: string, digitos = 4) =>
  cliente.begin(
    async (tx) => (await tx`select siguiente_folio(${empresa}, ${prefijo}, ${digitos}) as folio`)[0]!.folio,
  );

describe('siguiente_folio', () => {
  it('numera por empresa y prefijo, con el ancho pedido', async () => {
    expect(await siguiente('OB', 3)).toBe('OB-001');
    expect(await siguiente('OB', 3)).toBe('OB-002');
    expect(await siguiente('BIT')).toBe('BIT-0001');
  });

  it('100 escrituras simultáneas reciben 100 folios distintos y seguidos', async () => {
    const folios = await Promise.all(Array.from({ length: 100 }, () => siguiente('GTO')));
    expect(new Set(folios).size).toBe(100);
    const numeros = folios.map((f) => Number(f.slice(4))).sort((a, b) => a - b);
    expect(numeros).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  }, 60_000); // abrir 25 conexiones a la base de Docker tarda en algunas computadoras

  it('si la transacción falla, el número no se consume', async () => {
    await expect(
      cliente.begin(async (tx) => {
        await tx`select siguiente_folio(${empresa}, 'PAG')`;
        throw new Error('falla después de numerar');
      }),
    ).rejects.toThrow('falla después de numerar');
    expect(await siguiente('PAG')).toBe('PAG-0001');
  });

  it('pasa de 9999 sin cortar el número', async () => {
    await cliente`insert into folios (empresa_id, prefijo, ultimo) values (${empresa}, 'COB', 9999)`;
    expect(await siguiente('COB')).toBe('COB-10000');
  });

  it('un usuario con sesión no puede numerar por su cuenta: solo el servidor', async () => {
    const error = await cliente
      .begin(async (tx) => {
        await tx`set local role authenticated`;
        await tx`select siguiente_folio(${empresa}, 'OB')`;
      })
      .then(
        () => null,
        (e: Error) => e.message,
      );
    expect(error).toMatch(/permission denied/);
  });
});
