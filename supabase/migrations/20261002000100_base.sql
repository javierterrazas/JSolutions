-- Paso 2 · 1 de 4 · Tipos, empresas, configuración, miembros y folios.
--
-- Convenciones de todo el esquema (docs/MODELO_DE_DATOS.md):
--   · llave uuid; folio legible por empresa donde una persona lo lee o lo cita (D-005);
--   · empresa_id en toda tabla de negocio, y llaves foráneas COMPUESTAS (empresa_id, x_id): la base misma impide
--     que un registro de una empresa apunte a otra (D-003);
--   · lo que cuelga de una obra lleva obra_id, también con llaves compuestas (obra_id, x_id);
--   · dinero en numeric(12,2); días de negocio en date; momentos en timestamptz (D-006);
--   · nada se borra: los registros anulables llevan estado vigente/anulado (regla 4);
--   · creado_por es el miembro que capturó el registro; lo llena el servidor;
--   · RLS se activa en todas las tablas en la migración 4; las políticas llegan en el paso 4.

-- ------------------------------------------------------------------ tipos enumerados
create type public.rol_miembro as enum ('dueno', 'admin', 'pm');
create type public.idioma as enum ('es', 'en');
create type public.estado_registro as enum ('vigente', 'anulado');
create type public.estado_obra as enum ('sin_presupuesto', 'lista_para_arranque', 'en_obra', 'en_cierre', 'entregada');
create type public.tipo_pago as enum ('hora', 'dia');
create type public.responsable_partida as enum ('cuadrilla', 'pm', 'subcontratista');
create type public.estado_partida as enum ('activa', 'quitada');
create type public.estado_avance as enum ('en_progreso', 'terminada');
create type public.motivo_sin_trabajo as enum (
  'esperando_fabricacion', 'esperando_sub', 'esperando_material', 'esperando_inspeccion',
  'clima', 'cliente_no_disponible', 'otro');
create type public.categoria_gasto as enum ('material', 'renta_equipo', 'herramienta', 'permisos', 'disposicion', 'otro');
create type public.metodo_pago as enum ('transferencia', 'cheque', 'zelle', 'efectivo', 'tarjeta', 'tarjeta_empresa');
create type public.origen_gasto as enum ('pm', 'oficina');
create type public.revision_gasto as enum ('pendiente', 'revisado');
create type public.tipo_aviso as enum ('material', 'cliente', 'sub', 'condicion_oculta', 'diseno', 'otro');
create type public.estado_abierto as enum ('abierto', 'cerrado');
create type public.resultado_inspeccion as enum ('aprobado', 'con_defectos');
create type public.respuesta_punto as enum ('cumple', 'no_cumple', 'no_aplica');
create type public.estado_prueba_agua as enum ('en_curso', 'sin_fugas', 'con_fuga');
create type public.origen_punch as enum ('defecto', 'cambio_alcance', 'expectativa');
create type public.tipo_foto as enum ('bitacora', 'inspeccion', 'prueba_agua', 'aviso', 'punch', 'gasto', 'orden_cambio');
create type public.estado_orden_trabajo as enum ('emitida', 'confirmada', 'aprobada', 'pagada', 'cancelada');
create type public.concepto_pago_sub as enum ('anticipo', 'parcial', 'liquidacion');
create type public.estado_orden_cambio as enum ('propuesta', 'autorizada', 'rechazada', 'facturada');
create type public.motivo_orden_cambio as enum ('condicion_oculta', 'solicitud_cliente', 'cambio_seleccion');
create type public.tipo_no_calidad as enum ('retrabajo', 'garantia');
create type public.causa_no_calidad as enum (
  'error_instalacion', 'error_especificacion', 'error_estimacion', 'material_defectuoso', 'falta_supervision');
create type public.concepto_cobro as enum ('deposito', 'hito', 'orden_cambio', 'liquidacion', 'otro');
create type public.accion_correccion as enum ('editar', 'anular', 'agregar', 'quitar', 'dia_olvidado', 'medida_verificada');

-- ------------------------------------------------------------------ auditoría
create function public.fijar_actualizado_en() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

-- ------------------------------------------------------------------ empresas
create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> ''),
  ciudad text,
  zona_horaria text not null default 'America/Chicago',
  idioma public.idioma not null default 'es',
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Una fila por empresa. Los valores por defecto son los del libro del legacy (hoja Config).
create table public.configuracion (
  empresa_id uuid primary key references public.empresas (id),
  impuesto numeric(6, 4) not null default 0.0825 check (impuesto >= 0),
  limite_compra_pm numeric(12, 2) not null default 300 check (limite_compra_pm >= 0),
  sla_bloqueo_horas integer not null default 24 check (sla_bloqueo_horas > 0),
  sla_oc_horas integer not null default 48 check (sla_oc_horas > 0),
  umbral_oc_menor numeric(12, 2) not null default 200 check (umbral_oc_menor >= 0),
  margen_minimo_oc numeric(5, 4) not null default 0.35 check (margen_minimo_oc >= 0 and margen_minimo_oc < 1),
  horas_sin_recibo integer not null default 72 check (horas_sin_recibo > 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Metas de los 19 indicadores. Sin renglón, vale la meta del legacy (definida en packages/core).
create table public.metas_indicadores (
  empresa_id uuid not null references public.empresas (id),
  indicador text not null check (indicador ~ '^[a-z][a-z0-9_]*$'),
  meta numeric(12, 4) not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  primary key (empresa_id, indicador)
);

-- ------------------------------------------------------------------ miembros
-- Una empresa por usuario (D-016): user_id es único.
create table public.miembros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  user_id uuid not null unique references auth.users (id),
  rol public.rol_miembro not null,
  nombre text not null check (btrim(nombre) <> ''),
  telefono text,
  idioma public.idioma not null default 'es',
  activo boolean not null default true,
  tarjeta_ultimos4 text check (tarjeta_ultimos4 ~ '^[0-9]{4}$'),
  correo_avisos text check (correo_avisos like '%_@_%'),
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.miembros (empresa_id);

-- ------------------------------------------------------------------ folios
-- El siguiente número se toma dentro de la misma transacción que crea el registro (D-005).
create table public.folios (
  empresa_id uuid not null references public.empresas (id),
  prefijo text not null check (prefijo ~ '^[A-Z]{2,4}$'),
  ultimo integer not null default 0 check (ultimo >= 0),
  primary key (empresa_id, prefijo)
);

-- Devuelve el siguiente folio, por ejemplo OB-007 o BIT-0042. El renglón queda bloqueado hasta que termina la
-- transacción: dos escrituras simultáneas nunca reciben el mismo número, y si la transacción falla el número
-- no se consume.
create function public.siguiente_folio(p_empresa uuid, p_prefijo text, p_digitos integer default 4)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  insert into public.folios as f (empresa_id, prefijo, ultimo)
  values (p_empresa, p_prefijo, 1)
  on conflict (empresa_id, prefijo) do update set ultimo = f.ultimo + 1
  returning f.ultimo into n;
  return p_prefijo || '-' || lpad(n::text, greatest(p_digitos, length(n::text)), '0');
end $$;

-- Solo el servidor numera: los usuarios no llaman esta función directamente.
revoke all on function public.siguiente_folio(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.siguiente_folio(uuid, text, integer) to service_role;
