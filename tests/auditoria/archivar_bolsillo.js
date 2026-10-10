// Archivar un bolsillo con saldo: la plata pasa a otra cuenta en el mismo paso (pendiente 7). Datos ficticios.
const A = require('../base'); const { P, D, ok } = A;
A.fresco('2026-10-09', new Date(2026, 9, 9, 8).getTime()); A.reloj(2026, 9, 9, 8);
const saldo = (n) => (D().cuentasCfg.find(c => c.nombre === n) || {}).saldo;
P({ accion: 'transferencia', desde: 'Daviplata', hacia: 'Bolsillo para la tarjeta', monto: '17500' }); A.tic();
const b0 = saldo('Bolsillo para la tarjeta'), d0 = saldo('Daviplata');
ok(b0 >= 17500, 'el bolsillo tiene saldo: ' + b0);
let r = P({ accion: 'cuentaadmin', op: 'archivar', nombre: 'Bolsillo para la tarjeta' }); A.tic();
ok(!r.ok && /todav/.test(r.mensaje), 'sin destino sigue pidiendo dejarla en $0: ' + r.mensaje);
r = P({ accion: 'cuentaadmin', op: 'archivar', nombre: 'Bolsillo para la tarjeta', moverA: 'Daviplata' }); A.tic();
const cfgB = D().cuentasCfg.find(c => c.nombre === 'Bolsillo para la tarjeta');
ok(r.ok && saldo('Daviplata') === d0 + b0 && cfgB.activa === false && /ya no aparta/.test(r.mensaje), 'mueve el saldo y archiva: ' + r.mensaje);
ok(!D().creditos.find(c => c.nombre === 'TC Davibank').bolsillo, 'la tarjeta queda sin bolsillo');
r = P({ accion: 'cuentaadmin', op: 'archivar', nombre: 'Nequi', moverA: 'TC Nubank' }); A.tic();
ok(!r.ok, 'no mueve el saldo a una tarjeta');
A.fin('archivar_bolsillo');
