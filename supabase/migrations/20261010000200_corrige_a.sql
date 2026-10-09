-- Fase 2 · Corregir un cierre (D-044). El cierre corregido se anula y se vuelve a cerrar el mismo día; el nuevo dice
-- a cuál corrige. Las fotos se quedan donde se subieron (un archivo se registra una sola vez): las de un cierre son
-- las suyas y las de los cierres que corrige.
alter table public.bitacora add column corrige_a uuid references public.bitacora (id);
create index on public.bitacora (corrige_a) where corrige_a is not null;
