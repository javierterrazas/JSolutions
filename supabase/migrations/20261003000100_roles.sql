-- Paso 3 · Quién es el usuario de la sesión: su miembro, su empresa, su rol y sus obras. Y los dispositivos
-- verificados donde el PM entra con su PIN (D-024).
--
-- Las funciones leen `miembros` en cada consulta, no los datos guardados en la sesión de Auth: dar de baja a
-- alguien (o desactivar su empresa) le corta el acceso en ese instante, como en el legacy (D-016).
--
-- Son `security definer` porque miembros y obras tienen RLS: sin eso, la política que llama a la función no
-- podría leer la tabla que necesita para decidir. Cada una devuelve solo lo del propio usuario.

-- El miembro de la sesión: activo y de una empresa activa. Nulo si no hay sesión o no pertenece a ninguna.
create function public.miembro_actual() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.id
  from public.miembros m
  join public.empresas e on e.id = m.empresa_id
  where m.user_id = auth.uid() and m.activo and e.activa
$$;

create function public.empresa_actual() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.empresa_id
  from public.miembros m
  join public.empresas e on e.id = m.empresa_id
  where m.user_id = auth.uid() and m.activo and e.activa
$$;

create function public.rol_actual() returns public.rol_miembro
language sql stable security definer set search_path = '' as $$
  select m.rol
  from public.miembros m
  join public.empresas e on e.id = m.empresa_id
  where m.user_id = auth.uid() and m.activo and e.activa
$$;

-- Dueño y administrador ven todo el negocio de su empresa, dinero incluido.
create function public.es_dueno_o_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.rol_actual() in ('dueno', 'admin'), false)
$$;

-- El PM ve solo las obras que tiene asignadas, mientras no se entreguen (como misObras_ del legacy: sin
-- presupuesto, lista para arranque, en obra y en cierre).
create function public.es_pm_de(p_obra uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.obras o
    where o.id = p_obra
      and o.pm_id = public.miembro_actual()
      and o.estado <> 'entregada'
      and public.rol_actual() = 'pm'
  )
$$;

revoke all on function public.miembro_actual() from public, anon;
revoke all on function public.empresa_actual() from public, anon;
revoke all on function public.rol_actual() from public, anon;
revoke all on function public.es_dueno_o_admin() from public, anon;
revoke all on function public.es_pm_de(uuid) from public, anon;
grant execute on function public.miembro_actual() to authenticated, service_role;
grant execute on function public.empresa_actual() to authenticated, service_role;
grant execute on function public.rol_actual() to authenticated, service_role;
grant execute on function public.es_dueno_o_admin() to authenticated, service_role;
grant execute on function public.es_pm_de(uuid) to authenticated, service_role;

-- ------------------------------------------------------------------ dispositivos verificados (D-024)
-- El celular donde un miembro verificó su identidad (con el enlace o código de su invitación). En ese
-- dispositivo entra con su PIN. El PIN se guarda solo como hash (pgcrypto) y tiene límite de intentos: 5 fallidos
-- seguidos bloquean 15 minutos, como en el legacy. El flujo completo llega con las pantallas de la fase 2.
create table public.dispositivos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  miembro_id uuid not null,
  nombre text not null check (btrim(nombre) <> ''),
  pin_hash text,
  intentos_fallidos integer not null default 0 check (intentos_fallidos >= 0),
  bloqueado_hasta timestamptz,
  verificado_en timestamptz not null default now(),
  ultimo_uso timestamptz,
  revocado_en timestamptz,
  revocado_por uuid,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check ((revocado_en is null) = (revocado_por is null)),
  foreign key (empresa_id, miembro_id) references public.miembros (empresa_id, id),
  foreign key (empresa_id, revocado_por) references public.miembros (empresa_id, id)
);
create index on public.dispositivos (empresa_id, miembro_id);

alter table public.dispositivos enable row level security;
create trigger fijar_actualizado_en before update on public.dispositivos
  for each row execute function public.fijar_actualizado_en();
