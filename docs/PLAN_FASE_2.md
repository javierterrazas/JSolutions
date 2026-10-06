# Fase 2 — La app del PM (BORRADOR)

> Borrador para revisar con el dueño antes de empezar. Sus cinco decisiones ya están tomadas.

## Objetivo

Que un PM de IJM lleve su obra desde el celular: que entre con su PIN, vea su semana, cierre el día en menos de un
minuto —con o sin señal— y registre gastos, avisos, inspecciones y el punch list. Todo sobre lo que dejó la fase 1:
las reglas de `packages/core`, la muralla en la base y los flujos de `packages/servidor`.

Al terminar, **un PM real usa la app en una obra real de IJM**, en paralelo con el sistema actual, y los datos de
las dos coinciden.

## Terminado cuando

- [ ] El PM instala la app en su celular (PWA), entra con su PIN en su dispositivo verificado, y en otro aparato
      no puede entrar sin una invitación nueva.
- [ ] El PM cierra el día **sin señal**; al volver la señal se envía solo, sin duplicar nada, y si una regla lo
      rechaza lo ve con la razón. Probado con Playwright simulando la pérdida de red.
- [ ] Cerrar un día normal (partidas, cuadrilla, sub, 2 fotos) toma menos de 60 segundos, medido con el PM piloto.
- [ ] Cada pantalla del PM está en español y en inglés; ningún texto queda fijo en el código; los errores de
      negocio se muestran por su código (D-015).
- [ ] Las pruebas de pantalla del legacy que tocan al PM tienen su equivalente en Playwright y pasan en la
      integración continua, en tamaño de teléfono.
- [ ] El PM piloto usó la app al menos 2 semanas en una obra y sus datos cuadran con el sistema actual.
- [ ] Nada de la fase 1 se debilitó: las 261 pruebas siguen en verde, y la muralla tiene una revisión
      independiente de lo nuevo.

## Fuera de alcance

Las pantallas del dueño, el importador desde Google Sheets y el mes simulado sobre la app completa (fase 3). El
cobro con Stripe y el alta de empresas en línea (fase 4). Apps nativas.

## Decisiones del dueño

1. **Dónde vive la app: Supabase y Vercel**, en Estados Unidos (Supabase en us-west-2, Vercel en pdx1). Decidido (D-036). Dos proyectos de
   Supabase, "pruebas" y "producción", y Vercel, **en sus planes gratuitos** mientras se pueda (D-036 dice
   cuándo se paga); Resend para los correos. El producto se llama
   **J Solutions**; el dominio está por comprarse. El dueño crea las cuentas.
2. **La invitación llega por correo.** Decidido. En producción sale por Resend con el dominio propio; el correo
   que trae Supabase es solo para pruebas.
3. **El PIN es de 4 dígitos**, como en el legacy. Decidido. El límite de intentos lo hace seguro (D-024).
4. **La obra piloto se da de alta a mano**, con los flujos del servidor (`crearObra`, `guardarPresupuesto`).
   Decidido. El importador sigue en la fase 3.
5. **Los estilos, con Tailwind.** Decidido. Es la librería de estilos más común con Next.js; se agrega en el paso 1.

## Pasos

### 1. La base de la app

Next.js con next-intl (español e inglés, con el idioma de cada miembro), el manifiesto y el service worker de la
PWA, y el despliegue de vista previa en Vercel con el proyecto de Supabase en la nube. Las server actions solo
traducen la petición y llaman a `packages/servidor`; no hay reglas en la capa web.

**Terminado cuando** la app vacía se instala en un iPhone y un Android, cambia de idioma, y la integración continua
despliega una vista previa por cada pull request.

### 2. Entrar: invitación, dispositivo verificado y PIN (D-024, D-038) — hecho

- El dueño invita al PM desde la pantalla "Equipo" y le manda el enlace con **Copiar** o **Compartir**
  (WhatsApp, mensaje o correo). Cuando haya dominio, saldrá solo por correo (decisión 2). Al abrir la
  invitación en su celular, el dispositivo queda verificado y el PM elige su PIN.
- El PIN se cifra junto con la llave del celular y lo revisa la base, con límite de intentos: 5 fallidos
  bloquean 15 minutos. El PM usa 4 dígitos y el dueño 6 (decisión 3).
