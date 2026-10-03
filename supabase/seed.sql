-- Datos de prueba para la base local. `supabase db reset` los carga después de las migraciones.
-- SOLO PARA DESARROLLO Y PRUEBAS: los correos usan el dominio reservado .test y todos comparten la contraseña de
-- prueba de abajo. Las pruebas los usan desde packages/db/pruebas/usuarios.ts.
--
-- Empresa A (IJM Construction, Austin):   dueño, dos PMs y un PM dado de baja.
-- Empresa B (Remodelaciones del Valle):   dueño y dos PMs.
-- Y un usuario de Auth que no pertenece a ninguna empresa.

-- ------------------------------------------------------------------ usuarios de Supabase Auth
create function pg_temp.usuario(p_id uuid, p_correo text) returns void
language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_correo,
    extensions.crypt('ijm-prueba-2026', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
    '', '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text, 'email',
          jsonb_build_object('sub', p_id::text, 'email', p_correo, 'email_verified', true),
          now(), now(), now());
end $$;

select pg_temp.usuario('a0000000-0000-4000-8000-000000000001', 'dueno@empresa-a.test');
select pg_temp.usuario('a0000000-0000-4000-8000-000000000002', 'pm1@empresa-a.test');
select pg_temp.usuario('a0000000-0000-4000-8000-000000000003', 'pm2@empresa-a.test');
select pg_temp.usuario('a0000000-0000-4000-8000-000000000004', 'baja@empresa-a.test');
select pg_temp.usuario('b0000000-0000-4000-8000-000000000001', 'dueno@empresa-b.test');
select pg_temp.usuario('b0000000-0000-4000-8000-000000000002', 'pm1@empresa-b.test');
select pg_temp.usuario('b0000000-0000-4000-8000-000000000003', 'pm2@empresa-b.test');
select pg_temp.usuario('c0000000-0000-4000-8000-000000000001', 'sin-empresa@prueba.test');

-- ------------------------------------------------------------------ empresas y miembros
insert into public.empresas (id, nombre, ciudad) values
  ('e000000a-0000-4000-8000-000000000000', 'IJM Construction', 'Austin, TX'),
  ('e000000b-0000-4000-8000-000000000000', 'Remodelaciones del Valle', 'San Antonio, TX');

insert into public.configuracion (empresa_id) values
  ('e000000a-0000-4000-8000-000000000000'),
  ('e000000b-0000-4000-8000-000000000000');

insert into public.miembros (id, empresa_id, user_id, rol, nombre, idioma, activo) values
  ('a1000000-0000-4000-8000-000000000001', 'e000000a-0000-4000-8000-000000000000',
   'a0000000-0000-4000-8000-000000000001', 'dueno', 'Javier', 'es', true),
  ('a1000000-0000-4000-8000-000000000002', 'e000000a-0000-4000-8000-000000000000',
   'a0000000-0000-4000-8000-000000000002', 'pm', 'Carlos Méndez', 'es', true),
  ('a1000000-0000-4000-8000-000000000003', 'e000000a-0000-4000-8000-000000000000',
   'a0000000-0000-4000-8000-000000000003', 'pm', 'Luis Ramírez', 'en', true),
  ('a1000000-0000-4000-8000-000000000004', 'e000000a-0000-4000-8000-000000000000',
   'a0000000-0000-4000-8000-000000000004', 'pm', 'PM dado de baja', 'es', false),
  ('b1000000-0000-4000-8000-000000000001', 'e000000b-0000-4000-8000-000000000000',
   'b0000000-0000-4000-8000-000000000001', 'dueno', 'Dueña del Valle', 'es', true),
  ('b1000000-0000-4000-8000-000000000002', 'e000000b-0000-4000-8000-000000000000',
   'b0000000-0000-4000-8000-000000000002', 'pm', 'PM uno del Valle', 'es', true),
  ('b1000000-0000-4000-8000-000000000003', 'e000000b-0000-4000-8000-000000000000',
   'b0000000-0000-4000-8000-000000000003', 'pm', 'PM dos del Valle', 'es', true);

