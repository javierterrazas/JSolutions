-- Un gasto que el PM corrige arriba de su límite de compra vuelve a la revisión del dueño, como uno nuevo (D-054;
-- revisión de seguridad de la fase 2). Antes, registrar $10 y corregirlo a $5,000 dentro de las 48 h lo dejaba fuera
-- de "compras por revisar"; el legacy hacía lo mismo.
--
-- Lo hace la base y no el servidor: el PM no puede cambiar `revision` (limitar_columnas_pm), así que tampoco puede
-- quitarse de la revisión. Este disparador corre después de esa revisión, porque los disparadores de una tabla corren
-- en orden alfabético ("limitar…" antes que "revisar…").
create function public.revisar_gasto_corregido() returns trigger
language plpgsql set search_path = '' as $$
declare
  limite numeric;
begin
  if public.rol_actual() is distinct from 'pm' or new.origen <> 'pm'
     or new.monto is not distinct from old.monto or new.revision is not distinct from 'pendiente' then
    return new;
  end if;
  select c.limite_compra_pm into limite from public.configuracion_pm c where c.empresa_id = new.empresa_id;
  if coalesce(limite, 0) > 0 and new.monto > limite then
    new.revision := 'pendiente';
  end if;
  return new;
end $$;

create trigger revisar_gasto_corregido before update on public.gastos for each row
  execute function public.revisar_gasto_corregido();
