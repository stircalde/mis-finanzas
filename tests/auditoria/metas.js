// Metas de ahorro: ligadas a una cuenta de plata (bolsillo); progreso = saldo de la cuenta; foto opcional; quitar no toca la cuenta.
const A = require('../base'); const { P, D, ok } = A;
A.fresco(); A.reloj(2026, 9, 1, 11);
const meta = (n) => (D().metas || []).find(x => x.nombre === n);
const M = (o) => P(Object.assign({ accion: 'metaadmin' }, o));
const saldo = (n) => D().cuentasCfg.find(c => c.nombre === n).saldo;

ok(Array.isArray(D().metas) && D().metas.length === 0, 'sin metas al empezar');
// 1) Crear con bolsillo nuevo
let r = M({ op: 'guardar', anterior: '', nombre: 'Viaje', emoji: '✈️', objetivo: '1200000', fecha: '2026-12-31', cuentaNueva: 'Bolsillo Viaje' }); A.tic();
ok(r.ok && meta('Viaje') && meta('Viaje').objetivo === 1200000 && meta('Viaje').cuenta === 'Bolsillo Viaje', 'crea la meta con bolsillo nuevo: ' + r.mensaje);
ok(D().cuentasCfg.some(c => c.nombre === 'Bolsillo Viaje' && c.tipo === 'Plata'), 'el bolsillo existe como cuenta de plata');
ok(meta('Viaje').ahorrado === 0 && meta('Viaje').pct === 0 && meta('Viaje').falta === 1200000, 'empieza en cero');
ok(meta('Viaje').mensual > 0 && meta('Viaje').dias > 0, 'calcula cuánto ahorrar al mes: ' + meta('Viaje').mensual);
// 2) Aportar = mover plata al bolsillo
r = P({ accion: 'transferencia', desde: 'Nequi', hacia: 'Bolsillo Viaje', monto: '300000' }); A.tic();
ok(r.ok && meta('Viaje').ahorrado === 300000 && meta('Viaje').pct === 25, 'aportar sube el progreso: ' + meta('Viaje').ahorrado + ' ' + meta('Viaje').pct + '%');
ok(meta('Viaje').falta === 900000, 'falta el resto');
// 3) Validaciones
r = M({ op: 'guardar', anterior: '', nombre: 'Viaje', objetivo: '100', cuentaNueva: 'Otro' }); ok(!r.ok && /Ya tienes una meta/.test(r.mensaje), 'no repite nombre');
r = M({ op: 'guardar', anterior: '', nombre: 'Carro', objetivo: '0', cuentaNueva: 'Bolsillo Carro' }); ok(!r.ok, 'objetivo en cero no sirve');
r = M({ op: 'guardar', anterior: '', nombre: 'Carro', objetivo: '5000000', fecha: '2026-01-01', cuentaNueva: 'Bolsillo Carro' }); ok(!r.ok && /pasada/.test(r.mensaje), 'fecha pasada no sirve');
r = M({ op: 'guardar', anterior: '', nombre: 'Carro', objetivo: '5000000', cuenta: 'Bolsillo Viaje' }); ok(!r.ok && /ya es el bolsillo/.test(r.mensaje), 'una cuenta solo sirve a una meta: ' + r.mensaje);
r = M({ op: 'guardar', anterior: '', nombre: 'Carro', objetivo: '5000000', cuenta: 'TC Nubank' }); ok(!r.ok, 'una tarjeta no es bolsillo');
r = M({ op: 'guardar', anterior: '', nombre: 'Carro', objetivo: '5000000', cuenta: 'Bolsillo para la tarjeta' }); ok(!r.ok, 'el bolsillo de una tarjeta no sirve para metas');
r = M({ op: 'guardar', anterior: '', nombre: 'Carro', objetivo: '5000000', cuenta: 'No existe' }); ok(!r.ok, 'cuenta inexistente');
r = M({ op: 'guardar', anterior: '', nombre: 'Meta', objetivo: '5000000', cuentaNueva: 'Bolsillo X' }); ok(!r.ok, 'nombre reservado');
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
// 8) Quitar no toca la plata
const nMovs = A.movs().length, sBols = saldo('Bolsillo Viaje');
r = M({ op: 'quitar', nombre: 'Viaje a Cartagena' }); A.tic();
ok(r.ok && !meta('Viaje a Cartagena') && meta('Colchón'), 'quitar solo quita esa meta');
ok(A.movs().length === nMovs && saldo('Bolsillo Viaje') === sBols, 'quitar no toca movimientos ni saldos');
r = M({ op: 'quitar', nombre: 'Viaje a Cartagena' }); ok(!r.ok, 'quitar algo que no existe falla');
// 9) Se puede reutilizar la cuenta después de quitar la meta
r = M({ op: 'guardar', anterior: '', nombre: 'Otro viaje', objetivo: '900000', cuenta: 'Bolsillo Viaje' }); A.tic();
ok(r.ok && meta('Otro viaje'), 'la cuenta queda libre al quitar la meta');
A.fin();
