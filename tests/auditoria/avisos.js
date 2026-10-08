// Avisos de notificaciones (macro del celular → "Por confirmar"). Todos los textos y nombres son ficticios.
const A = require('../base'); const { P, D, ok } = A;
A.fresco(); A.reloj(2026, 9, 7, 20);
// El dueño se llama Hector (para reconocer "te envió Hector" como una transferencia propia)
const cfgSheet = A.sheets['Configuración'].grid;
cfgSheet.forEach(f => { if (f[0] === 'Nombre') f[1] = 'Hector Ejemplo'; });
CACHE_CFG_ = null;
P({ accion: 'cuentaadmin', op: 'guardar', nombre: 'Falabella', tipo: 'Plata', saldo: '0' }); A.tic();

const T = (h, m, d = 7) => new Date(2026, 9, d, h, m).getTime();
const AV_ = (o) => { const r = P(Object.assign({ accion: 'aviso' }, o, { ts: String(o.ts) })); A.tic(); return r; };
const av = () => D().avisos;
const pend = () => av().items.filter(x => x.estado === 'Pendiente');
const nMov = () => A.movs().length;

// 1) Lector de números y de bancos
ok(AV.num('8.749,21') === 8749.21 && AV.num('$42.850,00') === 42850 && AV.num('74,915') === 74915 && AV.num('COP12,480') === 12480 && AV.num('$440.000') === 440000, 'lector de números');
ok(AV.parse({ app: 'sms', texto: 'DAVIbank: Inscribiste tu tarjeta Visa Oro en OPENAI 2026/09/29 17:39:27' }) === null, 'inscripción de tarjeta no es un movimiento');
ok(AV.parse({ app: 'sms', texto: 'Tu cuota de Credifin por $120.000 vence mañana' }) === null, 'Credifin nunca es automático');
ok(AV.parse({ app: 'sms', texto: 'Addi: Pagaste 50.000 en TIENDA' }) === null, 'Addi nunca es automático');

// 2) Modo por defecto: solo avisar. La misma compra por app + SMS + Billetera es UN aviso
ok(av().modo === 'avisar' && av().pendientes === 0, 'parte en modo solo avisar y sin avisos');
const antes = nMov();
let r = AV_({ app: 'nequi', texto: 'Compra exitosa con Tarjeta Nequi Pagaste 12.480,00 en TIENDAS EJEMPLO', ts: T(19, 17, 6) });
ok(r.ok && /por confirmar/.test(r.mensaje), 'aviso nuevo queda por confirmar: ' + r.mensaje);
AV_({ app: 'sms', texto: '890806 NEQUI: Pagaste 12.480,00 en TIENDAS EJEMPLO', ts: T(19, 17, 6) });
r = AV_({ app: 'wallet', titulo: 'TIENDAS EJEMPLO', texto: 'COP12,480 con Tarjeta Nequi Visa ••0000', ts: T(19, 18, 6) });
ok(/repetido/.test(r.mensaje), 'la Billetera no duplica: ' + r.mensaje);
ok(pend().length === 1 && pend()[0].n === 3 && pend()[0].cuenta === 'Nequi' && pend()[0].fuentes.length === 3, 'un solo aviso con 3 canales: ' + JSON.stringify(pend()));
ok(nMov() === antes, 'en modo solo avisar no se registra nada');