-- ------------------------------------------------------------------ obras
-- Empresa A: OB-001 de Carlos, OB-002 de Luis, OB-003 de Carlos ya entregada. Empresa B: su propia OB-001.
insert into public.obras (id, empresa_id, folio, cliente, telefono_cliente, direccion, pm_id,
                          fecha_inicio, fecha_fin_estimada, estado) values
  ('a2000000-0000-4000-8000-000000000001', 'e000000a-0000-4000-8000-000000000000', 'OB-001',
   'Familia García', '512-555-0101', '1200 Oak St, Austin, TX', 'a1000000-0000-4000-8000-000000000002',
   '2026-10-05', '2026-10-30', 'en_obra'),
  ('a2000000-0000-4000-8000-000000000002', 'e000000a-0000-4000-8000-000000000000', 'OB-002',
   'Familia Smith', '512-555-0102', '45 Elm Ave, Austin, TX', 'a1000000-0000-4000-8000-000000000003',
   '2026-10-12', '2026-11-06', 'lista_para_arranque'),
  ('a2000000-0000-4000-8000-000000000003', 'e000000a-0000-4000-8000-000000000000', 'OB-003',
   'Familia López', '512-555-0103', '9 Pine Rd, Austin, TX', 'a1000000-0000-4000-8000-000000000002',
   '2026-08-03', '2026-08-28', 'entregada'),
  ('b2000000-0000-4000-8000-000000000001', 'e000000b-0000-4000-8000-000000000000', 'OB-001',
   'Familia Pérez', '210-555-0101', '300 River Walk, San Antonio, TX', 'b1000000-0000-4000-8000-000000000002',
   '2026-10-05', '2026-10-30', 'en_obra');

-- Los folios (OB-001…) los asigna la base al insertar: los que aparecen aquí y abajo se reemplazan.

-- ------------------------------------------------------------------ un renglón en cada tabla
-- Para probar la muralla financiera, cada tabla necesita renglones en las dos empresas: que un PM vea cero
-- renglones de una tabla vacía no demuestra nada.

-- Catálogo mínimo de una empresa.
create function pg_temp.catalogo(p_empresa uuid) returns void
language plpgsql as $$
declare
  t_bano uuid; of_plom uuid; et_demo uuid; et_plom uuid; pc1 uuid; pc3 uuid; tr_hora uuid; tr_dia uuid;
