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
`ordenes_cambio`), se le exponen mediante **vistas** con solo las columnas permitidas; la tabla completa queda
solo para dueño y administrador. Las vistas son `empresa_actual_datos`, `configuracion_pm`, `subcontratistas_pm`,
`entregas_pm` y `ordenes_cambio_pm`.
**Corregida en el paso 4:** la primera versión decía vistas `security_invoker`. Así no funcionan: una vista
`security_invoker` aplica el RLS del que consulta, y como el PM no puede leer la tabla completa, la vista le
devolvería cero renglones. Las vistas son del dueño de la base y **cada una filtra por sí misma** (la empresa de
la sesión y, donde aplica, las obras del PM). Por eso cada vista tiene su prueba en `pnpm test:rls`.
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

## D-025 · Permisos de base

**Decisión** (ajustada por D-026 en el mismo paso 4):
- `anon` (sin sesión) no tiene ningún permiso: ni tablas, ni vistas, ni funciones, ni secuencias.
- `authenticated` (la API) **solo lee**, siempre bajo RLS. Nunca crea, edita, borra ni vacía (`truncate`).
  Supabase daba por defecto todos los permisos a los dos roles, incluido `truncate`, al que RLS no aplica.
- `servidor_app` (D-026) crea y edita bajo RLS, y nunca borra: nada se borra (regla 4).
- **Lo que se cree después nace cerrado.** Los permisos por defecto de tablas, vistas, secuencias y funciones
  nuevas no dan nada a `anon` ni a la API. Cuidado: el permiso de ejecutar que toda función nueva da a PUBLIC
  es global, y `alter default privileges in schema public` no lo quita. Hace falta la forma sin esquema. Una
  prueba crea una función, una vista, una secuencia y una tabla dentro de una transacción revertida y revisa
  que nazcan cerradas.
- **El PIN** (`dispositivos.pin_hash`, intentos y bloqueo) no lo lee nadie por la API, ni el propio miembro: se
  da `select` solo sobre las demás columnas (D-024).
- **Paridad:** gastos y avisos se muestran al PM por quién los registró, no por obra, como en el legacy
  (`sinRecibo`, `bloqueos`). Se ven también los de obras ya entregadas.

## D-026 · Por la API solo se lee; toda escritura pasa por el servidor

**Contexto:** la revisión independiente del paso 4 encontró que, con políticas de escritura para
`authenticated`, el PM podía saltarse las reglas escribiendo directo por la API. Lo comprobó ejecutando cada
caso:
- una prueba de agua "sin fugas" cerrada en 60 segundos;
- una inspección aprobada sin preguntas;
- 48 horas de un trabajador en un día;
- un gasto de $9,999,999;
- folios elegidos por él (y apartados);
- el autor y la fecha del punch list cambiados;
- correcciones falsas en la auditoría.

El dueño también editaba sin dejar rastro. Esas reglas cruzan renglones o viven en `packages/core`: RLS no
puede expresarlas.

**Decisión:**
- Por la API (rol `authenticated`), los usuarios **solo leen**.
- **Toda escritura la hace el servidor de la app** después de validar con `packages/core`:
  1. se conecta a la base;
  2. en cada transacción toma el rol **`servidor_app`** (`set local role servidor_app`);
  3. toma la identidad del usuario (`request.jwt.claims` con su `sub`);
  4. escribe junto con su rastro en `correcciones`.
- **RLS sigue protegiendo esas escrituras.** Las políticas de escritura son `to servidor_app` y repiten la regla
  completa (empresa, obras del PM, `creado_por` = el miembro de la sesión, estados permitidos). Un error del
  servidor no deja escribir en la obra de otro PM, cruzar empresas, llevar una orden a "pagada" ni registrar una
  compra de la oficina a nombre del PM. PostgREST no puede tomar `servidor_app`: el rol `authenticator` no es
  miembro de ese rol.
- **La base asigna y protege:**
  - el folio lo pone siempre un disparador, y lo que mande el servidor se ignora;
  - `empresa_id`, `creado_por`, `creado_en` y `folio` no se pueden cambiar después;
  - una foto vive en la carpeta de su empresa y su obra y apunta a un registro de esa misma obra.
  - El importador (fase 3) conserva folios y autores del legacy con `set local ijm.importando = 'si'`.
- **Fotos:**
  - Los usuarios **suben** directo a Storage (pesan y la señal es mala), solo a la carpeta de su obra, con
    límite de 15 MB e imágenes o PDF.
  - **No las leen directo:** el servidor revisa que el usuario pueda ver la fila de `fotos` (RLS) y le da un
    enlace firmado de pocos minutos. Así un enlace no sobrevive a una baja ni a la entrega de la obra.
  - Los recibos de la oficina y las fotos de órdenes de cambio no se le muestran al PM aunque estén en la
    carpeta de su obra.
- **Registro abierto apagado** (`enable_signup = false`): los miembros entran por invitación (D-024).

**Por qué:** "RLS es la última línea de defensa, no la única". Con escritura directa por la API era la única, y
no alcanza para las reglas de negocio. Así, las reglas las valida el servidor y la base sigue impidiendo lo
peor aunque el servidor falle.

**Consecuencias para el paso 6:**
- las funciones del servidor usan `servidor_app` con la identidad del usuario, nunca el `service_role` para
  operaciones de usuarios;
- escriben su rastro en `correcciones`;
- dan los enlaces firmados de las fotos.

**Descartado:**
- mantener las políticas de escritura para `authenticated` y agregar disparadores para cada regla: duplica
  `packages/core` en SQL;
- escribir con el `service_role`: RLS dejaría de proteger las escrituras;
- funciones `security definer` por cada flujo: la lógica de negocio quedaría en SQL y no en `packages/core`.

## D-027 · Lo que el servidor puede hacer a nombre de un usuario (segunda revisión del paso 4)

