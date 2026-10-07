// Auditoría 4: administración de cuentas y fijos desde la app.
const A = require('../base'); const { P, D, ok, raro } = A;
const cred = (d, n) => d.creditos.find(c => c.nombre === n);
const tot = d => ({ deudas: d.totalDeudas, plata: d.totalPlata, meDeben: d.totalMeDeben, previas: leerConfig().previas.length, fijos: leerConfig().fijos.length });
// 1) Cuenta con un nombre igual al encabezado de otra tabla de Configuración ("Crédito", "Persona", "Presupuesto"…)
['Crédito', 'Persona', 'Presupuesto'].forEach(nom => {
  A.fresco(); A.reloj(2026, 8, 30, 11);
  const antes = tot(D());
  const r = P({ accion: 'cuentaadmin', op: 'guardar', nombre: nom, tipo: 'Deuda', modo: 'Por compra', tasa: '2', maxCuotas: '12', pideValor: 'si', saldo: '0' }); A.tic();
  const d = D(), desp = tot(d);
  console.log('cuenta "' + nom + '": ' + r.mensaje + ' → antes ' + JSON.stringify(antes) + ' después ' + JSON.stringify(desp) + ' · presupuestos ' + JSON.stringify(leerConfig().presupuestos));
  ok(JSON.stringify(antes) === JSON.stringify(desp) && Object.keys(leerConfig().presupuestos).length === 1, 'crear la cuenta "' + nom + '" rompe la lectura de Configuración: ' + JSON.stringify(antes) + ' → ' + JSON.stringify(desp));
  ok(!raro(d), 'NaN tras cuenta ' + nom);
});
// 2) Editar TC Davibank desde la app (la app exige un número en "Día de corte"; la hoja tenía "Tabla")
A.fresco(); A.reloj(2026, 8, 30, 11);
let d = D(); const cal0 = cred(d, 'TC Davibank').calendario.slice(0, 3).map(g => g.fecha + ' ' + g.monto);
const cfgDav = d.cuentasCfg.find(c => c.nombre === 'TC Davibank'); console.log('Davibank en cuentasCfg: diaCorte', cfgDav.diaCorte, 'diaPago', cfgDav.diaPago, 'tasa', cfgDav.tasa);
// lo que mandaría admin.js si el usuario solo cambia el cupo (y escribe 18/7 porque "Tabla" no pasa la validación)
P({ accion: 'cuentaadmin', op: 'guardar', nombre: 'TC Davibank', tipo: 'Deuda', color: '#0B0B0B', saldo: 0, cupo: '5000000', maxCuotas: 36, tasa: '2.13', modo: 'Corte mensual', pideValor: 'no', diaCorte: 18, diaPago: 7, mesPago: 'Siguiente', interesDesde1: 'si', unaSinInteres: 'si' }); A.tic();
d = D(); const cal1 = cred(d, 'TC Davibank').calendario.slice(0, 3).map(g => g.fecha + ' ' + g.monto);
console.log('Davibank antes:', cal0.join(' | '), '\nDavibank después de editar el cupo:', cal1.join(' | '), '· diaCorte ahora', leerConfig().cuentas.find(c => c.nombre === 'TC Davibank').diaCorte);
ok(cal0.join() === cal1.join(), 'editar TC Davibank desde la app reemplaza "Tabla" por un día fijo y mueve todo su calendario');
// enviar diaCorte:'Tabla' directamente
P({ accion: 'cuentaadmin', op: 'guardar', nombre: 'TC Davibank', tipo: 'Deuda', cupo: '5000000', tasa: '2.13', modo: 'Corte mensual', pideValor: 'no', diaCorte: 'Tabla', diaPago: 'Tabla', interesDesde1: 'si', unaSinInteres: 'si' }); A.tic();
console.log('con diaCorte "Tabla" → queda', leerConfig().cuentas.find(c => c.nombre === 'TC Davibank').diaCorte);
ok(String(leerConfig().cuentas.find(c => c.nombre === 'TC Davibank').diaCorte).toLowerCase() === 'tabla', 'guardar con diaCorte "Tabla" lo convierte en ' + leerConfig().cuentas.find(c => c.nombre === 'TC Davibank').diaCorte);
// Editar Credifin (Por compra) sin mandar cargo inicial / tasa: ¿se conserva?
const cf0 = leerConfig().cuentas.find(c => c.nombre === 'Credifin');
P({ accion: 'cuentaadmin', op: 'guardar', nombre: 'Credifin', tipo: 'Deuda', modo: 'Por compra', pideValor: 'si', maxCuotas: 6, tasa: String(cf0.tasa * 100), cupo: '500000' }); A.tic();
const cf1 = leerConfig().cuentas.find(c => c.nombre === 'Credifin');
console.log('Credifin tasa', cf0.tasa, '→', cf1.tasa, '· cargo', cf0.cargo, '→', cf1.cargo);
ok(Math.abs(cf0.tasa - cf1.tasa) < 1e-9, 'editar Credifin cambia su tasa de ' + cf0.tasa + ' a ' + cf1.tasa + ' (redondeo de la app o del backend)');
// 3) Archivar una cuenta que usa un fijo automático
A.fresco(); A.reloj(2026, 8, 30, 11);
P({ accion: 'cuentaadmin', op: 'guardar', nombre: 'Bancolombia', tipo: 'Plata', saldo: '0' }); A.tic();
P({ accion: 'fijoadmin', op: 'guardar', nombre: 'Seguro moto', valor: '50000', frecuencia: 'Mensual', dia: '5', categoria: 'Otros', cuenta: 'Bancolombia', cobro: 'Automático' }); A.tic();
let r = P({ accion: 'cuentaadmin', op: 'archivar', nombre: 'Bancolombia' }); console.log('archivar Bancolombia con fijo automático:', r.mensaje);
A.reloj(2026, 9, 6, 9); d = D();
const banc = d.cuentas.find(c => c.nombre === 'Bancolombia');
console.log('6 oct: Bancolombia (archivada) →', banc ? banc.saldo + ' activa=' + banc.activa : 'oculta', '· cobros del seguro', d.movimientos.filter(m => m.desc === 'Seguro moto').length);
ok(!(r.ok && d.movimientos.some(m => m.desc === 'Seguro moto')), 'se pudo archivar una cuenta con un fijo automático activo y el fijo la sigue cobrando (reaparece con saldo ' + (banc && banc.saldo) + ')');
// 4) Cuentas cuyo nombre difiere solo en mayúsculas (desde el backend, sin la validación de la app)
r = P({ accion: 'cuentaadmin', op: 'guardar', nombre: 'NEQUI', tipo: 'Plata', saldo: '1000' }); A.tic();
console.log('crear "NEQUI":', r.mensaje);
ok(!r.ok, 'el backend acepta "NEQUI" como cuenta distinta de "Nequi"');
// 5) Fijo con ":" en el nombre (el id usa ":" como separador)
A.fresco(); A.reloj(2026, 8, 30, 11);
P({ accion: 'fijoadmin', op: 'guardar', nombre: 'Plan: datos', valor: '30000', frecuencia: 'Mensual', dia: '2', categoria: 'Servicios públicos', cuenta: 'Nequi', cobro: 'Automático' }); A.tic();
A.reloj(2026, 9, 3, 9); d = D(); const mv = d.movimientos.find(m => m.desc === 'Plan: datos');
ok(mv && mv.fijo === 'Plan: datos', 'fijo con ":" en el nombre no queda enlazado en el historial (fijo="' + (mv && mv.fijo) + '")');
// 6) Nombre de cuenta que empieza por "▸" (marca de sección)
A.fresco(); A.reloj(2026, 8, 30, 11);
P({ accion: 'cuentaadmin', op: 'guardar', nombre: '▸ Ahorro', tipo: 'Plata', saldo: '5000' }); A.tic();
P({ accion: 'cuentaadmin', op: 'guardar', nombre: 'Lulo', tipo: 'Plata', saldo: '7000' }); A.tic();
d = D(); console.log('tras "▸ Ahorro" y "Lulo": cuentas', d.cuentas.map(c => c.nombre).join(', '));
ok(d.cuentas.some(c => c.nombre === 'Lulo'), 'una cuenta llamada "▸ Ahorro" corta la tabla: las siguientes (Lulo) desaparecen');
A.fin('audit_admin');