begin
  insert into public.tipos_espacio (empresa_id, nombre_es, nombre_en, es_generales, orden)
    values (p_empresa, 'Generales de obra', 'General conditions', true, 0);
  insert into public.tipos_espacio (empresa_id, nombre_es, nombre_en, orden)
    values (p_empresa, 'Baño', 'Bathroom', 1) returning id into t_bano;
  insert into public.oficios (empresa_id, nombre_es, nombre_en, requiere_licencia)
    values (p_empresa, 'Plomería', 'Plumbing', true) returning id into of_plom;
  insert into public.oficios (empresa_id, nombre_es, nombre_en) values (p_empresa, 'Tile', 'Tile');
  insert into public.etapas (empresa_id, nombre_es, nombre_en, orden)
    values (p_empresa, 'Demolición', 'Demolition', 1) returning id into et_demo;
  insert into public.etapas (empresa_id, nombre_es, nombre_en, orden)
    values (p_empresa, 'Plomería', 'Plumbing', 2) returning id into et_plom;
  insert into public.hitos_calidad (empresa_id, clave, nombre_es, nombre_en, orden)
    values (p_empresa, 'PC1', 'Post demolición', 'Post demolition', 1) returning id into pc1;
  insert into public.hitos_calidad (empresa_id, clave, nombre_es, nombre_en, orden, exige_prueba_agua)
    values (p_empresa, 'PC3', 'Impermeabilización', 'Waterproofing', 3, true) returning id into pc3;
  insert into public.puntos_control (empresa_id, hito_id, orden, texto_es, requiere_foto) values
    (p_empresa, pc1, 1, 'Estructura visible sin daño por agua ni termita', true),
    (p_empresa, pc3, 1, 'Refuerzo en esquinas, juntas y penetraciones', true);
  insert into public.plantillas_partida
    (empresa_id, tipo_espacio_id, orden, nombre_es, hito_id, peso, dias, responsable, oficio_id, etapa_id) values
    (p_empresa, t_bano, 1, 'Demolición y retiro de escombro', pc1, 2, 2, 'cuadrilla', null, et_demo),
    (p_empresa, t_bano, 2, 'Rough de plomería', null, 3, 2, 'subcontratista', of_plom, et_plom);
  insert into public.subcontratistas (empresa_id, nombre, oficio_id, telefono, seguro_vence, licencia, w9)
    values (p_empresa, 'Plomería Rápida', of_plom, '512-555-0200', '2027-06-30', 'M-12345', true);
  insert into public.trabajadores (empresa_id, nombre, puesto, tipo_pago)
    values (p_empresa, 'Pedro', 'Ayudante', 'hora') returning id into tr_hora;
  insert into public.trabajadores (empresa_id, nombre, puesto, tipo_pago)
    values (p_empresa, 'Juan', 'Oficial', 'dia') returning id into tr_dia;
  insert into public.tarifas_trabajador (empresa_id, trabajador_id, tarifa, vigente_desde) values
    (p_empresa, tr_hora, 22.50, '2026-01-01'), (p_empresa, tr_dia, 220, '2026-01-01');
  insert into public.metas_indicadores (empresa_id, indicador, meta) values (p_empresa, 'tasa_cierre_dia', 0.95);
end $$;

-- Una obra con renglones en cada tabla que cuelga de ella. n numera los folios dentro de la empresa.
create function pg_temp.obra_completa(p_empresa uuid, p_obra uuid, p_pm uuid, p_dueno uuid, n int) returns void
language plpgsql as $$
declare
  f text := lpad(n::text, 3, '0');
  t_gen uuid; t_bano uuid; s_gen uuid; s_bano uuid; p_demo uuid; p_plom uuid; pc1 uuid; punto uuid;
  et_demo uuid; sub uuid; tr uuid; bit uuid; ot uuid; ot_pagada uuid; insp uuid; aviso uuid;
