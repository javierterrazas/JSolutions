-- La foto de un cambio ya hecho (D-081). Va sola en su migración: un valor nuevo de un enum no se puede usar en la
-- misma transacción que lo agrega.
alter type public.tipo_foto add value 'cambio_hecho';
