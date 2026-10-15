-- El logo llena todo el ícono (D-082; lo pidió el dueño): sin margen ni fondo alrededor, así que ya no se elige el
-- fondo del ícono. Se quita fondo_blanco de la marca y de lo que se lee sin sesión.
drop function public.marca_publica(uuid);
alter table public.marcas_empresa drop column fondo_blanco;

create function public.marca_publica(p_empresa uuid)
returns table (nombre text, color text, logo bytea, logo_tipo text, version integer)
language sql stable security definer set search_path = '' as $$
  select e.nombre, coalesce(m.color, '#1d3557'), m.logo, m.logo_tipo, coalesce(m.version, 1)
  from public.empresas e left join public.marcas_empresa m on m.empresa_id = e.id
  where e.id = p_empresa and e.activa
$$;

revoke all on function public.marca_publica(uuid) from public, anon, authenticated, servidor_app;
grant execute on function public.marca_publica(uuid) to servidor_app;
