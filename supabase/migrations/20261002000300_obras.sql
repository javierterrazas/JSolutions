-- Paso 2 · 3 de 4 · Obras, espacios, partidas, presupuesto y lo que registra el PM en obra.

-- ------------------------------------------------------------------ obras
create table public.obras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  folio text not null,
  cliente text not null check (btrim(cliente) <> ''),
  telefono_cliente text not null check (length(regexp_replace(telefono_cliente, '\D', '', 'g')) >= 10),
  direccion text not null check (btrim(direccion) <> ''),
  pm_id uuid not null,
  fecha_inicio date not null,
  fecha_fin_estimada date not null,
  fecha_fin_real date,
  estado public.estado_obra not null default 'sin_presupuesto',
  notas text,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, id),
  unique (empresa_id, folio),
  check (fecha_fin_estimada >= fecha_inicio),
  check (fecha_fin_real is null or fecha_fin_real >= fecha_inicio),
  foreign key (empresa_id, pm_id) references public.miembros (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.obras (empresa_id, estado);
create index on public.obras (pm_id);

-- 💲 El contrato con el cliente. Separado de obras porque el PM lee obras (D-002).
create table public.obras_finanzas (
  obra_id uuid primary key,
  empresa_id uuid not null,
  contrato_original numeric(12, 2) not null check (contrato_original > 0),
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);

-- El espacio es la unidad técnica (secuencia, pies², costos, calidad); la obra, la comercial.
-- Dos medidas (D-014): la cotizada, del alta, y la verificada en sitio por el PM. La vigente es la verificada
-- cuando existe.
create table public.espacios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  tipo_espacio_id uuid not null,
  nombre text not null check (btrim(nombre) <> ''),
  orden integer not null default 0,
  pies2_cotizados numeric(10, 2) not null default 0 check (pies2_cotizados >= 0),
  pies_lineales_cotizados numeric(10, 2) not null default 0 check (pies_lineales_cotizados >= 0),
  pies2_verificados numeric(10, 2) check (pies2_verificados > 0),
  pies_lineales_verificados numeric(10, 2) check (pies_lineales_verificados >= 0),
  verificado_por uuid,
  verificado_en timestamptz,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, id),
  unique (obra_id, id),
  check ((pies2_verificados is null) = (verificado_en is null)),
  check ((verificado_por is null) = (verificado_en is null)),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (empresa_id, tipo_espacio_id) references public.tipos_espacio (empresa_id, id),
  foreign key (empresa_id, verificado_por) references public.miembros (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.espacios (empresa_id, obra_id);

-- Las partidas propias de cada espacio: la copia de la plantilla al crearse, más las que se agreguen solo para
-- esta obra. Nunca se borran: una partida que no se hará queda "quitada".
create table public.partidas_obra (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  espacio_id uuid not null,
  plantilla_id uuid,
  orden integer not null default 0,
  nombre_es text not null check (btrim(nombre_es) <> ''),
  nombre_en text,
  hito_id uuid,
  peso numeric(6, 2) not null default 1 check (peso > 0),
  dias integer not null default 1 check (dias >= 1),
  responsable public.responsable_partida not null default 'cuadrilla',
  oficio_id uuid,
  paralelo boolean not null default false,
  espera integer not null default 0 check (espera >= 0),
  etapa_id uuid,
  estado public.estado_partida not null default 'activa',
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, id),
  unique (obra_id, id),
  unique (espacio_id, id),
  check ((responsable = 'subcontratista') = (oficio_id is not null)),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, espacio_id) references public.espacios (obra_id, id),
  foreign key (empresa_id, plantilla_id) references public.plantillas_partida (empresa_id, id),
  foreign key (empresa_id, hito_id) references public.hitos_calidad (empresa_id, id),
  foreign key (empresa_id, oficio_id) references public.oficios (empresa_id, id),
  foreign key (empresa_id, etapa_id) references public.etapas (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create unique index partidas_obra_nombre_unico
  on public.partidas_obra (espacio_id, lower(nombre_es)) where estado = 'activa';
create index on public.partidas_obra (empresa_id, obra_id);

-- 💲 El costo esperado por etapa y espacio (D-004). La cantidad no se guarda: son los pies² vigentes del espacio
-- (D-014). etapa_id nulo = "Otras partidas".
create table public.presupuesto_etapas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  espacio_id uuid not null,
  etapa_id uuid,
  monto numeric(12, 2) not null check (monto >= 0),
  notas text,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique nulls not distinct (espacio_id, etapa_id),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, espacio_id) references public.espacios (obra_id, id),
  foreign key (empresa_id, etapa_id) references public.etapas (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.presupuesto_etapas (empresa_id, obra_id);

-- Lo que el cronograma preveía terminar cada semana, congelado el lunes, para el cumplimiento semanal (PPC).
create table public.plan_semanal (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  semana date not null check (extract(isodow from semana) = 1),
  obra_id uuid not null,
  partida_obra_id uuid not null,
  fin_previsto date not null,
  creado_en timestamptz not null default now(),
  unique (semana, partida_obra_id),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, partida_obra_id) references public.partidas_obra (obra_id, id)
);
create index on public.plan_semanal (empresa_id, semana);

