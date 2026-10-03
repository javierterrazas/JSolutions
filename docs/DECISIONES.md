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

## D-011 · Herramientas del repositorio

**Decisión:** Node 22.12 o más reciente (`.nvmrc` y `engines`), pnpm 10 fijo en `packageManager`, TypeScript
6.0 con `strict` y `noUncheckedIndexedAccess`, ESLint 9 con typescript-eslint y la configuración de Next,
Prettier, y Vitest 5 con cuatro proyectos: `unidad`, `paridad`, `rls` e `integracion`. La CLI de Supabase es
dependencia de desarrollo del repositorio. Los paquetes internos (`@ijm/core`, `@ijm/db`) se publican como
TypeScript sin compilar y Next los transpila.
**Por qué:** Node 20 dejó de tener soporte en abril de 2026. TypeScript 7 todavía no es compatible con
typescript-eslint (que pide menos de 6.1). `noUncheckedIndexedAccess` atrapa el error típico del legacy: leer
`fila[9]` de una columna que no existe. Con la CLI en el repositorio, todos usan la misma versión.
**Descartado:** instalar la CLI de Supabase de forma global; compilar los paquetes internos (un paso más sin
beneficio mientras solo los use `apps/web`).

## D-012 · La paridad carga el legacy construido, en Node, sin Python

**Decisión:** las pruebas de paridad cargan `legacy/app/App_Dueno.gs` y `App_PM.gs` en una máquina virtual de
Node (`packages/core/pruebas/paridad/legacy.ts`), con una simulación mínima de Apps Script y un "ahora"
controlable. Corren con `TZ=America/Chicago`.
**Por qué:** son los archivos que de verdad se publican. `legacy/correr_pruebas.sh` depende de rutas fijas de
Linux (`/tmp`, `/home/claude`) y de Python con openpyxl; el legacy es de solo lectura, así que no se adapta: se
reproduce su `harness.js` en TypeScript.

## D-013 · Columnas que el PM no debe ver

**Decisión:** el dinero siempre va en tablas propias (D-002). Las columnas que no son dinero pero que el PM no
debe ver, en tablas que sí lee (`configuracion`, `subcontratistas`, `empresas`, `entregas`,
`ordenes_cambio`), se le exponen mediante **vistas** `security_invoker` con solo las columnas permitidas; la
tabla completa queda solo para dueño y administrador.
**Por qué:** RLS filtra renglones, no columnas. Partir cada tabla por cada columna sensible llena el esquema de
tablas de una sola fila; los permisos por columna (`GRANT` por columna) son frágiles con Supabase y fáciles de
romper al agregar una columna.
**Descartado:** permisos por columna; una tabla aparte por cada grupo de columnas que no son dinero.

## D-014 · Dos medidas por espacio: la cotizada y la verificada

**Decisión:** cada espacio guarda los pies² (y pies lineales) **cotizados**, capturados por el dueño en el alta,
y los **verificados** en sitio por el PM, con quién y cuándo. El PM los captura mediante una función del
servidor, que deja rastro en `correcciones`. Los costos unitarios usan la verificada cuando existe.
`presupuesto_etapas.cantidad` no se guarda: se calcula de la medida vigente.
**Diferencia con el legacy:** `pmMedida` sobrescribía `Areas.pies2` y la medida cotizada se perdía (solo quedaba
en `Correcciones`). El presupuesto copiaba los pies² al guardarse y quedaba desactualizado al corregirlos.

## D-015 · Traducción de los datos del catálogo y de los mensajes

**Decisión:** los nombres que captura cada empresa (partidas, etapas, tipos de espacio, puntos de control y sus
preguntas) se guardan con `nombre_es` y `nombre_en`; se muestra el del idioma del usuario y, si falta, el otro.
`packages/core` y la capa del servidor no devuelven textos: devuelven un **código con sus datos** (por ejemplo
`{ codigo: 'faltan', campos: ['cliente', 'fecha_entrega'] }`), y la pantalla los traduce con next-intl.
**Por qué:** regla 8 de `CLAUDE.md`: ningún texto visible queda fijo en el código. El legacy traducía en el
navegador con un diccionario (`idioma_en.py`), sin poder traducir lo que el dueño agregaba.
**Paridad:** se compara el código y sus datos contra el mensaje del legacy, no el texto.

