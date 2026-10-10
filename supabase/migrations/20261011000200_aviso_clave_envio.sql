-- Fase 2, paso 6c · La clave de envío de un aviso (D-050), como la de un cierre (D-042) y la de un gasto (D-049).
-- El PM levanta avisos sin señal y van a la cola del teléfono; si la señal se corta después de que el servidor guardó
-- el aviso, el reintento llega con la misma clave y recibe el aviso que ya existe, en lugar de duplicarlo.
alter table public.avisos add column clave_envio uuid;
create unique index avisos_clave_envio_unica on public.avisos (empresa_id, clave_envio)
  where clave_envio is not null;