// 3) Compra con tarjeta de crédito, SMS de Davibank (con fecha dentro del texto)
AV_({ app: 'sms', texto: 'DAVIbank: Realizaste  transaccion en EXITO EJEMPLO por 11,440 con tu tarjeta Visa Oro 2026/10/06 14:34:12', ts: T(14, 35, 6) });
const exito = pend().find(x => x.quien === 'EXITO EJEMPLO');
ok(exito && exito.cuenta === 'TC Davibank' && exito.tc && exito.monto === 11440, 'Davibank → TC Davibank, tarjeta: ' + JSON.stringify(exito));
// Recurrente y PSE
AV_({ app: 'sms', texto: 'DAVIbank : Compra recurrente en STREAMING EJEMPLO por 74,000 con tu tarjeta Visa Oro 2026/10/05 20:42:34', ts: T(20, 43, 5) });
ok(pend().find(x => x.quien === 'STREAMING EJEMPLO').recurrente, 'marca la compra recurrente');
AV_({ app: 'nequi', titulo: 'Pago exitoso por PSE', texto: 'Hiciste un pago en LUZ EJEMPLO SA ESP por $440.000 y todo salió bien.', ts: T(19, 37, 6) });
AV_({ app: 'correo', titulo: 'somos', texto: '¡Pago exitoso! Hiciste un pago en LUZ EJEMPLO SA ESP por $440.000 Fecha: El 6 de octubre', ts: T(19, 38, 6) });
r = AV_({ app: 'correo', titulo: 'PlacetoPay', texto: 'Transacción aprobada en LUZ [1] Transacción Aprobada COP $440.000,00 Comercio LUZ', ts: T(19, 39, 6) });
ok(pend().filter(x => x.monto === 440000).length === 1 && pend().find(x => x.monto === 440000).n === 3, 'PSE (app + 2 correos) es un solo aviso: ' + JSON.stringify(pend().filter(x => x.monto === 440000)));

// 4) Transferencia entre cuentas propias: salida Nequi + entrada Falabella con el nombre del dueño
AV_({ app: 'nequi', titulo: 'Envío de plata exitoso', texto: 'Te contamos que el envío de plata por $150.000 fue exitoso. Puedes revisar en tus movimientos el detalle.', ts: T(16, 3, 2) });
r = AV_({ app: 'falabella', titulo: '¡Transferencia recibida!', texto: 'HECTOR EJEMPLO te ha enviado $150.000,00 a tu cuenta. 2026-10-02. 16:03.', ts: T(16, 4, 2) });
const tr = pend().find(x => x.tipo === 'transferencia');
ok(tr && tr.cuenta === 'Nequi' && tr.destino === 'Falabella' && tr.monto === 150000 && tr.n === 2, 'salida + entrada propia = transferencia: ' + JSON.stringify(tr));
// Si llega primero la entrada y luego la salida, también
AV_({ app: 'falabella', titulo: '¡Transferencia recibida!', texto: 'HECTOR EJEMPLO te ha enviado $80.000,00 a tu cuenta. 2026-10-03. 10:00.', ts: T(10, 0, 3) });
AV_({ app: 'nequi', titulo: 'Envío de plata exitoso', texto: 'Te contamos que el envío de plata por $80.000 fue exitoso.', ts: T(10, 1, 3) });
ok(pend().filter(x => x.tipo === 'transferencia').length === 2, 'también si la entrada llega primero');
const t80 = pend().find(x => x.tipo === 'transferencia' && x.monto === 80000);
ok(t80 && t80.cuenta === 'Nequi' && t80.destino === 'Falabella', 'entrada primero: origen Nequi y destino Falabella: ' + JSON.stringify(t80));
// Lo que manda otra persona NO se empareja nunca
AV_({ app: 'nequi', titulo: 'Envío', texto: 'NURY EJEMPLO te envió 700000, ¡lo mejor!', ts: T(9, 50) });
AV_({ app: 'nequi', titulo: 'Envío de plata exitoso', texto: 'Te contamos que el envío de plata por $700.000 fue exitoso.', ts: T(9, 51) });
const nury = pend().find(x => /NURY/.test(x.quien));
ok(nury && nury.tipo === 'entrada' && !nury.mio && pend().some(x => x.tipo === 'salida' && x.monto === 700000), 'envío de otra persona queda como entrada por decidir, sin emparejar');

// 5) Lo que ya registraste a mano se reconoce y no pide nada
P({ accion: 'gasto', descripcion: 'Cine', monto: '42850', cuenta: 'TC Nubank', categoria: 'Ocio', fecha: '2026-10-03', cuotas: '1' }); A.tic();
r = AV_({ app: 'nubank', titulo: 'Compra aprobada por $42.850,00', texto: 'Tu compra en CINE EJEMPLO por $42.850,00 con tu tarjeta terminada en 0000 ha sido APROBADA.', ts: T(0, 34, 3) });
const ya = av().items.find(x => x.monto === 42850);
ok(ya && ya.estado === 'Ya estaba' && ya.idMov, 'compra ya registrada a mano: ' + r.mensaje);
// …pero el mismo monto otro día NO se confunde
r = AV_({ app: 'nubank', titulo: 'Compra aprobada por $42.850,00', texto: 'Tu compra en OTRO CINE por $42.850,00 con tu tarjeta terminada en 0000 ha sido APROBADA.', ts: T(12, 0, 6) });
ok(av().items.some(x => x.monto === 42850 && x.estado === 'Pendiente'), 'mismo monto en otra fecha queda pendiente');

