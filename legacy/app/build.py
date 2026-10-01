"""Construye Gestion_Obra_IJM.xlsx - Procesos 3 (control diario) y 4 (ordenes de cambio)."""
import datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

WB = Workbook()
WB.remove(WB.active)

FONT = "Arial"
HDR_FILL = PatternFill("solid", fgColor="1F3864")
HDR_FONT = Font(name=FONT, bold=True, color="FFFFFF", size=10)
TITLE_FONT = Font(name=FONT, bold=True, size=14, color="1F3864")
SUB_FONT = Font(name=FONT, italic=True, size=9, color="555555")
BASE_FONT = Font(name=FONT, size=10)
INPUT_FONT = Font(name=FONT, size=10, color="0000FF")
FORM_FONT = Font(name=FONT, size=10, color="000000")
YELLOW = PatternFill("solid", fgColor="FFF2CC")
GREY = PatternFill("solid", fgColor="F2F2F2")
THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

DATE_FMT = "MM/DD/YYYY"
MONEY = '$#,##0;($#,##0);-'
PCT = '0.0%'

TODAY = dt.date(2026, 9, 16)


def d(days_ago):
    return TODAY - dt.timedelta(days=days_ago)


def sheet(name, headers, widths=None, tab_color=None):
    ws = WB.create_sheet(name)
    if tab_color:
        ws.sheet_properties.tabColor = tab_color
    for i, h in enumerate(headers, start=1):
        c = ws.cell(row=1, column=i, value=h)
        c.font = HDR_FONT
        c.fill = HDR_FILL
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = BORDER
    ws.row_dimensions[1].height = 30
    if widths:
        for i, w in enumerate(widths, start=1):
            ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"
    return ws


def put(ws, row, values, fmts=None, font=None):
    for i, v in enumerate(values, start=1):
        c = ws.cell(row=row, column=i, value=v)
        c.font = font or BASE_FONT
        c.border = BORDER
        if fmts and fmts[i - 1]:
            c.number_format = fmts[i - 1]


# ----------------------------------------------------------------------------
# 0. INSTRUCCIONES
# ----------------------------------------------------------------------------
ws = WB.create_sheet("Instrucciones")
ws.sheet_properties.tabColor = "1F3864"
ws.column_dimensions["A"].width = 26
ws.column_dimensions["B"].width = 96
ws["A1"] = "SISTEMA DE GESTION DE OBRA - IJM"
ws["A1"].font = TITLE_FONT
ws["A2"] = "Proceso 3: Arranque y control diario  |  Proceso 4: Control de cambios"
ws["A2"].font = SUB_FONT

filas = [
    ("COMO FUNCIONA", ""),
    ("Regla central", "Nadie escribe directo en las hojas de datos. Todo entra por las dos apps (Dueño y PM). Las hojas son la base de datos."),
    ("Muralla financiera", "La app del PM nunca lee ni escribe precio de venta, presupuesto por partida ni margen. Solo Proyectos!F (pm_email) filtra lo que ve."),
    ("Acceso del PM", "El PM NO se agrega como colaborador de este archivo. La app se despliega como 'Ejecutar como: yo' y 'Acceso: cualquiera con la liga'."),
    ("", ""),
    ("HOJAS QUE TU LLENAS A MANO (una sola vez)", ""),
    ("Config", "Parametros del negocio. Celdas azules = editables."),
    ("Usuarios", "Usuario (cualquier texto), PIN, rol admin | pm. El admin necesita correo_avisos."),
    ("Proyectos", "Alta de obra: un cliente, un contrato, una entrega. Los pies2 y el tipo salen de Areas."),
    ("Areas", "Los espacios de cada obra: Generales de obra una vez, mas un area por espacio (baño, cocina...)."),
    ("Partidas_Catalogo", "Secuencia estandar por tipo de obra. Se edita desde la app del dueño, pestana Catalogo."),
    ("Checklist_Calidad", "Los 5 puntos de control con sus preguntas. Editable desde la app del dueño."),
    ("Subcontratistas", "Banco de subs. Se administra desde la app. La calificacion la calcula el sistema."),
    ("Trabajadores", "Cuadrilla propia de la empresa. La columna tarifa NUNCA viaja a la app del PM."),
    ("", ""),
    ("HOJAS QUE LLENAN LAS APPS (no tocar)", ""),
    ("Bitacora", "Cierre de dia del PM: partida del dia, quien estuvo y fotos. Proceso 3."),
    ("Avance", "Avance por partida en dos estados. Proceso 3."),
    ("Gastos", "Cargos de tarjeta de empresa con foto de recibo. Proceso 3."),
    ("Mano_Obra", "Asistencia diaria de la cuadrilla propia por obra y partida. Proceso 3."),
    ("Calidad", "Inspeccion por hito con fotos. Una partida con hito no se cierra sin esto. Proceso 5."),
    ("Punch_List", "Lo que senala el cliente en el recorrido de entrega. Se cierra en 7 dias habiles. Proceso 6."),
    ("Entrega", "Acta, garantia y cosecha comercial: una fila por obra entregada. Proceso 6."),
    ("Pruebas_Agua", "Prueba de inundacion de 24 h, con foto de inicio y de fin. Proceso 5."),
    ("Pagos_Sub", "Pagos a subcontratistas, SIEMPRE contra una orden de trabajo. Nunca como gasto suelto."),
    ("Cobros", "Dinero que entra del cliente: deposito, hitos y ordenes de cambio."),
    ("Presupuesto", "El costo que esperas por etapa y por espacio (no el precio al cliente). La base del desvío y del costo unitario."),
    ("Obras_Cerradas", "Foto congelada de cada obra al cerrarla. Es el historico del negocio. No escribir a mano."),
    ("Correcciones", "Rastro de auditoria: quien cambio que, cuando y por que. Nada se borra."),
    ("Ordenes_Trabajo", "Ordenes a subs por partida: precio cerrado, confirmacion T-48h y aprobacion. Proceso 3."),
    ("Bloqueos", "Avisos del PM y respuesta del dueño (SLA 24h). Proceso 3."),
    ("Ordenes_Cambio", "Hallazgo, cotizacion, autorizacion, cobro. Proceso 4."),
    ("No_Calidad", "Retrabajos y reclamos de garantia que absorbe la empresa. Procesos 4 y 6."),
    ("", ""),
    ("HOJAS DE REPORTE (formulas)", ""),

    ("(sin hojas de reporte)", "Tablero e indicadores se calculan solo en la app del dueño: una sola verdad."),
    ("", ""),
    ("LOS TRES CUBOS DE COSTO", ""),
    ("Materiales y gastos", "Hoja Gastos. Lo que se compra con tarjeta de la empresa."),
    ("Cuadrilla propia", "Hoja Mano_Obra. Horas o dias por tarifa del trabajador."),
    ("Subcontrato", "Hojas Ordenes_Trabajo (compromiso) y Pagos_Sub (desembolso). NUNCA en Gastos."),
    ("", ""),
    ("IMPORTANTE", "Las filas 2 a 6 de cada hoja de datos traen datos de ejemplo. Borralas antes de usar en produccion."),
]
r = 4
for a, b in filas:
    ws.cell(row=r, column=1, value=a).font = Font(name=FONT, bold=True, size=10) if b == "" or a.isupper() else BASE_FONT
    c = ws.cell(row=r, column=2, value=b)
    c.font = BASE_FONT
    c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[r].height = 26 if b else 14
    r += 1

