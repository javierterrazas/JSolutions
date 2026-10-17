// Validaciones de captura (legacy: comun/validaciones.js; pm/servidor.js pmCerrarDia, fechaCaptura_;
// admin/servidor.js duNuevaObra, duCierreTardio). Cada regla rechaza con un código y sus datos (D-015), en el
// mismo orden en que el legacy revisaba, para que el usuario reciba el mismo primer problema.
import { ErrorDeNegocio } from './errores';
import { type Calendario, type Dia, diaEnZona, restarLaborables } from './fechas';

// ------------------------------------------------------------------ datos obligatorios
/**
 * Junta TODO lo que falta en un solo error: { codigo: 'faltan', datos: { campos: [...] } }, que la pantalla
 * muestra como "Faltan: cliente, fecha de entrega." Vacío es: nulo, indefinido o texto en blanco.
 */
export function exigir(pares: readonly (readonly [unknown, string])[]): void {
  const faltan = pares
    .filter(([v]) => v === undefined || v === null || String(v).trim() === '')
    .map(([, c]) => c);
  if (faltan.length) throw new ErrorDeNegocio('faltan', { campos: faltan });
}

// ------------------------------------------------------------------ cuadrilla
export interface TrabajadorTipo {
  readonly id: string;
  readonly tipoPago: 'hora' | 'dia';
}

/** Un registro de cuadrilla ya guardado (vigente), de cualquier obra. */
export interface RegistroCuadrilla {
  readonly id: string;
  readonly trabajadorId: string;
  readonly obraId: string;
  readonly dia: Dia;
  readonly cantidad: number;
}

/**
 * Un trabajador por día se registra como día completo o medio día, y la suma de todas las obras en la misma fecha
 * no puede pasar de un día (ni de 16 horas si cobra por hora). Sin esto, anotarlo completo en las dos obras de un
 * PM lo cobraba doble. Al corregir, `excluirId` es el registro que se cambia: no cuenta contra sí mismo.
 * Errores: `cuadrilla_dia_o_medio`, `cuadrilla_pasa_un_dia`, `cuadrilla_pasa_16_horas`.
 */
export function validarHoras(
  trabajador: TrabajadorTipo | undefined,
  dia: Dia,
  cantidad: number,
  registros: readonly RegistroCuadrilla[],
  excluirId?: string,
): void {
  if (!trabajador) return;
  const porDia = trabajador.tipoPago === 'dia';
  const h = Number(cantidad) || 0;
  if (porDia && h !== 0.5 && h !== 1) {
    throw new ErrorDeNegocio('cuadrilla_dia_o_medio', { trabajador: trabajador.id });
  }
  const previos = registros.filter(
    (r) => r.trabajadorId === trabajador.id && r.id !== excluirId && r.dia === dia,
  );
  const ya = previos.reduce((a, r) => a + (Number(r.cantidad) || 0), 0);
  const obras = [...new Set(previos.map((r) => r.obraId))];
  if (porDia && ya + h > 1) {
    throw new ErrorDeNegocio('cuadrilla_pasa_un_dia', { trabajador: trabajador.id, dia, ya, obras });
  }
  if (!porDia && ya + h > 16) {
    throw new ErrorDeNegocio('cuadrilla_pasa_16_horas', {
      trabajador: trabajador.id,
      dia,
      ya,
      total: ya + h,
      obras,
    });
  }
}

/** La cuadrilla de una captura: el mismo trabajador dos veces se suma antes de validar. */
export function validarCuadrilla(
  captura: readonly { readonly trabajadorId: string; readonly cantidad: number }[],
  dia: Dia,
  trabajadores: readonly TrabajadorTipo[],
  registros: readonly RegistroCuadrilla[],
): void {
  const suma = new Map<string, number>();
  for (const t of captura) {
    if (!t.trabajadorId || !(Number(t.cantidad) > 0)) continue;
    suma.set(t.trabajadorId, (suma.get(t.trabajadorId) ?? 0) + Number(t.cantidad));
  }
  for (const [id, cantidad] of suma) {
    validarHoras(
      trabajadores.find((t) => t.id === id),
      dia,
      cantidad,
      registros,
    );
  }
}