// 6) Ruido: texto que no es un movimiento
r = AV_({ app: 'sms', texto: 'Tu código de verificación es 123456', ts: T(21, 0) });
ok(r.ok && /no es un movimiento/.test(r.mensaje), 'ignora el ruido');

// 7) Resolver: gasto a 3 cuotas, para otra persona; el monto es el del banco
const tara = pend().find(x => x.quien === 'TIENDAS EJEMPLO');
const bell = av().pendientes;
r = P({ accion: 'avisoresolver', id: tara.id, como: 'gasto', datos: JSON.stringify({ descripcion: 'Mercado', monto: '999', cuenta: 'Nequi', categoria: 'Mercado', para: 'Laura' }) }); A.tic();
ok(r.ok, 'resolver gasto: ' + r.mensaje);
const g = A.movs().find(m => m[2] === 'Mercado');
ok(g && g[3] === 12480 && g[5] === 'Nequi' && g[7] === 'Laura', 'el movimiento usa el monto del aviso y "para": ' + JSON.stringify(g));
ok(av().pendientes === bell - 1 && av().items.find(x => x.id === tara.id).estado === 'Registrado' && av().items.find(x => x.id === tara.id).idMov === g[12], 'el aviso queda registrado y enlazado');
ok(!P({ accion: 'avisoresolver', id: tara.id, como: 'gasto', datos: '{}' }).ok, 'no se resuelve dos veces');
ok(nMov() === antes + 2 || A.movs().filter(m => m[2] === 'Mercado').length === 1, 'un solo movimiento');

// 8) Resolver: TC con 3 cuotas, transferencia, envío de Nury como "me pagaron", ignorar y reabrir
const ex = pend().find(x => x.quien === 'EXITO EJEMPLO');
r = P({ accion: 'avisoresolver', id: ex.id, como: 'gasto', datos: JSON.stringify({ descripcion: 'Éxito', cuenta: 'TC Davibank', cuotas: '3', categoria: 'Mercado' }) }); A.tic();
ok(r.ok && A.movs().find(m => m[2] === 'Éxito' && m[8] == 3), 'compra de tarjeta resuelta a 3 cuotas: ' + r.mensaje);
const t1 = pend().find(x => x.tipo === 'transferencia' && x.monto === 150000);
r = P({ accion: 'avisoresolver', id: t1.id, como: 'transferencia', datos: JSON.stringify({ desde: 'Nequi', hacia: 'Falabella' }) }); A.tic();
ok(r.ok && A.movs().find(m => m[1] === 'Transferencia' && m[3] === 150000 && m[5] === 'Nequi' && m[6] === 'Falabella'), 'transferencia resuelta: ' + r.mensaje);
r = P({ accion: 'avisoresolver', id: nury.id, como: 'ingreso', datos: JSON.stringify({ cuenta: 'Nequi', tipoIngreso: 'Aporte de mamá', descripcion: 'Aporte' }) }); A.tic();
ok(r.ok && A.movs().find(m => m[1] === 'Ingreso' && m[3] === 700000), 'el envío de Nury se aplica como tú elijas (ingreso): ' + r.mensaje);
const sal = pend().find(x => x.tipo === 'salida' && x.monto === 700000);
r = P({ accion: 'avisoresolver', id: sal.id, como: 'ignorar' }); A.tic();
ok(r.ok && av().items.find(x => x.id === sal.id).estado === 'Ignorado', 'ignorar');
r = P({ accion: 'avisoresolver', id: sal.id, como: 'reabrir' }); A.tic();
ok(r.ok && av().items.find(x => x.id === sal.id).estado === 'Pendiente', 'reabrir un ignorado');
ok(!P({ accion: 'avisoresolver', id: 'noexiste', como: 'ignorar' }).ok, 'aviso inexistente');
ok(!P({ accion: 'avisoresolver', id: sal.id, como: 'inventado', datos: '{}' }).ok, 'tipo de registro no permitido');

