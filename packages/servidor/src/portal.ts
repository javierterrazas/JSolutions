// El portal del cliente (D-066): un enlace privado por obra donde el cliente ve cómo va su remodelación, sin cuenta
// ni PIN. Lo que lee el cliente sale de funciones de la base que reciben el token (20261016000100_portal_cliente.sql)
// y contestan solo lo que él puede ver, sin dinero; el avance se calcula con las mismas reglas del seguimiento del
// dueño (avanceDeLaObra). El dueño crea y anula el enlace; el PM o el dueño marcan qué fotos ve el cliente.
import { calendario, type Dia, type DiaSemana, ErrorDeNegocio, hoyEn, type Responsable } from '@ijm/core';
import postgres from 'postgres';
import { z } from 'zod';
import { nuevoSecreto } from './acceso';
import type { Tx } from './conexion';
import type { Nombre } from './consultas-obra';
import { uuid, validarEntrada } from './entrada';
import { type FirmarEnlace, SEGUNDOS_ENLACE } from './fotos';
import { avanceDeLaObra } from './seguimiento';
import { exigirDueno, leerSesion } from './sesion';

const Token = z.string().min(20).max(200);

export interface PortalCliente {
  readonly empresa: string;
  readonly obra: {
    readonly folio: string;
    readonly cliente: string;
    readonly direccion: string;
    readonly estado: string;
    readonly inicio: Dia;
    /** Con los días de las órdenes de cambio autorizadas. La prevista no se muestra al cliente. */
    readonly entregaComprometida: Dia;
    /** Si ya se entregó: el día y hasta cuándo dura la garantía. */
    readonly entregada: { dia: Dia; garantiaVence: Dia } | null;
  };
  readonly avance: { pct: number; terminadas: number; total: number };
  /** Cada espacio con su avance y en qué va (Generales de obra solo si ya empezó). */
  readonly espacios: readonly {
    nombre: string;
    pct: number;
    estado: 'sin_iniciar' | 'en_curso' | 'terminado';
    etapa: Nombre | null;
    enCurso: readonly Nombre[];
  }[];
  /** Los días trabajados del último mes, lo más reciente primero: qué partidas se trabajaron y cuáles se terminaron. */
  readonly dias: readonly {
    dia: Dia;
    partidas: readonly { espacio: string; partida: Nombre; terminada: boolean }[];
  }[];
  /** Las fotos marcadas para el cliente, lo más nuevo primero. */
  readonly fotos: readonly { id: string; dia: Dia }[];
  /**
   * Sus órdenes de cambio (D-067), la más nueva primero, con lo que se le cobra (nunca el costo ni el margen), y el
   * contrato original para saber cuánto suma su contrato.
   */
  readonly cambios: {
    readonly contrato: number | null;
    readonly ordenes: readonly CambioDelPortal[];
  };
  /** Lo que ha pagado (D-071): sus pagos vigentes, el más reciente primero. */
  readonly pagos: readonly { folio: string; fecha: Dia; concepto: string; monto: number }[];
}

export interface CambioDelPortal {
  readonly id: string;
  readonly folio: string;
  readonly motivo: string;
  readonly descripcion: string;
  readonly dias: number;
  readonly condicion: string | null;
  readonly estado: 'propuesta' | 'autorizada' | 'rechazada' | 'facturada';
  readonly precio: number;
  readonly respuesta: {
    decision: 'aprobada' | 'rechazada';
    nombre: string;
    cuando: string;
    comentario: string | null;
  } | null;
  /** Si ya se hizo (D-081): cuándo y sus fotos. */
  readonly hecho: { cuando: string; fotos: readonly string[] } | null;
  /**
   * Lo que el cliente está viendo de la orden (D-103): viaja con su respuesta y, si el dueño la editó mientras tanto,
   * la respuesta no entra y el cliente la vuelve a ver.
   */
  readonly huella: string;
}

/** La huella de lo que el cliente ve de una orden: si algo de esto cambia, su firma ya no es de lo mismo. */
function huellaDeCambio(o: {
  motivo: string;
  descripcion: string;
  dias: number;
  condicion: string | null;
  precio: number | string;
}): string {
  return JSON.stringify([o.motivo, o.descripcion, o.dias, o.condicion, Number(o.precio)]);
}

type CambioDeLaBase = Omit<CambioDelPortal, 'precio' | 'huella'> & { precio: number | string };

async function cambiosDelEnlace(
  tx: Tx,
  token: string,
): Promise<{ contrato: number | null; ordenes: CambioDeLaBase[] } | null> {
  const [c] = await tx<{ c: { contrato: number | null; ordenes: CambioDeLaBase[] } | null }[]>`
    select public.cambios_portal_cliente(${token}) as c`;
  return c?.c ?? null;
}

