// Editar movimientos ya registrados (acción editarmov).
const A = require('../base'); const { P, D, ok } = A;
A.fresco(); A.reloj(2026, 8, 30, 11);
const cfg = P({ accion: 'config' }).config;
const plata = cfg.plata[0].n || cfg.plata[0];
const mov = (desc) => D().movimientos.find(m => m.desc === desc);
const saldo = (n) => (D().cuentas.find(c => c.nombre === n) || {}).saldo;

// 1) Corregir monto, categoría y fecha de un gasto: el saldo se ajusta.
P({ accion: 'gasto', descripcion: 'Prueba editar', monto: '10000', cuenta: plata, categoria: 'Otros', fecha: '2026-09-29' }); A.tic();
const s0 = saldo(plata), m0 = mov('Prueba editar');
ok(m0 && m0.id, 'el movimiento debe traer su id');
let r = P({ accion: 'editarmov', id: m0.id, monto: '12500', categoria: 'Mercado', fecha: '2026-09-28', descripcion: 'Prueba editada' }); A.tic();
const m1 = mov('Prueba editada');
ok(r.ok && m1 && m1.monto === 12500 && m1.cat === 'Mercado' && m1.fecha === '2026-09-28', 'edición básica: ' + JSON.stringify(r));
ok(saldo(plata) === s0 - 2500, 'el saldo debía bajar $2.500 y quedó ' + (s0 - saldo(plata)));
ok(A.movs().filter(x => x[2] === 'Prueba editada').length === 1 && !A.movs().some(x => x[2] === 'Prueba editar'), 'no debe duplicar la fila');

// 2) Sin cambios: no escribe.
r = P({ accion: 'editarmov', id: m1.id, monto: '12500' });
ok(r.ok && /nada que cambiar/.test(r.mensaje), 'sin cambios: ' + r.mensaje);

// 3) Rechazos: id inexistente, histórico, monto inválido, cuenta que no existe, fecha futura.
ok(!P({ accion: 'editarmov', id: 'no-existe', monto: '1000' }).ok, 'id inexistente debe fallar');
ok(!P({ accion: 'editarmov', id: 'hist:1', monto: '1000' }).ok, 'histórico debe fallar');
ok(!P({ accion: 'editarmov', id: m1.id, monto: '0' }).ok && !P({ accion: 'editarmov', id: m1.id, monto: 'abc' }).ok, 'monto inválido debe fallar');
ok(!P({ accion: 'editarmov', id: m1.id, cuenta: 'Cuenta fantasma' }).ok, 'cuenta inexistente debe fallar');
ok(!P({ accion: 'editarmov', id: m1.id, fecha: '2030-01-01' }).ok, 'fecha futura debe fallar');
ok(mov('Prueba editada').monto === 12500, 'los rechazos no deben cambiar nada');

// 4) Gasto en tarjeta: cambiar el monto recalcula las cuotas.
const tc = ((cfg.deudas || []).find(x => x.c) || (cfg.deudas || [])[0] || {}).n || null;
if (tc) {
  P({ accion: 'gasto', descripcion: 'Compra cuotas', monto: '300000', cuenta: tc, cuotas: '3', valorCuota: '100000', fecha: '2026-09-27' }); A.tic();
  const c0 = mov('Compra cuotas');
  r = P({ accion: 'editarmov', id: c0.id, monto: '450000', cuotas: '3', valorCuota: '150000' }); A.tic();
  const c1 = mov('Compra cuotas');
  ok(r.ok && c1.monto === 450000 && c1.cuotas === 3 && c1.valorCuota === 150000, 'cuotas recalculadas: ' + JSON.stringify(c1));
}

// 5) Transferencia: cambiar origen y destino; no pueden ser iguales.
const otra = (cfg.plata.map(x => x.n || x)).find(n => n !== plata);
if (otra) {
  P({ accion: 'transferencia', desde: plata, hacia: otra, monto: '5000', fecha: '2026-09-29' }); A.tic();
  const t0 = D().movimientos.find(m => m.tipo === 'Transferencia' && m.monto === 5000);
  ok(!P({ accion: 'editarmov', id: t0.id, destino: plata }).ok, 'transferencia con origen = destino debe fallar');
  r = P({ accion: 'editarmov', id: t0.id, monto: '7000' }); A.tic();
  ok(r.ok && D().movimientos.find(m => m.id === t0.id).monto === 7000, 'editar monto de transferencia');
}

