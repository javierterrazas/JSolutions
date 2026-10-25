-- La checada con GPS y selfie (D-117): cada trabajador checa entrada y salida desde su celular, solo si está dentro
-- del perímetro de la obra (geocerca), con una selfie tomada en ese momento. Las checadas REEMPLAZAN la cuadrilla del
-- cierre del PM: cada salida escribe sus horas (o su día) en mano_obra, así los costos, la nómina y el desempeño
-- siguen saliendo de ahí. Es un módulo nuevo ('checada').
--
-- El trabajador no es miembro ni tiene sesión de Auth: el dueño o el administrador le manda un enlace de un solo uso;
-- al abrirlo, su celular queda con una llave (como el portal del cliente, D-066), y con ella solo puede checar. Un
-- celular por trabajador: activar otro quita el anterior.

alter table public.empresas drop constraint empresas_modulos_check;
alter table public.empresas add constraint empresas_modulos_check
  check (modulos <@ '{dinero,portal,cambios,subcontratistas,calidad,nomina,indicadores,historico,desempeno,posventa,marca,asistente,checada}'::text[]);

-- la geocerca de cada obra: el punto y el radio en metros
alter table public.obras
  add column geocerca_lat numeric(9, 6) check (geocerca_lat between -90 and 90),
  add column geocerca_lng numeric(9, 6) check (geocerca_lng between -180 and 180),
  add column geocerca_radio integer not null default 150 check (geocerca_radio between 30 and 2000),
  add constraint obras_geocerca_completa check ((geocerca_lat is null) = (geocerca_lng is null));

-- el acceso de un trabajador: la invitación (su token) y, al canjearla, la llave de su celular
create table public.accesos_trabajador (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  trabajador_id uuid not null,
  token_hash text not null unique,
  expira_en timestamptz not null,
  usado_en timestamptz,
  anulado_en timestamptz,
  secreto_hash text,
  dispositivo text,
  ultimo_uso timestamptz,
  revocado_en timestamptz,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  foreign key (empresa_id, trabajador_id) references public.trabajadores (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.accesos_trabajador (empresa_id, trabajador_id);

create table public.checadas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  trabajador_id uuid not null,
  acceso_id uuid references public.accesos_trabajador (id),
  tipo text not null check (tipo in ('entrada', 'salida')),
  -- la salida apunta a su entrada
  entrada_id uuid references public.checadas (id),
  -- la hora que cuenta: la del servidor, o la del celular si se envió después
  en timestamptz not null,
  recibida_en timestamptz not null default now(),
  enviada_despues boolean not null default false,
  lat numeric(9, 6),
  lng numeric(9, 6),
  precision_m integer,
  distancia_m integer,
  foto_path text,
  -- 'correccion': la salida que puso el dueño o el administrador (con su motivo)
  origen text not null default 'celular' check (origen in ('celular', 'correccion')),
  motivo text,
  mano_obra_id uuid references public.mano_obra (id),
  estado public.estado_registro not null default 'vigente',
  creado_en timestamptz not null default now(),
  creado_por uuid,
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (empresa_id, trabajador_id) references public.trabajadores (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id),
  check ((tipo = 'salida') = (entrada_id is not null))
);
create index on public.checadas (empresa_id, en);
create index on public.checadas (obra_id, en);
create index on public.checadas (trabajador_id, en desc);

alter table public.accesos_trabajador enable row level security;
alter table public.checadas enable row level security;
create trigger fijar_autor before insert on public.accesos_trabajador
  for each row execute function public.fijar_autor();
create trigger proteger_columnas_fijas before update on public.accesos_trabajador
  for each row execute function public.proteger_columnas_fijas();
create trigger fijar_autor before insert on public.checadas
  for each row execute function public.fijar_autor();
create trigger proteger_columnas_fijas before update on public.checadas
  for each row execute function public.proteger_columnas_fijas();

-- Las checadas las leen el dueño y el administrador; el PM, las de sus obras. Nadie las escribe directo: solo con las
-- funciones de abajo. Los accesos se leen sin sus huellas.
create policy "dueno lee las checadas" on public.checadas for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));
create policy "pm lee las checadas de sus obras" on public.checadas for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm()));
revoke select on public.accesos_trabajador from authenticated, servidor_app;
grant select (id, empresa_id, trabajador_id, expira_en, usado_en, anulado_en, dispositivo, ultimo_uso, revocado_en,
              creado_en, creado_por)
  on public.accesos_trabajador to authenticated, servidor_app;
