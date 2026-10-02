-- Paso 2 · 4 de 4 · Subcontratos, órdenes de cambio, cobros, entrega, cierre, históricos y correcciones.
-- Al final: RLS activado en todas las tablas y el sello de actualizado_en.

-- ------------------------------------------------------------------ subcontratos
-- Orden de trabajo a precio cerrado, ligada a una partida. El precio va aparte (💲).
create table public.ordenes_trabajo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  folio text not null,
  obra_id uuid not null,
  subcontratista_id uuid not null,
  espacio_id uuid not null,
  partida_obra_id uuid not null,
  alcance text not null check (btrim(alcance) <> ''),
  inicio_programado date not null,
  fin_programado date not null,
  estado public.estado_orden_trabajo not null default 'emitida',
  confirmada_en timestamptz,
  se_presento boolean,
  aprobada_en timestamptz,
  aprobada_por uuid,
  faltas integer not null default 0 check (faltas >= 0),
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, id),
  unique (obra_id, id),
  unique (empresa_id, folio),
  check (fin_programado >= inicio_programado),
  check ((aprobada_por is null) = (aprobada_en is null)),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (empresa_id, subcontratista_id) references public.subcontratistas (empresa_id, id),
  foreign key (obra_id, espacio_id) references public.espacios (obra_id, id),
  foreign key (espacio_id, partida_obra_id) references public.partidas_obra (espacio_id, id),
  foreign key (empresa_id, aprobada_por) references public.miembros (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.ordenes_trabajo (empresa_id, obra_id);
create index on public.ordenes_trabajo (subcontratista_id, inicio_programado);

-- 💲
create table public.ordenes_trabajo_precios (
  orden_trabajo_id uuid primary key,
  empresa_id uuid not null,
  precio numeric(12, 2) not null check (precio > 0),
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  foreign key (empresa_id, orden_trabajo_id) references public.ordenes_trabajo (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);

-- 💲 Pago a un sub: siempre contra una orden de trabajo, nunca como gasto suelto.
create table public.pagos_sub (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  folio text not null,
  obra_id uuid not null,
  orden_trabajo_id uuid not null,
  fecha date not null,
  concepto public.concepto_pago_sub not null default 'parcial',
  monto numeric(12, 2) not null check (monto > 0),
  metodo public.metodo_pago not null default 'transferencia',
  referencia text,
  estado public.estado_registro not null default 'vigente',
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, folio),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, orden_trabajo_id) references public.ordenes_trabajo (obra_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.pagos_sub (empresa_id, obra_id);
create index on public.pagos_sub (orden_trabajo_id);

-- Qué subs programados llegaron ese día (alimenta la tasa de presentación).
create table public.bitacora_subs (
  empresa_id uuid not null,
  obra_id uuid not null,
  bitacora_id uuid not null,
  orden_trabajo_id uuid not null,
  llego boolean not null,
  primary key (bitacora_id, orden_trabajo_id),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, bitacora_id) references public.bitacora (obra_id, id),
  foreign key (obra_id, orden_trabajo_id) references public.ordenes_trabajo (obra_id, id)
);
create index on public.bitacora_subs (empresa_id, obra_id);

-- ------------------------------------------------------------------ órdenes de cambio
-- Se ejecutan solo autorizadas; sus días se suman a la fecha comprometida. El costo y el precio van aparte (💲);
-- el margen se calcula, no se guarda.
create table public.ordenes_cambio (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  folio text not null,
  obra_id uuid not null,
  fecha_hallazgo date not null,
  motivo public.motivo_orden_cambio not null,
  descripcion text not null check (btrim(descripcion) <> ''),
  dias_impacto integer not null default 0 check (dias_impacto >= 0),
  estado public.estado_orden_cambio not null default 'propuesta',
  emitida_en timestamptz not null default now(),
  autorizada_en timestamptz,
  facturada_en timestamptz,
  condicion_pago text,
  aviso_id uuid,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, id),
  unique (obra_id, id),
  unique (empresa_id, folio),
  check (estado not in ('autorizada', 'facturada') or autorizada_en is not null),
  check (estado <> 'facturada' or facturada_en is not null),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, aviso_id) references public.avisos (obra_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.ordenes_cambio (empresa_id, obra_id);

-- 💲
create table public.ordenes_cambio_montos (
  orden_cambio_id uuid primary key,
  empresa_id uuid not null,
  costo_estimado numeric(12, 2) not null check (costo_estimado >= 0),
  precio_cliente numeric(12, 2) not null check (precio_cliente > 0),
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  foreign key (empresa_id, orden_cambio_id) references public.ordenes_cambio (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);

-- 💲 Costo de no calidad: retrabajo por error propio, y reclamos de garantía con su ciclo de vida.
create table public.no_calidad (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  folio text not null,
  obra_id uuid not null,
  tipo public.tipo_no_calidad not null,
  causa public.causa_no_calidad,
  subcontratista_id uuid,
  costo numeric(12, 2) not null default 0 check (costo >= 0),
  dias_perdidos integer not null default 0 check (dias_perdidos >= 0),
  descripcion text not null check (btrim(descripcion) <> ''),
  estado public.estado_abierto not null,
  cerrado_en timestamptz,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, folio),
  check ((estado = 'cerrado') = (cerrado_en is not null)),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (empresa_id, subcontratista_id) references public.subcontratistas (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.no_calidad (empresa_id, obra_id);

-- ------------------------------------------------------------------ cobros, entrega y cierre
-- 💲 Cobros al cliente.
create table public.cobros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  folio text not null,
  obra_id uuid not null,
  fecha date not null,
  concepto public.concepto_cobro not null default 'hito',
  monto numeric(12, 2) not null check (monto > 0),
  metodo public.metodo_pago not null,
  referencia text,
  estado public.estado_registro not null default 'vigente',
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, folio),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.cobros (empresa_id, obra_id);

-- Acta de entrega: arranca la garantía y la cosecha comercial (fotos, reseña, referido, visita del mes 11).
create table public.entregas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null unique,
  fecha_entrega date not null,
  garantia_meses integer not null default 12 check (garantia_meses >= 0),
  garantia_vence date not null,
  autoriza_fotos boolean not null default false,
  resena_pedida boolean not null default false,
  resena_recibida boolean not null default false,
  referido_pedido boolean not null default false,
  visita_11m boolean not null default false,
  notas text,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  check (garantia_vence >= fecha_entrega),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.entregas (empresa_id);

-- 💲 La foto fija del cierre: lo que la obra fue, aunque después cambien tarifas o catálogo.
create table public.obras_cerradas (
  obra_id uuid primary key,
  empresa_id uuid not null,
  fecha_inicio date not null,
  fecha_fin_real date not null,
  dias_ciclo integer not null check (dias_ciclo >= 0),
  contrato_original numeric(12, 2) not null,
  monto_oc numeric(12, 2) not null,
  contrato_final numeric(12, 2) not null,
  presupuestado numeric(12, 2) not null,
  materiales numeric(12, 2) not null,
  cuadrilla numeric(12, 2) not null,
  subcontratos numeric(12, 2) not null,
  costo_total numeric(12, 2) not null,
  margen_bruto numeric(8, 4),
  desviacion_estimacion numeric(8, 4),
  cobrado numeric(12, 2) not null,
  no_calidad numeric(12, 2) not null,
  dias_reportados integer not null check (dias_reportados >= 0),
  pies2 numeric(10, 2) not null,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  check (fecha_fin_real >= fecha_inicio),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.obras_cerradas (empresa_id);

-- 💲 Al cerrar una obra: el costo real de cada etapa de cada espacio, y por pie² (D-008). De aquí salen los
-- costos unitarios para cotizar.
create table public.historico_etapas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  espacio_id uuid not null,
  tipo_espacio_id uuid not null,
  etapa_id uuid,
  presupuestado numeric(12, 2) not null default 0,
  costo_real numeric(12, 2) not null,
  pies2 numeric(10, 2) not null,
  costo_por_pie2 numeric(12, 4),
  creado_en timestamptz not null default now(),
  unique nulls not distinct (espacio_id, etapa_id),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, espacio_id) references public.espacios (obra_id, id),
  foreign key (empresa_id, tipo_espacio_id) references public.tipos_espacio (empresa_id, id),
  foreign key (empresa_id, etapa_id) references public.etapas (empresa_id, id)
);
create index on public.historico_etapas (empresa_id, tipo_espacio_id, etapa_id);

-- Al cerrar una obra: cuántos días hábiles tomó de verdad cada partida.
create table public.historico_duraciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  partida_obra_id uuid not null unique,
  tipo_espacio_id uuid not null,
  plantilla_id uuid,
  dias_planeados integer not null,
  dias_reales integer not null check (dias_reales >= 1),
  creado_en timestamptz not null default now(),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, partida_obra_id) references public.partidas_obra (obra_id, id),
  foreign key (empresa_id, tipo_espacio_id) references public.tipos_espacio (empresa_id, id),
  foreign key (empresa_id, plantilla_id) references public.plantillas_partida (empresa_id, id)
);
create index on public.historico_duraciones (empresa_id, tipo_espacio_id);

-- ------------------------------------------------------------------ correcciones
-- Nada se borra (regla 4): cada edición, anulación o registro tardío deja aquí quién, qué, cuándo, antes,
-- después y por qué. Solo la escribe el servidor.
create table public.correcciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  tabla text not null,
  registro_id uuid not null,
  accion public.accion_correccion not null,
  campo text,
  antes text,
  despues text,
  motivo text not null check (length(btrim(motivo)) >= 5),
  creado_en timestamptz not null default now(),
  creado_por uuid,
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.correcciones (empresa_id, tabla, registro_id);

-- ------------------------------------------------------------------ RLS y auditoría en todas las tablas
-- RLS activado sin políticas: nadie con sesión de usuario lee ni escribe nada todavía. Las políticas llegan en
-- el paso 4. Una prueba (pnpm test:rls) falla si alguna tabla de public queda sin RLS.
do $$
declare
  t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
  for t in select table_name from information_schema.columns
           where table_schema = 'public' and column_name = 'actualizado_en' loop
    execute format('create trigger fijar_actualizado_en before update on public.%I
                    for each row execute function public.fijar_actualizado_en()', t.table_name);
  end loop;
end $$;