// 6) Ajustes: no se editan.
P({ accion: 'ajuste', cuenta: plata, saldoReal: '123456', fecha: '2026-09-29' }); A.tic();
const aj = D().movimientos.find(m => m.tipo === 'Ajuste');
if (aj) ok(!P({ accion: 'editarmov', id: aj.id, monto: '1' }).ok, 'un ajuste no debe poder editarse');

// 7) Deudas antiguas: se agregan a "Me deben desde antes" y suben lo que esa persona te debe.
const tot0 = D().totalMeDeben;
r = P({ accion: 'deudaantigua', persona: 'Tío Pedro', concepto: 'Mercado de hace meses', monto: '45000' }); A.tic();
ok(r.ok && D().totalMeDeben === tot0 + 45000, 'deuda antigua debe sumar $45.000: ' + JSON.stringify(r) + ' ' + (D().totalMeDeben - tot0));
ok(D().meDeben.some(x => x.persona === 'Tío Pedro'), 'la persona nueva debe aparecer en Favores');
r = P({ accion: 'deudaantigua', persona: 'tío pedro', concepto: 'Mercado de hace meses', monto: '45000' });
ok(r.ok && /No lo dupliqu/.test(r.mensaje) && D().totalMeDeben === tot0 + 45000, 'repetida no debe duplicar: ' + r.mensaje);
r = P({ accion: 'deudaantigua', persona: 'tío pedro', concepto: 'Otra cosa', monto: '5000' }); A.tic();
ok(r.ok && D().totalMeDeben === tot0 + 50000, 'misma persona con otro concepto suma al mismo nombre');
ok(!P({ accion: 'deudaantigua', persona: '', concepto: 'x', monto: '1000' }).ok && !P({ accion: 'deudaantigua', persona: 'Z', concepto: '', monto: '1000' }).ok && !P({ accion: 'deudaantigua', persona: 'Z', concepto: 'x', monto: '0' }).ok, 'datos incompletos deben fallar');
const pedros = D().meDeben.filter(x => /pedro/i.test(x.persona)).length;
ok(pedros === 1, 'no debe haber dos "Pedro": ' + pedros);

// 8) Algo que yo debía desde antes: sube "Les debes" sin mover ninguna cuenta.
const cuentasAntes = JSON.stringify(D().cuentas.map(c => [c.nombre, c.saldo]));
const les0 = D().totalLesDebo;
r = P({ accion: 'ledebiaantes', persona: 'Doña Rosa', concepto: 'Préstamo de julio', monto: '80000', fecha: '2026-07-15' }); A.tic();
const dd = D();
ok(r.ok && dd.totalLesDebo === les0 + 80000, 'les debes debe subir $80.000: ' + JSON.stringify(r) + ' ' + (dd.totalLesDebo - les0));
ok(JSON.stringify(dd.cuentas.map(c => [c.nombre, c.saldo])) === cuentasAntes, 'no debe mover ninguna cuenta: ' + cuentasAntes + ' vs ' + JSON.stringify(dd.cuentas.map(c => [c.nombre, c.saldo])));
ok(dd.lesDebo.some(x => x.persona === 'Doña Rosa' && x.saldo === 80000), 'Doña Rosa debe aparecer en Les debes');
ok(!require('../base').raro(dd), 'el dashboard no debe traer NaN/undefined: ' + require('../base').raro(dd));
r = P({ accion: 'lepague', persona: 'Doña Rosa', monto: '30000', cuenta: plata }); A.tic();
ok(r.ok && D().lesDebo.find(x => x.persona === 'Doña Rosa').saldo === 50000, 'pagarle una parte baja lo que le debes: ' + r.mensaje);
ok(!P({ accion: 'ledebiaantes', persona: '', concepto: 'x', monto: '5' }).ok && !P({ accion: 'ledebiaantes', persona: 'A', concepto: 'x', monto: '0' }).ok, 'datos incompletos deben fallar');
A.fin('editar');