# ----------------------------------------------------------------------------
# 1. CONFIG
# ----------------------------------------------------------------------------
ws = sheet("Config", ["Parametro", "Valor", "Descripcion"], [38, 16, 62], "7F7F7F")
cfg = [
    ("EMPRESA", "IJM Construction", "Nombre que aparece en las apps"),
    ("CIUDAD", "Austin, TX", ""),
    ("IMPUESTO", 0.0825, "Sales tax aplicable a ordenes de cambio"),
    ("LIMITE_COMPRA_PM", 300, "Monto max. que el PM puede gastar sin autorizacion"),
    ("SLA_BLOQUEO_HORAS", 24, "Horas max. para que el dueño responda un aviso"),
    ("SLA_OC_HORAS", 48, "Horas max. del hallazgo a la OC emitida"),
    ("UMBRAL_OC_MENOR", 200, "Debajo de este monto la OC se acumula o se absorbe"),
    ("MARGEN_MINIMO_OC", 0.35, "Margen minimo exigido en una orden de cambio"),
    ("HORAS_SIN_RECIBO", 72, "Horas max. de un cargo sin foto de recibo"),
    ("META_TASA_REPORTE", 0.95, "Tasa de cierre de dia del PM"),
    ("META_PRESENTACION_SUBS", 0.90, "Subs que llegan vs. subs que confirmaron"),
    ("META_OC_AUTORIZADAS", 0.70, "% de OC que el cliente aprueba"),
    ("MAX_OC_SOBRE_CONTRATO", 0.20, "Arriba de esto, el problema esta en la estimacion"),
    ("MAX_NO_CALIDAD", 0.02, "Costo de no calidad sobre ingresos"),
    ("ID_CARPETA_DRIVE", "PEGAR_AQUI_EL_ID", "Carpeta de Drive donde se guardan fotos y recibos"),
    ("ULTIMO_CAMBIO", "", "Lo actualiza el sistema en cada registro. No se edita a mano."),
]
for i, (k, v, desc) in enumerate(cfg, start=2):
    put(ws, i, [k, v, desc])
    ws.cell(row=i, column=2).font = INPUT_FONT
    ws.cell(row=i, column=2).fill = YELLOW
    if isinstance(v, float) and v < 1:
        ws.cell(row=i, column=2).number_format = PCT
    elif isinstance(v, int) and k.startswith(("LIMITE", "UMBRAL")):
        ws.cell(row=i, column=2).number_format = MONEY

# ----------------------------------------------------------------------------
# 2. USUARIOS
# ----------------------------------------------------------------------------
ws = sheet("Usuarios", ["usuario", "pin", "nombre", "rol", "tarjeta_ultimos4", "telefono", "activo",
                        "correo_avisos", "idioma"],
           [18, 10, 24, 10, 16, 16, 10, 28, 10], "7F7F7F")
usuarios = [
    ("javier", "482915", "Javier", "admin", "", "512-555-0100", "SI", "javier@ijm.com", "es"),
    ("carlos", "2468", "Carlos Mendez", "pm", "4417", "512-555-0111", "SI", "", "es"),
    ("luis", "1357", "Luis Ramirez", "pm", "8832", "512-555-0122", "SI", "", "en"),
]
for i, u in enumerate(usuarios, start=2):
    put(ws, i, list(u))
dv = DataValidation(type="list", formula1='"admin,pm"', allow_blank=True)
ws.add_data_validation(dv)
dv.add("D2:D200")

# ----------------------------------------------------------------------------
# 3. PROYECTOS
# ----------------------------------------------------------------------------
ws = sheet("Proyectos", ["proyecto_id", "cliente", "telefono_cliente", "direccion", "etiqueta",
                         "pm_usuario", "fecha_inicio", "fecha_fin_est", "fecha_fin_real", "estado",
                         "contrato_original", "notas"],
           [14, 22, 16, 34, 16, 22, 13, 13, 13, 16, 16, 30], "2E75B6")
proyectos = [
    ("OB-001", "Familia Ruiz", "512-555-0201", "4312 Wilshire Blvd, Austin TX", "Baño",
     "carlos", d(18), d(-6), None, "En obra", 24500, "Baño principal + medio baño"),
    ("OB-002", "Sarah Coleman", "512-555-0202", "1907 Bluebonnet Ln, Austin TX", "Cocina",
     "carlos", d(32), d(12), None, "En obra", 68000, "Gabinetes pedidos 08/20"),
    ("OB-003", "Mark Delgado", "512-555-0203", "805 Red River St, Austin TX", "Baño",
     "luis", d(7), d(14), None, "En obra", 19800, "Condominio, acceso 8am-5pm"),
    ("OB-004", "Familia Nguyen", "512-555-0204", "2210 Barton Springs Rd, Austin TX", "Baño + Closet",
     "luis", d(-4), d(24), None, "Lista para arranque", 31400, "Baño de visitas y closet principal"),
]
fmts = [None, None, None, None, None, None, DATE_FMT, DATE_FMT, DATE_FMT, None, MONEY, None]
for i, p in enumerate(proyectos, start=2):
    put(ws, i, list(p), fmts)
dv = DataValidation(type="list", formula1='"Lista para arranque,En obra,Detenida,En cierre,Entregada"', allow_blank=True)
ws.add_data_validation(dv)
dv.add("J2:J300")
# tipo_obra ya no se valida: es una etiqueta derivada de las areas ("Baño + Closet")

AR = {"OB-001": "AR-0002", "OB-002": "AR-0004", "OB-003": "AR-0006"}

# ----------------------------------------------------------------------------
# 3b. AREAS  (el proyecto es la unidad comercial; el area, la tecnica)
# ----------------------------------------------------------------------------
ws = sheet("Areas", ["area_id", "proyecto_id", "tipo", "nombre", "pies2", "pies_lineales", "orden"],
           [12, 13, 14, 26, 10, 14, 8], "2E75B6")
AREAS = [
    ("AR-0001", "OB-001", "Generales", "Generales de obra", 0, 0, 0),
    ("AR-0002", "OB-001", "Baño", "Baño principal", 42, 0, 1),
    ("AR-0003", "OB-002", "Generales", "Generales de obra", 0, 0, 0),
    ("AR-0004", "OB-002", "Cocina", "Cocina", 180, 22, 1),
    ("AR-0005", "OB-003", "Generales", "Generales de obra", 0, 0, 0),
    ("AR-0006", "OB-003", "Baño", "Baño", 38, 0, 1),
    ("AR-0007", "OB-004", "Generales", "Generales de obra", 0, 0, 0),
    ("AR-0008", "OB-004", "Baño", "Baño de visitas", 30, 0, 1),
    ("AR-0009", "OB-004", "Closet", "Closet principal", 26, 14, 2),
]
for i, a_ in enumerate(AREAS, start=2):
    put(ws, i, list(a_), [None, None, None, None, "0", "0", "0"])

# ----------------------------------------------------------------------------
# 4. PARTIDAS_CATALOGO
# ----------------------------------------------------------------------------
ws = sheet("Partidas_Catalogo", ["tipo_obra", "orden", "partida", "hito_calidad", "peso", "dias", "quien", "paralelo", "espera", "etapa"],
           [12, 8, 40, 28, 8, 7, 14, 10, 8, 30], "7F7F7F")
generales = ["Protección y movilización", "Permisos e inspecciones", "Contenedor y disposición",
             "Limpieza final y punch list"]
