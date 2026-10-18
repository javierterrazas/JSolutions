-- Se quitan las versiones de antes de invitar_pm y plataforma_alta_empresa, sin celular (D-083 las dejó mientras la
-- app que las usaba seguía publicada; D-096). Las de ahora las llamaban por dentro: primero se reescriben con todo su
-- cuerpo, y después se borran las viejas. Mismas firmas que las de ahora, así que sus permisos se quedan.

-- Invitar a un PM, con su celular y, si lo dan, su correo. El usuario de Auth ya lo creó el servidor.
create or replace function public.invitar_pm(p_user_id uuid, p_nombre text, p_idioma public.idioma, p_token text,
                                             p_expira timestamptz, p_telefono text, p_correo text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  nuevo uuid;
begin
  if not public.es_dueno_o_admin() then
    raise exception 'solo_dueno' using errcode = '42501';
  end if;
  -- un usuario, una empresa (D-016): se revisa en todas, aunque el dueño solo vea la suya
  if exists (select 1 from public.miembros where user_id = p_user_id) then
    raise exception 'correo_ya_registrado';
  end if;
  insert into public.miembros (empresa_id, user_id, rol, nombre, idioma, telefono, correo_avisos)
    values (public.empresa_actual(), p_user_id, 'pm', btrim(p_nombre), p_idioma, p_telefono,
            nullif(btrim(p_correo), ''))
    returning id into nuevo;
  insert into public.invitaciones (empresa_id, miembro_id, token_hash, expira_en)
    values (public.empresa_actual(), nuevo, public.hash_secreto(p_token), p_expira);
  return nuevo;
end $$;

-- El alta de una empresa con su dueño (con su celular y, si lo dan, su correo) y su suscripción, desde la plataforma.
create or replace function public.plataforma_alta_empresa(p_nombre text, p_ciudad text, p_zona text,
                                                          p_idioma public.idioma, p_dueno_user uuid,
                                                          p_dueno_nombre text, p_token text, p_expira timestamptz,
                                                          p_plan text, p_precio numeric, p_ciclo text,
                                                          p_en_prueba boolean, p_vence_el date, p_telefono text,
                                                          p_correo text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  emp uuid;
  yo text[];
begin
  perform plataforma.exigir_admin();
  -- un usuario, una empresa (D-016)
  if exists (select 1 from public.miembros where user_id = p_dueno_user) then
    raise exception 'correo_ya_registrado';
  end if;
  yo := plataforma.soltar_identidad();
  emp := public.alta_empresa(p_nombre, p_ciudad, p_zona, p_idioma, p_dueno_user, p_dueno_nombre, p_token, p_expira);
  insert into public.marcas_empresa (empresa_id) values (emp) on conflict do nothing;
  insert into public.suscripciones (empresa_id, plan, precio, ciclo, en_prueba, vence_el)
    values (emp, p_plan, p_precio, p_ciclo, p_en_prueba, p_vence_el);
  update public.miembros set telefono = p_telefono, correo_avisos = nullif(btrim(p_correo), '')
    where empresa_id = emp and user_id = p_dueno_user;
  perform plataforma.recuperar_identidad(yo);
  return emp;
end $$;

drop function public.invitar_pm(uuid, text, public.idioma, text, timestamptz);
drop function public.plataforma_alta_empresa(text, text, text, public.idioma, uuid, text, text, timestamptz, text,
                                             numeric, text, boolean, date);
