const fs=require('fs');
global.localStorage={getItem:()=>'en',setItem(){}}; global.navigator={language:'en'};
global.document={body:{},documentElement:{},querySelectorAll:()=>[],createTreeWalker(){return{nextNode(){return null;}};}};
global.window={confirm(){},prompt(){}}; global.MutationObserver=function(){ this.observe=function(){}; };
eval(fs.readFileSync('/home/claude/ijm/idioma_bloque.js','utf8'));
// 1) todos los mensajes fijos del codigo: toast, confirm, prompt, errores y avisos del servidor
const fijos=new Set();
for (const f of ['PM.html','Dueno.html']) { const js=fs.readFileSync('/home/claude/ijm/'+f,'utf8');
  for (const fn of ['toast','confirm','prompt']) for (const m of js.matchAll(new RegExp(fn+"\\(\\s*'((?:[^'\\\\]|\\\\.)*)'\\s*[,)]",'g'))) fijos.add(m[1]); }
for (const f of ['App_PM.gs','App_Dueno.gs']) { const s=fs.readFileSync('/home/claude/ijm/'+f,'utf8');
  for (const m of s.matchAll(/new Error\('((?:[^'\\]|\\.)*)'\)/g)) fijos.add(m[1]);
  for (const m of s.matchAll(/(?:msg|t):\s*'((?:[^'\\]|\\.)*)'\s*[},]/g)) fijos.add(m[1]); }
// 2) mensajes armados con datos: ejemplos reales de cada uno
const armados=[
 'Usuario o PIN incorrectos. Te quedan 2 intentos.','Usuario o PIN incorrectos. Te queda 1 intento.',
 'Antes de cerrar "Tile de piso y muro" de Baño principal hay que aprobar la inspeccion PC3 Impermeabilización. Hazla desde Obra > Calidad y luego cierra el dia, o registra el dia sin marcarla como terminada.',
 'La orden OT-0003 no es de esta obra.','No se encontro OT-0009.','No se encontro GAS-0010 en Gastos.','No se encontro el gasto GAS-0003','No se encontro la orden OT-0004',
 'Ese registro tiene mas de 48 horas. Pidele al administrador que lo corrija.','Este cargo supera el limite de $300. Avisale al administrador.',
 'Llevan 5.2 horas. La prueba es de 24. Cerrarla antes no prueba nada; dejala correr y vuelve.',
 'La impermeabilizacion no se aprueba sin la prueba de inundacion terminada y sin fugas. Inicia la prueba desde la pantalla de calidad.',
 'Esta OC sale con 18.5% de margen, abajo de tu minimo de 30%. Precio sugerido: $3,215. Quieres emitirla de todos modos?',
 'Este sub todavia no confirma por escrito la orden OT-0004. Un anticipo antes de la confirmacion es dinero sin compromiso. Pagar de todos modos?',
 'El PM todavia no aprueba el trabajo de la orden OT-0003. La regla es que el sub cobra contra trabajo aprobado. Pagar de todos modos?',
 'Sobre Hill Country Electric: su seguro vencio el 08/01/2026; Eléctrico requiere licencia estatal en Texas y no tiene una registrada. Pagarle asi te deja expuesto. Continuar?',
 'Con este pago llevarias $4,200 contra una orden de $3,800. Si es trabajo extra, va en una orden de cambio, no aqui. Continuar?',
 "Ya existe un subcontratista con ese nombre (SUB-07). Editalo en vez de darlo de alta dos veces, o su historial se parte en dos.",
 'Esa partida ya existe en Baño.','Ya existe un tipo de obra llamado Medio baño.',
 'Esa partida ya tiene avance o mano de obra registrada. Renombrala en vez de borrarla, para no romper el historico de costos.',
 'Día cerrado · 24 h de cuadrilla','Deshecho · 3 registros anulados','Aviso enviado · BLQ-0005','Medida guardada · obra 56 pies²',
 'Obra OB-005 creada con 2 espacio(s) + Generales','Hay 2 pendiente(s) de dinero en esta obra. Si la cierras así, ese dinero queda sin cobrar. ¿Cerrar de todos modos?',
 'Obra cerrada · margen 36.7% · 25 días','Entrega registrada · garantía vence 09/23/2027','Respondido en 3.5 h','OC autorizada','OC OC-0004 emitida con 36.7% de margen',
 'Registrado NC-0003','Pago registrado · saldo $1,900','Orden OT-0005 emitida','¿Dar de baja a Magaña Tile? Se conserva su historial y deja de aparecer al emitir órdenes nuevas. Tiene 1 orden(es) abierta(s): esas siguen vigentes.',
 '¿Borrar "Piso" del catálogo de Cocina?','Tipo creado con 15 partidas','Guardado. Ojo: su seguro vencio el 01/01/2020; Eléctrico requiere licencia estatal en Texas y no tiene una registrada',
 'Máximo 10 fotos por cierre. Se quedaron las primeras 10.','2 fotos son de otro día (Sep 21). El cierre es de hoy. ¿Enviar de todos modos?',
 'Registrada con 2 defecto(s)','Prueba cerrada · 25 h sin fugas','Fuga registrada · avisado al administrador','3 campo(s) corregido(s)',
 'Puntos de control sin aprobar: Generales de obra PC5, Baño principal PC4','No hay prueba de inundacion documentada en Baño de visitas',
 'Faltan $11,900 por cobrarle al cliente','Tu sesión expiró. Entra de nuevo para enviar 2 registros pendientes.','Gasto nuevo · Familia Ruiz · Cargo sin recibo'];
const ES=/[áéíóúñ¿¡]|\b(de|la|el|los|las|del|que|para|con|sin|por|una|hay|obra|partida|días?|avance|gasto|aviso|cerrar|registrar|faltan?|está|esta|orden|todos|modos|seguro|pago)\b/i;
let malos=[];
for (const m of [...fijos, ...armados]) { const t=tr(m); const limpio=t.replace(/Familia Ruiz|Magaña Tile|Hill Country Electric|Medio baño|Sep 21/g,'');
  if (ES.test(limpio)) malos.push([m.slice(0,90), t.slice(0,90)]); }
console.log('mensajes revisados:', fijos.size + armados.length, '(', fijos.size, 'fijos +', armados.length, 'con datos )');
console.log('sin traducir:', malos.length); malos.forEach(([a,b])=>console.log('  · '+a+'\n      → '+b));