**Contexto:** una segunda revisión independiente confirmó que por la API nadie escribe, lee dinero, ve obras
ajenas ni ve otra empresa. Encontró que, actuando como el servidor con la identidad de un usuario, la base dejaba
hacer más de lo que D-026 promete. Todo se corrigió en `20261004000200_endurecer.sql`, con una prueba por hallazgo
en `packages/db/pruebas/rls/servidor.test.ts`.

**Decisión:**
- **El servidor se conecta con su propio usuario de base, `ijm_servidor`, nunca con `postgres`.** El usuario no
  hereda nada por sí solo y solo puede tomar `servidor_app`, así que un `reset role` o un camino que olvide el
  `set role` se queda sin permisos en lugar de saltarse RLS. La contraseña la pone quien despliega.
- **La marca de importación (`ijm.importando`)** solo cuenta para una sesión sin rol de usuario (el importador
  con el service role, o una conexión administrativa), nunca para `servidor_app`. Al importar un folio, el
  contador avanza hasta él.
- **La base pone `creado_por` (el miembro de la sesión) y `creado_en` (ahora) al crear**, mande lo que mande el
  servidor. Nadie, ni el dueño, crea registros a nombre de otro ni con fecha inventada.
- **`obra_id` tampoco cambia después**, igual que empresa, autor, fecha de creación y folio. Corregir la obra de
  un registro es anularlo y volver a registrarlo. **Diferencia con el legacy:** su corrección permitía cambiar
  `proyecto_id` de un gasto o de la mano de obra.
- **Lo que el PM edita, vía servidor, es una lista cerrada de columnas por tabla:**
  - órdenes de trabajo: estado, confirmación, llegada y aprobación. La aprobación va a su nombre, y una orden
    nunca regresa de estado;
  - espacios: solo la medida verificada;
  - gastos: lo que el legacy dejaba corregir, y nunca uno ya revisado;
  - bitácora: incidencia y anulación, nunca el día, la hora de envío ni la marca de tardío;
  - avance, cuadrilla, pruebas de agua y punch list: lo suyo.

  El dueño no tiene lista: sus ediciones las valida el servidor y dejan rastro en `correcciones`.
- **Lo que el PM cuelga de otro registro** (partidas o subs de un cierre, respuestas de una inspección, fotos)
  tiene que colgar de algo suyo o visible para él.
- **`validar_foto` no sirve de oráculo:** revisa primero la empresa y las obras de la sesión, da un solo
  mensaje, y falla cerrado si aparece un tipo de foto nuevo sin su regla.
- **La empresa la activa o desactiva el sistema**, no el dueño ni el admin.
- **El PIN solo lo lee el service role**, tampoco el servidor.
- **Las vistas no se escriben** y ya no hay permisos por defecto para `servidor_app`: cada migración que cree
  una tabla le da los suyos.

**Aceptado, con su razón:**
- **Una URL firmada de subida dura 2 h** y sobrevive a una baja. Solo sirve para subir a la carpeta de su obra,
  no para leer, y lo que se suba no se registra en `fotos` sin pasar por el servidor.
- **`Prefer: count=planned` deja ver el tamaño aproximado de tablas ajenas,** también de las de dinero. Es la
  estimación del planificador de PostgreSQL. No revela ningún dato.
- **Los huecos en los folios revelan cuántos registros que el PM no ve hay en su empresa,** por ejemplo
  órdenes pagadas o compras de la oficina. Es el costo de folios legibles y seguidos (D-005).
- **`servidor_app` puede bloquear una tabla** (`lock table`) porque edita. El servidor es código propio, y con
  `ijm_servidor` una inyección no pasa de lo que `servidor_app` puede hacer.
- **Las llaves foráneas distinguen un uuid que existe de uno inventado.** Exige conocer el uuid, que nunca se
  muestra fuera de su empresa.

**Para el paso 6 (el servidor):**
- conectarse como `ijm_servidor`;
- en **cada** transacción, `set local role servidor_app` y fijar **las dos** variables de identidad:
  `request.jwt.claims` y `request.jwt.claim.sub`. `auth.uid()` lee primero la segunda; si quedara puesta de
  antes, mandaría sobre la primera;
- generar rutas de foto aleatorias, no predecibles;
- dar enlaces firmados de lectura de pocos minutos.

**Antes de producción** (no está en `config.toml`, se configura en el proyecto de Supabase):
- contraseñas con requisitos, cambio de contraseña seguro, confirmación de correo y MFA para dueño y admin;
- nunca cargar `supabase/seed.sql` (sus usuarios comparten una contraseña conocida);
- no instalar extensiones en el esquema `public`: lo que crea `supabase_admin` ahí nace abierto, y la prueba
  de "nace cerrado" solo cubre lo que crean las migraciones;
- Realtime: sin canales públicos.

## D-028 · El calendario laboral es de cada empresa: de lunes a sábado por defecto, con feriados opcionales

**Decisión del dueño:** en IJM se trabaja también el sábado, y los feriados se trabajan o no según se decida.
- `configuracion.dias_laborables`: los días de la semana que se trabajan (ISO: 1 = lunes … 7 = domingo). Por
  defecto, de lunes a sábado.
- `feriados (dia, nombre, se_trabaja)`: un feriado se descansa salvo que se marque `se_trabaja`.
- `packages/core` recibe el calendario como argumento (`calendario(dias, feriadosDeDescanso)`) en todo lo que
  cuenta días laborables: cronograma, fecha comprometida, atraso, "Esta semana", días sin cierre, y después la
  ventana del cierre tardío y el punch list.
- La semana de trabajo va de lunes a domingo. El legacy la cortaba el viernes (`masHab_(lunes, 4)`); con su
  calendario da lo mismo, porque una partida nunca termina en día no laborable.
- La semana del PM se pide con el número de días que se quiera mostrar. El legacy mostraba 5; con el sábado
  laborable conviene mostrar 6.

**Diferencia intencional con el legacy,** que solo contaba de lunes a viernes, sin feriados. La paridad se prueba
con `CALENDARIO_LEGACY` (lunes a viernes). El calendario real tiene sus propias pruebas en `packages/core/src`:
sábado laborable, feriados, y una obra que arranca en feriado.

