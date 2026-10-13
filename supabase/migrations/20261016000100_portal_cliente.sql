-- El portal del cliente (D-066; lo pidió el dueño): un enlace privado por obra donde el cliente ve, sin cuenta ni
-- PIN, cómo va su remodelación: el avance, en qué va cada espacio, la entrega comprometida, los días trabajados y
-- las fotos que el PM o el dueño marcaron para él. Solo lectura y sin dinero.
--
-- El cliente no tiene sesión: el token del enlace es la prueba, como en canjear_invitacion. La base guarda solo su
-- hash; las funciones de abajo son lo único que el servidor puede consultar con él, y contestan solo lo que el
-- cliente puede ver. Nunca: costos, presupuesto, cuadrilla, subs, avisos, notas del PM, la fecha prevista, recibos
-- ni fotos sin marcar.

-- ------------------------------------------------------------------ las fotos para el cliente
-- Una foto se ve en el portal solo si alguien la marcó. Solo las del trabajo: cierres, inspecciones, pruebas de agua
-- y la lista de entrega; nunca recibos, avisos ni órdenes de cambio.
alter table public.fotos add column para_cliente boolean not null default false;

create function public.foto_para_cliente_permitida(p_tipo public.tipo_foto) returns boolean
language sql immutable set search_path = '' as $$
  select p_tipo in ('bitacora', 'inspeccion', 'prueba_agua', 'punch')
$$;

-- La marca el PM de la obra (mientras la ve) o el dueño. Error: foto_no_encontrada (no existe o no es suya),
-- foto_no_permitida (un recibo, un aviso…).
create function public.marcar_foto_cliente(p_foto uuid, p_visible boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  f public.fotos;
begin
  select * into f from public.fotos
    where id = p_foto and empresa_id = public.empresa_actual()
      and (public.es_dueno_o_admin() or obra_id in (select public.obras_del_pm()))
    for update;
  if not found then
    raise exception 'foto_no_encontrada' using errcode = 'P0001';
  end if;
  if not public.foto_para_cliente_permitida(f.ref_tipo) then
    raise exception 'foto_no_permitida' using errcode = 'P0001';
  end if;
  update public.fotos set para_cliente = p_visible where id = p_foto;
end $$;

-- ------------------------------------------------------------------ los enlaces
-- Un enlace vigente por obra. Crear otro anula el anterior (el cliente perdió el suyo, o se mandó a quien no era).
create table public.enlaces_cliente (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  token_hash text not null unique,
  anulado_en timestamptz,
  ultimo_acceso timestamptz,
  accesos integer not null default 0 check (accesos >= 0),
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create unique index enlaces_cliente_uno_vigente on public.enlaces_cliente (obra_id) where anulado_en is null;
select public.preparar_tabla('public.enlaces_cliente');

-- Solo el dueño los ve y los anula; se crean por crear_enlace_cliente (el hash del token lo saca la base).
create policy "dueno lee" on public.enlaces_cliente for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));
create policy "dueno edita" on public.enlaces_cliente for update to servidor_app
  using (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()))
  with check (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));

