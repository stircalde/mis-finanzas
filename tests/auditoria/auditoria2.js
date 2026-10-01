// Auditoría externa 1 (Gemini, 1-oct-2026): casos que reprodujeron hallazgos reales del backend.
const A = require('../base'); const { P, D, ok } = A;

// 1) Pagarle a alguien más de lo que le debes: la diferencia no puede desaparecer.
A.fresco(); A.reloj(2026, 9, 1, 12);
P({ accion: 'meprestaron', persona: 'Leo', monto: '50000', cuenta: 'Efectivo' }); A.tic();
const p0 = D().patrimonio;
let r = P({ accion: 'lepague', persona: 'Leo', monto: '100000', cuenta: 'Nequi' }); A.tic();
ok(!r.ok && /Solo le debes \$50\.000/.test(r.mensaje), 'pagar de más sin decir qué pasa con la diferencia debería rechazarse: ' + r.mensaje);
r = P({ accion: 'lepague', persona: 'Leo', monto: '100000', cuenta: 'Nequi', exceso: 'debe' }); A.tic();
let d = D(); const leo = d.meDeben.find(x => x.persona === 'Leo');
ok(r.ok && leo && leo.saldo === 50000, 'el exceso "me lo queda debiendo" debería quedar en Me deben: ' + JSON.stringify(leo));
ok(!d.lesDebo.some(x => x.persona === 'Leo'), 'tras pagarle de más, todavía figura que le debo a Leo');
ok(d.patrimonio === p0, 'pagar de más con "me lo queda debiendo" no debería cambiar el patrimonio: ' + p0 + ' → ' + d.patrimonio);

A.fresco(); A.reloj(2026, 9, 1, 12);
P({ accion: 'meprestaron', persona: 'Leo', monto: '50000', cuenta: 'Efectivo' }); A.tic();
const g0 = D().gastos;
r = P({ accion: 'lepague', persona: 'Leo', monto: '80000', cuenta: 'Nequi', exceso: 'regalo' }); A.tic();
d = D();
ok(r.ok && d.gastos - g0 === 30000, 'el exceso "regalo" debería contar como gasto de $30.000: ' + (d.gastos - g0));
ok(!d.meDeben.some(x => x.persona === 'Leo') && !d.lesDebo.some(x => x.persona === 'Leo'), 'tras el regalo, Leo no debería deber ni que le deban');
r = P({ accion: 'lepague', persona: 'Leo', monto: '20000', cuenta: 'Nequi' });
ok(!r.ok && /No le debes nada/.test(r.mensaje), 'pagarle a quien no le debes nada debería rechazarse sin exceso: ' + r.mensaje);

// 2) Textos que Sheets podría tomar como fórmula: solo los números puros quedan sin apóstrofo.
A.fresco(); A.reloj(2026, 9, 1, 12);
P({ accion: 'gasto', descripcion: '-1+1', monto: '1000', cuenta: 'Nequi', categoria: 'Otros' });
P({ accion: 'gasto', descripcion: '@x', monto: '1000', cuenta: 'Nequi', categoria: 'Otros' });
const descs = A.movs().map(f => f[2]);
ok(descs.includes("'-1+1") && descs.includes("'@x"), 'textos tipo fórmula deberían guardarse con apóstrofo: ' + JSON.stringify(descs.slice(-2)));

// 3) Gastos fijos que solo cambian tildes o mayúsculas no se duplican.
A.fresco(); A.reloj(2026, 9, 1, 12);
r = P({ accion: 'fijoadmin', op: 'guardar', nombre: 'gimnásio', valor: '20000', frecuencia: 'Mensual', dia: '5', categoria: 'Otros', cuenta: 'Nequi', cobro: 'Manual' });
ok(!r.ok && /Ya tienes "Gimnasio"/.test(r.mensaje), 'un fijo casi igual a "Gimnasio" debería rechazarse: ' + r.mensaje);
r = P({ accion: 'fijoadmin', op: 'guardar', nombre: 'Gimnasio', valor: '125000', frecuencia: 'Mensual', dia: '18', categoria: 'Gimnasio y suplementos', cuenta: 'Nequi', cobro: 'Automático' });
ok(r.ok, 'editar un fijo existente con su mismo nombre debería funcionar: ' + r.mensaje);

A.fin('auditoria2');