# orden de trabajo real: la plantilla del vidrio se toma en cuanto se termina el tile, mientras
# la cuadrilla hace lechada y vanity; la pintura va mientras se fabrica el countertop
bano = ["Demolición y retiro de escombro", "Rough de plomería",
        "Rough eléctrico y extractor", "Blocking y framing", "Inspección rough-in",
        "Cementboard y drywall", "Impermeabilización + prueba de inundación",
        "Tile de piso y muro", "Plantilla de puerta de vidrio", "Lechada y sellado",
        "Instalación de vanity", "Plantilla de countertop", "Pintura primera mano",
        "Instalación de countertop", "Instalación de vidrio y accesorios", "Plomería final y luminarias"]
cocina = ["Demolición y retiro de escombro", "Rough de plomería",
          "Rough eléctrico", "Framing y blocking", "Inspección rough-in", "Drywall y acabado",
          "Pintura primera mano", "Piso", "Instalación de gabinetes", "Plantilla de countertop",
          "Instalación de countertop", "Backsplash", "Plomería final", "Eléctrico final y luminarias",
          "Instalación de appliances"]
closet = ["Demolición", "Reparación de muros", "Pintura",
          "Instalación de estructura", "Instalación de puertas y herrajes", "Iluminación"]
hitos = {"Demolición y retiro de escombro": "PC1 Post demolición",
         "Blocking y framing": "PC2 Pre-cierre de muros",
         "Framing y blocking": "PC2 Pre-cierre de muros",
         "Impermeabilización + prueba de inundación": "PC3 Impermeabilización",
         "Instalación de gabinetes": "PC4 Pre-acabados",
         "Instalación de countertop": "PC4 Pre-acabados",
         "Limpieza final y punch list": "PC5 Pre-entrega",
         # closet: se cuelga de los muros, necesita blocking y nivel igual que un gabinete
         "Demolición": "PC1 Post demolición",
         "Instalación de estructura": "PC4 Pre-acabados"}
PESO = {
  "Generales": {"Protección y movilización": 2, "Permisos e inspecciones": 2,
                "Contenedor y disposición": 1, "Limpieza final y punch list": 3},
  "Baño": {"Demolición y retiro de escombro": 6, "Rough de plomería": 10,
           "Rough eléctrico y extractor": 6, "Blocking y framing": 3, "Inspección rough-in": 1,
           "Cementboard y drywall": 6, "Impermeabilización + prueba de inundación": 5,
           "Tile de piso y muro": 18, "Lechada y sellado": 3, "Pintura primera mano": 3,
           "Instalación de vanity": 6, "Plantilla de countertop": 1, "Instalación de countertop": 7,
           "Plomería final y luminarias": 6, "Plantilla de puerta de vidrio": 1,
           "Instalación de vidrio y accesorios": 8},
  "Cocina": {"Demolición y retiro de escombro": 6, "Rough de plomería": 6, "Rough eléctrico": 8,
             "Framing y blocking": 3, "Inspección rough-in": 1, "Drywall y acabado": 5,
             "Pintura primera mano": 4, "Piso": 10, "Instalación de gabinetes": 20,
             "Plantilla de countertop": 1, "Instalación de countertop": 12, "Backsplash": 7,
             "Plomería final": 4, "Eléctrico final y luminarias": 5, "Instalación de appliances": 6},
  "Closet": {"Demolición": 3, "Reparación de muros": 4, "Pintura": 4,
             "Instalación de estructura": 12, "Instalación de puertas y herrajes": 5, "Iluminación": 2},
}

# cronograma: (dias habiles, quien la hace, arranca junto con la anterior, dias de espera antes)
CRONO = {
  "Generales": {"Protección y movilización": (1, "Cuadrilla", "", 0), "Permisos e inspecciones": (1, "PM", "SI", 0),
                "Contenedor y disposición": (1, "PM", "SI", 0), "Limpieza final y punch list": (1, "Cuadrilla", "", 0)},
  "Baño": {"Demolición y retiro de escombro": (2, "Cuadrilla", "", 0), "Rough de plomería": (2, "Plomería", "", 0),
           "Rough eléctrico y extractor": (1, "Eléctrico", "SI", 0), "Blocking y framing": (1, "Cuadrilla", "", 0),
           "Inspección rough-in": (1, "PM", "", 0), "Cementboard y drywall": (1, "Cuadrilla", "", 0),
           "Impermeabilización + prueba de inundación": (2, "Cuadrilla", "", 0), "Tile de piso y muro": (3, "Tile", "", 0),
           "Plantilla de puerta de vidrio": (1, "PM", "", 0), "Lechada y sellado": (1, "Cuadrilla", "SI", 0),
           "Instalación de vanity": (1, "Cuadrilla", "SI", 0), "Plantilla de countertop": (1, "PM", "", 0),
           "Pintura primera mano": (1, "Cuadrilla", "SI", 0), "Instalación de countertop": (1, "Countertops", "", 3),
           "Instalación de vidrio y accesorios": (1, "Vidrio", "SI", 3), "Plomería final y luminarias": (1, "Plomería", "", 0)},
  "Cocina": {"Demolición y retiro de escombro": (2, "Cuadrilla", "", 0), "Rough de plomería": (1, "Plomería", "", 0),
             "Rough eléctrico": (2, "Eléctrico", "SI", 0), "Framing y blocking": (1, "Cuadrilla", "", 0),
             "Inspección rough-in": (1, "PM", "", 0), "Drywall y acabado": (2, "Drywall", "", 0),
             "Pintura primera mano": (1, "Cuadrilla", "", 0), "Piso": (2, "Cuadrilla", "", 0),
             "Instalación de gabinetes": (2, "Cuadrilla", "", 0), "Plantilla de countertop": (1, "PM", "", 0),
             "Instalación de countertop": (1, "Countertops", "", 3), "Backsplash": (2, "Tile", "", 0),
             "Plomería final": (1, "Plomería", "SI", 0), "Eléctrico final y luminarias": (1, "Eléctrico", "", 0),
             "Instalación de appliances": (1, "Cuadrilla", "SI", 0)},
  "Closet": {"Demolición": (1, "Cuadrilla", "", 0), "Reparación de muros": (1, "Cuadrilla", "", 0), "Pintura": (1, "Cuadrilla", "", 0),
             "Instalación de estructura": (2, "Cuadrilla", "", 0), "Instalación de puertas y herrajes": (1, "Cuadrilla", "", 0),
             "Iluminación": (1, "Eléctrico", "SI", 0)},
}

