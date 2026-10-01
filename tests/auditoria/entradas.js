// Auditoría 1: entradas abusivas (montos, descripciones, cuentas, cuotas, valorCuota, "para").
const A = require('../base'); const { P, D, ok, raro } = A;
A.fresco(); A.reloj(2026, 8, 30, 11);
const cta = (d, n) => d.cuentas.find(c => c.nombre === n), cred = (d, n) => d.creditos.find(c => c.nombre === n);
const n0 = cta(D(), 'Nequi').saldo;
const rech = (o, et) => { A.tic(); const r = P(o); ok(!r.ok, et + ' debería rechazarse: ' + r.mensaje); return r; };
const acep = (o, et) => { A.tic(); const r = P(o); ok(r.ok, et + ' debería aceptarse: ' + r.mensaje); return r; };

// Montos
['0', '-5000', 'abc', '', '   '].forEach(m => rech({ accion: 'gasto', descripcion: 'x', monto: m, cuenta: 'Nequi' }, 'monto "' + m + '"'));
let r = acep({ accion: 'gasto', descripcion: 'Decimal', monto: '1.500.000,50', cuenta: 'Nequi' }, 'monto 1.500.000,50');
ok(Math.abs(cta(D(), 'Nequi').saldo - (n0 - 1500001)) <= 1, 'monto con miles y decimales mal leído: ' + (n0 - cta(D(), 'Nequi').saldo));
// "1e12" (notación científica) → aNumero quita la "e" y queda 112
let a = cta(D(), 'Nequi').saldo; acep({ accion: 'gasto', descripcion: 'Cientifica', monto: '1e6', cuenta: 'Nequi' }, 'monto 1e6');
console.log('monto "1e6" se registró como', a - cta(D(), 'Nequi').saldo);
ok(a - cta(D(), 'Nequi').saldo === 1000000 || a - cta(D(), 'Nequi').saldo === 0, 'monto "1e6" leído como ' + (a - cta(D(), 'Nequi').saldo) + ' (no como 1.000.000 ni rechazado)');
acep({ accion: 'gasto', descripcion: 'Enorme', monto: '1000000000000', cuenta: 'Efectivo' }, 'monto 1e12');
ok(!raro(D()), 'NaN con monto enorme: ' + raro(D()));
// Descripciones
rech({ accion: 'gasto', descripcion: '   ', monto: '1000', cuenta: 'Nequi' }, 'descripción vacía');
acep({ accion: 'gasto', descripcion: '<script>alert(1)</script> "comillas" \'simple\' 🍔', monto: '1000', cuenta: 'Nequi' }, 'descripción HTML/emoji');
ok(D().movimientos.some(m => m.desc.indexOf('<script>') === 0), 'la descripción con HTML no se guardó literal');
// Cuentas desconocidas / variantes de mayúsculas y espacios
rech({ accion: 'gasto', descripcion: 'x', monto: '1000', cuenta: 'Bancolombia' }, 'cuenta inexistente');
acep({ accion: 'gasto', descripcion: 'x', monto: '1000', cuenta: '  Nequi  ' }, 'cuenta con espacios');
rech({ accion: 'gasto', descripcion: 'x', monto: '1000', cuenta: 'nequi' }, 'cuenta en minúsculas (se rechaza, no se crea otra)');
rech({ accion: 'gasto', descripcion: 'x', monto: '1000' }, 'sin cuenta');
// Cuotas
[['0', 1], ['1', 1], ['37', 36], ['abc', 1], ['-3', 1], ['2.7', 2]].forEach(([q, esperado]) => {
  A.tic(); const rr = P({ accion: 'gasto', descripcion: 'Cuotas ' + q, monto: '360000', cuenta: 'TC Nubank', cuotas: q });
  const m = D().movimientos.find(x => x.desc === 'Cuotas ' + q);
  ok(rr.ok && m && m.cuotas === esperado, 'cuotas "' + q + '" → ' + (m && m.cuotas) + ' (esperado ' + esperado + ')');
});
// valorCuota absurdo en Addi (pide valor): 3 cuotas de 1.000.000 por una compra de 100.000
let add0 = cred(D(), 'Addi').saldo;
r = acep({ accion: 'gasto', descripcion: 'Absurdo', monto: '100000', cuenta: 'Addi', cuotas: '3', valorCuota: '1000000' }, 'valorCuota absurdo');
let dd = D(); console.log('valorCuota 1.000.000 x3 por 100.000 →', r.mensaje.split('\n')[0], '| Addi sube', cred(dd, 'Addi').saldo - add0,
  '| intereses del mes', (dd.categorias.find(c => c.nombre === 'Intereses y cargos') || {}).monto);
