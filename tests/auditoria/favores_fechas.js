// Favores: fecha de pago opcional (favor nuevo y antiguo) y favor antiguo con valor inicial + saldo actual.
const A = require('../base'); const { P, D, ok } = A;
A.fresco(); A.reloj(2026, 9, 7, 11);
const deb = (n) => (D().meDeben || []).find(x => x.persona === n);
const les = (n) => (D().lesDebo || []).find(x => x.persona === n);
const plata = (n) => D().cuentasCfg.find(c => c.nombre === n).saldo;

// 1) Favor nuevo SIN fecha de pago: sigue igual que antes
let r = P({ accion: 'gasto', fecha: '2026-10-07', descripcion: 'Mercado', monto: '100000', categoria: 'Mercado', para: 'Luis', cuenta: 'Nequi' }); A.tic();
ok(r.ok && deb('Luis') && deb('Luis').saldo === 100000, 'favor sin fecha de pago: le prestaste 100.000: ' + r.mensaje);
ok(deb('Luis').conceptos[0].vence === '', 'sin fecha de pago no hay "vence"');
const nequi0 = plata('Nequi');

// 2) Favor nuevo CON fecha de pago futura: no está vencido; la fecha queda guardada
r = P({ accion: 'gasto', fecha: '2026-10-07', descripcion: 'Taxi', monto: '40000', categoria: 'Transporte', para: 'Marta', cuenta: 'Nequi', fechaPago: '2026-10-30' }); A.tic();
ok(r.ok && /te paga el 30\/10\/2026/.test(r.mensaje), 'con fecha de pago: ' + r.mensaje);
ok(deb('Marta') && deb('Marta').conceptos[0].vence === '2026-10-30', 'el favor guarda la fecha de pago: ' + JSON.stringify(deb('Marta') && deb('Marta').conceptos[0]));
ok(deb('Marta').vencido === 0, 'con fecha futura aún no está vencido');
ok(deb('Luis').vencido === 100000, 'sin fecha de pago se mantiene el comportamiento de antes (vencido desde el día del favor)');
ok(plata('Nequi') === nequi0 - 40000, 'la fecha de pago no cambia lo que sale de tu cuenta');

// 3) Validaciones
r = P({ accion: 'gasto', fecha: '2026-10-07', descripcion: 'X', monto: '1000', categoria: 'Otros', para: 'Marta', cuenta: 'Nequi', fechaPago: '2026-10-01' }); ok(!r.ok && /anterior/.test(r.mensaje), 'fecha de pago anterior al favor: ' + r.mensaje);
r = P({ accion: 'gasto', fecha: '2026-10-07', descripcion: 'X', monto: '1000', categoria: 'Otros', para: 'Marta', cuenta: 'Nequi', fechaPago: '30/10/2026' }); ok(!r.ok && /no es válida/.test(r.mensaje), 'fecha mal escrita');
r = P({ accion: 'gasto', fecha: '2026-10-07', descripcion: 'Solo mío', monto: '1000', categoria: 'Otros', cuenta: 'Nequi', fechaPago: '2026-10-30' }); A.tic();
ok(r.ok && !/te paga/.test(r.mensaje), 'un gasto tuyo (sin persona) ignora la fecha de pago');

// 4) Vence después de pasar la fecha
A.reloj(2026, 10, 2, 11);
ok(deb('Marta').vencido === 40000, 'pasada la fecha de pago, queda vencido: ' + deb('Marta').vencido);
A.reloj(2026, 9, 7, 11);

// 5) Favor antiguo con valor inicial y saldo actual
const total0 = D().totalMeDeben, nq1 = plata('Nequi');
r = P({ accion: 'deudaantigua', persona: 'Pedro', concepto: 'Préstamo de julio', monto: '500000', saldoActual: '300000', fechaPago: '2026-12-15' }); A.tic();
ok(r.ok && deb('Pedro'), 'favor antiguo con saldo actual: ' + r.mensaje);
ok(deb('Pedro').saldo === 300000 && deb('Pedro').prestado === 500000 && deb('Pedro').pagado === 200000, 'te debe 300.000 de 500.000 (ya pagó 200.000): ' + JSON.stringify([deb('Pedro').saldo, deb('Pedro').prestado, deb('Pedro').pagado]));
ok(D().totalMeDeben === total0 + 300000, 'el total que te deben sube solo en el saldo actual');
ok(deb('Pedro').conceptos[0].pendiente === 300000 && deb('Pedro').conceptos[0].vence === '2026-12-15', 'el concepto muestra lo pendiente y la fecha de pago');
ok(deb('Pedro').vencido === 0, 'con fecha de pago futura no está vencido');
ok(deb('Pedro').abonos.some(a => a.monto === 200000), 'lo ya pagado queda como pago en el historial');
ok(plata('Nequi') === nq1, 'no mueve tus cuentas');
// repetir lo mismo no duplica
r = P({ accion: 'deudaantigua', persona: 'Pedro', concepto: 'Préstamo de julio', monto: '500000', saldoActual: '300000', fechaPago: '2026-12-15' }); A.tic();
ok(deb('Pedro').saldo === 300000, 'repetir el mismo favor antiguo no lo duplica');
// sin saldo actual = no ha pagado nada
r = P({ accion: 'deudaantigua', persona: 'Rosa', concepto: 'Mercado', monto: '80000' }); A.tic();
ok(r.ok && deb('Rosa').saldo === 80000 && deb('Rosa').pagado === 0, 'sin saldo actual se asume que no ha pagado nada');
// validaciones
r = P({ accion: 'deudaantigua', persona: 'Rosa', concepto: 'Otro', monto: '80000', saldoActual: '90000' }); ok(!r.ok && /mayor que el valor inicial/.test(r.mensaje), 'saldo actual mayor que el inicial: ' + r.mensaje);
r = P({ accion: 'deudaantigua', persona: 'Rosa', concepto: 'Otro', monto: '80000', saldoActual: '0' }); ok(!r.ok, 'saldo actual en cero no se registra');
r = P({ accion: 'deudaantigua', persona: 'Rosa', concepto: 'Otro', monto: '0' }); ok(!r.ok, 'valor inicial en cero no sirve');
// Me pagaron después de un favor antiguo con saldo: descuenta del saldo actual
r = P({ accion: 'mepagaron', fecha: '2026-10-07', persona: 'Pedro', monto: '100000', cuenta: 'Nequi', exceso: 'favor' }); A.tic();
ok(r.ok && deb('Pedro').saldo === 200000, 'un pago posterior baja el saldo actual: ' + deb('Pedro').saldo + ' ' + r.mensaje);

// 6) Les debes: favor antiguo con valor inicial y saldo actual
r = P({ accion: 'ledebiaantes', persona: 'Camila', concepto: 'Préstamo', monto: '400000', saldoActual: '250000', fecha: '2026-08-01' }); A.tic();
ok(r.ok && les('Camila') && les('Camila').saldo === 250000, 'les debes: queda el saldo actual (250.000): ' + (les('Camila') && les('Camila').saldo) + ' ' + r.mensaje);
r = P({ accion: 'ledebiaantes', persona: 'Camila', concepto: 'Otro', monto: '100000', saldoActual: '200000', fecha: '2026-08-01' }); ok(!r.ok, 'les debes: saldo mayor al inicial no sirve');

A.fin('favores_fechas');
