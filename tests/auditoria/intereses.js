// Motor de intereses diarios (modelo Davibank). Montos inventados con la misma estructura de los extractos reales
// con que se verificó la fórmula (agosto exacto, septiembre con $18 de diferencia en $57.258).
const A = require('../base'); const { ok } = A;
A.fresco();
const D = (y, m, d) => new Date(y, m - 1, d);
const r = Math.pow(1.293, 1 / 12) - 1;                         // tasa mensual que sale de 29,30 % E.A.
const c1 = { corte: D(2026, 8, 21), limite: D(2026, 9, 8) }, c2 = { corte: D(2026, 9, 18), limite: D(2026, 10, 7) };
const base = (eventos, extra) => motorDiario(Object.assign({ tasa: r, inicio: D(2026, 7, 18), cap0: 0, nocap0: 0, prev: null, ciclos: [c1, c2], eventos, hoy: D(2026, 10, 1), escenario: 'minimo' }, extra || {}));

// 1) Compra a cuotas: interés desde el día de la compra hasta el corte, ambos incluidos (9 → 21 de agosto = 13 días).
let x = base([{ fecha: D(2026, 8, 9), tipo: 'compra', monto: 1000000, n: 12 }]);
ok(x.cargos[0].monto === Math.round(1000000 * r / 30 * 13), 'compra a cuotas: ' + x.cargos[0].monto + ' en vez de ' + Math.round(1000000 * r / 30 * 13));

// 2) Compra a 1 cuota pagando el total a tiempo: nunca cobra interés.
x = base([{ fecha: D(2026, 8, 10), tipo: 'compra', monto: 200000, n: 1 }, { fecha: D(2026, 9, 1), tipo: 'pago', monto: 200000 }]);
ok(x.cargos[0].monto === 0 && x.cargos[1].monto === 0, 'compra a 1 cuota pagada completa no debería cobrar intereses: ' + x.cargos.map(c => c.monto));

// 3) Compra a 1 cuota pagando solo una parte: el corte siguiente cobra retroactivo desde la compra y lo que siga debiendo.
x = base([{ fecha: D(2026, 8, 10), tipo: 'compra', monto: 200000, n: 1 }, { fecha: D(2026, 9, 1), tipo: 'pago', monto: 50000 }]);
const retro = Math.round(200000 * r / 30 * 12);               // 10 → 21 de agosto
const despues = 200000 * r / 30 * 11 + 150000 * r / 30 * 17;  // 22 ago → 1 sep con 200.000; 2 → 18 sep con 150.000
ok(!x.cargos[1].gracia && x.cargos[1].retro === retro, 'sin pagar el total debería cobrar retroactivo ' + retro + ': ' + x.cargos[1].retro);
ok(Math.abs(x.cargos[1].monto - Math.round(retro + despues)) <= 1, 'interés del 2.º corte ' + x.cargos[1].monto + ' vs ' + Math.round(retro + despues));

// 4) El pago reduce el capital desde el día siguiente y cubre primero los intereses facturados.
x = base([{ fecha: D(2026, 8, 9), tipo: 'compra', monto: 1000000, n: 12 }, { fecha: D(2026, 9, 8), tipo: 'pago', monto: 100000 }]);
const i1 = x.cargos[0].monto, capDesp = 1000000 - (100000 - i1);
const esperado2 = Math.round(1000000 * r / 30 * 18 + capDesp * r / 30 * 10);  // 22 ago → 8 sep (18 días) y 9 → 18 sep (10 días)
ok(Math.abs(x.cargos[1].monto - esperado2) <= 1, 'pago a mitad de ciclo: ' + x.cargos[1].monto + ' vs ' + esperado2);

// 5) Los intereses y cargos facturados no generan intereses.
x = base([{ fecha: D(2026, 8, 9), tipo: 'compra', monto: 1000000, n: 12 }, { fecha: D(2026, 8, 21), tipo: 'cargo', monto: 50000 }]);
const y = base([{ fecha: D(2026, 8, 9), tipo: 'compra', monto: 1000000, n: 12 }]);
ok(x.cargos[1].monto === y.cargos[1].monto, 'un cargo (seguro) no debería generar intereses: ' + x.cargos[1].monto + ' vs ' + y.cargos[1].monto);

A.fin('intereses');