// ------------------------------------------------------------------ el día de una captura
/**
 * El día de trabajo de una captura. Un cierre guardado sin señal el lunes y enviado el martes es del LUNES: el
 * teléfono manda cuándo se capturó. Se acepta hasta 7 días atrás, nunca en el futuro; si no, es hoy.
 */
export function diaDeCaptura(capturado: string | null | undefined, ahora: Date, zona: string): Dia {
  const f = capturado ? new Date(capturado) : null;
  const valido =
    f && !Number.isNaN(f.getTime()) && f <= ahora && ahora.getTime() - f.getTime() <= 7 * 86_400_000;
  return diaEnZona(valido ? f : ahora, zona);
}

// ------------------------------------------------------------------ alta de obra
export interface EspacioAlta {
  readonly tipo: string;
  readonly nombre?: string | null;
  readonly pies2?: number | null;
  readonly piesLineales?: number | null;
}

export interface DatosAlta {
  readonly cliente?: string | null;
  readonly telefono?: string | null;
  readonly direccion?: string | null;
  readonly pmId?: string | null;
  readonly inicio?: Dia | null;
  readonly finEstimada?: Dia | null;
  readonly contrato?: number | null;
  readonly espacios?: readonly EspacioAlta[];
  /** Advertencias que el dueño ya confirmó, por código (por ejemplo, 'obra_duplicada'). */
  readonly confirmado?: readonly string[];
}

export interface ContextoAlta {
  /** Los PMs activos de la empresa. */
  readonly pmsActivos: ReadonlySet<string>;
  /** Las obras sin entregar, para detectar un doble clic. */
  readonly obrasActivas: readonly {
    readonly id: string;
    readonly cliente: string;
    readonly direccion: string;
  }[];
}

export type ResultadoAlta =
  | { readonly ok: true; readonly espacios: readonly (EspacioAlta & { readonly nombre: string })[] }
  | { readonly ok: false; readonly confirmar: 'obra_duplicada'; readonly obraId: string };

const normalizar = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Los datos sin los que una obra no funciona: sin PM nadie la ve, sin contrato no hay margen, sin fechas no hay
 * cronograma ni atraso, sin pies² no hay costos unitarios. El mismo cliente en la misma dirección casi siempre es
 * un doble clic: se pide confirmar. Errores: `faltan`, `telefono_incompleto`, `pm_no_activo`,
 * `entrega_antes_del_inicio`, `sin_espacios`, `faltan_pies2`.
 */
export function validarAltaObra(datos: DatosAlta, ctx: ContextoAlta): ResultadoAlta {
  const espacios = (datos.espacios ?? []).filter((e) => e.tipo);
  exigir([
    [datos.cliente, 'cliente'],
    [datos.telefono, 'telefono_cliente'],
    [datos.direccion, 'direccion'],
    [datos.pmId, 'pm'],
    [datos.inicio, 'fecha_inicio'],
    [datos.finEstimada, 'fecha_entrega'],
    [Number(datos.contrato) > 0 ? 1 : '', 'contrato'],
  ]);
  if (String(datos.telefono).replace(/\D/g, '').length < 10) throw new ErrorDeNegocio('telefono_incompleto');
  if (!ctx.pmsActivos.has(String(datos.pmId))) throw new ErrorDeNegocio('pm_no_activo');
  if (datos.finEstimada! < datos.inicio!) throw new ErrorDeNegocio('entrega_antes_del_inicio');
  if (!espacios.length) throw new ErrorDeNegocio('sin_espacios');
  const conNombre = espacios.map((e) => ({ ...e, nombre: String(e.nombre ?? '').trim() || e.tipo }));
  const sinPies = conNombre.filter((e) => !(Number(e.pies2) > 0)).map((e) => e.nombre);
  if (sinPies.length) throw new ErrorDeNegocio('faltan_pies2', { espacios: sinPies });
  const dup = ctx.obrasActivas.find(
    (o) =>
      normalizar(o.cliente) === normalizar(datos.cliente) &&
      normalizar(o.direccion) === normalizar(datos.direccion),
  );
  if (dup && !(datos.confirmado ?? []).includes('obra_duplicada')) {
    return { ok: false, confirmar: 'obra_duplicada', obraId: dup.id };
  }
  return { ok: true, espacios: conNombre };
}

