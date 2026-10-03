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

insert into public.folios (empresa_id, prefijo, ultimo) values
  ('e000000a-0000-4000-8000-000000000000', 'OB', 3),
  ('e000000b-0000-4000-8000-000000000000', 'OB', 1);
