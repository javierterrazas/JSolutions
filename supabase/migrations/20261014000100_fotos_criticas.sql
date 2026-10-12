-- La foto de las inspecciones, solo donde protege (D-058; lo pidió el dueño: la app del PM tiene que ser lo más
-- sencilla posible). En las 38 preguntas estándar de los puntos de control, la foto queda solo en las 9 críticas del
-- legacy ("Foto solo en lo crítico", FOTO_CRITICA_): cómo estaba antes de empezar, lo que se tapa y no se vuelve a
-- ver, y cómo se entregó. Las preguntas que agregó cada empresa no se tocan. Las mismas listas viven en
-- packages/core/src/calidad.ts (pideFoto), que aplica la regla al cargar un libro.
--
-- Se comparan sin acentos, mayúsculas ni espacios de más: el libro de IJM escribe "dano" y "plomeria".
with estandar(texto, critica) as (values
  ('estructura visible sin dano por agua ni termita', true),
  ('material de la plomeria existente identificado (galvanizado, pex, cobre)', true),
  ('cableado sin aluminio; gfci presente donde aplica', false),
  ('subpiso nivelado, sin pudricion ni capas previas de tile', false),
  ('el extractor existente descarga al exterior, no al atico', false),
  ('muros medidos a nivel y plomo', false),
  ('sin evidencia de moho ni humedad previa', false),
  ('hallazgos levantados como aviso el mismo dia', false),
  ('prueba de presion de plomeria sostenida', true),
  ('drenaje con pendiente y ventilacion conectada', false),
  ('ubicaciones verificadas contra plano: regadera, desagues, salidas', false),
  ('blocking para barras, banco, nichos, toallero y vanity', false),
  ('circuitos dedicados y gfci en su lugar', false),
  ('extractor con ducto aislado al exterior y damper', false),
  ('alturas de salidas verificadas contra el diseno de tile', false),
  ('foto panoramica de cada muro completo antes de cubrir', true),
  ('sistema aplicado segun instrucciones del fabricante', false),
  ('refuerzo en esquinas, juntas y penetraciones', true),
  ('pre-pendiente y pendiente correctas hacia el desague', false),
  ('desague con brida y sello correctos', true),
  ('prueba de inundacion de 24 horas documentada', false),
  ('sin perforaciones posteriores a la prueba', false),
  ('tile a nivel, a plomo y con juntas alineadas', false),
  ('sin piezas huecas (golpear con nudillo)', false),
  ('lechada uniforme, sin faltantes y curada', false),
  ('sellador en los cambios de plano, no lechada', false),
  ('gabinetes nivelados, a plomo y anclados a blocking', true),
  ('puertas y cajones con holgura pareja', false),
  ('superficie a nivel antes de tomar plantilla de countertop', false),
  ('plomeria probada: llaves, desagues, sanitario, sin fugas bajo vanity', true),
  ('puerta de regadera alineada, sellada y sin roce', false),
  ('iluminacion y extractor funcionando (extractor probado con papel)', false),
  ('tomacorrientes probados; gfci disparado y reseteado', false),
  ('cajones y puertas ajustados', false),
  ('silicon parejo en todas las uniones', false),
  ('pintura sin marcas y tapas de registro colocadas', false),
  ('limpieza profunda hecha, incluye interior de gabinetes y vidrios', false),
  ('fotos finales para portafolio, misma toma que las del dia 1', true)
), puntos as (
  select p.id,
         btrim(regexp_replace(translate(lower(p.texto_es), 'áéíóúüñ', 'aeiouun'), '\s+', ' ', 'g')) as texto
  from public.puntos_control p
)
update public.puntos_control p
  set requiere_foto = e.critica
  from puntos x join estandar e on e.texto = x.texto
  where p.id = x.id and p.requiere_foto is distinct from e.critica;
