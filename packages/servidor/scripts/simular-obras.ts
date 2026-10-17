// Simula un mes de trabajo de una empresa (D-088): 10 obras de inicio a fin con las funciones de la app, como las
// usarían el dueño y sus PMs, día por día: el alta con su presupuesto (costo y margen), los cierres del día con su
// cuadrilla y sus partidas siguiendo el cronograma, las inspecciones y la prueba de inundación, las órdenes de trabajo
// de los subs y sus pagos, los gastos del PM y las compras de la oficina, los avisos, las órdenes de cambio (por el
// portal con firma, en papel, rechazadas y sin respuesta), los cobros, un cambio de PM a media obra, el punch, la
// medida verificada y el cierre de las obras terminadas. Lo que la app rechaza queda en la lista de hallazgos: sirve
// para encontrar flujos que no cierran, pasos de más y datos que sobran.
//
//   pnpm exec tsx --env-file=<.env> packages/servidor/scripts/simular-obras.ts --dueno <correo del dueño> \
//     --desde 2026-09-14 --hasta 2026-10-15 [--confirmar]
//
// Sin --confirmar solo dice qué haría. El .env necesita DATABASE_URL (directo), NEXT_PUBLIC_SUPABASE_URL y
// SUPABASE_SECRET_KEY (para dar de alta a los PMs y subir las fotos). Los datos quedan en la empresa: la app no borra.
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  type Calendario,
  calendario,
  cronogramaObra,
  type Dia,
  type DiaSemana,
  diaSemana,
  ErrorDeNegocio,
  esLaborable,
  type PartidaCrono,
  precioConMargen,
  proponerEntrega,
  type Responsable,
  sumarDias,
  sumarLaborables,
} from '@ijm/core';
import postgres from 'postgres';
import * as S from '../src/index';

