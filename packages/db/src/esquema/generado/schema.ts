// ARCHIVO GENERADO por `pnpm db:esquema` desde supabase/migrations/. No lo edites: cambia la migración y
// vuelve a generarlo.
import { authUsers } from 'drizzle-orm/supabase';
import {
  pgTable,
  index,
  foreignKey,
  unique,
  pgPolicy,
  check,
  uuid,
  text,
  boolean,
  timestamp,
  uniqueIndex,
  integer,
  numeric,
  date,
  smallint,
  primaryKey,
  pgView,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const accion_correccion = pgEnum('accion_correccion', [
  'editar',
  'anular',
  'agregar',
  'quitar',
  'dia_olvidado',
  'medida_verificada',
]);
export const categoria_gasto = pgEnum('categoria_gasto', [
  'material',
  'renta_equipo',
  'herramienta',
  'permisos',
  'disposicion',
  'otro',
]);
export const causa_no_calidad = pgEnum('causa_no_calidad', [
  'error_instalacion',
  'error_especificacion',
  'error_estimacion',
  'material_defectuoso',
  'falta_supervision',
]);
export const concepto_cobro = pgEnum('concepto_cobro', [
  'deposito',
  'hito',
  'orden_cambio',
  'liquidacion',
  'otro',
]);
export const concepto_pago_sub = pgEnum('concepto_pago_sub', ['anticipo', 'parcial', 'liquidacion']);
export const estado_abierto = pgEnum('estado_abierto', ['abierto', 'cerrado']);
export const estado_avance = pgEnum('estado_avance', ['en_progreso', 'terminada']);
export const estado_obra = pgEnum('estado_obra', [
  'sin_presupuesto',
  'lista_para_arranque',
  'en_obra',
  'en_cierre',
  'entregada',
]);
export const estado_orden_cambio = pgEnum('estado_orden_cambio', [
  'propuesta',
  'autorizada',
  'rechazada',
  'facturada',
]);
export const estado_orden_trabajo = pgEnum('estado_orden_trabajo', [
  'emitida',
  'confirmada',
  'aprobada',
  'pagada',
  'cancelada',
]);
export const estado_partida = pgEnum('estado_partida', ['activa', 'quitada']);
export const estado_prueba_agua = pgEnum('estado_prueba_agua', ['en_curso', 'sin_fugas', 'con_fuga']);
export const estado_registro = pgEnum('estado_registro', ['vigente', 'anulado']);
export const idioma = pgEnum('idioma', ['es', 'en']);
export const metodo_pago = pgEnum('metodo_pago', [
  'transferencia',
  'cheque',
  'zelle',
  'efectivo',
  'tarjeta',
  'tarjeta_empresa',
]);
export const motivo_orden_cambio = pgEnum('motivo_orden_cambio', [
  'condicion_oculta',
  'solicitud_cliente',
  'cambio_seleccion',
]);
export const motivo_sin_trabajo = pgEnum('motivo_sin_trabajo', [
  'esperando_fabricacion',
  'esperando_sub',
  'esperando_material',
  'esperando_inspeccion',
  'clima',
  'cliente_no_disponible',
  'otro',
]);
export const origen_gasto = pgEnum('origen_gasto', ['pm', 'oficina']);
export const origen_punch = pgEnum('origen_punch', ['defecto', 'cambio_alcance', 'expectativa']);
export const responsable_partida = pgEnum('responsable_partida', ['cuadrilla', 'pm', 'subcontratista']);
export const respuesta_punto = pgEnum('respuesta_punto', ['cumple', 'no_cumple', 'no_aplica']);
export const resultado_inspeccion = pgEnum('resultado_inspeccion', ['aprobado', 'con_defectos']);
export const revision_gasto = pgEnum('revision_gasto', ['pendiente', 'revisado']);
export const rol_miembro = pgEnum('rol_miembro', ['dueno', 'admin', 'pm']);
export const tipo_aviso = pgEnum('tipo_aviso', [
  'material',
  'cliente',
  'sub',
  'condicion_oculta',
  'diseno',
  'otro',
]);
export const tipo_foto = pgEnum('tipo_foto', [
  'bitacora',
  'inspeccion',
  'prueba_agua',
  'aviso',
  'punch',
  'gasto',
  'orden_cambio',
]);
export const tipo_no_calidad = pgEnum('tipo_no_calidad', ['retrabajo', 'garantia']);
export const tipo_pago = pgEnum('tipo_pago', ['hora', 'dia']);

export const trabajadores = pgTable(
  'trabajadores',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    nombre: text().notNull(),
    puesto: text(),
    tipo_pago: tipo_pago().notNull(),
    telefono: text(),
    activo: boolean().default(true).notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('trabajadores_empresa_id_idx').using('btree', table.empresa_id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'trabajadores_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id],
      foreignColumns: [empresas.id],
      name: 'trabajadores_empresa_id_fkey',
    }),
    unique('trabajadores_empresa_id_id_key').on(table.id, table.empresa_id),
    pgPolicy('la empresa lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`(empresa_id = ( SELECT empresa_actual() AS empresa_actual))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('trabajadores_nombre_check', sql`btrim(nombre) <> ''::text`),
  ],
);

export const puntos_control = pgTable(
  'puntos_control',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    hito_id: uuid().notNull(),
    orden: integer().default(0).notNull(),
    texto_es: text().notNull(),
    texto_en: text(),
    requiere_foto: boolean().default(false).notNull(),
    activo: boolean().default(true).notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('puntos_control_empresa_id_hito_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.hito_id.asc().nullsLast().op('uuid_ops'),
    ),
    uniqueIndex('puntos_control_texto_unico').using('btree', sql`hito_id`, sql`lower(texto_es)`),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'puntos_control_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.hito_id],
      foreignColumns: [hitos_calidad.id, hitos_calidad.empresa_id],
      name: 'puntos_control_empresa_id_hito_id_fkey',
    }),
    unique('puntos_control_empresa_id_id_key').on(table.id, table.empresa_id),
    pgPolicy('la empresa lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`(empresa_id = ( SELECT empresa_actual() AS empresa_actual))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('puntos_control_texto_es_check', sql`btrim(texto_es) <> ''::text`),
  ],
);

export const plantillas_partida = pgTable(
  'plantillas_partida',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    tipo_espacio_id: uuid().notNull(),
    orden: integer().default(0).notNull(),
    nombre_es: text().notNull(),
    nombre_en: text(),
    hito_id: uuid(),
    peso: numeric({ precision: 6, scale: 2 }).default('1').notNull(),
    dias: integer().default(1).notNull(),
    responsable: responsable_partida().default('cuadrilla').notNull(),
    oficio_id: uuid(),
    paralelo: boolean().default(false).notNull(),
    espera: integer().default(0).notNull(),
    etapa_id: uuid(),
    activa: boolean().default(true).notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('plantillas_partida_empresa_id_tipo_espacio_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.tipo_espacio_id.asc().nullsLast().op('uuid_ops'),
    ),
    uniqueIndex('plantillas_partida_nombre_unico')
      .using('btree', sql`tipo_espacio_id`, sql`lower(nombre_es)`)
      .where(sql`activa`),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'plantillas_partida_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.etapa_id],
      foreignColumns: [etapas.id, etapas.empresa_id],
      name: 'plantillas_partida_empresa_id_etapa_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.hito_id],
      foreignColumns: [hitos_calidad.id, hitos_calidad.empresa_id],
      name: 'plantillas_partida_empresa_id_hito_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.oficio_id],
      foreignColumns: [oficios.id, oficios.empresa_id],
      name: 'plantillas_partida_empresa_id_oficio_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.tipo_espacio_id],
      foreignColumns: [tipos_espacio.id, tipos_espacio.empresa_id],
      name: 'plantillas_partida_empresa_id_tipo_espacio_id_fkey',
    }),
    unique('plantillas_partida_empresa_id_id_key').on(table.id, table.empresa_id),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check(
      'plantillas_partida_check',
      sql`(responsable = 'subcontratista'::responsable_partida) = (oficio_id IS NOT NULL)`,
    ),
    check('plantillas_partida_dias_check', sql`dias >= 1`),
    check('plantillas_partida_espera_check', sql`espera >= 0`),
    check('plantillas_partida_nombre_es_check', sql`btrim(nombre_es) <> ''::text`),
    check('plantillas_partida_peso_check', sql`peso > (0)::numeric`),
  ],
);