-- ------------------------------------------------------------------ lo que registra el PM

-- El cierre del día. dia es el día local de la obra en que se trabajó, aunque se envíe después (sin señal).
-- fotos_comprometidas: las que el PM dijo que subiría; las pendientes son esas menos las que llegaron (D-007).
create table public.bitacora (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  folio text not null,
  obra_id uuid not null,
  dia date not null,
  sin_trabajo boolean not null default false,
  motivo_sin_trabajo public.motivo_sin_trabajo,
  incidencia text,
  tardio boolean not null default false,
  fotos_comprometidas smallint not null default 0 check (fotos_comprometidas between 0 and 10),
  estado public.estado_registro not null default 'vigente',
  enviado_en timestamptz not null default now(),
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, id),
  unique (obra_id, id),
  unique (empresa_id, folio),
  check (sin_trabajo = (motivo_sin_trabajo is not null)),
  check (not sin_trabajo or fotos_comprometidas = 0),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
-- un solo cierre vigente por obra y día
create unique index bitacora_un_cierre_por_dia on public.bitacora (obra_id, dia) where estado = 'vigente';
create index on public.bitacora (empresa_id, obra_id, dia);

-- Las partidas en que se trabajó ese día.
create table public.bitacora_partidas (
  empresa_id uuid not null,
  obra_id uuid not null,
  bitacora_id uuid not null,
  partida_obra_id uuid not null,
  primary key (bitacora_id, partida_obra_id),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, bitacora_id) references public.bitacora (obra_id, id),
  foreign key (obra_id, partida_obra_id) references public.partidas_obra (obra_id, id)
);
create index on public.bitacora_partidas (empresa_id, obra_id);

