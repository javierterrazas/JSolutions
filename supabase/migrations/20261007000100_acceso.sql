-- Fase 2, paso 2 · Entrar: la invitación, el dispositivo verificado y el PIN (D-024, D-038).
--
-- El dueño invita: da de alta al miembro y crea una invitación de un solo uso. El invitado la abre en SU celular y
-- la canjea: ese celular queda verificado con una llave secreta que solo él guarda (una cookie), y ahí elige su
-- PIN. Desde entonces el celular entra con su llave y su PIN, y el PIN abre la sesión por una jornada.
--
-- El PIN se guarda cifrado JUNTO CON la llave del celular: sin el celular, el PIN no sirve, y con la base sola no
-- se puede adivinar (la llave son 32 bytes al azar). 5 intentos fallidos bloquean 15 minutos, como en el legacy.
--
-- Los rechazos que el servidor traduce a errores de negocio salen con su código como mensaje (SQLSTATE P0001):
-- correo_ya_registrado, miembro_no_activo, miembro_invalido, dispositivo_invalido, pin_ya_fijado, pin_invalido.
--
-- Todo lo de este archivo se hace con funciones (security definer): tocan columnas que nadie lee (la llave, el PIN,
-- los intentos) y cada una revisa por su cuenta a quién atiende. Solo servidor_app las ejecuta; la API, ninguna.
-- Las constantes repiten las de packages/core/src/acceso.ts.

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------------ dispositivos: la llave y el desbloqueo
alter table public.dispositivos
  add column secreto_hash text unique check (secreto_hash ~ '^[0-9a-f]{64}$'),
  add column desbloqueado_hasta timestamptz,
  add column sesion_id uuid;
-- Las columnas nuevas no se dan a nadie: authenticated y servidor_app solo leen las columnas que ya tenían (D-025).
-- Y nadie escribe directo en miembros ni en dispositivos: solo las funciones de abajo.
revoke insert, update on public.miembros, public.dispositivos from servidor_app;

-- El hash de la llave del celular.
create function public.hash_secreto(p_secreto text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p_secreto, 'sha256'), 'hex')
$$;

-- ------------------------------------------------------------------ invitaciones
-- El enlace lleva un token al azar; aquí solo se guarda su hash. Vale 7 días y una sola vez.
create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  miembro_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expira_en timestamptz not null,
  usada_en timestamptz,
  dispositivo_id uuid references public.dispositivos (id),
  anulada_en timestamptz,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  check ((usada_en is null) = (dispositivo_id is null)),
  check (usada_en is null or anulada_en is null),
  foreign key (empresa_id, miembro_id) references public.miembros (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.invitaciones (empresa_id, miembro_id);
select public.preparar_tabla('public.invitaciones');
-- Nadie lee el hash del token, y nadie escribe directo: solo las funciones de abajo.
revoke all on public.invitaciones from authenticated, servidor_app;
grant select (id, empresa_id, miembro_id, expira_en, usada_en, dispositivo_id, anulada_en, creado_en, creado_por,
              actualizado_en)
  on public.invitaciones to authenticated;
create policy "dueno lee" on public.invitaciones for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));

-- ------------------------------------------------------------------ invitar
-- Da de alta a un PM e invita. El usuario de Auth (con su correo) ya lo creó el servidor con la API de Auth.
create function public.invitar_pm(p_user_id uuid, p_nombre text, p_idioma public.idioma, p_token text,
                                  p_expira timestamptz) returns uuid
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
  insert into public.miembros (empresa_id, user_id, rol, nombre, idioma)
    values (public.empresa_actual(), p_user_id, 'pm', btrim(p_nombre), p_idioma)
    returning id into nuevo;
  insert into public.invitaciones (empresa_id, miembro_id, token_hash, expira_en)
    values (public.empresa_actual(), nuevo, public.hash_secreto(p_token), p_expira);
  return nuevo;
end $$;

