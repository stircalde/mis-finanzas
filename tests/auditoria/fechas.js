// Auditoría 5: fechas raras, cambio de año, correos diarios y balance mensual a lo largo de 5 meses.
const A = require('../base'); const { P, D, ok, raro } = A;
A.fresco(); A.reloj(2026, 8, 30, 11);
const cta = (d, n) => d.cuentas.find(c => c.nombre === n);
// Fechas inválidas / futuras / pasadas
let r = P({ accion: 'gasto', descripcion: 'Fecha 30 feb', monto: '1000', cuenta: 'Nequi', fecha: '2026-02-30' }); A.tic();
let m = D().movimientos.find(x => x.desc === 'Fecha 30 feb'); console.log('fecha 2026-02-30 →', r.ok, m && m.fecha);
ok(!r.ok || (m && m.fecha === '2026-02-30'), 'fecha inválida 2026-02-30 se guardó como ' + (m && m.fecha) + ' sin avisar');
r = P({ accion: 'gasto', descripcion: 'Fecha futura', monto: '1000', cuenta: 'Nequi', fecha: '2031-01-01' }); A.tic();
console.log('fecha 2031-01-01 →', r.ok ? 'aceptada' : r.mensaje, '· meses del selector', D().meses.slice(0, 2).join(','));
ok(!r.ok, 'gasto con fecha 2031-01-01 aceptado (aparece mes 2031-01 en el selector y descuenta hoy de Nequi)');
r = P({ accion: 'gasto', descripcion: 'Fecha 13', monto: '1000', cuenta: 'Nequi', fecha: '2026-13-45' }); A.tic();
m = D().movimientos.find(x => x.desc === 'Fecha 13'); console.log('fecha 2026-13-45 →', m && m.fecha);
ok(!r.ok, 'fecha 2026-13-45 aceptada como ' + (m && m.fecha));
r = P({ accion: 'gasto', descripcion: 'Fecha basura', monto: '1000', cuenta: 'Nequi', fecha: '30/09/2026' }); A.tic();
m = D().movimientos.find(x => x.desc === 'Fecha basura'); console.log('fecha "30/09/2026" →', m && m.fecha, '(se usa hoy sin avisar)');
// Tarjeta con corte/pago día 31 y mes de pago "Mismo" con pago antes del corte
P({ accion: 'cuentaadmin', op: 'guardar', nombre: 'TC 31', tipo: 'Deuda', modo: 'Corte mensual', diaCorte: '31', diaPago: '31', mesPago: 'Siguiente', tasa: '2', interesDesde1: 'no', saldo: '0' }); A.tic();
P({ accion: 'gasto', descripcion: 'Compra TC31', monto: '120000', cuenta: 'TC 31', cuotas: '4' }); A.tic();
let pl = D().creditos.find(c => c.nombre === 'TC 31').planes[0]; console.log('TC 31 (corte 31, pago 31 sig.) →', pl.detalle.map(x => x.fecha).join(', '));
ok(pl.detalle.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x.fecha)), 'fechas inválidas en TC 31');
P({ accion: 'cuentaadmin', op: 'guardar', nombre: 'TC Rara', tipo: 'Deuda', modo: 'Corte mensual', diaCorte: '25', diaPago: '5', mesPago: 'Mismo', tasa: '2', interesDesde1: 'no', saldo: '0' }); A.tic();
P({ accion: 'gasto', descripcion: 'Compra rara', monto: '100000', cuenta: 'TC Rara', cuotas: '2' }); A.tic();
pl = D().creditos.find(c => c.nombre === 'TC Rara').planes[0]; console.log('TC Rara (corte 25, pago 5 del MISMO mes), compra 30 sep →', pl.detalle.map(x => x.fecha + ' ' + x.estado).join(', '));
ok(pl.detalle[0].fecha > '2026-09-30', 'config corte 25 / pago 5 "mismo mes" deja la cuota 1 con fecha ' + pl.detalle[0].fecha + ' (antes de la compra) → aparece vencida');
// Recorrido día a día hasta febrero 2027: recordatorios y balance del día 1 nunca deben fallar; los cierres deben quedar uno por mes.
const enviados = []; global.MailApp = { sendEmail: o => enviados.push({ dia: A.M && null, subject: o.subject, html: o.htmlBody }) };
const errores = [];
const origError = console.error; console.error = (...x) => errores.push(x.join(' '));
for (let dia = new Date(2026, 9, 1); dia <= new Date(2027, 1, 2); dia.setDate(dia.getDate() + 1)) {
  A.M.ahora(new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 7, 0).getTime());
  try { const s = recordatorioDiario(); if (dia.getDate() === 1) console.log(dia.toISOString().slice(0, 10), '→', s, '·', enviados.slice(-2).map(e => e.subject).join(' || ')); }
  catch (e) { errores.push(dia.toISOString().slice(0, 10) + ' ' + e.message); }
  // movimiento diario para que haya datos
  if (dia.getDate() % 9 === 0) { A.M.ahora(new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 12, 0).getTime()); P({ accion: 'gasto', descripcion: 'Tienda D1', monto: '20000', cuenta: 'Nequi' }); }
  const dd = D(); const x = raro(dd); if (x) errores.push(dia.toISOString().slice(0, 10) + ' NaN: ' + x);
}
console.error = origError;
ok(!errores.length, 'errores en recordatorio/balance: ' + errores.slice(0, 5).join(' | '));
ok(!enviados.some(e => /NaN|undefined|Invalid/.test(e.subject + e.html)), 'correo con NaN/undefined: ' + (enviados.find(e => /NaN|undefined|Invalid/.test(e.subject + e.html)) || {}).subject);
const cierres = A.sheets['Cierres'] ? A.sheets['Cierres'].grid.slice(1).map(r => r[0]) : [];
console.log('Cierres:', cierres.join(', '));
ok(cierres.join() === '2026-09,2026-10,2026-11,2026-12,2027-01', 'cierres mensuales raros: ' + cierres.join());
// Balance de un mes sin movimientos y de un mes anterior a todo
global.MailApp = { sendEmail: o => { global.__mail = o; } };
['2025-01', '2026-08', '2030-12'].forEach(k => { try { enviarBalanceMensual(k, true); ok(!/NaN|undefined/.test(global.__mail.htmlBody), 'balance ' + k + ' con NaN'); console.log('balance', k, '→', global.__mail.subject); } catch (e) { ok(false, 'balance ' + k + ' falla: ' + e.message); } });
const c2 = A.sheets['Cierres'].grid.slice(1).map(r => r[0]); console.log('Cierres tras balances de prueba:', c2.join(', '));
ok(c2.indexOf('2030-12') < 0, 'un balance de PRUEBA escribe una fila en Cierres (2030-12) con los totales de hoy');
// Balance: los totales de "Cómo quedaste" son los de HOY, no los del cierre del mes pedido
const antesNov = A.sheets['Cierres'].grid.slice(1).find(r => r[0] === '2026-11')[1];
A.M.ahora(new Date(2027, 1, 15, 9).getTime()); P({ accion: 'ingreso', descripcion: 'Prima', monto: '5000000', cuenta: 'Nequi' });
enviarBalanceMensual('2026-11', true); const fila = A.sheets['Cierres'].grid.slice(1).find(r => r[0] === '2026-11');
console.log('Cierre 2026-11: plata al cierre real', antesNov, '→ tras un balance de prueba el 15-feb-2027', fila[1]);
ok(fila[1] === antesNov, 'un balance de prueba de 2026-11 en febrero sobrescribe su cierre: plata ' + antesNov + ' → ' + fila[1]);
A.fin('audit_fechas');
