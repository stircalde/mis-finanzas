// Auditoría 3: doble envío, pagos repetidos, fijos por periodo, "mantener" una suscripción ya pagada, anual con fecha futura.
const A = require('../base'); const { P, D, ok, raro } = A;
A.fresco(); A.reloj(2026, 8, 30, 11);
const filas = () => A.movs().length;
// 1) El mismo gasto enviado dos veces (reintento del celular): ¿hay idempotencia?
let n0 = filas();
const g = { accion: 'gasto', descripcion: 'Doble', monto: '25000', cuenta: 'Nequi', idem: 'abc-123', id: 'abc-123' };
P(g); A.tic(); P(g);
ok(filas() - n0 === 1, 'el mismo envío repetido (mismo id de cliente) creó ' + (filas() - n0) + ' movimientos: no hay idempotencia');
// 2) Pagar el mismo fijo del mismo periodo dos veces
const cf = P({ accion: 'config' }).config; const fj = cf.fijos[0];
n0 = filas(); const r1 = P({ accion: 'fijo', fijo: fj.n, periodo: fj.p, monto: String(fj.v), cuenta: fj.c }); A.tic();
const r2 = P({ accion: 'fijo', fijo: fj.n, periodo: fj.p, monto: String(fj.v), cuenta: fj.c });
ok(filas() - n0 === 1 && /ya estaba/.test(r2.mensaje), 'fijo pagado dos veces duplicó: ' + r2.mensaje);
// periodo basura
n0 = filas(); const r3 = P({ accion: 'fijo', fijo: fj.n, periodo: 'xx', monto: String(fj.v), cuenta: fj.c });
ok(!r3.ok || filas() === n0, 'fijo con periodo inventado "xx" se aceptó y registró otro pago: ' + r3.mensaje);
// 3) Suscripción "Una vez" pagada y luego "mantener" (pasa a mensual): ¿se vuelve a cobrar el mismo mes?
A.reloj(2026, 9, 18, 9);
let d = D(); const rp = d.fijosCfg.find(f => f.nombre === 'Prueba gratis'); console.log('Prueba gratis:', rp.frecuencia, rp.proximo, rp.cobro, rp.aviso);
P({ accion: 'fijo', fijo: 'Prueba gratis', monto: '24490', cuenta: 'Nequi' }); A.tic();
d = D(); const pag1 = d.movimientos.filter(m => m.desc === 'Prueba gratis').length;
P({ accion: 'fijoadmin', op: 'mantener', nombre: 'Prueba gratis' }); A.tic();
d = D(); const oct = d.proximos.find(p => p.nombre === 'Prueba gratis' && p.periodo === '2026-10');
console.log('tras mantener: Prueba gratis oct →', oct && oct.estado, oct && oct.fecha, '· pagos registrados', pag1);
ok(!oct || oct.estado === 'pagado', 'Prueba gratis ya pagado (Una vez) vuelve a salir pendiente en octubre tras "mantener" (estado ' + (oct && oct.estado) + ') → doble pago');
const cfgTel = P({ accion: 'config' }).config;
ok(!cfgTel.fijos.some(f => f.n === 'Prueba gratis' && f.p === '2026-10'), 'el celular ofrece pagar Prueba gratis 2026-10 otra vez');
// 4) Fijo anual nuevo cuyo próximo cobro es el AÑO siguiente
A.reloj(2026, 9, 1, 9);
P({ accion: 'fijoadmin', op: 'guardar', nombre: 'Dominio web', valor: '90000', frecuencia: 'Anual', proximo: '2027-10-15', categoria: 'Suscripciones', cuenta: 'Nequi', cobro: 'Automático' });
A.reloj(2026, 9, 16, 9); d = D();
const dom = d.movimientos.filter(m => m.desc === 'Dominio web');
console.log('Anual con próximo 2027-10-15, visto el 2026-10-16 → movimientos', dom.map(m => m.fecha + ' ' + m.monto).join(', ') || 'ninguno',
  '| próximos', d.proximos.filter(p => p.nombre === 'Dominio web').map(p => p.fecha + ' ' + p.estado).join(', '));