**Ejemplo:** un baño que arranca el lunes 5 de octubre de 2026 sigue tomando 20 días laborables. Con el sábado
laborable se entrega el martes 27, en vez del viernes 30.

## D-029 · Cómo se prueba la paridad

**Decisión:** el legacy corre de verdad en una máquina virtual de Node (D-012) con dos fuentes de datos.
- **El libro de ejemplo** (`Gestion_Obra_IJM.xlsx`), leído con un lector propio de `.xlsx` (`zlib` de Node, sin
  dependencias), que deja las fechas como las dejaba `openpyxl`.
- **El mes simulado del legacy** (`legacy/sim/`): 5 semanas con 2 PMs y 4 obras. Corre en una copia temporal, con
  las rutas corregidas como en `correr_pruebas.sh`. En esa copia, el reloj simulado guarda una foto de todas las
  hojas al terminar cada día: 31 días, con obras arrancando, a medias, atrasadas y entregadas. El resultado se
  guarda en caché mientras el legacy no cambie. Si el reporte del mes deja algún hallazgo (su propia prueba
  exige cero), la paridad se detiene.

Las hojas del legacy se convierten a las entradas de `packages/core`
(`packages/core/pruebas/paridad/convertir.ts`) con las mismas reglas de lectura del legacy. Así se adelanta lo
que hará el importador de la fase 3: renglones anulados fuera, espacio deducido para registros viejos, y oficio
de cada partida ligado al oficio de sub que empata por texto.

**Se comprobó que las pruebas tienen dientes:** dos cambios pequeños en `packages/core` hicieron fallar 5 pruebas
de paridad.

**Aprendido:** la primera versión del lector de `.xlsx` dejaba vacías las hojas con un renglón en blanco en medio
(entre ellas `Trabajadores`), y el mes simulado lo delató con un hallazgo. Quedó una prueba para eso.

## D-030 · Avance esperado el día de inicio: el legacy tenía un error

**Diferencia conocida con el legacy:** el día de inicio de una obra, el legacy da 0 % de "avance esperado" antes
del mediodía y 1/n después. Guarda la fecha de inicio a las 12:00 y la compara con la hora actual, así que el
resultado depende de la hora a la que se abra el tablero. `packages/core` trabaja con días, no con horas, y da
1/n todo el día.

**Confirmado por el dueño:** es un error del legacy y se queda la versión nueva. La prueba de paridad acepta la
diferencia solo en ese caso exacto, y compara también a las 13:00, donde las dos versiones coinciden en todo.

## D-031 · La cuadrilla se cuesta con la tarifa vigente el día que trabajó

**Diferencia intencional con el legacy:** el legacy multiplicaba todas las horas por la tarifa **actual** del
trabajador, así que un aumento cambiaba el costo de las obras pasadas, sus desvíos y los costos unitarios con los
que se cotiza. `tarifas_trabajador` guarda la historia (`vigente_desde`), y `tarifaDelDia` toma la última vigente
a la fecha del registro.
**Paridad:** con una sola tarifa por trabajador, vigente desde siempre (que es lo que el legacy guardaba), las dos
versiones coinciden en cada costo. La historia de tarifas tiene sus propias pruebas en `packages/core/src`.

## D-032 · Montos como número, comparados con 6 decimales en la paridad

**Decisión:** en `packages/core` los montos son `number` en dólares, igual que en el legacy; la base los guarda en
`numeric(12,2)` y el servidor los convierte. Las sumas se hacen en el mismo orden que el legacy. La paridad
compara redondeando a 6 decimales para que el último bit de punto flotante no cuente como diferencia; lo que se
muestra se redondea al mostrarse.
**Descartado por ahora:** trabajar en centavos enteros. Si en la fase 3 aparece una diferencia de un centavo en
algún reporte, se revisa esta decisión.

**Aprendido en el paso 5b:**
- La paridad encontró una regla que faltaba: en una **obra cerrada** no se agregan ni se quitan partidas, y
  quitar una pide **motivo** (`exigirObraAbierta`, `falta_motivo`).
- Una regla que los datos nunca ejercitan no la detecta la paridad: un cambio en el peso por omisión de una
  partida pasó sin que ninguna prueba de paridad fallara, porque todas las partidas del legacy traen peso. Para
  eso están las pruebas de unidad.

## D-033 · Validaciones y calidad: los códigos y lo que cambia con el calendario

**Decisión:** las reglas de captura y de calidad viven en `packages/core` (`validaciones.ts`, `calidad.ts`) y
rechazan con un código y sus datos (D-015), en el mismo orden en que revisaba el legacy, para que el usuario
reciba el mismo primer problema. La paridad traduce cada mensaje del legacy a su código y compara caso por caso:
- **el alta de obra**, con las 128 combinaciones de campos faltantes;
- **la cuadrilla**, con cada trabajador y varias cantidades, en días reales del mes simulado;
- **el cierre del día y el cierre tardío**, del PM y del dueño;
- **las inspecciones, la prueba de agua y las fotos críticas.**

Cada prueba exige además que cada tipo de rechazo haya ocurrido al menos una vez: lo aprendido en D-032.

Los códigos son estos:
- **Alta de obra:** `faltan` (con los campos, en orden), `telefono_incompleto`, `pm_no_activo`,
  `entrega_antes_del_inicio`, `sin_espacios`, `faltan_pies2`, y la confirmación `obra_duplicada`.
- **Cuadrilla:** `cuadrilla_dia_o_medio`, `cuadrilla_pasa_un_dia`, `cuadrilla_pasa_16_horas`.
- **Cierre del día:** `obra_sin_presupuesto`, `falta_motivo_sin_trabajo`, `falta_foto`, `faltan_partidas`,
  `orden_de_otra_obra`, `falta_inspeccion`.
- **Cierre tardío:** `fuera_de_ventana`, `dia_ya_cerrado`. El del dueño suma `obra_cerrada`, `falta_motivo`,
  `falta_dia`, `solo_dias_anteriores` y `antes_del_inicio`.
