-- Paso 2 · 2 de 4 · Catálogo: tipos de espacio, oficios, etapas, puntos de control, plantillas de partidas,
-- subcontratistas y cuadrilla.
--
-- Lo que captura cada empresa y se muestra a las personas va en los dos idiomas: nombre_es y nombre_en (D-015).
-- Se muestra el del idioma del usuario y, si falta, el otro. nombre_es es obligatorio porque el negocio piloto
-- captura en español; nombre_en es opcional.

-- Baño, Cocina, Closet… y "Generales de obra", el espacio que toda obra tiene para lo que no es de un espacio
-- (protección, permisos, contenedor, limpieza final). Antes era el texto 'Generales'.
create table public.tipos_espacio (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  nombre_es text not null check (btrim(nombre_es) <> ''),
  nombre_en text,
  es_generales boolean not null default false,
  orden integer not null default 0,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create unique index tipos_espacio_nombre_unico on public.tipos_espacio (empresa_id, lower(nombre_es));
create unique index tipos_espacio_un_generales on public.tipos_espacio (empresa_id) where es_generales;

-- Oficios de los subcontratistas y de las partidas que hace un sub (Plomería, Eléctrico, Tile…).
-- requiere_licencia: en Texas, plomería, electricidad y HVAC. El legacy lo deducía del nombre con una expresión.
create table public.oficios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  nombre_es text not null check (btrim(nombre_es) <> ''),
  nombre_en text,
  requiere_licencia boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create unique index oficios_nombre_unico on public.oficios (empresa_id, lower(nombre_es));

-- Etapas del presupuesto: una por tipo de trabajo (Demolición, Plomería, Tile…). Una partida sin etapa cae en
-- "Otras partidas", que no es un renglón: es etapa_id nulo.
create table public.etapas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  nombre_es text not null check (btrim(nombre_es) <> ''),
  nombre_en text,
  orden integer not null default 0,
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create unique index etapas_nombre_unico on public.etapas (empresa_id, lower(nombre_es));

-- Puntos de control de calidad: PC1 Post demolición … PC5 Pre-entrega. exige_prueba_agua marca el punto que no
-- se aprueba sin la prueba de inundación de 24 h (en el legacy, el que empezaba con "PC3").
create table public.hitos_calidad (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  clave text not null check (btrim(clave) <> ''),
  nombre_es text not null check (btrim(nombre_es) <> ''),
  nombre_en text,
  orden integer not null default 0,
  exige_prueba_agua boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, id),
  unique (empresa_id, clave),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);

-- Las preguntas de cada punto de control.
create table public.puntos_control (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  hito_id uuid not null,
  orden integer not null default 0,
  texto_es text not null check (btrim(texto_es) <> ''),
  texto_en text,
  requiere_foto boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, hito_id) references public.hitos_calidad (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create unique index puntos_control_texto_unico on public.puntos_control (hito_id, lower(texto_es));

-- Las partidas de cada tipo de espacio. Al crearse un espacio se copian a partidas_obra: editar la plantilla no
-- afecta obras en curso.
create table public.plantillas_partida (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  tipo_espacio_id uuid not null,
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
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, id),
  check ((responsable = 'subcontratista') = (oficio_id is not null)),
  foreign key (empresa_id, tipo_espacio_id) references public.tipos_espacio (empresa_id, id),
  foreign key (empresa_id, hito_id) references public.hitos_calidad (empresa_id, id),
  foreign key (empresa_id, oficio_id) references public.oficios (empresa_id, id),
  foreign key (empresa_id, etapa_id) references public.etapas (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create unique index plantillas_partida_nombre_unico
  on public.plantillas_partida (tipo_espacio_id, lower(nombre_es)) where activa;

-- Subcontratistas. Nunca se borran: su historial vive en órdenes y pagos.
create table public.subcontratistas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  nombre text not null check (btrim(nombre) <> ''),
  oficio_id uuid not null,
  telefono text,
  contacto text,
  correo text,
  seguro_vence date,
  licencia text,
  licencia_vence date,
  w9 boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, oficio_id) references public.oficios (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
-- dos altas con el mismo nombre parten su historial en dos
create unique index subcontratistas_nombre_unico on public.subcontratistas (empresa_id, lower(btrim(nombre)));

-- La cuadrilla propia. El PM necesita tipo_pago (para ofrecer día completo o medio día), nunca la tarifa.
create table public.trabajadores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  nombre text not null check (btrim(nombre) <> ''),
  puesto text,
  tipo_pago public.tipo_pago not null,
  telefono text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);

-- 💲 La tarifa, por hora o por día según tipo_pago, con su historia: un aumento no cambia el costo de lo pasado.
create table public.tarifas_trabajador (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  trabajador_id uuid not null,
  tarifa numeric(12, 2) not null check (tarifa >= 0),
  vigente_desde date not null,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (trabajador_id, vigente_desde),
  foreign key (empresa_id, trabajador_id) references public.trabajadores (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);

create index on public.tipos_espacio (empresa_id);
create index on public.oficios (empresa_id);
create index on public.etapas (empresa_id);
create index on public.hitos_calidad (empresa_id);
create index on public.puntos_control (empresa_id, hito_id);
create index on public.plantillas_partida (empresa_id, tipo_espacio_id);
create index on public.subcontratistas (empresa_id);
create index on public.trabajadores (empresa_id);
create index on public.tarifas_trabajador (empresa_id, trabajador_id);
