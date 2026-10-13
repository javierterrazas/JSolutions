-- Las órdenes de cambio, aprobadas por el cliente en su portal (D-067; lo pidió el dueño). El dueño las emite
-- (legacy: duCrearOC, con el margen mínimo); el cliente las ve en su enlace (D-066) con su precio, los días que
-- mueven la entrega y la condición de pago, y las aprueba con su nombre y su firma, o no las aprueba. Aprobada, la
-- orden queda autorizada: mueve la entrega comprometida y el PM la ve para ejecutarla. El dueño también puede
-- registrar la respuesta que el cliente le dio en papel.
--
-- El cliente nunca ve el costo ni el margen: solo lo que se le cobra.

-- ------------------------------------------------------------------ la respuesta del cliente
-- Una por orden: aprobada o no aprobada, con quién respondió y cuándo. Desde el portal guarda la firma (un PNG
-- como data URL), el IP y el navegador, la evidencia de que la aprobó él. Nada se edita ni se borra.
create table public.respuestas_cambio (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  orden_cambio_id uuid not null unique,
  decision text not null check (decision in ('aprobada', 'rechazada')),
  nombre text not null check (btrim(nombre) <> '' and length(nombre) <= 120),
  firma text check (firma is null or (firma like 'data:image/png;base64,%' and length(firma) <= 300000)),
  comentario text check (length(comentario) <= 1000),
  desde_portal boolean not null,
  ip text check (length(ip) <= 100),
  navegador text check (length(navegador) <= 400),
  creado_en timestamptz not null default now(),
  creado_por uuid,
  check (decision <> 'aprobada' or not desde_portal or firma is not null),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, orden_cambio_id) references public.ordenes_cambio (obra_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
create index on public.respuestas_cambio (empresa_id, obra_id);
select public.preparar_tabla('public.respuestas_cambio');

-- El dueño la lee y registra la que le dieron en papel; la del portal entra por responder_cambio_cliente. Nunca se
-- edita: no hay política de update.
create policy "dueno lee" on public.respuestas_cambio for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));
create policy "dueno crea" on public.respuestas_cambio for insert to servidor_app
  with check (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin())
              and not desde_portal);

-- ------------------------------------------------------------------ lo que ve el cliente
-- Las órdenes de cambio de la obra del enlace: las por aprobar y las ya respondidas, con su precio al cliente y,
-- para saber cuánto suma su contrato, el contrato original. Null si el enlace no sirve.
create function public.cambios_portal_cliente(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'contrato', (select f.contrato_original from public.obras_finanzas f where f.obra_id = en.obra_id),
    'ordenes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', oc.id, 'folio', oc.folio, 'motivo', oc.motivo, 'descripcion', oc.descripcion,
               'dias', oc.dias_impacto, 'condicion', oc.condicion_pago, 'estado', oc.estado,
               'emitida', oc.emitida_en, 'precio', m.precio_cliente,
               'respuesta', (select jsonb_build_object('decision', r.decision, 'nombre', r.nombre,
                                                       'cuando', r.creado_en, 'comentario', r.comentario)
                             from public.respuestas_cambio r where r.orden_cambio_id = oc.id))
             order by oc.emitida_en desc)
      from public.ordenes_cambio oc join public.ordenes_cambio_montos m on m.orden_cambio_id = oc.id
      where oc.obra_id = en.obra_id), '[]'))
  from public.enlace_cliente_vigente(p_token) en
  where en.id is not null
$$;

-- El cliente responde una orden por aprobar con su enlace. Aprobada (con firma), queda autorizada; no aprobada,
-- rechazada. Errores: enlace_invalido, orden_no_encontrada (no es de su obra), orden_ya_respondida, falta_nombre,
-- falta_firma.
create function public.responder_cambio_cliente(p_token text, p_orden uuid, p_decision text, p_nombre text,
                                                p_firma text, p_comentario text, p_ip text, p_navegador text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  en public.enlaces_cliente;
  oc public.ordenes_cambio;
begin
  en := public.enlace_cliente_vigente(p_token);
  if en.id is null then
    raise exception 'enlace_invalido' using errcode = 'P0001';
  end if;
  select * into oc from public.ordenes_cambio where id = p_orden and obra_id = en.obra_id for update;
  if not found then
    raise exception 'orden_no_encontrada' using errcode = 'P0001';
  end if;
  if oc.estado <> 'propuesta' or exists (select 1 from public.respuestas_cambio where orden_cambio_id = oc.id) then
    raise exception 'orden_ya_respondida' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_nombre), '') = '' then
    raise exception 'falta_nombre' using errcode = 'P0001';
  end if;
  if p_decision = 'aprobada' and coalesce(p_firma, '') not like 'data:image/png;base64,%' then
    raise exception 'falta_firma' using errcode = 'P0001';
  end if;
  insert into public.respuestas_cambio (empresa_id, obra_id, orden_cambio_id, decision, nombre, firma, comentario,
                                        desde_portal, ip, navegador)
    values (oc.empresa_id, oc.obra_id, oc.id, p_decision, btrim(p_nombre),
            case when p_decision = 'aprobada' then p_firma end, nullif(btrim(p_comentario), ''), true,
            left(p_ip, 100), left(p_navegador, 400));
  update public.ordenes_cambio
    set estado = case when p_decision = 'aprobada' then 'autorizada'::public.estado_orden_cambio
                      else 'rechazada'::public.estado_orden_cambio end,
        autorizada_en = case when p_decision = 'aprobada' then now() end
    where id = oc.id;
end $$;

-- ------------------------------------------------------------------ quién ejecuta qué
revoke all on function public.cambios_portal_cliente(text),
  public.responder_cambio_cliente(text, uuid, text, text, text, text, text, text)
  from public, anon, authenticated, servidor_app;
grant execute on function public.cambios_portal_cliente(text),
  public.responder_cambio_cliente(text, uuid, text, text, text, text, text, text)
  to servidor_app;