// ------------------------------------------------------------------ cierre tardío
/**
 * El PM puede cerrar tarde solo los últimos 2 días laborables, una vez por día. Más atrás, el dueño con motivo.
 * Errores: `fuera_de_ventana`, `dia_ya_cerrado`.
 */
export function validarCierreTardioPM(
  dia: Dia,
  hoy: Dia,
  diasCerrados: ReadonlySet<Dia>,
  cal: Calendario,
  ventana = 2,
): void {
  const validos = Array.from({ length: ventana }, (_, i) => restarLaborables(hoy, i + 1, cal));
  if (!validos.includes(dia)) throw new ErrorDeNegocio('fuera_de_ventana', { ventana });
  if (diasCerrados.has(dia)) throw new ErrorDeNegocio('dia_ya_cerrado', { dia });
}

/**
 * El día de algo que el PM capturó antes y llega después (de la cola, sin señal): ese día lo dice la hora del
 * teléfono, y el teléfono puede tener la hora atrasada. No se le cree más atrás de la misma ventana del cierre
 * tardío: un día capturado en los últimos 2 días laborables, o en uno no laborable entre ellos y hoy (D-054).
 * Error: `fuera_de_ventana`.
 */
export function validarDiaDeCaptura(dia: Dia, hoy: Dia, cal: Calendario, ventana = 2): void {
  if (dia < restarLaborables(hoy, ventana, cal)) throw new ErrorDeNegocio('fuera_de_ventana', { ventana });
}

/**
 * El día olvidado que registra el dueño, más atrás de la ventana del PM: con motivo, un día anterior a hoy, no
 * antes del inicio de la obra, sin cierre ya, y con al menos una partida. Errores: `obra_cerrada`,
 * `falta_motivo`, `falta_dia`, `solo_dias_anteriores`, `antes_del_inicio`, `dia_ya_cerrado`, `faltan_partidas`.
 */
export function validarCierreTardioDueno(c: {
  readonly obraCerrada: boolean;
  readonly motivo: string | null | undefined;
  readonly dia: Dia | null | undefined;
  readonly hoy: Dia;
  readonly inicioObra: Dia | null;
  readonly diasCerrados: ReadonlySet<Dia>;
  readonly partidas: readonly string[];
}): void {
  if (c.obraCerrada) throw new ErrorDeNegocio('obra_cerrada');
  if (!String(c.motivo ?? '').trim()) throw new ErrorDeNegocio('falta_motivo');
  if (!c.dia) throw new ErrorDeNegocio('falta_dia');
  if (c.dia >= c.hoy) throw new ErrorDeNegocio('solo_dias_anteriores');
  if (c.inicioObra && c.dia < c.inicioObra)
    throw new ErrorDeNegocio('antes_del_inicio', { inicio: c.inicioObra });
  if (c.diasCerrados.has(c.dia)) throw new ErrorDeNegocio('dia_ya_cerrado', { dia: c.dia });
  if (!c.partidas.length) throw new ErrorDeNegocio('faltan_partidas');
}

// ------------------------------------------------------------------ cierre del día
export const MOTIVOS_SIN_TRABAJO = [
  'esperando_fabricacion',
  'esperando_sub',
  'esperando_material',
  'esperando_inspeccion',
  'clima',
  'cliente_no_disponible',
  'otro',
] as const;
export type MotivoSinTrabajo = (typeof MOTIVOS_SIN_TRABAJO)[number];

/**
 * Lo que un cierre de día necesita, antes de revisar calidad y cuadrilla. Un día sin trabajo también se reporta,
 * con su motivo. Las fotos son opcionales (D-059): pueden venir con el cierre o comprometerse para después (hasta 10).
 * Errores: `falta_motivo_sin_trabajo`, `obra_sin_presupuesto`, `faltan_partidas`, `orden_de_otra_obra`.
 */