-- Una invitación nueva para un miembro que ya existe (un celular nuevo, o el suyo propio). Anula las pendientes.
create function public.reinvitar(p_miembro uuid, p_token text, p_expira timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_dueno_o_admin() then
    raise exception 'solo_dueno' using errcode = '42501';
  end if;
  if not exists (select 1 from public.miembros
                 where id = p_miembro and empresa_id = public.empresa_actual() and activo) then
    raise exception 'miembro_no_activo';
  end if;
  update public.invitaciones set anulada_en = now()
    where miembro_id = p_miembro and usada_en is null and anulada_en is null;
  insert into public.invitaciones (empresa_id, miembro_id, token_hash, expira_en)
    values (public.empresa_actual(), p_miembro, public.hash_secreto(p_token), p_expira);
end $$;

create function public.anular_invitacion(p_invitacion uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_dueno_o_admin() then
    raise exception 'solo_dueno' using errcode = '42501';
  end if;
  update public.invitaciones set anulada_en = now()
    where id = p_invitacion and empresa_id = public.empresa_actual() and usada_en is null and anulada_en is null;
end $$;

-- ------------------------------------------------------------------ canjear la invitación
-- Sin sesión todavía: el token es la prueba. Crea el dispositivo con el hash de la llave que generó el servidor y
-- devuelve a quién pertenece, para que el servidor le abra su sesión de Auth. Un token que no sirve (no existe, ya
-- se usó, se anuló, venció, o el miembro o su empresa están de baja) devuelve cero renglones, sin decir por qué.
create function public.canjear_invitacion(p_token text, p_secreto text, p_nombre text)
returns table (user_id uuid, correo text, dispositivo_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitaciones;
  m public.miembros;
  disp uuid;
begin
  select * into inv from public.invitaciones
    where token_hash = public.hash_secreto(p_token) and usada_en is null and anulada_en is null and expira_en > now()
    for update;
  if not found then
    return;
  end if;
  select mi.* into m from public.miembros mi join public.empresas e on e.id = mi.empresa_id
    where mi.id = inv.miembro_id and mi.activo and e.activa;
  if not found then
    return;
  end if;
  insert into public.dispositivos (empresa_id, miembro_id, nombre, secreto_hash)
    values (m.empresa_id, m.id, left(coalesce(nullif(btrim(p_nombre), ''), 'Celular'), 80),
            public.hash_secreto(p_secreto))
    returning id into disp;
  update public.invitaciones set usada_en = now(), dispositivo_id = disp where id = inv.id;
  return query select m.user_id, u.email::text, disp from auth.users u where u.id = m.user_id;
end $$;

-- La sesión de Auth que se abrió en ese celular, para cerrarla si se revoca (ya con la identidad del miembro).
create function public.fijar_sesion_dispositivo(p_dispositivo uuid, p_secreto text, p_sesion uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.dispositivos set sesion_id = p_sesion
    where id = p_dispositivo and miembro_id = public.miembro_actual() and revocado_en is null
      and secreto_hash = public.hash_secreto(p_secreto);
  if not found then
    raise exception 'dispositivo_invalido';
  end if;
end $$;

-- ------------------------------------------------------------------ el PIN
-- Cuántos dígitos lleva el PIN de un rol, y por cuántas horas abre la sesión.
create function public.largo_pin(p_rol public.rol_miembro) returns integer
language sql immutable set search_path = '' as $$
  select case p_rol when 'pm' then 4 else 6 end
$$;
create function public.horas_desbloqueo(p_rol public.rol_miembro) returns integer
language sql immutable set search_path = '' as $$
  select case p_rol when 'pm' then 16 else 12 end
$$;

-- El dispositivo del miembro de la sesión, si la llave es la suya y no está revocado.
create function public.mi_dispositivo(p_dispositivo uuid, p_secreto text) returns public.dispositivos
language sql stable security definer set search_path = '' as $$
  select d.* from public.dispositivos d
  where d.id = p_dispositivo and d.miembro_id = public.miembro_actual() and d.revocado_en is null
    and d.secreto_hash = public.hash_secreto(p_secreto)
$$;

-- El primer PIN del dispositivo. Abre la sesión de una vez. Cambiarlo después es pedir otra invitación.
create function public.fijar_pin(p_dispositivo uuid, p_secreto text, p_pin text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  d public.dispositivos := public.mi_dispositivo(p_dispositivo, p_secreto);
  rol public.rol_miembro := public.rol_actual();
  hasta timestamptz;
begin
  if d.id is null then
    raise exception 'dispositivo_invalido';
  end if;
  if d.pin_hash is not null then
    raise exception 'pin_ya_fijado';
  end if;
  if p_pin !~ ('^[0-9]{' || public.largo_pin(rol) || '}$') then
    raise exception 'pin_invalido';
  end if;
  hasta := now() + make_interval(hours => public.horas_desbloqueo(rol));
  update public.dispositivos
    set pin_hash = extensions.crypt(p_secreto || ':' || p_pin, extensions.gen_salt('bf', 8)),
        intentos_fallidos = 0, bloqueado_hasta = null, desbloqueado_hasta = hasta, ultimo_uso = now()
    where id = d.id;
  return hasta;
end $$;

-- Entrar con el PIN. Nunca lanza error por un PIN equivocado: devuelve el resultado, para que la transacción
-- confirme el intento fallido (con una excepción se revertiría, y el límite no contaría).
--   {resultado: 'ok', hasta} · {resultado: 'pin_incorrecto', quedan} · {resultado: 'pin_bloqueado', hasta}
--   · {resultado: 'dispositivo_invalido'} · {resultado: 'sin_pin'}
create function public.entrar_con_pin(p_dispositivo uuid, p_secreto text, p_pin text) returns jsonb
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
      set intentos_fallidos = 0, bloqueado_hasta = null, desbloqueado_hasta = hasta, ultimo_uso = now()
      where id = d.id;
    return jsonb_build_object('resultado', 'ok', 'hasta', hasta);
  end if;
  intentos := d.intentos_fallidos + 1;
  if intentos >= 5 then
    hasta := now() + interval '15 minutes';
    update public.dispositivos set intentos_fallidos = 0, bloqueado_hasta = hasta, desbloqueado_hasta = null
      where id = d.id;
    return jsonb_build_object('resultado', 'pin_bloqueado', 'hasta', hasta);
  end if;
  update public.dispositivos set intentos_fallidos = intentos, desbloqueado_hasta = null where id = d.id;
  return jsonb_build_object('resultado', 'pin_incorrecto', 'quedan', 5 - intentos);
end $$;

-- Cómo está el dispositivo, en cada petición: 'abierto', 'cerrado' (pide el PIN), 'sin_pin' (falta elegirlo) o
-- 'invalido' (no es de este miembro, la llave no coincide, se revocó, o el miembro o su empresa están de baja).
create function public.estado_dispositivo(p_dispositivo uuid, p_secreto text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  d public.dispositivos := public.mi_dispositivo(p_dispositivo, p_secreto);
begin
  if d.id is null then
    return 'invalido';
  end if;
  if d.pin_hash is null then
    return 'sin_pin';
  end if;
  if d.desbloqueado_hasta is null or d.desbloqueado_hasta <= now() then
    return 'cerrado';
  end if;
  if d.ultimo_uso is null or d.ultimo_uso < now() - interval '5 minutes' then
    update public.dispositivos set ultimo_uso = now() where id = d.id;
  end if;
  return 'abierto';
end $$;

-- Cerrar la sesión de este celular: la próxima vez pide el PIN.
create function public.cerrar_dispositivo(p_dispositivo uuid, p_secreto text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.dispositivos set desbloqueado_hasta = null
    where id = (public.mi_dispositivo(p_dispositivo, p_secreto)).id;
end $$;

-- ------------------------------------------------------------------ revocar y dar de baja
-- Quitar un celular: el dueño, cualquiera de su empresa; cada miembro, los suyos. Cierra también su sesión de Auth.
create function public.revocar_dispositivo(p_dispositivo uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.dispositivos;
begin
  select * into d from public.dispositivos
    where id = p_dispositivo and empresa_id = public.empresa_actual() and revocado_en is null
      and (miembro_id = public.miembro_actual() or public.es_dueno_o_admin())
    for update;
  if not found then
    raise exception 'dispositivo_invalido';
  end if;
  update public.dispositivos
    set revocado_en = now(), revocado_por = public.miembro_actual(), desbloqueado_hasta = null
    where id = d.id;
  -- Cerrar su sesión de Auth es un refuerzo: el celular ya no entra porque estado_dispositivo lo ve revocado. Si
  -- Supabase no deja a esta función tocar auth.sessions, se revoca igual.
  if d.sesion_id is not null then
    begin
      delete from auth.sessions where id = d.sesion_id;
    exception when insufficient_privilege then
      raise warning 'No se pudo cerrar la sesión de Auth % del dispositivo %', d.sesion_id, d.id;
    end;
  end if;
end $$;

-- Dar de baja o volver a activar a un miembro de la empresa. La baja corta el acceso en ese instante, porque
-- miembro_actual() solo ve miembros activos (D-016). El dueño no se da de baja, ni nadie a sí mismo.
create function public.cambiar_activo(p_miembro uuid, p_activo boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_dueno_o_admin() then
    raise exception 'solo_dueno' using errcode = '42501';
  end if;
  update public.miembros set activo = p_activo
    where id = p_miembro and empresa_id = public.empresa_actual() and rol <> 'dueno'
      and id <> public.miembro_actual();
  if not found then
    raise exception 'miembro_invalido';
  end if;
end $$;

-- Cada miembro elige su idioma; lo sigue en cualquier dispositivo.
create function public.cambiar_mi_idioma(p_idioma public.idioma) returns void
language sql security definer set search_path = '' as $$
  update public.miembros set idioma = p_idioma where id = public.miembro_actual()
$$;

-- ------------------------------------------------------------------ el alta de una empresa
-- La primera empresa y su dueño, con su invitación. La corre quien administra la plataforma con el service role
-- (scripts/alta-empresa.ts); ningún usuario da de alta empresas en las fases 1 a 3.
create function public.alta_empresa(p_nombre text, p_ciudad text, p_zona text, p_idioma public.idioma,
                                    p_dueno_user uuid, p_dueno_nombre text, p_token text, p_expira timestamptz)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  emp uuid;
  dueno uuid;
begin
  insert into public.empresas (nombre, ciudad, zona_horaria, idioma)
    values (btrim(p_nombre), nullif(btrim(p_ciudad), ''), p_zona, p_idioma)
    returning id into emp;
  insert into public.configuracion (empresa_id) values (emp);
  insert into public.miembros (empresa_id, user_id, rol, nombre, idioma)
    values (emp, p_dueno_user, 'dueno', btrim(p_dueno_nombre), p_idioma)
    returning id into dueno;
  insert into public.invitaciones (empresa_id, miembro_id, token_hash, expira_en)
    values (emp, dueno, public.hash_secreto(p_token), p_expira);
  return emp;
end $$;

-- ------------------------------------------------------------------ quién ejecuta qué
revoke all on function public.hash_secreto(text), public.invitar_pm(uuid, text, public.idioma, text, timestamptz),
  public.reinvitar(uuid, text, timestamptz), public.anular_invitacion(uuid),
  public.canjear_invitacion(text, text, text), public.fijar_sesion_dispositivo(uuid, text, uuid),
  public.largo_pin(public.rol_miembro), public.horas_desbloqueo(public.rol_miembro),
  public.mi_dispositivo(uuid, text), public.fijar_pin(uuid, text, text), public.entrar_con_pin(uuid, text, text),
  public.estado_dispositivo(uuid, text), public.cerrar_dispositivo(uuid, text), public.revocar_dispositivo(uuid),
  public.cambiar_activo(uuid, boolean), public.cambiar_mi_idioma(public.idioma),
  public.alta_empresa(text, text, text, public.idioma, uuid, text, text, timestamptz)
  from public, anon, authenticated, servidor_app;

grant execute on function public.invitar_pm(uuid, text, public.idioma, text, timestamptz),
  public.reinvitar(uuid, text, timestamptz), public.anular_invitacion(uuid),
  public.canjear_invitacion(text, text, text), public.fijar_sesion_dispositivo(uuid, text, uuid),
  public.fijar_pin(uuid, text, text), public.entrar_con_pin(uuid, text, text),
  public.estado_dispositivo(uuid, text), public.cerrar_dispositivo(uuid, text), public.revocar_dispositivo(uuid),
  public.cambiar_activo(uuid, boolean), public.cambiar_mi_idioma(public.idioma)
  to servidor_app;
grant execute on function public.alta_empresa(text, text, text, public.idioma, uuid, text, text, timestamptz)
  to service_role;