begin
  select id into t_gen from public.tipos_espacio where empresa_id = p_empresa and es_generales;
  select id into t_bano from public.tipos_espacio where empresa_id = p_empresa and nombre_es = 'Baño';
  select id into pc1 from public.hitos_calidad where empresa_id = p_empresa and clave = 'PC1';
  select id into punto from public.puntos_control where hito_id = pc1;
  select id into et_demo from public.etapas where empresa_id = p_empresa and nombre_es = 'Demolición';
  select id into sub from public.subcontratistas where empresa_id = p_empresa;
  select id into tr from public.trabajadores where empresa_id = p_empresa and tipo_pago = 'hora';

  insert into public.obras_finanzas (obra_id, empresa_id, contrato_original) values (p_obra, p_empresa, 24000);
  insert into public.espacios (empresa_id, obra_id, tipo_espacio_id, nombre, orden)
    values (p_empresa, p_obra, t_gen, 'Generales de obra', 0) returning id into s_gen;
  insert into public.espacios (empresa_id, obra_id, tipo_espacio_id, nombre, orden, pies2_cotizados)
    values (p_empresa, p_obra, t_bano, 'Baño principal', 1, 45) returning id into s_bano;
  insert into public.partidas_obra (empresa_id, obra_id, espacio_id, plantilla_id, orden, nombre_es, hito_id,
                                    peso, dias, responsable, oficio_id, etapa_id)
    select p_empresa, p_obra, s_bano, pl.id, pl.orden, pl.nombre_es, pl.hito_id, pl.peso, pl.dias, pl.responsable,
           pl.oficio_id, pl.etapa_id
    from public.plantillas_partida pl where pl.tipo_espacio_id = t_bano;
  select id into p_demo from public.partidas_obra where espacio_id = s_bano and orden = 1;
  select id into p_plom from public.partidas_obra where espacio_id = s_bano and orden = 2;

  insert into public.presupuesto_etapas (empresa_id, obra_id, espacio_id, etapa_id, monto)
    values (p_empresa, p_obra, s_bano, et_demo, 1500);
  insert into public.plan_semanal (empresa_id, semana, obra_id, partida_obra_id, fin_previsto)
    values (p_empresa, '2026-10-05', p_obra, p_demo, '2026-10-06');

  insert into public.bitacora (empresa_id, folio, obra_id, dia, fotos_comprometidas, creado_por)
    values (p_empresa, 'BIT-0' || f, p_obra, '2026-10-05', 1, p_pm) returning id into bit;
  insert into public.bitacora_partidas (empresa_id, obra_id, bitacora_id, partida_obra_id)
    values (p_empresa, p_obra, bit, p_demo);
  insert into public.avance (empresa_id, obra_id, partida_obra_id, bitacora_id, estado, dia, creado_por)
    values (p_empresa, p_obra, p_demo, bit, 'terminada', '2026-10-05', p_pm);
  insert into public.mano_obra (empresa_id, obra_id, espacio_id, partida_obra_id, trabajador_id, cantidad, dia,
                                bitacora_id, creado_por)
    values (p_empresa, p_obra, s_bano, p_demo, tr, 8, '2026-10-05', bit, p_pm);
  insert into public.gastos (empresa_id, folio, obra_id, espacio_id, dia, categoria, proveedor, monto, metodo_pago,
                             origen, creado_por) values
    (p_empresa, 'GTO-' || f || '1', p_obra, s_gen, '2026-10-05', 'material', 'Home Depot', 120, 'tarjeta_empresa',
     'pm', p_pm),
    (p_empresa, 'GTO-' || f || '2', p_obra, s_bano, '2026-10-05', 'material', 'Ferguson', 2500, 'transferencia',
     'oficina', p_dueno);
  insert into public.avisos (empresa_id, folio, obra_id, tipo, descripcion, creado_por)
    values (p_empresa, 'BLQ-0' || f, p_obra, 'condicion_oculta', 'Hay humedad detrás del muro de la regadera', p_pm)
    returning id into aviso;
  insert into public.inspecciones (empresa_id, obra_id, espacio_id, hito_id, partida_obra_id, resultado, puntos_ok,
                                   puntos_total, creado_por)
    values (p_empresa, p_obra, s_bano, pc1, p_demo, 'aprobado', 1, 1, p_pm) returning id into insp;
  insert into public.inspeccion_respuestas (empresa_id, obra_id, inspeccion_id, punto_control_id, texto_es, respuesta)
    values (p_empresa, p_obra, insp, punto, 'Estructura visible sin daño por agua ni termita', 'cumple');
  insert into public.pruebas_agua (empresa_id, obra_id, espacio_id, inicio, fin, resultado, creado_por)
    values (p_empresa, p_obra, s_bano, '2026-10-12 08:00-05', '2026-10-13 09:00-05', 'sin_fugas', p_pm);
  insert into public.punch_list (empresa_id, folio, obra_id, item, fecha_compromiso, creado_por)
    values (p_empresa, 'PUN-0' || f, p_obra, 'Silicón disparejo en el vanity', '2026-10-30', p_pm);
  insert into public.fotos (empresa_id, obra_id, ref_tipo, ref_id, indice, storage_path, creado_por)
    values (p_empresa, p_obra, 'bitacora', bit, 1, p_empresa || '/' || p_obra || '/bitacora/' || bit || '-1.jpg', p_pm);

  -- una orden vigente y una ya pagada: el PM nunca ve la pagada (D-017)
  insert into public.ordenes_trabajo (empresa_id, folio, obra_id, subcontratista_id, espacio_id, partida_obra_id,
                                      alcance, inicio_programado, fin_programado, estado)
    values (p_empresa, 'OT-' || f || '1', p_obra, sub, s_bano, p_plom, 'Rough de plomería del baño',
            '2026-10-07', '2026-10-08', 'emitida') returning id into ot;
  insert into public.ordenes_trabajo (empresa_id, folio, obra_id, subcontratista_id, espacio_id, partida_obra_id,
                                      alcance, inicio_programado, fin_programado, estado)
    values (p_empresa, 'OT-' || f || '2', p_obra, sub, s_bano, p_plom, 'Ajuste de presión',
            '2026-10-01', '2026-10-01', 'pagada') returning id into ot_pagada;
  insert into public.ordenes_trabajo_precios (orden_trabajo_id, empresa_id, precio) values
    (ot, p_empresa, 2000), (ot_pagada, p_empresa, 300);
  insert into public.pagos_sub (empresa_id, folio, obra_id, orden_trabajo_id, fecha, concepto, monto) values
    (p_empresa, 'PAG-' || f || '1', p_obra, ot, '2026-10-06', 'anticipo', 500),
    (p_empresa, 'PAG-' || f || '2', p_obra, ot_pagada, '2026-10-02', 'liquidacion', 300);
  insert into public.bitacora_subs (empresa_id, obra_id, bitacora_id, orden_trabajo_id, llego)
    values (p_empresa, p_obra, bit, ot, true);

  -- propuesta, autorizada y facturada: el PM solo ve las dos últimas, y sin condición de pago (D-017)
  insert into public.ordenes_cambio (empresa_id, folio, obra_id, fecha_hallazgo, motivo, descripcion, dias_impacto,
                                     estado, autorizada_en, facturada_en, condicion_pago, aviso_id) values
    (p_empresa, 'OC-' || f || '1', p_obra, '2026-10-06', 'condicion_oculta', 'Cambiar tubería galvanizada', 2,
     'propuesta', null, null, 'Al autorizar', aviso),
    (p_empresa, 'OC-' || f || '2', p_obra, '2026-10-06', 'solicitud_cliente', 'Nicho adicional en la regadera', 1,
     'autorizada', now(), null, '50% al autorizar', null),
    (p_empresa, 'OC-' || f || '3', p_obra, '2026-10-06', 'cambio_seleccion', 'Tile de otra colección', 0,
     'facturada', now(), now(), 'Contra entrega', null);
  insert into public.ordenes_cambio_montos (orden_cambio_id, empresa_id, costo_estimado, precio_cliente)
    select id, p_empresa, 650, 1000 from public.ordenes_cambio where obra_id = p_obra;
  insert into public.no_calidad (empresa_id, folio, obra_id, tipo, causa, costo, descripcion, estado, cerrado_en)
    values (p_empresa, 'NC-0' || f, p_obra, 'retrabajo', 'error_instalacion', 180, 'Repetir una hilada de tile',
            'cerrado', now());
  insert into public.cobros (empresa_id, folio, obra_id, fecha, concepto, monto, metodo)
    values (p_empresa, 'COB-0' || f, p_obra, '2026-10-01', 'deposito', 7200, 'zelle');
  insert into public.entregas (empresa_id, obra_id, fecha_entrega, garantia_meses, garantia_vence)
    values (p_empresa, p_obra, '2026-10-30', 12, '2027-10-30');
  insert into public.correcciones (empresa_id, tabla, registro_id, accion, campo, antes, despues, motivo, creado_por)
    values (p_empresa, 'mano_obra', bit, 'editar', 'cantidad', '9', '8', 'Se capturó una hora de más', p_pm);
