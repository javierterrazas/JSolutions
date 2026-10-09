// Crear obra (legacy: admin/servidor.js duNuevaObra): la obra con su folio, su contrato, sus espacios (primero
// Generales de obra) y, en cada espacio, la copia de las partidas de su plantilla.
import {
  copiarPlantilla,
  type DatosPartida,
  ErrorDeNegocio,
  type Responsable,
  validarAltaObra,
} from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { dia, uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion } from './sesion';

const EntradaObra = z.object({
  cliente: z.string().nullish(),
  telefono: z.string().nullish(),
  direccion: z.string().nullish(),
  pmId: uuid.nullish(),
  inicio: dia.nullish(),
  finEstimada: dia.nullish(),
  contrato: z.number().nullish(),
  notas: z.string().nullish(),
  espacios: z
    .array(
      z.object({
        tipoEspacioId: uuid,
        nombre: z.string().nullish(),
        pies2: z.number().nonnegative().nullish(),
        piesLineales: z.number().nonnegative().nullish(),
      }),
    )
    .default([]),
  confirmado: z.array(z.string()).default([]),
});
export type EntradaObra = z.input<typeof EntradaObra>;

export type ResultadoObra =
  | { readonly ok: true; readonly obraId: string; readonly folio: string }
  | { readonly ok: false; readonly confirmar: 'obra_duplicada'; readonly obraId: string };

interface Plantilla {
  id: string;
  orden: number;
  nombre_es: string;
  nombre_en: string | null;
  hito_id: string | null;
  peso: string;
  dias: number;
  responsable: Responsable;
  oficio_id: string | null;
  paralelo: boolean;
  espera: number;
  etapa_id: string | null;
}

/** Copia a un espacio nuevo las partidas activas de la plantilla de su tipo. */
async function copiarPartidas(tx: Tx, empresaId: string, obraId: string, espacioId: string, tipoId: string) {
  const plantilla = await tx<Plantilla[]>`
    select id, orden, nombre_es, nombre_en, hito_id, peso, dias, responsable, oficio_id, paralelo, espera, etapa_id
    from plantillas_partida where tipo_espacio_id = ${tipoId} and activa order by orden, nombre_es`;
  if (!plantilla.length) return;
  const datos: (DatosPartida & { orden: number })[] = plantilla.map((p) => ({
    orden: p.orden,
    nombre: p.nombre_es,
    hitoId: p.hito_id,
    peso: Number(p.peso),
    dias: p.dias,
    responsable: p.responsable,
    oficioId: p.oficio_id,
    paralelo: p.paralelo,
    espera: p.espera,
    etapaId: p.etapa_id,
  }));
  const copia = copiarPlantilla(datos);
  await tx`insert into partidas_obra ${tx(
    copia.map((p, i) => ({
      empresa_id: empresaId,
      obra_id: obraId,
      espacio_id: espacioId,
      plantilla_id: plantilla[i]!.id,
      orden: p.orden,
      nombre_es: p.nombre,
      nombre_en: plantilla[i]!.nombre_en,
      hito_id: p.hitoId,
      peso: p.peso,
      dias: p.dias,
      responsable: p.responsable,
      oficio_id: p.oficioId,
      paralelo: p.paralelo,
      espera: p.espera,
      etapa_id: p.etapaId,
    })),
  )}`;
}

/**
 * Da de alta una obra. Solo el dueño o el administrador. Si el mismo cliente ya tiene una obra activa en la misma
 * dirección, pide confirmar (`obra_duplicada`) y no crea nada.
 */