# etapas del presupuesto: un monto por etapa, no por partida
ETAPAS = {
  "Generales": {p: "Generales de obra" for p in ["Protección y movilización", "Permisos e inspecciones", "Contenedor y disposición", "Limpieza final y punch list"]},
  "Baño": {"Demolición y retiro de escombro": "Demolición", "Rough de plomería": "Plomería", "Inspección rough-in": "Plomería",
           "Plomería final y luminarias": "Plomería", "Rough eléctrico y extractor": "Eléctrico", "Blocking y framing": "Carpintería y muros",
           "Cementboard y drywall": "Carpintería y muros", "Impermeabilización + prueba de inundación": "Impermeabilización",
           "Tile de piso y muro": "Tile", "Lechada y sellado": "Tile", "Pintura primera mano": "Pintura",
           "Instalación de vanity": "Vanity y countertop", "Plantilla de countertop": "Vanity y countertop", "Instalación de countertop": "Vanity y countertop",
           "Plantilla de puerta de vidrio": "Vidrio y accesorios", "Instalación de vidrio y accesorios": "Vidrio y accesorios"},
  "Cocina": {"Demolición y retiro de escombro": "Demolición", "Rough de plomería": "Plomería", "Inspección rough-in": "Plomería", "Plomería final": "Plomería",
             "Rough eléctrico": "Eléctrico", "Eléctrico final y luminarias": "Eléctrico", "Framing y blocking": "Carpintería y muros",
             "Drywall y acabado": "Carpintería y muros", "Pintura primera mano": "Pintura", "Piso": "Piso", "Instalación de gabinetes": "Gabinetes",
             "Plantilla de countertop": "Countertop", "Instalación de countertop": "Countertop", "Backsplash": "Backsplash", "Instalación de appliances": "Appliances"},
  "Closet": {"Demolición": "Demolición", "Reparación de muros": "Muros y pintura", "Pintura": "Muros y pintura",
             "Instalación de estructura": "Sistema de closet", "Instalación de puertas y herrajes": "Sistema de closet", "Iluminación": "Eléctrico"},
}
r = 2
for tipo, lista in (("Generales", generales), ("Baño", bano), ("Cocina", cocina), ("Closet", closet)):
    for n, part in enumerate(lista, start=1):
        put(ws, r, [tipo, n, part, hitos.get(part, ""), PESO[tipo].get(part, 1)] + list(CRONO[tipo].get(part, (1, "Cuadrilla", "", 0))) + [ETAPAS[tipo].get(part, "")])
        r += 1

# ----------------------------------------------------------------------------
# 5. SUBCONTRATISTAS
# ----------------------------------------------------------------------------
ws = sheet("Subcontratistas", ["sub_id", "nombre", "oficio", "telefono", "seguro_vence",
                               "activo", "contacto", "correo", "licencia", "licencia_vence", "w9"],
           [10, 26, 18, 16, 14, 10, 20, 26, 16, 15, 8], "7F7F7F")
subs = [
    ("SUB-01", "Rios Plumbing LLC", "Plomería", "512-555-0301", dt.date(2027, 3, 31), "SI",
     "Arturo Rios", "arturo@riosplumbing.com", "M-40218", dt.date(2027, 8, 31), "SI"),
    ("SUB-02", "Hill Country Electric", "Eléctrico", "512-555-0302", dt.date(2027, 1, 15), "SI",
     "Dana Whitfield", "", "", None, "NO"),
    ("SUB-03", "Magaña Tile Works", "Tile", "512-555-0303", dt.date(2026, 12, 20), "SI",
     "Ramiro Magaña", "", "", None, "SI"),
    ("SUB-04", "ATX Demolition", "Demolición", "512-555-0304", dt.date(2027, 6, 30), "SI",
     "", "", "", None, "NO"),
    ("SUB-05", "Lone Star Countertops", "Countertops", "512-555-0305", dt.date(2027, 2, 28), "SI",
     "", "ventas@lonestarcounters.com", "", None, "SI"),
    ("SUB-06", "Perez Drywall & Paint", "Drywall/Pintura", "512-555-0306", dt.date(2026, 11, 30), "SI",
     "Hector Perez", "", "", None, "NO"),
]
for i, sb in enumerate(subs, start=2):
    put(ws, i, list(sb), [None, None, None, None, DATE_FMT, None, None, None, None, DATE_FMT, None])
for col in ("F", "K"):
    dv = DataValidation(type="list", formula1='"SI,NO"', allow_blank=True)
    ws.add_data_validation(dv); dv.add(col + "2:" + col + "300")

# ----------------------------------------------------------------------------
# 6. BITACORA (proceso 3)
# ----------------------------------------------------------------------------
ws = sheet("Bitacora", ["bitacora_id", "fecha", "proyecto_id", "usuario", "partidas",
                        "subs_presentes", "incidencia", "fotos_url", "timestamp", "estado", "tardio", "fotos_pendientes"],
           [14, 12, 13, 22, 42, 26, 32, 40, 18, 12], "C00000")
bit = [
    ("BIT-0001", d(3), "OB-001", "carlos", "Tile de piso y muro", "Magaña Tile Works", "", "https://drive.google.com/ejemplo1", d(3)),
    ("BIT-0002", d(2), "OB-001", "carlos", "Tile de piso y muro", "Magaña Tile Works", "", "https://drive.google.com/ejemplo2", d(2)),
    ("BIT-0003", d(1), "OB-001", "carlos", "Tile de piso y muro; Lechada y sellado", "Magaña Tile Works", "Falto lechada color Delorean", "https://drive.google.com/ejemplo3", d(1)),
    ("BIT-0004", d(1), "OB-002", "carlos", "Plantilla de countertop", "Lone Star Countertops", "", "https://drive.google.com/ejemplo4", d(1)),
    ("BIT-0005", d(1), "OB-003", "luis", "Rough de plomería", "Rios Plumbing LLC", "Se encontro tubo galvanizado", "https://drive.google.com/ejemplo5", d(1)),
]
for i, b in enumerate(bit, start=2):
    put(ws, i, list(b) + ["Vigente"], [None, DATE_FMT, None, None, None, None, None, None, DATE_FMT, None])

# ----------------------------------------------------------------------------
# 7. AVANCE
# ----------------------------------------------------------------------------
ws = sheet("Avance", ["avance_id", "fecha", "proyecto_id", "partida", "estado", "usuario",
                      "timestamp", "vigencia", "area_id"],
           [13, 12, 13, 40, 14, 22, 18, 12, 12], "C00000")
av = [
    ("AV-0001", d(10), "OB-001", "Impermeabilización + prueba de inundación", "Terminada", "carlos", d(10)),
    ("AV-0002", d(5), "OB-001", "Tile de piso y muro", "En progreso", "carlos", d(5)),
    ("AV-0003", d(1), "OB-001", "Tile de piso y muro", "Terminada", "carlos", d(1)),
    ("AV-0004", d(1), "OB-002", "Instalación de gabinetes", "Terminada", "carlos", d(1)),
    ("AV-0005", d(1), "OB-002", "Plantilla de countertop", "En progreso", "carlos", d(1)),
    ("AV-0006", d(1), "OB-003", "Rough de plomería", "En progreso", "luis", d(1)),
]
for i, a in enumerate(av, start=2):
    put(ws, i, list(a) + ["Vigente", AR[a[2]]], [None, DATE_FMT, None, None, None, None, DATE_FMT, None, None])
dv = DataValidation(type="list", formula1='"En progreso,Terminada"', allow_blank=True)
ws.add_data_validation(dv)
dv.add("E2:E2000")

# ----------------------------------------------------------------------------
# 8. GASTOS
# ----------------------------------------------------------------------------
ws = sheet("Gastos", ["gasto_id", "fecha", "proyecto_id", "categoria", "proveedor", "descripcion",
                      "monto", "metodo_pago", "tarjeta_ultimos4", "recibo_url", "usuario", "timestamp",
                      "partida", "estado", "area_id", "revision"],
           [13, 12, 13, 18, 22, 30, 12, 20, 16, 34, 22, 18, 36, 12, 12], "C00000")