// 9) Un error al registrar no deja el aviso a medias
const p0 = av().pendientes, m0 = nMov();
const peor = pend().find(x => x.tipo === 'salida');
r = P({ accion: 'avisoresolver', id: peor.id, como: 'lepague', datos: JSON.stringify({ cuenta: 'Nequi', persona: '' }) }); A.tic();
ok(!r.ok && av().pendientes === p0 && nMov() === m0, 'si falla, el aviso sigue pendiente y no hay movimientos nuevos: ' + r.mensaje);

// 10) Modo automático: gasto simple y transferencia propia se registran solos; lo demás no
ok(!P({ accion: 'avisosmodo', modo: 'loquesea' }).ok, 'modo inválido');
ok(P({ accion: 'avisosmodo', modo: 'auto' }).ok && av().modo === 'auto', 'activar modo automático'); A.tic();
const m1 = nMov();
r = AV_({ app: 'nubank', titulo: 'Compra aprobada por $30.000,00', texto: 'Tu compra en TIENDA AUTO por $30.000,00 con tu tarjeta terminada en 0000 ha sido APROBADA.', ts: T(20, 5) });
const auto = A.movs().find(m => m[2] === 'TIENDA AUTO');
ok(/solo/.test(r.mensaje) && auto && auto[5] === 'TC Nubank' && auto[8] == 1, 'en auto, la compra de tarjeta va a 1 cuota: ' + r.mensaje + JSON.stringify(auto));
AV_({ app: 'sms', texto: 'DaviPlata: Pagaste  36,920 con tu Tarjeta Debito Digital. Recuerda tener saldo.', ts: T(20, 6) });
ok(A.movs().find(m => m[3] === 36920 && m[5] === 'Daviplata'), 'en auto, el gasto de Daviplata sin comercio también');
AV_({ app: 'nequi', titulo: 'Envío de plata exitoso', texto: 'Te contamos que el envío de plata por $20.000 fue exitoso.', ts: T(20, 10) });
AV_({ app: 'falabella', titulo: '¡Transferencia recibida!', texto: 'HECTOR EJEMPLO te ha enviado $20.000,00 a tu cuenta. 2026-10-07. 20:10.', ts: T(20, 10) });
ok(A.movs().find(m => m[1] === 'Transferencia' && m[3] === 20000 && m[5] === 'Nequi' && m[6] === 'Falabella'), 'en auto, la transferencia propia se registra sola');
AV_({ app: 'nequi', titulo: 'Envío', texto: 'NURY EJEMPLO te envió 50000, ¡lo mejor!', ts: T(20, 20) });
ok(!A.movs().find(m => m[3] === 50000) && pend().some(x => x.monto === 50000), 'en auto, lo que envía otra persona sigue esperando tu decisión');
const m2 = nMov();
AV_({ app: 'sms', texto: 'DaviPlata: Pagaste  36,920 con tu Tarjeta Debito Digital. Recuerda tener saldo.', ts: T(20, 7) });
ok(nMov() === m2, 'el mismo aviso repetido en auto no duplica el movimiento');
// El mismo SMS reenviado por la macro (reintento) no crea otro aviso
ok(av().items.filter(x => x.monto === 36920).length === 1, 'un solo aviso de 36.920');

// 10b) La macro manda varias versiones del texto separadas por "||": se usa la que se entiende y no se duplica
const antesV = av().items.length;
r = AV_({ app: 'Nequi Colombia', titulo: 'Envío de plata exitoso', texto: '|| Te contamos que el envío de plata por $70.000 fue exitoso. Puedes revisar en tus movimientos. || Te contamos que el envío de plata por $70.000 fue exitoso. || ', ts: T(21, 30) });
ok(r.ok && av().items.length === antesV + 1 && pend().some(x => x.monto === 70000 && x.tipo === 'salida'), 'variantes con "||": ' + r.mensaje);
r = AV_({ app: 'Nequi Colombia', titulo: 'Compra exitosa', texto: 'Compra exitosa con Tarjeta Nequi || Compra exitosa con Tarjeta Nequi Pagaste 8.000,00 en TIENDA VARIANTE || Pagaste 8.000,00 en TIENDA VARIANTE', ts: T(21, 40) });
ok(av().items.some(x => x.monto === 8000 && x.quien === 'TIENDA VARIANTE'), 'variantes: el comercio no se ensucia con texto repetido: ' + r.mensaje + JSON.stringify(av().items.filter(x => x.monto === 8000)));
r = AV_({ app: 'sms', texto: 'Tu código es 123456 || otro texto sin monto', ts: T(21, 45) });
ok(/no es un movimiento/.test(r.mensaje), 'variantes sin movimiento se ignoran');

