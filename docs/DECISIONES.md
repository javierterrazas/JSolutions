# Registro de decisiones

Cada decisión de diseño, y cada diferencia intencional con el legacy, se anota aquí: qué se decidió, por qué
y qué se descartó. Antes de cambiar algo de esta lista, se discute.

## D-001 · Stack

**Decisión:** Next.js (App Router) + TypeScript, Supabase (PostgreSQL, Auth, Storage, RLS), Drizzle, Vitest,
Playwright, next-intl, Vercel; Stripe en la fase 4.
**Por qué:** el legacy es JavaScript, así que las reglas pasan casi tal cual a TypeScript; PostgreSQL con RLS
resuelve la multiempresa y la muralla financiera en la base; es el stack más común para software por
suscripción.
**Descartado:** Firebase (los datos son muy relacionales); Django o Rails (un segundo lenguaje); apps nativas
(por ahora basta una PWA).

## D-002 · La muralla financiera vive en la base de datos

**Decisión:** el dinero va en tablas propias (`obras_finanzas`, `tarifas_trabajador`, `presupuesto_etapas`,
`ordenes_trabajo_precios`, `ordenes_cambio_montos`, `pagos_sub`, `cobros`, `no_calidad`, `obras_cerradas`,
`historico_etapas`) con RLS solo para dueño y administrador.
**Por qué:** RLS filtra renglones, no columnas; separar el dinero en tablas hace que un PM no pueda leerlo
aunque el código de la app tenga un error. En el legacy la muralla dependía de que el servidor del PM no
leyera esas hojas.

## D-003 · Multiempresa

**Decisión:** `empresa_id` en toda tabla de negocio, RLS por empresa, y el `service role` solo en migraciones,
importación y tareas programadas.

## D-004 · Presupuesto solo por etapa

**Decisión:** solo existe `presupuesto_etapas`. Los renglones antiguos del legacy, por partida, se convierten a
su etapa en el importador de la fase 3.

## D-005 · Folios por empresa

**Decisión:** llave `uuid` y folio legible por empresa (`OB-001`, `BIT-0001`) desde la tabla `folios`,
incrementada dentro de la transacción.
**Por qué:** el legacy calculaba el siguiente número leyendo la última fila de la hoja, y eso llegó a repetir
números cuando había notas al pie.

## D-006 · Días de negocio en la zona horaria de la empresa

**Decisión:** `date` para días de negocio y `timestamptz` para momentos; "hoy", días hábiles y plazos en la
zona de la empresa (por defecto `America/Chicago`). Una fecha capturada `2026-10-30` es ese día local.
**Por qué:** el legacy tuvo un error de un día al interpretar fechas capturadas como medianoche UTC.

## D-007 · Fotos en su propia tabla

**Decisión:** tabla `fotos` con `unique (ref_tipo, ref_id, indice)`; los archivos en Supabase Storage.
Las fotos pendientes de un cierre se calculan contra `bitacora.fotos_comprometidas`.
**Por qué:** conserva la garantía del legacy — un reintento nunca duplica una foto — sin guardar enlaces
concatenados en texto.

## D-008 · Históricos guardados al cierre

**Decisión:** al cerrar una obra se guardan su costo real por etapa (`historico_etapas`) y sus duraciones
reales por partida (`historico_duraciones`).
**Por qué:** el legacy los recalculaba desde cero en cada carga, y eso crece con el tiempo.

## D-009 · Lo que no se traslada

La hoja `Errores` (se reemplaza por un servicio de registro de errores), el sello `ULTIMO_CAMBIO` (Supabase
Realtime), los respaldos y el chequeo de salud del libro (respaldos del proveedor y restricciones de la base),
y los parches de Apps Script: candados, memoria por ejecución, numeración por última fila.

## D-010 · El dominio en español

**Decisión:** tablas, tipos y funciones del dominio en español sin acentos (`obras`, `espacios`, `etapas`,
`bitacora`); comentarios en español; textos visibles siempre por i18n.
**Por qué:** es el idioma del negocio y del legacy; traducir el dominio al inglés introduce errores de
significado.
