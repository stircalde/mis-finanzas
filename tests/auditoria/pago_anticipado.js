// Pago anticipado con descuento (Credifin, pendiente 13). Datos ficticios.
const A = require('../base'); const { P, D, ok } = A;
A.fresco('2026-10-09', new Date(2026, 9, 9, 8).getTime()); A.reloj(2026, 9, 9, 8);
const deuda = (n) => D().creditos.find(c => c.nombre === n).saldo;
const plata = (n) => D().cuentasCfg.find(c => c.nombre === n).saldo;
const s0 = deuda('Credifin'), n0 = plata('Nequi');
ok(s0 > 10000, 'Credifin tiene deuda: ' + s0);
const pago = Math.round(s0 * 0.85), desc = s0 - pago;
let r = P({ accion: 'pagocredito', credito: 'Credifin', monto: String(pago), origen: 'cuenta', cuenta: 'Nequi', descuento: String(desc) }); A.tic();
ok(r.ok && deuda('Credifin') === 0 && plata('Nequi') === n0 - pago && /Descuento/.test(r.mensaje), 'paga menos y la deuda queda en 0: ' + r.mensaje);
const g = D().gastos;
r = P({ accion: 'pagocredito', credito: 'TC Nubank', monto: '1000', origen: 'cuenta', cuenta: 'Nequi', descuento: '99999999' }); A.tic();
ok(!r.ok && plata('Nequi') === n0 - pago, 'no acepta un descuento mayor que la deuda (y no deja el pago a medias): ' + r.mensaje);
ok(D().gastos === g, 'el descuento no cuenta como gasto');
A.fin('pago_anticipado');
