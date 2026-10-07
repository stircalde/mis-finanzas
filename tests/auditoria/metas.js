// Metas de ahorro: ligadas a una cuenta de plata (bolsillo); progreso = saldo de la cuenta; foto opcional; quitar no toca la cuenta.
const A = require('../base'); const { P, D, ok } = A;
A.fresco(); A.reloj(2026, 9, 1, 11);
const meta = (n) => (D().metas || []).find(x => x.nombre === n);
const M = (o) => P(Object.assign({ accion: 'metaadmin' }, o));
const saldo = (n) => D().cuentasCfg.find(c => c.nombre === n).saldo;

ok(Array.isArray(D().metas) && D().metas.length === 0, 'sin metas al empezar');
// 1) Crear con bolsillo nuevo
let r = M({ op: 'guardar', anterior: '', nombre: 'Viaje', emoji: '✈️', objetivo: '1200000', fecha: '2026-12-31', cuentaNueva: 'Bolsillo Viaje', principal: 'Nequi' }); A.tic();
ok(r.ok && meta('Viaje') && meta('Viaje').objetivo === 1200000 && meta('Viaje').cuenta === 'Bolsillo Viaje', 'crea la meta con bolsillo nuevo: ' + r.mensaje);
ok(D().cuentasCfg.some(c => c.nombre === 'Bolsillo Viaje' && c.tipo === 'Plata'), 'el bolsillo existe como cuenta de plata');
ok(meta('Viaje').ahorrado === 0 && meta('Viaje').pct === 0 && meta('Viaje').falta === 1200000, 'empieza en cero');
ok(meta('Viaje').mensual > 0 && meta('Viaje').dias > 0, 'calcula cuánto ahorrar al mes: ' + meta('Viaje').mensual);
// 2) Aportar = mover plata al bolsillo
r = P({ accion: 'transferencia', desde: 'Nequi', hacia: 'Bolsillo Viaje', monto: '300000' }); A.tic();
ok(r.ok && meta('Viaje').ahorrado === 300000 && meta('Viaje').pct === 25, 'aportar sube el progreso: ' + meta('Viaje').ahorrado + ' ' + meta('Viaje').pct + '%');
ok(meta('Viaje').falta === 900000, 'falta el resto');
// 3) Validaciones
r = M({ op: 'guardar', anterior: '', nombre: 'Casa', objetivo: '100000', cuentaNueva: 'Bolsillo Casa' }); ok(!r.ok, 'el bolsillo nuevo necesita la cuenta de la que nace');
r = M({ op: 'guardar', anterior: '', nombre: 'Casa', objetivo: '100000', cuentaNueva: 'Bolsillo Casa', principal: 'TC Nubank' }); ok(!r.ok, 'el bolsillo no puede nacer de una tarjeta');
ok(meta('Viaje').principal === 'Nequi', 'la meta sabe de qué cuenta nace el bolsillo');
r = M({ op: 'guardar', anterior: '', nombre: 'Viaje', objetivo: '100', cuentaNueva: 'Otro', principal: 'Nequi' }); ok(!r.ok && /Ya tienes una meta/.test(r.mensaje), 'no repite nombre');
r = M({ op: 'guardar', anterior: '', nombre: 'Carro', objetivo: '0', cuentaNueva: 'Bolsillo Carro', principal: 'Nequi' }); ok(!r.ok, 'objetivo en cero no sirve');
r = M({ op: 'guardar', anterior: '', nombre: 'Carro', objetivo: '5000000', fecha: '2026-01-01', cuentaNueva: 'Bolsillo Carro', principal: 'Nequi' }); ok(!r.ok && /pasada/.test(r.mensaje), 'fecha pasada no sirve');
r = M({ op: 'guardar', anterior: '', nombre: 'Carro', objetivo: '5000000', cuenta: 'Bolsillo Viaje' }); ok(!r.ok && /ya es el bolsillo/.test(r.mensaje), 'una cuenta solo sirve a una meta: ' + r.mensaje);
r = M({ op: 'guardar', anterior: '', nombre: 'Carro', objetivo: '5000000', cuenta: 'TC Nubank' }); ok(!r.ok, 'una tarjeta no es bolsillo');
r = M({ op: 'guardar', anterior: '', nombre: 'Carro', objetivo: '5000000', cuenta: 'Bolsillo para la tarjeta' }); ok(!r.ok, 'el bolsillo de una tarjeta no sirve para metas');
r = M({ op: 'guardar', anterior: '', nombre: 'Carro', objetivo: '5000000', cuenta: 'No existe' }); ok(!r.ok, 'cuenta inexistente');
r = M({ op: 'guardar', anterior: '', nombre: 'Meta', objetivo: '5000000', cuentaNueva: 'Bolsillo X', principal: 'Nequi' }); ok(!r.ok, 'nombre reservado');
// 4) Con una cuenta que ya tienes
r = M({ op: 'guardar', anterior: '', nombre: 'Colchón', emoji: '🛟', objetivo: '500000', cuenta: 'Efectivo' }); A.tic();
ok(r.ok && meta('Colchón') && meta('Colchón').cuenta === 'Efectivo' && meta('Colchón').fecha === '', 'meta con cuenta existente y sin fecha');
// 5) Foto
const jpg = 'data:image/jpeg;base64,' + 'A'.repeat(2000);
r = M({ op: 'guardar', anterior: 'Viaje', nombre: 'Viaje', objetivo: '1200000', fecha: '2026-12-31', cuenta: 'Bolsillo Viaje', foto: jpg }); A.tic();
ok(r.ok && meta('Viaje').foto === jpg, 'guarda la foto');
r = M({ op: 'guardar', anterior: 'Viaje', nombre: 'Viaje', objetivo: '1300000', fecha: '2026-12-31', cuenta: 'Bolsillo Viaje' }); A.tic();
ok(r.ok && meta('Viaje').objetivo === 1300000 && meta('Viaje').foto === jpg, 'editar sin foto la conserva');
r = M({ op: 'guardar', anterior: 'Viaje', nombre: 'Viaje', objetivo: '1300000', cuenta: 'Bolsillo Viaje', foto: 'http://x.com/a.png' }); ok(!r.ok, 'solo acepta fotos jpeg incrustadas');
r = M({ op: 'guardar', anterior: 'Viaje', nombre: 'Viaje', objetivo: '1300000', cuenta: 'Bolsillo Viaje', foto: 'data:image/jpeg;base64,' + 'A'.repeat(50000) }); ok(!r.ok, 'rechaza fotos muy pesadas');
r = M({ op: 'guardar', anterior: 'Viaje', nombre: 'Viaje', objetivo: '1300000', fecha: '2026-12-31', cuenta: 'Bolsillo Viaje', foto: '' }); A.tic();
ok(r.ok && meta('Viaje').foto === '', 'quita la foto');
// 6) Renombrar
r = M({ op: 'guardar', anterior: 'Viaje', nombre: 'Viaje a Cartagena', objetivo: '1300000', fecha: '2026-12-31', cuenta: 'Bolsillo Viaje' }); A.tic();
ok(r.ok && meta('Viaje a Cartagena') && !meta('Viaje') && meta('Viaje a Cartagena').ahorrado === 300000, 'renombrar conserva cuenta y progreso: ' + r.mensaje);
// 7) Lograda
P({ accion: 'transferencia', desde: 'Nequi', hacia: 'Bolsillo Viaje', monto: '1000000' }); A.tic();
ok(meta('Viaje a Cartagena').lograda && meta('Viaje a Cartagena').pct === 100 && meta('Viaje a Cartagena').mensual === 0, 'meta lograda');
// 8) Quitar una meta con bolsillo propio: la plata vuelve a la cuenta de origen y el bolsillo se archiva
const nMovs = A.movs().length, sNeq = saldo('Nequi'), sBols = saldo('Bolsillo Viaje');
ok(sBols === 1300000, 'el bolsillo tiene su plata antes de quitar: ' + sBols);
r = M({ op: 'quitar', nombre: 'Viaje a Cartagena' }); A.tic();
ok(r.ok && !meta('Viaje a Cartagena') && meta('Colchón'), 'quitar solo quita esa meta: ' + r.mensaje);
ok(saldo('Nequi') === sNeq + sBols && saldo('Bolsillo Viaje') === 0, 'la plata del bolsillo volvió a Nequi: ' + saldo('Nequi'));
ok(A.movs().length === nMovs + 1, 'queda un solo movimiento de traslado');
ok(D().cuentasCfg.find(c => c.nombre === 'Bolsillo Viaje').activa === false, 'el bolsillo quedó archivado');
r = M({ op: 'quitar', nombre: 'Viaje a Cartagena' }); ok(!r.ok, 'quitar algo que no existe falla');
// 9) Quitar una meta con cuenta que ya existía: no mueve ni archiva nada
const sEf = saldo('Efectivo'), nM2 = A.movs().length;
r = M({ op: 'quitar', nombre: 'Colchón' }); A.tic();
ok(r.ok && saldo('Efectivo') === sEf && A.movs().length === nM2, 'una cuenta que ya existía queda igual');
ok(D().cuentasCfg.find(c => c.nombre === 'Efectivo').activa === true, 'Efectivo sigue activa');
// 10) La cuenta archivada ya no sirve para otra meta
r = M({ op: 'guardar', anterior: '', nombre: 'Otro viaje', objetivo: '900000', cuenta: 'Bolsillo Viaje' }); ok(!r.ok, 'un bolsillo archivado no sirve');
// 11) Bolsillo vacío: se archiva sin movimientos
r = M({ op: 'guardar', anterior: '', nombre: 'Casa', objetivo: '100000', cuentaNueva: 'Bolsillo Casa', principal: 'Daviplata' }); A.tic();
const nM3 = A.movs().length;
r = M({ op: 'quitar', nombre: 'Casa' }); A.tic();
ok(r.ok && A.movs().length === nM3 && D().cuentasCfg.find(c => c.nombre === 'Bolsillo Casa').activa === false, 'bolsillo en $0: solo se archiva');
A.fin();
