-- Por qué una invitación no se pudo canjear (D-115). Antes la app decía lo mismo en todos los casos ("pudo usarse
-- ya, vencer o anularse"), y el caso más común no era ninguno de esos: el invitado ya la había canjeado en ese mismo
-- celular, pero en otro navegador (dentro de WhatsApp, y luego en Safari o en la app instalada, que no comparten su
-- acceso), o tocó el botón dos veces. Ahora se distingue:
--   'tuya'     ya se canjeó, y justo en este navegador (su llave es la del celular que la canjeó, sin quitar): se
--              entra a la app en vez de mostrar un error;
--   'usada'    ya se canjeó en otro lado;
--   'anulada'  hay una invitación más nueva para esa persona;
--   'vencida'  pasaron sus 7 días;
--   'invalida' no existe, o la persona está dada de baja.
-- Corre sin sesión, como canjear_invitacion: el enlace es la prueba (sus 256 bits no se adivinan).
create function public.estado_invitacion(p_token text, p_dispositivo uuid, p_secreto text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  inv public.invitaciones;
begin
  select i.* into inv from public.invitaciones i
    join public.miembros m on m.id = i.miembro_id
    join public.empresas e on e.id = i.empresa_id
    where i.token_hash = public.hash_secreto(p_token) and m.activo and e.activa;
  if not found then
    return 'invalida';
  end if;
  if inv.usada_en is not null then
    if p_dispositivo is not null and exists (
      select 1 from public.dispositivos d
      where d.id = inv.dispositivo_id and d.id = p_dispositivo and d.revocado_en is null
        and d.secreto_hash = public.hash_secreto(coalesce(p_secreto, ''))) then
      return 'tuya';
    end if;
    return 'usada';
  end if;
  if inv.anulada_en is not null then
    return 'anulada';
  end if;
  if inv.expira_en <= now() then
    return 'vencida';
  end if;
  -- sin usar y vigente: se puede canjear (otra vez)
  return 'vigente';
end $$;

revoke all on function public.estado_invitacion(text, uuid, text) from public, anon, authenticated, servidor_app;
grant execute on function public.estado_invitacion(text, uuid, text) to servidor_app;