export const subcontratistas = pgTable(
  'subcontratistas',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    nombre: text().notNull(),
    oficio_id: uuid().notNull(),
    telefono: text(),
    contacto: text(),
    correo: text(),
    seguro_vence: date(),
    licencia: text(),
    licencia_vence: date(),
    w9: boolean().default(false).notNull(),
    activo: boolean().default(true).notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('subcontratistas_empresa_id_idx').using('btree', table.empresa_id.asc().nullsLast().op('uuid_ops')),
    uniqueIndex('subcontratistas_nombre_unico').using('btree', sql`empresa_id`, sql`lower(btrim(nombre))`),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'subcontratistas_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.oficio_id],
      foreignColumns: [oficios.id, oficios.empresa_id],
      name: 'subcontratistas_empresa_id_oficio_id_fkey',
    }),
    unique('subcontratistas_empresa_id_id_key').on(table.id, table.empresa_id),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('subcontratistas_nombre_check', sql`btrim(nombre) <> ''::text`),
  ],
);

export const obras_finanzas = pgTable(
  'obras_finanzas',
  {
    obra_id: uuid().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    contrato_original: numeric({ precision: 12, scale: 2 }).notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'obras_finanzas_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.empresa_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'obras_finanzas_empresa_id_obra_id_fkey',
    }),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('obras_finanzas_contrato_original_check', sql`contrato_original > (0)::numeric`),
  ],
);

export const espacios = pgTable(
  'espacios',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    obra_id: uuid().notNull(),
    tipo_espacio_id: uuid().notNull(),
    nombre: text().notNull(),
    orden: integer().default(0).notNull(),
    pies2_cotizados: numeric({ precision: 10, scale: 2 }).default('0').notNull(),
    pies_lineales_cotizados: numeric({ precision: 10, scale: 2 }).default('0').notNull(),
    pies2_verificados: numeric({ precision: 10, scale: 2 }),
    pies_lineales_verificados: numeric({ precision: 10, scale: 2 }),
    verificado_por: uuid(),
    verificado_en: timestamp({ withTimezone: true, mode: 'string' }),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('espacios_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'espacios_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'espacios_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.tipo_espacio_id],
      foreignColumns: [tipos_espacio.id, tipos_espacio.empresa_id],
      name: 'espacios_empresa_id_tipo_espacio_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.verificado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'espacios_empresa_id_verificado_por_fkey',
    }),
    unique('espacios_empresa_id_id_key').on(table.id, table.empresa_id),
    unique('espacios_obra_id_id_key').on(table.id, table.obra_id),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    pgPolicy('pm lee sus obras', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    pgPolicy('pm verifica medidas en sus obras', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('espacios_check', sql`(pies2_verificados IS NULL) = (verificado_en IS NULL)`),
    check('espacios_check1', sql`(verificado_por IS NULL) = (verificado_en IS NULL)`),
    check('espacios_nombre_check', sql`btrim(nombre) <> ''::text`),
    check('espacios_pies2_cotizados_check', sql`pies2_cotizados >= (0)::numeric`),
    check('espacios_pies2_verificados_check', sql`pies2_verificados > (0)::numeric`),
    check('espacios_pies_lineales_cotizados_check', sql`pies_lineales_cotizados >= (0)::numeric`),
    check('espacios_pies_lineales_verificados_check', sql`pies_lineales_verificados >= (0)::numeric`),
  ],
);

export const partidas_obra = pgTable(
  'partidas_obra',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    obra_id: uuid().notNull(),
    espacio_id: uuid().notNull(),
    plantilla_id: uuid(),
    orden: integer().default(0).notNull(),
    nombre_es: text().notNull(),
    nombre_en: text(),
    hito_id: uuid(),
    peso: numeric({ precision: 6, scale: 2 }).default('1').notNull(),
    dias: integer().default(1).notNull(),
    responsable: responsable_partida().default('cuadrilla').notNull(),
    oficio_id: uuid(),
    paralelo: boolean().default(false).notNull(),
    espera: integer().default(0).notNull(),
    etapa_id: uuid(),
    estado: estado_partida().default('activa').notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('partidas_obra_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    uniqueIndex('partidas_obra_nombre_unico')
      .using('btree', sql`espacio_id`, sql`lower(nombre_es)`)
      .where(sql`(estado = 'activa'::estado_partida)`),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'partidas_obra_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.etapa_id],
      foreignColumns: [etapas.id, etapas.empresa_id],
      name: 'partidas_obra_empresa_id_etapa_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.hito_id],
      foreignColumns: [hitos_calidad.id, hitos_calidad.empresa_id],
      name: 'partidas_obra_empresa_id_hito_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'partidas_obra_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.oficio_id],
      foreignColumns: [oficios.id, oficios.empresa_id],
      name: 'partidas_obra_empresa_id_oficio_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.plantilla_id],
      foreignColumns: [plantillas_partida.id, plantillas_partida.empresa_id],
      name: 'partidas_obra_empresa_id_plantilla_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.espacio_id],
      foreignColumns: [espacios.id, espacios.obra_id],
      name: 'partidas_obra_obra_id_espacio_id_fkey',
    }),
    unique('partidas_obra_empresa_id_id_key').on(table.id, table.empresa_id),
    unique('partidas_obra_obra_id_id_key').on(table.id, table.obra_id),
    unique('partidas_obra_espacio_id_id_key').on(table.id, table.espacio_id),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    pgPolicy('pm lee sus obras', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    check(
      'partidas_obra_check',
      sql`(responsable = 'subcontratista'::responsable_partida) = (oficio_id IS NOT NULL)`,
    ),
    check('partidas_obra_dias_check', sql`dias >= 1`),
    check('partidas_obra_espera_check', sql`espera >= 0`),
    check('partidas_obra_nombre_es_check', sql`btrim(nombre_es) <> ''::text`),
    check('partidas_obra_peso_check', sql`peso > (0)::numeric`),
  ],
);

export const tarifas_trabajador = pgTable(
  'tarifas_trabajador',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    trabajador_id: uuid().notNull(),
    tarifa: numeric({ precision: 12, scale: 2 }).notNull(),
    vigente_desde: date().notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('tarifas_trabajador_empresa_id_trabajador_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.trabajador_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'tarifas_trabajador_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.trabajador_id],
      foreignColumns: [trabajadores.id, trabajadores.empresa_id],
      name: 'tarifas_trabajador_empresa_id_trabajador_id_fkey',
    }),
    unique('tarifas_trabajador_trabajador_id_vigente_desde_key').on(table.trabajador_id, table.vigente_desde),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('tarifas_trabajador_tarifa_check', sql`tarifa >= (0)::numeric`),
  ],
);

export const empresas = pgTable(
  'empresas',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    nombre: text().notNull(),
    ciudad: text(),
    zona_horaria: text().default('America/Chicago').notNull(),
    idioma: idioma().default('es').notNull(),
    activa: boolean().default(true).notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    pgPolicy('dueno lee su empresa', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno edita su empresa', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('empresas_nombre_check', sql`btrim(nombre) <> ''::text`),
  ],
);