// 10c) Textos reales de la macro: sin tildes ni signos (se pierden en el envío) y con llaves alrededor
const sinT = (o) => AV.parse(Object.assign({ ts: T(22, 0) }, o));
let e1 = sinT({ app: 'nequi colombia', titulo: 'Envo de plata exitoso', texto: '{Te contamos que el envo de plata por $200 fue exitoso. Puedes revisar en tus movimientos el detalle del envo.}' });
ok(e1 && e1.tipo === 'salida' && e1.monto === 200 && e1.banco === 'nequi', 'Nequi envío sin tildes: ' + JSON.stringify(e1));
e1 = sinT({ app: 'banco falabella', titulo: 'Transferencia recibida!', texto: '{HECTOR te ha enviado $200,00 a tu cuenta. 2026-10-07. 20:07.}' });
ok(e1 && e1.tipo === 'entrada' && e1.monto === 200 && e1.persona === 'HECTOR', 'Falabella sin ¡ y con llaves: ' + JSON.stringify(e1));
e1 = sinT({ app: 'nequi colombia', titulo: 'Envo', texto: 'NURY PALACIOS te envi 700000, lo mejor!' });
ok(e1 && e1.tipo === 'entrada' && e1.monto === 700000 && e1.persona === 'NURY PALACIOS', 'Nequi recibido sin tildes: ' + JSON.stringify(e1));
e1 = sinT({ app: 'nequi colombia', titulo: 'Envío', texto: 'NURY PALACIOS te envió 700000, ¡lo mejor!' });
ok(e1 && e1.monto === 700000 && e1.persona === 'NURY PALACIOS', 'Nequi recibido con tildes sigue igual: ' + JSON.stringify(e1));
e1 = sinT({ app: 'nequi colombia', titulo: 'Compra exitosa', texto: '{Compra exitosa con Tarjeta Nequi Pagaste 12.480,00 en TIENDAS ARA}' });
ok(e1 && e1.comercio === 'TIENDAS ARA' && e1.monto === 12480, 'comercio sin llave final: ' + JSON.stringify(e1));

e1 = sinT({ app: 'billetera de google', titulo: 'TIENDAS ARA', texto: '{COP12,480 con Tarjeta Nequi Visa 4335}||{COP12,480 con Tarjeta Nequi Visa 4335}' });
ok(e1 && e1.banco === 'nequi' && e1.monto === 12480 && e1.comercio === 'TIENDAS ARA', 'Billetera de Google por la macro de bancos (sin •• por la codificación): ' + JSON.stringify(e1));