interface Datos {
  empresa: string;
  zona: string;
  obra: {
    id: string;
    folio: string;
    cliente: string;
    direccion: string;
    estado: string;
    inicio: Dia;
    fin: Dia;
  };
  diasLaborables: number[] | null;
  feriados: Dia[];
  espacios: { id: string; nombre: string; generales: boolean }[];
  partidas: {
    id: string;
    espacio: string;
    es: string;
    en: string | null;
    peso: number;
    dias: number;
    responsable: Responsable;
    oficio: string | null;
    paralelo: boolean;
    espera: number;
    etapa: string | null;
  }[];
  avance: { partidaId: string; estado: 'en_progreso' | 'terminada'; dia: Dia }[];
  diasCambios: number;
  etapas: { id: string; es: string; en: string | null }[];
  entrega: { dia: Dia; garantiaVence: Dia } | null;
  dias: { dia: Dia; partidas: { espacio: string; es: string; en: string | null; terminada: boolean }[] }[];
  fotos: { id: string; dia: Dia }[];
}

/**
 * Lo que ve el cliente con su enlace, y cuenta la visita. Null si el enlace no sirve (no existe, se anuló, o la
 * garantía ya venció), sin decir por qué. Se corre sin identidad (`sinUsuario`): el token es la prueba.
 */
export async function portalCliente(
  tx: Tx,
  entrada: { token: string },
  ahora = new Date(),
): Promise<PortalCliente | null> {
  const { token } = validarEntrada(z.object({ token: Token }), entrada);
  const [r] = await tx<{ d: Datos | null }[]>`select public.portal_cliente(${token}, ${ahora}) as d`;
  const d = r?.d;
  if (!d) return null;
  const c = await cambiosDelEnlace(tx, token);
  const [pg] = await tx<
    { p: { folio: string; fecha: Dia; concepto: string; monto: number | string }[] | null }[]
  >`
    select public.cobros_portal_cliente(${token}) as p`;

  const id = d.obra.id;
  const a = avanceDeLaObra(
    {
      s: {
        hoy: hoyEn(ahora, d.zona),
        calendario: calendario((d.diasLaborables ?? [1, 2, 3, 4, 5, 6]) as DiaSemana[], d.feriados),
      },
      obras: [{ id, inicio: d.obra.inicio, fin: d.obra.fin }],
      espacios: d.espacios.map((e) => ({ ...e, obra_id: id })),
      partidas: d.partidas.map((p) => ({
        id: p.id,
        obra_id: id,
        espacio_id: p.espacio,
        nombre_es: p.es,
        nombre_en: p.en,
        peso: p.peso,
        dias: p.dias,
        responsable: p.responsable,
        oficio_id: p.oficio,
        paralelo: p.paralelo,
        espera: p.espera,
        etapa_id: p.etapa,
      })),
      avance: d.avance.map((x) => ({ ...x, obra_id: id })),
      cambios: [{ obra_id: id, dias: d.diasCambios }],
      etapas: new Map(d.etapas.map((e) => [e.id, { es: e.es, en: e.en }])),
    },
    id,
  );

  return {
    empresa: d.empresa,
    obra: {
      folio: d.obra.folio,
      cliente: d.obra.cliente,
      direccion: d.obra.direccion,
      estado: d.obra.estado,
      inicio: d.obra.inicio,
      entregaComprometida: a.entregaComprometida,
      entregada: d.obra.estado === 'entregada' && d.entrega ? d.entrega : null,
    },
    avance: { pct: a.av.pct, terminadas: a.terminadas, total: a.total },
    espacios: a.espacios
      .filter((e) => !e.generales || e.estado !== 'sin_iniciar')
      .map((e) => ({ nombre: e.nombre, pct: e.pct, estado: e.estado, etapa: e.etapa, enCurso: e.enCurso })),
    dias: d.dias.map((x) => ({
      dia: x.dia,
      partidas: x.partidas.map((p) => ({
        espacio: p.espacio,
        partida: { es: p.es, en: p.en },
        terminada: p.terminada,
      })),
    })),
    fotos: d.fotos.map((f) => ({ id: f.id, dia: f.dia })),
    cambios: {
      contrato: c?.contrato === null || c?.contrato === undefined ? null : Number(c.contrato),
      ordenes: (c?.ordenes ?? []).map((o) => ({ ...o, precio: Number(o.precio), huella: huellaDeCambio(o) })),
    },
    pagos: (pg?.p ?? []).map((x) => ({ ...x, monto: Number(x.monto) })),
  };
}

const EntradaRespuesta = z.object({
  token: Token,
  ordenId: uuid,
  decision: z.enum(['aprobada', 'rechazada']),
  nombre: z.string().max(120),
  /** La firma dibujada, como PNG en data URL; solo para aprobar. */
  firma: z.string().max(300_000).nullish(),
  comentario: z.string().max(1000).nullish(),
  ip: z.string().max(100).nullish(),
  navegador: z.string().max(400).nullish(),
  /** Lo que el cliente vio de la orden (`CambioDelPortal.huella`). */
  huella: z.string().max(5000).nullish(),
});

