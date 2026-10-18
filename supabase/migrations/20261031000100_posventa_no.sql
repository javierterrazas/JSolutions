-- Después de la entrega, cada paso puede quedar en "No" (D-098; lo pidió el dueño): el cliente no quiso dejar reseña o
-- no autorizó las fotos. Así el paso queda resuelto y deja de salir en los pendientes, en vez de esperar para siempre
-- a que se marque como hecho. Los pasos que quedaron en "No", en una lista.
alter table public.entregas
  add column pasos_no text[] not null default '{}'
    check (pasos_no <@ array['autoriza_fotos', 'resena_pedida', 'resena_recibida', 'referido_pedido']);