gastos = [
    ("GTO-0001", d(6), "OB-001", "Material", "Floor & Decor", "Tile 12x24 + thinset", 1240, "Tarjeta de la empresa", "4417", "https://drive.google.com/rec1", "carlos", d(6), "Tile de piso y muro"),
    ("GTO-0002", d(3), "OB-001", "Material", "Home Depot", "Lechada y sellador", 186, "Tarjeta de la empresa", "4417", "https://drive.google.com/rec2", "carlos", d(3), "Lechada y sellado"),
    ("GTO-0003", d(2), "OB-002", "Material", "Ferguson", "Llave de fregadero", 420, "Tarjeta de la empresa", "4417", "", "carlos", d(2), "Plomería final"),
    ("GTO-0004", d(1), "OB-003", "Renta equipo", "United Rentals", "Contenedor de escombro", 385, "Tarjeta de la empresa", "8832", "https://drive.google.com/rec4", "luis", d(1), "Contenedor y disposición"),
    ("GTO-0005", d(1), "OB-003", "Material", "Home Depot", "PEX y conexiones", 212, "Tarjeta de la empresa", "8832", "", "luis", d(1), "Rough de plomería"),
]
for i, g in enumerate(gastos, start=2):
    area = "AR-0005" if g[0] == "GTO-0004" else AR[g[2]]
    put(ws, i, list(g) + ["Vigente", area], [None, DATE_FMT, None, None, None, None, MONEY, None, None, None, None, DATE_FMT, None, None, None])
# "Mano de obra" NO es categoria de gasto: la propia va en Mano_Obra y el sub en Ordenes_Trabajo
dv = DataValidation(type="list", formula1='"Material,Renta equipo,Herramienta,Permisos,Disposicion,Otro"', allow_blank=True)
ws.add_data_validation(dv)
dv.add("D2:D3000")

# ----------------------------------------------------------------------------
# 9. ORDENES_TRABAJO
# ----------------------------------------------------------------------------
ws = sheet("Ordenes_Trabajo", ["ot_id", "proyecto_id", "sub_id", "oficio", "alcance", "precio",
                               "fecha_inicio_prog", "fecha_fin_prog", "estado", "fecha_confirmacion",
                               "se_presento", "fecha_aprobacion", "aprobada_por", "partida", "area_id", "faltas"],
           [12, 13, 11, 16, 40, 12, 16, 16, 14, 16, 13, 16, 22, 36, 12], "C00000")
ots = [
    ("OT-0001", "OB-001", "SUB-03", "Tile", "Tile de piso y muro baño principal, incluye lechada", 3800, d(6), d(1), "Aprobada", d(8), "SI", d(1), "carlos", "Tile de piso y muro"),
    ("OT-0002", "OB-002", "SUB-05", "Countertops", "Plantilla, fabricacion e instalacion de cuarzo", 5400, d(1), d(-10), "Confirmada", d(4), "SI", None, "", "Instalación de countertop"),
    ("OT-0003", "OB-003", "SUB-01", "Plomería", "Rough de plomería baño completo", 2900, d(2), d(-1), "Confirmada", d(5), "SI", None, "", "Rough de plomería"),
    ("OT-0004", "OB-003", "SUB-02", "Eléctrico", "Rough eléctrico + extractor con ducto al exterior", 1850, d(-2), d(-4), "Emitida", None, "", None, "", "Rough eléctrico y extractor"),
]
for i, o in enumerate(ots, start=2):
    put(ws, i, list(o) + [AR[o[1]]], [None, None, None, None, None, MONEY, DATE_FMT, DATE_FMT, None, DATE_FMT, None, DATE_FMT, None, None, None])
dv = DataValidation(type="list", formula1='"Emitida,Confirmada,Aprobada,Pagada,Cancelada"', allow_blank=True)
ws.add_data_validation(dv)
dv.add("I2:I1000")

# ----------------------------------------------------------------------------
# 10. BLOQUEOS
# ----------------------------------------------------------------------------
ws = sheet("Bloqueos", ["bloqueo_id", "fecha_hora", "proyecto_id", "tipo", "descripcion", "foto_url",
                        "levantado_por", "detiene_avance", "estado", "respuesta", "fecha_respuesta",
                        "horas_respuesta", "genera_oc"],
           [13, 16, 13, 18, 42, 32, 22, 15, 13, 42, 16, 14, 12], "ED7D31")
blo = [
    ("BLQ-0001", d(4), "OB-001", "Material", "No llego la lechada color Delorean, el sub para manana", "https://drive.google.com/b1", "carlos", "SI", "Cerrado", "Comprada en Floor & Decor Sur, recogela hoy 4pm", d(4), 3, "NO"),
    ("BLQ-0002", d(1), "OB-003", "Condición oculta", "Linea de suministro de acero galvanizado corroida detras del muro", "https://drive.google.com/b2", "luis", "SI", "Abierto", "", None, None, "SI"),
    ("BLQ-0003", d(1), "OB-002", "Cliente", "Cliente pregunta si puede cambiar el backsplash ya seleccionado", "https://drive.google.com/b3", "carlos", "NO", "Abierto", "", None, None, "SI"),
]
for i, b in enumerate(blo, start=2):
    put(ws, i, list(b), [None, DATE_FMT, None, None, None, None, None, None, None, None, DATE_FMT, "0.0", None])
dv = DataValidation(type="list", formula1='"Material,Cliente,Sub,Condición oculta,Diseño,Otro"', allow_blank=True)
ws.add_data_validation(dv)
dv.add("D2:D1000")
dv = DataValidation(type="list", formula1='"Abierto,Cerrado"', allow_blank=True)
ws.add_data_validation(dv)
dv.add("I2:I1000")

# ----------------------------------------------------------------------------
# 11. ORDENES_CAMBIO (proceso 4)
# ----------------------------------------------------------------------------
ws = sheet("Ordenes_Cambio", ["oc_id", "proyecto_id", "fecha_hallazgo", "motivo", "descripcion",
                              "costo_estimado", "precio_cliente", "margen_pct", "dias_impacto",
                              "estado", "fecha_emision", "fecha_autorizacion", "fecha_cobro",
                              "condicion_pago", "foto_url", "bloqueo_id", "creada_por"],
           [12, 13, 15, 20, 44, 15, 15, 12, 13, 14, 14, 17, 14, 22, 30, 13, 22], "ED7D31")
ocs = [
    ("OC-0001", "OB-001", d(14), "Condición oculta", "Reemplazo de subpiso danado por humedad bajo el vanity", 620, 980, 0.3673, 2, "Facturada", d(13), d(12), d(10), "Al autorizar", "https://drive.google.com/oc1", "", "javier"),
    ("OC-0002", "OB-002", d(9), "Solicitud del cliente", "Agregar isla con toma de corriente y ampliar backsplash a muro completo", 2150, 3400, 0.3676, 4, "Autorizada", d(8), d(6), None, "50% al autorizar", "https://drive.google.com/oc2", "", "javier"),
    ("OC-0003", "OB-002", d(2), "Cambio de selección", "Cambio de cuarzo Calacatta a marmol Carrara, diferencia de material e instalacion", 1800, 2900, 0.3793, 5, "Propuesta", d(1), None, None, "100% al autorizar", "https://drive.google.com/oc3", "", "javier"),
]
for i, o in enumerate(ocs, start=2):
    put(ws, i, list(o), [None, None, DATE_FMT, None, None, MONEY, MONEY, PCT, "0", None, DATE_FMT, DATE_FMT, DATE_FMT, None, None, None, None])