end $$;

-- El cierre de una obra entregada y sus históricos.
create function pg_temp.cierre(p_empresa uuid, p_obra uuid) returns void
language plpgsql as $$
begin
  insert into public.obras_cerradas (obra_id, empresa_id, fecha_inicio, fecha_fin_real, dias_ciclo,
    contrato_original, monto_oc, contrato_final, presupuestado, materiales, cuadrilla, subcontratos, costo_total,
    margen_bruto, desviacion_estimacion, cobrado, no_calidad, dias_reportados, pies2)
  values (p_obra, p_empresa, '2026-08-03', '2026-08-28', 25, 24000, 1000, 25000, 15000, 5200, 4100, 6300, 15600,
          0.376, 0.04, 25000, 180, 19, 45);
  insert into public.historico_etapas (empresa_id, obra_id, espacio_id, tipo_espacio_id, etapa_id, presupuestado,
                                       costo_real, pies2, costo_por_pie2)
    select p_empresa, p_obra, s.id, s.tipo_espacio_id, pe.etapa_id, pe.monto, 1620, 45, 36
    from public.presupuesto_etapas pe join public.espacios s on s.id = pe.espacio_id where pe.obra_id = p_obra;
  insert into public.historico_duraciones (empresa_id, obra_id, partida_obra_id, tipo_espacio_id, plantilla_id,
                                           dias_planeados, dias_reales)
    select p_empresa, p_obra, p.id, s.tipo_espacio_id, p.plantilla_id, p.dias, p.dias + 1
    from public.partidas_obra p join public.espacios s on s.id = p.espacio_id where p.obra_id = p_obra;