-- Cada cambio de estado de una partida: en progreso o terminada. El estado actual sale de aquí.
create table public.avance (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  partida_obra_id uuid not null,
  bitacora_id uuid,
  estado public.estado_avance not null,
  dia date not null,
  estado_registro public.estado_registro not null default 'vigente',
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, partida_obra_id) references public.partidas_obra (obra_id, id),
  foreign key (obra_id, bitacora_id) references public.bitacora (obra_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.avance (empresa_id, obra_id);
create index on public.avance (partida_obra_id);

-- La cuadrilla propia. cantidad: horas si el trabajador cobra por hora; días (1 o 0.5) si cobra por día.
-- Los topes por día sumando obras (16 h, un día) cruzan renglones: los valida el servidor.
create table public.mano_obra (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  espacio_id uuid not null,
  partida_obra_id uuid,
  trabajador_id uuid not null,
  cantidad numeric(5, 2) not null check (cantidad > 0 and cantidad <= 16),
  dia date not null,
  bitacora_id uuid,
  estado public.estado_registro not null default 'vigente',
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, espacio_id) references public.espacios (obra_id, id),
  foreign key (espacio_id, partida_obra_id) references public.partidas_obra (espacio_id, id),
  foreign key (empresa_id, trabajador_id) references public.trabajadores (empresa_id, id),
  foreign key (obra_id, bitacora_id) references public.bitacora (obra_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.mano_obra (empresa_id, obra_id);
create index on public.mano_obra (trabajador_id, dia);

-- Todo gasto va a una obra. Sin partida, va al espacio de Generales de obra. El recibo es una foto.
-- origen 'oficina': lo que compra el dueño (gabinetes, appliances); el PM no lo ve ni cuenta contra su límite.
create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  folio text not null,
  obra_id uuid not null,
  espacio_id uuid not null,
  partida_obra_id uuid,
  dia date not null,
  categoria public.categoria_gasto not null default 'material',
  proveedor text not null check (btrim(proveedor) <> ''),
  descripcion text,
  monto numeric(12, 2) not null check (monto > 0),
  metodo_pago public.metodo_pago not null,
  tarjeta_ultimos4 text check (tarjeta_ultimos4 ~ '^[0-9]{4}$'),
  origen public.origen_gasto not null,
  revision public.revision_gasto,
  estado public.estado_registro not null default 'vigente',
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, folio),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, espacio_id) references public.espacios (obra_id, id),
  foreign key (espacio_id, partida_obra_id) references public.partidas_obra (espacio_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.gastos (empresa_id, obra_id);
create index on public.gastos (creado_por);

-- Avisos que el PM levanta en obra (en el legacy, Bloqueos). La respuesta del dueño lo cierra.
-- Si de un aviso sale una orden de cambio, la orden apunta al aviso (ordenes_cambio.aviso_id).
create table public.avisos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  folio text not null,
  obra_id uuid not null,
  tipo public.tipo_aviso not null,
  descripcion text not null check (length(btrim(descripcion)) >= 10),
  detiene_avance boolean not null default false,
  estado public.estado_abierto not null default 'abierto',
  respuesta text,
  respondido_en timestamptz,
  respondido_por uuid,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, id),
  unique (obra_id, id),
  unique (empresa_id, folio),
  check ((estado = 'cerrado') = (respondido_en is not null)),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (empresa_id, respondido_por) references public.miembros (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.avisos (empresa_id, obra_id);
create index on public.avisos (creado_por);

-- Inspección de un punto de control en un espacio. Manda la última de cada hito y espacio.
create table public.inspecciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  espacio_id uuid not null,
  hito_id uuid not null,
  partida_obra_id uuid,
  resultado public.resultado_inspeccion not null,
  puntos_ok integer not null check (puntos_ok >= 0),
  puntos_total integer not null check (puntos_total > 0),
  realizada_en timestamptz not null default now(),
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (obra_id, id),
  check (puntos_ok <= puntos_total),
  check ((resultado = 'aprobado') = (puntos_ok = puntos_total)),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, espacio_id) references public.espacios (obra_id, id),
  foreign key (empresa_id, hito_id) references public.hitos_calidad (empresa_id, id),
  foreign key (espacio_id, partida_obra_id) references public.partidas_obra (espacio_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.inspecciones (empresa_id, obra_id);
create index on public.inspecciones (espacio_id, hito_id, realizada_en);

-- La respuesta a cada pregunta. texto_es guarda la pregunta como estaba ese día: editar el catálogo no cambia
-- una inspección pasada.
create table public.inspeccion_respuestas (
  empresa_id uuid not null,
  obra_id uuid not null,
  inspeccion_id uuid not null,
  punto_control_id uuid not null,
  texto_es text not null,
  respuesta public.respuesta_punto not null,
  primary key (inspeccion_id, punto_control_id),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, inspeccion_id) references public.inspecciones (obra_id, id),
  foreign key (empresa_id, punto_control_id) references public.puntos_control (empresa_id, id)
);
create index on public.inspeccion_respuestas (empresa_id, obra_id);

-- Prueba de inundación de 24 h. Las fotos del nivel de agua: índice 1 al inicio, 2 al final.
create table public.pruebas_agua (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  espacio_id uuid not null,
  inicio timestamptz not null default now(),
  fin timestamptz,
  resultado public.estado_prueba_agua not null default 'en_curso',
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  check ((resultado = 'en_curso') = (fin is null)),
  check (fin is null or fin > inicio),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, espacio_id) references public.espacios (obra_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create unique index pruebas_agua_una_en_curso on public.pruebas_agua (espacio_id) where resultado = 'en_curso';
create index on public.pruebas_agua (empresa_id, obra_id);

-- Lo que señala el cliente en el recorrido de entrega.
create table public.punch_list (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  folio text not null,
  obra_id uuid not null,
  item text not null check (length(btrim(item)) >= 4),
  origen public.origen_punch not null default 'defecto',
  responsable text,
  fecha_compromiso date not null,
  estado public.estado_abierto not null default 'abierto',
  cerrado_en timestamptz,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, folio),
  check ((estado = 'cerrado') = (cerrado_en is not null)),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.punch_list (empresa_id, obra_id);

-- Todas las fotos (D-007). ref_id apunta al registro de la tabla que indica ref_tipo. El número (indice) hace que
-- un reintento sin señal nunca duplique una foto. Los archivos viven en Supabase Storage: empresa/obra/…
create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  ref_tipo public.tipo_foto not null,
  ref_id uuid not null,
  indice smallint not null check (indice >= 1),
  storage_path text not null unique,
  tomada_en timestamptz,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  unique (ref_tipo, ref_id, indice),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.fotos (empresa_id, obra_id);