ok(cred(dd, 'Addi').saldo - add0 <= 100000 * 2, 'valorCuota absurdo aceptado sin validar: la deuda de Addi sube ' + (cred(dd, 'Addi').saldo - add0) + ' por una compra de 100.000');
// valorCuota menor que monto/cuotas (Addi): última cuota absorbe el resto
add0 = cred(dd, 'Addi').saldo;
acep({ accion: 'gasto', descripcion: 'Cuota chica', monto: '300000', cuenta: 'Addi', cuotas: '3', valorCuota: '10000' }, 'valorCuota chico');
dd = D(); const pl = cred(dd, 'Addi').planes.find(p => p.desc === 'Cuota chica');
console.log('valorCuota 10.000 x3 por 300.000 → detalle', pl && pl.detalle.map(x => x.monto).join(' / '));
ok(pl && pl.detalle.reduce((s, x) => s + x.monto, 0) === 300000, 'plan con cuota chica no suma el monto');

// "para": formatos
const juan0 = (D().meDeben.find(p => p.persona === 'Juan') || { saldo: 0 }).saldo;
acep({ accion: 'gasto', descripcion: 'Para miles', monto: '300000', cuenta: 'Nequi', para: 'Juan:150.000' }, 'para con miles');
dd = D(); const jj = (dd.meDeben.find(p => p.persona === 'Juan') || { saldo: 0 }).saldo - juan0;
const mioMiles = dd.movimientos.find(m => m.desc === 'Para miles').mio;
console.log('para "Juan:150.000" → Juan debe', jj, '· mío', mioMiles);
ok(jj === 150000, 'para "Juan:150.000" (con punto de miles) quedó en ' + jj + ' en vez de 150.000; el gasto "mío" quedó en ' + mioMiles);
acep({ accion: 'gasto', descripcion: 'Para excedido', monto: '100000', cuenta: 'Nequi', para: 'Pedro:80000; Ana:80000' }, 'para excedido');
dd = D(); const ped = dd.meDeben.find(p => p.persona === 'Pedro'), ana = dd.meDeben.find(p => p.persona === 'Ana');
console.log('para excedido (160.000 de 100.000) → Pedro', ped && ped.saldo, 'Ana', ana && ana.saldo);
ok((ped ? ped.saldo : 0) + (ana ? ana.saldo : 0) <= 100000, '"para" que suma más que el gasto: te deben ' + ((ped ? ped.saldo : 0) + (ana ? ana.saldo : 0)) + ' por un gasto de 100.000');
acep({ accion: 'gasto', descripcion: 'Para mixto', monto: '90000', cuenta: 'Nequi', para: 'Luis;Marta:30000' }, 'para mixto');
dd = D(); console.log('para "Luis;Marta:30000" →', dd.meDeben.filter(p => /Luis|Marta/.test(p.persona)).map(p => p.persona + ' ' + p.saldo).join(', '), '· mío', dd.movimientos.find(m => m.desc === 'Para mixto').mio);
ok(dd.meDeben.some(p => p.persona === 'Luis'), '"Luis;Marta:30000": Luis desaparece (sin monto no se le asigna nada)');
// Nombres de persona con variación de mayúsculas
acep({ accion: 'gasto', descripcion: 'Almuerzo Sara', monto: '40000', cuenta: 'Nequi', para: 'Sara' }, 'para Sara');
acep({ accion: 'mepagaron', persona: 'sara', monto: '40000', cuenta: 'Nequi' }, 'me pagó "sara"');
dd = D(); const sara = dd.meDeben.find(p => p.persona === 'Sara'), sara2 = dd.lesDebo.find(p => p.persona === 'sara');
console.log('Sara debe', sara && sara.saldo, '· "sara" en Les debes:', sara2 && sara2.saldo);
ok(!sara && !sara2, 'persona con otra mayúscula: "Sara" sigue debiendo ' + (sara && sara.saldo) + ' y "sara" aparece en Les debes con ' + (sara2 && sara2.saldo));
// Me pagaron con aplica de otra persona / basura
const cfg = P({ accion: 'config' }).config;
const kPedro = cfg.personas.find(p => p.n === 'Pedro').c[0].k;
r = acep({ accion: 'mepagaron', persona: 'Ana', monto: '10000', cuenta: 'Nequi', aplica: kPedro }, 'aplica de otra persona');
ok(/lo más antiguo/.test(r.mensaje), 'aplica ajeno no cayó a lo más antiguo');
// Transferencias
rech({ accion: 'transferencia', desde: 'Nequi', hacia: 'Nequi', monto: '1000' }, 'transferencia a la misma cuenta');
rech({ accion: 'transferencia', desde: 'Nequi', hacia: ' Nequi ', monto: '1000' }, 'transferencia misma cuenta con espacios');
a = cta(D(), 'Efectivo').saldo; acep({ accion: 'transferencia', desde: 'Efectivo', hacia: 'Nequi', monto: String(a + 5000000) }, 'transferencia mayor al saldo');
ok(cta(D(), 'Efectivo').saldo >= 0, 'transferencia mayor al saldo deja Efectivo en ' + cta(D(), 'Efectivo').saldo + ' (no se valida saldo)');
const nu0 = cred(D(), 'TC Nubank').saldo;
acep({ accion: 'transferencia', desde: 'TC Nubank', hacia: 'Efectivo', monto: '200000' }, 'avance de tarjeta');
dd = D(); ok(cred(dd, 'TC Nubank').saldo === nu0 + 200000, 'avance no subió la deuda'); ok(!raro(dd), 'avance produjo NaN');
// Pagar más de lo que se debe
const cr0 = cred(dd, 'Credifin').saldo;
r = acep({ accion: 'pagocredito', credito: 'Credifin', monto: String(cr0 + 500000), origen: 'cuenta', cuenta: 'Nequi' }, 'pago mayor a la deuda');
console.log('pagar de más Credifin →', r.mensaje.replace(/\n/g, ' | '));
ok(cred(D(), 'Credifin').saldo >= 0, 'pagar de más deja Credifin en ' + cred(D(), 'Credifin').saldo + ' (deuda negativa sin aviso)');
// Ajuste a saldo negativo de una cuenta de plata (sobregiro real)
rech({ accion: 'ajuste', cuenta: 'Nequi', saldoReal: '-20000' }, 'ajuste negativo');
// Me prestaron / le pagué contra una cuenta de deuda
const add1 = cred(D(), 'Addi'); acep({ accion: 'meprestaron', persona: 'Tío', monto: '50000', cuenta: 'Addi' }, 'me prestaron → cuenta de deuda');
const add2 = cred(D(), 'Addi');
console.log('me prestaron hacia Addi: saldo', add1.saldo, '→', add2.saldo, '· próximo', add1.proximo.monto, '→', add2.proximo.monto);
ok(!(add2.saldo !== add1.saldo && add2.proximo.monto === add1.proximo.monto), 'me prestaron hacia una deuda baja el saldo (' + (add1.saldo - add2.saldo) + ') pero no el calendario de pagos');
// Mes inválido en el dashboard
['2026-13', '2026-00'].forEach(k => { const x = D(k); ok(!raro(x), 'mes ' + k + ' da NaN'); console.log('datosDashboard("' + k + '") → mes', x.mes, 'meses[0..2]', x.meses.slice(0, 3).join(','), 'historico', x.historico.map(h => h.mes).join(',')); });
ok(!raro(D()), 'dashboard final con NaN/undefined: ' + raro(D()));
A.fin('audit_entradas');