export const tipos_espacio = pgTable(
  'tipos_espacio',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    nombre_es: text().notNull(),
    nombre_en: text(),
    es_generales: boolean().default(false).notNull(),
    orden: integer().default(0).notNull(),
    activo: boolean().default(true).notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('tipos_espacio_empresa_id_idx').using('btree', table.empresa_id.asc().nullsLast().op('uuid_ops')),
    uniqueIndex('tipos_espacio_nombre_unico').using('btree', sql`empresa_id`, sql`lower(nombre_es)`),
    uniqueIndex('tipos_espacio_un_generales')
      .using('btree', table.empresa_id.asc().nullsLast().op('uuid_ops'))
      .where(sql`es_generales`),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'tipos_espacio_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id],
      foreignColumns: [empresas.id],
      name: 'tipos_espacio_empresa_id_fkey',
    }),
    unique('tipos_espacio_empresa_id_id_key').on(table.id, table.empresa_id),
    pgPolicy('la empresa lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`(empresa_id = ( SELECT empresa_actual() AS empresa_actual))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('tipos_espacio_nombre_es_check', sql`btrim(nombre_es) <> ''::text`),
  ],
);

export const oficios = pgTable(
  'oficios',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    nombre_es: text().notNull(),
    nombre_en: text(),
    requiere_licencia: boolean().default(false).notNull(),
    activo: boolean().default(true).notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('oficios_empresa_id_idx').using('btree', table.empresa_id.asc().nullsLast().op('uuid_ops')),
    uniqueIndex('oficios_nombre_unico').using('btree', sql`empresa_id`, sql`lower(nombre_es)`),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'oficios_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id],
      foreignColumns: [empresas.id],
      name: 'oficios_empresa_id_fkey',
    }),
    unique('oficios_empresa_id_id_key').on(table.id, table.empresa_id),
    pgPolicy('dueno edita', {
      as: 'permissive',
      for: 'update',
      to: ['servidor_app'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
      withCheck: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('la empresa lee', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    check('oficios_nombre_es_check', sql`btrim(nombre_es) <> ''::text`),
  ],
);

export const etapas = pgTable(
  'etapas',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    nombre_es: text().notNull(),
    nombre_en: text(),
    orden: integer().default(0).notNull(),
    activa: boolean().default(true).notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('etapas_empresa_id_idx').using('btree', table.empresa_id.asc().nullsLast().op('uuid_ops')),
    uniqueIndex('etapas_nombre_unico').using('btree', sql`empresa_id`, sql`lower(nombre_es)`),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'etapas_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id],
      foreignColumns: [empresas.id],
      name: 'etapas_empresa_id_fkey',
    }),
    unique('etapas_empresa_id_id_key').on(table.id, table.empresa_id),
    pgPolicy('la empresa lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`(empresa_id = ( SELECT empresa_actual() AS empresa_actual))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('etapas_nombre_es_check', sql`btrim(nombre_es) <> ''::text`),
  ],
);

export const miembros = pgTable(
  'miembros',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    user_id: uuid().notNull(),
    rol: rol_miembro().notNull(),
    nombre: text().notNull(),
    telefono: text(),
    idioma: idioma().default('es').notNull(),
    activo: boolean().default(true).notNull(),
    tarjeta_ultimos4: text(),
    correo_avisos: text(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('miembros_empresa_id_idx').using('btree', table.empresa_id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [table.id, table.empresa_id],
      name: 'miembros_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id],
      foreignColumns: [empresas.id],
      name: 'miembros_empresa_id_fkey',
    }),
    foreignKey({
      columns: [table.user_id],
      foreignColumns: [authUsers.id],
      name: 'miembros_user_id_fkey',
    }),
    unique('miembros_empresa_id_id_key').on(table.id, table.empresa_id),
    unique('miembros_user_id_key').on(table.user_id),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('cada quien lee su miembro', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    check('miembros_correo_avisos_check', sql`correo_avisos ~~ '%_@_%'::text`),
    check('miembros_nombre_check', sql`btrim(nombre) <> ''::text`),
    check('miembros_tarjeta_ultimos4_check', sql`tarjeta_ultimos4 ~ '^[0-9]{4}$'::text`),
  ],
);

export const avance = pgTable(
  'avance',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    obra_id: uuid().notNull(),
    partida_obra_id: uuid().notNull(),
    bitacora_id: uuid(),
    estado: estado_avance().notNull(),
    dia: date().notNull(),
    estado_registro: estado_registro().default('vigente').notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('avance_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    index('avance_partida_obra_id_idx').using(
      'btree',
      table.partida_obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'avance_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'avance_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.bitacora_id],
      foreignColumns: [bitacora.id, bitacora.obra_id],
      name: 'avance_obra_id_bitacora_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.partida_obra_id],
      foreignColumns: [partidas_obra.id, partidas_obra.obra_id],
      name: 'avance_obra_id_partida_obra_id_fkey',
    }),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    pgPolicy('pm lee sus obras', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    pgPolicy('pm crea en sus obras', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('pm corrige su avance', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
  ],
);

export const mano_obra = pgTable(
  'mano_obra',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    obra_id: uuid().notNull(),
    espacio_id: uuid().notNull(),
    partida_obra_id: uuid(),
    trabajador_id: uuid().notNull(),
    cantidad: numeric({ precision: 5, scale: 2 }).notNull(),
    dia: date().notNull(),
    bitacora_id: uuid(),
    estado: estado_registro().default('vigente').notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('mano_obra_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    index('mano_obra_trabajador_id_dia_idx').using(
      'btree',
      table.trabajador_id.asc().nullsLast().op('date_ops'),
      table.dia.asc().nullsLast().op('date_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'mano_obra_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'mano_obra_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.trabajador_id],
      foreignColumns: [trabajadores.id, trabajadores.empresa_id],
      name: 'mano_obra_empresa_id_trabajador_id_fkey',
    }),
    foreignKey({
      columns: [table.espacio_id, table.partida_obra_id],
      foreignColumns: [partidas_obra.id, partidas_obra.espacio_id],
      name: 'mano_obra_espacio_id_partida_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.bitacora_id],
      foreignColumns: [bitacora.id, bitacora.obra_id],
      name: 'mano_obra_obra_id_bitacora_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.espacio_id],
      foreignColumns: [espacios.id, espacios.obra_id],
      name: 'mano_obra_obra_id_espacio_id_fkey',
    }),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    pgPolicy('pm lee sus obras', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    pgPolicy('pm crea en sus obras', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('pm corrige su cuadrilla', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('mano_obra_cantidad_check', sql`(cantidad > (0)::numeric) AND (cantidad <= (16)::numeric)`),
  ],
);

export const inspecciones = pgTable(
  'inspecciones',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    obra_id: uuid().notNull(),
    espacio_id: uuid().notNull(),
    hito_id: uuid().notNull(),
    partida_obra_id: uuid(),
    resultado: resultado_inspeccion().notNull(),
    puntos_ok: integer().notNull(),
    puntos_total: integer().notNull(),
    realizada_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('inspecciones_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    index('inspecciones_espacio_id_hito_id_realizada_en_idx').using(
      'btree',
      table.espacio_id.asc().nullsLast().op('timestamptz_ops'),
      table.hito_id.asc().nullsLast().op('uuid_ops'),
      table.realizada_en.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'inspecciones_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.hito_id],
      foreignColumns: [hitos_calidad.id, hitos_calidad.empresa_id],
      name: 'inspecciones_empresa_id_hito_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'inspecciones_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.espacio_id, table.partida_obra_id],
      foreignColumns: [partidas_obra.id, partidas_obra.espacio_id],
      name: 'inspecciones_espacio_id_partida_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.espacio_id],
      foreignColumns: [espacios.id, espacios.obra_id],
      name: 'inspecciones_obra_id_espacio_id_fkey',
    }),
    unique('inspecciones_obra_id_id_key').on(table.id, table.obra_id),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('pm lee sus obras', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    pgPolicy('pm crea en sus obras', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    check('inspecciones_check', sql`puntos_ok <= puntos_total`),
    check(
      'inspecciones_check1',
      sql`(resultado = 'aprobado'::resultado_inspeccion) = (puntos_ok = puntos_total)`,
    ),
    check('inspecciones_puntos_ok_check', sql`puntos_ok >= 0`),
    check('inspecciones_puntos_total_check', sql`puntos_total > 0`),
  ],
);

export const hitos_calidad = pgTable(
  'hitos_calidad',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    clave: text().notNull(),
    nombre_es: text().notNull(),
    nombre_en: text(),
    orden: integer().default(0).notNull(),
    exige_prueba_agua: boolean().default(false).notNull(),
    activo: boolean().default(true).notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('hitos_calidad_empresa_id_idx').using('btree', table.empresa_id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'hitos_calidad_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id],
      foreignColumns: [empresas.id],
      name: 'hitos_calidad_empresa_id_fkey',
    }),
    unique('hitos_calidad_empresa_id_id_key').on(table.id, table.empresa_id),
    unique('hitos_calidad_empresa_id_clave_key').on(table.empresa_id, table.clave),
    pgPolicy('la empresa lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`(empresa_id = ( SELECT empresa_actual() AS empresa_actual))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('hitos_calidad_clave_check', sql`btrim(clave) <> ''::text`),
    check('hitos_calidad_nombre_es_check', sql`btrim(nombre_es) <> ''::text`),
  ],
);

export const presupuesto_etapas = pgTable(
  'presupuesto_etapas',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    obra_id: uuid().notNull(),
    espacio_id: uuid().notNull(),
    etapa_id: uuid(),
    monto: numeric({ precision: 12, scale: 2 }).notNull(),
    notas: text(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('presupuesto_etapas_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'presupuesto_etapas_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.etapa_id],
      foreignColumns: [etapas.id, etapas.empresa_id],
      name: 'presupuesto_etapas_empresa_id_etapa_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'presupuesto_etapas_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.espacio_id],
      foreignColumns: [espacios.id, espacios.obra_id],
      name: 'presupuesto_etapas_obra_id_espacio_id_fkey',
    }),
    unique('presupuesto_etapas_espacio_id_etapa_id_key').on(table.espacio_id, table.etapa_id),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('presupuesto_etapas_monto_check', sql`monto >= (0)::numeric`),
  ],
);