export async function crearObra(tx: Tx, entrada: EntradaObra, ahora = new Date()): Promise<ResultadoObra> {
  const e = validarEntrada(EntradaObra, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);

  const tipos = await tx<{ id: string; es_generales: boolean; nombre_es: string }[]>`
    select id, es_generales, nombre_es from tipos_espacio where activo`;
  const generales = tipos.find((t) => t.es_generales);
  if (!generales) throw new ErrorDeNegocio('falta_tipo_generales');
  const desconocido = e.espacios.find((x) => !tipos.some((t) => t.id === x.tipoEspacioId));
  if (desconocido) throw new ErrorDeNegocio('tipo_espacio_inexistente', { tipo: desconocido.tipoEspacioId });

  const pms = await tx<{ id: string }[]>`select id from miembros where rol = 'pm' and activo`;
  const activas = await tx<{ id: string; cliente: string; direccion: string }[]>`
    select id, cliente, direccion from obras where estado <> 'entregada'`;
  const r = validarAltaObra(
    {
      cliente: e.cliente ?? null,
      telefono: e.telefono ?? null,
      direccion: e.direccion ?? null,
      pmId: e.pmId ?? null,
      inicio: e.inicio ?? null,
      finEstimada: e.finEstimada ?? null,
      contrato: e.contrato ?? null,
      // como en el legacy, "Generales" no se captura: cada obra lo tiene siempre
      espacios: e.espacios
        .filter((x) => x.tipoEspacioId !== generales.id)
        // sin nombre, el espacio toma el de su tipo ("Baño"), no su id
        .map((x) => ({
          tipo: x.tipoEspacioId,
          nombre: x.nombre?.trim() || tipos.find((t) => t.id === x.tipoEspacioId)!.nombre_es,
          pies2: x.pies2 ?? null,
          piesLineales: x.piesLineales ?? null,
        })),
      confirmado: e.confirmado,
    },
    { pmsActivos: new Set(pms.map((p) => p.id)), obrasActivas: activas },
  );
  if (!r.ok) return r;

  const [obra] = await tx<{ id: string; folio: string }[]>`
    insert into obras (empresa_id, cliente, telefono_cliente, direccion, pm_id, fecha_inicio, fecha_fin_estimada, notas)
    values (${s.empresaId}, ${e.cliente!.trim()}, ${e.telefono!.trim()}, ${e.direccion!.trim()}, ${e.pmId!},
            ${e.inicio!}, ${e.finEstimada!}, ${e.notas ?? null})
    returning id, folio`;
  await tx`insert into obras_finanzas (obra_id, empresa_id, contrato_original) values (${obra!.id}, ${s.empresaId}, ${e.contrato!})`;

  const espacios = [
    { tipo: generales.id, nombre: generales.nombre_es, pies2: 0, piesLineales: 0 },
    ...r.espacios.map((x) => ({
      tipo: x.tipo,
      nombre: x.nombre,
      pies2: x.pies2 ?? 0,
      piesLineales: x.piesLineales ?? 0,
    })),
  ];
  for (const [orden, x] of espacios.entries()) {
    const [esp] = await tx<{ id: string }[]>`
      insert into espacios (empresa_id, obra_id, tipo_espacio_id, nombre, orden, pies2_cotizados, pies_lineales_cotizados)
      values (${s.empresaId}, ${obra!.id}, ${x.tipo}, ${x.nombre}, ${orden}, ${x.pies2}, ${x.piesLineales})
      returning id`;
    await copiarPartidas(tx, s.empresaId, obra!.id, esp!.id, x.tipo);
  }
  return { ok: true, obraId: obra!.id, folio: obra!.folio };
}

const EntradaEspacio = z.object({
  obraId: uuid,
  tipoEspacioId: uuid,
  nombre: z.string().nullish(),
  pies2: z.number().nonnegative().nullish(),
});

/**
 * Agrega un espacio a una obra que ya existe (legacy: duAgregarArea): con las partidas de su tipo, al final. Solo el
 * dueño o el administrador, y no en una obra entregada. Su presupuesto se captura después, como el de los demás.
 */
export async function agregarEspacio(
  tx: Tx,
  entrada: z.input<typeof EntradaEspacio>,
  ahora = new Date(),
): Promise<{ espacioId: string }> {
  const e = validarEntrada(EntradaEspacio, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const [obra] = await tx<{ estado: string }[]>`select estado from obras where id = ${e.obraId}`;
  if (!obra) throw new ErrorDeNegocio('obra_no_encontrada');
  if (obra.estado === 'entregada') throw new ErrorDeNegocio('obra_cerrada');
  const [tipo] = await tx<{ nombre_es: string; es_generales: boolean }[]>`
    select nombre_es, es_generales from tipos_espacio where id = ${e.tipoEspacioId} and activo`;
  if (!tipo || tipo.es_generales)
    throw new ErrorDeNegocio('tipo_espacio_inexistente', { tipo: e.tipoEspacioId });
  const nombre = e.nombre?.trim() || tipo.nombre_es;
  if (!(Number(e.pies2) > 0)) throw new ErrorDeNegocio('faltan_pies2', { espacios: [nombre] });

  const [ultimo] = await tx<{ orden: number }[]>`
    select coalesce(max(orden), 0) + 1 as orden from espacios where obra_id = ${e.obraId}`;
  const [esp] = await tx<{ id: string }[]>`
    insert into espacios (empresa_id, obra_id, tipo_espacio_id, nombre, orden, pies2_cotizados)
    values (${s.empresaId}, ${e.obraId}, ${e.tipoEspacioId}, ${nombre}, ${ultimo!.orden}, ${Number(e.pies2)})
    returning id`;
  await copiarPartidas(tx, s.empresaId, e.obraId, esp!.id, e.tipoEspacioId);
  return { espacioId: esp!.id };
}