-- Crea el enlace de una obra con el token que generó el servidor, y anula el que hubiera. Error: solo_dueno,
-- obra_no_encontrada.
create function public.crear_enlace_cliente(p_obra uuid, p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  o public.obras;
  nuevo uuid;
begin
  if not public.es_dueno_o_admin() then
    raise exception 'solo_dueno' using errcode = '42501';
  end if;
  select * into o from public.obras where id = p_obra and empresa_id = public.empresa_actual();
  if not found then
    raise exception 'obra_no_encontrada' using errcode = 'P0001';
  end if;
  update public.enlaces_cliente set anulado_en = now() where obra_id = p_obra and anulado_en is null;
  insert into public.enlaces_cliente (empresa_id, obra_id, token_hash, creado_por)
    values (o.empresa_id, o.id, public.hash_secreto(p_token), public.miembro_actual())
    returning id into nuevo;
  return nuevo;
end $$;

-- ------------------------------------------------------------------ lo que ve el cliente
-- El enlace de un token, si todavía sirve: sin anular, de una empresa activa, y de una obra sin entregar o con la
-- garantía vigente (hoy, en la zona de su empresa). Si no sirve, nada, sin decir por qué.
create function public.enlace_cliente_vigente(p_token text) returns public.enlaces_cliente
language sql stable security definer set search_path = '' as $$
  select en.* from public.enlaces_cliente en
  join public.obras o on o.id = en.obra_id
  join public.empresas em on em.id = o.empresa_id and em.activa
  where en.token_hash = public.hash_secreto(p_token) and en.anulado_en is null
    and (o.estado <> 'entregada'
         or exists (select 1 from public.entregas e
                    where e.obra_id = o.id and e.garantia_vence >= (now() at time zone em.zona_horaria)::date))
$$;

-- Todo lo del portal en una consulta, y cuenta la visita. Null si el token no sirve. Los días trabajados son los
-- cierres con trabajo de los 30 días hasta p_ahora (lo pasa el servidor, para que las pruebas fijen el día); las
-- fotos, las 120 marcadas más nuevas.
create function public.portal_cliente(p_token text, p_ahora timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  en public.enlaces_cliente;
  o public.obras;
  em public.empresas;
  hoy date;
begin
  en := public.enlace_cliente_vigente(p_token);
  if en.id is null then
    return null;
  end if;
  select * into o from public.obras where id = en.obra_id;
  select * into em from public.empresas where id = o.empresa_id;
  hoy := (p_ahora at time zone em.zona_horaria)::date;
  update public.enlaces_cliente set ultimo_acceso = now(), accesos = accesos + 1 where id = en.id;

  return jsonb_build_object(
    'empresa', em.nombre,
    'zona', em.zona_horaria,
    'obra', jsonb_build_object('id', o.id, 'folio', o.folio, 'cliente', o.cliente, 'direccion', o.direccion,
                               'estado', o.estado, 'inicio', o.fecha_inicio, 'fin', o.fecha_fin_estimada),
    'diasLaborables', (select to_jsonb(c.dias_laborables) from public.configuracion c where c.empresa_id = o.empresa_id),
    'feriados', coalesce((select jsonb_agg(to_char(f.dia, 'YYYY-MM-DD')) from public.feriados f
                          where f.empresa_id = o.empresa_id and not f.se_trabaja), '[]'),
    'espacios', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre,
                                                              'generales', t.es_generales) order by e.orden)
                          from public.espacios e join public.tipos_espacio t on t.id = e.tipo_espacio_id
                          where e.obra_id = o.id), '[]'),
    'partidas', coalesce((select jsonb_agg(jsonb_build_object(
                            'id', p.id, 'espacio', p.espacio_id, 'es', p.nombre_es, 'en', p.nombre_en,
                            'peso', p.peso, 'dias', p.dias, 'responsable', p.responsable, 'oficio', p.oficio_id,
                            'paralelo', p.paralelo, 'espera', p.espera, 'etapa', p.etapa_id)
                            order by p.orden, p.nombre_es)
                          from public.partidas_obra p where p.obra_id = o.id and p.estado = 'activa'), '[]'),
    'avance', coalesce((select jsonb_agg(jsonb_build_object('partidaId', a.partida_obra_id, 'estado', a.estado,
                                                            'dia', to_char(a.dia, 'YYYY-MM-DD')))
                        from public.avance a where a.obra_id = o.id and a.estado_registro = 'vigente'), '[]'),
    'diasCambios', (select coalesce(sum(coalesce(oc.dias_impacto, 0)), 0) from public.ordenes_cambio oc
                    where oc.obra_id = o.id and oc.estado in ('autorizada', 'facturada')),
    'etapas', coalesce((select jsonb_agg(jsonb_build_object('id', et.id, 'es', et.nombre_es, 'en', et.nombre_en))
                        from public.etapas et where et.empresa_id = o.empresa_id), '[]'),
    'entrega', (select jsonb_build_object('dia', e.fecha_entrega, 'garantiaVence', e.garantia_vence)
                from public.entregas e where e.obra_id = o.id),
    'dias', coalesce((select jsonb_agg(d order by d->>'dia' desc) from (
                        select jsonb_build_object('dia', to_char(b.dia, 'YYYY-MM-DD'), 'partidas', jsonb_agg(
                                 jsonb_build_object('espacio', e.nombre, 'es', p.nombre_es, 'en', p.nombre_en,
                                   'terminada', exists (select 1 from public.avance a
                                                        where a.bitacora_id = b.id and a.partida_obra_id = p.id
                                                          and a.estado = 'terminada' and a.estado_registro = 'vigente'))
                                 order by e.orden, p.orden)) as d
                        from public.bitacora b
                        join public.bitacora_partidas bp on bp.bitacora_id = b.id
                        join public.partidas_obra p on p.id = bp.partida_obra_id
                        join public.espacios e on e.id = p.espacio_id
                        where b.obra_id = o.id and b.estado = 'vigente' and not b.sin_trabajo and b.dia > hoy - 30 and b.dia <= hoy
                        group by b.id, b.dia) x), '[]'),
    'fotos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'dia', x.dia, 'tipo', x.ref_tipo)
                                        order by x.creado_en desc)
                       from (select f.id, f.ref_tipo, f.creado_en,
                                    to_char(coalesce(b.dia, (f.creado_en at time zone em.zona_horaria)::date),
                                            'YYYY-MM-DD') as dia
                             from public.fotos f
                             left join public.bitacora b on f.ref_tipo = 'bitacora' and b.id = f.ref_id
                             where f.obra_id = o.id and f.para_cliente
                               and public.foto_para_cliente_permitida(f.ref_tipo)
                             order by f.creado_en desc limit 120) x), '[]')
  );
end $$;

-- La ruta en Storage de una foto del portal, para firmarle un enlace de pocos minutos; null si no se ve ahí.
create function public.foto_portal_cliente(p_token text, p_foto uuid) returns text
language sql stable security definer set search_path = '' as $$
  select f.storage_path from public.fotos f
  where f.id = p_foto and f.para_cliente and public.foto_para_cliente_permitida(f.ref_tipo)
    and f.obra_id = (public.enlace_cliente_vigente(p_token)).obra_id
$$;

-- ------------------------------------------------------------------ quién ejecuta qué
revoke all on function public.foto_para_cliente_permitida(public.tipo_foto),
  public.marcar_foto_cliente(uuid, boolean), public.crear_enlace_cliente(uuid, text),
  public.enlace_cliente_vigente(text), public.portal_cliente(text, timestamptz), public.foto_portal_cliente(text, uuid)
  from public, anon, authenticated, servidor_app;
grant execute on function public.marcar_foto_cliente(uuid, boolean), public.crear_enlace_cliente(uuid, text),
  public.portal_cliente(text, timestamptz), public.foto_portal_cliente(text, uuid)
  to servidor_app;
