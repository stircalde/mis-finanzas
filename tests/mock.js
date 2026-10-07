// Mock mínimo de Apps Script para correr Codigo.gs en Node.
process.env.TZ='America/Bogota';
const fs=require('fs');
function Sheet(name){this.name=name;this.grid=[];}
Sheet.prototype.getRange=function(a,b,c,d){
  if(typeof a==='string'){const m=a.match(/^([A-Z])(\d+)(?::([A-Z])(\d+))?$/);const col=x=>x.charCodeAt(0)-64;a=+m[2];b=col(m[1]);c=m[3]?(+m[4]-a+1):1;d=m[3]?(col(m[3])-b+1):1;}
  const sh=this,r0=a,c0=b,nr=c||1,nc=d||1;
  const rng={
    setValues(v){v.forEach((row,i)=>row.forEach((x,j)=>{(sh.grid[r0-1+i]=sh.grid[r0-1+i]||[])[c0-1+j]=x;}));return rng;},
    setValue(x){(sh.grid[r0-1]=sh.grid[r0-1]||[])[c0-1]=x;return rng;},
    setFormula(x){return rng.setValue(x);},
    getValues(){const out=[];for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++){const v=(sh.grid[r0-1+i]||[])[c0-1+j];row.push(v===undefined?'':v);}out.push(row);}return out;},
    getCell(i,j){return sh.getRange(r0+i-1,c0+j-1);},
  };
  const px=new Proxy(rng,{get:(t,k)=>k in t?t[k]:()=>px});
  ['setValues','setValue','setFormula'].forEach(k=>{const f=rng[k];rng[k]=function(...a){f.apply(rng,a);return px;};});
  return px;
};
Sheet.prototype.getDataRange=function(){const nr=this.grid.length;let nc=0;this.grid.forEach(r=>{if(r)nc=Math.max(nc,r.length)});return this.getRange(1,1,nr,nc);};
Sheet.prototype.getLastRow=function(){return this.grid.length;};
Sheet.prototype.getLastColumn=function(){let nc=0;this.grid.forEach(r=>{if(r)nc=Math.max(nc,r.length)});return nc;};
Sheet.prototype.getMaxRows=function(){return Math.max(1000,this.grid.length);};
Sheet.prototype.insertRowBefore=function(r){this.grid.splice(r-1,0,[]);return this;};
Sheet.prototype.appendRow=function(r){this.grid.push(r.slice());};
Sheet.prototype.deleteRow=function(r){this.grid.splice(r-1,1);return this;};
['setTabColor','setRowHeight','setColumnWidth','setFrozenRows','setFrozenColumns','setConditionalFormatRules','setName','setHiddenGridlines'].forEach(k=>Sheet.prototype[k]=function(){return this;});
const sheets={};
global.SpreadsheetApp={getActiveSpreadsheet:()=>({getSpreadsheetTimeZone:()=>'America/Bogota',getSheetByName:n=>sheets[n]||null,insertSheet:(n)=>(sheets[n]=new Sheet(n)),setActiveSheet(){}}),
  newDataValidation:()=>new Proxy({},{get:(t,k)=>k==='build'?()=>({}):function(){return this;}}),
  newConditionalFormatRule:()=>new Proxy({},{get:(t,k)=>k==='build'?()=>({}):function(){return this;}}),getUi:()=>({alert:console.log})};
global.Utilities={formatDate:(d)=>{const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());},getUuid:()=>{global.__uuid=(global.__uuid||0)+1;return ('0000000'+global.__uuid.toString(16)).slice(-8)+'-sim';}};
global.Session={getScriptTimeZone:()=>'America/Bogota',getActiveUser:()=>({getEmail:()=>''}),getEffectiveUser:()=>({getEmail:()=>'yo@x.com'})};
global.LockService={getScriptLock:()=>({waitLock(){},tryLock(){return true},releaseLock(){}})};
global.ContentService={createTextOutput:(s)=>({setMimeType(){return {s}}}),MimeType:{JSON:1}};
global.PropertiesService={getScriptProperties:()=>({getProperty:k=>(global.__props||{})[k]||null,setProperty:(k,v)=>{(global.__props=global.__props||{})[k]=String(v);}})};
global.MailApp={sendEmail:(o)=>{global.__mail=o;}};
global.ScriptApp={getService:()=>({getUrl:()=>'https://script.google.com/x/exec'}),getProjectTriggers:()=>[],newTrigger:()=>new Proxy({},{get:()=>function(){return this;}})};
let src=fs.readFileSync(process.env.CODIGO||(__dirname+'/../backend/Codigo.gs'),'utf8').replace(/^const /gm,'var ').replace(/^let /gm,'var ');
const RealDate=Date; let NOW=RealDate.now();
class FakeDate extends RealDate{constructor(...a){if(a.length===0)super(NOW);else super(...a);} static now(){return NOW;}}
global.Date=FakeDate;
module.exports={ahora(ts){NOW=ts;},usar(p){src=fs.readFileSync(p,'utf8').replace(/^const /gm,'var ').replace(/^let /gm,'var ');},load(hoyStr,nowTs){const [y,m,d]=hoyStr.split('-').map(Number);NOW=nowTs||new RealDate(y,m-1,d,12).getTime();(0,eval)(src);return sheets;}};