export const plan_semanal = pgTable(
  'plan_semanal',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    semana: date().notNull(),
    obra_id: uuid().notNull(),
    partida_obra_id: uuid().notNull(),
    fin_previsto: date().notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('plan_semanal_empresa_id_semana_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('date_ops'),
      table.semana.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'plan_semanal_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.partida_obra_id],
      foreignColumns: [partidas_obra.id, partidas_obra.obra_id],
      name: 'plan_semanal_obra_id_partida_obra_id_fkey',
    }),
    unique('plan_semanal_semana_partida_obra_id_key').on(table.semana, table.partida_obra_id),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    check('plan_semanal_semana_check', sql`EXTRACT(isodow FROM semana) = (1)::numeric`),
  ],
);

export const pruebas_agua = pgTable(
  'pruebas_agua',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    obra_id: uuid().notNull(),
    espacio_id: uuid().notNull(),
    inicio: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    fin: timestamp({ withTimezone: true, mode: 'string' }),
    resultado: estado_prueba_agua().default('en_curso').notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('pruebas_agua_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    uniqueIndex('pruebas_agua_una_en_curso')
      .using('btree', table.espacio_id.asc().nullsLast().op('uuid_ops'))
      .where(sql`(resultado = 'en_curso'::estado_prueba_agua)`),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'pruebas_agua_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'pruebas_agua_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.espacio_id],
      foreignColumns: [espacios.id, espacios.obra_id],
      name: 'pruebas_agua_obra_id_espacio_id_fkey',
    }),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('pm lee sus obras', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    pgPolicy('pm crea en sus obras', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('pm cierra sus pruebas de agua', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('pruebas_agua_check', sql`(resultado = 'en_curso'::estado_prueba_agua) = (fin IS NULL)`),
    check('pruebas_agua_check1', sql`(fin IS NULL) OR (fin > inicio)`),
  ],
);

export const configuracion = pgTable(
  'configuracion',
  {
    empresa_id: uuid().primaryKey().notNull(),
    impuesto: numeric({ precision: 6, scale: 4 }).default('0.0825').notNull(),
    limite_compra_pm: numeric({ precision: 12, scale: 2 }).default('300').notNull(),
    sla_bloqueo_horas: integer().default(24).notNull(),
    sla_oc_horas: integer().default(48).notNull(),
    umbral_oc_menor: numeric({ precision: 12, scale: 2 }).default('200').notNull(),
    margen_minimo_oc: numeric({ precision: 5, scale: 4 }).default('0.35').notNull(),
    horas_sin_recibo: integer().default(72).notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.empresa_id],
      foreignColumns: [empresas.id],
      name: 'configuracion_empresa_id_fkey',
    }),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('configuracion_horas_sin_recibo_check', sql`horas_sin_recibo > 0`),
    check('configuracion_impuesto_check', sql`impuesto >= (0)::numeric`),
    check('configuracion_limite_compra_pm_check', sql`limite_compra_pm >= (0)::numeric`),
    check(
      'configuracion_margen_minimo_oc_check',
      sql`(margen_minimo_oc >= (0)::numeric) AND (margen_minimo_oc < (1)::numeric)`,
    ),
    check('configuracion_sla_bloqueo_horas_check', sql`sla_bloqueo_horas > 0`),
    check('configuracion_sla_oc_horas_check', sql`sla_oc_horas > 0`),
    check('configuracion_umbral_oc_menor_check', sql`umbral_oc_menor >= (0)::numeric`),
  ],
);

export const fotos = pgTable(
  'fotos',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    obra_id: uuid().notNull(),
    ref_tipo: tipo_foto().notNull(),
    ref_id: uuid().notNull(),
    indice: smallint().notNull(),
    storage_path: text().notNull(),
    tomada_en: timestamp({ withTimezone: true, mode: 'string' }),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
  },
  (table) => [
    index('fotos_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'fotos_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'fotos_empresa_id_obra_id_fkey',
    }),
    unique('fotos_ref_tipo_ref_id_indice_key').on(
      table.empresa_id,
      table.ref_tipo,
      table.ref_id,
      table.indice,
    ),
    unique('fotos_storage_path_key').on(table.storage_path),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('pm lee las fotos de sus obras', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    pgPolicy('pm sube fotos a sus obras', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    check('fotos_indice_check', sql`indice >= 1`),
  ],
);

export const ordenes_trabajo_precios = pgTable(
  'ordenes_trabajo_precios',
  {
    orden_trabajo_id: uuid().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    precio: numeric({ precision: 12, scale: 2 }).notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'ordenes_trabajo_precios_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.orden_trabajo_id, table.empresa_id],
      foreignColumns: [ordenes_trabajo.id, ordenes_trabajo.empresa_id],
      name: 'ordenes_trabajo_precios_empresa_id_orden_trabajo_id_fkey',
    }),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('ordenes_trabajo_precios_precio_check', sql`precio > (0)::numeric`),
  ],
);