// 11) La hoja no guarda claves y el panel no revienta con datos raros
ok(!A.raro(D().avisos), 'sin NaN/undefined en el panel: ' + A.raro(D().avisos));
ok(!P({ accion: 'aviso', texto: '', titulo: '' }).ok, 'aviso vacío es un error');
// 12) "No reconocido": avisos de bancos que el lector no entiende pero parecen un movimiento quedan por confirmar con su texto
ok(AV.pareceMovimiento('DAVIbank: Pago recibido a tu tarjeta por $500.000') && AV.pareceMovimiento('DAVIbank: Pago recibido a tu tarjeta por $500.000').monto === 500000, 'parece movimiento: pago a tarjeta');
ok(!AV.pareceMovimiento('Tu código de verificación para pagar es 123456'), 'código: no es movimiento');
ok(!AV.pareceMovimiento('Aprovecha: 20% de descuento pagando con Nequi hasta $50.000'), 'promoción: no es movimiento');
ok(!AV.pareceMovimiento('Pago exitoso por PSE por $30.000'), 'PSE repetido: se sigue ignorando');
ok(!AV.pareceMovimiento('Tu cuota de Credifin por $120.000 vence'), 'Credifin: nunca');
let nr = AV_({ app: 'davibank', titulo: 'DAVIbank', texto: 'DAVIbank: Abono recibido a tu tarjeta por $480.000 el 2026/10/07', ts: T(22, 0) });
const nrIt = () => av().items.filter(x => x.tipo === 'noreconocido');
ok(/No reconocido/.test(nr.mensaje) && nrIt().length === 1 && nrIt()[0].monto === 480000 && nrIt()[0].estado === 'Pendiente' && /Abono recibido/.test(nrIt()[0].texto) && nrIt()[0].banco === 'davibank', 'no reconocido queda pendiente con su texto: ' + nr.mensaje + JSON.stringify(nrIt()));
nr = AV_({ app: 'sms', titulo: 'DAVIbank', texto: '{DAVIbank: Abono recibido a tu tarjeta por $480.000 el 2026/10/07}', ts: T(22, 1) });
ok(/repetido/.test(nr.mensaje) && nrIt().length === 1 && nrIt()[0].n === 2, 'no reconocido repetido no se duplica: ' + nr.mensaje);
const nMovNr = nMov();
nr = P({ accion: 'avisoresolver', id: nrIt()[0].id, como: 'gasto', datos: JSON.stringify({ descripcion: 'Prueba NR', cuenta: 'Nequi' }) }); A.tic();
ok(!nr.ok && /monto/.test(nr.mensaje) && nMov() === nMovNr, 'no reconocido exige el monto escrito: ' + nr.mensaje);
nr = P({ accion: 'avisoresolver', id: nrIt()[0].id, como: 'gasto', datos: JSON.stringify({ descripcion: 'Prueba NR', cuenta: 'Nequi', monto: 470000 }) }); A.tic();
ok(nr.ok && nMov() === nMovNr + 1 && A.movs().some(m => m[2] === 'Prueba NR' && Number(m[3]) === 470000) && nrIt()[0].estado === 'Registrado', 'no reconocido se registra con el monto que escribiste: ' + nr.mensaje);
ok(/no es un movimiento/.test(AV_({ app: 'nequi', texto: 'Nequi: tu clave dinámica es 445566', ts: T(22, 5) }).mensaje), 'clave dinámica sigue siendo ruido');
ok(!A.raro(D().avisos), 'sin NaN/undefined con no reconocidos');
// 13) Origen: MacroDroid (sin "origen") vs. lector de la app (origen=app); el mismo hecho por ambos queda "ambos"
ok(!av().comparacion, 'sin avisos de la app no hay comparación');
let o1 = AV_({ app: 'nequi colombia', titulo: 'Compra exitosa', texto: 'Compra exitosa con Tarjeta Nequi Pagaste 9.900,00 en TIENDA ORIGEN', ts: T(23, 0) });
o1 = AV_({ app: 'nequi colombia', titulo: 'Compra exitosa', texto: 'Compra exitosa con Tarjeta Nequi Pagaste 9.900,00 en TIENDA ORIGEN', ts: T(23, 0), origen: 'app' });
const oIt = av().items.find(x => x.quien === 'TIENDA ORIGEN');
ok(/repetido/.test(o1.mensaje) && oIt && oIt.origen === 'ambos', 'el mismo aviso por MacroDroid y por la app queda "ambos": ' + JSON.stringify(oIt));
AV_({ app: 'nequi colombia', titulo: 'Compra exitosa', texto: 'Compra exitosa con Tarjeta Nequi Pagaste 3.300,00 en SOLO APP', ts: T(23, 5), origen: 'app' });
const cmp = av().comparacion;
ok(cmp && cmp.ambos === 1 && cmp.app === 1 && cmp.macro === 0 && av().items.find(x => x.quien === 'SOLO APP').origen === 'app', 'comparación desde el primer aviso de la app: ' + JSON.stringify(cmp));
ok(A.sheets['Avisos'].grid[0][19] === 'Origen', 'la hoja tiene la columna Origen');
A.fin('avisos');
