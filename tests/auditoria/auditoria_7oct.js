// Hallazgos de la auditoría externa del 7-oct (ChatGPT): avisos por tipo, favor antiguo duplicado, meta que cambia de cuenta.
const A = require('../base'); const { P, D, ok } = A;
A.fresco(); A.reloj(2026, 9, 7, 20);
P({ accion: 'cuentaadmin', op: 'guardar', nombre: 'Falabella', tipo: 'Plata', saldo: '500000' }); A.tic();
const T = (h, m, d = 7) => new Date(2026, 9, d, h, m).getTime();
const AV_ = (o) => { const r = P(Object.assign({ accion: 'aviso' }, o, { ts: String(o.ts) })); A.tic(); return r; };
const avs = () => D().avisos.items;

// 1) Un aviso de entrada no se toma como duplicado de un gasto del mismo monto, cuenta y día
P({ accion: 'gasto', descripcion: 'Zapatos', monto: '150000', cuenta: 'Falabella', categoria: 'Ropa', fecha: '2026-10-07' }); A.tic();
let r = AV_({ app: 'falabella', titulo: '¡Transferencia recibida!', texto: 'PEDRO EJEMPLO te ha enviado $150.000,00 a tu cuenta. 2026-10-07. 19:00.', ts: T(19, 0) });
let a = avs().find(x => x.monto === 150000);
ok(a && a.estado === 'Pendiente' && a.tipo === 'entrada', 'una entrada no es "ya estaba" por un gasto igual: ' + r.mensaje);
// …pero un gasto igual sí se reconoce como ya registrado
P({ accion: 'gasto', descripcion: 'Mercado', monto: '42000', cuenta: 'Nequi', categoria: 'Mercado', fecha: '2026-10-07' }); A.tic();
r = AV_({ app: 'nequi', texto: 'NEQUI: Pagaste 42.000,00 en MERCADO EJEMPLO', ts: T(19, 30) });
ok(/Ya lo tenías/.test(r.mensaje), 'un gasto sí reconoce el gasto ya registrado: ' + r.mensaje);
// …y una entrada reconoce un ingreso ya registrado en esa cuenta
P({ accion: 'ingreso', monto: '90000', cuenta: 'Falabella', tipoIngreso: 'Otros', fecha: '2026-10-07' }); A.tic();
r = AV_({ app: 'falabella', titulo: '¡Transferencia recibida!', texto: 'LUISA EJEMPLO te ha enviado $90.000,00 a tu cuenta. 2026-10-07. 19:40.', ts: T(19, 40) });
ok(/Ya lo tenías/.test(r.mensaje), 'una entrada reconoce el ingreso ya registrado: ' + r.mensaje);
// …y un gasto no se toma como duplicado de un ingreso
P({ accion: 'ingreso', monto: '33000', cuenta: 'Nequi', tipoIngreso: 'Otros', fecha: '2026-10-07' }); A.tic();
r = AV_({ app: 'nequi', texto: 'NEQUI: Pagaste 33.000,00 en TIENDA EJEMPLO', ts: T(19, 50) });
ok(!/Ya lo tenías/.test(r.mensaje), 'un gasto no es "ya estaba" por un ingreso igual: ' + r.mensaje);

// 2) Registrar dos veces el mismo favor antiguo ("le debía desde antes") no lo duplica
const lesDebo = (n) => (D().lesDebo.find(x => x.persona === n) || { saldo: 0 }).saldo;
r = P({ accion: 'ledebiaantes', persona: 'Camila', concepto: 'Préstamo', monto: '400000', fecha: '2026-08-01' }); A.tic();
ok(r.ok && lesDebo('Camila') === 400000, 'primer registro: ' + r.mensaje);
r = P({ accion: 'ledebiaantes', persona: 'camila', concepto: 'Préstamo', monto: '400000', fecha: '2026-08-01' }); A.tic();
ok(r.ok && /No lo dupliqué/.test(r.mensaje) && lesDebo('Camila') === 400000, 'el mismo favor antiguo no se duplica: ' + r.mensaje + ' → ' + lesDebo('Camila'));
r = P({ accion: 'ledebiaantes', persona: 'Camila', concepto: 'Préstamo moto', monto: '400000', fecha: '2026-08-01' }); A.tic();
ok(r.ok && lesDebo('Camila') === 800000, 'otro concepto sí se registra: ' + lesDebo('Camila'));

// 3) Meta que cambia de cuenta: el bolsillo propio anterior no queda huérfano
const meta = (n) => (D().metas || []).find(x => x.nombre === n);
const cta = (n) => D().cuentasCfg.find(c => c.nombre === n);
const M = (o) => P(Object.assign({ accion: 'metaadmin' }, o));
r = M({ op: 'guardar', anterior: '', nombre: 'Viaje', objetivo: '1200000', cuentaNueva: 'Bolsillo Viaje', principal: 'Nequi' }); A.tic();
P({ accion: 'transferencia', desde: 'Nequi', hacia: 'Bolsillo Viaje', monto: '500000' }); A.tic();
const falab0 = cta('Falabella').saldo;
r = M({ op: 'guardar', anterior: 'Viaje', nombre: 'Viaje', objetivo: '1200000', cuenta: 'Falabella' }); A.tic();
ok(r.ok && /pasaron a "Falabella"/.test(r.mensaje), 'avisa que la plata pasa a la cuenta nueva: ' + r.mensaje);
ok(cta('Falabella').saldo === falab0 + 500000 && cta('Bolsillo Viaje').saldo === 0 && cta('Bolsillo Viaje').activa === false, 'la plata del bolsillo pasa a la nueva cuenta y el bolsillo se archiva: ' + JSON.stringify(cta('Bolsillo Viaje')));
ok(meta('Viaje').cuenta === 'Falabella', 'la meta queda en la nueva cuenta');
// Cambiar entre cuentas normales no mueve plata
const nq = cta('Nequi').saldo, ef = cta('Efectivo').saldo;
r = M({ op: 'guardar', anterior: 'Viaje', nombre: 'Viaje', objetivo: '1200000', cuenta: 'Efectivo' }); A.tic();
ok(r.ok && cta('Falabella').saldo === falab0 + 500000 && cta('Efectivo').saldo === ef && cta('Falabella').activa !== false, 'una cuenta normal no se archiva ni se vacía: ' + r.mensaje);
// Bolsillo en negativo: no deja cambiar
M({ op: 'guardar', anterior: '', nombre: 'Moto', objetivo: '900000', cuentaNueva: 'Bolsillo Moto', principal: 'Nequi' }); A.tic();
P({ accion: 'gasto', descripcion: 'Casco', monto: '20000', cuenta: 'Bolsillo Moto', categoria: 'Otros' }); A.tic();
r = M({ op: 'guardar', anterior: 'Moto', nombre: 'Moto', objetivo: '900000', cuenta: 'Nequi' });
ok(!r.ok && /negativo/.test(r.mensaje) && meta('Moto').cuenta === 'Bolsillo Moto', 'bolsillo en negativo: no cambia: ' + r.mensaje);
ok(!A.raro(D()), 'panel sin NaN: ' + A.raro(D()));
A.fin('auditoria_7oct');
