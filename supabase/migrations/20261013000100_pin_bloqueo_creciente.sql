-- El bloqueo del PIN crece (D-055; revisión de seguridad de la fase 2): 5 intentos fallidos seguidos bloquean
-- 15 minutos, como el legacy; pero el bloqueo se reiniciaba cada 15 minutos, y con el celular en la mano se podían
-- probar 20 PIN por hora. Ahora cada bloqueo seguido, sin un PIN bueno entre ellos, dura más: 15 minutos, 1 hora y
-- después 24 horas. Un PIN bueno vuelve a empezar la cuenta.
alter table public.dispositivos
  add column bloqueos smallint not null default 0 check (bloqueos >= 0);

-- Igual que en 20261007000100_acceso.sql, salvo cuánto dura el bloqueo. Se reemplaza con la misma firma: conserva
-- quién puede ejecutarla.
create or replace function public.entrar_con_pin(p_dispositivo uuid, p_secreto text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.dispositivos;
  rol public.rol_miembro := public.rol_actual();
  hasta timestamptz;
  intentos integer;
begin
  select * into d from public.dispositivos
    where id = (public.mi_dispositivo(p_dispositivo, p_secreto)).id
    for update;
  if not found then
    return jsonb_build_object('resultado', 'dispositivo_invalido');
  end if;
  if d.pin_hash is null then
    return jsonb_build_object('resultado', 'sin_pin');
  end if;
  if d.bloqueado_hasta > now() then
    return jsonb_build_object('resultado', 'pin_bloqueado', 'hasta', d.bloqueado_hasta);
  end if;
  if d.pin_hash = extensions.crypt(p_secreto || ':' || coalesce(p_pin, ''), d.pin_hash) then
    hasta := now() + make_interval(hours => public.horas_desbloqueo(rol));
    update public.dispositivos
      set intentos_fallidos = 0, bloqueos = 0, bloqueado_hasta = null, desbloqueado_hasta = hasta,
          ultimo_uso = now()
      where id = d.id;
    return jsonb_build_object('resultado', 'ok', 'hasta', hasta);
  end if;
  intentos := d.intentos_fallidos + 1;
  if intentos >= 5 then
    hasta := now() + case d.bloqueos when 0 then interval '15 minutes' when 1 then interval '1 hour'
                                      else interval '24 hours' end;
    update public.dispositivos
      set intentos_fallidos = 0, bloqueos = least(d.bloqueos + 1, 100), bloqueado_hasta = hasta,
          desbloqueado_hasta = null
      where id = d.id;
    return jsonb_build_object('resultado', 'pin_bloqueado', 'hasta', hasta);
  end if;
  update public.dispositivos set intentos_fallidos = intentos, desbloqueado_hasta = null where id = d.id;
  return jsonb_build_object('resultado', 'pin_incorrecto', 'quedan', 5 - intentos);
end $$;
