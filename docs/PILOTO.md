# Piloto de la fase 2

Un PM real usa la app en una obra real de IJM **al menos 2 semanas**, en paralelo con el sistema actual (el libro
de Google Sheets). Al final, los datos de los dos tienen que cuadrar. Es el último criterio de "terminado" de la
fase 2 ([PLAN_FASE_2.md](PLAN_FASE_2.md)).

## Qué se mide

- **Que cuadre:** cada día cerrado, las partidas, la cuadrilla, los gastos y los avisos, en la app y en el libro.
- **El tiempo de cierre:** un día normal (partidas, cuadrilla, sub y 2 fotos) en menos de 60 segundos. Se cronometra
  en al menos 3 días distintos, desde que el PM abre "Cerrar el día" hasta que ve "Día cerrado".
- **La señal de verdad:** cuántas veces se quedó algo en la cola, y si todo llegó solo.
- **Lo que diga el PM:** qué le estorba, qué le falta, qué no entiende.

## Antes de empezar

Lo hace el dueño, en una semana antes del arranque de la obra.

1. **La app al día.** Fusionar las ramas pendientes, con sus migraciones subidas antes
   (`pnpm.cmd exec supabase db push --linked`). Entrar a https://j-solutions-nine.vercel.app con el PIN y abrir
   unas fotos del álbum: si eso funciona, la app publicada está bien.
2. **Elegir la obra y el PM.** Una obra que arranque en los próximos días y dure al menos 2 semanas, de preferencia
   con baño (tiene puntos de control y prueba de agua). Un PM con su propio celular.
3. **Revisar el catálogo** en "Catálogo": que estén las partidas del tipo de obra, sus etapas y puntos de control,
   la cuadrilla y los subcontratistas que van a trabajar ahí. Se cargó del libro el 2026-10-08.
4. **Dar de alta la obra** en "Obras → Nueva obra": cliente, dirección, el PM, las fechas, el contrato y sus
   espacios. Después, el presupuesto: un monto por etapa en cada espacio, hasta que diga "lista para arranque".
5. **Invitar al PM** en "Equipo": su nombre, su correo y su idioma. Copiar la invitación y mandársela por WhatsApp.
   Vale 7 días y se usa una vez.
6. **Instalar la app en el celular del PM**, en persona (unos 10 minutos):
   - **Android (Chrome):** abrir el enlace de la invitación en Chrome, tocar "Verificar este celular" y elegir el
     PIN de 4 dígitos. Después, en el menú ⋮ de Chrome, "Instalar app" (o "Agregar a pantalla principal").
   - **iPhone (Safari):** primero instalar. Abrir https://j-solutions-nine.vercel.app en Safari, tocar Compartir →
     "Agregar a inicio" y abrir la app desde su ícono. Va a decir "Este celular no tiene acceso": copiar el enlace
     de la invitación del WhatsApp, pegarlo ahí y tocar "Abrir la invitación". En el iPhone la app instalada no
     comparte nada con Safari, por eso la invitación se abre dentro de ella (D-057).
   - **El PIN** no puede ser fácil de adivinar: nada de 1234, 2468, 1212, 2580 ni un año.
7. **Probar juntos, una vez:** con el celular en modo avión, abrir la app, ver que entra sin señal, y quitar el modo
   avión. Mostrarle "Cerrar el día", "Registrar gasto" y "Levantar aviso", y que la barra azul del inicio dice
   cuánto falta por enviar.

## Cada día

- **El PM cierra el día en la app y en el sistema actual**, como siempre. Lo mismo con los gastos y los avisos.
- **Sin señal no pasa nada:** lo que capture queda en el teléfono y se envía solo cuando vuelva. Si tarda, en el
  inicio está "Enviar ahora".
- **Si se le olvidó cerrar**, la app se lo dice al abrirla, y puede cerrar los 2 días laborables anteriores.
- **En iPhone**, abrir la app al menos una vez cada pocos días: si no se abre en una semana, Safari puede borrar lo
  que la app guardó para trabajar sin señal.

## Cada semana

El dueño exporta lo que se capturó en la app y lo compara con el libro:

```
pnpm.cmd exec tsx --env-file=.env.nube packages/servidor/scripts/exportar-obra.ts --empresa "IJM Construction" --obra OB-0XX
```

Deja `piloto-OB-0XX.xlsx` con las hojas del libro actual: **Dias** (cada día desde el inicio, si se cerró, cuándo
llegó y si fue tardío), **Bitacora**, **Avance**, **Mano_Obra**, **Gastos**, **Avisos**, **Calidad**,
**Pruebas_Agua**, **Punch_List** y **Ordenes_Trabajo**. Para cada diferencia se anota la fecha, qué es, qué dice la
app, qué dice el libro y por qué. Una diferencia puede ser un error de la app, un error de captura en uno de los dos,
o una regla que la app aplica distinto (las diferencias intencionales con el legacy están en
[DECISIONES.md](DECISIONES.md)).

## Si algo falla

- **El PM olvidó su PIN, cambió de celular o lo bloqueó:** el dueño lo reinvita en "Equipo". Un PIN equivocado 5
  veces bloquea 15 minutos; si sigue fallando, 1 hora y después 24 horas.
- **El dueño no puede entrar:** quien administra la plataforma corre `invitar-de-nuevo.ts` (ver CLAUDE.md).
- **Algo no se envía o se rechazó:** en el inicio del PM se ve qué y por qué. Tomar captura y anotarlo.
- **Cualquier cosa rara:** captura de pantalla, la hora y qué estaba haciendo. Sirve más que una descripción.

## Al terminar

Después de 2 semanas o más: la última exportación, la comparación completa, los tiempos de cierre y lo que dijo el
PM. Con eso se decide si la app sustituye al libro para esa obra, y qué se corrige antes de la fase 3.