export function validarCierreDia(c: {
  readonly sinTrabajo: boolean;
  readonly motivo?: string | null;
  readonly obraSinPresupuesto: boolean;
  readonly fotos: number;
  readonly fotosPorSubir: number;
  readonly partidas: readonly string[];
  readonly ordenesReportadas: readonly string[];
  readonly ordenesDeLaObra: ReadonlySet<string>;
}): { fotosComprometidas: number } {
  const porSubir = c.sinTrabajo ? 0 : Math.max(0, Math.min(10, Math.floor(Number(c.fotosPorSubir) || 0)));
  if (!c.sinTrabajo && c.obraSinPresupuesto) throw new ErrorDeNegocio('obra_sin_presupuesto');
  if (c.sinTrabajo) {
    if (!MOTIVOS_SIN_TRABAJO.includes(c.motivo as MotivoSinTrabajo))
      throw new ErrorDeNegocio('falta_motivo_sin_trabajo');
  } else {
    if (!c.partidas.length) throw new ErrorDeNegocio('faltan_partidas');
  }
  const ajena = c.ordenesReportadas.find((o) => !c.ordenesDeLaObra.has(o));
  if (ajena) throw new ErrorDeNegocio('orden_de_otra_obra', { orden: ajena });
  return { fotosComprometidas: porSubir };
}

// ------------------------------------------------------------------ orden de cambio
export interface DatosOrdenCambio {
  readonly motivo: string | null;
  readonly descripcion: string | null;
  readonly hallazgo: string | null;
  readonly costo: number | null;
  readonly precio: number | null;
  /** Ya confirmó emitirla aunque el margen salga abajo del mínimo. */
  readonly forzar?: boolean;
}

export type ResultadoOrdenCambio =
  | { readonly ok: true; readonly margen: number }
  | {
      readonly ok: false;
      readonly confirmar: 'margen_bajo';
      readonly margen: number;
      readonly minimo: number;
      /** El precio, en dólares cerrados, que deja el margen mínimo. */
      readonly sugerido: number;
    };

/**
 * La orden de cambio (legacy: admin/servidor.js duCrearOC). Se cobra con margen igual o mayor al del contrato: si
 * el precio al cliente deja menos del mínimo, pide confirmar y sugiere el precio que lo cumple. Errores: `faltan`,
 * `falta_precio`.
 */
export function validarOrdenCambio(datos: DatosOrdenCambio, margenMinimo: number): ResultadoOrdenCambio {
  exigir([
    [datos.motivo, 'motivo'],
    [datos.descripcion, 'descripcion'],
    [datos.hallazgo, 'fecha_hallazgo'],
    [datos.costo, 'costo'],
  ]);
  const costo = Number(datos.costo) || 0;
  const precio = Number(datos.precio) || 0;
  if (precio <= 0) throw new ErrorDeNegocio('falta_precio');
  const margen = 1 - costo / precio;
  if (margen < margenMinimo && !datos.forzar)
    return {
      ok: false,
      confirmar: 'margen_bajo',
      margen,
      minimo: margenMinimo,
      sugerido: Math.ceil(costo / (1 - margenMinimo)),
    };
  return { ok: true, margen };
}

// ------------------------------------------------------------------ subcontratistas
export interface PapelesSub {
  readonly seguroVence: Dia | null;
  readonly licencia: string | null;
  readonly licenciaVence: Dia | null;
  /** Su oficio requiere licencia estatal (en Texas: plomería, electricidad, HVAC). */
  readonly requiereLicencia: boolean;
}

export type AvisoPapeles =
  | { readonly codigo: 'sin_seguro' }
  | { readonly codigo: 'seguro_vencido'; readonly dia: Dia }
  | { readonly codigo: 'seguro_por_vencer'; readonly dia: Dia }
  | { readonly codigo: 'sin_licencia' }
  | { readonly codigo: 'licencia_vencida'; readonly dia: Dia };

/** Cuántos días antes de que venza el seguro se avisa. */
export const DIAS_AVISO_SEGURO = 30;

/**
 * Lo que le falta en papeles a un subcontratista (legacy: admin/servidor.js revisionSub_). Vacío: en regla. El
 * sistema no bloquea: avisa, y al emitirle una orden o pagarle se confirma. Además del legacy, avisa del seguro que
 * vence en los próximos 30 días.
 */
