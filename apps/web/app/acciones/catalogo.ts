'use server';
// El catálogo del dueño: tipos de obra nuevos (en blanco o copiando otro), sus partidas y las etapas del presupuesto.
import {
  cambiarActivaPartida,
  cambiarActivoTipo,
  cambiarUnidadEtapa,
  copiarTipoObra,
  crearEtapa,
  crearTipoObra,
  guardarPartidaCatalogo,
  renombrarTipoObra,
} from '@ijm/servidor';
import { UNIDADES_ETAPA, type UnidadEtapa } from '@ijm/core';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { comoMiembro, exigirDueno, type Resultado } from '@/lib/acceso';

const texto = (f: FormData, k: string) => String(f.get(k) ?? '');
/** "1,5" o " 12 " → número; vacío → null. Lo que no es número llega como NaN y lo rechaza la validación. */
const numero = (f: FormData, k: string) => {
  const s = texto(f, k).replace(/\s/g, '').replace(',', '.');
  return s === '' ? null : Number(s);
};
const id = (f: FormData, k: string) => texto(f, k) || null;

/** Crea el tipo, en blanco o copiando otro, y abre sus partidas para afinarlas. */
export async function crearTipo(_previo: Resultado | null, formulario: FormData): Promise<Resultado> {
  const acceso = await exigirDueno();
  const nombre = texto(formulario, 'nombre');
  const nombreEn = texto(formulario, 'nombreEn');
  const r =
    texto(formulario, 'modo') === 'copiar'
      ? await comoMiembro(
          (tx) => copiarTipoObra(tx, { desdeId: texto(formulario, 'desde'), nombre, nombreEn }),
          acceso,
        )
      : await comoMiembro(
          (tx) =>
            crearTipoObra(tx, {
              nombre,
              nombreEn,
              partidas: texto(formulario, 'partidas').split('\n'),
              tamano: numero(formulario, 'tamano'),
            }),
          acceso,
        );
  if (!r.ok) return r;
  revalidatePath('/catalogo');
  redirect(`/catalogo/${r.datos.tipoId}`);
}

export async function renombrarTipo(
  tipoId: string,
  _previo: Resultado | null,
  formulario: FormData,
): Promise<Resultado> {
  const r = await comoMiembro(
    (tx) =>
      renombrarTipoObra(tx, {
        tipoId,
        nombre: texto(formulario, 'nombre'),
        nombreEn: texto(formulario, 'nombreEn'),
      }),
    await exigirDueno(),
  );
  if (r.ok) revalidatePath('/catalogo', 'layout');
  return r.ok ? { ok: true, datos: undefined } : r;
}

export async function cambiarActivoDeTipo(tipoId: string, activo: boolean): Promise<void> {
  await comoMiembro((tx) => cambiarActivoTipo(tx, { tipoId, activo }), await exigirDueno());
  revalidatePath('/catalogo', 'layout');
}

/** Agrega una partida al tipo (sin `partidaId`) o la edita. */
export async function guardarPartida(
  tipoId: string,
  partidaId: string | null,
  _previo: Resultado | null,
  formulario: FormData,
): Promise<Resultado> {
  const r = await comoMiembro(
    (tx) =>
      guardarPartidaCatalogo(tx, {
        partidaId,
        tipoId,
        nombre: texto(formulario, 'nombre'),
        nombreEn: texto(formulario, 'nombreEn'),
        orden: numero(formulario, 'orden'),
        peso: numero(formulario, 'peso'),
        dias: numero(formulario, 'dias'),
        responsable: texto(formulario, 'responsable') as 'cuadrilla' | 'pm' | 'subcontratista',
        oficioId: id(formulario, 'oficio'),
        paralelo: formulario.get('paralelo') === 'si',
        espera: numero(formulario, 'espera'),
        etapaId: id(formulario, 'etapa'),
        hitoId: id(formulario, 'hito'),
      }),
    await exigirDueno(),
  );
  if (r.ok) revalidatePath('/catalogo', 'layout');
  return r.ok ? { ok: true, datos: undefined } : r;
}

/** Da de baja o reactiva una partida; reactivarla puede chocar con otra del mismo nombre. */
export async function cambiarActivaDePartida(
  partidaId: string,
  activa: boolean,
  _previo: Resultado | null,
): Promise<Resultado> {
  const r = await comoMiembro((tx) => cambiarActivaPartida(tx, { partidaId, activa }), await exigirDueno());
  if (r.ok) revalidatePath('/catalogo', 'layout');
  return r.ok ? { ok: true, datos: undefined } : r;
}

/** La unidad elegida; lo que no sea una, por pie². */
const unidadDe = (f: FormData): UnidadEtapa => {
  const u = String(f.get('unidad') ?? '');
  return (UNIDADES_ETAPA as readonly string[]).includes(u) ? (u as UnidadEtapa) : 'pie2';
};

export async function crearEtapaNueva(_previo: Resultado | null, formulario: FormData): Promise<Resultado> {
  const r = await comoMiembro(
    (tx) =>
      crearEtapa(tx, {
        nombre: texto(formulario, 'nombre'),
        nombreEn: texto(formulario, 'nombreEn'),
        unidad: unidadDe(formulario),
      }),
    await exigirDueno(),
  );
  if (r.ok) revalidatePath('/catalogo', 'layout');
  return r.ok ? { ok: true, datos: undefined } : r;
}

/** Cambia cómo se cotiza una etapa: por pie², por pie lineal (D-086) o fija por espacio (D-095). */
export async function cambiarUnidad(
  etapaId: string,
  _previo: Resultado | null,
  formulario: FormData,
): Promise<Resultado> {
  const unidad = unidadDe(formulario);
  const r = await comoMiembro((tx) => cambiarUnidadEtapa(tx, { etapaId, unidad }), await exigirDueno());
  if (r.ok) revalidatePath('/catalogo', 'layout');
  return r.ok ? { ok: true, datos: undefined } : r;
}
