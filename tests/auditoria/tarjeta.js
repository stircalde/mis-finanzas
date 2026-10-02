// Auditoría 2: modelo de intereses de tarjeta. Una compra a 3 cuotas, pagando exactamente lo que el tablero dice.
// Caso A: pagas cada "próximo" tal cual. Caso B: además cuadras con el extracto (ajuste) antes de pagar.
const A = require('../base'); const { P, D, ok, raro } = A;
function correr(conAjuste, desde1) {
  A.fresco(); A.reloj(2026, 8, 30, 11);
  const nombre = 'TC Prueba';
  P({ accion: 'cuentaadmin', op: 'guardar', nombre, tipo: 'Deuda', modo: 'Corte mensual', diaCorte: '15', diaPago: '5', mesPago: 'Siguiente',
    tasa: '2', cupo: '5000000', maxCuotas: '36', interesDesde1: desde1 ? 'si' : 'no', saldo: '0' });
  A.reloj(2026, 9, 1, 12);
  const r = P({ accion: 'gasto', descripcion: 'Compra 3 cuotas', monto: '300000', cuenta: nombre, cuotas: '3', categoria: 'Otros' });
  const cr = () => D().creditos.find(c => c.nombre === nombre);
  const plan0 = cr().planes[0]; const esperadas = plan0.detalle.map(x => x.monto);
  const log = ['compra: ' + r.mensaje.split('\n')[0], 'cuotas según el plan: ' + esperadas.join(' / ') + ' = ' + esperadas.reduce((a, b) => a + b, 0)];
  let pagado = 0, capitalReal = 300000, i = 0;
  for (let dia = new Date(2026, 9, 2); dia < new Date(2027, 1, 28); dia.setDate(dia.getDate() + 1)) {
    A.reloj(dia.getFullYear(), dia.getMonth(), dia.getDate(), 12);
    let c = cr();
    // Caso B: el día del corte (15), el banco factura la cuota con sus intereses → la deuda real = capital que falta + intereses facturados.
    if (conAjuste && dia.getDate() === 16 && i < 3) {
      const intFact = esperadas[i] - 100000;
      if (intFact > 0) { A.tic(); const ra = P({ accion: 'ajuste', cuenta: nombre, saldoReal: String(capitalReal + intFact) }); log.push(fmt(dia) + ' ajuste al extracto ' + (capitalReal + intFact) + ' → ' + ra.mensaje.replace(/\n/g, ' ')); c = cr(); log.push('   próximo ahora: ' + (c.proximo && c.proximo.fecha + ' ' + c.proximo.monto)); }
    }
    if (c.proximo && c.proximo.dias === 0) {
      A.tic(); P({ accion: 'pagocredito', credito: nombre, monto: String(c.proximo.monto), origen: 'cuenta', cuenta: 'Nequi' });
      pagado += c.proximo.monto; capitalReal -= 100000; i++;
      const d = cr(); log.push(fmt(dia) + ' pagué ' + c.proximo.monto + ' → saldo ' + d.saldo + ' · próximo ' + (d.proximo ? d.proximo.fecha + ' ' + d.proximo.monto : '—'));
    }
  }
  const fin = cr();
  log.push('FINAL: pagado ' + pagado + ' · saldo app ' + fin.saldo + ' · pendiente en calendario ' + fin.calendario.reduce((s, g) => s + g.monto, 0) + ' · plan pagadas ' + (fin.planes[0] ? fin.planes[0].pagadas : '(plan ya no se muestra)'));
  ok(!raro(D()), 'NaN');
  return { log, fin, pagado, esperadas };
}
const fmt = d => d.toISOString().slice(0, 10);
[[false, false], [true, false], [false, true]].forEach(([aj, d1]) => {
  const x = correr(aj, d1);
  console.log('\n--- ' + (aj ? 'B: con ajuste al extracto' : 'A: solo pagando lo que dice el tablero') + (d1 ? ' · interés desde cuota 1' : ' · Nubank') + ' ---\n' + x.log.join('\n'));
  const intereses = x.esperadas.reduce((a, b) => a + b, 0) - 300000;
  ok(Math.abs(x.fin.saldo) <= 2, (aj ? 'B' : 'A') + (d1 ? '/desde1' : '') + ': al pagar todas las cuotas la deuda queda en ' + x.fin.saldo + ' (debería ser 0; intereses pagados ' + intereses + ')');
  ok(x.fin.calendario.length === 0, (aj ? 'B' : 'A') + (d1 ? '/desde1' : '') + ': quedan cuotas pendientes en el calendario: ' + JSON.stringify(x.fin.calendario.map(g => [g.fecha, g.monto])));
  if (!d1) ok(x.pagado === x.esperadas.reduce((a, b) => a + b, 0), (aj ? 'B' : 'A') + ': pagaste ' + x.pagado + ' siguiendo el tablero vs ' + x.esperadas.reduce((a, b) => a + b, 0) + ' que dice el plan');
  // Interés diario: el plan muestra el capital; los intereses llegan en cada corte. Deben estar entre 0 y ~4 meses de tasa sobre el capital.
  else ok(x.pagado - 300000 > 0 && x.pagado - 300000 < 300000 * 0.02 * 4, (aj ? 'B' : 'A') + '/desde1: intereses pagados ' + (x.pagado - 300000) + ' fuera de lo razonable');
});
A.fin('audit_tarjeta');