end $$;

select pg_temp.catalogo('e000000a-0000-4000-8000-000000000000');
select pg_temp.catalogo('e000000b-0000-4000-8000-000000000000');
select pg_temp.obra_completa('e000000a-0000-4000-8000-000000000000', 'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 1);
select pg_temp.obra_completa('e000000a-0000-4000-8000-000000000000', 'a2000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 2);
select pg_temp.obra_completa('e000000a-0000-4000-8000-000000000000', 'a2000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 3);
select pg_temp.obra_completa('e000000b-0000-4000-8000-000000000000', 'b2000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 1);
select pg_temp.cierre('e000000a-0000-4000-8000-000000000000', 'a2000000-0000-4000-8000-000000000003');

-- Un dispositivo verificado por cada PM activo.
insert into public.dispositivos (empresa_id, miembro_id, nombre)
  select empresa_id, id, 'Celular de ' || nombre from public.miembros where rol = 'pm' and activo;

-- Fotos de recibos y de órdenes de cambio: el recibo de una compra de la oficina y la foto de una orden de cambio
-- viven en la carpeta de la obra, pero el PM no debe verlos (revisión del paso 4). El recibo de su propio gasto sí.
insert into public.fotos (empresa_id, obra_id, ref_tipo, ref_id, indice, storage_path, creado_por)
  select g.empresa_id, g.obra_id, 'gasto', g.id, 1,
         g.empresa_id || '/' || g.obra_id || '/gasto/' || g.id || '-1.jpg', g.creado_por
  from public.gastos g;
insert into public.fotos (empresa_id, obra_id, ref_tipo, ref_id, indice, storage_path, creado_por)
  select oc.empresa_id, oc.obra_id, 'orden_cambio', oc.id, 1,
         oc.empresa_id || '/' || oc.obra_id || '/orden_cambio/' || oc.id || '-1.jpg', null
  from public.ordenes_cambio oc;

-- Feriados (D-028): IJM descansa Thanksgiving y trabaja el 24 de diciembre; la otra empresa descansa Thanksgiving.
insert into public.feriados (empresa_id, dia, nombre_es, nombre_en, se_trabaja) values
  ('e000000a-0000-4000-8000-000000000000', '2026-11-26', 'Día de Acción de Gracias', 'Thanksgiving', false),
  ('e000000a-0000-4000-8000-000000000000', '2026-12-24', 'Nochebuena', 'Christmas Eve', true),
  ('e000000b-0000-4000-8000-000000000000', '2026-11-26', 'Día de Acción de Gracias', 'Thanksgiving', false);
