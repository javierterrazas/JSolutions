# fuente/ — el código de las dos apps, en un solo juego de archivos

Los cuatro archivos que se pegan en Apps Script (`App_Dueno.gs`, `App_PM.gs`, `Dueno.html`, `PM.html`) se
**generan** desde aquí con `python3 construir.py`. Nunca los edites directamente: la siguiente construcción
borraría tus cambios.

## Qué hay en cada carpeta

| Carpeta | Qué contiene |
| --- | --- |
| `comun/` | Lo que usan las dos apps, una sola vez: acceso, datos, obra, cronograma, validaciones, errores y utilidades |
| `admin/` | Solo del administrador: `config.js` (constantes), `servidor.js` (funciones), `final.js`, y la pantalla `Dueno.html` |
| `pm/` | Solo del PM, con la misma estructura, y la pantalla `PM.html` |
| `cliente/comun.js` | Lo que comparten las dos pantallas |

Las pantallas llevan dos marcas que el constructor reemplaza: `@@COMUN@@` (cliente/comun.js) y `@@IDIOMA@@`
(el diccionario de inglés que se genera desde `idioma_en.py`).

## Reglas

- **Lo compartido va una sola vez en `comun/`.** Si una función tiene que comportarse distinto en cada app,
  usa las constantes de `config.js` (`APP_NOMBRE_`, `PREFIJO_SESION_`) o déjala en la carpeta de su app.
- **La lista de hojas del PM (`SH` en `pm/config.js`) es más corta a propósito:** no incluye presupuesto,
  cobros ni pagos. Es parte de la muralla financiera. El constructor se detiene si el código compartido usa
  una hoja que alguna app no tiene.
- **Un nombre, una definición:** el constructor se detiene si algo está definido dos veces.

## El ciclo de un cambio

1. Edita los archivos de `fuente/`.
2. `python3 construir.py` — arma los cuatro archivos y revisa su sintaxis.
3. `bash correr_pruebas.sh` (en el paquete de pruebas) — solo si dice TODO BIEN, sigue.
4. Pega los archivos en Apps Script y crea una nueva versión de la implementación.

**Opcional:** crea `fuente/instalacion.json` con `{"SS_ID": "el ID de tu libro"}` y los archivos saldrán con
tu libro ya puesto, sin reemplazarlo a mano en cada actualización.