## D-016 · Una empresa por usuario

**Decisión:** en las fases 1 a 3 cada usuario pertenece a una sola empresa (`miembros.user_id` es único).
`empresa_actual()` y `rol_actual()` se leen de `miembros` en cada consulta, para el usuario de la sesión, si el
miembro y su empresa están activos.
**Ajustada en el paso 3:** la primera versión leía la empresa y el rol de los datos de la sesión de Auth
(`app_metadata`). Se descartó porque esos datos viven en el token hasta una hora: un PM dado de baja seguiría
entrando. Leyendo `miembros`, la baja corta el acceso en ese instante, como en el legacy (`usuarioActivo_`).
**Por qué:** es lo que necesitan los contratistas piloto, y simplifica las políticas. Se puede ampliar a varias
empresas con un selector sin cambiar las tablas de negocio, porque todas llevan `empresa_id`.

## D-017 · Lo que ve el PM sigue al legacy

**Decisión:** donde el modelo de datos y el legacy no coincidían, manda el legacy:
- **Órdenes de trabajo:** el PM ve solo las emitidas, confirmadas y aprobadas. Nunca las pagadas ni las
  canceladas: el estado "pagada" revela pagos.
- **Órdenes de cambio:** el PM ve las autorizadas y las facturadas, con descripción, días de impacto y fecha
  de autorización; nunca costo, precio, margen, condición de pago ni fecha de cobro.
- **Avisos:** el PM ve solo los que él levantó, con su respuesta.

## D-018 · Llaves foráneas compuestas: la base impide cruzar empresas y obras

**Decisión:** cada tabla de negocio tiene `unique (empresa_id, id)` y se referencia con llaves compuestas
`(empresa_id, x_id)`. Lo que cuelga de una obra se referencia con `(obra_id, x_id)`, y las partidas desde un
espacio con `(espacio_id, partida_obra_id)`.
**Por qué:** RLS evita que un usuario **lea** otra empresa, pero no evita que un error del servidor **escriba**
un registro de la empresa A que apunte a algo de la B, ni un avance de una obra sobre la partida de otra. Con
llaves compuestas, la base lo rechaza. Cuesta un índice único más por tabla.
**Descartado:** llaves simples confiando en el servidor; disparadores de validación.

## D-019 · Metas de los indicadores en su propia tabla

**Decisión:** `metas_indicadores (empresa_id, indicador, meta)`. Sin renglón, vale la meta del legacy, que vive
en `packages/core`. Se conservan en `configuracion` `IMPUESTO` y `UMBRAL_OC_MENOR`, aunque el código del legacy
no los usa: están en su libro y el dueño los captura.
**Por qué:** solo 5 de las 19 metas estaban en Config (`META_*`, `MAX_*`); las demás estaban fijas en el código
(por ejemplo, PPC = 0.8). `CLAUDE.md` pide metas configurables.

## D-020 · Listas fijas como `enum`, con los valores del legacy

**Decisión:** estados y listas fijas son tipos `enum` de PostgreSQL, en forma canónica sin acentos
(`condicion_oculta`, `tarjeta_empresa`), traducidos al mostrarse (D-015). Los valores salen del código del
legacy y de sus pantallas: categorías de gasto, tipos de aviso, orígenes del punch list, motivos de orden de
cambio, conceptos y métodos de pago, causas de no calidad, motivos de "hoy no hubo trabajo".
**Cuidado:** a un `enum` se le pueden agregar valores, pero quitar uno exige una migración más cuidadosa.
Lo que cada empresa define (tipos de espacio, oficios, etapas, puntos de control) es tabla, no `enum`.

## D-021 · Lo que el legacy deducía del texto ahora son columnas