create policy "dueno lee los accesos" on public.accesos_trabajador for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));

-- la distancia en metros entre dos puntos (haversine)
create function public.distancia_m(p_lat1 numeric, p_lng1 numeric, p_lat2 numeric, p_lng2 numeric) returns integer
language sql immutable set search_path = '' as $$
  select round(2 * 6371000 * asin(sqrt(
    power(sin(radians((p_lat2 - p_lat1)::float8) / 2), 2)
    + cos(radians(p_lat1::float8)) * cos(radians(p_lat2::float8))
      * power(sin(radians((p_lng2 - p_lng1)::float8) / 2), 2))))::integer
$$;

-- la geocerca de una obra: el dueño, el administrador o el PM de la obra (con su ubicación, en la obra)
create function public.fijar_geocerca(p_obra uuid, p_lat numeric, p_lng numeric, p_radio integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.es_dueno_o_admin() or public.es_pm_de(p_obra)) then
    raise exception 'solo_dueno' using errcode = '42501';
  end if;
  update public.obras set geocerca_lat = p_lat, geocerca_lng = p_lng, geocerca_radio = coalesce(p_radio, 150)
    where id = p_obra and empresa_id = public.empresa_actual();
  if not found then
    raise exception 'obra_no_encontrada' using errcode = 'P0001';
  end if;
end $$;

-- una invitación para que el trabajador active la checada en su celular; anula las que no usó
create function public.invitar_trabajador_checada(p_trabajador uuid, p_token text, p_expira timestamptz)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  nuevo uuid;
begin
  if not public.es_dueno_o_admin() then
    raise exception 'solo_dueno' using errcode = '42501';
  end if;
  if not exists (select 1 from public.empresas where id = public.empresa_actual() and 'checada' = any(modulos)) then
    raise exception 'modulo_no_incluido' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.trabajadores
                 where id = p_trabajador and empresa_id = public.empresa_actual() and activo) then
    raise exception 'trabajador_invalido' using errcode = 'P0001';
  end if;
  update public.accesos_trabajador set anulado_en = now()
    where trabajador_id = p_trabajador and usado_en is null and anulado_en is null;
  insert into public.accesos_trabajador (empresa_id, trabajador_id, token_hash, expira_en)
    values (public.empresa_actual(), p_trabajador, public.hash_secreto(p_token), p_expira)
    returning id into nuevo;
  return nuevo;
end $$;

