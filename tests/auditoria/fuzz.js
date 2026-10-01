// Auditoría 6: fuzzer con semilla. Cientos de operaciones válidas mezcladas durante ~5 meses; después de cada paso se verifican invariantes.
// Uso: node audit_fuzz.js [semilla] [pasos]
const A = require('../base'); const { P, D, raro } = A;
const SEM = Number(process.argv[2] || 7), PASOS = Number(process.argv[3] || 400);
let s = SEM >>> 0; const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)], entre = (a, b) => Math.round(a + rnd() * (b - a)), redondo = (a, b) => Math.round(entre(a, b) / 100) * 100;
A.fresco(); let ts = new Date(2026, 8, 30, 11).getTime(); A.M.ahora(ts);
const hallazgos = {}; const nota = (k, msg) => { (hallazgos[k] = hallazgos[k] || { n: 0, primero: msg }).n++; };
const DESC = ['Tienda D1', 'Tiendas Ara', 'Terpel', 'Rappi', 'Cinemark', 'Koaj', 'Éxito', 'Almuerzo', 'Farmacia', 'Steam', 'Pan', 'Uber'];
const PERS = ['Juan', 'Laura', 'mamá', 'Carlos', 'Ana', 'Pedro'];
const esTarjeta_ = c => c.tipo === 'Deuda' && c.modo === 'Corte mensual' && !c.pideValor;
function filas() { return A.sheets['Movimientos'].grid.slice(1); }
function deltas(nuevas, cfg) {
  const byN = {}; cfg.cuentas.forEach(c => byN[c.nombre] = c); const d = {};
  const add = (n, v) => { if (!byN[n]) return; d[n] = (d[n] || 0) + v; };
  nuevas.forEach(r => {
    const [, tipo, , monto, , cuenta, destino, , cuotas, vc, costo, , id] = r; if (String(id).indexOf('hist:') === 0) return;
    const deuda = n => byN[n] && byN[n].tipo === 'Deuda', sg = n => deuda(n) ? -1 : 1;
    if (tipo === 'Gasto') {
      if (deuda(cuenta)) { const c = byN[cuenta]; const ce = Number(costo) || (Number(cuotas) > 0 && Number(vc) > 0 ? Math.max(0, Math.round(vc * cuotas - monto)) : 0); add(cuenta, monto + (esTarjeta_(c) ? 0 : ce)); }
      else add(cuenta, -monto);
    } else if (tipo === 'Ingreso' || tipo === 'Me pagaron' || tipo === 'Me prestaron') add(cuenta, sg(cuenta) * monto);
    else if (tipo === 'Le pagué') add(cuenta, -sg(cuenta) * monto);
    else if (tipo === 'Transferencia') { add(cuenta, -sg(cuenta) * monto); if (destino) add(destino, sg(destino) * monto); }
    else if (tipo === 'Ajuste') add(cuenta, monto);
  });
  return d;
}
function mesRecalc(k, cfg) {
  const byN = {}; cfg.cuentas.forEach(c => byN[c.nombre] = c);
  let g = 0, ing = 0;
  filas().forEach(r => {
    const [f, tipo, , monto, cat, cuenta, , para, cuotasR, vcR, costoR, , id] = r; if (!(f instanceof Date)) return;
    const costo = Number(costoR) || (tipo === 'Gasto' && parseInt(cuotasR, 10) > 0 && Number(vcR) > 0 ? Math.max(0, Math.round(vcR * parseInt(cuotasR, 10) - monto)) : 0);
    const key = f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0'); if (key !== k) return;
    if (String(id).indexOf('hist:') === 0 && f < new Date(2026, 8, 1)) return;
    if (tipo === 'Gasto') {
      let mio = monto; if (para) { if (String(para).indexOf(':') < 0) mio = 0; else { const suma = String(para).split(';').map(x => Number(String(x.split(':')[1] || '').trim()) || 0).reduce((a, b) => a + b, 0); mio = Math.max(0, monto - suma); } }
      g += mio; const c = byN[cuenta]; const ce = Number(costo) || 0; if (ce > 0 && !(c && esTarjeta_(c))) g += ce;
    } else if (tipo === 'Ajuste' && cat === 'Sin identificar' && monto < 0) g += -monto;
    else if (tipo === 'Ajuste' && cat === 'Intereses y cargos' && monto > 0) g += monto;
    else if (tipo === 'Ingreso') ing += monto;
  });
  return { g, ing };
}
function saldosDe(d) { const o = {}; d.cuentasCfg.forEach(c => o[c.nombre] = c.saldo); return o; }
const valida = x => /^\d{4}-\d{2}-\d{2}$/.test(x) && !isNaN(new Date(x));
function invariantes(d, et) {
  const x = raro(d); if (x) nota('nan', et + ': ' + x);
  const cfgCtas = d.cuentasCfg; const sumP = d.cuentas.reduce((a, c) => a + c.saldo, 0);
  if (Math.abs(sumP - d.totalPlata) > 1) nota('totalPlata', et + ': suma cuentas ' + sumP + ' vs totalPlata ' + d.totalPlata);
  const sumD = cfgCtas.filter(c => c.tipo === 'Deuda').reduce((a, c) => a + c.saldo, 0);
  if (Math.abs(sumD - d.totalDeudas) > 2) nota('totalDeudas', et + ': suma deudas ' + sumD + ' vs totalDeudas ' + d.totalDeudas);
  if (Math.abs(d.patrimonio - (d.totalPlata + d.totalMeDeben - d.totalDeudas - d.totalLesDebo)) > 3) nota('patrimonio', et + ': patrimonio no cuadra');
  d.creditos.forEach(c => {
    if (c.saldo < -1) nota('deudaNegativa:' + c.nombre, et + ': ' + c.nombre + ' saldo ' + c.saldo);
    c.calendario.forEach(g => { if (!valida(g.fecha) || !(g.monto > 0)) nota('calendario', et + ': ' + c.nombre + ' ' + JSON.stringify(g).slice(0, 80)); });
    (c.planes || []).forEach(p => {
      if (!(p.capitalPendiente >= 0 && p.capitalPendiente <= p.monto + 2)) nota('capital', et + ': ' + c.nombre + ' ' + p.desc + ' cap ' + p.capitalPendiente + '/' + p.monto);
      if (p.detalle.length !== p.cuotas) nota('detalle', et + ': ' + c.nombre + ' ' + p.desc + ' ' + p.detalle.length + '/' + p.cuotas);
      if (p.pagadas > p.cuotas) nota('pagadas', et + ': ' + p.desc);
      p.detalle.forEach(q => { if (q.fecha && !valida(q.fecha)) nota('fechaCuota', et + ': ' + p.desc + ' ' + q.fecha); });
    });
    // lo que el calendario dice que falta vs la deuda: en créditos sin intereses a futuro deberían cuadrar
    const cal = c.calendario.reduce((a, g) => a + g.monto, 0) + (c.sinFecha || 0);
    if (!c.persona && c.saldo > 0 && cal + 5 < c.saldo * 0.9) nota('calMenorQueDeuda:' + c.nombre, et + ': ' + c.nombre + ' saldo ' + c.saldo + ' pero calendario+sinFecha ' + cal);
  });
  d.meDeben.forEach(p => { const s = p.conceptos.reduce((a, c) => a + c.pendiente, 0); if (Math.abs(s - p.saldo) > 3) nota('meDeben', et + ': ' + p.persona + ' conceptos ' + s + ' vs saldo ' + p.saldo); });
  d.proximos.forEach(p => { if (!valida(p.fecha)) nota('proximos', et + ': ' + JSON.stringify(p).slice(0, 80)); });
  const ids = {}; filas().forEach(r => { const id = String(r[12]); if (/^fijo:/.test(id)) { if (ids[id]) nota('fijoDuplicado', et + ': ' + id); ids[id] = 1; } });
}
// Foto de los números clave: tests/correr.js la compara con tests/instantanea.json para detectar cualquier cambio de cálculo.
const fotos = [];
const sin = (o, ks) => o && ks.reduce((r, k) => (r[k] = o[k], r), {});
function foto(d) {
  return {
    hoy: d.hoy, patrimonio: d.patrimonio, totalPlata: d.totalPlata, totalDeudas: d.totalDeudas, totalMeDeben: d.totalMeDeben,
    totalLesDebo: d.totalLesDebo, ingresos: d.ingresos, gastos: d.gastos, disponible: d.disponible,
    cuentas: d.cuentas.map(c => [c.nombre, c.saldo]),
    creditos: d.creditos.map(c => ({ n: c.nombre, saldo: c.saldo, proximo: c.proximo && sin(c.proximo, ['fecha', 'monto']), sinFecha: c.sinFecha,
      intereses: c.intereses, interesesEst: c.interesesEst, calendario: c.calendario.map(g => [g.fecha, g.monto]),
      planes: (c.planes || []).map(q => [q.desc, q.monto, q.cuotas, q.pagadas, q.capitalPendiente]) })),
    meDeben: d.meDeben.map(m => [m.persona, m.saldo, m.neto]),
    presupuestos: d.presupuestos.map(q => [q.grupo, q.tope, q.gastado]),
    proximos: d.proximos.map(q => [q.tipo, q.nombre, q.monto, q.fecha, q.estado || ''])
  };
}
let d = D(); invariantes(d, 'inicio'); fotos.push(foto(d));
const rechazos = {}; let hechos = 0;
for (let i = 0; i < PASOS; i++) {
  ts += entre(20, 60 * 14) * 60000; A.M.ahora(ts); const hoyS = new Date(ts).toISOString().slice(0, 10);
  const cfgT = P({ accion: 'config' }).config;   // lo que ve el celular
  const antesS = saldosDe(D()); const n0 = filas().length;
  const plata = cfgT.plata.map(c => c.n), deudas = cfgT.deudas.filter(c => !c.mama), per = cfgT.personas;
  const t = rnd(); let op;
  if (t < 0.25) op = { accion: 'gasto', descripcion: pick(DESC), monto: String(redondo(2000, 250000)), cuenta: pick(plata) };
  else if (t < 0.42) { const c = pick(deudas); op = { accion: 'gasto', descripcion: pick(DESC) + ' ' + i, monto: String(redondo(20000, 600000)), cuenta: c.n, cuotas: String(c.cuotas ? pick([1, 1, 2, 3, 6, 12]) : '') };
    if (c.valor && rnd() < 0.7) { const n = Number(op.cuotas) || 1; op.valorCuota = String(Math.round(Number(op.monto) * (1 + rnd() * 0.15) / n)); } }
  else if (t < 0.47) op = { accion: 'gasto', descripcion: 'Compartido ' + i, monto: String(redondo(20000, 200000)), cuenta: pick(plata.concat(deudas.map(x => x.n))), cuotas: String(pick([1, 2, 3])),
    para: rnd() < 0.5 ? pick(PERS) : pick(PERS) + ':' + redondo(1000, 10000) + (rnd() < 0.4 ? '; ' + pick(PERS) + ':' + redondo(1000, 9000) : '') };
  else if (t < 0.55) op = { accion: 'ingreso', tipoIngreso: pick(['Salario', 'Honorarios', 'Otros']), descripcion: 'Ingreso ' + i, monto: String(redondo(50000, 2500000)), cuenta: pick(plata) };
  else if (t < 0.62) { const a = pick(plata); let b = pick(plata); if (a === b) b = pick(deudas).n; op = { accion: 'transferencia', desde: a, hacia: b, monto: String(redondo(5000, 200000)) }; }
  else if (t < 0.74) { const c = pick(deudas.filter(x => x.s > 0).concat(deudas)); const org = rnd() < 0.85 ? 'cuenta' : pick(['regalo', 'prestamo']);
    const m = c.pm > 0 && rnd() < 0.7 ? c.pm : Math.min(c.s || 50000, redondo(10000, 300000));
    op = { accion: 'pagocredito', credito: c.n, monto: String(m || 10000), origen: org, cuenta: pick(plata) }; }
  else if (t < 0.78 && cfgT.fijos.length) { const f = pick(cfgT.fijos); op = { accion: 'fijo', fijo: f.n, periodo: f.p, monto: String(f.v), cuenta: rnd() < 0.8 ? f.c : pick(plata), mama: rnd() < 0.1 ? 'regalo' : '' }; }
  else if (t < 0.86 && per.some(p => p.debe > 0)) { const p = pick(per.filter(p => p.debe > 0)); const c = p.c.length && rnd() < 0.6 ? pick(p.c) : null;
    op = { accion: 'mepagaron', persona: p.n, monto: String(c ? (c.q || c.p) : Math.min(p.debe + (rnd() < 0.2 ? 5000 : 0), redondo(1000, p.debe))), cuenta: pick(plata), aplica: c ? c.k : '', exceso: pick(['favor', 'ingreso']) }; }
  else if (t < 0.9) op = { accion: 'meprestaron', persona: pick(PERS), monto: String(redondo(10000, 200000)), cuenta: pick(plata) };
  else if (t < 0.93 && per.some(p => p.ledebo > 0)) { const p = pick(per.filter(p => p.ledebo > 0)); op = { accion: 'lepague', persona: p.n, monto: String(Math.min(p.ledebo, redondo(5000, 200000))), cuenta: pick(plata) }; }
  else if (t < 0.96) { const cc = pick(cfgT.plata); op = { accion: 'ajuste', cuenta: cc.n, saldoReal: String(Math.max(0, cc.s + redondo(-20000, 20000))) }; }
  else if (t < 0.98) op = { accion: 'monedas', monto: String(redondo(100, 2000)), cuenta: 'Efectivo' };
  else { const k = pick(D().meses); const dm = D(k); const x = raro(dm); if (x) nota('nanMes', k + ': ' + x); continue; }
  if (!op) continue;
  if (rnd() < 0.15 && op.accion !== 'ajuste') { const back = new Date(ts - entre(1, 40) * 86400000); op.fecha = back.toISOString().slice(0, 10); }
  if (rnd() < 0.03) { // administración: archivar/reactivar una cuenta de plata en 0, o editar/quitar/reactivar un fijo
    const z = cfgT.plata.find(c => c.s === 0 && !c.para); if (z && rnd() < 0.5) { P({ accion: 'cuentaadmin', op: 'archivar', nombre: z.n }); P({ accion: 'cuentaadmin', op: 'reactivar', nombre: z.n }); }
    else { const f = pick(D().fijosCfg); P({ accion: 'fijoadmin', op: pick(['quitar', 'reactivar']), nombre: f.nombre }); }
  }
  const r = P(op); hechos++;
  if (!r.ok) { const k = op.accion + ': ' + r.mensaje.slice(0, 70); rechazos[k] = (rechazos[k] || 0) + 1; }
  const x = raro(r); if (x) nota('nanRespuesta', op.accion + ': ' + x);
  const cfg = leerConfig(); const nuevas = filas().slice(n0); const exp = deltas(nuevas, cfg);
  d = D(); const despS = saldosDe(d); const et = hoyS + ' #' + i + ' ' + op.accion;
  Object.keys(despS).forEach(n => { const e = (antesS[n] || 0) + (exp[n] || 0); if (Math.abs(e - despS[n]) > 1) nota('deltaSaldo:' + n, et + ' ' + n + ': esperado ' + e + ' vs ' + despS[n] + ' (filas nuevas ' + nuevas.map(q => q[1] + ' ' + q[3]).join(', ') + ')'); });
  invariantes(d, et);
  if (i % 25 === 0) fotos.push(foto(d));
  const k = d.mes, rc = mesRecalc(k, cfg);
  if (Math.abs(rc.g - d.gastos) > 2) nota('gastosMes', et + ': recalculado ' + Math.round(rc.g) + ' vs tablero ' + d.gastos);
  if (Math.abs(rc.ing - d.ingresos) > 1) nota('ingresosMes', et + ': recalculado ' + rc.ing + ' vs tablero ' + d.ingresos);
}
console.log('semilla ' + SEM + ' · ' + hechos + ' operaciones hasta ' + new Date(ts).toISOString().slice(0, 10) + ' · filas ' + filas().length);
console.log('rechazos:', JSON.stringify(rechazos, null, 1));
const ks = Object.keys(hallazgos); console.log(ks.length ? 'HALLAZGOS:' : 'OK: sin violaciones de invariantes');
ks.forEach(k => console.log(' - [' + k + '] ×' + hallazgos[k].n + ' · primero: ' + hallazgos[k].primero));
ks.forEach(k => console.log('  ✗ invariante [' + k + ']'));
if (process.env.FOTO) {
  const fin = D(); fotos.push(foto(fin));
  const meses = fin.meses.map(k => { const m = D(k); return { mes: k, ingresos: m.ingresos, gastos: m.gastos,
    categorias: m.categorias.map(c => [c.nombre, c.monto]), presupuestos: m.presupuestos.map(q => [q.grupo, q.gastado]) }; });
  require('fs').writeFileSync(process.env.FOTO, JSON.stringify({ semilla: SEM, pasos: PASOS, fotos, meses, historico: fin.historico }, null, 1) + '\n');
}
