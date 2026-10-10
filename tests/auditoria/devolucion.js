// Devoluciones a la tarjeta Nubank (pendiente 3). Datos ficticios.
const A = require('../base'); const { P, D, ok } = A;
A.fresco('2026-10-09', new Date(2026, 9, 9, 8).getTime()); A.reloj(2026, 9, 9, 8);
const AV_ = (o) => { const r = P(Object.assign({ accion: 'aviso', origen: 'app' }, o, { ts: String(o.ts) })); A.tic(); return r; };
const T = (h, m) => new Date(2026, 9, 9, h, m).getTime();
const nu = () => D().creditos.find(c => c.nombre === 'TC Nubank').saldo;
const texto = (com, v) => 'Devolución exitosa. Recibiste una devolución de ' + com + ' por $' + v + ' que puedes ver en el extracto de tu Tarjeta de Crédito Nu.';

ok(AV.parse({ app: 'nubank', titulo: 'Devolución exitosa.', texto: texto('RAPPI*RAPPI COLOMBIA', '134,00') }).tipo === 'devolucion', 'lee la devolución de Nubank');
P({ accion: 'gasto', descripcion: 'Rappi jabón', monto: '28362', cuenta: 'TC Nubank', categoria: 'Mercado', cuotas: '1', fecha: '2026-10-08' }); A.tic();
const s0 = nu();
let r = AV_({ app: 'nubank', texto: texto('RAPPI*RAPPI COLOMBIA', '28.362,00'), ts: T(9, 0) });
let a = D().avisos.items.find(x => x.tipo === 'devolucion');
ok(a && a.estado === 'Pendiente' && a.cuenta === 'TC Nubank' && a.anula && a.anula.desc === 'Rappi jabón', 'devolución pendiente con la compra que anula: ' + r.mensaje + ' ' + JSON.stringify(a));
r = P({ accion: 'avisoresolver', id: a.id, como: 'anular', mov: a.anula.id }); A.tic();
ok(r.ok && nu() === s0 - 28362 && !A.movs().some(m => m[2] === 'Rappi jabón'), 'anular borra la compra y baja la deuda: ' + r.mensaje + ' ' + nu());
r = AV_({ app: 'nubank', texto: texto('TIENDA EJEMPLO', '5.000,00'), ts: T(10, 0) });
a = D().avisos.items.find(x => x.tipo === 'devolucion' && x.estado === 'Pendiente');
ok(a && !a.anula, 'sin compra igual no ofrece anular');
const s1 = nu();
r = P({ accion: 'avisoresolver', id: a.id, como: 'devolucion' }); A.tic();
ok(r.ok && nu() === s1 - 5000, 'bajar la deuda: ajuste de −5.000: ' + r.mensaje + ' ' + nu());
A.fin('devolucion');
