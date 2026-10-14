-- La marca de cada empresa (D-078; lo pidió el dueño): su logo y su color, para que la app instalada en el teléfono
-- lleve el ícono y el nombre de la empresa que la usa, y el logo salga arriba de cada pantalla y en el portal del
-- cliente. Sin logo, el ícono son las iniciales de la empresa sobre su color.
create table public.marcas_empresa (
  empresa_id uuid primary key references public.empresas (id),
  color text not null default '#1d3557' check (color ~ '^#[0-9a-fA-F]{6}$'),
  -- el logo, tal cual se subió: PNG o JPEG de hasta 1 MB
  logo bytea check (logo is null or octet_length(logo) <= 1048576),
  logo_tipo text check (logo_tipo is null or logo_tipo in ('image/png', 'image/jpeg')),
  -- el ícono con el logo sobre blanco (casi todos los logos se hicieron para fondo blanco) o sobre el color
  fondo_blanco boolean not null default true,
  -- sube con cada cambio: va en las direcciones de los íconos para que el teléfono no use el viejo
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check ((logo is null) = (logo_tipo is null))
);
select public.preparar_tabla('public.marcas_empresa');

-- Todo miembro de la empresa la lee (el encabezado de cada pantalla); el dueño la crea y la cambia.
create policy "la empresa lee" on public.marcas_empresa for select to authenticated
  using (empresa_id = (select public.empresa_actual()));
create policy "dueno crea" on public.marcas_empresa for insert to servidor_app
  with check (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));
create policy "dueno edita" on public.marcas_empresa for update to servidor_app
  using (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()))
  with check (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));

-- Toda empresa nace con su marca (el color por omisión, sin logo).
insert into public.marcas_empresa (empresa_id) select id from public.empresas on conflict do nothing;

-- La marca de una empresa sin sesión: el teléfono pide el manifiesto y los íconos sin las cookies de la app, así que
-- van por el id de la empresa. Solo lo que se ve en la pantalla de inicio del teléfono: nombre, color y logo.
create function public.marca_publica(p_empresa uuid)
returns table (nombre text, color text, logo bytea, logo_tipo text, fondo_blanco boolean, version integer)
language sql stable security definer set search_path = '' as $$
  select e.nombre, coalesce(m.color, '#1d3557'), m.logo, m.logo_tipo, coalesce(m.fondo_blanco, true),
         coalesce(m.version, 1)
  from public.empresas e left join public.marcas_empresa m on m.empresa_id = e.id
  where e.id = p_empresa and e.activa
$$;

-- La empresa del enlace del portal del cliente (D-066), para mostrar su logo: si tiene y su versión.
create function public.empresa_portal_cliente(p_token text)
returns table (empresa_id uuid, con_logo boolean, version integer)
language sql stable security definer set search_path = '' as $$
  select en.empresa_id, m.logo is not null, coalesce(m.version, 1)
  from public.enlace_cliente_vigente(p_token) en
  left join public.marcas_empresa m on m.empresa_id = en.empresa_id
  where en.id is not null
$$;

revoke all on function public.marca_publica(uuid), public.empresa_portal_cliente(text)
  from public, anon, authenticated, servidor_app;
grant execute on function public.marca_publica(uuid), public.empresa_portal_cliente(text) to servidor_app;