export const ordenes_cambio_montos = pgTable(
  'ordenes_cambio_montos',
  {
    orden_cambio_id: uuid().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    costo_estimado: numeric({ precision: 12, scale: 2 }).notNull(),
    precio_cliente: numeric({ precision: 12, scale: 2 }).notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'ordenes_cambio_montos_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.orden_cambio_id, table.empresa_id],
      foreignColumns: [ordenes_cambio.id, ordenes_cambio.empresa_id],
      name: 'ordenes_cambio_montos_empresa_id_orden_cambio_id_fkey',
    }),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('ordenes_cambio_montos_costo_estimado_check', sql`costo_estimado >= (0)::numeric`),
    check('ordenes_cambio_montos_precio_cliente_check', sql`precio_cliente > (0)::numeric`),
  ],
);

export const entregas = pgTable(
  'entregas',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    obra_id: uuid().notNull(),
    fecha_entrega: date().notNull(),
    garantia_meses: integer().default(12).notNull(),
    garantia_vence: date().notNull(),
    autoriza_fotos: boolean().default(false).notNull(),
    resena_pedida: boolean().default(false).notNull(),
    resena_recibida: boolean().default(false).notNull(),
    referido_pedido: boolean().default(false).notNull(),
    visita_11m: boolean().default(false).notNull(),
    notas: text(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('entregas_empresa_id_idx').using('btree', table.empresa_id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'entregas_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'entregas_empresa_id_obra_id_fkey',
    }),
    unique('entregas_obra_id_key').on(table.obra_id),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('entregas_check', sql`garantia_vence >= fecha_entrega`),
    check('entregas_garantia_meses_check', sql`garantia_meses >= 0`),
  ],
);

export const obras_cerradas = pgTable(
  'obras_cerradas',
  {
    obra_id: uuid().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    fecha_inicio: date().notNull(),
    fecha_fin_real: date().notNull(),
    dias_ciclo: integer().notNull(),
    contrato_original: numeric({ precision: 12, scale: 2 }).notNull(),
    monto_oc: numeric({ precision: 12, scale: 2 }).notNull(),
    contrato_final: numeric({ precision: 12, scale: 2 }).notNull(),
    presupuestado: numeric({ precision: 12, scale: 2 }).notNull(),
    materiales: numeric({ precision: 12, scale: 2 }).notNull(),
    cuadrilla: numeric({ precision: 12, scale: 2 }).notNull(),
    subcontratos: numeric({ precision: 12, scale: 2 }).notNull(),
    costo_total: numeric({ precision: 12, scale: 2 }).notNull(),
    margen_bruto: numeric({ precision: 8, scale: 4 }),
    desviacion_estimacion: numeric({ precision: 8, scale: 4 }),
    cobrado: numeric({ precision: 12, scale: 2 }).notNull(),
    no_calidad: numeric({ precision: 12, scale: 2 }).notNull(),
    dias_reportados: integer().notNull(),
    pies2: numeric({ precision: 10, scale: 2 }).notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('obras_cerradas_empresa_id_idx').using('btree', table.empresa_id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'obras_cerradas_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.empresa_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'obras_cerradas_empresa_id_obra_id_fkey',
    }),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    check('obras_cerradas_check', sql`fecha_fin_real >= fecha_inicio`),
    check('obras_cerradas_dias_ciclo_check', sql`dias_ciclo >= 0`),
    check('obras_cerradas_dias_reportados_check', sql`dias_reportados >= 0`),
  ],
);

export const historico_etapas = pgTable(
  'historico_etapas',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    obra_id: uuid().notNull(),
    espacio_id: uuid().notNull(),
    tipo_espacio_id: uuid().notNull(),
    etapa_id: uuid(),
    presupuestado: numeric({ precision: 12, scale: 2 }).default('0').notNull(),
    costo_real: numeric({ precision: 12, scale: 2 }).notNull(),
    pies2: numeric({ precision: 10, scale: 2 }).notNull(),
    costo_por_pie2: numeric({ precision: 12, scale: 4 }),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('historico_etapas_empresa_id_tipo_espacio_id_etapa_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.tipo_espacio_id.asc().nullsLast().op('uuid_ops'),
      table.etapa_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.etapa_id],
      foreignColumns: [etapas.id, etapas.empresa_id],
      name: 'historico_etapas_empresa_id_etapa_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'historico_etapas_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.tipo_espacio_id],
      foreignColumns: [tipos_espacio.id, tipos_espacio.empresa_id],
      name: 'historico_etapas_empresa_id_tipo_espacio_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.espacio_id],
      foreignColumns: [espacios.id, espacios.obra_id],
      name: 'historico_etapas_obra_id_espacio_id_fkey',
    }),
    unique('historico_etapas_espacio_id_etapa_id_key').on(table.espacio_id, table.etapa_id),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
  ],
);

export const historico_duraciones = pgTable(
  'historico_duraciones',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    obra_id: uuid().notNull(),
    partida_obra_id: uuid().notNull(),
    tipo_espacio_id: uuid().notNull(),
    plantilla_id: uuid(),
    dias_planeados: integer().notNull(),
    dias_reales: integer().notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('historico_duraciones_empresa_id_tipo_espacio_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.tipo_espacio_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'historico_duraciones_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.plantilla_id],
      foreignColumns: [plantillas_partida.id, plantillas_partida.empresa_id],
      name: 'historico_duraciones_empresa_id_plantilla_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.tipo_espacio_id],
      foreignColumns: [tipos_espacio.id, tipos_espacio.empresa_id],
      name: 'historico_duraciones_empresa_id_tipo_espacio_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.partida_obra_id],
      foreignColumns: [partidas_obra.id, partidas_obra.obra_id],
      name: 'historico_duraciones_obra_id_partida_obra_id_fkey',
    }),
    unique('historico_duraciones_partida_obra_id_key').on(table.partida_obra_id),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    check('historico_duraciones_dias_reales_check', sql`dias_reales >= 1`),
  ],
);

export const correcciones = pgTable(
  'correcciones',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    tabla: text().notNull(),
    registro_id: uuid().notNull(),
    accion: accion_correccion().notNull(),
    campo: text(),
    antes: text(),
    despues: text(),
    motivo: text().notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
  },
  (table) => [
    index('correcciones_empresa_id_tabla_registro_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.tabla.asc().nullsLast().op('text_ops'),
      table.registro_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'correcciones_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id],
      foreignColumns: [empresas.id],
      name: 'correcciones_empresa_id_fkey',
    }),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('el servidor deja el rastro', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    check('correcciones_motivo_check', sql`length(btrim(motivo)) >= 5`),
  ],
);

export const dispositivos = pgTable(
  'dispositivos',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    miembro_id: uuid().notNull(),
    nombre: text().notNull(),
    pin_hash: text(),
    intentos_fallidos: integer().default(0).notNull(),
    bloqueado_hasta: timestamp({ withTimezone: true, mode: 'string' }),
    verificado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    ultimo_uso: timestamp({ withTimezone: true, mode: 'string' }),
    revocado_en: timestamp({ withTimezone: true, mode: 'string' }),
    revocado_por: uuid(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('dispositivos_empresa_id_miembro_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.miembro_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.miembro_id],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'dispositivos_empresa_id_miembro_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.revocado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'dispositivos_empresa_id_revocado_por_fkey',
    }),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('cada quien lee sus dispositivos', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    check('dispositivos_check', sql`(revocado_en IS NULL) = (revocado_por IS NULL)`),
    check('dispositivos_intentos_fallidos_check', sql`intentos_fallidos >= 0`),
    check('dispositivos_nombre_check', sql`btrim(nombre) <> ''::text`),
  ],
);

