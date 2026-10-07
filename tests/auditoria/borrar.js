// Eliminar movimientos (vista previa, doble confirmación, filas ligadas, deshacer) y editar "para quién".
const A = require('../base'); const { P, D, ok } = A;
A.fresco(); A.reloj(2026, 8, 30, 11);
const cfg = P({ accion: 'config' }).config;
const saldo = (n) => (D().cuentas.find(c => c.nombre === n) || {}).saldo;
const extra = (o) => JSON.parse(doPost({ parameter: Object.assign({ clave: 'prueba' }, o) }).s);
const mov = (desc) => D().movimientos.find(m => m.desc === desc);
const filas = () => A.movs().length;

// 1) Borrar un gasto simple: pide ELIMINAR, devuelve la plata y queda en "Eliminados".
P({ accion: 'gasto', descripcion: 'Gasto a borrar', monto: '20000', cuenta: 'Nequi', fecha: '2026-09-29' }); A.tic();
const n0 = filas(), s0 = saldo('Nequi'), m = mov('Gasto a borrar');
let r = extra({ accion: 'previsualizarborrado', id: m.id });
ok(r.ok && r.extra.movimientos.length === 1 && r.extra.efectos.some(e => e.cuenta === 'Nequi' && e.despues === e.antes + 20000), 'vista previa de un gasto simple: ' + JSON.stringify(r.extra));
ok(filas() === n0, 'la vista previa no debe borrar nada');
ok(!P({ accion: 'borrarmov', id: m.id }).ok && !P({ accion: 'borrarmov', id: m.id, confirmo: 'eliminar' }).ok && filas() === n0, 'sin la palabra ELIMINAR no se borra');
r = extra({ accion: 'borrarmov', id: m.id, confirmo: 'ELIMINAR' }); A.tic();
ok(r.ok && filas() === n0 - 1 && saldo('Nequi') === s0 + 20000, 'borrado: ' + r.mensaje);
const elim = A.sheets['Eliminados'];
ok(elim && elim.grid.length === 2 && elim.grid[1][2] === 'Gasto a borrar', 'debe quedar copia en Eliminados');
// Deshacer
r = P({ accion: 'restaurarmov', lote: r.extra.lote }); A.tic();
ok(r.ok && filas() === n0 && saldo('Nequi') === s0 && A.sheets['Eliminados'].grid.length === 1, 'restaurar: ' + r.mensaje);
ok(!P({ accion: 'restaurarmov', lote: 'noexiste' }).ok, 'lote inexistente debe fallar');

// 2) Filas ligadas: compra con apartado para la tarjeta se borra junta.
const tc = cfg.deudas.find(x => x.bolsillo);
if (tc) {
  const bol = tc.bolsillo, desde = tc.desde || 'Daviplata';
  const sb = saldo(bol), sd = saldo(desde);
  P({ accion: 'gasto', descripcion: 'Compra con apartado', monto: '100000', cuenta: tc.n, cuotas: '1', apartar: 'si', fecha: '2026-09-29', rid: 'ridtest' + A.sheets.Movimientos.grid.length }); A.tic();
  const c = mov('Compra con apartado');
  const ap = D().movimientos.filter(x => /^Apartado para/.test(x.desc) && x.fecha === '2026-09-29');
  ok(ap.length >= 1, 'debe existir el apartado ligado');
  r = extra({ accion: 'previsualizarborrado', id: c.id });
  ok(r.extra.movimientos.length >= 2, 'la vista previa debe incluir el apartado: ' + r.extra.movimientos.map(x => x.desc));
  r = extra({ accion: 'borrarmov', id: c.id, confirmo: 'ELIMINAR' }); A.tic();
  ok(r.ok && !mov('Compra con apartado') && D().movimientos.filter(x => /^Apartado para/.test(x.desc) && x.fecha === '2026-09-29').length === 0, 'compra y apartado se borran juntos: ' + r.mensaje);
  ok(saldo(bol) === sb && saldo(desde) === sd, 'el bolsillo y la cuenta de origen vuelven a como estaban: ' + saldo(bol) + '/' + sb + ' ' + saldo(desde) + '/' + sd);
  // Si el bolsillo ya se usó (un pago sacó la plata), avisa y propone reponer.
  P({ accion: 'gasto', descripcion: 'Compra usada', monto: '100000', cuenta: tc.n, cuotas: '1', apartar: 'si', fecha: '2026-09-29', rid: 'ridtest' + A.sheets.Movimientos.grid.length }); A.tic();
  const usada = mov('Compra usada');
  P({ accion: 'transferencia', desde: bol, hacia: tc.n, monto: '100000', fecha: '2026-09-30' }); A.tic();
  r = extra({ accion: 'previsualizarborrado', id: usada.id });
  ok(r.extra.avisos.some(a => /bolsillo/i.test(a)) && r.extra.mover && r.extra.mover.monto > 0, 'bolsillo usado: debe avisar y proponer mover: ' + JSON.stringify(r.extra.avisos) + JSON.stringify(r.extra.mover));
}

// 3) Los históricos prevalecen; id inexistente falla.
ok(!P({ accion: 'previsualizarborrado', id: 'hist:1' }).ok && !P({ accion: 'borrarmov', id: 'hist:1', confirmo: 'ELIMINAR' }).ok, 'un histórico no se elimina');
ok(!P({ accion: 'previsualizarborrado', id: 'no-existe' }).ok, 'id inexistente falla');

// 4) Editar "para quién": a una persona, compartido y volver a mío.
P({ accion: 'gasto', descripcion: 'Mercado compartido', monto: '90000', cuenta: 'Nequi', fecha: '2026-09-29' }); A.tic();
const g = mov('Mercado compartido');
r = P({ accion: 'editarmov', id: g.id, para: 'Alexandra' }); A.tic();
ok(r.ok && D().meDeben.some(x => x.persona === 'Alexandra' && x.saldo >= 90000), 'para una persona: ' + r.mensaje);
r = P({ accion: 'editarmov', id: g.id, para: 'Alexandra:30000; Majo:20000' }); A.tic();
const dd = D();
ok(r.ok && dd.meDeben.some(x => x.persona === 'Majo' && x.saldo >= 20000), 'compartido: ' + r.mensaje);
ok(!P({ accion: 'editarmov', id: g.id, para: 'Alexandra:80000; Majo:20000' }).ok, 'lo repartido no puede superar el monto');
r = P({ accion: 'editarmov', id: g.id, para: '' }); A.tic();
ok(r.ok && !D().meDeben.some(x => x.persona === 'Majo' && x.saldo >= 20000), 'volver a "para mí": ' + r.mensaje);
const t = P({ accion: 'transferencia', desde: 'Nequi', hacia: 'Daviplata', monto: '1000' }); A.tic();
ok(!P({ accion: 'editarmov', id: D().movimientos.find(x => x.tipo === 'Transferencia').id, para: 'X' }).ok, 'una transferencia no tiene "para quién"');

// 5) Un ajuste sí se puede eliminar (deshacer un ajuste mal hecho).
P({ accion: 'ajuste', cuenta: 'Nequi', saldoReal: '5555', fecha: '2026-09-29' }); A.tic();
const aj = D().movimientos.find(x => x.tipo === 'Ajuste');
r = extra({ accion: 'borrarmov', id: aj.id, confirmo: 'ELIMINAR' });
ok(r.ok && !D().movimientos.some(x => x.tipo === 'Ajuste'), 'un ajuste se puede eliminar: ' + r.mensaje);
A.fin('borrar');