- **Calidad:** `inspeccion_sin_foto`, `hito_sin_preguntas`, `ninguno_aplica`, `falta_prueba_agua`,
  `prueba_sin_foto`, `prueba_en_curso`, `prueba_incompleta`.

**Diferencias con el legacy:**
- **La ventana del cierre tardío** son los últimos 2 días **laborables del calendario de la empresa** (D-028).
  Con sábado laborable, el lunes el PM puede cerrar el sábado y el viernes; un feriado de descanso no gasta la
  ventana.
- **Una pregunta de inspección se identifica por su id**, no por su texto. La respuesta guarda el texto de ese
  día (D-022).
- **El PC3** se reconoce por `hitos_calidad.exige_prueba_agua`, no por el nombre (D-021).
- **No se traslada** el formato anterior del teléfono para las inspecciones (solo conteos, sin la lista de
  preguntas): el servidor siempre cuenta contra la lista real.
- **Las validaciones de los demás formularios** (orden de trabajo, orden de cambio, cobro, compra de la oficina,
  garantía, no calidad, subcontratista, trabajador, gasto del PM) usan el mismo `exigir`. Se trasladan con sus
  flujos en el paso 6 y la fase 3.

## D-034 · Los 19 indicadores

**Decisión:** `packages/core/src/indicadores.ts` calcula los 19 indicadores del legacy (`kpis_`), con la misma
regla, la misma meta y el mismo semáforo. Cada indicador sale con su clave, su proceso (P3 a P6), su valor, su
meta, su dirección, su semáforo, si todavía no hay datos y si es de los seis del lunes. Los textos que explican
qué revela cada uno son de la pantalla y se traducen (D-015); `core` solo agrega los datos que esos textos
necesitan (horas del plazo, costo de las garantías, días perdidos).

**Metas:** cada indicador tiene la del legacy por omisión (`METAS_POR_OMISION`), y la empresa puede cambiarla en
`metas_indicadores` (D-019). Dos se toman de la configuración: las horas de respuesta a avisos (el plazo de los
avisos) y el margen de las órdenes de cambio (el margen mínimo).

**Con el calendario de la empresa (D-028):** la tasa de cierre cuenta los días laborables de la última semana,
sábado incluido.

**Paridad:** contra el tablero del legacy en cada día del mes simulado y en el libro de ejemplo, a las 10:00 y a
las 21:00 (varios indicadores dependen de cuántas horas han pasado). Coinciden los 19 en valor, meta, semáforo,
"sin datos" y "principal". La prueba exige además que cada indicador haya medido algo distinto de cero en algún
caso. "Reseñas obtenidas" nunca lo hacía (en el mes simulado nadie registra una reseña), así que se agregó una
variante del último día con reseñas recibidas.

**Diferencia conocida, de los datos de ejemplo:** en el libro de ejemplo, escrito a mano, el aviso BLQ-0001 trae 3
horas de respuesta tecleadas, pero sus fechas de apertura y respuesta son el mismo día sin hora. El legacy promedia
las horas guardadas; `core` las calcula con las fechas (no hay columna de horas en el modelo nuevo). En el mes
simulado, donde el legacy guarda las horas al responder, coinciden siempre.
**Para el importador (fase 3):** si un aviso del legacy trae horas de respuesta pero sus fechas no tienen hora,
reconstruir la hora de respuesta como apertura + horas guardadas, para no perder el dato.

## D-035 · La capa del servidor

**Decisión:**
- **Dónde va:** en `packages/servidor`, un paquete propio y no dentro de `apps/web`. Así se prueba contra la base
  sin levantar Next, y en la fase 2 cada pantalla la llama con una envoltura delgada.
- **Cómo escribe** (D-026, D-027): se conecta como `ijm_servidor` y cada operación es una transacción
  (`enNombreDe`). En ella toma `servidor_app`, fija las dos variables de identidad del usuario, lee con su RLS,
  valida con `packages/core` y escribe. Si algo falla, no queda nada a medias.
- **Las entradas:** se validan con Zod. Un dato mal formado es `datos_invalidos`, con cada campo y su problema;
  las reglas son de `core`.
- **"Ahora":** cada flujo lo recibe como argumento opcional, igual que `core`, para que las pruebas sean
  repetibles.
- **Los días de negocio** llegan de la base como texto `AAAA-MM-DD`: la conexión desactiva la conversión de
  `date` a `Date`, que daría la medianoche UTC, el día anterior en Austin (regla 5).

**Los flujos:**
- **`crearObra`:** solo el dueño o el administrador. Crea la obra con su folio, el contrato, Generales primero y
  la copia de partidas de cada espacio. Un espacio sin nombre toma el de su tipo.
- **`guardarPresupuesto`:** solo el dueño. **Decisión del dueño:** nada se borra; una etapa que ya no viene queda
  en $0. Cada monto que cambia deja rastro en `correcciones`, y la obra pasa entre "sin presupuesto" y "lista
  para arranque" según quede completo. **Diferencia con el legacy:** una obra entregada ya no se presupuesta.
- **`cerrarDia`:** solo el PM, en sus obras. Valida en el orden del legacy y escribe todo junto: bitácora,
  partidas, subs que llegaron (una orden emitida que llega se confirma), avance sin repetir estado, cuadrilla, y
  el arranque de la obra con su primer día de trabajo.
  - **Diferencias con el legacy:** un solo cierre por obra y día (D-022); una partida "terminada" tiene que ser
    del día; la cuadrilla sin partida va a la primera partida del día.
  - **El tope de cuadrilla cuenta las horas de todas las obras de la empresa** con `cuadrilla_del_dia`
    (solo cantidades, sin tarifas), aunque una sea de otro PM que este no puede leer.
- **`rutaParaFoto` y `registrarFoto`:** una ruta aleatoria en la carpeta de la empresa y la obra; el teléfono
  sube directo a Storage. Al registrarla se comprueba, con `foto_subida`, que el archivo existe y que lo subió
  ese usuario. Un reintento con el mismo número devuelve la misma foto, y la foto de un cierre tiene que ser una
  de las comprometidas.