dv = DataValidation(type="list", formula1='"Condición oculta,Solicitud del cliente,Cambio de selección"', allow_blank=True)
ws.add_data_validation(dv)
dv.add("D2:D1000")
dv = DataValidation(type="list", formula1='"Propuesta,Autorizada,Rechazada,Facturada"', allow_blank=True)
ws.add_data_validation(dv)
dv.add("J2:J1000")

# ----------------------------------------------------------------------------
# 12. NO_CALIDAD
# ----------------------------------------------------------------------------
ws = sheet("No_Calidad", ["nc_id", "fecha", "proyecto_id", "tipo", "causa", "sub_responsable",
                          "costo", "dias_perdidos", "descripcion", "estado", "fecha_cierre",
                          "registrado_por"],
           [11, 12, 13, 14, 26, 18, 13, 14, 44, 12, 14, 22], "ED7D31")
nc = [
    ("NC-0001", d(11), "OB-001", "Retrabajo", "Error de instalacion", "SUB-04", 340, 1, "Demolición daño el marco de la puerta contigua", "Cerrado", d(10), "javier"),
    ("NC-0002", d(5), "OB-002", "Retrabajo", "Error de especificacion", "", 780, 2, "Se pidio gabinete con medida de plano, no de sitio", "Cerrado", d(3), "javier"),
]
for i, n in enumerate(nc, start=2):
    put(ws, i, list(n), [None, DATE_FMT, None, None, None, None, MONEY, "0", None, None, DATE_FMT, None])
dv = DataValidation(type="list", formula1='"Retrabajo,Garantia"', allow_blank=True)
ws.add_data_validation(dv); dv.add("D2:D1000")
dv = DataValidation(type="list", formula1='"Error de instalacion,Error de especificacion,Error de estimacion,Material defectuoso,Falta de supervision"', allow_blank=True)
ws.add_data_validation(dv)
dv.add("E2:E1000")
dv = DataValidation(type="list", formula1='"Abierto,Cerrado"', allow_blank=True)
ws.add_data_validation(dv); dv.add("J2:J1000")

# ----------------------------------------------------------------------------
# 12b. TRABAJADORES  (cuadrilla propia de la empresa)
# ----------------------------------------------------------------------------
ws = sheet("Trabajadores", ["trabajador_id", "nombre", "puesto", "tipo_pago", "tarifa",
                            "telefono", "activo"],
           [15, 26, 20, 14, 12, 16, 10], "7F7F7F")
trab = [
    ("TRB-01", "Jose Luna", "Oficial de tile", "Por hora", 32, "512-555-0401", "SI"),
    ("TRB-02", "Miguel Soto", "Ayudante general", "Por hora", 20, "512-555-0402", "SI"),
    ("TRB-03", "Ruben Castro", "Oficial de plomeria", "Por hora", 35, "512-555-0403", "SI"),
    ("TRB-04", "Angel Perez", "Pintor / acabados", "Por dia", 220, "512-555-0404", "SI"),
]
for i, t in enumerate(trab, start=2):
    put(ws, i, list(t), [None, None, None, None, MONEY, None, None])
dv = DataValidation(type="list", formula1='"Por hora,Por dia"', allow_blank=True)
ws.add_data_validation(dv)
dv.add("D2:D200")
ws.cell(row=7, column=2, value="La tarifa NUNCA se envia a la app del PM.").font = SUB_FONT

# ----------------------------------------------------------------------------
# 12c. MANO_OBRA  (asistencia de cuadrilla propia por obra y partida)
# ----------------------------------------------------------------------------
ws = sheet("Mano_Obra", ["mo_id", "fecha", "proyecto_id", "trabajador_id", "partida",
                         "horas", "registrado_por", "timestamp", "estado", "area_id"],
           [13, 12, 13, 15, 40, 10, 22, 18, 12, 12], "C00000")
mo = [
    ("MO-0001", d(3), "OB-001", "TRB-01", "Tile de piso y muro", 8, "carlos", d(3)),
    ("MO-0002", d(3), "OB-001", "TRB-02", "Tile de piso y muro", 8, "carlos", d(3)),
    ("MO-0003", d(2), "OB-001", "TRB-01", "Tile de piso y muro", 8, "carlos", d(2)),
    ("MO-0004", d(1), "OB-001", "TRB-01", "Lechada y sellado", 6, "carlos", d(1)),
    ("MO-0005", d(1), "OB-003", "TRB-03", "Rough de plomería", 8, "luis", d(1)),
    ("MO-0006", d(1), "OB-003", "TRB-02", "Rough de plomería", 8, "luis", d(1)),
]
for i, m in enumerate(mo, start=2):
    put(ws, i, list(m) + ["Vigente", AR[m[2]]], [None, DATE_FMT, None, None, None, "0.0", None, DATE_FMT, None, None])

# ----------------------------------------------------------------------------
# 12d. PAGOS_SUB  (pagos contra orden de trabajo, nunca como gasto suelto)
# ----------------------------------------------------------------------------
ws = sheet("Pagos_Sub", ["pago_id", "fecha", "ot_id", "proyecto_id", "sub_id", "concepto",
                         "monto", "metodo", "referencia", "registrado_por", "timestamp", "estado"],
           [12, 12, 12, 13, 11, 16, 13, 18, 20, 22, 18, 12], "ED7D31")
pagos = [
    ("PAG-0001", d(8), "OT-0001", "OB-001", "SUB-03", "Anticipo", 1900, "Transferencia", "ACH 4471", "javier", d(8)),
    ("PAG-0002", d(1), "OT-0001", "OB-001", "SUB-03", "Liquidacion", 1900, "Transferencia", "ACH 4498", "javier", d(1)),
    ("PAG-0003", d(4), "OT-0003", "OB-003", "SUB-01", "Anticipo", 1450, "Cheque", "Ck 1042", "javier", d(4)),
]
for i, p_ in enumerate(pagos, start=2):
    put(ws, i, list(p_) + ["Vigente"], [None, DATE_FMT, None, None, None, None, MONEY, None, None, None, DATE_FMT, None])
dv = DataValidation(type="list", formula1='"Anticipo,Parcial,Liquidacion"', allow_blank=True)
ws.add_data_validation(dv)
dv.add("F2:F2000")

# ----------------------------------------------------------------------------
# 12d2. CHECKLIST_CALIDAD  (los 5 puntos de control, editables por el dueno)
# ----------------------------------------------------------------------------
ws = sheet("Checklist_Calidad", ["hito", "orden", "punto", "requiere_foto"],
           [30, 8, 66, 15], "7F7F7F")