-- quitarle la checada al celular de un trabajador
create function public.quitar_acceso_trabajador(p_trabajador uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_dueno_o_admin() then
    raise exception 'solo_dueno' using errcode = '42501';
  end if;
  update public.accesos_trabajador set revocado_en = now(), anulado_en = coalesce(anulado_en, now())
    where trabajador_id = p_trabajador and empresa_id = public.empresa_actual() and revocado_en is null;
end $$;

-- Por qué una invitación de checada no se puede canjear, como estado_invitacion (D-115). Sin sesión.
create function public.estado_acceso_trabajador(p_token text, p_acceso uuid, p_secreto text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  a public.accesos_trabajador;
begin
  select x.* into a from public.accesos_trabajador x
    join public.trabajadores t on t.id = x.trabajador_id
    join public.empresas e on e.id = x.empresa_id
    where x.token_hash = public.hash_secreto(p_token) and t.activo and e.activa;
  if not found then
    return 'invalida';
  end if;
  if a.usado_en is not null then
    if a.id = p_acceso and a.revocado_en is null and a.secreto_hash = public.hash_secreto(coalesce(p_secreto, '')) then
      return 'tuya';
    end if;
    return 'usada';
  end if;
  if a.anulado_en is not null then
    return 'anulada';
  end if;
  if a.expira_en <= now() then
    return 'vencida';
  end if;
  return 'vigente';
end $$;

-- Canjear la invitación en el celular del trabajador: el celular queda con su llave, y los anteriores dejan de servir.
-- Sin sesión: el token es la prueba. Nada si no sirve.
create function public.canjear_acceso_trabajador(p_token text, p_secreto text, p_dispositivo text)
returns table (acceso_id uuid, trabajador text)
language plpgsql security definer set search_path = '' as $$
declare
  a public.accesos_trabajador;
begin
  select x.* into a from public.accesos_trabajador x
    join public.trabajadores t on t.id = x.trabajador_id
    join public.empresas e on e.id = x.empresa_id
    where x.token_hash = public.hash_secreto(p_token) and x.usado_en is null and x.anulado_en is null
      and x.expira_en > now() and t.activo and e.activa and 'checada' = any(e.modulos)
    for update of x;
  if not found then
    return;
  end if;
  update public.accesos_trabajador set revocado_en = now()
    where trabajador_id = a.trabajador_id and usado_en is not null and revocado_en is null;
  update public.accesos_trabajador
    set usado_en = now(), secreto_hash = public.hash_secreto(p_secreto),
        dispositivo = left(coalesce(nullif(btrim(p_dispositivo), ''), 'Celular'), 80), ultimo_uso = now()
    where id = a.id;
  return query select a.id, t.nombre from public.trabajadores t where t.id = a.trabajador_id;
end $$;

-- De la llave del celular, quién es el trabajador y cómo va: si tiene una entrada sin salida, de qué obra y desde
-- cuándo. Nada si la llave no sirve (quitada, el trabajador dado de baja, la empresa sin el módulo). Sin sesión.
create function public.trabajador_de_acceso(p_acceso uuid, p_secreto text)
returns table (trabajador_id uuid, nombre text, empresa_id uuid, empresa text, zona text, tipo_pago text,
               entrada_id uuid, entrada_en timestamptz, entrada_obra text)
language plpgsql security definer set search_path = '' as $$
declare
  a public.accesos_trabajador;
begin
  select x.* into a from public.accesos_trabajador x
    join public.trabajadores t on t.id = x.trabajador_id
    join public.empresas e on e.id = x.empresa_id
    where x.id = p_acceso and x.usado_en is not null and x.revocado_en is null
      and x.secreto_hash = public.hash_secreto(coalesce(p_secreto, '')) and t.activo and e.activa
      and 'checada' = any(e.modulos);
  if not found then
    return;
  end if;
  if a.ultimo_uso is null or a.ultimo_uso < now() - interval '5 minutes' then
    update public.accesos_trabajador set ultimo_uso = now() where id = a.id;
  end if;
  return query
    select t.id, t.nombre, e.id, e.nombre, e.zona_horaria, t.tipo_pago::text, c.id, c.en, o.folio
    from public.trabajadores t
    join public.empresas e on e.id = t.empresa_id
    left join lateral (
      select ce.* from public.checadas ce
      where ce.trabajador_id = t.id and ce.tipo = 'entrada' and ce.estado = 'vigente'
        and not exists (select 1 from public.checadas s where s.entrada_id = ce.id and s.estado = 'vigente')
      order by ce.en desc limit 1) c on true
    left join public.obras o on o.id = c.obra_id
    where t.id = a.trabajador_id;
end $$;

-- Las horas (o el día) de una entrada y su salida, en mano_obra: en el espacio de generales de la obra, ligadas al
-- cierre de ese día si ya existe (así se reparten entre sus partidas, D-077). Por hora: en cuartos de hora, al menos
-- uno y a lo más 16. Por día: un día, solo la primera vez de ese día en esa obra.
create function public.horas_de_checada(p_entrada public.checadas, p_salida_en timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  tipo text;
  zona text;
  el_dia date;
  cantidad numeric;
  espacio uuid;
  bit uuid;
  nueva uuid;
begin
  select t.tipo_pago::text into tipo from public.trabajadores t where t.id = p_entrada.trabajador_id;
  select e.zona_horaria into zona from public.empresas e where e.id = p_entrada.empresa_id;
  el_dia := (p_entrada.en at time zone zona)::date;
  if tipo = 'dia' then
    if exists (select 1 from public.mano_obra m where m.obra_id = p_entrada.obra_id
               and m.trabajador_id = p_entrada.trabajador_id and m.dia = el_dia and m.estado = 'vigente') then
      return null;
    end if;
    cantidad := 1;
  else
    cantidad := least(16, greatest(0.25,
      round(extract(epoch from (p_salida_en - p_entrada.en)) / 3600 * 4) / 4));
  end if;
  select es.id into espacio from public.espacios es join public.tipos_espacio t on t.id = es.tipo_espacio_id
    where es.obra_id = p_entrada.obra_id order by t.es_generales desc, es.orden limit 1;
  select b.id into bit from public.bitacora b
    where b.obra_id = p_entrada.obra_id and b.dia = el_dia and b.estado = 'vigente' limit 1;
  insert into public.mano_obra (empresa_id, obra_id, espacio_id, trabajador_id, cantidad, dia, bitacora_id)
    values (p_entrada.empresa_id, p_entrada.obra_id, espacio, p_entrada.trabajador_id, cantidad, el_dia, bit)
    returning id into nueva;
  return nueva;
end $$;

-- Checar entrada o salida desde el celular. Sin sesión: la llave es la prueba. La entrada va a la obra en curso más
-- cercana cuya geocerca lo incluye (con un margen de lo que diga la precisión del GPS, hasta 50 m); la salida, a la
-- obra de su entrada. No lanza errores de negocio: devuelve el resultado ('ok', 'fuera', 'sin_obras',
-- 'gps_impreciso', 'ya_dentro', 'sin_entrada', 'sin_acceso') con la obra más cercana y su distancia.
create function public.checar(p_acceso uuid, p_secreto text, p_tipo text, p_lat numeric, p_lng numeric,
                              p_precision integer, p_foto text, p_capturada timestamptz)
returns table (resultado text, checada_id uuid, obra text, distancia_m integer, en timestamptz, horas numeric)
language plpgsql security definer set search_path = '' as $$
declare
  t record;
  ent public.checadas;
  o record;
  cuando timestamptz := now();
  despues boolean := false;
  nueva uuid;
  mo uuid;
begin
  select * into t from public.trabajador_de_acceso(p_acceso, p_secreto);
  if t.trabajador_id is null then
    return query select 'sin_acceso', null::uuid, null::text, null::integer, null::timestamptz, null::numeric;
    return;
  end if;
  if p_lat is null or p_lng is null or coalesce(p_precision, 0) > 200 then
    return query select 'gps_impreciso', null::uuid, null::text, null::integer, null::timestamptz, null::numeric;
    return;
  end if;
  -- capturada sin señal y enviada después: cuenta la hora del celular, si no es del futuro ni de hace más de un día
  if p_capturada is not null and p_capturada < now() - interval '5 minutes'
     and p_capturada > now() - interval '1 day' then
    cuando := p_capturada;
    despues := true;
  end if;

  if t.entrada_id is not null then
    select * into ent from public.checadas where id = t.entrada_id;
  end if;
  if p_tipo = 'entrada' then
    if ent.id is not null then
      return query select 'ya_dentro', ent.id, t.entrada_obra, null::integer, ent.en, null::numeric;
      return;
    end if;
    select ob.id, ob.folio, ob.geocerca_radio as radio,
           public.distancia_m(p_lat, p_lng, ob.geocerca_lat, ob.geocerca_lng) as d into o
      from public.obras ob
      where ob.empresa_id = t.empresa_id and ob.estado in ('lista_para_arranque', 'en_obra')
        and ob.geocerca_lat is not null
      order by public.distancia_m(p_lat, p_lng, ob.geocerca_lat, ob.geocerca_lng) - ob.geocerca_radio
      limit 1;
  elsif p_tipo = 'salida' then
    if ent.id is null then
      return query select 'sin_entrada', null::uuid, null::text, null::integer, null::timestamptz, null::numeric;
      return;
    end if;
    select ob.id, ob.folio, ob.geocerca_radio as radio,
           public.distancia_m(p_lat, p_lng, ob.geocerca_lat, ob.geocerca_lng) as d into o
      from public.obras ob where ob.id = ent.obra_id;
  else
    raise exception 'tipo_invalido' using errcode = 'P0001';
  end if;

  if not found or o.d is null then
    return query select 'sin_obras', null::uuid, null::text, null::integer, null::timestamptz, null::numeric;
    return;
  end if;
  if o.d > o.radio + least(coalesce(p_precision, 0), 50) then
    return query select 'fuera', null::uuid, o.folio::text, o.d, null::timestamptz, null::numeric;
    return;
  end if;

  if p_tipo = 'salida' then
    if cuando <= ent.en then
      cuando := now();
    end if;
    mo := public.horas_de_checada(ent, cuando);
  end if;
  insert into public.checadas (empresa_id, obra_id, trabajador_id, acceso_id, tipo, entrada_id, en, enviada_despues,
                               lat, lng, precision_m, distancia_m, foto_path, mano_obra_id)
    values (t.empresa_id, o.id, t.trabajador_id, p_acceso, p_tipo, ent.id, cuando, despues, p_lat, p_lng,
            p_precision, o.d, p_foto, mo)
    returning id into nueva;
  return query
    select 'ok', nueva, o.folio::text, o.d, cuando,
           (select m.cantidad from public.mano_obra m where m.id = mo);
end $$;

-- Poner la salida que el trabajador olvidó: el dueño o el administrador, con la hora y el motivo.
create function public.corregir_salida(p_entrada uuid, p_en timestamptz, p_motivo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  ent public.checadas;
  mo uuid;
  nueva uuid;
begin
  if not public.es_dueno_o_admin() then
    raise exception 'solo_dueno' using errcode = '42501';
  end if;
  select c.* into ent from public.checadas c
    where c.id = p_entrada and c.empresa_id = public.empresa_actual() and c.tipo = 'entrada' and c.estado = 'vigente'
      and not exists (select 1 from public.checadas s where s.entrada_id = c.id and s.estado = 'vigente');
  if not found then
    raise exception 'checada_invalida' using errcode = 'P0001';
  end if;
  if p_en <= ent.en or p_en > now() or p_en > ent.en + interval '16 hours' then
    raise exception 'hora_invalida' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'motivo_requerido' using errcode = 'P0001';
  end if;
  mo := public.horas_de_checada(ent, p_en);
  insert into public.checadas (empresa_id, obra_id, trabajador_id, tipo, entrada_id, en, origen, motivo, mano_obra_id)
    values (ent.empresa_id, ent.obra_id, ent.trabajador_id, 'salida', ent.id, p_en, 'correccion', btrim(p_motivo), mo)
    returning id into nueva;
  return nueva;
end $$;

-- Anular una checada (y, si es una entrada, su salida; y las horas que dieron): el dueño o el administrador.
create function public.anular_checada(p_checada uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.checadas;
begin
  if not public.es_dueno_o_admin() then
    raise exception 'solo_dueno' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'motivo_requerido' using errcode = 'P0001';
  end if;
  select * into c from public.checadas
    where id = p_checada and empresa_id = public.empresa_actual() and estado = 'vigente';
  if not found then
    raise exception 'checada_invalida' using errcode = 'P0001';
  end if;
  update public.mano_obra set estado = 'anulado'
    where id in (select x.mano_obra_id from public.checadas x
                 where (x.id = c.id or x.entrada_id = c.id) and x.estado = 'vigente' and x.mano_obra_id is not null);
  update public.checadas set estado = 'anulado', motivo = btrim(p_motivo)
    where (id = c.id or entrada_id = c.id) and estado = 'vigente';
end $$;

-- El PM no cambia a qué cierre pertenece una hora de la cuadrilla (limitar_columnas_pm, 20261004000200), salvo
-- cuando la base liga las horas de la checada a su cierre (abajo), que lo marca solo durante esa sentencia.
create or replace function public.limitar_columnas_pm() returns trigger
language plpgsql set search_path = '' as $$
declare
  antes jsonb := to_jsonb(old);
  despues jsonb := to_jsonb(new);
  permitidas text[] := tg_argv || array['actualizado_en'];
  c text;
begin
  if public.rol_actual() is distinct from 'pm' then
    return new;
  end if;
  if tg_table_name = 'mano_obra' and coalesce(current_setting('ijm.ligando_checadas', true), '') = 'si' then
    permitidas := permitidas || array['bitacora_id'];
  end if;
  for c in select jsonb_object_keys(despues) loop
    if antes -> c is distinct from despues -> c and not c = any(permitidas) then
      raise exception 'El PM no puede cambiar %', c using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

-- Ligar (o desligar, con null) las horas de las checadas de una obra y un día a su cierre: al cerrar el día se
-- reparten entre sus partidas (D-077); al anular el cierre, se quedan (no son del cierre, son de la checada).
create function public.ligar_checadas_al_cierre(p_obra uuid, p_dia date, p_bitacora uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.es_dueno_o_admin() or public.es_pm_de(p_obra)) then
    raise exception 'solo_dueno' using errcode = '42501';
  end if;
  perform set_config('ijm.ligando_checadas', 'si', true);
  update public.mano_obra m set bitacora_id = p_bitacora
    where m.obra_id = p_obra and m.dia = p_dia and m.empresa_id = public.empresa_actual() and m.estado = 'vigente'
      and m.id in (select c.mano_obra_id from public.checadas c where c.obra_id = p_obra and c.mano_obra_id is not null);
  perform set_config('ijm.ligando_checadas', '', true);
end $$;

revoke all on function public.distancia_m(numeric, numeric, numeric, numeric),
  public.fijar_geocerca(uuid, numeric, numeric, integer),
  public.invitar_trabajador_checada(uuid, text, timestamptz), public.quitar_acceso_trabajador(uuid),
  public.estado_acceso_trabajador(text, uuid, text), public.canjear_acceso_trabajador(text, text, text),
  public.trabajador_de_acceso(uuid, text), public.horas_de_checada(public.checadas, timestamptz),
  public.checar(uuid, text, text, numeric, numeric, integer, text, timestamptz),
  public.corregir_salida(uuid, timestamptz, text), public.anular_checada(uuid, text),
  public.ligar_checadas_al_cierre(uuid, date, uuid)
  from public, anon, authenticated, servidor_app;
grant execute on function public.distancia_m(numeric, numeric, numeric, numeric),
  public.fijar_geocerca(uuid, numeric, numeric, integer),
  public.invitar_trabajador_checada(uuid, text, timestamptz), public.quitar_acceso_trabajador(uuid),
  public.estado_acceso_trabajador(text, uuid, text), public.canjear_acceso_trabajador(text, text, text),
  public.trabajador_de_acceso(uuid, text),
  public.checar(uuid, text, text, numeric, numeric, integer, text, timestamptz),
  public.corregir_salida(uuid, timestamptz, text), public.anular_checada(uuid, text),
  public.ligar_checadas_al_cierre(uuid, date, uuid)
  to servidor_app;
