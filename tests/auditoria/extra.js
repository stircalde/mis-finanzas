// Auditoría 7: casos puntuales encontrados leyendo el código.
const A = require('../base'); const { P, D, ok, raro } = A;
// 1) Quitar un fijo automático y luego "guardarlo" de nuevo (p. ej. volverlo a crear con el mismo nombre) → ¿cobra lo que no se cobró mientras estaba quitado?
A.fresco(); A.reloj(2026, 9, 1, 9);
P({ accion: 'fijoadmin', op: 'quitar', nombre: 'Gimnasio' });                       // Gimnasio: día 18, automático, Nequi
A.reloj(2026, 9, 25, 9); let d = D(); ok(!d.movimientos.some(m => m.desc === 'Gimnasio'), 'Gimnasio se cobró estando quitado');
let r = P({ accion: 'fijoadmin', op: 'guardar', nombre: 'Gimnasio', valor: '130000', frecuencia: 'Mensual', dia: '18', categoria: 'Gimnasio y suplementos', cuenta: 'Nequi', cobro: 'Automático' });
d = D(); const sf = d.movimientos.filter(m => m.desc === 'Gimnasio');
console.log('guardar Gimnasio (estaba quitado) el 25-oct →', r.mensaje, '· cobros:', sf.map(m => m.fecha + ' ' + m.monto).join(', ') || 'ninguno');
ok(!sf.some(m => m.fecha === '2026-10-18'), '"guardar" un fijo quitado lo reactiva sin mover "Desde" y cobra hacia atrás el 18-oct (' + (sf[0] && sf[0].monto) + ')');
// 2) Fijo "Una vez" ya pagado al que se le pone una nueva fecha (otro cobro único)
A.fresco(); A.reloj(2026, 9, 18, 9);
P({ accion: 'fijo', fijo: 'Prueba gratis', monto: '24490', cuenta: 'Nequi' });
P({ accion: 'fijoadmin', op: 'guardar', nombre: 'Prueba gratis', valor: '24490', frecuencia: 'Una vez', proximo: '2026-11-20', categoria: 'Suscripciones', cuenta: 'Nequi', cobro: 'Manual', aviso: 'Cancelar' });
A.reloj(2026, 10, 15, 9); d = D(); const rp = d.proximos.find(p => p.nombre === 'Prueba gratis');
console.log('Prueba gratis con nueva fecha única 2026-11-20 →', rp && rp.fecha + ' ' + rp.estado);
ok(!rp || rp.estado !== 'pagado', 'un fijo "Una vez" reprogramado aparece como ya pagado (el id "unica" del cobro anterior lo tapa)');
// 3) Carrera: recordatorioDiario (sin LockService) y un doPost el mismo minuto registran el mismo fijo automático
A.fresco(); A.reloj(2026, 9, 18, 7);
CACHE_MOVS_ = null; const viejo = leerMovimientos();                   // la ejecución del disparador leyó la hoja…
P({ accion: 'config' });                                             // …mientras el celular hacía un doPost (registra Gimnasio del 18)
CACHE_MOVS_ = viejo; CACHE_CFG_ = null;                                // el disparador sigue con su lectura vieja
registrarFijosAutomaticos(leerConfig());
const dup = A.movs().filter(r => String(r[12]) === 'fijo:Gimnasio:2026-10').length;
console.log('filas "fijo:Gimnasio:2026-10" tras la carrera simulada:', dup);
ok(dup === 1, 'carrera recordatorioDiario/doPost duplica el fijo automático (' + dup + ' filas): recordatorioDiario no toma el LockService');
// 4) Cuenta de plata creada y usada: "Saldo a la fecha" vs "Registrado el" en el mismo instante
A.fresco(); A.reloj(2026, 9, 2, 10);
P({ accion: 'cuentaadmin', op: 'guardar', nombre: 'Lulo', tipo: 'Plata', saldo: '100000' });
P({ accion: 'gasto', descripcion: 'Mismo instante', monto: '30000', cuenta: 'Lulo' });   // mismo milisegundo en el mock
d = D(); const lulo = d.cuentas.find(c => c.nombre === 'Lulo');
console.log('Lulo creada con 100.000 y gasto de 30.000 en el mismo instante → saldo', lulo.saldo);
ok(lulo.saldo === 70000, 'un movimiento con "Registrado el" igual a "Saldo a la fecha" no cuenta (comparación estricta >): saldo ' + lulo.saldo);
// 5) Editar una cuenta archivada la reactiva sin avisar
A.fresco(); A.reloj(2026, 9, 2, 10);
P({ accion: 'cuentaadmin', op: 'archivar', nombre: 'Efectivo' }); A.tic();
P({ accion: 'cuentaadmin', op: 'guardar', nombre: 'Efectivo', tipo: 'Plata', color: '#112233' });
ok(!leerConfig().cuentas.find(c => c.nombre === 'Efectivo').activa, 'editar el color de una cuenta archivada la reactiva');
ok(!raro(D()), 'NaN');
A.fin('audit_extra');
