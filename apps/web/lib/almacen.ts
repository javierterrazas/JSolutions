// Lo que la app guarda en el teléfono (IndexedDB): la cola de lo que falta enviar, lo que el servidor rechazó y la
// copia de los datos para trabajar sin señal (fase 2, paso 5). IndexedDB guarda también las fotos (Blob), y no se
// borra al cerrar la app, a diferencia de la memoria.

const NOMBRE = 'ijm';
const VERSION = 1;
export type Bodega = 'cola' | 'rechazados' | 'datos';

let abierta: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  abierta ??= new Promise((listo, falla) => {
    const pedido = indexedDB.open(NOMBRE, VERSION);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      if (!db.objectStoreNames.contains('cola')) db.createObjectStore('cola', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('rechazados')) db.createObjectStore('rechazados', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('datos')) db.createObjectStore('datos', { keyPath: 'clave' });
    };
    pedido.onsuccess = () => listo(pedido.result);
    pedido.onerror = () => {
      abierta = null;
      falla(pedido.error);
    };
  });
  return abierta;
}

async function operacion<T>(
  bodega: Bodega,
  modo: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await abrir();
  return new Promise<T>((listo, falla) => {
    const tx = db.transaction(bodega, modo);
    const pedido = fn(tx.objectStore(bodega));
    tx.oncomplete = () => listo(pedido.result);
    tx.onerror = () => falla(tx.error);
    tx.onabort = () => falla(tx.error);
  });
}

export const todos = <T>(bodega: Bodega) =>
  operacion<T[]>(bodega, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
export const leer = <T>(bodega: Bodega, clave: string) =>
  operacion<T | undefined>(bodega, 'readonly', (s) => s.get(clave) as IDBRequest<T | undefined>);
export const guardar = <T>(bodega: Bodega, valor: T) =>
  operacion(bodega, 'readwrite', (s) => s.put(valor)).then(() => {});
export const quitar = (bodega: Bodega, clave: string) =>
  operacion(bodega, 'readwrite', (s) => s.delete(clave)).then(() => {});
