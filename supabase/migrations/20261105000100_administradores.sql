-- Los administradores de una empresa (D-112). El rol ya existía (todo lo del dueño, menos lo que es solo suyo), pero
-- solo se invitaban PMs. Ahora el dueño invita administradores y cambia a alguien de PM a administrador o al revés; un
-- administrador sigue invitando PMs. Lo que un administrador no hace (para no quitarle el control al dueño ni darse de
-- alta a otros): invitar administradores, cambiar roles, dar de baja a otro administrador ni quitarle el celular al
-- dueño o a otro administrador. Reinvitar ya lo cuidaba (20261013000200).

-- invitar a alguien con su rol: PM (el dueño o un administrador) o administrador (solo el dueño)
create function public.invitar_miembro(p_user_id uuid, p_nombre text, p_idioma public.idioma, p_token text,
                                       p_expira timestamptz, p_telefono text, p_correo text,
                                       p_rol public.rol_miembro)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  nuevo uuid;
begin
  if not public.es_dueno_o_admin() then
    raise exception 'solo_dueno' using errcode = '42501';
  end if;
  if p_rol = 'dueno' or (p_rol = 'admin' and public.rol_actual() <> 'dueno') then
    raise exception 'solo_el_dueno' using errcode = 'P0001';
  end if;
  -- un usuario, una empresa (D-016)
  if exists (select 1 from public.miembros where user_id = p_user_id) then
    raise exception 'correo_ya_registrado';
  end if;
  insert into public.miembros (empresa_id, user_id, rol, nombre, idioma, telefono, correo_avisos)
    values (public.empresa_actual(), p_user_id, p_rol, btrim(p_nombre), p_idioma, p_telefono,
            nullif(btrim(p_correo), ''))
    returning id into nuevo;
  insert into public.invitaciones (empresa_id, miembro_id, token_hash, expira_en)
    values (public.empresa_actual(), nuevo, public.hash_secreto(p_token), p_expira);
  return nuevo;
end $$;

-- cambiar a alguien de PM a administrador o al revés: solo el dueño, nunca a sí mismo ni al dueño
create function public.cambiar_rol(p_miembro uuid, p_rol public.rol_miembro) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.rol_actual() is distinct from 'dueno' then
    raise exception 'solo_el_dueno' using errcode = 'P0001';
  end if;
  if p_rol = 'dueno' then
    raise exception 'miembro_invalido' using errcode = 'P0001';
  end if;
  update public.miembros set rol = p_rol
    where id = p_miembro and empresa_id = public.empresa_actual() and rol in ('pm', 'admin') and activo;
  if not found then
    raise exception 'miembro_invalido' using errcode = 'P0001';
  end if;
end $$;

-- dar de baja: a un administrador, solo el dueño
create or replace function public.cambiar_activo(p_miembro uuid, p_activo boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_dueno_o_admin() then
    raise exception 'solo_dueno' using errcode = '42501';
  end if;
  update public.miembros set activo = p_activo
    where id = p_miembro and empresa_id = public.empresa_actual() and rol <> 'dueno'
      and id <> public.miembro_actual()
      and (rol = 'pm' or public.rol_actual() = 'dueno');
  if not found then
    raise exception 'miembro_invalido';
  end if;
end $$;

-- quitar un celular: el propio, o el de un PM; el del dueño o de un administrador, solo el dueño
create or replace function public.revocar_dispositivo(p_dispositivo uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.dispositivos;
begin
  select dv.* into d from public.dispositivos dv
    join public.miembros m on m.id = dv.miembro_id
    where dv.id = p_dispositivo and dv.empresa_id = public.empresa_actual() and dv.revocado_en is null
      and (dv.miembro_id = public.miembro_actual()
           or (public.es_dueno_o_admin() and (m.rol = 'pm' or public.rol_actual() = 'dueno')))
    for update of dv;
  if not found then
    raise exception 'dispositivo_invalido';
  end if;
  update public.dispositivos
    set revocado_en = now(), revocado_por = public.miembro_actual(), desbloqueado_hasta = null
    where id = d.id;
  -- cerrar su sesión de Auth es un refuerzo: el celular ya no entra porque estado_dispositivo lo ve revocado
  if d.sesion_id is not null then
    begin
      delete from auth.sessions where id = d.sesion_id;
    exception when insufficient_privilege then
      raise warning 'No se pudo cerrar la sesión de Auth % del dispositivo %', d.sesion_id, d.id;
    end;
  end if;
end $$;

revoke all on function public.invitar_miembro(uuid, text, public.idioma, text, timestamptz, text, text,
                                              public.rol_miembro),
  public.cambiar_rol(uuid, public.rol_miembro)
  from public, anon, authenticated, servidor_app;
grant execute on function public.invitar_miembro(uuid, text, public.idioma, text, timestamptz, text, text,
                                                 public.rol_miembro),
  public.cambiar_rol(uuid, public.rol_miembro)
  to servidor_app;
