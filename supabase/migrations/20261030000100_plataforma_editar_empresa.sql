-- Editar una empresa desde la plataforma (D-097; lo pidió quien la administra): su nombre y su ciudad, y el nombre,
-- el celular y el correo de su dueño. Un celular que ya es de otro miembro, de cualquier empresa, no se acepta; el
-- dueño que entra con su celular no se queda sin él.
-- Devuelve el usuario de Auth del dueño, su correo de Auth y el celular que tenía: si cambió y la cuenta es de las
-- de celular (la dirección interna <dígitos>@celular.invalid), el servidor le cambia esa dirección con la API de Auth.
create function public.plataforma_editar_empresa(p_empresa uuid, p_nombre text, p_ciudad text, p_dueno_nombre text,
                                                 p_telefono text, p_correo text)
returns table (user_id uuid, correo_auth text, telefono_antes text)
language plpgsql security definer set search_path = '' as $$
declare
  m public.miembros;
  yo text[];
begin
  perform plataforma.exigir_admin();
  if btrim(coalesce(p_nombre, '')) = '' or btrim(coalesce(p_dueno_nombre, '')) = '' then
    raise exception 'faltan_datos';
  end if;
  select * into m from public.miembros
    where empresa_id = p_empresa and rol = 'dueno' and activo order by creado_en limit 1;
  if not exists (select 1 from public.empresas where id = p_empresa) then
    raise exception 'empresa_no_encontrada';
  end if;
  if m.id is null then
    raise exception 'sin_dueno';
  end if;
  -- las cuentas de celular entran con él: no se quedan sin celular (las de correo de antes, sí pueden)
  if p_telefono is null
     and exists (select 1 from auth.users u where u.id = m.user_id and u.email like '%@celular.invalid') then
    raise exception 'falta_celular';
  end if;
  if p_telefono is distinct from m.telefono
     and exists (select 1 from public.miembros x where x.telefono = p_telefono and x.id <> m.id) then
    raise exception 'celular_ya_registrado';
  end if;
  yo := plataforma.soltar_identidad();
  update public.empresas set nombre = btrim(p_nombre), ciudad = nullif(btrim(coalesce(p_ciudad, '')), '')
    where id = p_empresa;
  update public.miembros
    set nombre = btrim(p_dueno_nombre), telefono = p_telefono, correo_avisos = nullif(btrim(coalesce(p_correo, '')), '')
    where id = m.id;
  perform plataforma.recuperar_identidad(yo);
  return query select m.user_id, u.email::text, m.telefono from auth.users u where u.id = m.user_id;
end $$;

revoke all on function public.plataforma_editar_empresa(uuid, text, text, text, text, text)
  from public, anon, authenticated, servidor_app;
grant execute on function public.plataforma_editar_empresa(uuid, text, text, text, text, text) to servidor_app;
