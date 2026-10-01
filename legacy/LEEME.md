# Código fuente y pruebas del sistema IJM

- `app/fuente/` — **el código de las dos apps, en un solo juego de archivos**: lo compartido en módulos
  (`comun/`) y lo propio de cada app en su carpeta. Su `LEEME.md` explica la estructura y las reglas.
- `app/construir.py` — arma desde `fuente/` los cuatro archivos que se pegan en Apps Script. `app/` también
  trae esos archivos ya construidos, la plantilla de Excel y las herramientas que la generan.
- `pruebas/` y `sim/` — más de 40 pruebas y el mes simulado que se usaron para construir el sistema.
- `app/Gestion_Obra_IJM.xlsx` es el libro con las **obras de ejemplo que usan las pruebas** (buscan esas obras
  por su ID y sus montos). El libro para instalar se entrega aparte y trae las obras del último mes simulado.

## Cómo correrlas

Necesitas Node 18 o más reciente y Python 3 con `openpyxl` (`pip install openpyxl`). Para las pruebas del
navegador, además: `pip install playwright` y `playwright install chromium`.

    bash correr_pruebas.sh

El script **primero construye** las apps desde `app/fuente/` y luego prueba lo construido: así no se puede
probar una versión y publicar otra. Al final debe decir **TODO BIEN**.

## Si cambias algo

1. Edita `app/fuente/` (nunca los archivos construidos: se sobrescriben).
2. Si cambiaste textos de las pantallas, agrega su traducción en `app/idioma_en.py`.
3. Corre `bash correr_pruebas.sh`. Solo con TODO BIEN, pega los cuatro archivos de `app/` en Apps Script y
   crea una nueva versión de la implementación.