// ------------------------------------------------------------------ argumentos y conexiones
const { values: a } = parseArgs({
  options: {
    dueno: { type: 'string' },
    desde: { type: 'string', default: '2026-09-14' },
    hasta: { type: 'string', default: '2026-10-15' },
    confirmar: { type: 'boolean' },
  },
});
const BASE = process.env.DATABASE_URL;
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const LLAVE = process.env.SUPABASE_SECRET_KEY;
if (!a.dueno || !BASE || !SUPA || !LLAVE) {
  console.error('Faltan --dueno o DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en el .env');
  process.exit(1);
}
const local = /@(127\.0\.0\.1|localhost)[:/]/.test(BASE);
const sql = postgres(BASE, { max: 2, prepare: false, onnotice: () => {}, ssl: local ? false : 'require' });
// la conexión con que actúa la app (como conectarServidor), con SSL en la nube
const servidor: S.Servidor = {
  sql: postgres(BASE, {
    max: 2,
    onnotice: () => {},
    prepare: false,
    ssl: local ? false : 'require',
    types: { dia: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
  }),
};
const auth = S.authAdmin(SUPA, LLAVE);
const storage = createClient(SUPA, LLAVE, {
  auth: { persistSession: false, autoRefreshToken: false },
}).storage;
const sharp = createRequire(new URL('../../../apps/web/package.json', import.meta.url))('sharp') as (
  b: Buffer,
) => { jpeg: (o: object) => { toBuffer: () => Promise<Buffer> } };

// ------------------------------------------------------------------ azar con semilla (siempre igual)
let semilla = 20261016;
const azar = () => {
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const entre = (min: number, max: number) => min + azar() * (max - min);
const redondo = (n: number, a = 10) => Math.round(n / a) * a;
const centavos = (n: number) => Math.round(n * 100) / 100;

// ------------------------------------------------------------------ hallazgos
interface Hallazgo {
  dia: Dia;
  obra: string;
  paso: string;
  codigo: string;
  detalle?: string;
}
const hallazgos: Hallazgo[] = [];
const notas: string[] = [];
const anotar = (h: Hallazgo) => {
  hallazgos.push(h);
  console.log(`  ⚠ ${h.dia} ${h.obra} · ${h.paso}: ${h.codigo}${h.detalle ? ` (${h.detalle})` : ''}`);
};

/** Una hora del día en Austin (CDT, UTC−5, en septiembre y octubre). */
const A = (dia: Dia, hora = '10:00') => new Date(`${dia}T${hora}:00-05:00`);

/** Corre `fn` a nombre de `userId`; un rechazo de la app se anota y devuelve null. */
async function como<T>(
  userId: string,
  dia: Dia,
  obra: string,
  paso: string,
  fn: (tx: S.Tx) => Promise<T>,
): Promise<T | null> {
  try {
    return await S.enNombreDe(servidor, { userId }, fn);
  } catch (e) {
    if (e instanceof ErrorDeNegocio) {
      anotar({ dia, obra, paso, codigo: e.codigo, detalle: e.datos ? JSON.stringify(e.datos) : undefined });
      return null;
    }
    anotar({ dia, obra, paso, codigo: 'ERROR', detalle: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/** Una foto: un JPEG con un texto, subida a Storage a nombre de `userId` (como si la hubiera subido su teléfono). */
async function subirFoto(userId: string, ruta: string, texto: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <rect width="800" height="600" fill="${color}"/>
    <text x="40" y="300" font-family="Arial" font-size="38" fill="white">${texto.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
    <text x="40" y="560" font-family="Arial" font-size="22" fill="white" opacity="0.7">Simulación J Solutions</text>
  </svg>`;
  const jpg = await sharp(Buffer.from(svg)).jpeg({ quality: 70 }).toBuffer();
  const r = await storage.from('fotos').upload(ruta, jpg, { contentType: 'image/jpeg', upsert: false });
  if (r.error) throw new Error(`Storage: ${r.error.message}`);
  // la app solo registra una foto que subió el mismo usuario (foto_subida)
  await sql`update storage.objects set owner_id = ${userId}, owner = ${userId}::uuid
            where bucket_id = 'fotos' and name = ${ruta}`;
}

async function foto(
  userId: string,
  dia: Dia,
  obra: string,
  ref: {
    refTipo: 'bitacora' | 'gasto' | 'aviso' | 'inspeccion' | 'prueba_agua' | 'cambio_hecho';
    refId: string;
  },
  indice: number,
  texto: string,
  color = '#5b6b7a',
) {
  const r = await como(userId, dia, obra, `foto ${ref.refTipo}`, (tx) =>
    S.rutaParaFoto(tx, ref, A(dia, '18:00')),
  );
  if (!r) return null;
  await subirFoto(userId, r.ruta, texto, color);
  return como(userId, dia, obra, `registrar foto ${ref.refTipo}`, (tx) =>
    S.registrarFoto(tx, { ...ref, indice, ruta: r.ruta }, A(dia, '18:05')),
  );
}

// ------------------------------------------------------------------ la empresa
const [dueno] = await sql<{ user_id: string; miembro: string; empresa: string; nombre: string }[]>`
  select m.user_id, m.id as miembro, m.empresa_id as empresa, e.nombre
  from miembros m join auth.users u on u.id = m.user_id join empresas e on e.id = m.empresa_id
  where lower(u.email) = ${a.dueno.trim().toLowerCase()} and m.rol in ('dueno', 'admin') and m.activo`;
if (!dueno) {
  console.error(`${a.dueno} no es dueño ni administrador activo de ninguna empresa.`);
  process.exit(1);
}
const E = dueno.empresa;
const DU = dueno.user_id;
console.log(`Empresa: ${dueno.nombre}. Del ${a.desde} al ${a.hasta}.`);
if (!a.confirmar) {
  console.log('Sin --confirmar no se escribe nada. Correr con --confirmar para simular.');
  await sql.end();
  await servidor.sql.end();
  process.exit(0);
}

const [cfg] = await sql<{ dias: number[]; limite: string }[]>`
  select dias_laborables as dias, limite_compra_pm as limite from configuracion where empresa_id = ${E}`;
const feriados = (
  await sql<{ dia: Dia }[]>`
    select to_char(dia, 'YYYY-MM-DD') as dia from feriados where empresa_id = ${E} and not se_trabaja`
).map((f) => f.dia);
const cal: Calendario = calendario(cfg!.dias as DiaSemana[], feriados);
const LIMITE_PM = Number(cfg!.limite);

const tipos = new Map(
  (
    await sql<{ id: string; nombre: string; generales: boolean }[]>`
      select id, nombre_es as nombre, es_generales as generales from tipos_espacio
      where empresa_id = ${E} and activo`
  ).map((t) => [t.nombre, t]),
);
for (const t of ['Baño', 'Cocina', 'Closet'])
  if (!tipos.has(t)) throw new Error(`La empresa no tiene el tipo de obra "${t}" en su catálogo`);
const subPorOficio = new Map(
  (
    await sql<{ id: string; oficio: string }[]>`
      select id, oficio_id as oficio from subcontratistas where empresa_id = ${E} and activo`
  ).map((s) => [s.oficio, s.id]),
);
const puntosDe = new Map<string, string[]>();
for (const p of await sql<{ hito: string; id: string }[]>`
  select pc.hito_id as hito, pc.id from puntos_control pc join hitos_calidad h on h.id = pc.hito_id
  where h.empresa_id = ${E} and pc.activo`)
  puntosDe.set(p.hito, [...(puntosDe.get(p.hito) ?? []), p.id]);
const aguaEn = new Set(
  (
    await sql<{ id: string }[]>`select id from hitos_calidad where empresa_id = ${E} and exige_prueba_agua`
  ).map((h) => h.id),
);

// ------------------------------------------------------------------ los PMs y la cuadrilla
const PMS = [
  { nombre: 'Ricardo Salinas', celular: '5125550141' },
  { nombre: 'Marco Treviño', celular: '5125550142' },
  { nombre: 'Daniel Ortiz', celular: '5125550143' },
];
const pms: { nombre: string; userId: string; miembro: string }[] = [];
for (const p of PMS) {
  const [ya] = await sql<{ user_id: string; id: string }[]>`
    select user_id, id from miembros where empresa_id = ${E} and telefono = ${'+1' + p.celular}`;
  if (ya) {
    pms.push({ nombre: p.nombre, userId: ya.user_id, miembro: ya.id });
    continue;
  }
  const inv = await como(DU, a.desde, '—', 'invitar PM', (tx) =>
    S.invitarPm(
      tx,
      { nombre: p.nombre, celular: p.celular },
      auth.usuarioDeCorreo,
      A(sumarDias(a.desde, -10)),
    ),
  );
  if (!inv) throw new Error(`No se pudo invitar a ${p.nombre}`);
  const [m] = await sql<{ user_id: string }[]>`select user_id from miembros where id = ${inv.miembroId}`;
  pms.push({ nombre: p.nombre, userId: m!.user_id, miembro: inv.miembroId });
}

const CUADRILLA_EXTRA = [
  { nombre: 'Juan Pérez', tarifa: 24 },
  { nombre: 'Luis Gómez', tarifa: 23 },
  { nombre: 'Raúl Torres', tarifa: 26 },
  { nombre: 'Óscar Medina', tarifa: 22 },
];
for (const t of CUADRILLA_EXTRA) {
  const [ya] = await sql`select 1 from trabajadores where empresa_id = ${E} and nombre = ${t.nombre}`;
  if (ya) continue;
  await como(DU, a.desde, '—', 'alta de cuadrilla', (tx) =>
    S.altaTrabajador(
      tx,
      {
        nombre: t.nombre,
        puesto: 'Ayudante general',
        tipoPago: 'hora',
        tarifa: t.tarifa,
        vigenteDesde: sumarDias(a.desde, -30),
      },
      A(sumarDias(a.desde, -10)),
    ),
  );
}
const trabajadores = await sql<{ id: string; nombre: string }[]>`
  select id, nombre from trabajadores where empresa_id = ${E} and activo and tipo_pago = 'hora' order by nombre`;

// ------------------------------------------------------------------ las 10 obras
type Tipo = 'Baño' | 'Cocina' | 'Closet';
interface Plan {
  folio?: string;
  cliente: string;
  telefono: string;
  direccion: string;
  pm: number;
  inicio: Dia;
  espacios: { tipo: Tipo; nombre: string; pies2: number; lineales: number }[];
  margen: number;
  /** Cuánto se pasa (+) o se ahorra (−) del costo presupuestado, en promedio. */
  desvio: number;
  /** Probabilidad de que una partida se atrase un día. */
  atraso: number;
  /** Cambio de PM a media obra: el día y a quién. */
  cambioPm?: { dia: Dia; pm: number };
  /** Solo se da de alta (y su presupuesto), sin arrancar. */
  sinArrancar?: boolean;
}
const D = (n: number) => sumarDias(a.desde, n);
const PLANES: Plan[] = [
  { cliente: 'Familia Johnson', telefono: '512-555-0201', direccion: '4512 Shoal Creek Blvd, Austin, TX', pm: 0, inicio: D(0),
    espacios: [{ tipo: 'Baño', nombre: 'Baño principal', pies2: 65, lineales: 6 }], margen: 0.35, desvio: 0.04, atraso: 0.06 },
  { cliente: 'Familia García', telefono: '512-555-0202', direccion: '2207 Lake Austin Blvd, Austin, TX', pm: 1, inicio: D(1),
    espacios: [{ tipo: 'Cocina', nombre: 'Cocina', pies2: 180, lineales: 24 }], margen: 0.35, desvio: -0.03, atraso: 0.05 },
  { cliente: 'Smith Residence', telefono: '512-555-0203', direccion: '9804 Great Hills Trl, Austin, TX', pm: 2, inicio: D(2),
    espacios: [
      { tipo: 'Baño', nombre: 'Baño de visitas', pies2: 45, lineales: 4 },
      { tipo: 'Closet', nombre: 'Walk-in closet', pies2: 32, lineales: 0 },
    ], margen: 0.35, desvio: 0.02, atraso: 0.04 },
  { cliente: 'Familia Martínez', telefono: '512-555-0204', direccion: '1300 E Oltorf St, Austin, TX', pm: 0, inicio: D(3),
    espacios: [{ tipo: 'Cocina', nombre: 'Cocina', pies2: 210, lineales: 28 }], margen: 0.35, desvio: 0.08, atraso: 0.07,
    cambioPm: { dia: D(15), pm: 2 } },
  { cliente: 'Brown Family', telefono: '512-555-0205', direccion: '6210 Bull Creek Rd, Austin, TX', pm: 1, inicio: D(6),
    espacios: [{ tipo: 'Baño', nombre: 'Baño principal', pies2: 80, lineales: 7 }], margen: 0.38, desvio: 0.15, atraso: 0.08 },
  { cliente: 'Lee Residence', telefono: '512-555-0206', direccion: '3405 Duval St, Austin, TX', pm: 2, inicio: D(13),
    espacios: [{ tipo: 'Closet', nombre: 'Closet principal', pies2: 40, lineales: 0 }], margen: 0.35, desvio: -0.05, atraso: 0.03 },
  { cliente: 'Familia Hernández', telefono: '512-555-0207', direccion: '7800 Manchaca Rd, Austin, TX', pm: 0, inicio: D(13),
    espacios: [
      { tipo: 'Baño', nombre: 'Baño principal', pies2: 55, lineales: 5 },
      { tipo: 'Baño', nombre: 'Baño de niños', pies2: 40, lineales: 4 },
    ], margen: 0.35, desvio: 0.03, atraso: 0.06 },
  { cliente: 'Wilson Home', telefono: '512-555-0208', direccion: '11400 Jollyville Rd, Austin, TX', pm: 1, inicio: D(20),
    espacios: [{ tipo: 'Cocina', nombre: 'Cocina', pies2: 160, lineales: 22 }], margen: 0.3, desvio: 0.0, atraso: 0.05 },
  { cliente: 'Davis Family', telefono: '512-555-0209', direccion: '2100 S Lamar Blvd, Austin, TX', pm: 2, inicio: D(28),
    espacios: [{ tipo: 'Baño', nombre: 'Baño principal', pies2: 60, lineales: 5 }], margen: 0.35, desvio: 0.0, atraso: 0.05 },
  { cliente: 'Familia Rodríguez', telefono: '512-555-0210', direccion: '5600 Burnet Rd, Austin, TX', pm: 0, inicio: D(35),
    espacios: [{ tipo: 'Cocina', nombre: 'Cocina', pies2: 190, lineales: 26 }], margen: 0.35, desvio: 0, atraso: 0, sinArrancar: true },
]; // prettier-ignore

/** Lo que cuesta de verdad cada pie² en Austin (gama media): el costo, no el precio. */
const COSTO_PIE2: Record<Tipo, number> = { Baño: 235, Cocina: 195, Closet: 95 };
const COSTO_GENERALES = 1350;

interface Partida {
  id: string;
  espacio: string;
  nombre: string;
  dias: number;
  paralelo: boolean;
  espera: number;
  responsable: Responsable;
  oficio: string | null;
  hito: string | null;
  etapa: string | null;
  peso: number;
  orden: number;
}
interface Obra {
  plan: Plan;
  id: string;
  folio: string;
  espacios: { id: string; nombre: string; generales: boolean; pies2: number }[];
  partidas: Partida[];
  costoPartida: Map<string, number>;
  enlace?: string;
  cerrada: boolean;
  /** Lo que se le cobró y lo que se le cobrará. */
  contrato: number;
}
const obras: Obra[] = [];

async function leerPartidas(obraId: string): Promise<Partida[]> {
  return (
    await sql<
      (Omit<Partida, 'peso'> & { peso: string })[]
    >`select id, espacio_id as espacio, nombre_es as nombre, dias, paralelo, espera, responsable, oficio_id as oficio,
             hito_id as hito, etapa_id as etapa, peso, orden
      from partidas_obra where obra_id = ${obraId} and estado = 'activa' order by orden, nombre_es`
  ).map((p) => ({ ...p, peso: Number(p.peso) }));
}

console.log('\n— Alta de las obras y su presupuesto');
for (const plan of PLANES) {
  const alta = sumarDias(plan.inicio, -6);
  const [ya] = await sql<{ id: string; folio: string }[]>`
    select id, folio from obras where empresa_id = ${E} and cliente = ${plan.cliente}`;
  let obraId: string;
  let folio: string;
  // el costo de cada espacio, y el contrato que se le propone al cliente (la suma de los precios, redondeada)
  const costoEspacio = (t: Tipo, p2: number) => redondo(COSTO_PIE2[t] * p2 * entre(0.95, 1.05), 50);
  const costos = plan.espacios.map((e) => costoEspacio(e.tipo, e.pies2));
  const precioAprox = [...costos, COSTO_GENERALES].reduce((s, c) => s + precioConMargen(c, plan.margen), 0);
  const contrato = Math.ceil(precioAprox / 100) * 100;
  if (ya) {
    obraId = ya.id;
    folio = ya.folio;
  } else {
    // la entrega que sale del catálogo, como la propone la pantalla del alta
    const plantilla = async (tipo: string): Promise<PartidaCrono[]> =>
      (
        await sql<
          {
            id: string;
            dias: number;
            paralelo: boolean;
            espera: number;
            responsable: Responsable;
            oficio: string | null;
          }[]
        >`
          select id, dias, paralelo, espera, responsable, oficio_id as oficio from plantillas_partida
          where tipo_espacio_id = ${tipo} and activa order by orden`
      ).map((p) => ({ ...p, oficioId: p.oficio }));
    const generales = [...tipos.values()].find((t) => t.generales)!;
    const entrega = proponerEntrega(
      plan.inicio,
      await Promise.all(plan.espacios.map((e) => plantilla(tipos.get(e.tipo)!.id))),
      await plantilla(generales.id),
      cal,
    );
    const finEstimada = sumarLaborables(entrega!.fecha, 3, cal);
    const r = await como(DU, alta, plan.cliente, 'alta de obra', (tx) =>
      S.crearObra(
        tx,
        {
          cliente: plan.cliente,
          telefono: plan.telefono,
          direccion: plan.direccion,
          pmId: pms[plan.pm]!.miembro,
          inicio: plan.inicio,
          finEstimada,
          contrato,
          notas: 'Obra simulada para probar la app (D-088).',
          espacios: plan.espacios.map((e) => ({
            tipoEspacioId: tipos.get(e.tipo)!.id,
            nombre: e.nombre,
            pies2: e.pies2,
            piesLineales: e.lineales,
          })),
          confirmado: ['obra_duplicada'],
        },
        A(alta),
      ),
    );
    if (!r || !r.ok) throw new Error(`No se dio de alta ${plan.cliente}`);
    obraId = r.obraId;
    folio = r.folio;
  }
  plan.folio = folio;
  const espacios = await sql<
    { id: string; nombre: string; generales: boolean; pies2: string; tipo: string }[]
  >`
    select e.id, e.nombre, t.es_generales as generales, coalesce(e.pies2_verificados, e.pies2_cotizados) as pies2,
           t.nombre_es as tipo
    from espacios e join tipos_espacio t on t.id = e.tipo_espacio_id where e.obra_id = ${obraId} order by e.orden`;
  const partidas = await leerPartidas(obraId);

  // el costo de cada etapa: el del espacio, repartido por el peso de sus partidas
  const costoPartida = new Map<string, number>();
  const lineas: { espacioId: string; etapaId: string | null; costo: number }[] = [];
  espacios.forEach((esp) => {
    const i = plan.espacios.findIndex((x) => x.nombre === esp.nombre);
    const total = esp.generales
      ? COSTO_GENERALES
      : (costos[i] ?? costoEspacio(esp.tipo as Tipo, Number(esp.pies2)));
    const suyas = partidas.filter((p) => p.espacio === esp.id);
    const peso = suyas.reduce((s, p) => s + p.peso, 0) || 1;
    const porEtapa = new Map<string | null, number>();
    for (const p of suyas) {
      const c = (total * p.peso) / peso;
      costoPartida.set(p.id, c);
      porEtapa.set(p.etapa, (porEtapa.get(p.etapa) ?? 0) + c);
    }
    for (const [etapaId, c] of porEtapa) lineas.push({ espacioId: esp.id, etapaId, costo: redondo(c) });
  });
  const ya2 = await sql`select 1 from presupuesto_etapas where obra_id = ${obraId} and costo > 0`;
  if (!ya2.length)
    await como(DU, alta, folio, 'presupuesto', (tx) =>
      S.guardarPresupuesto(tx, { obraId, margenObjetivo: plan.margen, lineas, contrato }, A(alta, '16:00')),
    );
  const [fin] = await sql<
    { contrato: string }[]
  >`select contrato_original as contrato from obras_finanzas where obra_id = ${obraId}`;
  obras.push({
    plan,
    id: obraId,
    folio,
    espacios: espacios.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      generales: e.generales,
      pies2: Number(e.pies2),
    })),
    partidas,
    costoPartida,
    cerrada: false,
    contrato: Number(fin?.contrato ?? contrato),
  });
  console.log(
    `  ${folio} ${plan.cliente}: contrato ${contrato}, ${partidas.length} partidas, PM ${pms[plan.pm]!.nombre}`,
  );

  // el depósito del 30% al firmar, y el enlace del portal para el cliente
  if (!(await sql`select 1 from cobros where obra_id = ${obraId}`).length)
    await como(DU, alta, folio, 'cobro del depósito', (tx) =>
      S.registrarCobro(
        tx,
        {
          obraId,
          fecha: alta,
          concepto: 'deposito',
          monto: redondo(contrato * 0.3, 1),
          metodo: azar() < 0.5 ? 'zelle' : 'cheque',
        },
        A(alta, '17:00'),
      ),
    );
  const enlace = await como(DU, alta, folio, 'enlace del cliente', (tx) =>
    S.crearEnlaceCliente(tx, { obraId }, A(alta, '17:10')),
  );
  if (enlace) obras[obras.length - 1]!.enlace = enlace.token;
}

// ------------------------------------------------------------------ el día a día
const PROVEEDORES: Record<string, string[]> = {
  material: ['Home Depot', "Lowe's", 'Floor & Decor', 'Ferguson', 'Sherwin-Williams', 'Austin Lumber'],
};
const firma =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

interface Estado {
  avance: { partidaId: string; estado: 'en_progreso' | 'terminada'; dia: Dia }[];
  inspecciones: { espacio: string; hito: string; resultado: string; en: string }[];
  pruebas: { id: string; espacio: string; resultado: string; inicio: Date }[];
  ots: {
    id: string;
    partida: string | null;
    confirmada: boolean;
    aprobada: boolean;
    estado: string;
    pagado: number;
    precio: number;
  }[];
  pm: { miembro: string; userId: string } | null;
  estado: string;
  gastos: Set<string>;
}
async function estado(o: Obra): Promise<Estado> {
  const [ob] = await sql<
    { pm: string; estado: string }[]
  >`select pm_id as pm, estado from obras where id = ${o.id}`;
  const pm = pms.find((p) => p.miembro === ob!.pm) ?? null;
  return {
    estado: ob!.estado,
    pm: pm ? { miembro: pm.miembro, userId: pm.userId } : null,
    avance: await sql`select partida_obra_id as "partidaId", estado, to_char(dia, 'YYYY-MM-DD') as dia
                      from avance where obra_id = ${o.id} and estado_registro = 'vigente'`,
    inspecciones: await sql`select espacio_id as espacio, hito_id as hito, resultado, realizada_en::text as en
                            from inspecciones where obra_id = ${o.id}`,
    pruebas:
      await sql`select id, espacio_id as espacio, resultado, inicio from pruebas_agua where obra_id = ${o.id}`,
    ots: (
      await sql<
        {
          id: string;
          partida: string | null;
          confirmada: boolean;
          aprobada: boolean;
          estado: string;
          pagado: string;
          precio: string;
        }[]
      >`
        select ot.id, ot.partida_obra_id as partida, ot.confirmada_en is not null as confirmada,
               ot.aprobada_en is not null as aprobada, ot.estado,
               (select coalesce(sum(p.monto), 0) from pagos_sub p where p.orden_trabajo_id = ot.id and p.estado = 'vigente') as pagado,
               coalesce(pr.precio, 0) as precio
        from ordenes_trabajo ot left join ordenes_trabajo_precios pr on pr.orden_trabajo_id = ot.id
        where ot.obra_id = ${o.id} and ot.estado <> 'cancelada'`
    ).map((x) => ({ ...x, pagado: Number(x.pagado), precio: Number(x.precio) })),
    gastos: new Set(
      (
        await sql<{ partida: string }[]>`select distinct partida_obra_id as partida from gastos
                                         where obra_id = ${o.id} and partida_obra_id is not null`
      ).map((g) => g.partida),
    ),
  };
}

function cronograma(o: Obra, st: Estado, hoy: Dia) {
  return cronogramaObra(
    o.plan.inicio,
    o.espacios.map((e) => ({
      id: e.id,
      generales: e.generales,
      partidas: o.partidas
        .filter((p) => p.espacio === e.id)
        .map((p) => ({
          id: p.id,
          dias: p.dias,
          paralelo: p.paralelo,
          espera: p.espera,
          responsable: p.responsable,
          oficioId: p.oficio,
        })),
    })),
    st.avance,
    hoy,
    cal,
  );
}

/** Si una partida ya se terminó. */
const terminada = (st: Estado, id: string) =>
  st.avance.some((x) => x.partidaId === id && x.estado === 'terminada');

/** Pide la confirmación que la app pida (papeles del sub, avisos del pago) y lo vuelve a intentar. */
async function conConfirmaciones<T extends { ok: boolean }>(fn: (confirmado: string[]) => Promise<T | null>) {
  const confirmado: string[] = [];
  for (let i = 0; i < 6; i++) {
    const r = await fn(confirmado);
    if (!r || r.ok) return r;
    const c = r as unknown as { confirmar: unknown; avisos?: { codigo: string }[] };
    const codigos = c.avisos
      ? c.avisos.map((x) => x.codigo)
      : [typeof c.confirmar === 'string' ? c.confirmar : (c.confirmar as { codigo: string }).codigo];
    notas.push(`confirmación pedida: ${codigos.join(', ')}`);
    confirmado.push(...codigos);
  }
  return null;
}

let diasSimulados = 0;
const libres = new Map<Dia, Set<string>>();
for (let d = a.desde as Dia; d <= a.hasta!; d = sumarDias(d, 1)) {
  if (!esLaborable(d, cal)) continue;
  diasSimulados++;
  console.log(`\n— ${d}`);
  libres.set(d, new Set(trabajadores.map((t) => t.id)));
  if (diaSemana(d) === 1)
    await como(DU, d, '—', 'congelar el plan de la semana', (tx) => S.congelarPlanSemanal(tx, A(d, '07:30')));

  for (const o of obras) {
    if (o.cerrada || o.plan.sinArrancar || o.plan.inicio > d) continue;
    // el cambio de PM a media obra (D-064)
    if (o.plan.cambioPm && o.plan.cambioPm.dia === d) {
      const nuevo = pms[o.plan.cambioPm.pm]!;
      const antes = (await estado(o)).pm;
      const r = await como(DU, d, o.folio, 'cambiar de PM', (tx) =>
        S.editarDatosObra(
          tx,
          {
            obraId: o.id,
            cliente: o.plan.cliente,
            telefono: o.plan.telefono,
            direccion: o.plan.direccion,
            pmId: nuevo.miembro,
            notas: 'Obra simulada para probar la app (D-088). Cambió de PM a media obra.',
          },
          A(d, '08:00'),
        ),
      );
      if (r !== null) {
        notas.push(`${o.folio}: cambio de PM a ${nuevo.nombre} el ${d}`);
        // ¿el PM anterior todavía ve la obra o puede cerrarle el día? Lo esperado: ya no.
        if (antes) {
          try {
            const inicio = await S.enNombreDe(servidor, { userId: antes.userId }, (tx) =>
              S.inicioDelPm(tx, A(d, '08:30')),
            );
            const laVe = inicio.obras.some((x) => x.id === o.id);
            notas.push(
              `${o.folio}: tras el cambio, el PM anterior ${laVe ? 'TODAVÍA ve' : 'ya no ve'} la obra en su inicio`,
            );
            await S.enNombreDe(servidor, { userId: antes.userId }, (tx) =>
              S.cerrarDia(
                tx,
                { obraId: o.id, sinTrabajo: true, motivo: 'otro', incidencia: 'Prueba' },
                A(d, '08:31'),
              ),
            );
            anotar({
              dia: d,
              obra: o.folio,
              paso: 'cambio de PM',
              codigo: 'PM_ANTERIOR_CERRO',
              detalle: 'el PM anterior pudo cerrar el día',
            });
          } catch (e) {
            notas.push(
              `${o.folio}: el PM anterior ya no puede cerrarle el día (${e instanceof ErrorDeNegocio ? e.codigo : 'error'})`,
            );
          }
        }
      }
    }

    const st = await estado(o);
    if (!st.pm) continue;
    const PM = st.pm.userId;
    const cr = cronograma(o, st, d);
    const fila = new Map(cr.filas.map((f) => [f.partidaId, f]));
    const pendientes = o.partidas.filter((p) => !terminada(st, p.id));
    if (!pendientes.length) {
      await terminarObra(o, st, d);
      continue;
    }

    // las órdenes de trabajo de lo que viene en los próximos días: el dueño las emite, el PM las confirma
    for (const p of pendientes.filter((p) => p.responsable === 'subcontratista')) {
      const f = fila.get(p.id)!;
      const ot = st.ots.find((x) => x.partida === p.id);
      if (!ot && f.ini <= sumarLaborables(d, 3, cal)) {
        const sub = p.oficio ? subPorOficio.get(p.oficio) : undefined;
        if (!sub) {
          anotar({
            dia: d,
            obra: o.folio,
            paso: 'orden de trabajo',
            codigo: 'SIN_SUB_DEL_OFICIO',
            detalle: p.nombre,
          });
          continue;
        }
        // el sub pone la mano de obra y casi todo el material: el 80% de lo que cuesta su partida
        const precio = redondo(
          (o.costoPartida.get(p.id) ?? 500) * 0.8 * entre(0.92, 1.1) * (1 + o.plan.desvio),
        );
        const r = await conConfirmaciones((confirmado) =>
          como(DU, d, o.folio, `emitir OT ${p.nombre}`, (tx) =>
            S.emitirOrdenTrabajo(
              tx,
              {
                obraId: o.id,
                subId: sub,
                partidaId: p.id,
                alcance: `${p.nombre} — ${o.espacios.find((e) => e.id === p.espacio)!.nombre}`,
                inicio: f.ini > d ? f.ini : d,
                fin: f.fin > d ? f.fin : d,
                precio,
                confirmado,
              },
              A(d, '08:15'),
            ),
          ),
        );
        if (r?.ok)
          st.ots.push({
            id: r.ordenId,
            partida: p.id,
            confirmada: false,
            aprobada: false,
            estado: 'emitida',
            pagado: 0,
            precio,
          });
      } else if (ot && !ot.confirmada) {
        const ok = await como(PM, d, o.folio, `PM confirma OT ${p.nombre}`, (tx) =>
          S.confirmarOrden(tx, { ordenId: ot.id }, A(d, '08:20')),
        );
        if (ok !== null) {
          ot.confirmada = true;
          // el anticipo del 30% al confirmar
          await conConfirmaciones((confirmado) =>
            como(DU, d, o.folio, `anticipo al sub ${p.nombre}`, (tx) =>
              S.registrarPagoSub(
                tx,
                {
                  ordenId: ot.id,
                  fecha: d,
                  concepto: 'anticipo',
                  monto: redondo(ot.precio * 0.3),
                  metodo: 'zelle',
                  confirmado,
                },
                A(d, '12:00'),
              ),
            ),
          );
        }
      }
    }
    // las órdenes de lo ya terminado: el PM las aprueba y el dueño liquida
    for (const ot of st.ots.filter((x) => x.partida && terminada(st, x.partida) && x.estado !== 'pagada')) {
      if (!ot.aprobada) {
        const ok = await como(PM, d, o.folio, 'PM aprueba OT', (tx) =>
          S.aprobarOrden(tx, { ordenId: ot.id }, A(d, '08:25')),
        );
        if (ok !== null) ot.aprobada = true;
      }
      if (ot.aprobada && ot.precio - ot.pagado > 0)
        await conConfirmaciones((confirmado) =>
          como(DU, d, o.folio, 'liquidación al sub', (tx) =>
            S.registrarPagoSub(
              tx,
              {
                ordenId: ot.id,
                fecha: d,
                concepto: 'liquidacion',
                monto: ot.precio - ot.pagado,
                metodo: 'transferencia',
                confirmado,
              },
              A(d, '15:00'),
            ),
          ),
        );
    }

    // lo que se trabaja hoy: lo que el cronograma ya arrancó y no se ha terminado
    const hoy = pendientes.filter((p) => fila.get(p.id)!.ini <= d);
    if (!hoy.length) {
      await como(PM, d, o.folio, 'cierre sin trabajo', (tx) =>
        S.cerrarDia(
          tx,
          {
            obraId: o.id,
            sinTrabajo: true,
            motivo: 'esperando_fabricacion',
            capturado: A(d, '17:30').toISOString(),
          },
          A(d, '17:30'),
        ),
      );
      continue;
    }
    // un día de lluvia o de material que no llegó, de vez en cuando
    if (azar() < 0.03) {
      await como(PM, d, o.folio, 'cierre sin trabajo', (tx) =>
        S.cerrarDia(
          tx,
          {
            obraId: o.id,
            sinTrabajo: true,
            motivo: azar() < 0.5 ? 'esperando_material' : 'clima',
            incidencia: 'Simulación: día sin trabajo.',
            capturado: A(d, '17:30').toISOString(),
          },
          A(d, '17:30'),
        ),
      );
      continue;
    }

    // lo que se termina hoy: lo que el cronograma da por terminado, salvo un atraso; con su inspección si la lleva
    const terminan: string[] = [];
    for (const p of hoy) {
      if (fila.get(p.id)!.fin > d || azar() < o.plan.atraso) continue;
      if (p.hito) {
        const ultima = st.inspecciones
          .filter((i) => i.espacio === p.espacio && i.hito === p.hito)
          .sort((x, y) => (x.en < y.en ? 1 : -1))[0];
        if (
          aguaEn.has(p.hito) &&
          !st.pruebas.some((x) => x.espacio === p.espacio && x.resultado === 'sin_fugas')
        ) {
          const enCurso = st.pruebas.find((x) => x.espacio === p.espacio && x.resultado === 'en_curso');
          if (!enCurso) {
            const r = await como(PM, d, o.folio, 'iniciar prueba de inundación', (tx) =>
              S.iniciarPruebaAgua(tx, { obraId: o.id, espacioId: p.espacio, fotos: 1 }, A(d, '08:00')),
            );
            if (r)
              await foto(
                PM,
                d,
                o.folio,
                { refTipo: 'prueba_agua', refId: r.pruebaId },
                1,
                `${o.folio} · nivel de agua inicial`,
                '#2a6f97',
              );
            continue;
          }
          const r = await como(PM, d, o.folio, 'terminar prueba de inundación', (tx) =>
            S.terminarPruebaAgua(tx, { pruebaId: enCurso.id, hayFuga: false, fotos: 1 }, A(d, '09:00')),
          );
          if (!r) continue;
          await foto(
            PM,
            d,
            o.folio,
            { refTipo: 'prueba_agua', refId: enCurso.id },
            2,
            `${o.folio} · nivel sin cambio a las 24 h`,
            '#2a6f97',
          );
        }
        if (!ultima || ultima.resultado !== 'aprobado' || ultima.en < fila.get(p.id)!.ini) {
          const puntos = puntosDe.get(p.hito) ?? [];
          const defecto = azar() < 0.1 && puntos.length > 1;
          const r = await como(PM, d, o.folio, `inspección ${p.nombre}`, (tx) =>
            S.registrarInspeccion(
              tx,
              {
                obraId: o.id,
                espacioId: p.espacio,
                hitoId: p.hito!,
                cumple: defecto ? puntos.slice(1) : puntos,
                noAplica: [],
                fotos: 2,
              },
              A(d, '11:00'),
            ),
          );
          if (r) {
            await foto(
              PM,
              d,
              o.folio,
              { refTipo: 'inspeccion', refId: r.inspeccionId },
              1,
              `${o.folio} · ${p.nombre}`,
              '#386641',
            );
            await foto(
              PM,
              d,
              o.folio,
              { refTipo: 'inspeccion', refId: r.inspeccionId },
              2,
              `${o.folio} · ${p.nombre} (detalle)`,
              '#386641',
            );
            st.inspecciones.push({
              espacio: p.espacio,
              hito: p.hito,
              resultado: r.resultado,
              en: A(d, '11:00').toISOString(),
            });
            if (r.resultado !== 'aprobado') {
              notas.push(
                `${o.folio}: inspección con defectos en ${p.nombre} el ${d}; se repite al día siguiente`,
              );
              continue;
            }
          } else continue;
        }
      }
      terminan.push(p.id);
    }

    // la cuadrilla del día: un trabajador por obra con trabajo de cuadrilla (dos en cocinas)
    const deCuadrilla = hoy.filter((p) => p.responsable === 'cuadrilla');
    const cuadrilla: { trabajadorId: string; cantidad: number; partidaId: string }[] = [];
    if (deCuadrilla.length) {
      const cuantos = o.plan.espacios.some((e) => e.tipo === 'Cocina') ? 2 : 1;
      for (const id of [...libres.get(d)!].slice(0, cuantos)) {
        libres.get(d)!.delete(id);
        cuadrilla.push({
          trabajadorId: id,
          cantidad: [8, 8, 8, 9, 7.5, 10][Math.floor(azar() * 6)]!,
          partidaId: deCuadrilla[0]!.id,
        });
      }
      if (!cuadrilla.length) notas.push(`${d} ${o.folio}: no alcanzó la cuadrilla (todos ocupados)`);
    }
    // los subs que debían llegar hoy
    const subs = st.ots
      .filter((x) => x.confirmada && x.partida && hoy.some((p) => p.id === x.partida))
      .map((x) => ({ ordenTrabajoId: x.id, llego: azar() > 0.04 }));
    if (subs.some((x) => !x.llego)) notas.push(`${d} ${o.folio}: un sub no llegó`);

    const conFoto = azar() < 0.5;
    const cierre = await como(PM, d, o.folio, 'cierre del día', (tx) =>
      S.cerrarDia(
        tx,
        {
          obraId: o.id,
          partidas: hoy.map((p) => p.id),
          terminadas: terminan,
          cuadrilla,
          subs,
          fotosPorSubir: conFoto ? 1 : 0,
          capturado: A(d, '17:30').toISOString(),
          claveEnvio: randomUUID(),
        },
        A(d, '17:30'),
      ),
    );
    if (cierre && conFoto) {
      const f = await foto(
        PM,
        d,
        o.folio,
        { refTipo: 'bitacora', refId: cierre.bitacoraId },
        1,
        `${o.folio} · ${hoy[0]!.nombre}`,
        '#7a5c3e',
      );
      if (f && azar() < 0.6)
        await como(PM, d, o.folio, 'foto para el cliente', (tx) =>
          S.marcarFotoCliente(tx, { fotoId: f.fotoId, visible: true }),
        );
    }
    if (!cierre) continue;

    // los gastos de lo que arranca hoy: compras chicas del PM, y las grandes de la oficina
    for (const p of hoy.filter((p) => !st.gastos.has(p.id))) {
      // lo que de verdad cuesta la partida, menos lo que ya pone la cuadrilla (sus horas) o el sub (su orden)
      const real = (o.costoPartida.get(p.id) ?? 0) * (1 + o.plan.desvio) * entre(0.9, 1.1);
      const cuantos = o.plan.espacios.some((e) => e.tipo === 'Cocina') ? 2 : 1;
      const material =
        p.responsable === 'subcontratista'
          ? real * 0.2
          : p.responsable === 'cuadrilla'
            ? Math.max(real * 0.15, real - p.dias * cuantos * 8 * 24)
            : real; // del PM: permisos, contenedor, inspecciones
      if (material < 40) continue;
      const categoria =
        p.responsable === 'pm' ? (/contenedor/i.test(p.nombre) ? 'disposicion' : 'permisos') : 'material';
      if (material > 900) {
        const proveedor =
          categoria === 'disposicion'
            ? 'Texas Disposal Systems'
            : categoria === 'permisos'
              ? 'City of Austin'
              : PROVEEDORES.material![Math.floor(azar() * 6)]!;
        await como(DU, d, o.folio, `compra de la oficina ${p.nombre}`, (tx) =>
          S.registrarCompraOficina(
            tx,
            {
              obraId: o.id,
              monto: centavos(material),
              dia: d,
              partidaId: p.id,
              categoria,
              proveedor,
              descripcion: `Material para ${p.nombre.toLowerCase()}`,
              metodoPago: 'tarjeta',
            },
            A(d, '13:00'),
          ),
        );
        continue;
      }
      // el PM compra en una o dos idas a la tienda; alguna pasa su límite y la revisa el dueño
      const idas = material > LIMITE_PM ? 2 : 1;
      for (let i = 0; i < idas; i++) {
        const monto = centavos((material / idas) * entre(0.9, 1.1));
        const proveedor =
          categoria === 'disposicion'
            ? 'Texas Disposal Systems'
            : categoria === 'permisos'
              ? 'City of Austin'
              : PROVEEDORES.material![Math.floor(azar() * 6)]!;
        const conRecibo = azar() > 0.08;
        const g = await como(PM, d, o.folio, `gasto del PM ${p.nombre}`, (tx) =>
          S.registrarGasto(
            tx,
            {
              obraId: o.id,
              claveEnvio: randomUUID(),
              capturado: A(d, '12:30').toISOString(),
              monto,
              partidaId: p.id,
              categoria,
              proveedor,
              descripcion: p.nombre,
              recibo: conRecibo ? 1 : 0,
            },
            A(d, '12:30'),
          ),
        );
        if (g && conRecibo)
          await foto(
            PM,
            d,
            o.folio,
            { refTipo: 'gasto', refId: g.gastoId },
            1,
            `Recibo ${proveedor} $${monto}`,
            '#6c757d',
          );
        if (g && monto > LIMITE_PM)
          await como(DU, d, o.folio, 'el dueño revisa el gasto', (tx) =>
            S.marcarGastoRevisado(tx, { gastoId: g.gastoId }, A(d, '19:00')),
          );
      }
      st.gastos.add(p.id);
    }
  }

  // los eventos que no siguen al cronograma: avisos, órdenes de cambio y cobros
  await eventos(d);
}

// ------------------------------------------------------------------ eventos
async function eventos(d: Dia) {
  const por = (cliente: string) => obras.find((o) => o.plan.cliente === cliente)!;
  const dia = (o: Obra, n: number) => sumarLaborables(o.plan.inicio, n, cal) === d;

  // Brown: tubería galvanizada detrás del muro al demoler → aviso, respuesta, orden de cambio aprobada con firma
  const brown = por('Brown Family');
  if (dia(brown, 1)) {
    const pm = (await estado(brown)).pm!;
    const av = await como(pm.userId, d, brown.folio, 'aviso de condición oculta', (tx) =>
      S.levantarAviso(
        tx,
        {
          obraId: brown.id,
          claveEnvio: randomUUID(),
          tipo: 'condicion_oculta',
          descripcion:
            'Al demoler apareció tubería galvanizada corroída detrás del muro de la regadera; hay que cambiarla antes de cerrar.',
          detiene: true,
          fotos: 1,
        },
        A(d, '10:30'),
      ),
    );
    if (av) {
      await foto(
        pm.userId,
        d,
        brown.folio,
        { refTipo: 'aviso', refId: av.avisoId },
        1,
        `${brown.folio} · tubería galvanizada`,
        '#9b2226',
      );
      await como(DU, d, brown.folio, 'respuesta al aviso', (tx) =>
        S.responderAviso(
          tx,
          {
            avisoId: av.avisoId,
            respuesta: 'Visto. Preparo la orden de cambio para el cliente; mientras, sigan con lo demás.',
          },
          A(d, '12:00'),
        ),
      );
      const oc = await como(DU, d, brown.folio, 'orden de cambio por condición oculta', (tx) =>
        S.crearOrdenCambio(
          tx,
          {
            obraId: brown.id,
            motivo: 'condicion_oculta',
            descripcion: 'Cambiar 18 ft de tubería galvanizada por PEX en la pared de la regadera',
            hallazgo: d,
            costo: 1150,
            precio: 1850,
            dias: 2,
            condicion: 'al_autorizar',
          },
          A(d, '13:00'),
        ),
      );
      if (oc?.ok && brown.enlace) await sinUsuarioPortal(d, brown, oc.ordenId, 'aprobada', 'Michael Brown');
    }
  }
  // García: el cliente pide luces bajo los gabinetes → aprobada en papel; el PM la hace
  const garcia = por('Familia García');
  if (dia(garcia, 6)) {
    const oc = await como(DU, d, garcia.folio, 'orden de cambio pedida por el cliente', (tx) =>
      S.crearOrdenCambio(
        tx,
        {
          obraId: garcia.id,
          motivo: 'solicitud_cliente',
          descripcion: 'Iluminación LED bajo los gabinetes superiores, con su apagador',
          hallazgo: d,
          costo: 820,
          precio: 1400,
          dias: 1,
          condicion: 'mitad_al_autorizar',
        },
        A(d, '10:00'),
      ),
    );
    if (oc?.ok)
      await como(DU, d, garcia.folio, 'respuesta del cliente en papel', (tx) =>
        S.responderCambioDueno(
          tx,
          {
            ordenId: oc.ordenId,
            decision: 'aprobada',
            nombre: 'Ana García',
            comentario: 'Firmó en papel en la visita',
          },
          A(d, '16:00'),
        ),
      );
  }
  // Smith: cambio de selección de tile → el cliente la rechaza en el portal
  const smith = por('Smith Residence');
  if (dia(smith, 5)) {
    const oc = await como(DU, d, smith.folio, 'orden de cambio de selección', (tx) =>
      S.crearOrdenCambio(
        tx,
        {
          obraId: smith.id,
          motivo: 'cambio_seleccion',
          descripcion: 'Cambiar el tile del piso a porcelanato premium 24x48',
          hallazgo: d,
          costo: 640,
          precio: 980,
          dias: 0,
        },
        A(d, '09:30'),
      ),
    );
    // deja menos del margen mínimo: la app avisa y se emite así
    const oc2 =
      oc && !oc.ok
        ? await como(DU, d, smith.folio, 'orden de cambio de selección (forzada)', (tx) =>
            S.crearOrdenCambio(
              tx,
              {
                obraId: smith.id,
                motivo: 'cambio_seleccion',
                descripcion: 'Cambiar el tile del piso a porcelanato premium 24x48',
                hallazgo: d,
                costo: 640,
                precio: 980,
                dias: 0,
                forzar: true,
              },
              A(d, '09:35'),
            ),
          )
        : oc;
    if (oc2?.ok) await sinUsuarioPortal(d, smith, oc2.ordenId, 'rechazada', 'John Smith');
  }
  // Johnson: un cambio con margen bajo: la app avisa y se emite de todos modos
  const johnson = por('Familia Johnson');
  if (dia(johnson, 9)) {
    const datos = {
      obraId: johnson.id,
      motivo: 'solicitud_cliente' as const,
      descripcion: 'Agregar barra de apoyo en la regadera',
      hallazgo: d,
      costo: 260,
      precio: 320,
      dias: 0,
    };
    const r = await como(DU, d, johnson.folio, 'orden de cambio con margen bajo', (tx) =>
      S.crearOrdenCambio(tx, datos, A(d, '09:00')),
    );
    if (r && !r.ok) {
      notas.push(
        `${johnson.folio}: la app avisó margen bajo (${Math.round(r.margen * 100)}% vs ${Math.round(r.minimo * 100)}%) y sugirió ${r.sugerido}`,
      );
      const r2 = await como(DU, d, johnson.folio, 'orden de cambio con margen bajo (forzada)', (tx) =>
        S.crearOrdenCambio(tx, { ...datos, forzar: true }, A(d, '09:05')),
      );
      if (r2?.ok) await sinUsuarioPortal(d, johnson, r2.ordenId, 'aprobada', 'Laura Johnson');
    }
  }
  // Hernández: nicho adicional, aprobado en el portal
  const hernandez = por('Familia Hernández');
  if (dia(hernandez, 4)) {
    const oc = await como(DU, d, hernandez.folio, 'orden de cambio nicho', (tx) =>
      S.crearOrdenCambio(
        tx,
        {
          obraId: hernandez.id,
          motivo: 'solicitud_cliente',
          descripcion: 'Nicho adicional de 12x24 en la regadera del baño principal',
          hallazgo: d,
          costo: 380,
          precio: 650,
          dias: 1,
        },
        A(d, '10:00'),
      ),
    );
    if (oc?.ok) await sinUsuarioPortal(d, hernandez, oc.ordenId, 'aprobada', 'Rosa Hernández');
  }
  // Wilson: una orden sin respuesta del cliente
  const wilson = por('Wilson Home');
  if (dia(wilson, 3))
    await como(DU, d, wilson.folio, 'orden de cambio sin respuesta', (tx) =>
      S.crearOrdenCambio(
        tx,
        {
          obraId: wilson.id,
          motivo: 'solicitud_cliente',
          descripcion: 'Reubicar el contacto de la isla y agregar uno USB',
          hallazgo: d,
          costo: 290,
          precio: 480,
          dias: 0,
        },
        A(d, '15:00'),
      ),
    );
  // Martínez: el proveedor retrasó los gabinetes → aviso de material
  const martinez = por('Familia Martínez');
  if (dia(martinez, 9)) {
    const pm = (await estado(martinez)).pm!;
    const av = await como(pm.userId, d, martinez.folio, 'aviso de material', (tx) =>
      S.levantarAviso(
        tx,
        {
          obraId: martinez.id,
          claveEnvio: randomUUID(),
          tipo: 'material',
          descripcion:
            'El proveedor movió la entrega de los gabinetes una semana; la cuadrilla se pasa a pintura.',
          detiene: false,
        },
        A(d, '09:00'),
      ),
    );
    if (av)
      await como(DU, sumarDias(d, 0), martinez.folio, 'respuesta al aviso', (tx) =>
        S.responderAviso(
          tx,
          { avisoId: av.avisoId, respuesta: 'Ok, hablo con el proveedor y le aviso al cliente.' },
          A(d, '15:30'),
        ),
      );
  }
  // las órdenes aprobadas que ya se pueden hacer: el PM las marca hechas (con foto) cuando el espacio avanzó
  for (const o of obras) {
    if (o.cerrada || o.plan.inicio > d) continue;
    const st = await estado(o);
    if (!st.pm) continue;
    const listas = await sql<{ id: string }[]>`
      select oc.id from ordenes_cambio oc where oc.obra_id = ${o.id} and oc.estado in ('autorizada', 'facturada')
        and not exists (select 1 from cambios_hechos h where h.orden_cambio_id = oc.id)
        and oc.autorizada_en < now() - interval '0 days'`;
    const avance = st.avance.filter((x) => x.estado === 'terminada').length / Math.max(1, o.partidas.length);
    for (const oc of listas) {
      if (avance < 0.6 || azar() < 0.5) continue;
      const h = await como(st.pm.userId, d, o.folio, 'PM marca hecha la orden de cambio', (tx) =>
        S.marcarCambioHecho(tx, { ordenId: oc.id, nota: 'Listo, revisado con el cliente.' }, A(d, '16:30')),
      );
      if (h)
        await foto(
          st.pm.userId,
          d,
          o.folio,
          { refTipo: 'cambio_hecho', refId: h.cambioHechoId },
          1,
          `${o.folio} · cambio realizado`,
          '#386641',
        );
    }
    // el cobro de cada orden aprobada (D-089): la deja facturada
    for (const oc of await sql<{ id: string; precio: string }[]>`
      select oc.id, m.precio_cliente as precio from ordenes_cambio oc
      join ordenes_cambio_montos m on m.orden_cambio_id = oc.id
      where oc.obra_id = ${o.id} and oc.estado = 'autorizada'`)
      await como(DU, d, o.folio, 'cobro de la orden de cambio', (tx) =>
        S.registrarCobro(
          tx,
          {
            obraId: o.id,
            fecha: d,
            concepto: 'orden_cambio',
            ordenCambioId: oc.id,
            monto: Number(oc.precio),
            metodo: 'zelle',
          },
          A(d, '18:10'),
        ),
      );
    // el cobro de avance al pasar la mitad
    const cobros = await sql<
      { concepto: string; monto: string }[]
    >`select concepto, monto from cobros where obra_id = ${o.id}`;
    if (avance >= 0.5 && !cobros.some((c) => c.concepto === 'hito'))
      await como(DU, d, o.folio, 'cobro de avance', (tx) =>
        S.registrarCobro(
          tx,
          {
            obraId: o.id,
            fecha: d,
            concepto: 'hito',
            monto: redondo(o.contrato * 0.4, 1),
            metodo: 'transferencia',
          },
          A(d, '18:00'),
        ),
      );
  }
}

async function sinUsuarioPortal(
  d: Dia,
  o: Obra,
  ordenId: string,
  decision: 'aprobada' | 'rechazada',
  nombre: string,
) {
  try {
    await S.sinUsuario(servidor, (tx) =>
      S.responderCambioCliente(tx, {
        token: o.enlace!,
        ordenId,
        decision,
        nombre,
        firma: decision === 'aprobada' ? firma : null,
        comentario: decision === 'rechazada' ? 'Preferimos quedarnos con el tile original.' : null,
        ip: '73.0.0.1',
        navegador: 'Simulación',
      }),
    );
    notas.push(
      `${o.folio}: el cliente ${decision === 'aprobada' ? 'aprobó con su firma' : 'rechazó'} una orden de cambio en su portal`,
    );
  } catch (e) {
    anotar({
      dia: d,
      obra: o.folio,
      paso: 'respuesta del cliente en el portal',
      codigo: e instanceof ErrorDeNegocio ? e.codigo : 'ERROR',
      detalle: e instanceof Error ? e.message : String(e),
    });
  }
}

// ------------------------------------------------------------------ terminar y cerrar una obra
async function terminarObra(o: Obra, st: Estado, d: Dia) {
  const PM = st.pm!.userId;
  const [m] = await sql`select 1 from correcciones where tabla = 'espacios' and accion = 'medida_verificada'
                        and registro_id = any(${o.espacios.map((e) => e.id)})`;
  if (!m) {
    // el recorrido con el cliente: la medida verificada y el punch
    for (const e of o.espacios.filter((x) => !x.generales))
      await como(PM, d, o.folio, 'medida verificada', (tx) =>
        S.verificarMedida(
          tx,
          { espacioId: e.id, pies2: Math.round(e.pies2 * entre(0.97, 1.04)) },
          A(d, '09:00'),
        ),
      );
    for (const item of [
      'Retocar pintura junto al marco de la puerta',
      'Ajustar la puerta del gabinete que roza',
    ])
      await como(PM, d, o.folio, 'punch', (tx) =>
        S.agregarPunch(
          tx,
          { obraId: o.id, item, origen: 'defecto', responsable: 'Cuadrilla' },
          A(d, '09:30'),
        ),
      );
    await como(PM, d, o.folio, 'cierre del día del recorrido', (tx) =>
      S.cerrarDia(
        tx,
        {
          obraId: o.id,
          sinTrabajo: true,
          motivo: 'otro',
          incidencia: 'Recorrido final con el cliente.',
          capturado: A(d, '17:00').toISOString(),
        },
        A(d, '17:00'),
      ),
    );
    return;
  }
  const abiertos = await sql<
    { id: string }[]
  >`select id from punch_list where obra_id = ${o.id} and estado = 'abierto'`;
  if (abiertos.length) {
    for (const p of abiertos)
      await como(PM, d, o.folio, 'cerrar punch', (tx) => S.cerrarPunch(tx, { punchId: p.id }, A(d, '11:00')));
    return;
  }
  // el cobro final y el cierre (D-085)
  const rev = await como(DU, d, o.folio, 'revisión de cierre', (tx) =>
    S.revisionDeCierre(tx, { obraId: o.id }, A(d, '16:00')),
  );
  if (!rev) return;
  const falta = rev.numeros.contratoFinal - rev.numeros.cobrado;
  if (falta > 1)
    await como(DU, d, o.folio, 'cobro final', (tx) =>
      S.registrarCobro(
        tx,
        { obraId: o.id, fecha: d, concepto: 'liquidacion', monto: centavos(falta), metodo: 'cheque' },
        A(d, '16:10'),
      ),
    );
  const r = await como(DU, d, o.folio, 'cerrar la obra', (tx) =>
    S.cerrarObra(tx, { obraId: o.id, fechaEntrega: d, garantiaMeses: 12 }, A(d, '17:00')),
  );
  if (r && !r.ok) {
    notas.push(`${o.folio}: al cerrar, la app pidió confirmar: ${r.avisos.map((x) => x.codigo).join(', ')}`);
    await como(DU, d, o.folio, 'cerrar la obra (confirmado)', (tx) =>
      S.cerrarObra(tx, { obraId: o.id, fechaEntrega: d, garantiaMeses: 12, forzar: true }, A(d, '17:05')),
    );
  }
  o.cerrada = true;
  console.log(`  ✔ ${o.folio} cerrada el ${d}`);
}

// ------------------------------------------------------------------ resumen
console.log(`\n=== Resumen: ${diasSimulados} días laborables simulados`);
for (const o of obras) {
  const [r] = await sql<
    { estado: string; cierres: number; gastos: number; ots: number; ocs: number; cobrado: string }[]
  >`
    select o.estado,
      (select count(*)::int from bitacora where obra_id = o.id and estado = 'vigente') as cierres,
      (select count(*)::int from gastos where obra_id = o.id and estado = 'vigente') as gastos,
      (select count(*)::int from ordenes_trabajo where obra_id = o.id) as ots,
      (select count(*)::int from ordenes_cambio where obra_id = o.id) as ocs,
      (select coalesce(sum(monto), 0) from cobros where obra_id = o.id and estado = 'vigente') as cobrado
    from obras o where o.id = ${o.id}`;
  console.log(
    `  ${o.folio} ${o.plan.cliente}: ${r!.estado}, ${r!.cierres} cierres, ${r!.gastos} gastos, ${r!.ots} OT, ${r!.ocs} OC, cobrado ${r!.cobrado}`,
  );
}
console.log(`\n=== Hallazgos (${hallazgos.length})`);
const porCodigo = new Map<string, Hallazgo[]>();
for (const h of hallazgos)
  porCodigo.set(`${h.paso} · ${h.codigo}`, [...(porCodigo.get(`${h.paso} · ${h.codigo}`) ?? []), h]);
for (const [k, hs] of porCodigo)
  console.log(
    `  ${hs.length}× ${k}${hs[0]!.detalle ? ` — ej. ${hs[0]!.obra} ${hs[0]!.dia}: ${hs[0]!.detalle}` : ''}`,
  );
console.log(`\n=== Notas (${notas.length})`);
for (const n of [...new Set(notas)]) console.log(`  · ${n}`);
await sql.end();
await servidor.sql.end();