/**
 * El cliente responde, con su enlace, una orden de cambio por aprobar: aprobada (con su nombre y su firma) queda
 * autorizada; no aprobada, rechazada. Se corre sin identidad: el token es la prueba. Si la orden ya no es la que vio
 * (el dueño la editó, D-103), no se guarda nada: se revisa después de responder, con la orden ya bloqueada, y el
 * error deshace la transacción. Errores: `enlace_invalido`, `orden_no_encontrada`, `orden_ya_respondida`,
 * `falta_nombre`, `falta_firma`, `orden_cambiada`.
 */
export async function responderCambioCliente(
  tx: Tx,
  entrada: z.input<typeof EntradaRespuesta>,
): Promise<void> {
  const e = validarEntrada(EntradaRespuesta, entrada);
  await deLaBase(
    () => tx`
      select public.responder_cambio_cliente(${e.token}, ${e.ordenId}, ${e.decision}, ${e.nombre},
                                             ${e.firma ?? null}, ${e.comentario ?? null}, ${e.ip ?? null},
                                             ${e.navegador ?? null})`,
  );
  if (e.huella) {
    const o = (await cambiosDelEnlace(tx, e.token))?.ordenes.find((x) => x.id === e.ordenId);
    if (!o || huellaDeCambio(o) !== e.huella) throw new ErrorDeNegocio('orden_cambiada');
  }
}

/** Un enlace firmado de pocos minutos a una foto del portal. Error: `foto_no_encontrada` (o no se ve ahí). */
export async function enlaceDeFotoDelPortal(
  tx: Tx,
  entrada: { token: string; fotoId: string },
  firmar: FirmarEnlace,
): Promise<{ url: string; segundos: number }> {
  const { token, fotoId } = validarEntrada(z.object({ token: Token, fotoId: uuid }), entrada);
  const [f] = await tx<
    { ruta: string | null }[]
  >`select public.foto_portal_cliente(${token}, ${fotoId}) as ruta`;
  if (!f?.ruta) throw new ErrorDeNegocio('foto_no_encontrada');
  return { url: await firmar(f.ruta, SEGUNDOS_ENLACE), segundos: SEGUNDOS_ENLACE };
}

// ------------------------------------------------------------------ el enlace, para el dueño
export interface EnlaceCliente {
  readonly creado: Date;
  readonly accesos: number;
  readonly ultimoAcceso: Date | null;
}

/** El enlace vigente de una obra, sin su token (la base no lo guarda); null si no tiene. Solo el dueño. */
export async function enlaceClienteDeObra(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<EnlaceCliente | null> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  exigirDueno(await leerSesion(tx, ahora));
  const [e] = await tx<EnlaceCliente[]>`
    select creado_en as creado, accesos, ultimo_acceso as "ultimoAcceso" from enlaces_cliente
    where obra_id = ${obraId} and anulado_en is null`;
  return e ?? null;
}

/**
 * Crea el enlace del cliente de una obra y anula el que hubiera. Devuelve el token: solo existe aquí, la base guarda
 * su hash, así que se muestra una vez. Solo el dueño. Error: `obra_no_encontrada`.
 */
export async function crearEnlaceCliente(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<{ token: string }> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  exigirDueno(await leerSesion(tx, ahora));
  const token = nuevoSecreto();
  await deLaBase(() => tx`select public.crear_enlace_cliente(${obraId}, ${token})`);
  return { token };
}

/** Desactiva el enlace del cliente de una obra: deja de servir. Solo el dueño. */
export async function anularEnlaceCliente(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<void> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  exigirDueno(await leerSesion(tx, ahora));
  await tx`update enlaces_cliente set anulado_en = now() where obra_id = ${obraId} and anulado_en is null`;
}

// ------------------------------------------------------------------ las fotos que ve el cliente
/** Las fotos que pueden ir al portal: las del trabajo (como foto_para_cliente_permitida en la base). */
export const TIPOS_FOTO_CLIENTE: readonly string[] = [
  'bitacora',
  'inspeccion',
  'prueba_agua',
  'punch',
  'cambio_hecho',
];

/**
 * Marca (o desmarca) una foto para el portal del cliente. El PM de la obra o el dueño, y solo fotos del trabajo
 * (cierres, inspecciones, pruebas de agua, lista de entrega). Errores: `foto_no_encontrada`, `foto_no_permitida`.
 */
export async function marcarFotoCliente(
  tx: Tx,
  entrada: { fotoId: string; visible: boolean },
): Promise<void> {
  const { fotoId, visible } = validarEntrada(z.object({ fotoId: uuid, visible: z.boolean() }), entrada);
  await deLaBase(() => tx`select public.marcar_foto_cliente(${fotoId}, ${visible})`);
}

const DE_LA_BASE = new Set([
  'foto_no_encontrada',
  'foto_no_permitida',
  'obra_no_encontrada',
  'enlace_invalido',
  'orden_no_encontrada',
  'orden_ya_respondida',
  'falta_nombre',
  'falta_firma',
]);

async function deLaBase<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof postgres.PostgresError && e.code === 'P0001' && DE_LA_BASE.has(e.message))
      throw new ErrorDeNegocio(e.message);
    throw e;
  }
}