- Cada página revisa la sesión de Auth, la llave del celular y el PIN; el `userId` sale del token verificado.
  El dueño ve los celulares de cada miembro y puede quitar uno o dar de baja.
- La primera empresa y su dueño se dan de alta con `packages/servidor/scripts/alta-empresa.mjs`.
- **Pasa al paso 5:** sin señal, el PIN abre lo guardado en el teléfono (un candado local; D-038).

**Terminado:** las pruebas cubren la invitación, el PIN correcto e incorrecto, el bloqueo, quitar un celular, el
PM dado de baja con la sesión abierta y otro aparato sin invitación; y se probó el flujo completo en el
navegador, en tamaño de teléfono.

**Antes del piloto:** una empresa nueva nace sin catálogo (tipos de espacio, partidas, puntos de control). Hay
que copiarle el del sistema actual antes de dar de alta la obra piloto.

### 3. El inicio del PM

Sus obras con el avance ponderado y la entrega prevista; la semana del PM (6 días, con el sábado: D-028); los días
que olvidó cerrar; las órdenes por confirmar y los subs que llegan; las órdenes de cambio autorizadas que tiene que
ejecutar; las inspecciones pendientes; las respuestas a sus avisos; los gastos sin recibo; su racha de días
cerrados. Todo sale de `packages/core`; nada de dinero del negocio.

### 4. Cerrar el día

El flujo estrella. La partida en curso viene sugerida; las terminadas, la cuadrilla (horas o día y medio día), el
sub que llegó y las fotos con la cámara, comprimidas en el teléfono. "Hoy no hubo trabajo" con su motivo. Los
últimos 2 días laborables, tarde. Las fotos se suben después, en segundo plano, con su número (D-007).

### 5. Sin señal: la cola

Lo que el PM guarda sin señal queda en el teléfono (IndexedDB) y se envía solo al volver la señal, en orden. Cada
operación lleva un identificador, para que un reintento nunca la duplique. Las reglas del legacy
(`prueba_cola.js`) se conservan:
- un error de red o del servidor no descarta nada: se reintenta;
- un rechazo de negocio (por ejemplo, PC3 sin prueba de agua) sale de la cola y se le muestra al PM con su razón;
- si la sesión venció, se marca y se conserva todo hasta que vuelva a entrar.

**Riesgos:** Safari en iPhone no sincroniza en segundo plano y puede borrar el almacenamiento de una PWA poco
usada; se mide en el piloto. Y lo que cambia mientras el PM está sin señal (la obra se entregó, se pasó la ventana
de 48 h) se resuelve con los mismos rechazos de negocio.

### 6. Los demás registros del PM

Con su flujo en `packages/servidor` y su pantalla:
- gasto con recibo, y el aviso de compra arriba del límite;
- aviso (bloqueo) con fotos;
- inspección de un punto de control, con "No aplica" y foto en los puntos críticos;
- prueba de inundación de 24 h;
- punch list en el recorrido con el cliente;
- medida verificada (D-014);
- confirmar, marcar llegada y aprobar una orden de trabajo;
- correcciones en 48 h;
- el álbum de fotos de la obra.

### 7. Pruebas de pantalla y piloto

- Playwright en tamaño de teléfono, en la integración continua: el equivalente de `prueba_calidad_ui`,
  `prueba_tardio_ui`, `prueba_pordia_ui`, `prueba_noaplica_ui`, `prueba_fotos_despues_ui`, `prueba_numeros_ui`,
  `prueba_formularios_ui` (lo del PM), `prueba_pin`, `prueba_cola`, `prueba_idioma`, `prueba_scroll` y
  `prueba_placeholder`.
- Una revisión independiente de la seguridad de lo nuevo (sesión guardada, PIN, cola).
- El piloto: un PM, una obra, al menos 2 semanas, en paralelo con el sistema actual. Se mide el tiempo de cierre y
  se comparan los datos.

## Riesgos

- **El teléfono del PM:** celulares viejos, poca memoria, fotos HEIC del iPhone. Se prueba con los teléfonos reales
  de los PMs de IJM.
- **Sin señal de verdad:** el piloto puede mostrar casos que la simulación no ve (una obra en un sótano todo el
  día). La cola tiene que aguantar un día completo sin señal.
- **Que crezca el alcance:** las pantallas del dueño son de la fase 3. En la fase 2, el dueño sigue usando el
  sistema actual, y lo nuevo que el PM registra se revisa con consultas directas.