export const obras = pgTable(
  'obras',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    folio: text(),
    cliente: text().notNull(),
    telefono_cliente: text().notNull(),
    direccion: text().notNull(),
    pm_id: uuid().notNull(),
    fecha_inicio: date().notNull(),
    fecha_fin_estimada: date().notNull(),
    fecha_fin_real: date(),
    estado: estado_obra().default('sin_presupuesto').notNull(),
    notas: text(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('obras_empresa_id_estado_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.estado.asc().nullsLast().op('enum_ops'),
    ),
    index('obras_pm_id_idx').using('btree', table.pm_id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'obras_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id],
      foreignColumns: [empresas.id],
      name: 'obras_empresa_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.pm_id],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'obras_empresa_id_pm_id_fkey',
    }),
    unique('obras_empresa_id_id_key').on(table.id, table.empresa_id),
    unique('obras_empresa_id_folio_key').on(table.empresa_id, table.folio),
    pgPolicy('pm lee sus obras', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND (id IN ( SELECT obras_del_pm() AS obras_del_pm)))`,
    }),
    pgPolicy('dueno lee', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('obras_check', sql`fecha_fin_estimada >= fecha_inicio`),
    check('obras_check1', sql`(fecha_fin_real IS NULL) OR (fecha_fin_real >= fecha_inicio)`),
    check('obras_cliente_check', sql`btrim(cliente) <> ''::text`),
    check('obras_direccion_check', sql`btrim(direccion) <> ''::text`),
    check('obras_folio_asignado', sql`folio IS NOT NULL`),
    check(
      'obras_telefono_cliente_check',
      sql`length(regexp_replace(telefono_cliente, '\D'::text, ''::text, 'g'::text)) >= 10`,
    ),
  ],
);

export const bitacora = pgTable(
  'bitacora',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    folio: text(),
    obra_id: uuid().notNull(),
    dia: date().notNull(),
    sin_trabajo: boolean().default(false).notNull(),
    motivo_sin_trabajo: motivo_sin_trabajo(),
    incidencia: text(),
    tardio: boolean().default(false).notNull(),
    fotos_comprometidas: smallint().default(0).notNull(),
    estado: estado_registro().default('vigente').notNull(),
    enviado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('bitacora_empresa_id_obra_id_dia_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('date_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
      table.dia.asc().nullsLast().op('uuid_ops'),
    ),
    uniqueIndex('bitacora_un_cierre_por_dia')
      .using(
        'btree',
        table.obra_id.asc().nullsLast().op('uuid_ops'),
        table.dia.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`(estado = 'vigente'::estado_registro)`),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'bitacora_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'bitacora_empresa_id_obra_id_fkey',
    }),
    unique('bitacora_empresa_id_id_key').on(table.id, table.empresa_id),
    unique('bitacora_obra_id_id_key').on(table.id, table.obra_id),
    unique('bitacora_empresa_id_folio_key').on(table.empresa_id, table.folio),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    pgPolicy('pm lee sus obras', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    pgPolicy('pm crea en sus obras', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('pm corrige sus cierres', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('bitacora_check', sql`sin_trabajo = (motivo_sin_trabajo IS NOT NULL)`),
    check('bitacora_check1', sql`(NOT sin_trabajo) OR (fotos_comprometidas = 0)`),
    check('bitacora_folio_asignado', sql`folio IS NOT NULL`),
    check(
      'bitacora_fotos_comprometidas_check',
      sql`(fotos_comprometidas >= 0) AND (fotos_comprometidas <= 10)`,
    ),
  ],
);

export const gastos = pgTable(
  'gastos',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    folio: text(),
    obra_id: uuid().notNull(),
    espacio_id: uuid().notNull(),
    partida_obra_id: uuid(),
    dia: date().notNull(),
    categoria: categoria_gasto().default('material').notNull(),
    proveedor: text().notNull(),
    descripcion: text(),
    monto: numeric({ precision: 12, scale: 2 }).notNull(),
    metodo_pago: metodo_pago().notNull(),
    tarjeta_ultimos4: text(),
    origen: origen_gasto().notNull(),
    revision: revision_gasto(),
    estado: estado_registro().default('vigente').notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('gastos_creado_por_idx').using('btree', table.creado_por.asc().nullsLast().op('uuid_ops')),
    index('gastos_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'gastos_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'gastos_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.espacio_id, table.partida_obra_id],
      foreignColumns: [partidas_obra.id, partidas_obra.espacio_id],
      name: 'gastos_espacio_id_partida_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.espacio_id],
      foreignColumns: [espacios.id, espacios.obra_id],
      name: 'gastos_obra_id_espacio_id_fkey',
    }),
    unique('gastos_empresa_id_folio_key').on(table.empresa_id, table.folio),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    pgPolicy('pm lee sus gastos', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    pgPolicy('pm registra gastos en sus obras', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('pm corrige sus gastos', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('gastos_folio_asignado', sql`folio IS NOT NULL`),
    check('gastos_monto_check', sql`monto > (0)::numeric`),
    check('gastos_proveedor_check', sql`btrim(proveedor) <> ''::text`),
    check('gastos_tarjeta_ultimos4_check', sql`tarjeta_ultimos4 ~ '^[0-9]{4}$'::text`),
  ],
);

export const avisos = pgTable(
  'avisos',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    folio: text(),
    obra_id: uuid().notNull(),
    tipo: tipo_aviso().notNull(),
    descripcion: text().notNull(),
    detiene_avance: boolean().default(false).notNull(),
    estado: estado_abierto().default('abierto').notNull(),
    respuesta: text(),
    respondido_en: timestamp({ withTimezone: true, mode: 'string' }),
    respondido_por: uuid(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('avisos_creado_por_idx').using('btree', table.creado_por.asc().nullsLast().op('uuid_ops')),
    index('avisos_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'avisos_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'avisos_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.respondido_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'avisos_empresa_id_respondido_por_fkey',
    }),
    unique('avisos_empresa_id_id_key').on(table.id, table.empresa_id),
    unique('avisos_obra_id_id_key').on(table.id, table.obra_id),
    unique('avisos_empresa_id_folio_key').on(table.empresa_id, table.folio),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    pgPolicy('pm lee sus avisos', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    pgPolicy('pm levanta avisos en sus obras', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    check('avisos_check', sql`(estado = 'cerrado'::estado_abierto) = (respondido_en IS NOT NULL)`),
    check('avisos_descripcion_check', sql`length(btrim(descripcion)) >= 10`),
    check('avisos_folio_asignado', sql`folio IS NOT NULL`),
  ],
);

export const punch_list = pgTable(
  'punch_list',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    folio: text(),
    obra_id: uuid().notNull(),
    item: text().notNull(),
    origen: origen_punch().default('defecto').notNull(),
    responsable: text(),
    fecha_compromiso: date().notNull(),
    estado: estado_abierto().default('abierto').notNull(),
    cerrado_en: timestamp({ withTimezone: true, mode: 'string' }),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('punch_list_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'punch_list_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'punch_list_empresa_id_obra_id_fkey',
    }),
    unique('punch_list_empresa_id_folio_key').on(table.empresa_id, table.folio),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    pgPolicy('pm lee sus obras', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    pgPolicy('pm crea en sus obras', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('pm edita el punch de sus obras', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('punch_list_check', sql`(estado = 'cerrado'::estado_abierto) = (cerrado_en IS NOT NULL)`),
    check('punch_list_folio_asignado', sql`folio IS NOT NULL`),
    check('punch_list_item_check', sql`length(btrim(item)) >= 4`),
  ],
);

export const ordenes_trabajo = pgTable(
  'ordenes_trabajo',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    folio: text(),
    obra_id: uuid().notNull(),
    subcontratista_id: uuid().notNull(),
    espacio_id: uuid().notNull(),
    partida_obra_id: uuid().notNull(),
    alcance: text().notNull(),
    inicio_programado: date().notNull(),
    fin_programado: date().notNull(),
    estado: estado_orden_trabajo().default('emitida').notNull(),
    confirmada_en: timestamp({ withTimezone: true, mode: 'string' }),
    se_presento: boolean(),
    aprobada_en: timestamp({ withTimezone: true, mode: 'string' }),
    aprobada_por: uuid(),
    faltas: integer().default(0).notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('ordenes_trabajo_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    index('ordenes_trabajo_subcontratista_id_inicio_programado_idx').using(
      'btree',
      table.subcontratista_id.asc().nullsLast().op('date_ops'),
      table.inicio_programado.asc().nullsLast().op('date_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.aprobada_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'ordenes_trabajo_empresa_id_aprobada_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'ordenes_trabajo_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'ordenes_trabajo_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.subcontratista_id],
      foreignColumns: [subcontratistas.id, subcontratistas.empresa_id],
      name: 'ordenes_trabajo_empresa_id_subcontratista_id_fkey',
    }),
    foreignKey({
      columns: [table.espacio_id, table.partida_obra_id],
      foreignColumns: [partidas_obra.id, partidas_obra.espacio_id],
      name: 'ordenes_trabajo_espacio_id_partida_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.espacio_id],
      foreignColumns: [espacios.id, espacios.obra_id],
      name: 'ordenes_trabajo_obra_id_espacio_id_fkey',
    }),
    unique('ordenes_trabajo_empresa_id_id_key').on(table.id, table.empresa_id),
    unique('ordenes_trabajo_obra_id_id_key').on(table.id, table.obra_id),
    unique('ordenes_trabajo_empresa_id_folio_key').on(table.empresa_id, table.folio),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    pgPolicy('pm lee las ordenes vigentes de sus obras', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
    }),
    pgPolicy('pm confirma y aprueba ordenes de sus obras', {
      as: 'permissive',
      for: 'update',
      to: ['servidor_app'],
    }),
    check('ordenes_trabajo_alcance_check', sql`btrim(alcance) <> ''::text`),
    check('ordenes_trabajo_check', sql`fin_programado >= inicio_programado`),
    check('ordenes_trabajo_check1', sql`(aprobada_por IS NULL) = (aprobada_en IS NULL)`),
    check('ordenes_trabajo_faltas_check', sql`faltas >= 0`),
    check('ordenes_trabajo_folio_asignado', sql`folio IS NOT NULL`),
  ],
);

export const pagos_sub = pgTable(
  'pagos_sub',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    folio: text(),
    obra_id: uuid().notNull(),
    orden_trabajo_id: uuid().notNull(),
    fecha: date().notNull(),
    concepto: concepto_pago_sub().default('parcial').notNull(),
    monto: numeric({ precision: 12, scale: 2 }).notNull(),
    metodo: metodo_pago().default('transferencia').notNull(),
    referencia: text(),
    estado: estado_registro().default('vigente').notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('pagos_sub_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    index('pagos_sub_orden_trabajo_id_idx').using(
      'btree',
      table.orden_trabajo_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'pagos_sub_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'pagos_sub_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.orden_trabajo_id],
      foreignColumns: [ordenes_trabajo.id, ordenes_trabajo.obra_id],
      name: 'pagos_sub_obra_id_orden_trabajo_id_fkey',
    }),
    unique('pagos_sub_empresa_id_folio_key').on(table.empresa_id, table.folio),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('pagos_sub_folio_asignado', sql`folio IS NOT NULL`),
    check('pagos_sub_monto_check', sql`monto > (0)::numeric`),
  ],
);

export const ordenes_cambio = pgTable(
  'ordenes_cambio',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    folio: text(),
    obra_id: uuid().notNull(),
    fecha_hallazgo: date().notNull(),
    motivo: motivo_orden_cambio().notNull(),
    descripcion: text().notNull(),
    dias_impacto: integer().default(0).notNull(),
    estado: estado_orden_cambio().default('propuesta').notNull(),
    emitida_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    autorizada_en: timestamp({ withTimezone: true, mode: 'string' }),
    facturada_en: timestamp({ withTimezone: true, mode: 'string' }),
    condicion_pago: text(),
    aviso_id: uuid(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('ordenes_cambio_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'ordenes_cambio_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'ordenes_cambio_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.aviso_id],
      foreignColumns: [avisos.id, avisos.obra_id],
      name: 'ordenes_cambio_obra_id_aviso_id_fkey',
    }),
    unique('ordenes_cambio_empresa_id_id_key').on(table.id, table.empresa_id),
    unique('ordenes_cambio_obra_id_id_key').on(table.id, table.obra_id),
    unique('ordenes_cambio_empresa_id_folio_key').on(table.empresa_id, table.folio),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check(
      'ordenes_cambio_check',
      sql`(estado <> ALL (ARRAY['autorizada'::estado_orden_cambio, 'facturada'::estado_orden_cambio])) OR (autorizada_en IS NOT NULL)`,
    ),
    check(
      'ordenes_cambio_check1',
      sql`(estado <> 'facturada'::estado_orden_cambio) OR (facturada_en IS NOT NULL)`,
    ),
    check('ordenes_cambio_descripcion_check', sql`btrim(descripcion) <> ''::text`),
    check('ordenes_cambio_dias_impacto_check', sql`dias_impacto >= 0`),
    check('ordenes_cambio_folio_asignado', sql`folio IS NOT NULL`),
  ],
);

export const no_calidad = pgTable(
  'no_calidad',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    folio: text(),
    obra_id: uuid().notNull(),
    tipo: tipo_no_calidad().notNull(),
    causa: causa_no_calidad(),
    subcontratista_id: uuid(),
    costo: numeric({ precision: 12, scale: 2 }).default('0').notNull(),
    dias_perdidos: integer().default(0).notNull(),
    descripcion: text().notNull(),
    estado: estado_abierto().notNull(),
    cerrado_en: timestamp({ withTimezone: true, mode: 'string' }),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('no_calidad_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'no_calidad_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'no_calidad_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.subcontratista_id],
      foreignColumns: [subcontratistas.id, subcontratistas.empresa_id],
      name: 'no_calidad_empresa_id_subcontratista_id_fkey',
    }),
    unique('no_calidad_empresa_id_folio_key').on(table.empresa_id, table.folio),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('no_calidad_check', sql`(estado = 'cerrado'::estado_abierto) = (cerrado_en IS NOT NULL)`),
    check('no_calidad_costo_check', sql`costo >= (0)::numeric`),
    check('no_calidad_descripcion_check', sql`btrim(descripcion) <> ''::text`),
    check('no_calidad_dias_perdidos_check', sql`dias_perdidos >= 0`),
    check('no_calidad_folio_asignado', sql`folio IS NOT NULL`),
  ],
);

export const cobros = pgTable(
  'cobros',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    empresa_id: uuid().notNull(),
    folio: text(),
    obra_id: uuid().notNull(),
    fecha: date().notNull(),
    concepto: concepto_cobro().default('hito').notNull(),
    monto: numeric({ precision: 12, scale: 2 }).notNull(),
    metodo: metodo_pago().notNull(),
    referencia: text(),
    estado: estado_registro().default('vigente').notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    creado_por: uuid(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('cobros_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.creado_por],
      foreignColumns: [miembros.id, miembros.empresa_id],
      name: 'cobros_empresa_id_creado_por_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'cobros_empresa_id_obra_id_fkey',
    }),
    unique('cobros_empresa_id_folio_key').on(table.empresa_id, table.folio),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('cobros_folio_asignado', sql`folio IS NOT NULL`),
    check('cobros_monto_check', sql`monto > (0)::numeric`),
  ],
);

export const folios = pgTable(
  'folios',
  {
    empresa_id: uuid().notNull(),
    prefijo: text().notNull(),
    ultimo: integer().default(0).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.empresa_id],
      foreignColumns: [empresas.id],
      name: 'folios_empresa_id_fkey',
    }),
    primaryKey({ columns: [table.empresa_id, table.prefijo], name: 'folios_pkey' }),
    check('folios_prefijo_check', sql`prefijo ~ '^[A-Z]{2,4}$'::text`),
    check('folios_ultimo_check', sql`ultimo >= 0`),
  ],
);

export const bitacora_partidas = pgTable(
  'bitacora_partidas',
  {
    empresa_id: uuid().notNull(),
    obra_id: uuid().notNull(),
    bitacora_id: uuid().notNull(),
    partida_obra_id: uuid().notNull(),
  },
  (table) => [
    index('bitacora_partidas_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'bitacora_partidas_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.bitacora_id],
      foreignColumns: [bitacora.id, bitacora.obra_id],
      name: 'bitacora_partidas_obra_id_bitacora_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.partida_obra_id],
      foreignColumns: [partidas_obra.id, partidas_obra.obra_id],
      name: 'bitacora_partidas_obra_id_partida_obra_id_fkey',
    }),
    primaryKey({ columns: [table.bitacora_id, table.partida_obra_id], name: 'bitacora_partidas_pkey' }),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('pm lee sus obras', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    pgPolicy('pm crea en sus obras', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
  ],
);

export const metas_indicadores = pgTable(
  'metas_indicadores',
  {
    empresa_id: uuid().notNull(),
    indicador: text().notNull(),
    meta: numeric({ precision: 12, scale: 4 }).notNull(),
    creado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    actualizado_en: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.empresa_id],
      foreignColumns: [empresas.id],
      name: 'metas_indicadores_empresa_id_fkey',
    }),
    primaryKey({ columns: [table.empresa_id, table.indicador], name: 'metas_indicadores_pkey' }),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('dueno edita', { as: 'permissive', for: 'update', to: ['servidor_app'] }),
    check('metas_indicadores_indicador_check', sql`indicador ~ '^[a-z][a-z0-9_]*$'::text`),
  ],
);

export const bitacora_subs = pgTable(
  'bitacora_subs',
  {
    empresa_id: uuid().notNull(),
    obra_id: uuid().notNull(),
    bitacora_id: uuid().notNull(),
    orden_trabajo_id: uuid().notNull(),
    llego: boolean().notNull(),
  },
  (table) => [
    index('bitacora_subs_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'bitacora_subs_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.bitacora_id],
      foreignColumns: [bitacora.id, bitacora.obra_id],
      name: 'bitacora_subs_obra_id_bitacora_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.orden_trabajo_id],
      foreignColumns: [ordenes_trabajo.id, ordenes_trabajo.obra_id],
      name: 'bitacora_subs_obra_id_orden_trabajo_id_fkey',
    }),
    primaryKey({ columns: [table.bitacora_id, table.orden_trabajo_id], name: 'bitacora_subs_pkey' }),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('dueno crea', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
    pgPolicy('pm lee sus obras', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    pgPolicy('pm crea en sus obras', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
  ],
);

export const inspeccion_respuestas = pgTable(
  'inspeccion_respuestas',
  {
    empresa_id: uuid().notNull(),
    obra_id: uuid().notNull(),
    inspeccion_id: uuid().notNull(),
    punto_control_id: uuid().notNull(),
    texto_es: text().notNull(),
    respuesta: respuesta_punto().notNull(),
  },
  (table) => [
    index('inspeccion_respuestas_empresa_id_obra_id_idx').using(
      'btree',
      table.empresa_id.asc().nullsLast().op('uuid_ops'),
      table.obra_id.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.empresa_id, table.obra_id],
      foreignColumns: [obras.id, obras.empresa_id],
      name: 'inspeccion_respuestas_empresa_id_obra_id_fkey',
    }),
    foreignKey({
      columns: [table.empresa_id, table.punto_control_id],
      foreignColumns: [puntos_control.id, puntos_control.empresa_id],
      name: 'inspeccion_respuestas_empresa_id_punto_control_id_fkey',
    }),
    foreignKey({
      columns: [table.obra_id, table.inspeccion_id],
      foreignColumns: [inspecciones.id, inspecciones.obra_id],
      name: 'inspeccion_respuestas_obra_id_inspeccion_id_fkey',
    }),
    primaryKey({
      columns: [table.inspeccion_id, table.punto_control_id],
      name: 'inspeccion_respuestas_pkey',
    }),
    pgPolicy('dueno lee', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
      using: sql`((empresa_id = ( SELECT empresa_actual() AS empresa_actual)) AND ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
    }),
    pgPolicy('pm lee sus obras', { as: 'permissive', for: 'select', to: ['authenticated'] }),
    pgPolicy('pm crea en sus obras', { as: 'permissive', for: 'insert', to: ['servidor_app'] }),
  ],
);
export const empresa_actual_datos = pgView('empresa_actual_datos', {
  id: uuid(),
  nombre: text(),
  zona_horaria: text(),
  idioma: idioma(),
})
  .with({ securityBarrier: true })
  .as(
    sql`SELECT id, nombre, zona_horaria, idioma FROM empresas WHERE id = (( SELECT empresa_actual() AS empresa_actual))`,
  );