- **`enlaceDeFoto`:** un enlace firmado de 5 minutos, solo si el usuario puede ver la foto. Lo firma el service
  role, que solo se usa para eso.
- **`corregir`, `anular` y `anularCierre`:** reglas en `core/correcciones.ts`. El PM, lo suyo y en 48 h;
  el dueño, sin límite y también cobros y pagos; nada en obras cerradas; siempre con motivo y con un renglón
  por campo en `correcciones`.
  - Si cambia la partida, el registro se muda con ella a su espacio.
  - Si cambian las horas, se vuelve a revisar el tope del día.
  - Un pago anulado regresa su orden a "aprobada".
  - **Anular un cierre** anula la bitácora y el avance y la cuadrilla registrados con ella (por `bitacora_id`, no
    por obra, día y usuario como el legacy).

**Lo que necesitó la base** (`20261006000100_servidor.sql`): que el PM pueda arrancar su obra (solo de "lista
para arranque" a "en obra"), `cuadrilla_del_dia` y `foto_subida`. En los datos de prueba (solo local), la
contraseña de `ijm_servidor`.

**Para la fase 2:** verificar la sesión es de la capa web. Las funciones de este paso reciben al usuario ya
identificado (`{ userId }`); la página toma su `userId` del token de Supabase verificado (y después, del PIN del
dispositivo, D-024). Faltan también los flujos que el plan deja para después: el cierre tardío del dueño, gastos,
avisos, inspecciones, órdenes de trabajo y de cambio, cobros, entrega y cierre de obra.

**Aprendido:** las pruebas encontraron un error en el primer intento: un espacio sin nombre tomaba el **id** de su
tipo en vez de su nombre.

## D-036 · Dónde vive la app

**Decisión del dueño:** Supabase y Vercel, en Estados Unidos. El producto se llama **J Solutions**.
- **Supabase**, en us-west-2 (Oregón), donde el dueño creó el proyecto; una vez creado, no se cambia. Son dos
  proyectos: "pruebas" (plan gratuito, para las vistas previas de cada pull request) y "producción". El plan
  gratuito pausa el proyecto sin uso y no guarda respaldos diarios: ver abajo cuándo se paga.
- **Vercel**, con sus funciones en pdx1 (Portland), junto a la base, porque cada operación hace varias
  consultas. Cada pull request genera su vista previa contra el proyecto "pruebas".
- **Los correos** (la invitación del PM, decisión 2 del plan de la fase 2) salen por Resend con el dominio
  propio. El correo que trae Supabase es solo para pruebas.
- **Los secretos** (la contraseña de `ijm_servidor`, la llave del service role) viven en las variables de
  Vercel, nunca en el repositorio. Cada proyecto tiene su propia contraseña de `ijm_servidor`, distinta de la
  local.
- **El dueño crea las cuentas.** El dominio está por comprarse.
- **Se empieza gratis** (decisión del dueño): Supabase y Vercel en sus planes gratuitos mientras se desarrolla.
  Se pasa a pago cuando haga falta, no antes:
  - **Vercel Pro**, cuando la app la use la empresa de verdad (el piloto), porque el plan gratuito no permite
    uso comercial.
  - **Supabase Pro**, cuando lleguen al límite gratuito (500 MB de base, 1 GB de archivos: las fotos son lo
    primero que crece) o cuando haya datos reales sin otro respaldo. Mientras tanto, un respaldo propio cada
    noche (`pg_dump`) cubre la falta de respaldos diarios. El proyecto se pausa tras una semana sin uso; en el
    piloto se usa a diario.

## D-037 · La base de la app

**Decisión:**
- **El idioma no va en la dirección** (nada de `/es/...` o `/en/...`): la PWA abre siempre en `/`. Manda el
  idioma que eligió el usuario (una cookie); si no eligió, el del teléfono; si no, español. En el paso 2 se
  guarda también en el miembro, para que lo siga en otro dispositivo.
- **Los textos** viven en `apps/web/mensajes/`, uno por idioma, con tipos: una llave que no existe no
  compila. ESLint rechaza texto fijo en las pantallas y una prueba exige las mismas llaves en los dos idiomas.
- **El cambio de idioma es un formulario**, no un botón con JavaScript: funciona aunque la página no haya
  terminado de cargar, con poca señal.
- **El ícono** es la J sobre el color de la marca, generado en el código, hasta que haya un logo.
- **El service worker** por ahora solo hace instalable la app; la cola sin señal es el paso 5.
- **@swc/core se fija en 1.16.2.** next-intl lo trae, y desde 1.16.12 no carga en Windows si la carpeta de su
  caché da permisos a otros usuarios, como pasa en esta computadora. En Linux (la integración continua y
  Vercel) no pasa. Se quita la fijación cuando lo corrijan.

## D-038 · Entrar: la invitación, el celular verificado y el PIN

**Decisiones del dueño:** mientras no haya dominio, la invitación se manda con un botón **Copiar** (o
**Compartir**) por WhatsApp, mensaje o correo. El dueño también entra con PIN, de **6 dígitos**.

**Cómo funciona** (completa D-024):
- **La invitación.** El dueño da de alta al PM (nombre, correo e idioma) y la app le da un enlace que sirve una
  sola vez, por 7 días. La base guarda solo el hash del token. Una invitación nueva anula la que no se usó.
  Se canjea con un botón y no al abrir el enlace: WhatsApp abre los enlaces para mostrar su vista previa, y eso
  gastaría la invitación.
- **El celular verificado.** Al canjear, el servidor genera una llave al azar (32 bytes). El celular la guarda
  en una cookie de 400 días y la base guarda su hash. El servidor abre la sesión de Supabase Auth del invitado
  con un enlace mágico que genera y canjea en ese momento, sin mandar ningún correo. Las cookies de la sesión
  son httpOnly: el JavaScript de la página no ve los tokens.
- **El PIN** se cifra (bcrypt) **junto con la llave del celular**: sin el celular, el PIN no sirve, y con la base
  sola no se puede adivinar. El PM usa 4 dígitos y el dueño o administrador 6. No se aceptan un dígito repetido
  ni una escalera (1234, 9876). El PIN abre la sesión por 16 horas al PM y 12 al dueño, como el legacy
  (`HORAS_SESION`). 5 intentos fallidos seguidos bloquean 15 minutos, también como el legacy. La función que
  revisa el PIN no lanza error por un PIN equivocado: devuelve el resultado, para que la transacción guarde el
  intento fallido.
- **En cada página** se revisan juntas, en una transacción de la base, tres cosas: la sesión de Auth, la llave
  del celular y el PIN abierto (`estado_dispositivo`). También se revisa que el miembro y su empresa sigan
  activos.
- **Quitar un celular o dar de baja** corta el acceso en ese instante. Al quitar un celular también se cierra
  su sesión de Auth, como refuerzo. A quien olvidó su PIN se le manda una invitación nueva, que es otro
  celular verificado.
- **Un celular (un navegador) es de una sola persona.** Canjear en él la invitación de otro miembro reemplaza la
  llave del anterior, que pierde el acceso ahí; su cuenta sigue intacta. Pasó en el piloto: el dueño abrió en su
  celular la invitación de un PM. Desde entonces, la invitación avisa a quién le quitaría el celular antes de
  canjearse. Y si el dueño ya no puede entrar a Equipo para reinvitarse, quien administra la plataforma genera
  la invitación con `packages/servidor/scripts/invitar-de-nuevo.ts --correo …`, con la llave secreta. Para usar
  la app como dos personas en un mismo teléfono hacen falta dos navegadores (en iPhone, la app instalada y
  Safari guardan cookies distintas).
- **Todo pasa por funciones de la base** (security definer), que solo puede ejecutar `servidor_app`. Nadie
  escribe directo en `miembros`, `dispositivos` ni `invitaciones`. Nadie lee la llave, el PIN, los intentos ni
  el token: ni la API ni el servidor.
- **El alta de una empresa** con su dueño la hace quien administra la plataforma, con
  `packages/servidor/scripts/alta-empresa.mjs` y la llave secreta. Es la única escritura con el service role
  (`alta_empresa`, que solo él puede ejecutar). Ningún usuario da de alta empresas en las fases 1 a 3.

**Diferencia con lo planeado:** el PIN no lo revisa el service role (D-027) sino una función de la base. Así
ningún código de la app toca el hash del PIN, y el límite de intentos no se puede saltar con dos peticiones al
mismo tiempo, porque la función bloquea el renglón mientras revisa.

**Límites conocidos** (para la revisión independiente del paso 7):
- La API de Supabase (PostgREST) revisa la sesión de Auth, pero no el PIN ni el celular. Quien sacara los
  tokens de las cookies podría **leer**, sin escribir (D-026), lo que su rol ve, hasta que venza el token (una
  hora) o se quite el celular. Sacar esos tokens no es fácil, porque las cookies son httpOnly. Hay dos formas de
  cerrarlo: que la API exija el celular abierto, o acortar la vida del token.
- Sin señal, el PIN del teléfono (paso 5) será solo un candado local: los datos no llegan a la base sin la
  revisión del servidor.

## D-039 · El catálogo de cada empresa sale de su propio libro

**Decisiones del dueño:**
1. El catálogo de IJM es **solo de IJM**. No hay una plantilla estándar: una empresa nueva nace vacía, y arma
   su catálogo con las pantallas del dueño (fase 3) o carga el de su propio libro.
2. Los datos de la empresa piloto se cargan **desde su libro del sistema actual con un script**.
3. La obra piloto se da de alta con una **pantalla mínima** "Nueva obra + presupuesto".

**Cómo se carga el libro.** El dueño descarga su Google Sheet como .xlsx, y quien administra la plataforma corre
`packages/servidor/scripts/cargar-libro.ts` con la llave secreta. El script convierte el libro con
`importar/libro.ts` y la base lo guarda con `cargar_libro`, una función que solo puede ejecutar el service role:
- **Qué se carga:**
  - el catálogo: tipos de espacio, partidas con su peso, días, responsable, paralelo, espera, etapa y punto de
    control, las etapas, los oficios y los puntos de control con sus preguntas;
  - la configuración (impuesto, límite de compra, plazos);
  - las metas que difieren de las del legacy;
  - los subcontratistas con sus papeles;
  - la cuadrilla con su tarifa.
- **Las reglas de lectura del legacy:**
  - "SI" es sí;
  - "Generales" es "Generales de obra", y siempre va primero;
  - el oficio de una partida se empata con el de un sub por texto contenido en el otro;
  - la licencia la piden plomería, electricidad y aire acondicionado (`requiereLicencia_`);
  - PC3 exige la prueba de agua;
  - un renglón sin su id (`sub_id`, `trabajador_id`) es una nota, no un registro.
- **Primero muestra y después carga.** Sin `--confirmar` solo muestra lo que cargaría. Un dato que no se
  entiende detiene todo y se reporta con su hoja y su número de renglón, para corregirlo en Google Sheets.
- **Todo o nada, y una sola vez.** Una empresa que ya tiene catálogo, subcontratistas o cuadrilla se rechaza
  (`empresa_con_catalogo`): cargar dos veces duplicaría todo. Lo que haya que corregir después se corrige en las
  pantallas del dueño.
- **La tarifa del libro vale desde el 2000-01-01**, porque el libro no guarda su historia. El costo de cada día
  se calcula con la tarifa vigente ese día (D-031).
- **Los nombres en inglés quedan vacíos**: se muestra el español hasta que el dueño los capture (D-015).
- **Los acentos se ponen al cargar.** Los libros de antes del cambio de acentos traen los nombres sin acentos
  ni ñ ("Bano", "Plomeria"), como el libro real de IJM. El legacy los mostraba corregidos con un mapa exacto
  (`legacy/app/acentos.py`); el cargador los guarda ya corregidos con el mismo mapa (`importar/acentos.ts`), más
  dos etapas que le faltaban. Una prueba quita los acentos al libro de ejemplo y exige el mismo resultado.
- **Los libros con datos reales no van al repositorio**: `.gitignore` excluye los `.xlsx` de la raíz.

**La plantilla estándar de datos iniciales** (decisión del dueño): todo negocio nuevo ordena sus datos en el mismo
libro, `docs/plantilla/Plantilla_datos_iniciales_J_Solutions.xlsx`, y se carga con el mismo script. La genera el
código (`importar/plantilla.ts`, `pnpm plantilla`), y una prueba la llena con sus ejemplos y la carga; otra exige
que el archivo esté al día.
- **Las mismas hojas y el mismo orden de columnas que el libro del sistema actual**: un solo lector sirve para los
  dos formatos. El lector reconoce la plantilla por `Config → PLANTILLA`.
- **Lo que solo trae la plantilla:**
  - los nombres en inglés de partidas, preguntas y feriados;
  - la columna "Exige prueba de agua" (en el legacy era la regla de PC3);
  - `DIAS_LABORABLES`;
  - la hoja de feriados;
  - las hojas Empresa y Equipo, que no se cargan: son los datos del alta y de las invitaciones.
- **En la plantilla todo renglón con datos es un registro**, y si le falta algo se reporta. En el legacy, un
  renglón sin id era una nota.
- **Los renglones de ejemplo** (grises, empiezan con EJEMPLO) nunca se cargan.
- **Una plantilla sin partidas** se rechaza con `libro_sin_partidas`.
- El libro se escribe sin dependencias (`importar/escribir-xlsx.ts`), igual que se lee. Se probó que también lo
  abre openpyxl.

**Por qué no el importador completo:** el importador de la fase 3 trae además las obras, su historia y el
dinero. Para el piloto basta con el catálogo y los datos de la empresa, porque la obra piloto se da de alta a
mano (decisión 4 del plan de la fase 2). El lector del .xlsx se mudó a `packages/servidor/src/importar/`, donde
lo usarán los dos.

## D-040 · El inicio del PM

**Decisión:** el inicio del PM sigue al legacy (`construirDatos_`) en lo que muestra, y lo calcula con
`packages/core`:
- el avance ponderado (`avanceDeObra`);
- la entrega comprometida (`fechaComprometida`, que suma los días de las órdenes de cambio autorizadas) y la
  prevista (`cronogramaObra`);
- la semana (`semanaDelPM`, con seis días laborables, sábado incluido);
- los días sin cerrar (`diasSinCierre`);
- la racha (`rachaDeCierres`, nueva).

Lo lee con la identidad del PM, bajo RLS, y nada de dinero del negocio: de las órdenes de cambio, solo la
descripción y los días.

**La racha sigue el calendario de la empresa.** El legacy solo saltaba sábado y domingo; aquí no la cortan los
días que la empresa no trabaja, incluidos sus feriados (D-028).

**Lo suyo en obras ya entregadas.** El PM deja de ver una obra al entregarse (D-017), con sus fotos y sus
cierres. Pero sus avisos y sus gastos se siguen viendo (D-025), y su racha cuenta todos sus cierres. Para
calcular "sin recibo" y la racha sin abrirle esas obras, dos funciones de la base contestan solo eso, del miembro
de la sesión: `mis_gastos_sin_recibo()` y `mis_dias_cerrados()` (`20261009000100_inicio_pm.sql`). Antes de
ellas, el inicio mostraba como "sin recibo" un gasto que sí lo tenía, porque el PM ya no podía ver esa foto: lo
encontró la prueba. Un aviso o gasto de una obra que ya no ve se muestra sin su folio.

## D-041 · Cerrar el día desde el celular

**Decisión:** la pantalla de cierre usa el flujo de la fase 1 (`cerrarDia`), que ya valida en el orden del
legacy. Lo nuevo es cómo se captura y cómo llegan las fotos.
- **La captura:**
  - las partidas que van en curso vienen marcadas;
  - una partida se marca terminada solo si se trabajó;
  - si su punto de control no tiene la inspección aprobada, la pantalla lo dice en vez de ofrecer "terminada"
    (la regla sigue en `exigirInspecciones`);
  - a la cuadrilla se le anotan horas, o día y medio día según cómo cobra;
  - al sub esperado, "llegó" o "no llegó";
  - "Hoy no hubo trabajo" pide el motivo.
- **Las fotos se comprimen en el teléfono** (1600 px, JPEG al 75 %) y se suben **después** de guardar el
  cierre, una por una con su número (D-007). La que falla se reintenta sin repetir las demás.
- **Las fotos pasan por el servidor.** El navegador no tiene los tokens de la sesión (cookies httpOnly, D-038),
  así que una acción del servidor sube el archivo a Storage con la sesión del PM y lo registra
  (`rutaParaFoto`, `registrarFoto`). Las reglas de Storage siguen valiendo. El tope de una petición es 4 MB, y
  una foto comprimida pesa unos cientos de KB.
- **El cierre no vuelve a pintar la página.** Si lo hiciera, la pantalla vería el día ya cerrado y quitaría el
  formulario a media subida de fotos. Pasó en la prueba en el navegador.

**Pendiente para el paso 5 (la cola sin señal):** si el PM sale de la pantalla antes de que suban sus fotos,
esas fotos se pierden y el cierre queda con fotos comprometidas sin subir. La cola las guardará en el teléfono.
La cuadrilla va a la primera partida del día, como en la fase 1; anotarla por partida queda para después, si el
piloto lo pide.

## D-042 · La clave de envío de un cierre

**Decisión:** el teléfono le pone a cada cierre una clave al azar al capturarlo (`bitacora.clave_envio`, única
por empresa). Si el servidor guardó el cierre pero la respuesta no llegó al teléfono, el reintento llega con la
misma clave y recibe ese mismo cierre: no lo duplica ni choca con "ese día ya está cerrado", aunque llegue al día
siguiente. Otro cierre del mismo día con otra clave sí es un segundo cierre, y se rechaza (D-022). Las fotos de
la cola encuentran su cierre por su clave (`cierreDeClave`): no necesitan esperar el id de la bitácora.

## D-043 · La cola en el teléfono

**Decisión:** lo que el PM captura va primero al teléfono (IndexedDB, que sobrevive a cerrar la app y guarda
las fotos) y de ahí se envía, con las reglas del legacy (`procesarCola`, `prueba_cola.js`):
- **en orden**, uno por uno, y las fotos de un cierre detrás de él;
- **un error de red** no descarta nada: se cuenta el intento, y lo de atrás espera;
- **un rechazo de negocio** sale de la cola con sus fotos y se le muestra al PM con su razón, hasta que lo da
  por visto; lo de atrás sigue;
- **una sesión vencida** detiene la cola sin perder nada. Las acciones de la cola no redirigen: contestan
  `sesion`, y la cola espera a que el PM escriba su PIN.

**Cuándo se envía:** el cierre, en el momento; si una regla lo rechaza, se corrige ahí mismo en el formulario.
Sin señal o con la sesión vencida, el cierre y sus fotos van a la cola. Las fotos de un cierre enviado siempre
van a la cola. La cola se envía al abrir el inicio, al volver la señal (evento `online`) y cada 30 segundos
mientras quede algo. En el inicio se ve cuánto falta y hay un botón "Enviar ahora". Safari en iPhone no envía
en segundo plano, así que la cola avanza cuando la app está abierta.

**Las reglas de la cola** son una función pura (`apps/web/lib/cola.ts`) con sus pruebas, que incluyen los casos
de `prueba_cola.js`. IndexedDB, el envío y la pantalla van aparte.

## D-044 · Corregir un cierre

**Decisión del dueño** (lo pidió al probar el piloto): el PM corrige su cierre si se equivocó o le faltó algo.

**Cómo funciona:**
- **Dentro de 48 horas**, solo el suyo, como el legacy. "Corregir" abre el mismo formulario lleno con lo que
  capturó; cambia lo necesario, agrega lo que faltó y escribe qué corrigió.
- **En el servidor** (`corregirCierre`), en una transacción: el cierre se **anula** con su motivo
  (`anularCierre` de la fase 1, que revisa las 48 h y el autor), y se **vuelve a cerrar el mismo día** con lo
  corregido. Nada se borra: el anterior queda anulado, con su cuadrilla y su avance, y el rastro en `correcciones`.
- **Las fotos no se mueven.** Un archivo se registra una sola vez (`fotos.storage_path` es único), así que las
  fotos se quedan en el cierre donde se subieron. El cierre nuevo dice a cuál corrige (`bitacora.corrige_a`). Sus
  fotos son las suyas y las de la cadena que corrige (`fotosDelCierre`), y cuentan para la regla de "al menos
  una foto". Las fotos nuevas se suben al cierre nuevo por la cola.
- **Necesita señal.** A diferencia del cierre, la corrección no va a la cola: el PM tiene que ver en el momento
  si se aceptó.
- La pantalla ofrece otra vez lo que registró ese cierre: sus partidas terminadas y los subs que reportó
  (`datosParaCierre` con `corrige`).

## D-045 · Agregar un espacio a una obra

**Decisión del dueño:** a una obra que ya existe se le agregan espacios desde su presupuesto (legacy:
`duAgregarArea`). `agregarEspacio` lo pone al final, con las partidas de su tipo, y su presupuesto se captura ahí
mismo. Solo el dueño o el administrador; nunca en una obra entregada, nunca otro "Generales de obra", y siempre
con pies², como en el alta. El presupuesto incompleto no cambia el estado de una obra que ya arrancó.

**Lo que sigue, también pedido por el dueño:** crear desde la app tipos de trabajo nuevos (piso de cemento, masa
y pintura…) con sus partidas, en una pantalla de Catálogo aparte del presupuesto, porque son plantillas que se
usan en muchas obras.

## D-046 · El catálogo desde la app

**Decisión del dueño:** el dueño arma sus tipos de obra (piso de cemento, masa y pintura…) en una pantalla de
Catálogo, aparte del presupuesto. En pantalla se llaman **tipos de obra**, como en el legacy: en el código, "tipo de
trabajo" es una etapa.

**Qué se puede hacer** (`catalogo.ts`, solo el dueño o el administrador):
- **Un tipo nuevo en blanco** (legacy: `duCrearTipo`): su nombre, sus partidas una por renglón y su tamaño
  comparado con un baño, que se reparte parejo como peso (`partidasDeTipoNuevo`; sin tamaño, 50). Las partidas
  nacen con un día, a cargo de la cuadrilla, sin etapa ni punto de control, y se afinan después.
- **Copiar un tipo** (legacy: `duClonarSecuencia`): sus partidas activas, con todo lo suyo.
- **Agregar o editar una partida** (legacy: `duGuardarPartida`): orden, días, quién la hace (un subcontratista
  necesita su oficio), etapa, punto de control, si va junto con la anterior, espera y peso.
- **Dar de baja** una partida o un tipo, y reactivarlos. Nada se borra. Un tipo dado de baja ya no se ofrece en una
  obra nueva. Generales de obra no se da de baja.
- **Una etapa nueva** (Pintura): solo su nombre; va al final. Sin ella, las partidas de un trabajo nuevo caerían en
  "Otras partidas" del presupuesto.
- Los nombres son únicos sin importar mayúsculas, también contra los dados de baja (así lo exige la base); el
  nombre en inglés es opcional (D-015).

**Diferencia con el legacy:** el legacy "congelaba" las obras en curso antes de tocar el catálogo
(`congelarAreasDeTipo_`) y arrastraba el histórico al renombrar una partida (`renombrarPartida_`). Aquí no hace
falta: cada espacio copia sus partidas al crearse (`partidas_obra`), así que cambiar el catálogo solo afecta a los
espacios nuevos.

**Pendiente:** crear puntos de control nuevos con sus preguntas, cuando el dueño lo pida.
