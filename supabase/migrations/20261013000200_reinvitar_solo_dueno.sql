-- Quién reinvita a quién (D-055; revisión de seguridad de la fase 2). Reinvitar a alguien y canjear uno mismo esa
-- invitación es entrar como esa persona. Un administrador podía hacerlo con el dueño (y quedar como dueño) o con otro
-- administrador. Ahora al dueño y a los administradores solo los reinvita el dueño; cada uno puede reinvitarse a sí
-- mismo (un celular nuevo). A los PMs, el dueño o un administrador, como antes. El rastro queda en
-- invitaciones.creado_por y en el celular nuevo.
create or replace function public.reinvitar(p_miembro uuid, p_token text, p_expira timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.miembros;
begin
  if not public.es_dueno_o_admin() then
    raise exception 'solo_dueno' using errcode = '42501';
  end if;
  select * into m from public.miembros
    where id = p_miembro and empresa_id = public.empresa_actual() and activo;
  if not found then
    raise exception 'miembro_no_activo';
  end if;
  if m.rol <> 'pm' and m.id <> public.miembro_actual() and public.rol_actual() <> 'dueno' then
    raise exception 'miembro_invalido';
  end if;
  update public.invitaciones set anulada_en = now()
    where miembro_id = p_miembro and usada_en is null and anulada_en is null;
  insert into public.invitaciones (empresa_id, miembro_id, token_hash, expira_en)
    values (public.empresa_actual(), p_miembro, public.hash_secreto(p_token), p_expira);
end $$;
