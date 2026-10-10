// La cola sin señal, con los casos de legacy/pruebas/prueba_cola.js y los de las fotos de un cierre.
import { describe, expect, it } from 'vitest';
import { type Almacen, type ElementoCola, procesarCola, type Rechazo, type Respuesta } from './cola';

function almacenDePrueba(inicial: ElementoCola[]) {
  let cola = [...inicial];
  const rechazados: Rechazo[] = [];
  const almacen: Almacen = {
    elementos: async () => [...cola],
    guardar: async (e) => {
      cola = cola.map((x) => (x.id === e.id ? e : x));
    },
    quitar: async (id) => {
      cola = cola.filter((x) => x.id !== id);
    },
    rechazar: async (r) => {
      rechazados.push(r);
    },
  };
  return { almacen, cola: () => cola, rechazados };
}

const etiqueta = { obra: 'OB-001', dia: '2026-10-12' };
const cierre = (id: string, n: number): ElementoCola => ({
  id,
  n,
  tipo: 'cierre',
  etiqueta,
  entrada: { obraId: 'o', claveEnvio: id },
  intentos: 0,
});
const foto = (id: string, n: number, clave: string, indice: number): ElementoCola => ({
  id,
  n,
  tipo: 'foto',
  etiqueta,
  clave,
  indice,
  foto: new Blob(['x']),
  tomadaEn: '2026-10-12T15:00:00Z',
  intentos: 0,
});

/** Un servidor de prueba: contesta según el id, y anota lo que recibió. */
function servidor(contesta: (e: ElementoCola) => Respuesta | 'sin_red') {
  const recibidos: string[] = [];
  const enviar = async (e: ElementoCola) => {
    const r = contesta(e);
    if (r === 'sin_red') throw new TypeError('Failed to fetch');
    if (r.ok) recibidos.push(e.id);
    return r;
  };
  return { enviar, recibidos };
}

describe('la cola sin señal', () => {
  it('un registro que el servidor rechaza por una regla, con otros detrás: sale, se avisa, y lo demás se envía', async () => {
    const a = almacenDePrueba([cierre('lunes', 1), cierre('martes', 2)]);
    const s = servidor((e) =>
      e.id === 'lunes' ? { ok: false, codigo: 'falta_inspeccion', datos: { hito: 'PC3' } } : { ok: true },
    );
    expect(await procesarCola(a.almacen, s.enviar)).toBe('vacia');
    expect(a.cola()).toEqual([]);
    expect(s.recibidos).toEqual(['martes']);
    expect(a.rechazados).toEqual([
      expect.objectContaining({ id: 'lunes', codigo: 'falta_inspeccion', datos: { hito: 'PC3' }, fotos: 0 }),
    ]);
  });

  it('sin señal: nada se descarta, se cuenta el intento y lo de atrás espera su turno', async () => {
    const a = almacenDePrueba([cierre('lunes', 1), cierre('martes', 2)]);
    const s = servidor(() => 'sin_red');
    expect(await procesarCola(a.almacen, s.enviar)).toBe('sin_red');
    expect(a.cola().map((e) => [e.id, e.intentos])).toEqual([
      ['lunes', 1],
      ['martes', 0],
    ]);
    expect(a.rechazados).toEqual([]);
  });

  it('sesión vencida: se detiene y no pierde nada', async () => {
    const a = almacenDePrueba([cierre('lunes', 1), cierre('martes', 2)]);
    const s = servidor(() => ({ ok: false, codigo: 'sesion' }));
    expect(await procesarCola(a.almacen, s.enviar)).toBe('sin_sesion');
    expect(a.cola().map((e) => e.id)).toEqual(['lunes', 'martes']);
    expect(a.rechazados).toEqual([]);
  });

  it('en orden de llegada, aunque se hayan guardado desordenadas; las fotos van detrás de su cierre', async () => {
    const a = almacenDePrueba([foto('f2', 3, 'lunes', 2), cierre('lunes', 1), foto('f1', 2, 'lunes', 1)]);
    const s = servidor(() => ({ ok: true }));
    expect(await procesarCola(a.almacen, s.enviar)).toBe('vacia');
    expect(s.recibidos).toEqual(['lunes', 'f1', 'f2']);
  });

  it('si el cierre se rechaza, sus fotos salen con él; las de otro cierre siguen', async () => {
    const a = almacenDePrueba([
      cierre('lunes', 1),
      foto('f1', 2, 'lunes', 1),
      foto('f2', 3, 'lunes', 2),
      cierre('martes', 4),
      foto('g1', 5, 'martes', 1),
    ]);
    const s = servidor((e) => (e.id === 'lunes' ? { ok: false, codigo: 'dia_ya_cerrado' } : { ok: true }));
    expect(await procesarCola(a.almacen, s.enviar)).toBe('vacia');
    expect(s.recibidos).toEqual(['martes', 'g1']);
    expect(a.rechazados).toEqual([expect.objectContaining({ id: 'lunes', fotos: 2 })]);
  });

  it('una foto que tomó turno antes que su gasto o su cierre espera a que él salga', async () => {
    const a = almacenDePrueba([
      { ...foto('r1', 1, 'g1', 1), de: 'gasto' } as ElementoCola,
      cierre('otro', 2),
      { id: 'g1', n: 3, tipo: 'gasto', etiqueta, entrada: { obraId: 'o', claveEnvio: 'g1' }, intentos: 0 },
    ]);
    const s = servidor(() => ({ ok: true }));
    expect(await procesarCola(a.almacen, s.enviar)).toBe('vacia');
    expect(s.recibidos).toEqual(['otro', 'g1', 'r1']);
  });

  it('un gasto va igual: si se rechaza, su recibo sale con él; si no, el recibo va detrás (D-049)', async () => {
    const gasto = (id: string, n: number): ElementoCola => ({
      id,
      n,
      tipo: 'gasto',
      etiqueta,
      entrada: { obraId: 'o', claveEnvio: id },
      intentos: 0,
    });
    const a = almacenDePrueba([
      gasto('g-malo', 1),
      { ...foto('r1', 2, 'g-malo', 1), de: 'gasto' } as ElementoCola,
      gasto('g-bueno', 3),
      { ...foto('r2', 4, 'g-bueno', 1), de: 'gasto' } as ElementoCola,
    ]);
    const s = servidor((e) =>
      e.id === 'g-malo' ? { ok: false, codigo: 'obra_no_encontrada' } : { ok: true },
    );
    expect(await procesarCola(a.almacen, s.enviar)).toBe('vacia');
    expect(s.recibidos).toEqual(['g-bueno', 'r2']);
    expect(a.rechazados).toEqual([expect.objectContaining({ id: 'g-malo', tipo: 'gasto', fotos: 1 })]);
  });

  it('vuelve la señal: sigue donde se quedó', async () => {
    const a = almacenDePrueba([cierre('lunes', 1), foto('f1', 2, 'lunes', 1)]);
    let hayRed = false;
    const s = servidor(() => (hayRed ? { ok: true } : 'sin_red'));
    expect(await procesarCola(a.almacen, s.enviar)).toBe('sin_red');
    hayRed = true;
    expect(await procesarCola(a.almacen, s.enviar)).toBe('vacia');
    expect(s.recibidos).toEqual(['lunes', 'f1']);
  });
});