CHK = [
 ("PC1 Post demolición", [
   ("Estructura visible sin daño por agua ni termita", "SI"),
   ("Material de la plomería existente identificado (galvanizado, PEX, cobre)", "SI"),
   ("Cableado sin aluminio; GFCI presente donde aplica", "NO"),
   ("Subpiso nivelado, sin pudrición ni capas previas de tile", "SI"),
   ("El extractor existente descarga al exterior, no al ático", "SI"),
   ("Muros medidos a nivel y plomo", "NO"),
   ("Sin evidencia de moho ni humedad previa", "SI"),
   ("Hallazgos levantados como aviso el mismo día", "NO")]),
 ("PC2 Pre-cierre de muros", [
   ("Prueba de presión de plomería sostenida", "SI"),
   ("Drenaje con pendiente y ventilación conectada", "SI"),
   ("Ubicaciones verificadas contra plano: regadera, desagües, salidas", "SI"),
   ("Blocking para barras, banco, nichos, toallero y vanity", "SI"),
   ("Circuitos dedicados y GFCI en su lugar", "NO"),
   ("Extractor con ducto aislado al exterior y damper", "SI"),
   ("Alturas de salidas verificadas contra el diseño de tile", "NO"),
   ("FOTO PANORÁMICA DE CADA MURO COMPLETO antes de cubrir", "SI")]),
 ("PC3 Impermeabilización", [
   ("Sistema aplicado según instrucciones del fabricante", "SI"),
   ("Refuerzo en esquinas, juntas y penetraciones", "SI"),
   ("Pre-pendiente y pendiente correctas hacia el desagüe", "SI"),
   ("Desagüe con brida y sello correctos", "SI"),
   ("PRUEBA DE INUNDACIÓN DE 24 HORAS documentada", "SI"),
   ("Sin perforaciones posteriores a la prueba", "NO")]),
 ("PC4 Pre-acabados", [
   ("Tile a nivel, a plomo y con juntas alineadas", "SI"),
   ("Sin piezas huecas (golpear con nudillo)", "NO"),
   ("Lechada uniforme, sin faltantes y curada", "SI"),
   ("Sellador en los cambios de plano, no lechada", "NO"),
   ("Gabinetes nivelados, a plomo y anclados a blocking", "SI"),
   ("Puertas y cajones con holgura pareja", "NO"),
   ("Superficie a nivel antes de tomar plantilla de countertop", "SI")]),
 ("PC5 Pre-entrega", [
   ("Plomería probada: llaves, desagües, sanitario, sin fugas bajo vanity", "SI"),
   ("Puerta de regadera alineada, sellada y sin roce", "NO"),
   ("Iluminación y extractor funcionando (extractor probado con papel)", "NO"),
   ("Tomacorrientes probados; GFCI disparado y reseteado", "SI"),
   ("Cajones y puertas ajustados", "NO"),
   ("Silicón parejo en todas las uniones", "SI"),
   ("Pintura sin marcas y tapas de registro colocadas", "NO"),
   ("Limpieza profunda hecha, incluye interior de gabinetes y vidrios", "SI"),
   ("Fotos finales para portafolio, misma toma que las del día 1", "SI")]),
]
# foto solo en lo critico: donde algo queda oculto despues o te protege en una disputa o garantia
FOTO_CRITICA = set(["Estructura visible sin daño por agua ni termita", "Material de la plomería existente identificado (galvanizado, PEX, cobre)", "Prueba de presión de plomería sostenida", "FOTO PANORÁMICA DE CADA MURO COMPLETO antes de cubrir", "Refuerzo en esquinas, juntas y penetraciones", "Desagüe con brida y sello correctos", "Gabinetes nivelados, a plomo y anclados a blocking", "Plomería probada: llaves, desagües, sanitario, sin fugas bajo vanity", "Fotos finales para portafolio, misma toma que las del día 1"])
CHK = [(h, [(p, "SI" if p in FOTO_CRITICA else "NO") for p, _ in pts]) for h, pts in CHK]
r = 2
for hito, puntos in CHK:
    for n_, (p_, foto) in enumerate(puntos, start=1):
        put(ws, r, [hito, n_, p_, foto]); r += 1
dv = DataValidation(type="list", formula1='"SI,NO"', allow_blank=True)
ws.add_data_validation(dv); dv.add("D2:D300")

# ----------------------------------------------------------------------------
# 12d3. CALIDAD  (inspeccion por hito: ningun trabajo se cubre sin esto)
# ----------------------------------------------------------------------------
ws = sheet("Calidad", ["calidad_id", "fecha", "proyecto_id", "hito", "partida", "resultado",
                       "puntos_ok", "puntos_total", "defectos", "fotos_url",
                       "inspeccionado_por", "timestamp", "area_id", "no_aplica"],
           [13, 12, 13, 28, 34, 16, 12, 13, 44, 38, 22, 18, 12], "C00000")
cal = [
    ("CAL-0001", d(16), "OB-001", "PC1 Post demolición", "Demolición y retiro de escombro",
     "Aprobado", 8, 8, "", "https://drive.google.com/c1", "carlos", d(16)),
    ("CAL-0002", d(12), "OB-001", "PC2 Pre-cierre de muros", "Blocking y framing",
     "Aprobado", 8, 8, "", "https://drive.google.com/c2", "carlos", d(12)),
    ("CAL-0003", d(10), "OB-001", "PC3 Impermeabilización", "Impermeabilización + prueba de inundación",
     "Aprobado", 6, 6, "", "https://drive.google.com/c3", "carlos", d(10)),
    ("CAL-0004", d(2), "OB-003", "PC1 Post demolición", "Demolición y retiro de escombro",
     "Con defectos", 6, 8, "Tubo galvanizado corroido; subpiso con humedad bajo el vanity",
     "https://drive.google.com/c4", "luis", d(2)),
]
for i, c_ in enumerate(cal, start=2):
    put(ws, i, list(c_) + [AR[c_[2]]], [None, DATE_FMT, None, None, None, None, "0", "0", None, None, None, DATE_FMT, None])
dv = DataValidation(type="list", formula1='"Aprobado,Con defectos"', allow_blank=True)
ws.add_data_validation(dv); dv.add("F2:F2000")

# ----------------------------------------------------------------------------
# 12d4. PRUEBAS_AGUA  (24 horas con foto al inicio y al final)
# ----------------------------------------------------------------------------
ws = sheet("Pruebas_Agua", ["prueba_id", "proyecto_id", "fecha_inicio", "foto_inicio",
                            "fecha_fin", "foto_fin", "horas", "resultado", "registrado_por", "area_id"],
           [13, 13, 18, 34, 18, 34, 10, 16, 22, 12], "C00000")
pag = [
    ("AGU-0001", "OB-001", d(11), "https://drive.google.com/a1", d(10),
     "https://drive.google.com/a2", 25.5, "Sin fugas", "carlos"),
]
for i, p_ in enumerate(pag, start=2):
    put(ws, i, list(p_) + [AR[p_[1]]], [None, None, DATE_FMT, None, DATE_FMT, None, "0.0", None, None, None])
dv = DataValidation(type="list", formula1='"En curso,Sin fugas,Con fuga"', allow_blank=True)
ws.add_data_validation(dv); dv.add("H2:H1000")
ws.cell(row=4, column=2, value="Es el registro mas valioso del sistema: te defiende de la").font = SUB_FONT
ws.cell(row=5, column=2, value="reclamacion de garantia mas cara que existe.").font = SUB_FONT

# ----------------------------------------------------------------------------
# 12d5. PUNCH_LIST  (lo que senala el cliente en el recorrido de entrega)
# ----------------------------------------------------------------------------
ws = sheet("Punch_List", ["punch_id", "proyecto_id", "fecha", "item", "origen", "responsable",
                          "fecha_compromiso", "estado", "fecha_cierre", "foto_url", "registrado_por"],
           [12, 13, 12, 48, 20, 18, 18, 12, 14, 32, 22], "ED7D31")
pl = [
    ("PUN-0001", "OB-001", d(2), "Silicon disparejo en la union del vanity con el muro",
     "Defecto", "SUB-03", d(-5), "Abierto", None, "", "carlos"),
    ("PUN-0002", "OB-001", d(2), "Falta tapa de registro en el techo del closet",
     "Defecto", "Cuadrilla", d(-5), "Abierto", None, "", "carlos"),
    ("PUN-0003", "OB-001", d(2), "Cliente quiere una barra de apoyo extra en la regadera",
     "Cambio de alcance", "", d(-5), "Cerrado", d(1), "", "carlos"),
]
for i, x in enumerate(pl, start=2):
    put(ws, i, list(x), [None, None, DATE_FMT, None, None, None, DATE_FMT, None, DATE_FMT, None, None])