**Decisión:** `tipos_espacio.es_generales` (antes, el tipo se llamaba "Generales"); `oficios.requiere_licencia`
(antes, una expresión sobre el nombre del oficio); `hitos_calidad.exige_prueba_agua` (antes, el nombre empezaba
con "PC3"); `responsable` = `cuadrilla` / `pm` / `subcontratista` con su `oficio_id` (antes, el texto de
`quien`). Tipos de espacio, oficios, etapas y puntos de control son tablas con nombre en dos idiomas.
**Por qué:** con los nombres traducibles (D-015), deducir reglas del texto se rompe en cuanto alguien renombra
algo o lo escribe en inglés. **Paridad:** el importador de la fase 3 llena estas columnas con las mismas reglas
del legacy.

## D-022 · Ajustes al modelo propuesto

- **`espacio_id` en `gastos` y `mano_obra`**, con la partida opcional: un gasto sin partida va a Generales de
  obra, como en el legacy.
- **`bitacora_id` en `avance` y `mano_obra`:** anular un cierre encuentra sus registros por la llave, no por
  obra, día y usuario.
- **Un solo cierre vigente por obra y día**, con un índice único parcial. El legacy lo revisaba en el código.
- **`inspeccion_respuestas`**, una tabla hija con la respuesta a cada pregunta y su texto de ese día, en lugar
  de listas de defectos y de "no aplica" en texto.
- **La orden de cambio apunta al aviso** del que salió (`aviso_id`), y el aviso no apunta a la orden: la misma
  información en un solo sentido, sin llaves circulares.
- **`creado_por` es el miembro** que capturó el registro; quién lo hizo dentro de la empresa, no la cuenta de
  Auth.
- **Folios** solo donde una persona los lee o los cita: OB, BIT, GTO, BLQ, PUN, OT, PAG, OC, NC, COB.
  El cierre tardío del dueño ya no usa prefijos propios (BIA, AVA, MOA): con transacciones no hace falta.

## D-023 · El esquema de Drizzle se genera desde las migraciones

**Decisión:** las migraciones SQL son la fuente de verdad. `pnpm db:esquema` genera
`packages/db/src/esquema/generado/schema.ts` desde la base local (drizzle-kit pull) y corrige lo que el
generador deja mal (la referencia a `auth.users`, un archivo de relaciones inválido). Una prueba compara tablas,
columnas y nulos del esquema contra la base, y falla si alguien cambió una migración sin regenerarlo.
**Por qué:** escribir el mismo esquema dos veces, en SQL y en TypeScript, garantiza que tarde o temprano digan
cosas distintas. RLS, funciones y políticas solo se pueden expresar en SQL.
**Descartado:** escribir el esquema de Drizzle a mano; generar las migraciones desde Drizzle (no expresa RLS ni
las llaves compuestas con la claridad que hace falta revisar).

## D-024 · El PM entra con un PIN en un dispositivo verificado

**Decisión del dueño (decisión pendiente 2 del plan).** El dueño invita al PM por teléfono o correo; la primera
vez, el PM abre la invitación en **su** celular y ese dispositivo queda verificado. Ahí elige un PIN, y desde
entonces entra en ese celular solo con el PIN.
**Cómo se arma:** el PIN desbloquea la sesión de Supabase Auth guardada en ese dispositivo; no sirve en otro
aparato. Así el PM también puede abrir la app sin señal. Cuando hay conexión, el servidor revisa el PIN contra
su hash (`dispositivos.pin_hash`), con límite de intentos: 5 fallidos seguidos bloquean 15 minutos, como en el
legacy (un PIN de 4 dígitos sin límite se adivina). El dueño ve los dispositivos de cada PM y puede revocar uno
(`revocado_en`) sin tocar los demás.
**En la fase 1:** solo la tabla `dispositivos`. La invitación, la verificación y la entrada con PIN se construyen
con las pantallas del PM (fase 2). Los usuarios de prueba entran con correo y contraseña.
**Descartado:** código por mensaje cada vez (la señal en obra es mala); correo y contraseña (lento en el
teléfono, al final del día).
