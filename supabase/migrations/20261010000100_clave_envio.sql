-- Fase 2, paso 5 · La clave de envío de un cierre (D-042). El teléfono le pone a cada cierre una clave al azar
-- cuando lo captura. Si la señal se corta después de que el servidor lo guardó, el reintento llega con la misma
-- clave y recibe el cierre que ya existe, en lugar de chocar con "ese día ya está cerrado" o duplicarlo.
alter table public.bitacora add column clave_envio uuid;
create unique index bitacora_clave_envio_unica on public.bitacora (empresa_id, clave_envio)
  where clave_envio is not null;