export function revisarPapelesSub(s: PapelesSub, hoy: Dia): AvisoPapeles[] {
  const out: AvisoPapeles[] = [];
  if (!s.seguroVence) out.push({ codigo: 'sin_seguro' });
  else if (s.seguroVence < hoy) out.push({ codigo: 'seguro_vencido', dia: s.seguroVence });
  else if (s.seguroVence <= sumarDiasNaturales(hoy, DIAS_AVISO_SEGURO))
    out.push({ codigo: 'seguro_por_vencer', dia: s.seguroVence });
  if (s.requiereLicencia) {
    if (!s.licencia?.trim()) out.push({ codigo: 'sin_licencia' });
    else if (s.licenciaVence && s.licenciaVence < hoy)
      out.push({ codigo: 'licencia_vencida', dia: s.licenciaVence });
  }
  return out;
}

/** Un día más n días de calendario (no laborables). */
function sumarDiasNaturales(d: Dia, n: number): Dia {
  const f = new Date(`${d}T12:00:00Z`);
  f.setUTCDate(f.getUTCDate() + n);
  return f.toISOString().slice(0, 10);
}

// ------------------------------------------------------------------ órdenes de trabajo y pagos a subs
export interface DatosOrdenTrabajo {
  readonly subId: string | null;
  readonly partidaId: string | null;
  readonly alcance: string | null;
  readonly inicio: Dia | null;
  readonly fin: Dia | null;
  readonly precio: number | null;
}

/**
 * La orden de trabajo a un sub (legacy: admin/servidor.js duCrearOT): es el compromiso de costo de esa partida, con
 * precio cerrado. Si al sub le faltan papeles, pide confirmar (`papeles`). Errores: `faltan`, `fin_antes_del_inicio`,
 * `precio_cerrado`.
 */
export function validarOrdenTrabajo(
  d: DatosOrdenTrabajo,
  papeles: readonly AvisoPapeles[],
  confirmado: readonly string[],
): { ok: true } | { ok: false; confirmar: 'papeles'; avisos: readonly AvisoPapeles[] } {
  exigir([
    [d.subId, 'subcontratista'],
    [d.partidaId, 'partida'],
    [d.alcance, 'alcance'],
    [d.inicio, 'fecha_inicio'],
    [d.fin, 'fecha_fin'],
  ]);
  if (d.fin! < d.inicio!) throw new ErrorDeNegocio('fin_antes_del_inicio');
  if (!(Number(d.precio) > 0)) throw new ErrorDeNegocio('precio_cerrado');
  if (papeles.length && !confirmado.includes('papeles'))
    return { ok: false, confirmar: 'papeles', avisos: papeles };
  return { ok: true };
}

export type AvisoPagoSub = 'sin_aprobar' | 'papeles' | 'sobrepago';

/**
 * Un pago a un sub, siempre contra su orden (legacy: duPagoSub). Cada advertencia se confirma por separado, en este
 * orden: una liquidación antes de que se reciba el trabajo (`sin_aprobar`), el sub sin papeles en regla (`papeles`; no cuenta que falte la fecha del seguro,
 * como el legacy), y pagar más que el precio cerrado (`sobrepago`: el extra va en una orden de cambio). Devuelve si
 * con este pago queda liquidada. El legacy también avisaba de un anticipo antes de que el sub confirmara por escrito;
 * ya no se confirma (D-091). Error: `monto_invalido`.
 */
export function validarPagoSub(
  p: { monto: number | null; concepto: 'anticipo' | 'parcial' | 'liquidacion' },
  orden: { aprobada: boolean; precio: number; pagado: number },
  papeles: readonly AvisoPapeles[],
  confirmado: readonly string[],
): { ok: true; liquida: boolean } | { ok: false; confirmar: AvisoPagoSub; total?: number } {
  const monto = Number(p.monto) || 0;
  if (monto <= 0) throw new ErrorDeNegocio('monto_invalido');
  const acepta = (c: AvisoPagoSub) => confirmado.includes(c);
  if (p.concepto === 'liquidacion' && !orden.aprobada && !acepta('sin_aprobar'))
    return { ok: false, confirmar: 'sin_aprobar' };
  if (papeles.some((a) => a.codigo !== 'sin_seguro') && !acepta('papeles'))
    return { ok: false, confirmar: 'papeles' };
  const total = orden.pagado + monto;
  if (total > orden.precio + 0.01 && !acepta('sobrepago'))
    return { ok: false, confirmar: 'sobrepago', total };
  return { ok: true, liquida: total >= orden.precio - 0.01 };
}
