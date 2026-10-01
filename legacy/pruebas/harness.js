const fs = require('fs');
const libro = JSON.parse(fs.readFileSync('/tmp/libro.json','utf8'));
const rev = v => (v && typeof v === 'object' && v.__d) ? new Date(v.__d) : (v === null ? '' : v);
const SHEETS = {};
Object.keys(libro).forEach(n => { SHEETS[n] = libro[n].map(r => r.map(rev)); });
function hoja(n){ const data = SHEETS[n]; return {
  getDataRange(){ return { getValues(){ return data.map(r=>r.slice()); } }; },
  getLastRow(){ let k=data.length; while(k>1 && (data[k-1]||[]).every(c=>c===''||c===null||c===undefined)) k--; return k; },   // como Google: cualquier celda con contenido
  getRange(r,c,nr,nc){ return {
    getValue(){ return (data[r-1]||[])[c-1]; },
    setValue(v){ while(data.length<r) data.push([]); data[r-1][c-1]=v; },
    setValues(vals){ vals.forEach((row,i)=>{ while(data.length<r+i) data.push([]); row.forEach((v,j)=>{ data[r-1+i][c-1+j]=v; }); }); },
    getValues(){ const o=[]; for(let i=0;i<(nr||1);i++){ o.push((data[r-1+i]||[]).slice(c-1,c-1+(nc||1))); } return o; } }; },
  appendRow(v){ data.push(v); }, deleteRow(r){ data.splice(r-1,1); } }; }
global.SpreadsheetApp = { openById(){ return { getSheetByName: hoja }; }, flush(){} };
const cache = {};
global.CacheService = { getScriptCache(){ return { get:k=>cache[k]||null, put:(k,v)=>{cache[k]=v;}, remove:k=>{delete cache[k];} }; } };
global.Session = { getScriptTimeZone(){ return 'America/Chicago'; } };
const _cr = require('crypto');
const _firmado = buf => Array.from(buf).map(b => b > 127 ? b - 256 : b);      // Apps Script devuelve bytes con signo
global.PropertiesService = (function(){ const p = {}; return { getScriptProperties(){ return {
  getProperty: k => (k in p ? p[k] : null), setProperty(k, v){ p[k] = String(v); return this; } }; } }; })();
global.Utilities = { computeHmacSha256Signature(v, k){ return _firmado(_cr.createHmac('sha256', String(k)).update(String(v)).digest()); },
  base64EncodeWebSafe(x){ const b = typeof x === 'string' ? Buffer.from(x, 'utf8') : Buffer.from(x.map(n => n & 255));
    return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_'); },
  base64DecodeWebSafe(s){ return _firmado(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')); },
  newBlob(bytes){ return { getDataAsString(){ return Buffer.from((bytes || []).map(n => n & 255)).toString('utf8'); } }; },
  formatDate(d,tz,f){ const p=n=>String(n).padStart(2,'0');
    // como el de Apps Script: sustituye yyyy, MM, dd, HH, mm, ss en cualquier patrón
    return f.replace(/yyyy|MM|dd|HH|mm|ss/g, t=>({yyyy:d.getFullYear(), MM:p(d.getMonth()+1), dd:p(d.getDate()),
      HH:p(d.getHours()), mm:p(d.getMinutes()), ss:p(d.getSeconds())}[t])); }, getUuid(){ return require('crypto').randomUUID(); /* único en cada llamada, como el real */ }, base64Decode(){} };
global.LockService = { getScriptLock(){ return { tryLock(){return true;}, releaseLock(){} }; } };
global.MailApp = { sendEmail(){} }; global.Logger = { log(){} };
global.HtmlService = {}; global.DriveApp = {};
module.exports = { SHEETS, cache };
