// Un ajuste de saldo en una tarjeta ya cortada NO se suma al pago del extracto emitido: va a la siguiente factura.
const A = require('../base'); const { P, D, ok } = A;
A.fresco(); A.reloj(2026, 9, 1, 11);
const cr = () => D().creditos.find(x => x.nombre === 'TC Davibank');
const antes = cr();
const pagoHoy = (c) => c.calendario.length ? c.calendario[0] : null;
const hay = (c) => c.calendario.some(g => g.detalle.some(x => /Ajuste/.test(x.desc)));
const sal0 = antes.saldo;
const r = P({ accion: 'ajuste', cuenta: 'TC Davibank', saldoReal: String(sal0 + 16450) }); A.tic();
const c = cr();
ok(r.ok && c.saldo === sal0 + 16450, 'el ajuste sube la deuda: ' + r.mensaje + ' ' + c.saldo + '/' + (sal0 + 16450));
const con = c.calendario.find(g => g.detalle.some(x => /Ajuste/.test(x.desc)));
ok(con, 'el ajuste debe aparecer en algún pago del calendario');
const primero = antes.calendario[0];
ok(con && con.fecha !== primero.fecha, 'el ajuste no debe caer en el pago que ya está emitido (' + primero.fecha + '), cayó en ' + (con && con.fecha));
const mismo = c.calendario.find(g => g.fecha === primero.fecha);
ok(mismo && mismo.monto === primero.monto, 'el pago ya emitido queda igual: ' + (mismo && mismo.monto) + '/' + primero.monto);
A.fin();
