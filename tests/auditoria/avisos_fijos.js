// Avisos que son cobros de gastos fijos (pendiente 4) y retiros automáticos a Efectivo (pendiente 15). Datos ficticios.
const A = require('../base'); const { P, D, ok } = A;
A.fresco('2026-10-09', new Date(2026, 9, 9, 8).getTime()); A.reloj(2026, 9, 9, 8);
const AV_ = (o) => { const r = P(Object.assign({ accion: 'aviso', origen: 'app' }, o, { ts: String(o.ts) })); A.tic(); return r; };
const T = (d, h, m) => new Date(2026, 9, d, h, m).getTime();
const it = (q) => D().avisos.items.find(q);
const fijoMovs = (n) => A.movs().filter(m => String(m[12] || '').indexOf('fijo:' + n + ':') === 0).map(m => ({ monto: m[3] }));

// 1) Fijo automático ya registrado (Streaming familiar, día 9, TC Davibank): el aviso del banco es "Ya estaba"
D();   // al abrir la app se registran los fijos automáticos del día
ok(fijoMovs('Streaming familiar').length === 1, 'el fijo automático del día quedó registrado');
let r = AV_({ app: 'sms', texto: 'DAVIbank : Compra recurrente en NETFLIX.COM por 42,000 con tu tarjeta Visa Oro 2026/10/09 07:10:00', ts: T(9, 7, 10) });
let a = it(x => x.monto === 42000);
ok(a && a.estado === 'Ya estaba' && /gasto fijo/.test(a.nota) && fijoMovs('Streaming familiar').length === 1, 'cobro de fijo ya registrado → Ya estaba sin duplicar: ' + r.mensaje + ' ' + JSON.stringify(a));

// 2) Fijo automático que aún no se registró (llega el aviso un día antes, monto con conversión ±3 %)
P({ accion: 'fijoadmin', op: 'guardar', nombre: 'Nube prueba', valor: '20000', frecuencia: 'Mensual', dia: '10', categoria: 'Suscripciones', cuenta: 'TC Davibank', cobro: 'Automático' }); A.tic();
r = AV_({ app: 'sms', texto: 'DAVIbank : Compra recurrente en NUBE EJEMPLO por 20,350 con tu tarjeta Visa Oro 2026/10/09 09:00:00', ts: T(9, 9, 0) });
a = it(x => x.monto === 20350);
ok(a && a.estado === 'Registrado' && fijoMovs('Nube prueba').length === 1 && fijoMovs('Nube prueba')[0].monto === 20350, 'fijo automático aún sin registrar → se registra como ese fijo con el monto del banco: ' + r.mensaje);
A.reloj(2026, 9, 10, 9); D();
ok(fijoMovs('Nube prueba').length === 1, 'al llegar su día no se registra dos veces');

// 3) Fijo que pagas tú (manual): queda por confirmar con la opción "Es mi gasto fijo"
P({ accion: 'fijoadmin', op: 'guardar', nombre: 'Arriendo prueba', valor: '500000', frecuencia: 'Mensual', dia: '10', categoria: 'Vivienda', cuenta: 'Nequi', cobro: 'Manual' }); A.tic();
r = AV_({ app: 'nequi', texto: 'Compra exitosa con Tarjeta Nequi Pagaste 500.000,00 en INMOBILIARIA EJEMPLO', ts: T(10, 9, 30) });
a = it(x => x.monto === 500000);
ok(a && a.estado === 'Pendiente' && /^fijo:Arriendo prueba\|2026-10$/.test(a.nota), 'fijo manual → pendiente con sugerencia: ' + JSON.stringify(a));
r = P({ accion: 'avisoresolver', id: a.id, como: 'fijo' }); A.tic();
a = it(x => x.monto === 500000);
ok(r.ok && a.estado === 'Registrado' && fijoMovs('Arriendo prueba').length === 1, '"Es mi gasto fijo" lo registra como pagado: ' + r.mensaje);

// 4) Una compra cualquiera de otro monto no se confunde con un fijo
r = AV_({ app: 'nequi', texto: 'Compra exitosa con Tarjeta Nequi Pagaste 12.480,00 en TIENDAS EJEMPLO', ts: T(10, 10, 0) });
a = it(x => x.monto === 12480);
ok(a && a.estado === 'Pendiente' && !a.nota, 'compra normal no se toma por fijo');

// 5) Retiro de efectivo: en modo automático pasa solo de la cuenta a Efectivo
r = AV_({ app: 'sms', texto: 'DaviPlata: acabas de Sacar 50.000 en un cajero', ts: T(10, 11, 0) });
a = it(x => x.monto === 50000);
ok(a && a.estado === 'Pendiente', 'en solo avisar el retiro espera: ' + r.mensaje);
P({ accion: 'avisosmodo', modo: 'auto' }); A.tic();
r = AV_({ app: 'sms', texto: 'DaviPlata: acabas de Sacar 70.000 en un cajero', ts: T(10, 12, 0) });
a = it(x => x.monto === 70000);
const tr = A.movs().filter(m => m[1] === 'Transferencia' && m[3] === 70000).map(m => ({ cuenta: m[5], destino: m[6] }))[0];
ok(a && a.estado === 'Registrado' && tr && tr.cuenta === 'Daviplata' && tr.destino === 'Efectivo', 'modo automático: retiro → transferencia a Efectivo: ' + r.mensaje + ' ' + JSON.stringify(tr));
A.fin('avisos_fijos');
