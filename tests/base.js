// Utilidades para los scripts de auditoría (audit_*.js). No modifica Codigo.gs.
const M = require('./mock');
let SHEETS = null;
function fresco(hoyStr, ts) {
  if (SHEETS) Object.keys(SHEETS).forEach(k => delete SHEETS[k]);
  global.__props = { CLAVE: 'prueba' };
  global.__mail = null;
  SHEETS = M.load(hoyStr || '2026-09-30', ts || new Date(2026, 8, 30, 10).getTime());
  const log = console.log; console.log = () => {}; try { configurarTodo(); } finally { console.log = log; }
  return SHEETS;
}
const P = (o) => JSON.parse(doPost({ parameter: Object.assign({ clave: 'prueba' }, o) }).s);
const D = (mes) => datosDashboard(mes || '', 'prueba');
// Reloj: cada llamada avanza 1 minuto para que "Registrado el" nunca empate con "Saldo a la fecha".
let T = null;
function reloj(y, m, d, h) { T = new Date(y, m, d, h || 12).getTime(); M.ahora(T); }
function tic() { T += 60000; M.ahora(T); }
const fallas = [], oks = [];
function ok(c, msg) { if (!c) fallas.push(msg); else oks.push(msg); return c; }
function raro(obj) { const s = JSON.stringify(obj); const m = s.match(/.{0,60}(NaN|Infinity|undefined|null,"s"|"Invalid Date").{0,40}/); return m ? m[0] : ''; }
function movs() { return SHEETS['Movimientos'].grid.slice(1); }
function fin(nombre) {
  console.log('\n== ' + nombre + ': ' + (fallas.length ? fallas.length + ' FALLAS' : 'sin fallas') + ' (' + oks.length + ' verificaciones OK)');
  fallas.forEach(f => console.log('  ✗ ' + f));
}
module.exports = { M, fresco, P, D, reloj, tic, ok, raro, movs, fin, fallas, oks, get sheets() { return SHEETS; } };