export const configuracion_pm = pgView('configuracion_pm', {
  empresa_id: uuid(),
  limite_compra_pm: numeric({ precision: 12, scale: 2 }),
  horas_sin_recibo: integer(),
  sla_bloqueo_horas: integer(),
})
  .with({ securityBarrier: true })
  .as(
    sql`SELECT empresa_id, limite_compra_pm, horas_sin_recibo, sla_bloqueo_horas FROM configuracion WHERE empresa_id = (( SELECT empresa_actual() AS empresa_actual))`,
  );

export const subcontratistas_pm = pgView('subcontratistas_pm', {
  id: uuid(),
  empresa_id: uuid(),
  nombre: text(),
  oficio_id: uuid(),
  telefono: text(),
  activo: boolean(),
})
  .with({ securityBarrier: true })
  .as(
    sql`SELECT id, empresa_id, nombre, oficio_id, telefono, activo FROM subcontratistas WHERE empresa_id = (( SELECT empresa_actual() AS empresa_actual))`,
  );

export const entregas_pm = pgView('entregas_pm', {
  obra_id: uuid(),
  empresa_id: uuid(),
  fecha_entrega: date(),
})
  .with({ securityBarrier: true })
  .as(
    sql`SELECT obra_id, empresa_id, fecha_entrega FROM entregas WHERE empresa_id = (( SELECT empresa_actual() AS empresa_actual)) AND ((obra_id IN ( SELECT obras_del_pm() AS obras_del_pm)) OR ( SELECT es_dueno_o_admin() AS es_dueno_o_admin))`,
  );

export const ordenes_cambio_pm = pgView('ordenes_cambio_pm', {
  id: uuid(),
  empresa_id: uuid(),
  obra_id: uuid(),
  folio: text(),
  descripcion: text(),
  dias_impacto: integer(),
  autorizada_en: timestamp({ withTimezone: true, mode: 'string' }),
})
  .with({ securityBarrier: true })
  .as(
    sql`SELECT id, empresa_id, obra_id, folio, descripcion, dias_impacto, autorizada_en FROM ordenes_cambio WHERE empresa_id = (( SELECT empresa_actual() AS empresa_actual)) AND (obra_id IN ( SELECT obras_del_pm() AS obras_del_pm)) AND (estado = ANY (ARRAY['autorizada'::estado_orden_cambio, 'facturada'::estado_orden_cambio]))`,
  );
