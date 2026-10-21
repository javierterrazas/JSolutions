# Piloto

Una obra real de IJM se lleva **solo con la app**, de principio a fin, con su PM y con el cliente viendo su portal
desde el primer día. Ya no se usa el libro de Google Sheets (2026-10-18). Es el último criterio de "terminado" de la
fase 2 ([PLAN_FASE_2.md](PLAN_FASE_2.md)).

## Qué se mide

- **El tiempo de cierre:** un día normal (partidas, cuadrilla, sub y 2 fotos) en 60 segundos o menos. La app lo mide
  sola: Plataforma → "Uso de la app", columna del cierre (D-101).
- **Que el PM la use todos los días:** días con la app y cierres a tiempo o tardíos, en esa pantalla y en
  "Indicadores".
- **La señal:** cuántas veces se quedó algo en la cola y si todo llegó solo.
- **Que los números cuadren con la realidad:** gastos contra los recibos, horas de la cuadrilla contra lo que se
  les paga, pagos a subs contra sus órdenes, cobros contra lo que entró al banco.
- **Lo que digan el PM y el cliente:** qué les estorba, qué les falta, qué no entienden.

## Antes de empezar

Lo hace el dueño, en este orden, la semana antes de arrancar.

1. **Revisar el catálogo** en "Catálogo": el tipo de obra, sus partidas y etapas, cómo se cotiza cada etapa
   (pie², pie lineal o fijo) y los puntos de control.
2. **Dar de alta a la cuadrilla** en "Cuadrilla → Agregar trabajador": nombre, oficio, si cobra por hora o por día y
   su salario. Sin salario la app no puede sacar el costo de mano de obra.
3. **Dar de alta a los subcontratistas** en "Subcontratistas", con su seguro, su licencia si el oficio la pide y su
   W-9.
4. **Dar de alta al PM** en "Managers → Invitar a un PM": nombre, celular, correo (opcional) e idioma. Tocar
   "Compartir" y mandarle la invitación por WhatsApp. Vale 7 días y se usa una vez.
5. **Instalar la app en el celular del PM**, en persona (unos 10 minutos):
   - **Android (Chrome):** abrir la invitación en Chrome, "Verificar este celular" y elegir el PIN de 4 dígitos.
     Después, en el menú ⋮ de Chrome, "Instalar app".
   - **iPhone (Safari):** primero instalar. Abrir https://j-solutions-nine.vercel.app en Safari, Compartir →
     "Agregar a inicio" y abrir la app desde su ícono. Va a decir "Este celular no tiene acceso": pegar ahí el enlace
     de la invitación y tocar "Abrir la invitación" (D-057).
   - **El PIN** no puede ser fácil de adivinar: nada de 1234, 2468, 1212, 2580 ni un año.
   - **Avisarle** que la app mide cuánto la usa y cuánto tarda en cerrar el día (no lo que escribe ni dónde está).
6. **Crear la obra** en "Obras → Nueva obra": cliente y su teléfono, dirección, el PM, las fechas, el contrato y los
   espacios con sus pies². Los pies lineales de cada espacio se ponen en el presupuesto.
7. **El presupuesto:** costo y precio por etapa en cada espacio, hasta que diga "lista para arranque". Donde haya
   histórico, la app sugiere el costo ("Usar").
8. **Las órdenes de trabajo** de los subs en "Subcontratos" de la obra; se pueden emitir varias de un sub de una vez.
   El sub no tiene que confirmarlas: el cierre del PM marca cuándo llegó y cuándo terminó.
9. **El portal del cliente:** en el seguimiento de la obra, "Crear enlace para el cliente" y mandárselo por WhatsApp.
   Ahí ve el avance, las fotos que se marquen para él y sus pagos, y firma las órdenes de cambio.
10. **Probar juntos, una vez:** con el celular del PM en modo avión, abrir la app, ver que entra sin señal, y quitar
    el modo avión. Mostrarle "Cerrar el día", "Registrar gasto", "Levantar aviso" y las inspecciones, y que la
    barra azul del inicio dice cuánto falta por enviar.

## Cada día

- **El PM cierra el día:** partidas, cuadrilla con sus horas, subs que llegaron y fotos. Registra los gastos con su
  recibo y levanta avisos cuando algo se atora.
- **Sin señal no pasa nada:** lo capturado queda en el teléfono y se envía solo al volver la señal. Si tarda, en el
  inicio está "Enviar ahora".
- **Si se le olvidó cerrar**, la app se lo dice al abrirla, y puede cerrar los 2 días laborables anteriores.
- **La bitácora:** en cada obra, "Bitácora" le muestra al PM sus días cerrados (partidas, cuadrilla, subs, notas y
  fotos), y le deja corregir el cierre de las últimas 48 horas.
- **Inspecciones:** al llegar a un punto de control, el PM la hace desde la obra ("Todo cumple" o marca lo que
  falla). Si algo falló, la siguiente vez solo revisa eso.
- **Si el cliente pide algo extra o aparece algo escondido**, el PM levanta un aviso (tipo Cliente, Condición oculta
  o Diseño) con fotos. El dueño, en "Avisos por contestar", toca "Hacer orden de cambio": viene llenada con lo del
  PM, la describe como se la va a explicar al cliente y la emite; al PM se le contesta solo. Mientras el cliente no
  responda, la puede editar.
- **Fotos para el cliente:** en el álbum, tocar "Cliente" en las que el cliente debe ver.
- **En iPhone**, abrir la app al menos una vez cada pocos días: si pasa una semana sin abrirla, Safari puede borrar
  lo que guardó para trabajar sin señal.

## Cada semana

El dueño revisa en la app:

- **"Indicadores":** los seis del lunes; el que no esté en verde se abre y dice qué obra lo causa.
- **El seguimiento de la obra:** avance, gastado contra presupuesto y margen proyectado.
- **"Cuadrilla → Horas de la semana":** las horas de cada trabajador para la nómina.
- **"Subcontratos" de la obra:** "Liquidar" lo que ya terminaron.
- **"Cobros" de la obra:** lo que pagó el cliente, incluidas las órdenes de cambio.
- **Plataforma → "Uso de la app":** cuánto la usó el PM y cuánto tarda en cerrar.

## Al terminar la obra

1. **Punch list y prueba de agua** cerrados.
2. **"Cerrar la obra"** desde el seguimiento: entrega y garantía. Los costos pasan al histórico y mejoran las
   sugerencias de los presupuestos que siguen.
3. **Después de la entrega:** fotos finales, reseña y referido, cada paso con Sí o No.
4. **"Expediente en PDF"** desde el seguimiento, para guardar todo lo de la obra.

## Si algo falla

- **El PM olvidó su PIN, cambió de celular o lo bloqueó:** el dueño le manda una nueva invitación en "Managers". Un
  PIN equivocado 5 veces bloquea 15 minutos; si sigue fallando, 1 hora y después 24 horas.
- **El dueño no puede entrar:** quien administra la plataforma corre `invitar-de-nuevo.ts` (ver CLAUDE.md).
- **Algo no se envía o se rechazó:** en el inicio del PM se ve qué y por qué. Tomar captura y anotarlo.
- **El cliente perdió su enlace:** se vuelve a copiar del seguimiento.
- **Cualquier cosa rara:** captura de pantalla, la hora y qué estaba haciendo. Sirve más que una descripción.

## Al terminar el piloto

Después de al menos 2 semanas (mejor, la obra completa): los tiempos de cierre, el uso, los números revisados y lo
que dijeron el PM y el cliente. Con eso se decide qué se corrige antes de llevar la app a las demás obras.
