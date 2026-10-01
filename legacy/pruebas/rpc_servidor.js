// Servidor de Apps Script simulado, atendiendo llamadas del navegador por stdin/stdout
const fs=require('fs'), vm=require('vm'), readline=require('readline');
require('/tmp/harness.js');
function servidor(archivo){
  const cache={};
  const pr={};
  const ctx={ PropertiesService:{getScriptProperties(){return {getProperty:k=>(k in pr?pr[k]:null),setProperty(k,v){pr[k]=String(v);}};}}, SpreadsheetApp, Session, Utilities, LockService, MailApp, Logger, HtmlService:{}, DriveApp:{},
    CacheService:{ getScriptCache(){ return { get:k=>cache[k]||null, put:(k,v)=>{cache[k]=v;}, remove:k=>{delete cache[k];} }; } },
    console:{log(){},error(){}}, JSON, Math, Date, String, Number, Array, Object, RegExp, parseInt, isNaN, Error };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('/home/claude/ijm/'+archivo,'utf8')+'\nfunction __nueva(){for(const k in _memo) delete _memo[k];}', ctx);
  ctx.guardarFotos_=(f)=> (f && f.length) ? f.map(()=>'https://x').join(' | ') : '';   // como la real: sin fotos, sin enlace
  return ctx;
}
const S={ pm:servidor('App_PM.gs'), du:servidor('App_Dueno.gs') };
const rl=readline.createInterface({input:process.stdin});
rl.on('line', l=>{
  const q=JSON.parse(l); const srv=S[q.app];
  try{ srv.__nueva(); const v=srv[q.fn](...q.args);
    process.stdout.write(JSON.stringify({ok:true, v:(v===undefined?null:v)})+'\n'); }
  catch(e){ process.stdout.write(JSON.stringify({ok:false, e:String(e && e.message || e)})+'\n'); }
});