ok(dom.length === 0, 'fijo anual con próximo cobro en 2027-10-15 se cobró automáticamente el 2026-10-15');
// 5) Cancelar y reactivar un fijo automático: no debe cobrar hacia atrás (estado nuevo para no arrastrar el reloj)
A.fresco(); A.reloj(2026, 9, 17, 9); P({ accion: 'fijoadmin', op: 'cancelada', nombre: 'Gimnasio' }); // Gimnasio es el 18
A.reloj(2026, 9, 25, 9); d = D(); ok(!d.movimientos.some(m => m.desc === 'Gimnasio' && m.fecha === '2026-10-18'), 'Gimnasio cobrado estando cancelado');
P({ accion: 'fijoadmin', op: 'reactivar', nombre: 'Gimnasio' }); A.tic(); d = D();
ok(!d.movimientos.some(m => m.desc === 'Gimnasio' && m.fecha === '2026-10-18'), 'reactivar Gimnasio lo cobró hacia atrás (18 oct)');
A.reloj(2026, 10, 18, 9); d = D(); ok(d.movimientos.filter(m => m.desc === 'Gimnasio' && m.fecha === '2026-11-18').length === 1, 'Gimnasio no se cobró en noviembre tras reactivar');
// 6) Fijo con día 31: meses de 30 y febrero
A.reloj(2026, 10, 18, 10);
P({ accion: 'fijoadmin', op: 'guardar', nombre: 'Arriendo', valor: '800000', frecuencia: 'Mensual', dia: '31', categoria: 'Servicios públicos', cuenta: 'Nequi', cobro: 'Automático' });
const fechasArr = [];
for (let m = 10; m <= 14; m++) { A.reloj(2026, m + 1, 1, 8); fechasArr.push(...D().movimientos.filter(x => x.desc === 'Arriendo').map(x => x.fecha)); }
const unicas = [...new Set(fechasArr)].sort(); console.log('Arriendo día 31 →', unicas.join(', '));
ok(unicas.join(',') === '2026-11-30,2026-12-31,2027-01-31,2027-02-28,2027-03-31', 'fechas del fijo día 31 raras: ' + unicas.join(','));
ok(D().movimientos.filter(x => x.desc === 'Arriendo').length === 5, 'Arriendo duplicado o faltante: ' + D().movimientos.filter(x => x.desc === 'Arriendo').length);
// 7) Me pagaron dos veces la misma cuota (doble envío) → queda saldo a favor
A.fresco(); A.reloj(2026, 8, 30, 11);
P({ accion: 'gasto', descripcion: 'Tenis Leo', monto: '300000', cuenta: 'TC Nubank', cuotas: '3', para: 'Leo' }); A.tic();
const k = P({ accion: 'config' }).config.personas.find(p => p.n === 'Leo').c[0];
P({ accion: 'mepagaron', persona: 'Leo', monto: String(k.q), cuenta: 'Nequi', aplica: k.k }); A.tic();
P({ accion: 'mepagaron', persona: 'Leo', monto: String(k.q), cuenta: 'Nequi', aplica: k.k }); A.tic();
d = D(); const leo = d.meDeben.find(p => p.persona === 'Leo'); const c1 = leo.conceptos[0];
console.log('Leo tras pagar 2 veces la cuota 1:', c1.cuotasPagadas, 'cuotas pagadas', JSON.stringify(c1.detalle));
ok(c1.detalle[1].pagado === k.q, 'el segundo abono a la misma compra no se aplicó a la cuota 2');
// 8) Pagar un crédito dos veces seguidas (doble envío)
const ad = d.creditos.find(c => c.nombre === 'Addi'); n0 = filas();
P({ accion: 'pagocredito', credito: 'Addi', monto: String(ad.proximo.monto), origen: 'cuenta', cuenta: 'Nequi' }); A.tic();
P({ accion: 'pagocredito', credito: 'Addi', monto: String(ad.proximo.monto), origen: 'cuenta', cuenta: 'Nequi' });
ok(filas() - n0 === 1, 'pago de crédito enviado 2 veces quedó 2 veces (' + (filas() - n0) + ' filas) — sin protección de doble envío');
ok(!raro(D()), 'NaN');
A.fin('audit_doble');
