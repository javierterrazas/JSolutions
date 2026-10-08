-- Fase 2 · Cargar en una empresa su libro del sistema actual (D-039): catálogo, configuración, metas,
-- subcontratistas y cuadrilla. Lo convierte packages/servidor/src/importar/libro.ts y lo corre quien administra la
-- plataforma con el service role (packages/servidor/scripts/cargar-libro.ts), como el alta de la empresa.
--
-- Todo o nada, y solo en una empresa sin catálogo: cargar dos veces duplicaría partidas y subcontratistas. Para
-- corregir algo después están las pantallas del dueño (fase 3).

create function public.cargar_libro(p_empresa uuid, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c jsonb := p_datos -> 'configuracion';
  r jsonb;
  t uuid;
  tr uuid;
begin
  if not exists (select 1 from public.empresas where id = p_empresa) then
    raise exception 'empresa_inexistente';
  end if;
  if exists (select 1 from public.tipos_espacio where empresa_id = p_empresa)
     or exists (select 1 from public.subcontratistas where empresa_id = p_empresa)
     or exists (select 1 from public.trabajadores where empresa_id = p_empresa) then
    raise exception 'empresa_con_catalogo';
  end if;

  update public.configuracion set
    impuesto = coalesce((c ->> 'impuesto')::numeric, impuesto),
    limite_compra_pm = coalesce((c ->> 'limite_compra_pm')::numeric, limite_compra_pm),
    sla_bloqueo_horas = coalesce((c ->> 'sla_bloqueo_horas')::integer, sla_bloqueo_horas),
    sla_oc_horas = coalesce((c ->> 'sla_oc_horas')::integer, sla_oc_horas),
    umbral_oc_menor = coalesce((c ->> 'umbral_oc_menor')::numeric, umbral_oc_menor),
    margen_minimo_oc = coalesce((c ->> 'margen_minimo_oc')::numeric, margen_minimo_oc),
    horas_sin_recibo = coalesce((c ->> 'horas_sin_recibo')::integer, horas_sin_recibo)
  where empresa_id = p_empresa;

  insert into public.metas_indicadores (empresa_id, indicador, meta)
    select p_empresa, m ->> 'indicador', (m ->> 'meta')::numeric
    from jsonb_array_elements(p_datos -> 'metas') m;

  insert into public.tipos_espacio (empresa_id, nombre_es, es_generales, orden)
    select p_empresa, x ->> 'nombre_es', (x ->> 'es_generales')::boolean, (x ->> 'orden')::integer
    from jsonb_array_elements(p_datos -> 'tipos') x;
  insert into public.oficios (empresa_id, nombre_es, requiere_licencia)
    select p_empresa, x ->> 'nombre_es', (x ->> 'requiere_licencia')::boolean
    from jsonb_array_elements(p_datos -> 'oficios') x;
  insert into public.etapas (empresa_id, nombre_es, orden)
    select p_empresa, x ->> 'nombre_es', (x ->> 'orden')::integer
    from jsonb_array_elements(p_datos -> 'etapas') x;
  insert into public.hitos_calidad (empresa_id, clave, nombre_es, orden, exige_prueba_agua)
    select p_empresa, x ->> 'clave', x ->> 'nombre_es', (x ->> 'orden')::integer, (x ->> 'exige_prueba_agua')::boolean
    from jsonb_array_elements(p_datos -> 'hitos') x;
  insert into public.puntos_control (empresa_id, hito_id, orden, texto_es, requiere_foto)
    select p_empresa, h.id, (x ->> 'orden')::integer, x ->> 'texto_es', (x ->> 'requiere_foto')::boolean
    from jsonb_array_elements(p_datos -> 'puntos') x
    join public.hitos_calidad h on h.empresa_id = p_empresa and h.clave = x ->> 'hito';

  insert into public.plantillas_partida (empresa_id, tipo_espacio_id, orden, nombre_es, hito_id, peso, dias,
                                         responsable, oficio_id, paralelo, espera, etapa_id)
    select p_empresa, te.id, (x ->> 'orden')::integer, x ->> 'nombre_es', h.id, (x ->> 'peso')::numeric,
           (x ->> 'dias')::integer, (x ->> 'responsable')::public.responsable_partida, o.id,
           (x ->> 'paralelo')::boolean, (x ->> 'espera')::integer, e.id
    from jsonb_array_elements(p_datos -> 'partidas') x
    join public.tipos_espacio te on te.empresa_id = p_empresa and te.nombre_es = x ->> 'tipo'
    left join public.hitos_calidad h on h.empresa_id = p_empresa and h.clave = x ->> 'hito'
    left join public.oficios o on o.empresa_id = p_empresa and o.nombre_es = x ->> 'oficio'
    left join public.etapas e on e.empresa_id = p_empresa and e.nombre_es = x ->> 'etapa';

  insert into public.subcontratistas (empresa_id, nombre, oficio_id, telefono, contacto, correo, seguro_vence,
                                      licencia, licencia_vence, w9, activo)
    select p_empresa, x ->> 'nombre', o.id, x ->> 'telefono', x ->> 'contacto', x ->> 'correo',
           (x ->> 'seguro_vence')::date, x ->> 'licencia', (x ->> 'licencia_vence')::date, (x ->> 'w9')::boolean,
           (x ->> 'activo')::boolean
    from jsonb_array_elements(p_datos -> 'subcontratistas') x
    join public.oficios o on o.empresa_id = p_empresa and o.nombre_es = x ->> 'oficio';

  -- la tarifa del libro vale desde siempre: el libro no guarda su historia (D-031)
  for r in select * from jsonb_array_elements(p_datos -> 'trabajadores') loop
    insert into public.trabajadores (empresa_id, nombre, puesto, tipo_pago, telefono, activo)
      values (p_empresa, r ->> 'nombre', r ->> 'puesto', (r ->> 'tipo_pago')::public.tipo_pago, r ->> 'telefono',
              (r ->> 'activo')::boolean)
      returning id into tr;
    insert into public.tarifas_trabajador (empresa_id, trabajador_id, tarifa, vigente_desde)
      values (p_empresa, tr, (r ->> 'tarifa')::numeric, '2000-01-01');
  end loop;

  return jsonb_build_object(
    'tipos', (select count(*) from public.tipos_espacio where empresa_id = p_empresa),
    'partidas', (select count(*) from public.plantillas_partida where empresa_id = p_empresa),
    'etapas', (select count(*) from public.etapas where empresa_id = p_empresa),
    'oficios', (select count(*) from public.oficios where empresa_id = p_empresa),
    'puntos', (select count(*) from public.puntos_control where empresa_id = p_empresa),
    'subcontratistas', (select count(*) from public.subcontratistas where empresa_id = p_empresa),
    'trabajadores', (select count(*) from public.trabajadores where empresa_id = p_empresa),
    'metas', (select count(*) from public.metas_indicadores where empresa_id = p_empresa));
end $$;

revoke all on function public.cargar_libro(uuid, jsonb) from public, anon, authenticated, servidor_app;
grant execute on function public.cargar_libro(uuid, jsonb) to service_role;
