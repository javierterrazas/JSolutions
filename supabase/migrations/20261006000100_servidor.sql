-- Paso 6 · Lo que la capa del servidor necesita de la base, con la identidad del usuario (D-026, D-035).

-- ------------------------------------------------------------------ el PM arranca su obra
-- La obra pasa de "lista para arranque" a "en obra" con su primer día de trabajo, y ese día lo cierra el PM. Es la
-- única edición del PM en obras: solo ese cambio de estado, solo en sus obras.
create policy "pm arranca su obra" on public.obras for update to servidor_app
  using (empresa_id = (select public.empresa_actual()) and id in (select public.obras_del_pm())
         and estado = 'lista_para_arranque')
  with check (empresa_id = (select public.empresa_actual()) and id in (select public.obras_del_pm())
              and estado = 'en_obra');
create trigger limitar_columnas_pm before update on public.obras for each row
  execute function public.limitar_columnas_pm('estado');

-- ------------------------------------------------------------------ la cuadrilla de un día, en todas las obras
-- Un trabajador no pasa de un día (o de 16 horas) sumando todas las obras de la empresa, aunque alguna sea de otro
-- PM que este no puede leer. Devuelve solo cantidades: ni tarifas ni montos.
create function public.cuadrilla_del_dia(p_dia date)
returns table (id uuid, trabajador_id uuid, obra_id uuid, cantidad numeric)
language sql stable security definer set search_path = '' as $$
  select m.id, m.trabajador_id, m.obra_id, m.cantidad
  from public.mano_obra m
  where m.empresa_id = public.empresa_actual() and m.dia = p_dia and m.estado = 'vigente'
$$;
grant execute on function public.cuadrilla_del_dia(date) to servidor_app;

-- ------------------------------------------------------------------ la foto la subió este usuario
-- Al registrar una foto, el servidor comprueba que el archivo existe en Storage y que lo subió el usuario de la
-- sesión: nadie registra como suya una foto que subió otro.
create function public.foto_subida(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from storage.objects o
    where o.bucket_id = 'fotos' and o.name = p_ruta and o.owner_id = auth.uid()::text
  )
$$;
grant execute on function public.foto_subida(text) to servidor_app;
