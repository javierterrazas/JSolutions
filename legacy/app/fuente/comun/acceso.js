// comun/acceso.js — Sesiones firmadas y verificación de usuarios.
// Compartido por las dos apps. Edita aquí y corre construir.py: nunca edites App_Dueno.gs ni App_PM.gs.

// ------------------------------------------------------------ sesiones firmadas
/*
 * CacheService no guarda nada mas de 6 horas y la jornada de un PM dura 9: la sesion
 * vencia justo en el cierre de dia. Ahora el pase lleva su propio vencimiento, firmado
 * con un secreto del proyecto, y no se guarda en ningun lado. En cada llamada se revisa
 * ademas que el usuario siga activo: darlo de baja le corta el acceso en ese momento.
 */
const HORAS_SESION = { pm_: 16, du_: 12 };

function secretoSesion_() {
  const pr = PropertiesService.getScriptProperties();
  let s = pr.getProperty('SECRETO_SESION');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); pr.setProperty('SECRETO_SESION', s); }
  return s;
}

function firmar_(texto) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(texto, secretoSesion_()));
}

function crearPase_(prefijo, usuario) {
  const cuerpo = Utilities.base64EncodeWebSafe(prefijo + '|' + usuario + '|' + (Date.now() + HORAS_SESION[prefijo] * 3600000));
  return cuerpo + '.' + firmar_(cuerpo);
}

function leerPase_(prefijo, token) {
  const t = String(token || ''), i = t.lastIndexOf('.');
  if (i < 1) return null;
  const cuerpo = t.slice(0, i);
  if (firmar_(cuerpo) !== t.slice(i + 1)) return null;
  let partes;
  try { partes = Utilities.newBlob(Utilities.base64DecodeWebSafe(cuerpo)).getDataAsString().split('|'); }
  catch (e) { return null; }
  if (partes.length < 3 || partes[0] !== prefijo || Number(partes[partes.length - 1]) < Date.now()) return null;
  return partes.slice(1, -1).join('|');
}

function auth_(token) {
  // pase firmado; o una sesion de antes del cambio, que sigue valida hasta vencer
  const usuario = leerPase_(PREFIJO_SESION_, token) || CacheService.getScriptCache().get(PREFIJO_SESION_ + token);
  if (!usuario || !usuarioActivo_(usuario)) throw new Error('Sesion expirada. Vuelve a entrar.');
  return usuario;
}
