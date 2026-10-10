-- Fase 2, paso 6b · La clave de envío de un gasto (D-049), como la de un cierre (D-042). El PM registra gastos sin
-- señal y van a la cola del teléfono; si la señal se corta después de que el servidor guardó el gasto, el reintento
-- llega con la misma clave y recibe el gasto que ya existe, en lugar de duplicarlo.
alter table public.gastos add column clave_envio uuid;
create unique index gastos_clave_envio_unica on public.gastos (empresa_id, clave_envio)
  where clave_envio is not null;