dv = DataValidation(type="list", formula1='"Defecto,Cambio de alcance,Expectativa"', allow_blank=True)
ws.add_data_validation(dv); dv.add("E2:E2000")
dv = DataValidation(type="list", formula1='"Abierto,Cerrado"', allow_blank=True)
ws.add_data_validation(dv); dv.add("H2:H2000")

# ----------------------------------------------------------------------------
# 12d6. ENTREGA  (acta, garantia y cosecha comercial: una fila por obra)
# ----------------------------------------------------------------------------
ws = sheet("Entrega", ["entrega_id", "proyecto_id", "fecha_entrega", "garantia_meses",
                       "garantia_vence", "autoriza_fotos", "resena_pedida", "resena_recibida",
                       "referido_pedido", "visita_11m", "notas", "entregado_por", "timestamp"],
           [13, 13, 15, 15, 15, 16, 15, 17, 16, 14, 34, 22, 18], "ED7D31")
ws.cell(row=2, column=3, value="Se llena desde la app al registrar la entrega. No escribir a mano.").font = SUB_FONT
for col, lista in [("F", '"SI,NO"'), ("G", '"SI,NO"'), ("H", '"SI,NO"'), ("I", '"SI,NO"'), ("J", '"SI,NO"')]:
    dv = DataValidation(type="list", formula1=lista, allow_blank=True)
    ws.add_data_validation(dv); dv.add(col + "2:" + col + "1000")

# ----------------------------------------------------------------------------
# 12e. PRESUPUESTO  (lo que cotizaste por partida: la base de la mejora)
# ----------------------------------------------------------------------------
ws = sheet("Presupuesto", ["presupuesto_id", "proyecto_id", "etapa", "monto_presupuestado",
                           "notas", "cantidad", "unidad", "area_id", "nivel"],
           [16, 13, 40, 20, 26, 12, 14, 12, 10], "7F7F7F")
# costo esperado por etapa (no el precio al cliente)
pres = [
    ("PRE-0001", "OB-001", "Demolición", 1400, "", "", "pie2"),
    ("PRE-0002", "OB-001", "Plomería", 2600, "", "", "pie2"),
    ("PRE-0003", "OB-001", "Impermeabilización", 1100, "", "", "pie2"),
    ("PRE-0004", "OB-001", "Tile", 4800, "Incluye material", "", "pie2"),
    ("PRE-0005", "OB-002", "Gabinetes", 9800, "", "", "pie2"),
    ("PRE-0006", "OB-002", "Countertop", 5200, "", "", "pie2"),
    ("PRE-0007", "OB-003", "Plomería", 3100, "", "", "pie2"),
]
for i, p_ in enumerate(pres, start=2):
    put(ws, i, list(p_) + [AR[p_[1]], "Etapa"], [None, None, None, MONEY, None, "0.0", None, None, None])
dv = DataValidation(type="list", formula1='"pie2,pie lineal,pieza,lote,dia"', allow_blank=True)
ws.add_data_validation(dv); dv.add("G2:G3000")
ws.cell(row=11, column=3, value="Se captura una vez, en el traspaso de ventas a produccion.").font = SUB_FONT

# ----------------------------------------------------------------------------
# 12f. COBROS  (dinero del cliente: sin esto no hay cobrado vs ejecutado)
# ----------------------------------------------------------------------------
ws = sheet("Cobros", ["cobro_id", "fecha", "proyecto_id", "concepto", "monto", "metodo",
                      "referencia", "registrado_por", "timestamp", "estado"],
           [13, 12, 13, 18, 14, 18, 20, 22, 18, 12], "ED7D31")
cob = [
    ("COB-0001", d(18), "OB-001", "Deposito", 9800, "Transferencia", "ACH 8812", "javier", d(18)),
    ("COB-0002", d(6), "OB-001", "Hito", 8000, "Cheque", "Ck 3341", "javier", d(6)),
    ("COB-0003", d(10), "OB-001", "Orden de cambio", 980, "Transferencia", "ACH 8890", "javier", d(10)),
    ("COB-0004", d(32), "OB-002", "Deposito", 27200, "Transferencia", "ACH 9001", "javier", d(32)),
    ("COB-0005", d(7), "OB-003", "Deposito", 7900, "Zelle", "-", "javier", d(7)),
]
for i, c_ in enumerate(cob, start=2):
    put(ws, i, list(c_) + ["Vigente"], [None, DATE_FMT, None, None, MONEY, None, None, None, DATE_FMT, None])
dv = DataValidation(type="list", formula1='"Deposito,Hito,Orden de cambio,Liquidacion,Otro"', allow_blank=True)
ws.add_data_validation(dv)
dv.add("D2:D2000")

# ----------------------------------------------------------------------------
# 12g. OBRAS_CERRADAS  (foto congelada al cerrar: la base del historico)
# ----------------------------------------------------------------------------
ws = sheet("Obras_Cerradas", ["cierre_id", "proyecto_id", "cliente", "tipo_obra", "pm",
                              "fecha_inicio", "fecha_fin_real", "dias_ciclo",
                              "contrato_original", "monto_oc", "contrato_final",
                              "presupuestado", "materiales", "cuadrilla", "subcontratos",
                              "costo_total", "margen_bruto", "desviacion_estimacion",
                              "cobrado", "no_calidad", "dias_reportados", "cerrada_por", "timestamp",
                              "pies2"],
           [13, 13, 20, 12, 20, 13, 14, 12, 16, 14, 15, 15, 14, 14, 15, 14, 14, 16, 14, 13, 14, 20, 18, 10], "70AD47")
ws.cell(row=2, column=3, value="Se llena sola al cerrar una obra desde la app. No escribir a mano.").font = SUB_FONT

# ----------------------------------------------------------------------------
# 12h. CORRECCIONES  (nada se borra: todo cambio deja rastro)
# ----------------------------------------------------------------------------
ws = sheet("Correcciones", ["corr_id", "fecha", "usuario", "hoja", "registro_id", "accion",
                            "campo", "antes", "despues", "motivo"],
           [13, 18, 22, 16, 13, 12, 18, 24, 24, 44], "7F7F7F")
ws.cell(row=2, column=3, value="Se llena sola. Es el rastro de auditoria del sistema.").font = SUB_FONT



from openpyxl.formatting.rule import CellIsRule
ws = sheet("Partidas_Obra", ["area_id", "proyecto_id", "orden", "partida", "hito_calidad", "peso", "estado",
                             "dias", "quien", "paralelo", "espera", "etapa"],
           [12, 12, 8, 40, 26, 8, 10, 7, 14, 10, 8, 30], "7F7F7F")
ws = sheet("Errores", ["fecha", "app", "funcion", "usuario", "mensaje", "detalle"], [18, 8, 22, 12, 60, 60], "7F7F7F")
ws = sheet("Plan_Semanal", ["semana", "proyecto_id", "area_id", "partida", "fin_previsto"], [12, 12, 12, 40, 14], "7F7F7F")
WB.save("/home/claude/ijm/Gestion_Obra_IJM.xlsx")
print("ok")
