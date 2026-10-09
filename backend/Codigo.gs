/**
 * MIS FINANZAS (backend)
 * ------------------------------------------------------------------
 * Recibe los registros del botón del celular (HTTP Request Shortcuts),
 * los guarda en "Movimientos", calcula saldos, deudas con su calendario
 * de cuotas, gastos fijos, "me deben" y presupuestos, envía recordatorios
 * por correo y sirve el dashboard (archivo Dashboard.html).
 *
 * Después de cualquier cambio en este archivo:
 * Implementar > Gestionar implementaciones > lápiz > Nueva versión.
 */

// La clave NO va en el código: se guarda en Configuración del proyecto > Propiedades de la secuencia de comandos > CLAVE.
// Debe ser la misma del atajo del celular y de la app. Sin ella, nadie puede leer ni registrar.
const CLAVE = String(PropertiesService.getScriptProperties().getProperty('CLAVE') || '').trim();
const URL_APP = 'https://stircalde.github.io/mis-finanzas/'; // la app del dashboard (GitHub)

const HOJA_MOV = 'Movimientos';
const HOJA_CONFIG = 'Configuración';
const HOJA_ELIM = 'Eliminados';

const ENC_MOV = ['Fecha', 'Tipo', 'Descripción', 'Monto', 'Categoría', 'Cuenta', 'Cuenta destino',
  'Para quién', 'Cuotas', 'Valor cuota', 'Costo financiero', 'Registrado el', 'ID'];

const TIPO = { GASTO: 'Gasto', INGRESO: 'Ingreso', TRANSF: 'Transferencia', MEPAGARON: 'Me pagaron', AJUSTE: 'Ajuste', MEPRESTARON: 'Me prestaron', LEPAGUE: 'Le pagué' };
const CAT_INTERESES = 'Intereses y cargos';
const COMISION_EXTERIOR = 0.0045;   // comisión de la franquicia por compras en el exterior (verificada en un extracto de Nubank)
const CAT_SIN_ID = 'Sin identificar';
const CAT_MONEDAS = 'Monedas';
const CAT_APORTE = 'Aporte de mamá';
const CUENTA_MAMA = 'Mamá';               // cuenta tipo Deuda: lo que mamá te presta
const CUENTA_REGALO = 'Mamá (regalo)';    // cuenta de paso (siempre en $0) para lo que mamá paga y te regala
const ESQUEMA = 9;
// Los movimientos históricos (cargados de extractos, ID "hist:…") no mueven saldos:
// ya están incluidos en el saldo inicial. En el resumen general solo cuentan desde esta fecha.
const RESUMEN_DESDE = new Date(2026, 8, 1);
function esHist(m) { return String(m.id || '').indexOf('hist:') === 0; }
function cuentaEnResumen(m) { return !esHist(m) || m.fecha >= RESUMEN_DESDE; }

/* =================================================================
 * ENTRADA DESDE EL CELULAR
 * ================================================================= */

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (!CLAVE || p.clave !== CLAVE) return json({ ok: false, mensaje: '❌ Clave incorrecta. Revisa el atajo.' });

  const lock = LockService.getScriptLock();
  let conLock = false;
  try {
    lock.waitLock(20000);
    conLock = true;
    asegurarEsquema();
    const cfg = leerConfig();
    registrarFijosAutomaticos(cfg);
    // Idempotencia: si la app reenvía la misma solicitud (doble toque o reintento tras un corte de red), no se duplica.
    RID_ = /^[A-Za-z0-9_-]{6,40}$/.test(limpiar(p.rid)) ? limpiar(p.rid) : '';
    RID_N_ = 0;
    if (RID_ && leerMovimientos().some(function (m) { return m.id === RID_ || String(m.id).indexOf(RID_ + '#') === 0; })) {
      RID_ = '';
      return json({ ok: true, mensaje: '👌 Ya estaba registrado. No lo dupliqué.', config: configTelefono(cfg) });
    }
    let mensaje = '';
    // Todas las filas de este registro se escriben juntas al final (una sola escritura): si algo falla,
    // no queda un registro a medias que el reintento con el mismo rid tome por completo.
    PEND_ = [];
    switch (p.accion) {
      case 'config': break;
      case 'gasto': mensaje = registrarGasto(p, cfg); break;
      case 'pagocredito': mensaje = registrarPagoCredito(p, cfg); break;
      case 'fijo': mensaje = registrarFijoManual(p, cfg); break;
      case 'monedas': mensaje = registrarMonedas(p, cfg); break;
      case 'ingreso': mensaje = registrarIngreso(p, cfg); break;
      case 'mepagaron': mensaje = registrarMePagaron(p, cfg); break;
      case 'meprestaron': mensaje = registrarMePrestaron(p, cfg); break;
      case 'lepague': mensaje = registrarLePague(p, cfg); break;
      case 'transferencia': mensaje = registrarTransferencia(p, cfg); break;
      case 'ajuste': mensaje = registrarAjuste(p, cfg); break;
      case 'editarmov': mensaje = editarMovimiento(p, cfg); break;
      case 'deudaantigua': mensaje = agregarDeudaAntigua(p, cfg); break;
      case 'previsualizarborrado': mensaje = previsualizarBorrado(p, cfg); break;
      case 'borrarmov': mensaje = borrarMovimiento(p, cfg); break;
      case 'restaurarmov': mensaje = restaurarMovimientos(p, cfg); break;
      case 'ledebiaantes': mensaje = agregarLeDebiaAntes(p, cfg); break;
      case 'fijoadmin': mensaje = administrarFijo(p, cfg); break;
      case 'cuentaadmin': mensaje = administrarCuenta(p, cfg); break;
      case 'limiteadmin': mensaje = administrarLimite(p, cfg); break;
      case 'metaadmin': mensaje = administrarMeta(p, cfg); break;
      case 'aviso': mensaje = registrarAviso(p, cfg); break;
      case 'avisoresolver': mensaje = resolverAviso(p, cfg); break;
      case 'avisosmodo': mensaje = cambiarModoAvisos(p); break;
      default: throw new Error('Acción desconocida: ' + p.accion);
    }
    guardarPendientes_();
    avEjecutarDiferidos_();
    return json({ ok: true, mensaje: mensaje, extra: EXTRA_, config: configTelefono(CACHE_CFG_ ? cfg : leerConfig()) });
  } catch (err) {
    return json({ ok: false, mensaje: '❌ ' + (conLock ? err.message : 'La hoja está ocupada. Intenta de nuevo en unos segundos.') });
  } finally {
    RID_ = '';
    EXTRA_ = null;
    PEND_ = null;   // si hubo error, lo pendiente se descarta: nada quedó escrito
    AV_POST_ = null;
    if (conLock) lock.releaseLock();
  }
}
let RID_ = '', RID_N_ = 0, PEND_ = null, EXTRA_ = null, ULT_ID_ = '';   // EXTRA_: datos estructurados que algunas acciones devuelven junto al mensaje

function registrarGasto(p, cfg) {
  const monto = aNumero(p.monto);
  const desc = limpiar(p.descripcion);
  const cat = limpiar(p.categoria) || sugerirCategoria(limpiar(p.descripcion), cfg) || 'Otros';
  const cta = cuentaPorNombre(cfg, p.cuenta);
  const para = paraCanonico(cfg, limpiar(p.para));
  if (!desc) throw new Error('Falta la descripción.');
  if (!(monto > 0)) throw new Error('El monto no es válido.');

  const f = financiacion(cta, monto, p.cuotas, aNumero(p.valorCuota));
  const fecha = leerFechaMov(p.fecha);
  agregarMovimiento([fecha, TIPO.GASTO, desc, monto, cat, cta.nombre, '', para, f.cuotas, f.valorCuota, f.costo]);
  const idGasto = ULT_ID_;
  const fechaPago = para ? leerFechaPago(p.fechaPago, fecha) : null;
  if (fechaPago) guardarFechaFavor(idGasto, fechaPago, para);

  let linea1 = '✅ ' + pesos(monto) + ' · ' + cat + ' (' + cta.nombre + ')';
  if (f.cuotas) linea1 += f.cuotas === 1 ? ' · 1 cuota' : esTarjeta(cta) ? ' · ' + f.cuotas + ' cuotas de ' + pesos(f.valorCuota) + ' + intereses (≈ ' + pesos(f.costo) + ' en total)'
    : ' · ' + f.cuotas + ' × ' + pesos(f.valorCuota);
  if (para) linea1 += ' · para ' + para;
  if (fechaPago) linea1 += ' · te paga el ' + fmtCorta_(fechaPago);
  // Compra en el exterior con tarjeta: la franquicia cobra una comisión única que no genera intereses (Mastercard/Nu: 0,45 %).
  if (p.exterior === 'si' && esTarjeta(cta)) {
    const com = Math.round(monto * COMISION_EXTERIOR);
    if (com > 0) {
      agregarMovimiento([fecha, TIPO.GASTO, 'Comisión por compra en el exterior', com, CAT_INTERESES, cta.nombre, '', '', '', '', '']);
      linea1 += '\n🌎 + ' + pesos(com) + ' de comisión por compra en el exterior';
    }
  }

  let linea2 = '';
  if (p.apartar === 'si') {
    const bolsillo = bolsilloDe(cfg, cta.nombre);
    if (bolsillo) {
      const total = f.cuotas ? monto + (Number(f.costo) || 0) : monto;
      agregarMovimiento([fecha, TIPO.TRANSF, 'Apartado para ' + cta.nombre, total, '', bolsillo.alimentaDesde || 'Daviplata',
        bolsillo.nombre, '', '', '', '']);
      linea2 = '🎯 Apartaste ' + pesos(total) + ' en ' + bolsillo.nombre;
    }
  }
  if (!linea2 && cta.comprasMin) {
    const est = calcular(leerMovimientos(), cfg, hoy());
    const d = est.deudas.find(function (x) { return x.nombre === cta.nombre; });
    if (d && d.reto) linea2 = d.reto.hechas >= d.reto.minimo ? '🏁 Reto ' + cta.nombre + ' cumplido (' + d.reto.hechas + ' compras)'
      : '🏁 Reto ' + cta.nombre + ': ' + d.reto.hechas + ' de ' + d.reto.minimo + ' compras este mes';
  }
  if (!linea2 && !para) linea2 = lineaPresupuesto(cfg, cat, fecha);
  return linea2 ? linea1 + '\n' + linea2 : linea1;
}

/** Cuotas, valor de cuota y costo de financiación para un gasto con una cuenta de deuda. */
function financiacion(cta, monto, cuotasTxt, valorDado) {
  if (cta.tipo !== 'Deuda' || cta.modo === 'Sin cuotas') return { cuotas: '', valorCuota: '', costo: '' };
  const n = Math.min(Math.max(1, parseInt(cuotasTxt, 10) || 1), cta.maxCuotas || 48);
  const plan = planCuotas(monto, n, cta, valorDado);
  return { cuotas: n, valorCuota: plan.valorCuota, costo: plan.costo };
}

function registrarFijoManual(p, cfg) {
  const f = cfg.fijos.find(function (x) { return x.nombre === limpiar(p.fijo); });
  if (!f) throw new Error('El gasto fijo "' + p.fijo + '" no existe en Configuración.');
  const monto = aNumero(p.monto) > 0 ? aNumero(p.monto) : f.valor;
  const cta = cuentaPorNombre(cfg, p.cuenta || f.cuenta);
  const periodo = limpiar(p.periodo) || periodoActual(f, hoy());
  const formato = f.frecuencia === 'Anual' ? /^\d{4}$/ : f.frecuencia === 'Una vez' ? /^unica$/ : /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!formato.test(periodo)) throw new Error('El periodo "' + periodo + '" no corresponde a ' + f.nombre + '.');
  const id = 'fijo:' + f.nombre + ':' + periodo;
  if (leerMovimientos().some(function (m) { return m.id === id; })) return '👌 ' + f.nombre + ' ya estaba registrado como pagado.';
  const fecha = leerFechaMov(p.fecha);
  if (p.mama === 'regalo') {
    agregarMovimiento([fecha, TIPO.INGRESO, 'Mamá pagó ' + f.nombre, monto, CAT_APORTE, CUENTA_REGALO, '', '', '', '', ''], id + ':aporte');
    agregarMovimiento([fecha, TIPO.GASTO, f.nombre, monto, f.categoria, CUENTA_REGALO, '', repartoTexto(f), '', '', ''], id);
    return '✅ ' + f.nombre + ' pagado · ' + pesos(monto) + '\n👩 Lo pagó tu mamá (regalo, cuenta como ingreso)';
  }
  if (p.mama === 'prestamo') {
    const mama = cuentaPorNombre(cfg, CUENTA_MAMA);
    agregarMovimiento([fecha, TIPO.GASTO, f.nombre, monto, f.categoria, mama.nombre, '', repartoTexto(f), '', '', ''], id);
    return '✅ ' + f.nombre + ' pagado · ' + pesos(monto) + '\n👩 Se lo debes a tu mamá · ahora le debes ' + pesos(saldoDe(cfg, mama.nombre));
  }
  const fin = financiacion(cta, monto, 1, 0);
  agregarMovimiento([fecha, TIPO.GASTO, f.nombre, monto, f.categoria, cta.nombre, '', repartoTexto(f), fin.cuotas, fin.valorCuota, fin.costo], id);
  return '✅ ' + f.nombre + ' pagado · ' + pesos(monto) + ' (' + cta.nombre + ')';
}

/** Pago de un crédito: desde una cuenta tuya, o lo paga mamá (regalo = ingreso; préstamo = le debes a mamá). */
function registrarPagoCredito(p, cfg) {
  const cred = cuentaPorNombre(cfg, p.credito);
  if (cred.tipo !== 'Deuda') throw new Error(cred.nombre + ' no es un crédito.');
  const monto = aNumero(p.monto);
  if (!(monto > 0)) throw new Error('El monto no es válido.');
  const fecha = leerFechaMov(p.fecha);
  let linea;
  if (p.origen === 'regalo') {
    agregarMovimiento([fecha, TIPO.INGRESO, 'Mamá pagó ' + cred.nombre, monto, CAT_APORTE, cred.nombre, '', '', '', '', '']);
    linea = '👩 Lo pagó tu mamá (regalo, cuenta como ingreso)';
  } else if (p.origen === 'prestamo') {
    const mama = cuentaPorNombre(cfg, CUENTA_MAMA);
    if (mama.nombre === cred.nombre) throw new Error('Tu mamá no puede prestarte para pagarle a ella misma.');
    agregarMovimiento([fecha, TIPO.TRANSF, 'Mamá pagó ' + cred.nombre + ' (préstamo)', monto, '', mama.nombre, cred.nombre, '', '', '', '']);
    linea = '👩 Préstamo de tu mamá · ahora le debes ' + pesos(saldoDe(cfg, mama.nombre));
  } else {
    const desde = cuentaPorNombre(cfg, p.cuenta);
    if (desde.nombre === cred.nombre) throw new Error('El origen y el crédito son la misma cuenta.');
    agregarMovimiento([fecha, TIPO.TRANSF, 'Pago ' + cred.nombre, monto, '', desde.nombre, cred.nombre, '', '', '', '']);
    linea = '💸 Salió de ' + desde.nombre + ' · queda en ' + pesos(saldoDe(cfg, desde.nombre));
  }
  const est = calcular(leerMovimientos(), cfg, hoy());
  const d = est.deudas.find(function (x) { return x.nombre === cred.nombre; });
  if (cred.nombre === CUENTA_MAMA) {
    return '✅ Le devolviste ' + pesos(monto) + ' a tu mamá\n' + linea + '\n' +
      (d && d.saldo > 0 ? '👩 Todavía le debes ' + pesos(d.saldo) : '🎉 Quedaste a paz y salvo con tu mamá');
  }
  let msg = '✅ Pagaste ' + pesos(monto) + ' de ' + cred.nombre + '\n' + linea;
  if (d) {
    msg += '\n💳 Ahora debes ' + pesos(d.saldo) + ' en ' + d.nombre;
    if (d.proximo) msg += '\n📅 Próximo: ' + pesos(d.proximo.monto) + ' el ' + fmtLargo(d.proximo.fecha);
  }
  return msg;
}

function saldoDe(cfg, nombre) {
  return Math.round(calcular(leerMovimientos(), cfg, hoy()).saldos[nombre] || 0);
}

function registrarMonedas(p, cfg) {
  const monto = aNumero(p.monto);
  if (!(monto > 0)) throw new Error('El monto no es válido.');
  const cta = cuentaPorNombre(cfg, p.cuenta || 'Efectivo');
  agregarMovimiento([leerFechaMov(p.fecha), TIPO.GASTO, 'Monedas regaladas', monto, CAT_MONEDAS, cta.nombre, '', '', '', '', '']);
  const est = calcular(leerMovimientos(), cfg, hoy());
  return '🪙 Listo: ' + pesos(monto) + ' en monedas fuera.\n💵 ' + cta.nombre + ' queda en ' + pesos(est.saldos[cta.nombre] || 0);
}

function registrarIngreso(p, cfg) {
  const monto = aNumero(p.monto);
  const tipoIngreso = limpiar(p.tipoIngreso) || 'Otros';
  const cta = cuentaPorNombre(cfg, p.cuenta);
  if (!(monto > 0)) throw new Error('El monto no es válido.');
  const desc = limpiar(p.descripcion) || tipoIngreso;
  agregarMovimiento([leerFechaMov(p.fecha), TIPO.INGRESO, desc, monto, tipoIngreso, cta.nombre, '', '', '', '', '']);
  return '✅ Ingreso de ' + pesos(monto) + ' · ' + tipoIngreso + ' → ' + cta.nombre;
}

function registrarMePagaron(p, cfg) {
  const monto = aNumero(p.monto);
  const persona = personaCanonica(cfg, limpiar(p.persona));
  const cta = cuentaPorNombre(cfg, p.cuenta);
  if (!persona) throw new Error('Falta la persona.');
  if (!(monto > 0)) throw new Error('El monto no es válido.');
  const aplica = limpiar(p.aplica);
  const antes = calcular(leerMovimientos(), cfg, hoy());
  const deudor = antes.meDeben.find(function (x) { return x.persona === persona; });
  const concepto = aplica && deudor ? deudor.conceptos.find(function (c) { return c.key === aplica; }) : null;
  // Si pagó de más: el exceso queda como saldo a favor de la persona, o como ingreso tuyo si así lo elegiste.
  const debe = deudor ? deudor.saldo : 0;
  const exceso = p.exceso === 'ingreso' && monto > debe ? monto - Math.max(0, debe) : 0;
  const fecha = leerFechaMov(p.fecha);
  if (monto - exceso > 0) agregarMovimiento([fecha, TIPO.MEPAGARON, persona + ' me pagó' + (concepto ? ' · ' + concepto.desc : ''), monto - exceso, '', cta.nombre,
    concepto ? 'c:' + aplica : '', persona, '', '', '']);
  if (exceso > 0) agregarMovimiento([fecha, TIPO.INGRESO, persona + ' me pagó de más', exceso, 'Otros', cta.nombre, '', '', '', '', '']);
  const est = calcular(leerMovimientos(), cfg, hoy());
  const queda = (est.personas.find(function (x) { return x.persona === persona; }) || { neto: 0 }).neto;
  return '✅ ' + persona + ' te pagó ' + pesos(monto) + ' → ' + cta.nombre + (concepto ? '\n🧾 Abonado a ' + concepto.desc : '\n🧾 Abonado a lo más antiguo') + '\n' +
    (exceso > 0 ? '💰 ' + pesos(exceso) + ' de más quedaron como ingreso tuyo\n' : '') +
    (queda > 0 ? '🤝 Todavía te debe ' + pesos(queda) : queda < 0 ? '💚 Quedó con ' + pesos(-queda) + ' a su favor' : '🎉 ' + persona + ' quedó a paz y salvo');
}

/** Alguien te prestó plata: entra a tu cuenta (no es ingreso) y pasa a "Les debes". */
function registrarMePrestaron(p, cfg) {
  const monto = aNumero(p.monto);
  const persona = personaCanonica(cfg, limpiar(p.persona));
  const cta = cuentaPorNombre(cfg, p.cuenta);
  if (!persona) throw new Error('Falta la persona.');
  if (!(monto > 0)) throw new Error('El monto no es válido.');
  agregarMovimiento([leerFechaMov(p.fecha), TIPO.MEPRESTARON, limpiar(p.descripcion) || persona + ' me prestó', monto, '', cta.nombre, '', persona, '', '', '']);
  const est = calcular(leerMovimientos(), cfg, hoy());
  const x = est.lesDebo.find(function (y) { return y.persona === persona; });
  return '✅ ' + persona + ' te prestó ' + pesos(monto) + ' → ' + cta.nombre + '\n🙋 Le debes ' + pesos(x ? x.saldo : monto);
}

/** Le devolviste plata a alguien: sale de tu cuenta y baja lo que le debes. */
function registrarLePague(p, cfg) {
  const monto = aNumero(p.monto);
  const persona = personaCanonica(cfg, limpiar(p.persona));
  const cta = cuentaPorNombre(cfg, p.cuenta);
  if (!persona) throw new Error('Falta la persona.');
  if (!(monto > 0)) throw new Error('El monto no es válido.');
  const fecha = leerFechaMov(p.fecha);
  // Si le pagas más de lo que le debes, la diferencia no puede desaparecer: o te la queda debiendo, o fue un regalo (gasto tuyo).
  const antes = calcular(leerMovimientos(), cfg, hoy()).lesDebo.find(function (y) { return y.persona === persona; });
  const debe = antes ? Math.max(0, antes.saldo) : 0;
  const exceso = monto > debe ? monto - debe : 0;
  if (exceso > 0 && p.exceso !== 'debe' && p.exceso !== 'regalo') {
    throw new Error((debe > 0 ? 'Solo le debes ' + pesos(debe) + ' a ' + persona + '.' : 'No le debes nada a ' + persona + '.') +
      ' Regístralo desde la app para elegir qué pasa con los ' + pesos(exceso) + ' de más.');
  }
  if (monto - exceso > 0) agregarMovimiento([fecha, TIPO.LEPAGUE, 'Le pagué a ' + persona, monto - exceso, '', cta.nombre, '', persona, '', '', '']);
  if (exceso > 0 && p.exceso === 'debe') agregarMovimiento([fecha, TIPO.GASTO, 'Le pagué de más a ' + persona, exceso, 'Otros', cta.nombre, '', persona, '', '', '']);
  if (exceso > 0 && p.exceso === 'regalo') agregarMovimiento([fecha, TIPO.GASTO, 'Le pagué de más a ' + persona + ' (regalo)', exceso, 'Otros', cta.nombre, '', '', '', '', '']);
  if (exceso > 0) {
    return '✅ Le pagaste ' + pesos(monto) + ' a ' + persona + ' desde ' + cta.nombre + '\n' +
      (debe > 0 ? '🎉 Quedaste a paz y salvo (le debías ' + pesos(debe) + ')\n' : '') +
      (p.exceso === 'debe' ? '🤝 ' + persona + ' te queda debiendo ' + pesos(exceso) : '🎁 Los ' + pesos(exceso) + ' de más quedaron como gasto tuyo');
  }
  const est = calcular(leerMovimientos(), cfg, hoy());
  const x = est.lesDebo.find(function (y) { return y.persona === persona; });
  return '✅ Le pagaste ' + pesos(monto) + ' a ' + persona + ' desde ' + cta.nombre + '\n' + (x ? '🙋 Todavía le debes ' + pesos(x.saldo) : '🎉 Quedaste a paz y salvo con ' + persona);
}

function registrarTransferencia(p, cfg) {
  const monto = aNumero(p.monto);
  const desde = cuentaPorNombre(cfg, p.desde);
  const hacia = cuentaPorNombre(cfg, p.hacia);
  if (desde.nombre === hacia.nombre) throw new Error('El origen y el destino son la misma cuenta.');
  if (!(monto > 0)) throw new Error('El monto no es válido.');
  let desc = limpiar(p.descripcion);
  if (!desc) {
    if (hacia.tipo === 'Deuda') desc = 'Pago ' + hacia.nombre;
    else if (desde.tipo === 'Deuda') desc = 'Avance de ' + desde.nombre;
    else if (hacia.nombre === 'Efectivo') desc = 'Retiro de ' + desde.nombre;
    else if (hacia.apartaPara) desc = 'Apartado para ' + hacia.apartaPara;
    else desc = desde.nombre + ' → ' + hacia.nombre;
  }
  agregarMovimiento([leerFechaMov(p.fecha), TIPO.TRANSF, desc, monto, '', desde.nombre, hacia.nombre, '', '', '', '']);
  let msg = '✅ ' + pesos(monto) + ' · ' + desde.nombre + ' → ' + hacia.nombre;
  if (hacia.tipo === 'Deuda') {
    const est = calcular(leerMovimientos(), cfg, hoy());
    const d = est.deudas.find(function (x) { return x.nombre === hacia.nombre; });
    if (d) msg += '\n💳 Ahora debes ' + pesos(d.saldo) + ' en ' + d.nombre;
  }
  return msg;
}

function registrarAjuste(p, cfg) {
  const cta = cuentaPorNombre(cfg, p.cuenta);
  const real = aNumero(p.saldoReal);
  if (isNaN(real) || real < 0) throw new Error('El saldo no es válido.');
  const est = calcular(leerMovimientos(), cfg, hoy());
  const actual = est.saldos[cta.nombre] || 0;
  const delta = Math.round(real - actual);
  if (delta === 0) return '👌 ' + cta.nombre + ' ya estaba cuadrada en ' + pesos(real);
  const cat = cta.tipo === 'Plata' && delta < 0 ? CAT_SIN_ID : cta.tipo === 'Deuda' && delta > 0 ? CAT_INTERESES : '';
  agregarMovimiento([leerFechaMov(p.fecha), TIPO.AJUSTE, 'Ajuste de saldo', delta, cat, cta.nombre, '', '', '', '', '']);
  const verbo = cta.tipo === 'Deuda' ? 'Deuda de ' : 'Saldo de ';
  return '⚖️ ' + verbo + cta.nombre + ' ajustado a ' + pesos(real) + '\n(diferencia ' + (delta > 0 ? '+' : '−') + pesos(Math.abs(delta)) + ')';
}

/**
 * Corrige un movimiento ya registrado (por su ID). Solo cambia lo que llega en la solicitud; el tipo nunca cambia.
 * No toca los históricos de extractos ("hist:") ni los ajustes de saldo (esos se rehacen con "Ajustar saldo").
 * Campos por tipo: fecha, descripcion, monto siempre; categoria (Gasto, Ingreso); cuenta (todos menos Transferencia sin origen);
 * destino (Transferencia); cuotas y valorCuota (Gasto en tarjeta o crédito).
 */
function editarMovimiento(p, cfg) {
  const id = limpiar(p.id);
  if (!id) throw new Error('Falta el identificador del movimiento.');
  if (id.indexOf('hist:') === 0) throw new Error('Los movimientos cargados de extractos no se editan: ya están incluidos en el saldo inicial.');
  const h = hojaMovimientos();
  const n = h.getLastRow() - 1;
  if (n < 1) throw new Error('No encontré ese movimiento.');
  const ids = h.getRange(2, 13, n, 1).getValues();
  const filas = [];
  ids.forEach(function (r, i) { if (String(r[0]) === id) filas.push(i + 2); });
  if (filas.length !== 1) throw new Error(filas.length ? 'Hay más de un movimiento con ese identificador; edítalo directo en la hoja.' : 'No encontré ese movimiento. Puede que ya se haya borrado.');
  const fila = filas[0];
  const ant = h.getRange(fila, 1, 1, 11).getValues()[0];
  const tipo = String(ant[1]).trim();
  if (tipo === TIPO.AJUSTE) throw new Error('Un ajuste de saldo no se edita: usa "Ajustar saldo" otra vez.');
  const tiene = function (k) { return p[k] !== undefined && p[k] !== null; };
  const nuevo = ant.slice();
  const cambios = [];
  const marca = function (nombre, antes, ahora) { if (String(antes) !== String(ahora)) cambios.push(nombre); };
  if (tiene('fecha')) { const f = leerFechaMov(p.fecha); if (f > hoy()) throw new Error('La fecha no puede ser futura.'); marca('fecha', soloFecha(ant[0]).getTime(), f.getTime()); nuevo[0] = f; }
  if (tiene('descripcion')) { const d = limpiar(p.descripcion); if (!d) throw new Error('Falta la descripción.'); marca('descripción', ant[2], d); nuevo[2] = d; }
  const monto = tiene('monto') ? aNumero(p.monto) : Number(ant[3]);
  if (!(monto > 0)) throw new Error('El monto no es válido.');
  marca('monto', ant[3], monto); nuevo[3] = monto;
  if (tiene('categoria')) {
    if (tipo !== TIPO.GASTO && tipo !== TIPO.INGRESO) throw new Error('Este tipo de movimiento no tiene categoría.');
    const c = limpiar(p.categoria); if (!c) throw new Error('Elige la categoría.');
    marca('categoría', ant[4], c); nuevo[4] = c;
  }
  if (tiene('para')) {
    if (tipo !== TIPO.GASTO) throw new Error('Solo los gastos tienen "para quién".');
    const para = paraCanonico(cfg, limpiar(p.para));
    const r = reparto({ para: para, monto: monto });
    const suma = r.otros.reduce(function (t, x) { return t + x.v; }, 0);
    if (para.indexOf(':') >= 0 && suma > monto) throw new Error('Lo que repartes (' + pesos(suma) + ') supera el monto del gasto (' + pesos(monto) + ').');
    marca('para quién', ant[7], para); nuevo[7] = para;
  }
  let cta = null;
  if (tiene('cuenta')) {
    const nombre = limpiar(p.cuenta);
    if (nombre !== String(ant[5]).trim()) cta = cuentaPorNombre(cfg, nombre);
    marca('cuenta', ant[5], nombre); nuevo[5] = nombre;
  }
  if (tiene('destino')) {
    if (tipo !== TIPO.TRANSF) throw new Error('Solo las transferencias tienen cuenta destino.');
    const nombre = limpiar(p.destino);
    if (nombre !== String(ant[6]).trim()) cuentaPorNombre(cfg, nombre);
    marca('destino', ant[6], nombre); nuevo[6] = nombre;
  }
  if (tipo === TIPO.TRANSF && nuevo[5] && nuevo[5] === nuevo[6]) throw new Error('La cuenta de origen y la de destino no pueden ser la misma.');
  if (tipo === TIPO.GASTO) {
    // Las cuotas se recalculan con las mismas reglas del registro (tasa, máximo de cuotas, 1 cuota sin interés…).
    const c = cuentaPorNombre(cfg, String(nuevo[5]).trim());
    const toca = tiene('cuotas') || tiene('valorCuota') || monto !== Number(ant[3]) || cta;
    if (toca) {
      const cuotasTxt = tiene('cuotas') ? p.cuotas : ant[8];
      const mismoPlan = !tiene('valorCuota') && !tiene('cuotas') && monto === Number(ant[3]);
      const valor = tiene('valorCuota') ? aNumero(p.valorCuota) : mismoPlan ? Number(ant[9]) || 0 : 0;
      const f = financiacion(c, monto, cuotasTxt, valor);
      marca('cuotas', ant[8], f.cuotas); marca('valor de la cuota', ant[9], f.valorCuota);
      nuevo[8] = f.cuotas; nuevo[9] = f.valorCuota; nuevo[10] = f.costo;
    }
  }
  const limpio = nuevo.map(function (x) { return typeof x === 'string' && /^[=+\-@]/.test(x) && !/^-?\d[\d.,]*$/.test(x) ? "'" + x : x; });
  if (!cambios.length) return '👌 No había nada que cambiar.';
  h.getRange(fila, 1, 1, 11).setValues([limpio]);
  try { formatoFilas_(h, fila, 1); } catch (e) { /* cosmético */ }
  CACHE_MOVS_ = null;
  let msg = '✏️ Movimiento corregido (' + cambios.join(', ') + ')';
  const base = id.split('#')[0];
  const hermanos = ids.filter(function (r) { const x = String(r[0]); return x !== id && x.split('#')[0] === base; }).length;
  if (hermanos) msg += '\n⚠️ Este registro creó ' + hermanos + ' movimiento(s) más (apartado, comisión…). Revísalos si el cambio los afecta.';
  return msg;
}

/**
 * Agrega a "ME DEBEN DESDE ANTES" (Configuración) algo que una persona ya te debía y se había olvidado registrar.
 * No mueve ninguna cuenta: solo suma a lo que esa persona te debe. Cuando te pague, se registra con "Me pagaron".
 */
/** Fecha de pago opcional de un favor (texto yyyy-mm-dd): vacía = sin fecha; no puede ser anterior a la fecha del favor. */
function leerFechaPago(v, desde) {
  const t = limpiar(v);
  if (!t) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) throw new Error('La fecha de pago no es válida.');
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) throw new Error('La fecha de pago no es válida.');
  if (desde && d < soloFecha(desde)) throw new Error('La fecha de pago no puede ser anterior a la del favor.');
  return d;
}
function fmtCorta_(d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }

/** Tabla "Fechas de pago de favores" (se crea sola al guardar la primera): ID del movimiento → fecha en que te pagan. */
function guardarFechaFavor(id, fecha, persona) {
  const h = hojaConfig();
  let v = h.getDataRange().getValues();
  if (filaEncabezado(v, 'ID favor') < 0) {
    const f = h.getLastRow() + 2;
    h.getRange(f, 1).setValue('▸ FECHAS DE PAGO DE FAVORES').setFontWeight('bold').setFontColor('#0b3d91').setFontSize(12);
    h.getRange(f + 1, 1, 1, 3).setValues([['ID favor', 'Fecha de pago', 'Persona']]).setFontWeight('bold').setBackground('#dbe8ff');
    v = h.getDataRange().getValues();
  }
  const fila = filaLibre(h, v, 'ID favor');
  h.getRange(fila, 1, 1, 3).setValues([[id, fecha, persona]]);
  try { h.getRange(fila, 2).setNumberFormat('dd/mm/yyyy'); } catch (e) { /* cosmético */ }
  CACHE_CFG_ = null;
}

function agregarDeudaAntigua(p, cfg) {
  const concepto = limpiar(p.concepto);
  const monto = aNumero(p.monto);                       // valor inicial
  let persona = limpiar(p.persona);
  if (!persona) throw new Error('Falta la persona.');
  if (!concepto) throw new Error('Falta el concepto.');
  if (!(monto > 0)) throw new Error('El valor inicial no es válido.');
  // Saldo actual (opcional): lo que todavía te deben. Lo que falta para llegar al valor inicial ya te lo pagaron.
  const saldoTxt = limpiar(p.saldoActual);
  const saldo = saldoTxt === '' ? monto : aNumero(saldoTxt);
  if (saldoTxt !== '' && !(saldo > 0)) throw new Error('El saldo actual debe ser mayor que cero (si ya te lo pagaron todo, no hace falta registrarlo).');
  if (saldo > monto) throw new Error('El saldo actual no puede ser mayor que el valor inicial.');
  const yaPagado = Math.round((monto - saldo) * 100) / 100;
  const vence = leerFechaPago(p.fechaPago, null);
  persona = personaCanonica(cfg, persona);
  if ((cfg.deudoresIniciales || []).some(function (x) { return x.persona === persona && x.concepto === concepto && x.monto === monto && (x.pagado || 0) === yaPagado; }))
    return '👌 Ya tenías anotado "' + concepto + '" de ' + persona + ' por ' + pesos(monto) + '. No lo dupliqué.';
  const h = hojaConfig();
  asegurarColumnasPersona_(h);
  const fila = filaLibre(h, h.getDataRange().getValues(), 'Persona');
  h.getRange(fila, 1, 1, 5).setValues([[persona, concepto, monto, yaPagado || '', vence || '']]);
  try { h.getRange(fila, 3, 1, 2).setNumberFormat('$#,##0'); if (vence) h.getRange(fila, 5).setNumberFormat('dd/mm/yyyy'); } catch (e) { /* cosmético */ }
  CACHE_CFG_ = null;
  return '🤝 Anotado: ' + persona + ' te debía ' + pesos(monto) + ' (' + concepto + ').' +
    (yaPagado > 0 ? '\n💵 Ya te pagó ' + pesos(yaPagado) + ': hoy te debe ' + pesos(saldo) + '.' : '') +
    (vence ? '\n📅 Te paga el ' + fmtCorta_(vence) + '.' : '') +
    '\nCuando te pague, regístralo con 🤝 Me pagaron.';
}

/** La tabla "Persona" nació con 3 columnas; agrega "Ya pagado" y "Fecha de pago" (a la derecha) si faltan. */
function asegurarColumnasPersona_(h) {
  const v = h.getDataRange().getValues();
  const i = filaEncabezado(v, 'Persona');
  if (i < 0) throw new Error('No encontré la tabla "Persona" en Configuración.');
  const enc = v[i].map(function (x) { return String(x).trim(); });
  const falta = ['Ya pagado', 'Fecha de pago'].filter(function (k) { return enc.indexOf(k) < 0; });
  if (!falta.length) return;
  if (enc.length > 3 && enc.slice(3).some(function (x) { return x; })) throw new Error('La tabla "Persona" tiene otras columnas a la derecha; no pude agregar "Ya pagado" y "Fecha de pago".');
  h.getRange(i + 1, 4, 1, 2).setValues([['Ya pagado', 'Fecha de pago']]).setFontWeight('bold').setBackground('#dbe8ff');
  CACHE_CFG_ = null;
}

/**
 * Algo que TÚ le debías a alguien desde antes y no se registró. Queda como un "Me prestaron" sin cuenta: sube lo que le debes
 * pero no mueve ningún saldo. Cuando se lo pagues, usa "Le pagué".
 */
function agregarLeDebiaAntes(p, cfg) {
  const concepto = limpiar(p.concepto);
  const monto = aNumero(p.monto);
  const persona = personaCanonica(cfg, limpiar(p.persona));
  if (!persona) throw new Error('Falta la persona.');
  if (!concepto) throw new Error('Falta el concepto.');
  if (!(monto > 0)) throw new Error('El monto no es válido.');
  const fecha = leerFechaMov(p.fecha);
  // Saldo actual (opcional): lo que todavía le debes; se anota el valor inicial en el concepto.
  const saldoTxt = limpiar(p.saldoActual);
  let saldo = saldoTxt === '' ? monto : aNumero(saldoTxt);
  if (saldoTxt !== '' && !(saldo > 0)) throw new Error('El saldo actual debe ser mayor que cero (si ya se lo pagaste todo, no hace falta registrarlo).');
  if (saldo > monto) throw new Error('El saldo actual no puede ser mayor que el valor inicial.');
  // Pagos previos con fecha (opcional): lista [{fecha, monto}] (o JSON). Si vienen, reemplazan al saldo actual.
  let pagos = p.pagos;
  if (typeof pagos === 'string' && limpiar(pagos) !== '') { try { pagos = JSON.parse(pagos); } catch (e) { throw new Error('Los pagos anteriores no tienen un formato válido.'); } }
  pagos = Array.isArray(pagos) ? pagos : [];
  let sumaPagos = 0;
  pagos = pagos.map(function (x) {
    const m = aNumero(x.monto);
    if (!(m > 0)) throw new Error('Un pago anterior tiene un monto no válido.');
    sumaPagos += m;
    return { fecha: leerFechaMov(x.fecha), monto: m };
  });
  if (sumaPagos > monto) throw new Error('Los pagos anteriores (' + pesos(sumaPagos) + ') superan el valor inicial (' + pesos(monto) + ').');
  // Si ya anotaste el mismo favor antiguo (misma persona, concepto y valor, sin cuenta), no se duplica.
  if (leerMovimientos().some(function (m) { return m.tipo === TIPO.MEPRESTARON && !m.cuenta && m.para === persona && m.desc === concepto && Math.abs(m.monto - monto) < 0.5; }))
    return '👌 Ya tenías anotado "' + concepto + '" con ' + persona + ' por ' + pesos(monto) + '. No lo dupliqué.';
  // Se anota el valor inicial completo como préstamo y lo ya devuelto como pagos (ambos sin cuenta: no mueven saldos).
  agregarMovimiento([fecha, TIPO.MEPRESTARON, concepto, monto, '', '', '', persona, '', '', '']);
  if (pagos.length) {
    pagos.forEach(function (x) { agregarMovimiento([x.fecha, TIPO.LEPAGUE, 'Pago anterior · ' + concepto, x.monto, '', '', '', persona, '', '', '']); });
    saldo = monto - sumaPagos;
  } else if (saldo < monto) agregarMovimiento([fecha, TIPO.LEPAGUE, 'Pagado antes de usar la app · ' + concepto, monto - saldo, '', '', '', persona, '', '', '']);
  const est = calcular(leerMovimientos(), cfg, hoy());
  const x = est.lesDebo.find(function (y) { return y.persona === persona; });
  return '🙋 Anotado: le debes ' + pesos(saldo) + ' a ' + persona + ' (' + concepto + ').\nAhora le debes ' + pesos(x ? x.saldo : saldo) + '. Cuando se lo pagues, regístralo con ↩️ Le pagué.';
}

/* ---------- Eliminar movimientos (con vista previa, doble confirmación y deshacer) ---------- */

/** Los movimientos que nacieron del mismo registro (apartado, comisión, aporte de mamá…) comparten esta familia. */
function familiaId_(id) {
  id = String(id);
  return id.indexOf('fijo:') === 0 ? id.replace(/:aporte$/, '') : id.split('#')[0];
}

/** Filas de la hoja (número y valores) del movimiento y de todo lo que nació con él. */
function filasDeFamilia_(id) {
  id = limpiar(id);
  if (!id) throw new Error('Falta el identificador del movimiento.');
  if (id.indexOf('hist:') === 0) throw new Error('Los movimientos cargados de extractos prevalecen y no se eliminan: ya están incluidos en el saldo inicial.');
  const h = hojaMovimientos();
  const n = h.getLastRow() - 1;
  const todo = n < 1 ? [] : h.getRange(2, 1, n, ENC_MOV.length).getValues();
  const fam = familiaId_(id);
  const filas = [];
  todo.forEach(function (r, i) { if (String(r[12]) && familiaId_(r[12]) === fam) filas.push({ fila: i + 2, v: r }); });
  if (!filas.some(function (f) { return String(f.v[12]) === id; })) throw new Error('No encontré ese movimiento. Puede que ya se haya borrado.');
  if (filas.some(function (f) { return String(f.v[12]).indexOf('hist:') === 0; })) throw new Error('Este registro está ligado a un extracto y no se elimina.');
  return filas;
}

/** Qué pasaría con tus saldos y con lo que te deben si esas filas desaparecieran. No escribe nada. */
function efectoDeBorrar_(cfg, ids) {
  const movs = leerMovimientos();
  const antes = calcular(movs, cfg, hoy());
  const despues = calcular(movs.filter(function (m) { return ids.indexOf(m.id) < 0; }), cfg, hoy());
  const efectos = [], avisos = [];
  let mover = null;
  cfg.cuentas.forEach(function (c) {
    const a = Math.round(antes.saldos[c.nombre] || 0), d = Math.round(despues.saldos[c.nombre] || 0);
    if (a !== d) efectos.push({ cuenta: c.nombre, antes: a, despues: d, deuda: c.tipo === 'Deuda' });
    if (c.apartaPara && d !== 0) {
      const origen = c.alimentaDesde || (cfg.cuentas.find(function (x) { return x.tipo === 'Plata' && x.activa && x.nombre !== c.nombre; }) || {}).nombre || '';
      avisos.push(d > 0
        ? 'El bolsillo "' + c.nombre + '" quedaría con ' + pesos(d) + ' que ya no corresponden a ningún apartado. Puedes moverlos a ' + (origen || 'otra cuenta') + '.'
        : 'El bolsillo "' + c.nombre + '" quedaría en −' + pesos(-d) + ': esa plata ya se usó (por ejemplo, en un pago). Puedes reponerla desde ' + (origen || 'otra cuenta') + '.');
      if (origen) mover = d > 0 ? { desde: c.nombre, hacia: origen, monto: d } : { desde: origen, hacia: c.nombre, monto: -d };
    } else if (c.tipo === 'Plata' && d < 0 && a >= 0) avisos.push('"' + c.nombre + '" quedaría en negativo (−' + pesos(-d) + '). Revisa si falta registrar algo.');
  });
  const personas = [];
  antes.personas.forEach(function (x) {
    const y = despues.personas.find(function (z) { return z.persona === x.persona; }) || { neto: 0 };
    if (Math.round(x.neto) !== Math.round(y.neto)) personas.push({ persona: x.persona, antes: Math.round(x.neto), despues: Math.round(y.neto) });
  });
  return { efectos: efectos, avisos: avisos, personas: personas, mover: mover };
}

function resumenFila_(v) {
  return { id: String(v[12]), fecha: fmt(soloFecha(v[0])), tipo: String(v[1]).trim(), desc: String(v[2]), monto: Number(v[3]) || 0, cuenta: String(v[5]).trim(), destino: String(v[6]).trim() };
}

function previsualizarBorrado(p, cfg) {
  const filas = filasDeFamilia_(p.id);
  const ids = filas.map(function (f) { return String(f.v[12]); });
  const e = efectoDeBorrar_(cfg, ids);
  EXTRA_ = { movimientos: filas.map(function (f) { return resumenFila_(f.v); }), efectos: e.efectos, personas: e.personas, avisos: e.avisos, mover: e.mover };
  return 'Vista previa: ' + ids.length + ' movimiento(s).';
}

function borrarMovimiento(p, cfg) {
  if (limpiar(p.confirmo) !== 'ELIMINAR') throw new Error('Falta la confirmación: escribe ELIMINAR.');
  const filas = filasDeFamilia_(p.id);
  const ids = filas.map(function (f) { return String(f.v[12]); });
  const e = efectoDeBorrar_(cfg, ids);
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let el = libro.getSheetByName(HOJA_ELIM);
  if (!el) {
    el = libro.insertSheet(HOJA_ELIM);
    el.getRange(1, 1, 1, ENC_MOV.length + 2).setValues([ENC_MOV.concat(['Eliminado el', 'Lote'])]);
    el.setFrozenRows(1);
  }
  const lote = Utilities.getUuid().slice(0, 8), ahora = new Date();
  const copia = filas.map(function (f) { return f.v.concat([ahora, lote]); });
  el.getRange(el.getLastRow() + 1, 1, copia.length, ENC_MOV.length + 2).setValues(copia);   // primero se guarda la copia…
  const h = hojaMovimientos();
  filas.map(function (f) { return f.fila; }).sort(function (a, b) { return b - a; }).forEach(function (n) { h.deleteRow(n); });   // …y luego se quita
  CACHE_MOVS_ = null;
  EXTRA_ = { lote: lote, borrados: ids.length, avisos: e.avisos, mover: e.mover };
  let msg = '🗑️ Eliminado' + (ids.length > 1 ? ' (' + ids.length + ' movimientos ligados)' : '') + ': ' + filas.map(function (f) { return String(f.v[2]); }).join(' · ');
  e.efectos.forEach(function (x) { msg += '\n' + x.cuenta + ': ' + pesos(x.antes) + ' → ' + pesos(x.despues); });
  e.avisos.forEach(function (a) { msg += '\n⚠️ ' + a; });
  return msg + '\n↩️ Quedó guardado en la pestaña "Eliminados": puedes deshacerlo.';
}

function restaurarMovimientos(p, cfg) {
  const lote = limpiar(p.lote);
  if (!lote) throw new Error('Falta el lote.');
  const el = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_ELIM);
  if (!el || el.getLastRow() < 2) throw new Error('No hay nada eliminado que restaurar.');
  const todo = el.getRange(2, 1, el.getLastRow() - 1, ENC_MOV.length + 2).getValues();
  const filas = [];
  todo.forEach(function (r, i) { if (String(r[ENC_MOV.length + 1]) === lote) filas.push({ fila: i + 2, v: r.slice(0, ENC_MOV.length) }); });
  if (!filas.length) throw new Error('Ese borrado ya se restauró o no existe.');
  const existentes = leerMovimientos();
  filas.forEach(function (f) { if (existentes.some(function (m) { return m.id === String(f.v[12]); })) throw new Error('Ya existe un movimiento con ese identificador; no se restaura para no duplicar.'); });
  const h = hojaMovimientos();
  const r0 = h.getLastRow() + 1;
  h.getRange(r0, 1, filas.length, ENC_MOV.length).setValues(filas.map(function (f) { return f.v; }));
  try { formatoFilas_(h, r0, filas.length); } catch (e) { /* cosmético */ }
  filas.map(function (f) { return f.fila; }).sort(function (a, b) { return b - a; }).forEach(function (n) { el.deleteRow(n); });
  CACHE_MOVS_ = null;
  return '↩️ Restaurado' + (filas.length > 1 ? ' (' + filas.length + ' movimientos)' : '') + ': ' + filas.map(function (f) { return String(f.v[2]); }).join(' · ');
}

function lineaPresupuesto(cfg, cat, fecha) {
  const c = cfg.categorias.find(function (x) { return x.nombre === cat; });
  if (!c || !c.grupo || !cfg.presupuestos[c.grupo]) return '';
  const tope = cfg.presupuestos[c.grupo];
  const est = calcular(leerMovimientos(), cfg, hoy());
  const g = est.presupuestosMes(clavesMes(fecha)).find(function (x) { return x.grupo === c.grupo; });
  const pct = Math.round(g.gastado / tope * 100);
  if (g.gastado > tope) return '🚨 ' + c.grupo + ': te pasaste ' + pesos(g.gastado - tope) + ' (' + pct + ' %)';
  return (pct >= 80 ? '⚠️ ' : '🎯 ') + c.grupo + ': ' + pesos(g.gastado) + ' de ' + pesos(tope) + ' (' + pct + ' %)';
}

/** Lo que el celular necesita para armar los menús. */
function configTelefono(cfg) {
  const movs = leerMovimientos();
  const est = calcular(movs, cfg, hoy());
  const activas = cfg.cuentas.filter(function (c) { return c.activa; });
  const fijos = estadoFijos(cfg, movs, hoy())
    .filter(function (o) { return !o.pagado && o.cobro === 'Manual' && o.dias <= 20 && o.dias >= -40 && !(o.aviso === 'Cancelar' && o.dias < 0); })
    .map(function (o) { return { n: o.nombre, v: o.valor, c: o.cuenta, p: o.periodo, f: fmt(o.fecha), d: o.dias }; });
  const deudaEst = {};
  est.deudas.forEach(function (d) { deudaEst[d.nombre] = d; });
  return {
    plata: activas.filter(function (c) { return c.tipo === 'Plata'; }).map(function (c) {
      return { n: c.nombre, e: c.emoji, s: Math.round(est.saldos[c.nombre] || 0), para: c.apartaPara || '' };
    }),
    deudas: activas.filter(function (c) { return c.tipo === 'Deuda'; }).map(function (c) {
      const b = bolsilloDe(cfg, c.nombre);
      const d = deudaEst[c.nombre] || {};
      return { n: c.nombre, e: c.emoji, cuotas: c.modo !== 'Sin cuotas', max: c.maxCuotas || 36,
        valor: c.pideValor, bolsillo: b ? b.nombre : '', desde: b ? (b.alimentaDesde || '') : '',
        s: Math.round(d.saldo || 0), pm: d.proximo ? Math.round(d.proximo.monto) : 0,
        pf: d.proximo ? fmtLargo(d.proximo.fecha) : '', pd: d.proximo ? d.proximo.dias : null,
        mama: c.nombre === CUENTA_MAMA };
    }),
    categorias: cfg.categorias.map(function (c) { return { n: c.nombre, e: c.emoji }; }),
    ingresos: cfg.ingresos.map(function (c) { return { n: c.nombre, e: c.emoji }; }),
    personas: est.personas.map(function (x) {
      const det = est.meDeben.find(function (y) { return y.persona === x.persona; });
      return { n: x.persona, debe: Math.max(0, x.saldo), ledebo: x.leDebes || 0,
        c: det ? det.conceptos.map(function (c) { return { k: c.key, d: c.desc, p: c.pendiente, m: c.delMes, q: c.proxima ? c.proxima.monto : 0, f: c.proxima ? c.proxima.fecha : '' }; }) : [] };
    }),
    fijos: fijos,
    mama: cfg.cuentas.some(function (c) { return c.nombre === CUENTA_MAMA && c.activa; }),
    efectivo: Math.round(est.saldos['Efectivo'] || 0),
    aprende: aprendizajeCategorias(movs, cfg),
    dic: diccionarioCategorias(cfg),
    v: 8
  };
}

/* ---------- Categoría automática: aprende de tu historial y, si no, usa un diccionario de comercios ---------- */
const PALABRAS_VACIAS = { de: 1, del: 1, la: 1, el: 1, los: 1, las: 1, para: 1, con: 1, por: 1, en: 1, y: 1, compra: 1, compras: 1, pago: 1, cuota: 1, san: 1, sas: 1, tienda: 1, tiendas: 1 };
function normalizarTexto(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function palabrasClave(t) { return normalizarTexto(t).split(' ').filter(function (w) { return w.length >= 2 && !PALABRAS_VACIAS[w] && !/^\d+$/.test(w); }); }

/** Diccionario base (palabra → categoría), solo con las categorías que existen en tu hoja. */
function diccionarioCategorias(cfg) {
  const base = [
    ['\\b(terpel|eds|gasolina|primax|biomax|texaco|combustible|tanqueo|parqueadero|peaje|peajes|uber|didi|cabify|taxi)\\b', 'Transporte'],
    ['\\b(d1|ara|exito|metro|makro|jumbo|carulla|olimpica|isimo|mercado|supermercado|fruver|carniceria|panaderia|huevos|leche)\\b', 'Mercado'],
    ['\\b(rappi|qbano|mcdonalds?|automac|sushi|pizza|hamburguesa|almuerzo|desayuno|cena|restaurante|cafe|kfc|frisby|corral|comida|helado|empanada|alitas|salchipapa|pollo)\\b', 'Comidas afuera'],
    ['\\b(koaj|movies|calzatodo|arturo calle|zara|ropa|zapatos|tenis|camisa|camiseta|pantalon|jean|saraluz|shein)\\b', 'Ropa'],
    ['\\b(smart ?fit|gimnasio|gym|proteina|creatina|suplementos?|whey)\\b', 'Gimnasio y suplementos'],
    ['\\b(youtube|netflix|spotify|google one|claude|disney|hbo|max|prime video|icloud|hevy|chatgpt|suscripcion)\\b', 'Suscripciones'],
    ['\\b(cine|cinemark|procinal|steam|playstation|xbox|nintendo|videojuegos?|juego|concierto|boleta|boletas)\\b', 'Entretenimiento y videojuegos'],
    ['\\b(luz|agua|gas|internet|movistar|claro|tigo|arriendo|servicios|epm|centrales electricas|aseo)\\b', 'Servicios públicos'],
    ['\\b(drogueria|farmacia|farmatel|cruz verde|locatel|medicamentos?|medico|cita medica|odontologo|examenes?)\\b', 'Salud y farmacia'],
    ['\\b(perras?|perros?|gatos?|mascotas?|veterinari[ao]|concentrado|petco)\\b', 'Mascotas'],
    ['\\b(regalo|regalos|detalle|cumpleanos|obsequio)\\b', 'Regalos y detalles'],
    ['\\b(homecenter|dollarcity|colchon|edredon|almohadas?|sillas?|muebles?|cortinas?|ikea|easy|decoracion)\\b', 'Hogar y enseres'],
    ['\\b(amazon|temu|aliexpress|mercado ?libre|cargador|audifonos|celular|computador|teclado|mouse|cable|accesorios?)\\b', 'Tecnología y accesorios']
  ];
  const hay = {};
  cfg.categorias.forEach(function (c) { hay[c.nombre] = true; });
  return base.filter(function (x) { return hay[x[1]]; });
}

/** Lo aprendido de tus gastos: descripción completa y palabras → la categoría que más les has puesto. */
function aprendizajeCategorias(movs, cfg) {
  const hay = {};
  cfg.categorias.forEach(function (c) { hay[c.nombre] = true; });
  const conteo = {};
  function sumar(k, cat) { const x = conteo[k] = conteo[k] || {}; x[cat] = (x[cat] || 0) + 1; }
  movs.forEach(function (m) {
    if (m.tipo !== TIPO.GASTO || !hay[m.cat] || (m.id && m.id.indexOf('fijo:') === 0)) return;
    const full = normalizarTexto(m.desc);
    if (!full) return;
    sumar('=' + full, m.cat);
    palabrasClave(m.desc).forEach(function (w) { sumar(w, m.cat); });
  });
  const out = {};
  Object.keys(conteo).forEach(function (k) {
    const x = conteo[k], cats = Object.keys(x).sort(function (a, b) { return x[b] - x[a]; });
    const total = cats.reduce(function (s, c) { return s + x[c]; }, 0);
    if (x[cats[0]] / total >= 0.6) out[k] = cats[0];
  });
  return out;
}

/** Categoría sugerida para una descripción (la misma lógica que usa el botón del celular). */
function sugerirCategoria(desc, cfg, movs) {
  if (!desc) return '';
  const apr = aprendizajeCategorias(movs || leerMovimientos(), cfg);
  const full = normalizarTexto(desc);
  if (apr['=' + full]) return apr['=' + full];
  const votos = {};
  palabrasClave(desc).forEach(function (w) { if (apr[w]) votos[apr[w]] = (votos[apr[w]] || 0) + 1; });
  const mejor = Object.keys(votos).sort(function (a, b) { return votos[b] - votos[a]; })[0];
  if (mejor) return mejor;
  const d = diccionarioCategorias(cfg).find(function (x) { return new RegExp(x[0]).test(full); });
  return d ? d[1] : '';
}

/* =================================================================
 * DASHBOARD
 * ================================================================= */

function doGet(e) {
  const clave = e && e.parameter && e.parameter.clave;
  // API para la app instalable (PWA): devuelve los datos en JSON.
  if (e && e.parameter && e.parameter.api) {
    try {
      return json({ ok: true, datos: datosDashboard(e.parameter.mes || '', clave) });
    } catch (err) {
      return json({ ok: false, error: err.message });
    }
  }
  if (!accesoPermitido(clave)) {
    return HtmlService.createHtmlOutput('<p style="font-family:sans-serif;padding:24px">🔒 Acceso restringido.</p>');
  }
  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('Mis finanzas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function accesoPermitido(clave) {
  if (CLAVE && clave === CLAVE) return true;
  const activo = Session.getActiveUser().getEmail();
  return !!activo && activo === Session.getEffectiveUser().getEmail();
}

/** Llamado desde Dashboard.html con google.script.run. mes = 'yyyy-MM' o ''. */
function datosDashboard(mes, clave) {
  if (!accesoPermitido(clave)) throw new Error('Acceso restringido');
  const lock = LockService.getScriptLock();
  if (lock.tryLock(8000)) {
    try { asegurarEsquema(); registrarFijosAutomaticos(leerConfig()); } finally { lock.releaseLock(); }
  }
  const cfg = leerConfig();
  const movs = leerMovimientos();
  const est = calcular(movs, cfg, hoy());
  const k = /^\d{4}-\d{2}$/.test(mes || '') ? mes : clavesMes(hoy());
  return armarDashboard(est, movs, cfg, k, hoy());
}

/* =================================================================
 * GASTOS FIJOS
 * ================================================================= */

/** Periodo al que pertenece un cobro: 'yyyy-MM' (mensual), 'yyyy' (anual) o 'unica'. */
function periodoDe(f, fecha) {
  if (f.frecuencia === 'Anual') return String(fecha.getFullYear());
  if (f.frecuencia === 'Una vez') return 'unica';
  return clavesMes(fecha);
}
function periodoActual(f, hoyF) {
  const o = ocurrencias(f, new Date(hoyF.getFullYear(), hoyF.getMonth() - 1, 1), new Date(hoyF.getFullYear(), hoyF.getMonth() + 2, 0));
  const pendiente = o.filter(function (x) { return x.fecha <= addDias(hoyF, 20); }).pop();
  return pendiente ? pendiente.periodo : periodoDe(f, hoyF);
}

/** Fechas de cobro de un gasto fijo entre desde y hasta. */
function ocurrencias(f, desde, hasta) {
  const out = [];
  if (f.frecuencia === 'Una vez') {
    if (f.proximo && f.proximo >= desde && f.proximo <= hasta) out.push({ fecha: f.proximo, periodo: 'unica' });
    return out;
  }
  if (f.frecuencia === 'Anual') {
    if (!f.proximo) return out;
    for (let y = desde.getFullYear() - 1; y <= hasta.getFullYear() + 1; y++) {
      const d = new Date(y, f.proximo.getMonth(), f.proximo.getDate());
      if (d >= desde && d <= hasta && d >= addDias(f.proximo, 0)) out.push({ fecha: d, periodo: String(y) });
    }
    return out;
  }
  let y = desde.getFullYear(), m = desde.getMonth();
  for (let i = 0; i < 40; i++) {
    const ultimo = new Date(y, m + 1, 0).getDate();
    const d = new Date(y, m, Math.min(f.dia || 1, ultimo));
    if (d > hasta) break;
    if (d >= desde) out.push({ fecha: d, periodo: clavesMes(d) });
    m++;
  }
  return out;
}

/** Cobros de gastos fijos alrededor de hoy, con su estado (pagado o no). */
function estadoFijos(cfg, movs, hoyF) {
  const ids = {};
  movs.forEach(function (m) { if (m.id) ids[m.id] = m; });
  const out = [];
  cfg.fijos.filter(function (f) { return f.activo; }).forEach(function (f) {
    ocurrencias(f, addDias(hoyF, -45), addDias(hoyF, 45)).forEach(function (o) {
      if (f.desde && o.fecha < f.desde) return;
      const id = 'fijo:' + f.nombre + ':' + o.periodo;
      out.push({
        nombre: f.nombre, valor: f.valor, cuenta: f.cuenta, categoria: f.categoria, cobro: f.cobro, aviso: f.aviso,
        frecuencia: f.frecuencia, fecha: o.fecha, periodo: o.periodo, dias: Math.round((o.fecha - hoyF) / 86400000),
        pagado: !!ids[id], id: id, compartido: f.compartido, porPersona: f.porPersona
      });
    });
  });
  return out.sort(function (a, b) { return a.fecha - b.fecha; });
}

/** Registra solos los gastos fijos automáticos cuyo día ya llegó. */
function registrarFijosAutomaticos(cfg) {
  cfg = cfg || leerConfig();
  const movs = leerMovimientos();
  const hoyF = hoy();
  let n = 0;
  estadoFijos(cfg, movs, hoyF).forEach(function (o) {
    if (o.cobro !== 'Automático' || o.pagado || o.dias > 0 || o.dias < -35) return;
    const f = cfg.fijos.find(function (x) { return x.nombre === o.nombre; });
    const cta = cfg.cuentas.find(function (c) { return c.nombre === f.cuenta; });
    if (!cta || cta.activa === false) return;
    const fin = financiacion(cta, f.valor, 1, 0);
    agregarMovimiento([o.fecha, TIPO.GASTO, f.nombre, f.valor, f.categoria, cta.nombre, '', repartoTexto(f),
      fin.cuotas, fin.valorCuota, fin.costo], o.id);
    n++;
  });
  return n;
}

function repartoTexto(f) {
  if (!f.compartido.length || !(f.porPersona > 0)) return '';
  return f.compartido.map(function (p) { return p + ':' + f.porPersona; }).join('; ');
}

/** Cuánto de un gasto es tuyo y cuánto le toca a cada persona. */
function reparto(m) {
  if (!m.para) return { mio: m.monto, otros: [] };
  if (m.para.indexOf(':') < 0) return { mio: 0, otros: [{ p: m.para, v: m.monto }] };
  const otros = m.para.split(';').map(function (s) {
    const x = s.split(':');
    return { p: String(x[0]).trim(), v: Number(String(x[1] || '').replace(/[^\d.-]/g, '')) || 0 };
  }).filter(function (x) { return x.p && x.v > 0; });
  const suma = otros.reduce(function (s, x) { return s + x.v; }, 0);
  return { mio: Math.max(0, m.monto - suma), otros: otros };
}

/* =================================================================
 * MOTOR DE CÁLCULO (funciones puras: no tocan la hoja)
 * ================================================================= */

function calcular(movs, cfg, hoyF) {
  const cuentas = {};
  cfg.cuentas.forEach(function (c) { cuentas[c.nombre] = c; });
  const saldos = {};
  cfg.cuentas.forEach(function (c) { saldos[c.nombre] = c.saldoInicial || 0; });

  function cuenta(nombre) {
    if (!cuentas[nombre]) {
      cuentas[nombre] = { nombre: nombre, tipo: 'Plata', emoji: '🏦', saldoInicial: 0, activa: false };
      saldos[nombre] = 0;
    }
    return cuentas[nombre];
  }
  function cuenta_(m, nombre) {
    if (esHist(m)) return false;
    const c = cuenta(nombre);
    return !c.saldoFecha || !m.registrado || m.registrado > c.saldoFecha;
  }
  function mover(nombre, deltaPlata) {
    const c = cuenta(nombre);
    saldos[nombre] += c.tipo === 'Deuda' ? -deltaPlata : deltaPlata;
  }
  // Serie de saldos por cuenta (para la gráfica de cada tarjeta).
  const series = {};
  cfg.cuentas.forEach(function (c) {
    series[c.nombre] = [{ f: c.saldoFecha ? fmt(soloFecha(c.saldoFecha)) : '', s: Math.round(c.saldoInicial || 0) }];
  });
  function anotar(nombre, fecha) {
    const s = series[nombre] = series[nombre] || [{ f: '', s: 0 }];
    const f = fmt(fecha), v = Math.round(saldos[nombre] || 0);
    // El primer punto es el saldo con que empezó la cuenta: nunca se pisa, así los movimientos del mismo día se ven en la línea.
    if (s.length > 1 && s[s.length - 1].f === f) s[s.length - 1].s = v; else s.push({ f: f, s: v });
  }
  movs = movs.slice().sort(function (a, b) { return (a.fecha - b.fecha) || ((a.registrado || 0) - (b.registrado || 0)); });

  const items = {};
  const pagos = {};
  const intCuotas = [];   // intereses de cada cuota (tarjetas con interés mensual): se suman a la deuda al llegar su corte
  const intCargado = {};  // intereses que ya entraron a la deuda de cada tarjeta (para auditar los saldos)
  const planInfo = {};
  const pagosMov = {};
  cfg.cuentas.filter(function (c) { return c.tipo === 'Deuda'; }).forEach(function (c) {
    items[c.nombre] = [];
    pagos[c.nombre] = 0;
    // Deudas que ya traías: cuotas con fecha
    let calendario = 0;
    cfg.previas.forEach(function (p, idx) {
      if (p.credito !== c.nombre) return;
      const fechas = fechasDesde(c, p.primerPago, p.cuotas, cfg);
      const esPlan = p.cuotas > 1 || p.de > 1;
      // Si la misma compra quedó en varias filas (cuotas de distinto valor), se une en un solo plan.
      const igual = esPlan && Object.keys(planInfo).filter(function (k) {
        const q = planInfo[k]; return q.cuenta === c.nombre && q.desc === p.detalle && q.n === p.de && p.de > 0;
      })[0];
      if (igual) {
        planInfo[igual].antes = Math.min(planInfo[igual].antes, p.desde ? p.desde - 1 : planInfo[igual].antes);
        planInfo[igual].vc = Math.min(planInfo[igual].vc, p.valor);
      }
      const idPlan = igual || 'prev:' + idx;
      const tarjeta = esTarjeta(c) && p.de > 1 && p.desde > 0 && !interesDiario(c);
      if (esPlan && !igual) planInfo['prev:' + idx] = { id: 'prev:' + idx, cuenta: c.nombre, desc: p.detalle, fecha: null, monto: 0, vc: p.valor,
        n: p.de || ((p.desde ? p.desde - 1 : 0) + p.cuotas), antes: p.desde ? p.desde - 1 : (p.de ? Math.max(0, p.de - p.cuotas) : 0), capital: p.capital || 0, mov: '',
        tarjeta: tarjeta ? { C: p.valor * p.de, r: c.tasa, d1: interesDesde1(c) } : null };
      for (let k = 0; k < p.cuotas; k++) {
        const etiqueta = p.desde && p.de ? ' (cuota ' + (p.desde + k) + ' de ' + p.de + ')' : p.cuotas > 1 ? ' (' + (k + 1) + ' de ' + p.cuotas + ')' : '';
        const intK = tarjeta ? interesCuotaTarjeta(p.valor * p.de, p.de, p.desde + k, c.tasa, interesDesde1(c)) : 0;
        if (intK > 0 && fechas[k]) intCuotas.push({ cuenta: c, limite: fechas[k], monto: intK });
        items[c.nombre].push({ fecha: fechas[k] || null, monto: p.valor + intK, capital: tarjeta ? p.valor : 0, desc: p.detalle + etiqueta, plan: esPlan ? idPlan : '', k: k });
        calendario += p.valor;
      }
    });
    const resto = Math.round((c.saldoInicial || 0) - calendario);
    if (resto > 100) items[c.nombre].push({ fecha: null, monto: resto, desc: 'Saldo anterior sin calendario' });
  });
  function item(deuda, it) { (items[deuda] = items[deuda] || []).push(it); }
  function pago(deuda, monto) { pagos[deuda] = (pagos[deuda] || 0) + monto; }

  const personas = {};
  function persona(n) { return personas[n] = personas[n] || { persona: n, prestado: 0, pagado: 0, recibido: 0, devuelto: 0, conceptos: [], abonos: [], prestamos: [], devoluciones: [] }; }
  (cfg.deudoresIniciales || []).forEach(function (x, i) {
    const p = persona(x.persona); p.prestado += x.monto; p.conceptos.push({ m: null, v: x.monto, concepto: x.concepto, key: 'ini:' + i, vence: x.vence || null });
    if (x.pagado > 0) { p.pagado += x.pagado; p.abonos.push({ fecha: '', monto: x.pagado, desc: 'Pagado antes de usar la app', aplica: 'ini:' + i }); }
  });

  movs.forEach(function (m) {
    if (m.tipo === TIPO.MEPAGARON) persona(m.para).abonos.push({ fecha: fmt(m.fecha), monto: m.monto, desc: m.desc, aplica: String(m.destino || '').indexOf('c:') === 0 ? m.destino.slice(2) : '' });
    if (m.tipo === TIPO.GASTO) {
      // A cada persona le toca su parte de cada cuota real (con los intereses de la tarjeta o el costo del crédito).
      reparto(m).otros.forEach(function (o) {
        const p = persona(o.p);
        const mc = montosCuotas(m, cuentas[m.cuenta]);
        const ratio = m.monto ? o.v / m.monto : 0;
        const montos = mc ? mc.map(function (x) { return x * ratio; }) : null;
        const tot = montos ? montos.reduce(function (s, x) { return s + x; }, 0) : o.v;
        p.prestado += tot;
        p.conceptos.push({ m: m, v: tot, montos: montos, key: m.id });
      });
      if (!cuenta_(m, m.cuenta)) return;
      const c = cuenta(m.cuenta);
      if (c.tipo === 'Deuda') {
        const n = m.cuotas || 1;
        const tarjeta = esTarjeta(c);
        const diario = interesDiario(c);
        // En tarjeta la deuda es el capital; los intereses se suman en cada corte (diarios o por cuota). En Addi/Credifin, el total con costo.
        const total = tarjeta ? m.monto : m.monto + (m.costo || 0);
        saldos[m.cuenta] += total;
        const vc = tarjeta ? m.monto / n : (m.valorCuota || total / n);
        const fechas = fechasCuotas(c, m.fecha, n, cfg);
        if (n > 1) planInfo[m.id] = { id: m.id, cuenta: c.nombre, desc: m.desc, fecha: m.fecha, monto: m.monto, vc: vc, n: n, antes: 0, capital: 0, mov: m.id,
          tarjeta: tarjeta && !diario ? { C: m.monto, r: c.tasa, d1: interesDesde1(c) } : null };
        for (let k = 0; k < n; k++) {
          const intK = tarjeta && !diario ? interesCuotaTarjeta(m.monto, n, k + 1, c.tasa, interesDesde1(c)) : 0;
          if (intK > 0 && fechas[k]) intCuotas.push({ cuenta: c, limite: fechas[k], monto: intK });
          const montoK = tarjeta ? vc + intK : (k < n - 1 ? vc : total - vc * (n - 1));
          item(c.nombre, { fecha: fechas[k], monto: montoK, capital: tarjeta ? vc : 0, desc: m.desc + (n > 1 ? ' (cuota ' + (k + 1) + ' de ' + n + ')' : ''), plan: n > 1 ? m.id : '', k: k });
        }
      } else {
        saldos[m.cuenta] -= m.monto;
      }
      anotar(m.cuenta, m.fecha);
    } else if (m.tipo === TIPO.INGRESO || m.tipo === TIPO.MEPAGARON) {
      if (m.tipo === TIPO.MEPAGARON) persona(m.para).pagado += m.monto;
      if (!cuenta_(m, m.cuenta)) return;
      mover(m.cuenta, m.monto);
      if (cuenta(m.cuenta).tipo === 'Deuda') pago(m.cuenta, m.monto);
      anotar(m.cuenta, m.fecha);
    } else if (m.tipo === TIPO.MEPRESTARON || m.tipo === TIPO.LEPAGUE) {
      // Plata con personas: te prestaron (entra) o les devolviste (sale). No es ingreso ni gasto.
      const pr = persona(m.para);
      const reg = { fecha: fmt(m.fecha), monto: m.monto, desc: m.desc, cuenta: m.cuenta };
      if (m.tipo === TIPO.MEPRESTARON) { pr.recibido += m.monto; pr.prestamos.push(reg); } else { pr.devuelto += m.monto; pr.devoluciones.push(reg); }
      if (!m.cuenta || !cuenta_(m, m.cuenta)) return;   // sin cuenta: deuda anotada "desde antes", no mueve saldos
      mover(m.cuenta, m.tipo === TIPO.MEPRESTARON ? m.monto : -m.monto);
      anotar(m.cuenta, m.fecha);
    } else if (m.tipo === TIPO.TRANSF) {
      if (cuenta_(m, m.cuenta)) {
        mover(m.cuenta, -m.monto);
        const c = cuenta(m.cuenta);
        if (c.tipo === 'Deuda') item(c.nombre, { fecha: fechasCuotas(c, m.fecha, 1, cfg)[0], monto: m.monto, desc: m.desc });
        anotar(m.cuenta, m.fecha);
      }
      if (m.destino && cuenta_(m, m.destino)) {
        mover(m.destino, m.monto);
        if (cuenta(m.destino).tipo === 'Deuda') pago(m.destino, m.monto);
        anotar(m.destino, m.fecha);
      }
    } else if (m.tipo === TIPO.AJUSTE) {
      if (!cuenta_(m, m.cuenta)) return;
      saldos[m.cuenta] += m.monto;
      anotar(m.cuenta, m.fecha);
      const c = cuenta(m.cuenta);
      if (c.tipo === 'Deuda') {
        if (m.monto < 0) pago(c.nombre, -m.monto);
        else item(c.nombre, { fecha: fechasCuotas(c, m.fecha, 1, cfg)[0], monto: m.monto, desc: 'Ajuste de saldo' });   // el extracto ya emitido no cambia: va al siguiente
      }
    }
  });

  // ---- Intereses de tarjeta (Opción A): en cada corte se suman a la deuda; el extracto solo cuadra diferencias ----
  // Interés mensual por cuota (p. ej. Nubank): el de cada cuota entra a la deuda el día de su corte.
  intCuotas.forEach(function (x) {
    const anc = x.cuenta.saldoFecha ? soloFecha(x.cuenta.saldoFecha) : null;
    const corte = (ciclos(x.cuenta, addDias(x.limite, -70), 4, cfg).filter(function (q) { return q.limite.getTime() === x.limite.getTime(); })[0] || {}).corte;
    if (corte && corte <= hoyF && (!anc || corte > anc)) { saldos[x.cuenta.nombre] += x.monto; intCargado[x.cuenta.nombre] = (intCargado[x.cuenta.nombre] || 0) + x.monto; }
  });
  // Interés diario (p. ej. Davibank): el motor calcula cada corte; los pasados entran a la deuda, el del corte en curso es un estimado.
  const motorInt = {};
  cfg.cuentas.filter(interesDiario).forEach(function (c) {
    const r = interesesDeTarjeta(c, movs, cfg, hoyF, items[c.nombre] || [], cuenta_);
    if (!r) return;
    motorInt[c.nombre] = r;
    r.cargos.forEach(function (cg) {
      if (cg.manual || !(cg.monto > 0)) return;
      if (!cg.futuro) { saldos[c.nombre] += cg.monto; intCargado[c.nombre] = (intCargado[c.nombre] || 0) + cg.monto; }
      item(c.nombre, { fecha: cg.limite, monto: cg.monto, desc: (cg.futuro ? 'Intereses estimados · corte del ' : 'Intereses · corte del ') + fmtLargo(cg.corte) });
    });
  });

  const mesHoy = clavesMes(hoyF);
  const finMes = new Date(hoyF.getFullYear(), hoyF.getMonth() + 1, 0);

  // Historia de las tarjetas antes de empezar: se reconstruye hacia atrás con los movimientos de los extractos.
  cfg.cuentas.filter(function (c) { return c.tipo === 'Deuda' && c.saldoFecha; }).forEach(function (c) {
    const hist = movs.filter(function (m) { return esHist(m) && (m.cuenta === c.nombre || m.destino === c.nombre); })
      .sort(function (a, b) { return b.fecha - a.fecha; });
    if (!hist.length) return;
    let s = c.saldoInicial || 0;
    const atras = [];
    hist.forEach(function (m) {
      const f = fmt(m.fecha);
      if (!atras.length || atras[atras.length - 1].f !== f) atras.push({ f: f, s: Math.round(s) });
      if (m.tipo === TIPO.GASTO && m.cuenta === c.nombre) s -= m.monto + (m.costo || 0);
      else if ((m.tipo === TIPO.TRANSF || m.tipo === TIPO.INGRESO) && m.destino === c.nombre) s += m.monto;
      else if (m.tipo === TIPO.TRANSF && m.cuenta === c.nombre) s -= m.monto;   // avance: antes de él, la deuda era menor
      else if (m.tipo === TIPO.INGRESO && m.cuenta === c.nombre) s += m.monto;
    });
    atras.push({ f: fmt(addDias(hist[hist.length - 1].fecha, -1)), s: Math.max(0, Math.round(s)) });
    const serie = series[c.nombre];
    const inicio = serie[0];
    series[c.nombre] = atras.reverse().filter(function (p) { return p.f < inicio.f; }).concat(serie);
  });

  // Compras de los extractos (históricas) a cuotas: se unen con su fila de "deudas que ya traías"; si no está, se estima su calendario.
  const estimados = {};
  movs.filter(function (m) { return esHist(m) && m.tipo === TIPO.GASTO && m.cuotas > 1 && cuentas[m.cuenta] && cuentas[m.cuenta].tipo === 'Deuda'; })
    .forEach(function (m) {
      const vc = m.valorCuota || m.monto / m.cuotas;
      const par = Object.keys(planInfo).map(function (k) { return planInfo[k]; }).filter(function (p) {
        return p.id.indexOf('prev:') === 0 && !p.mov && p.cuenta === m.cuenta && p.n === m.cuotas && Math.abs(p.vc - vc) <= 2;
      })[0];
      if (par) { par.mov = m.id; par.fecha = m.fecha; par.monto = m.monto; par.desc = m.desc; return; }
      const c = cuentas[m.cuenta];
      const fechas = fechasCuotas(c, m.fecha, m.cuotas, cfg);
      if (!fechas[m.cuotas - 1] || fechas[m.cuotas - 1] < addDias(hoyF, -45)) return;
      estimados[m.cuenta] = estimados[m.cuenta] || [];
      const tj = esTarjeta(c);
      estimados[m.cuenta].push({ info: { id: m.id, cuenta: m.cuenta, desc: m.desc, fecha: m.fecha, monto: m.monto, vc: vc, n: m.cuotas, antes: 0, capital: 0, mov: m.id, estimado: true },
        its: fechas.map(function (f, k) {
          const mk = vc + (tj && !interesDiario(c) ? interesCuotaTarjeta(m.monto, m.cuotas, k + 1, c.tasa, interesDesde1(c)) : 0);
          return { fecha: f, monto: mk, capital: tj ? vc : 0, restante: f && f <= hoyF ? 0 : mk, k: k };
        }) });
    });

  const deudas = cfg.cuentas.filter(function (c) { return c.tipo === 'Deuda'; }).map(function (c) {
    const lista = (items[c.nombre] || []).slice().sort(function (a, b) {
      const fa = a.fecha ? a.fecha.getTime() : Infinity, fb = b.fecha ? b.fecha.getTime() : Infinity;
      return fa - fb;
    });
    let disponible = pagos[c.nombre] || 0;
    lista.forEach(function (it) {
      const aplicado = Math.min(disponible, it.monto);
      it.restante = Math.round(it.monto - aplicado);
      disponible -= aplicado;
    });
    const pendientes = lista.filter(function (it) { return it.restante > 0 && it.fecha; });
    const fechas = [];
    pendientes.forEach(function (it) {
      if (!fechas.some(function (f) { return f.getTime() === it.fecha.getTime(); })) fechas.push(it.fecha);
    });
    function grupo(f) {
      if (!f) return null;
      const del = pendientes.filter(function (it) { return it.fecha.getTime() === f.getTime(); });
      return {
        fecha: f,
        monto: del.reduce(function (s, it) { return s + it.restante; }, 0),
        dias: Math.round((f - hoyF) / 86400000),
        detalle: del.map(function (it) { return { desc: it.desc, monto: it.restante }; })
      };
    }
    // Plan de pagos de cada compra a cuotas: qué cuotas van pagadas y cuánto capital falta.
    const porPlan = {};
    lista.forEach(function (it) { if (it.plan && planInfo[it.plan]) (porPlan[it.plan] = porPlan[it.plan] || []).push(it); });
    const grupos = Object.keys(porPlan).map(function (id) { return { info: planInfo[id], its: porPlan[id] }; }).concat(estimados[c.nombre] || []);
    const planes = grupos.map(function (g) {
      // Fechas de las cuotas que ya estaban antes de empezar, según el ciclo de la tarjeta.
      let antes = null;
      const primera = g.its.map(function (it) { return it.fecha; }).filter(Boolean).sort(function (a, b) { return a - b; })[0];
      if (g.info.antes > 0 && primera && c.modo === 'Corte mensual') {
        antes = ciclos(c, addDias(primera, -35 * (g.info.antes + 1)), g.info.antes + 4, cfg).map(function (x) { return x.limite; })
          .filter(function (l) { return l < primera; }).slice(-g.info.antes);
        if (antes.length < g.info.antes) antes = null;
      }
      return armarPlan(g.info, g.its, hoyF, antes);
    })
      .filter(function (p) { return p.pendiente > 0 || (p.ultima && p.ultima >= fmt(addDias(hoyF, -60))); })
      .sort(function (a, b) { return (b.pendiente > 0) - (a.pendiente > 0) || (a.fecha < b.fecha ? 1 : -1); });
    // Fechas de pago para el calendario (también las ya pagadas, para verlas en verde).
    const pagosCal = {};
    lista.forEach(function (it) {
      if (!it.fecha || it.fecha < addDias(hoyF, -62) || it.fecha > addDias(hoyF, 130)) return;
      const f = fmt(it.fecha), x = pagosCal[f] = pagosCal[f] || { fecha: f, monto: 0, restante: 0 };
      x.monto += it.monto; x.restante += it.restante;
    });
    const sinFecha = lista.filter(function (it) { return it.restante > 0 && !it.fecha; })
      .reduce(function (s, it) { return s + it.restante; }, 0);
    const b = bolsilloDe(cfg, c.nombre);
    let reto = null;
    if (c.comprasMin > 0) {
      const hechas = movs.filter(function (m) {
        return m.tipo === TIPO.GASTO && m.cuenta === c.nombre && clavesMes(m.fecha) === mesHoy && m.cat !== CAT_INTERESES;
      }).length;
      reto = { hechas: hechas, minimo: c.comprasMin, diasRestantes: Math.round((finMes - hoyF) / 86400000) };
    }
    // Intereses y cargos: cobros reales del banco (intereses, seguros, comisiones, incluidos los de los extractos)
    // + intereses estimados de las compras a cuotas hasta el próximo corte (los periodos que aún no están en un extracto).
    const propios = movs.filter(function (m) { return m.cuenta === c.nombre; });
    let reales = 0, ultimoReal = null;
    const desdeCiclo = inicioCiclo(c, hoyF, cfg);
    propios.forEach(function (m) {
      if (m.cat !== CAT_INTERESES) return;
      if (m.tipo === TIPO.GASTO || (m.tipo === TIPO.AJUSTE && m.monto > 0)) {
        if (m.fecha > desdeCiclo) reales += m.monto;
        if ((m.tipo === TIPO.AJUSTE || /inter/i.test(m.desc)) && (!ultimoReal || m.fecha > ultimoReal)) ultimoReal = m.fecha;
      }
    });
    const tope = c.modo === 'Por compra' || c.modo === 'Sin cuotas' ? null : (ciclos(c, hoyF, 1, cfg)[0] || {}).corte || null;
    const mi = motorInt[c.nombre];
    const estimadosInt = mi ? (mi.abierto && !mi.abierto.manual ? mi.abierto.monto : 0)
      : propios.filter(function (m) { return m.tipo === TIPO.GASTO && m.cat !== CAT_INTERESES; })
        .reduce(function (s, m) { return s + interesCompra(m, c, cfg, hoyF, ultimoReal); }, 0);
    const intereses = Math.round(reales + estimadosInt);
    return {
      nombre: c.nombre, emoji: c.emoji, activa: c.activa, modo: c.modo,
      saldo: Math.round(saldos[c.nombre] || 0),
      cupo: c.cupo || 0,
      serie: (series[c.nombre] || []).slice(-30),
      proximo: grupo(fechas[0]),
      siguiente: grupo(fechas[1]),
      calendario: fechas.map(grupo),
      sinFecha: sinFecha,
      bolsillo: b ? b.nombre : '',
      apartado: b ? Math.round(saldos[b.nombre] || 0) : 0,
      reto: reto,
      intereses: intereses,
      interesesEst: Math.round(estimadosInt),
      interesesHoy: mi ? mi.hastaHoy : null,
      ahorroTotal: mi ? mi.ahorro : 0,
      interesDiario: !!mi,
      interesCargado: Math.round(intCargado[c.nombre] || 0),
      planes: planes,
      pagosCal: Object.keys(pagosCal).sort().map(function (f) { const x = pagosCal[f]; return { fecha: f, monto: Math.round(x.monto), restante: Math.round(x.restante) }; }),
      corteEst: tope ? fmt(tope) : '',
      cicloDesde: fmt(desdeCiclo)
    };
  });

  const listaPersonas = Object.keys(personas).map(function (n) {
    const p = personas[n];
    const A = p.prestado - p.pagado;                       // lo que te debe por compras (negativo = te pagó de más)
    const leDebes = Math.max(0, p.recibido - p.devuelto + Math.max(0, -A));
    return { persona: n, prestado: p.prestado, pagado: p.pagado, saldo: Math.round(Math.max(0, A)), leDebes: Math.round(leDebes),
      neto: Math.round(A + p.devuelto - p.recibido) };
  }).sort(function (a, b) { return b.saldo - a.saldo; });
  const meDeben = listaPersonas.filter(function (p) { return p.saldo > 0; }).map(function (x) {
    return Object.assign({}, x, detallePersona(personas[x.persona], cuenta, cfg, hoyF));
  });
  // Les debes: plata que te prestaron (menos lo que les devolviste) y pagos de más que quedaron a su favor.
  const lesDebo = listaPersonas.filter(function (p) { return p.leDebes > 0; }).map(function (x) {
    const p = personas[x.persona];
    return { persona: x.persona, saldo: x.leDebes, aFavor: Math.round(Math.max(0, p.pagado - p.prestado)), teDebe: x.saldo, neto: x.neto,
      prestamos: p.prestamos.slice().reverse(), devoluciones: p.devoluciones.slice().reverse() };
  }).sort(function (a, b) { return b.saldo - a.saldo; });

  const plata = Object.keys(cuentas).filter(function (n) { return cuentas[n].tipo === 'Plata'; }).map(function (n) {
    const c = cuentas[n];
    return { nombre: n, emoji: c.emoji, saldo: Math.round(saldos[n]), activa: c.activa !== false,
      apartaPara: c.apartaPara || '', alimentaDesde: c.alimentaDesde || '', serie: (series[n] || []).slice(-30) };
  }).filter(function (c) { return c.activa || c.saldo !== 0; });

  const totalPlata = plata.reduce(function (s, c) { return s + c.saldo; }, 0);
  const totalDeudas = deudas.reduce(function (s, d) { return s + d.saldo; }, 0);
  const totalMeDeben = meDeben.reduce(function (s, p) { return s + p.saldo; }, 0);
  const totalLesDebo = lesDebo.reduce(function (s, p) { return s + p.saldo; }, 0);

  function gastosMes(claveMes) {
    const cats = {};
    function sumar(cat, v) { if (v) cats[cat] = (cats[cat] || 0) + v; }
    movs.forEach(function (m) {
      if (clavesMes(m.fecha) !== claveMes || !cuentaEnResumen(m)) return;
      if (m.tipo === TIPO.GASTO) {
        sumar(m.cat || 'Otros', reparto(m).mio);
        if (m.costo > 0 && !esTarjeta(cuentas[m.cuenta])) sumar(CAT_INTERESES, m.costo);
      } else if (m.tipo === TIPO.AJUSTE && m.cat === CAT_SIN_ID && m.monto < 0) {
        sumar(CAT_SIN_ID, -m.monto);
      } else if (m.tipo === TIPO.AJUSTE && m.cat === CAT_INTERESES && m.monto > 0) {
        sumar(CAT_INTERESES, m.monto);
      }
    });
    return cats;
  }
  function ingresosMes(claveMes) {
    const tipos = {};
    movs.forEach(function (m) {
      if (m.tipo === TIPO.INGRESO && clavesMes(m.fecha) === claveMes && cuentaEnResumen(m)) tipos[m.cat || 'Otros'] = (tipos[m.cat || 'Otros'] || 0) + m.monto;
    });
    return tipos;
  }
  function presupuestosMes(claveMes) {
    const cats = gastosMes(claveMes);
    return Object.keys(cfg.presupuestos).map(function (g) {
      const incluidas = cfg.categorias.filter(function (c) { return c.grupo === g; }).map(function (c) { return c.nombre; });
      const gastado = incluidas.reduce(function (s, n) { return s + (cats[n] || 0); }, 0);
      return { grupo: g, tope: cfg.presupuestos[g], gastado: gastado, categorias: incluidas };
    });
  }

  return {
    saldos: saldos, plata: plata, deudas: deudas, meDeben: meDeben, personas: listaPersonas,
    totalPlata: totalPlata, totalDeudas: totalDeudas, totalMeDeben: totalMeDeben, lesDebo: lesDebo, totalLesDebo: totalLesDebo,
    patrimonio: totalPlata + totalMeDeben - totalDeudas - totalLesDebo,
    gastosMes: gastosMes, ingresosMes: ingresosMes, presupuestosMes: presupuestosMes
  };
}

/**
 * Intereses estimados de una compra a cuotas, desde el día de la compra hasta el próximo corte de la tarjeta.
 * Cada periodo (de corte a corte) cobra la tasa mensual, por los días del periodo, sobre el capital que falta.
 * No estima los periodos que ya están cubiertos por intereses reales de un extracto (ultimoReal).
 */
function interesCompra(m, c, cfg, hoyF, ultimoReal) {
  const n = Number(m.cuotas) || 1;
  if (c.tipo !== 'Deuda' || c.modo === 'Sin cuotas' || n < 2 || !(c.tasa > 0)) return 0;
  const cubiertoT = ultimoReal ? addDias(ultimoReal, 5) : null;
  if (esTarjeta(c)) {
    // Intereses de la cuota que se factura en el próximo corte.
    const cs = ciclos(c, addDias(m.fecha, 1), n, cfg).map(function (x) { return x.corte; });
    const k = cs.findIndex(function (x) { return x >= hoyF; });
    if (k < 0 || (cubiertoT && cs[k] <= cubiertoT)) return 0;
    return interesCuotaTarjeta(m.monto, n, k + 1, c.tasa, interesDesde1(c));
  }
  let cortes = [];
  if (c.modo === 'Por compra') { for (let k = 1; k <= n; k++) cortes.push(addMeses(m.fecha, k)); }
  else cortes = ciclos(c, addDias(m.fecha, 1), n, cfg).map(function (x) { return x.corte; });
  const capital = m.monto * (1 + (c.cargo || 0));
  const cubierto = ultimoReal ? addDias(ultimoReal, 5) : null;
  // Solo el ciclo de facturación en curso: el periodo que termina en el primer corte desde hoy.
  let total = 0;
  let inicio = m.fecha;
  for (let k = 0; k < cortes.length; k++) {
    const corte = cortes[k];
    if (corte >= hoyF) {
      if (!cubierto || corte > cubierto) {
        const dias = Math.max(0, Math.round((corte - inicio) / 86400000));
        total += capital * (n - k) / n * (Math.pow(1 + c.tasa, dias / 30) - 1);
        if (k === 0) total += m.monto * (c.cargo || 0);
      }
      break;
    }
    inicio = corte;
  }
  return Number(m.costo) > 0 ? Math.min(total, Number(m.costo)) : total;
}

/**
 * Intereses diarios de una tarjeta. Modelo verificado con extractos reales de Davibank (agosto: exacto; septiembre: $18 de
 * diferencia en $57.258):
 * - tasa diaria = tasa mensual / 30; se causa cada día sobre el CAPITAL que se debe (no sobre intereses ni cargos);
 * - compras a cuotas y avances: desde el día de la compra, incluido;
 * - compras a 1 cuota: sin interés si el extracto se paga COMPLETO antes de la fecha límite; si no, se cobran desde la
 *   fecha de compra hasta su corte (en el extracto siguiente) y siguen causando hasta pagarse;
 * - un pago reduce el capital desde el día siguiente y cubre primero intereses y cargos ya facturados.
 * o: { tasa: número (mensual) o función(fecha)→tasa mensual, inicio, cap0, nocap0, prev: {una:[{fecha,monto}], corte, limite, total} | null,
 *      ciclos: [{corte, limite}] desde el primero ≥ inicio, eventos: [{fecha, tipo: compra|avance|cargo|pago, monto, n}],
 *      hoy, escenario: 'minimo'|'total', cuotaEn: función(limite)→capital programado para esa fecha }
 */
function motorDiario(o) {
  const tasa = typeof o.tasa === 'function' ? o.tasa : function () { return o.tasa; };
  const suma = function (l) { return l.reduce(function (s, x) { return s + x.monto; }, 0); };
  let cap = Math.max(0, o.cap0 || 0), nocap = Math.max(0, o.nocap0 || 0);
  let prev = o.prev ? Object.assign({ pagado: 0, nocap: Math.max(0, o.nocap0 || 0) }, o.prev) : null;
  let abiertos = [], iTodo = 0, iSin = 0, hastaHoy = null;
  const cargos = [];
  const evs = o.eventos.slice().sort(function (a, b) { return a.fecha - b.fecha; });
  let e = 0, k = 0, guard = 0;
  const retroDe = function (p) { return p ? p.una.reduce(function (s, x) { return s + x.monto * tasa(x.fecha) / 30 * (Math.round((p.corte - x.fecha) / 86400000) + 1); }, 0) : 0; };
  for (let d = new Date(o.inicio); k < o.ciclos.length && guard++ < 2000; d = addDias(d, 1)) {
    const ciclo = o.ciclos[k];
    const pagos = [];
    while (e < evs.length && evs[e].fecha <= d) {
      const ev = evs[e++];
      if (ev.tipo === 'compra') { cap += ev.monto; if ((ev.n || 1) <= 1) abiertos.push({ fecha: ev.fecha, monto: ev.monto }); }
      else if (ev.tipo === 'avance') cap += ev.monto;
      else if (ev.tipo === 'cargo') nocap += ev.monto;
      else if (ev.tipo === 'pago') pagos.push(ev.monto);
    }
    // Pago proyectado (días futuros): el que vence en la fecha límite del extracto anterior.
    if (d > o.hoy && prev && prev.limite && d.getTime() === prev.limite.getTime()) {
      const objetivo = o.escenario === 'total' ? prev.total : Math.min(prev.total, (o.cuotaEn ? o.cuotaEn(prev.limite) : 0) + prev.nocap);
      if (objetivo - prev.pagado > 0) pagos.push(objetivo - prev.pagado);
    }
    const r = tasa(d) / 30;
    const exAb = suma(abiertos), exPrev = prev && prev.limite && d <= prev.limite ? suma(prev.una) : 0;
    iTodo += r * Math.max(0, cap - exAb);
    iSin += r * Math.max(0, cap - exAb - exPrev);
    pagos.forEach(function (p) {
      const aNo = Math.min(nocap, p); nocap -= aNo; cap = Math.max(0, cap - (p - aNo));
      if (prev && d > prev.corte && (!prev.limite || d <= prev.limite)) prev.pagado += p;
    });
    if (d.getTime() === o.hoy.getTime()) {
      const g = !prev || (prev.limite && prev.limite < o.hoy ? prev.pagado >= prev.total - 1 : o.escenario === 'total');
      hastaHoy = Math.round(g ? iSin : iTodo + retroDe(prev));
    }
    if (d.getTime() === ciclo.corte.getTime()) {
      const gracia = !prev || prev.pagado >= prev.total - 1;
      const retro = gracia ? 0 : retroDe(prev);
      const monto = Math.round((gracia ? iSin : iTodo) + retro);
      nocap += monto;
      cargos.push({ corte: ciclo.corte, limite: ciclo.limite, monto: monto, retro: Math.round(retro), gracia: gracia, futuro: ciclo.corte > o.hoy });
      prev = { una: abiertos, corte: ciclo.corte, limite: ciclo.limite, total: cap + nocap, pagado: 0, nocap: nocap };
      abiertos = []; iTodo = 0; iSin = 0; k++;
    }
  }
  return { cargos: cargos, hastaHoy: hastaHoy };
}

/**
 * Intereses de una tarjeta con el modelo diario: arma el estado al inicio del ciclo en que se tomó el saldo inicial
 * (con los movimientos históricos de los extractos) y corre el motor hasta el corte en curso.
 * Devuelve los cargos de cada corte (los pasados se suman a la deuda) y el estimado del corte en curso.
 */
function interesesDeTarjeta(c, movs, cfg, hoyF, its, cuentaOK) {
  const propios = movs.filter(function (m) { return m.cuenta === c.nombre || m.destino === c.nombre; });
  const anc = c.saldoFecha ? soloFecha(c.saldoFecha) : null;
  if (!anc && !propios.length) return null;
  const base = anc || propios.reduce(function (a, m) { return m.fecha < a ? m.fecha : a; }, propios[0].fecha);
  const antes = ciclos(c, addDias(base, -80), 6, cfg).filter(function (x) { return x.corte < base; });
  const pc = antes.length ? antes[antes.length - 1] : null, ppc = antes.length > 1 ? antes[antes.length - 2] : null;
  const inicio = pc ? addDias(pc.corte, 1) : base;
  const evento = function (m) {
    if (m.tipo === TIPO.GASTO && m.cuenta === c.nombre) {
      return m.cat === CAT_INTERESES ? { fecha: m.fecha, tipo: 'cargo', monto: m.monto, interes: /inter[eé]s/i.test(m.desc) }
        : { fecha: m.fecha, tipo: 'compra', monto: m.monto, n: m.cuotas || 1 };
    }
    if (m.tipo === TIPO.TRANSF && m.cuenta === c.nombre) return { fecha: m.fecha, tipo: 'avance', monto: m.monto };
    if ((m.tipo === TIPO.TRANSF || m.tipo === TIPO.INGRESO || m.tipo === TIPO.MEPAGARON) && (m.destino === c.nombre || (m.tipo !== TIPO.TRANSF && m.cuenta === c.nombre)))
      return { fecha: m.fecha, tipo: 'pago', monto: m.monto };
    if (m.tipo === TIPO.MEPRESTARON && m.cuenta === c.nombre) return { fecha: m.fecha, tipo: 'pago', monto: m.monto };
    if (m.tipo === TIPO.AJUSTE && m.cuenta === c.nombre) return m.monto < 0 ? { fecha: m.fecha, tipo: 'pago', monto: -m.monto } : { fecha: m.fecha, tipo: 'cargo', monto: m.monto };
    return null;
  };
  const efecto = function (x) { return x.tipo === 'pago' ? -x.monto : x.monto; };
  const eventos = [], unaPrev = [];
  let ventana = 0, nocap0 = 0;
  propios.forEach(function (m) {
    const x = evento(m); if (!x) return;
    if (esHist(m)) {
      if (anc && m.fecha >= inicio && m.fecha <= anc) { eventos.push(x); ventana += efecto(x); }
      else if (pc && ppc && m.fecha > ppc.corte && m.fecha <= pc.corte) {
        if (x.tipo === 'cargo') nocap0 += x.monto;
        if (x.tipo === 'compra' && x.n <= 1) unaPrev.push({ fecha: m.fecha, monto: m.monto });
      }
    } else if (cuentaOK(m, c.nombre)) eventos.push(x);
  });
  const b0 = anc ? (c.saldoInicial || 0) - ventana : 0;
  // Un interés registrado a mano (p. ej. copiado de un extracto) reemplaza el cálculo de ese corte.
  const manuales = eventos.filter(function (x) { return x.tipo === 'cargo' && x.interes; });
  const lista = ciclos(c, inicio, 60, cfg);
  const fin = lista.findIndex(function (x) { return x.corte >= hoyF; });
  // Hasta el corte en curso y 6 más: los futuros son estimados (suponiendo que pagas lo que dice el calendario) para ver las próximas cuotas con intereses.
  const cs = fin >= 0 ? lista.slice(0, fin + 7) : lista;
  if (!cs.length) return null;
  const cuotaEn = function (lim) {
    return its.filter(function (it) { return it.fecha && it.fecha.getTime() === lim.getTime(); }).reduce(function (s, it) { return s + it.monto; }, 0);
  };
  const correr = function (esc) {
    return motorDiario({ tasa: c.tasa, inicio: inicio, cap0: Math.max(0, b0 - nocap0), nocap0: nocap0, eventos: eventos, ciclos: cs, hoy: hoyF,
      escenario: esc, cuotaEn: cuotaEn, prev: pc && b0 > 0 ? { una: unaPrev, corte: pc.corte, limite: pc.limite, total: b0 } : null });
  };
  const r = correr('minimo');
  r.cargos.forEach(function (cg) {
    cg.manual = manuales.some(function (x) { return x.fecha > addDias(cg.corte, -6) && x.fecha <= cg.limite; });
  });
  const abierto = r.cargos.filter(function (cg) { return cg.futuro; })[0] || null;
  let ahorro = 0;
  if (abierto) {
    const t = correr('total').cargos.filter(function (cg) { return cg.futuro; })[0];
    ahorro = t ? Math.max(0, abierto.monto - t.monto) : 0;
  }
  return { cargos: r.cargos, hastaHoy: r.hastaHoy, abierto: abierto, ahorro: ahorro };
}
/** Tarjetas con intereses diarios desde el día de la compra (Davibank). Las demás: interés mensual por cuota (Nubank). */
function interesDiario(c) { return esTarjeta(c) && interesDesde1(c) && c.tasa > 0; }

/** Día en que empezó el ciclo de facturación en curso (el último corte antes de hoy). */
function inicioCiclo(c, hoyF, cfg) {
  if (c.modo !== 'Corte mensual') return new Date(hoyF.getFullYear(), hoyF.getMonth(), 1);
  const previos = ciclos(c, addDias(hoyF, -70), 4, cfg).filter(function (x) { return x.corte < hoyF; });
  return previos.length ? previos[previos.length - 1].corte : addDias(hoyF, -30);
}

/** Plan de pagos de una compra: cada cuota con su fecha y estado, y el capital que falta (en Addi, el de su app). */
function armarPlan(info, its, hoyF, fechasAntes) {
  its = its.slice().sort(function (a, b) { return (a.fecha ? a.fecha.getTime() : 0) - (b.fecha ? b.fecha.getTime() : 0); });
  const suma = function (l, f) { return l.reduce(function (s, x) { return s + f(x); }, 0); };
  const cuotas = [];
  const primera = its[0] && its[0].fecha;
  // Cuotas anteriores a las que faltan: pagadas si su fecha ya pasó; si no, van dentro del extracto que está por pagarse.
  let enExtracto = 0, enExtractoCap = 0;
  for (let k = 0; k < info.antes; k++) {
    const f = fechasAntes ? fechasAntes[k] : primera ? addMeses(primera, k - info.antes) : null;
    const paga = !f || f < hoyF;
    const mk = info.vc + (info.tarjeta ? interesCuotaTarjeta(info.tarjeta.C, info.n, k + 1, info.tarjeta.r, info.tarjeta.d1) : 0);
    if (!paga) { enExtracto += mk; enExtractoCap += info.vc; }
    cuotas.push({ n: k + 1, fecha: f ? fmt(f) : '', monto: Math.round(mk), pagado: paga ? Math.round(mk) : 0, estado: paga ? 'pagada' : 'pendiente', extracto: !paga });
  }
  its.forEach(function (it, j) {
    cuotas.push({ n: info.antes + j + 1, fecha: it.fecha ? fmt(it.fecha) : '', monto: Math.round(it.monto), pagado: Math.round(it.monto - it.restante),
      estado: it.restante <= 0.5 ? 'pagada' : it.fecha && it.fecha < hoyF ? 'vencida' : 'pendiente' });
  });
  const total = suma(cuotas, function (x) { return x.monto; });
  const pendiente = suma(its, function (x) { return x.restante; }) + enExtracto;
  const montoIts = suma(its, function (x) { return x.monto; });
  const capTotal = Math.round(info.monto || total);
  const conCapital = its.length && its.every(function (x) { return x.capital > 0; });
  const capPend = info.capital > 0 ? (montoIts > 0 ? info.capital * (pendiente - enExtracto) / montoIts : 0)
    : conCapital ? suma(its, function (x) { return x.capital * x.restante / x.monto; }) + enExtractoCap
    : (total > 0 ? capTotal * pendiente / total : 0);
  const prox = cuotas.filter(function (x) { return x.estado !== 'pagada'; })[0] || null;
  return {
    id: info.id, mov: info.mov || '', cuenta: info.cuenta, desc: info.desc, fecha: info.fecha ? fmt(info.fecha) : '', monto: capTotal,
    cuotas: Math.max(info.n || 0, cuotas.length), valorCuota: Math.round(info.vc), total: Math.round(total),
    pagadas: cuotas.filter(function (x) { return x.estado === 'pagada'; }).length, pendiente: Math.round(pendiente),
    capitalPendiente: Math.round(Math.min(capPend, capTotal)), capitalApp: info.capital > 0, estimado: !!info.estimado,
    proxima: prox ? { fecha: prox.fecha, monto: prox.monto - prox.pagado } : null,
    ultima: cuotas.length ? cuotas[cuotas.length - 1].fecha : '', detalle: cuotas
  };
}

/** Por qué te debe plata una persona: cada concepto, sus cuotas y cuánto te ha pagado (los abonos cubren primero lo más antiguo). */
function detallePersona(p, cuenta, cfg, hoyF) {
  const conceptos = p.conceptos.map(function (x) {
    const m = x.m;
    if (!m) {
      // Deuda que ya traía: si coincide con una compra a cuotas de "deudas que ya traías", usa su calendario.
      const idx = (cfg.previas || []).findIndex(function (q) { return q.cuotas > 1 && Math.abs(q.valor * q.cuotas - x.v) <= 2; });
      if (idx >= 0) {
        const q = cfg.previas[idx];
        const fs = fechasDesde(cuenta(q.credito), q.primerPago, q.cuotas, cfg);
        const vq = Math.round(x.v / q.cuotas);
        return { key: x.key, fecha: null, desc: x.concepto || q.detalle, cuenta: q.credito, total: x.v, cuotas: q.cuotas, valorCuota: vq, plan: 'prev:' + idx,
          unidades: fs.map(function (f, k) { return { f: f, v: k < q.cuotas - 1 ? vq : x.v - vq * (q.cuotas - 1), pagado: 0 }; }) };
      }
      return { key: x.key, fecha: null, vence: x.vence || null, desc: x.concepto || 'Saldo que ya te debía', cuenta: '', total: x.v, cuotas: 1, valorCuota: x.v, plan: '', unidades: [{ f: x.vence || null, v: x.v, pagado: 0 }] };
    }
    const c = cuenta(m.cuenta);
    const n = x.montos ? x.montos.length : 1;
    const vence = n > 1 ? null : ((cfg.fechasFavor || {})[m.id] || null);   // fecha de pago pactada del favor (opcional)
    const fechas = n > 1 ? fechasCuotas(c, m.fecha, n, cfg) : [vence || m.fecha];
    const vc = Math.round(x.v / n);
    return {
      key: x.key, fecha: m.fecha, vence: vence, desc: m.desc, cuenta: m.cuenta, total: x.v, cuotas: n, valorCuota: vc, plan: n > 1 ? m.id : '',
      unidades: fechas.map(function (f, k) { return { f: f || m.fecha, v: x.montos ? x.montos[k] : x.v, pagado: 0 }; })
    };
  });
  const todas = [];
  conceptos.forEach(function (c) { c.unidades.forEach(function (u) { todas.push(u); }); });
  todas.sort(function (a, b) { return (a.f ? a.f.getTime() : 0) - (b.f ? b.f.getTime() : 0); });
  // Abonos: los que dijiste a qué compra iban se aplican ahí primero; el resto cubre lo más antiguo.
  let libre = 0;
  const porFecha = function (a, b) { return (a.f ? a.f.getTime() : 0) - (b.f ? b.f.getTime() : 0); };
  p.abonos.forEach(function (a) {
    let q = a.monto;
    const dest = a.aplica && conceptos.find(function (c) { return c.key === a.aplica; });
    if (dest) dest.unidades.slice().sort(porFecha).forEach(function (u) { const x = Math.min(q, u.v - u.pagado); if (x > 0) { u.pagado += x; q -= x; } });
    libre += q;
  });
  todas.forEach(function (u) { const a = Math.min(libre, u.v - u.pagado); if (a > 0) { u.pagado += a; libre -= a; } });
  let vencido = 0;
  const lista = conceptos.map(function (c) {
    const pend = c.unidades.filter(function (u) { return u.v - u.pagado > 0.5; });
    pend.forEach(function (u) { if (!u.f || u.f <= hoyF) vencido += u.v - u.pagado; });
    const prox = pend.filter(function (u) { return u.f && u.f > hoyF; })[0] || null;
    const finMes = new Date(hoyF.getFullYear(), hoyF.getMonth() + 1, 0);
    const delMes = pend.filter(function (u) { return !u.f || u.f <= finMes; }).reduce(function (s, u) { return s + u.v - u.pagado; }, 0);
    return {
      key: c.key, delMes: Math.round(delMes),
      fecha: c.fecha ? fmt(c.fecha) : '', vence: c.vence ? fmt(c.vence) : '', desc: c.desc, cuenta: c.cuenta, total: Math.round(c.total), cuotas: c.cuotas, plan: c.plan,
      detalle: c.cuotas > 1 ? c.unidades.map(function (u) { return { fecha: u.f ? fmt(u.f) : '', monto: Math.round(u.v), pagado: Math.round(u.pagado) }; }) : [],
      valorCuota: c.cuotas > 1 ? Math.round(c.unidades[0].v) : Math.round(c.total),
      cuotasPagadas: c.unidades.length - pend.length,
      pendiente: Math.round(pend.reduce(function (s, u) { return s + u.v - u.pagado; }, 0)),
      proxima: prox ? { fecha: fmt(prox.f), monto: Math.round(prox.v - prox.pagado) } : null,
      ultima: c.cuotas > 1 && c.unidades[c.unidades.length - 1].f ? fmt(c.unidades[c.unidades.length - 1].f) : ''
    };
  });
  const pendientes = lista.filter(function (c) { return c.pendiente > 0; }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
  const pagados = lista.filter(function (c) { return c.pendiente <= 0; }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }).slice(0, 5);
  return { conceptos: pendientes, pagados: pagados, abonos: p.abonos.slice().reverse().slice(0, 10), vencido: Math.round(vencido) };
}

/** Arma el objeto que pinta el dashboard para un mes dado. */
function armarDashboard(est, movs, cfg, claveMes, hoyF) {
  const suma = function (o) { return Object.keys(o).reduce(function (s, k) { return s + o[k]; }, 0); };
  const emojiCat = {};
  cfg.categorias.forEach(function (c) { emojiCat[c.nombre] = c.emoji; });
  emojiCat[CAT_INTERESES] = '💸';
  emojiCat[CAT_SIN_ID] = '❓';
  emojiCat[CAT_MONEDAS] = '🪙';
  const emojiIng = {};
  emojiIng[CAT_APORTE] = '👩';
  cfg.ingresos.forEach(function (c) { emojiIng[c.nombre] = c.emoji; });

  // Entidades: cuentas y gastos fijos, con su logo y colores.
  const entidades = {};
  cfg.cuentas.forEach(function (c) {
    entidades[c.nombre] = { emoji: c.emoji, sitio: c.sitio, color: c.color, colorTexto: c.colorTexto, tipo: c.tipo };
  });
  cfg.fijos.forEach(function (f) {
    entidades['fijo:' + f.nombre] = { emoji: '📌', sitio: f.sitio, color: f.color, colorTexto: f.colorTexto, tipo: 'Fijo' };
  });

  const cats = est.gastosMes(claveMes);
  const ings = est.ingresosMes(claveMes);
  const partes = claveMes.split('-').map(Number);
  const mesAnterior = clavesMes(new Date(partes[0], partes[1] - 2, 1));

  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const k = clavesMes(new Date(partes[0], partes[1] - 1 - i, 1));
    meses.push({ mes: k, ingresos: suma(est.ingresosMes(k)), gastos: suma(est.gastosMes(k)) });
  }

  const lunes = new Date(hoyF.getFullYear(), hoyF.getMonth(), hoyF.getDate() - ((hoyF.getDay() + 6) % 7));
  const semanas = [];
  for (let i = 7; i >= 0; i--) {
    const ini = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() - 7 * i);
    const fin = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 7);
    let contado = 0, financiado = 0;
    const porCredito = {};
    movs.forEach(function (m) {
      if (m.tipo !== TIPO.GASTO || m.fecha < ini || m.fecha >= fin || !cuentaEnResumen(m)) return;
      const mio = reparto(m).mio;
      const c = cfg.cuentas.find(function (x) { return x.nombre === m.cuenta; });
      if (c && c.tipo === 'Deuda') { financiado += mio; if (mio) porCredito[c.nombre] = (porCredito[c.nombre] || 0) + mio; }
      else contado += mio;
    });
    semanas.push({ inicio: fmt(ini), contado: contado, financiado: financiado, porCredito: porCredito });
  }

  const fijosPorNombre = {};
  cfg.fijos.forEach(function (f) { fijosPorNombre[f.nombre] = f; });
  const historial = movs.slice().sort(function (a, b) { return (b.fecha - a.fecha) || ((b.registrado || 0) - (a.registrado || 0)); })
    .slice(0, 600)
    .map(function (m) {
      let emoji = '🔖';
      if (m.tipo === TIPO.GASTO) emoji = emojiCat[m.cat] || '🔖';
      else if (m.tipo === TIPO.INGRESO) emoji = emojiIng[m.cat] || '💰';
      else if (m.tipo === TIPO.MEPAGARON) emoji = '🤝';
      else if (m.tipo === TIPO.MEPRESTARON) emoji = '🙋';
      else if (m.tipo === TIPO.LEPAGUE) emoji = '↩️';
      else if (m.tipo === TIPO.TRANSF) emoji = '🔄';
      else if (m.tipo === TIPO.AJUSTE) emoji = '⚖️';
      const r = m.tipo === TIPO.GASTO ? reparto(m) : null;
      const fijo = m.id && m.id.indexOf('fijo:') === 0 ? m.id.split(':')[1] : '';
      return { fecha: fmt(m.fecha), tipo: m.tipo, desc: m.desc, monto: m.monto, cat: m.cat, cuenta: m.cuenta,
        destino: m.tipo === TIPO.MEPAGARON ? '' : m.destino, persona: m.tipo === TIPO.MEPRESTARON || m.tipo === TIPO.LEPAGUE || m.tipo === TIPO.MEPAGARON ? m.para : '', para: r && r.otros.length === 1 && r.mio === 0 ? r.otros[0].p : '',
        compartido: r && r.otros.length > 1 ? r.otros.length : 0, mio: r ? r.mio : 0,
        cuotas: m.cuotas, valorCuota: m.valorCuota, costo: m.costo, emoji: emoji, fijo: fijosPorNombre[fijo] ? fijo : '',
        hist: esHist(m), resumen: cuentaEnResumen(m), id: m.id, paraRaw: m.tipo === TIPO.GASTO ? m.para : '' };
    });

  const mesesDisponibles = {};
  movs.forEach(function (m) { if (cuentaEnResumen(m)) mesesDisponibles[clavesMes(m.fecha)] = true; });
  mesesDisponibles[clavesMes(hoyF)] = true;

  const g = function (x) { return x ? { fecha: fmt(x.fecha), monto: x.monto, dias: x.dias, detalle: x.detalle } : null; };
  const creditos = est.deudas.filter(function (d) { return (d.activa && d.nombre !== CUENTA_MAMA) || d.saldo !== 0; }).map(function (d) {
    return { nombre: d.nombre, emoji: d.emoji, saldo: d.saldo, cupo: d.cupo, proximo: g(d.proximo), siguiente: g(d.siguiente),
      calendario: d.calendario.map(g), sinFecha: d.sinFecha, bolsillo: d.bolsillo, apartado: d.apartado, reto: d.reto,
      intereses: d.intereses, interesesEst: d.interesesEst, interesesHoy: d.interesesHoy, ahorroTotal: d.ahorroTotal, interesDiario: d.interesDiario,
      interesCargado: d.interesCargado, corteEst: d.corteEst, cicloDesde: d.cicloDesde, planes: d.planes, pagosCal: d.pagosCal, modo: d.modo, serie: d.serie, persona: d.nombre === CUENTA_MAMA };
  });

  // Próximos pagos: créditos + gastos fijos (35 días)
  const proximos = [];
  creditos.forEach(function (d) {
    d.calendario.forEach(function (x) {
      if (x.dias <= 35) proximos.push({ tipo: 'credito', nombre: d.nombre, monto: x.monto, fecha: x.fecha, dias: x.dias,
        detalle: x.detalle.length === 1 ? x.detalle[0].desc : x.detalle.length + ' cuotas y compras', estado: 'pendiente' });
    });
  });
  estadoFijos(cfg, movs, hoyF).forEach(function (o) {
    if (o.dias > 35 || (o.pagado && o.dias < -7) || (!o.pagado && o.dias < -30)) return;
    if (o.cobro === 'Automático' && o.dias < 0 && !o.pagado) return;
    if (o.aviso === 'Cancelar' && o.dias < 0 && !o.pagado) return;
    let estado = o.pagado ? (o.cobro === 'Automático' ? 'cobrado' : 'pagado') : (o.cobro === 'Automático' ? 'automatico' : 'pendiente');
    if (o.aviso === 'Cancelar' && !o.pagado) estado = 'cancelar';
    proximos.push({ tipo: 'fijo', nombre: o.nombre, monto: o.valor, fecha: fmt(o.fecha), dias: o.dias, cuenta: o.cuenta,
      estado: estado, frecuencia: o.frecuencia, compartido: o.compartido.length ? o.compartido.length : 0, porPersona: o.porPersona,
      periodo: o.periodo, cobro: o.cobro });
  });
  proximos.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });

  // Disponible para gastar: lo que tienes menos lo que tiene que salir de tus cuentas en los próximos 30 días.
  const tipoCuenta = {};
  cfg.cuentas.forEach(function (c) { tipoCuenta[c.nombre] = c.tipo; });
  let compromisoCreditos = 0, compromisoFijos = 0;
  creditos.forEach(function (d) {
    if (d.persona) return;
    d.calendario.forEach(function (x) { if (x.dias <= 30) compromisoCreditos += x.monto; });
  });
  proximos.forEach(function (p) {
    if (p.tipo !== 'fijo' || p.dias > 30) return;
    if (p.estado !== 'pendiente' && p.estado !== 'automatico') return;
    if (tipoCuenta[p.cuenta] === 'Plata') compromisoFijos += p.monto;
  });
  const disponible = {
    tienes: est.totalPlata,
    creditos: Math.round(compromisoCreditos),
    fijos: Math.round(compromisoFijos),
    valor: Math.round(est.totalPlata - compromisoCreditos - compromisoFijos)
  };

  return {
    nombre: cfg.ajustes.nombre || '',
    hoy: fmt(hoyF),
    mes: claveMes,
    meses: Object.keys(mesesDisponibles).sort().reverse(),
    patrimonio: Math.round(est.patrimonio),
    disponible: disponible,
    resumenDesde: fmt(RESUMEN_DESDE),
    totalPlata: est.totalPlata, totalDeudas: est.totalDeudas, totalMeDeben: est.totalMeDeben, lesDebo: est.lesDebo, totalLesDebo: est.totalLesDebo,
    ingresos: suma(ings), gastos: suma(cats), gastosMesAnterior: suma(est.gastosMes(mesAnterior)),
    categorias: Object.keys(cats).map(function (k) { return { nombre: k, emoji: emojiCat[k] || '🔖', monto: cats[k] }; })
      .sort(function (a, b) { return b.monto - a.monto; }),
    tiposIngreso: Object.keys(ings).map(function (k) { return { nombre: k, emoji: emojiIng[k] || '💰', monto: ings[k] }; })
      .sort(function (a, b) { return b.monto - a.monto; }),
    presupuestos: est.presupuestosMes(claveMes),
    cuentas: est.plata,
    creditos: creditos,
    proximos: proximos,
    meDeben: est.meDeben,
    calFijos: estadoFijos(cfg, movs, hoyF).map(function (o) {
      return { nombre: o.nombre, fecha: fmt(o.fecha), valor: o.valor, pagado: !!o.pagado, cobro: o.cobro, cuenta: o.cuenta, aviso: o.aviso || '' };
    }),
    fijosCfg: cfg.fijos.map(function (f) {
      return { nombre: f.nombre, valor: f.valor, frecuencia: f.frecuencia, dia: f.dia, proximo: f.proximo ? fmt(f.proximo) : '', categoria: f.categoria,
        cuenta: f.cuenta, cobro: f.cobro, aviso: f.aviso, activo: f.activo, canceladoEl: f.canceladoEl ? fmt(f.canceladoEl) : '' };
    }),
    cuentasCfg: cfg.cuentas.map(function (c) {
      return { nombre: c.nombre, tipo: c.tipo, emoji: c.emoji, color: c.color, modo: c.modo, diaCorte: c.diaCorte instanceof Date ? '' : c.diaCorte, diaPago: c.diaPago,
        mesPago: c.mesPago, tasa: c.tasa, cupo: c.cupo, maxCuotas: c.maxCuotas, pideValor: c.pideValor, unaSinInteres: c.unaSinInteres,
        interesDesde1: interesDesde1(c), activa: c.activa, saldo: Math.round(est.saldos[c.nombre] || 0), mama: c.nombre === CUENTA_MAMA, imagen: c.imagen || '' };
    }),
    listaCategorias: cfg.categorias.map(function (c) { return { nombre: c.nombre, emoji: c.emoji }; }),
    metas: estadoMetas(cfg, est, hoyF),
    avisos: resumenAvisos(cfg, movs),
    historico: meses,
    semanas: semanas,
    movimientos: historial,
    entidades: entidades
  };
}

/** Tarjeta de crédito "de banco": cuotas por ciclo de corte y valor de cuota calculado (no fijo como Addi). */
function esTarjeta(c) { return !!c && c.tipo === 'Deuda' && c.modo === 'Corte mensual' && !c.pideValor; }

/**
 * Intereses de la cuota q (1..n) de una compra a n cuotas con tarjeta:
 * la 1ª no cobra; la 2ª cobra los del mes 1 (sobre el total) y los del mes 2; desde la 3ª, sobre la deuda que queda.
 */
function interesCuotaTarjeta(C, n, q, r, desde1) {
  if (n < 2 || !(r > 0)) return 0;
  const i = r * C * (n - q + 1) / n;               // interés del mes sobre lo que aún se debe
  if (desde1) return i;                             // Davibank: cobra desde la cuota 1
  if (q < 2) return 0;                              // Nubank: la cuota 1 va sin interés…
  return q === 2 ? i + r * C : i;                   // …y la 2 cobra los dos meses
}
/** Tarjetas que cobran intereses desde la primera cuota (confirmado con el asesor de Davibank). */
const INTERES_DESDE_CUOTA_1 = ['TC Davibank'];
function interesDesde1(c) { return !!c && (!!c.interesDesde1 || INTERES_DESDE_CUOTA_1.indexOf(c.nombre) >= 0); }

/** Valor de cada cuota de una compra a crédito (con intereses), o null si es de contado o a 1 cuota. */
function montosCuotas(m, c) {
  const n = Number(m.cuotas) || 1;
  if (!c || c.tipo !== 'Deuda' || c.modo === 'Sin cuotas' || n < 2) return null;
  const out = [];
  if (esTarjeta(c)) {
    for (let q = 1; q <= n; q++) out.push(m.monto / n + interesCuotaTarjeta(m.monto, n, q, c.tasa, interesDesde1(c)));
    return out;
  }
  const total = m.monto + (m.costo || 0), vc = m.valorCuota || total / n;
  for (let k = 0; k < n; k++) out.push(k < n - 1 ? vc : total - vc * (n - 1));
  return out;
}

/** Cuánto vale cada cuota y cuánto cuesta financiar la compra. */
function planCuotas(monto, n, cta, valorDado) {
  if (esTarjeta(cta)) {
    // Tarjeta de crédito: capital parejo; los intereses se suman a cada cuota sobre la deuda vigente.
    let costo = 0;
    for (let q = 1; q <= n; q++) costo += interesCuotaTarjeta(monto, n, q, cta.tasa, interesDesde1(cta));
    return { valorCuota: Math.round(monto / n), costo: Math.round(costo) };
  }
  if (valorDado > 0) {
    const total = valorDado * n;
    if (total < monto * 0.98 || total > monto * 2) throw new Error(n + ' cuotas de ' + pesos(valorDado) + ' suman ' + pesos(total) + ', que no cuadra con una compra de ' + pesos(monto) + '. Revisa el valor de la cuota.');
    return { valorCuota: Math.round(valorDado), costo: Math.max(0, Math.round(total - monto)) };
  }
  if (n === 1 && cta.unaSinInteres) return { valorCuota: monto, costo: 0 };
  const financiado = monto * (1 + (cta.cargo || 0));
  const i = cta.tasa || 0;
  const cuota = i > 0 ? financiado * i / (1 - Math.pow(1 + i, -n)) : financiado / n;
  return { valorCuota: Math.round(cuota), costo: Math.max(0, Math.round(cuota * n - monto)) };
}

/** Fechas de pago de las n cuotas de una compra hecha en "fecha". */
function fechasCuotas(cta, fecha, n, cfg) {
  if (cta.modo === 'Sin cuotas') return new Array(n).fill(null);
  if (cta.modo === 'Por compra') {
    const out = [];
    for (let k = 1; k <= n; k++) out.push(addMeses(fecha, k));
    return out;
  }
  return ciclos(cta, fecha, n, cfg).map(function (c) { return c.limite; });
}

/** n fechas de pago empezando en "primera" (la siguiente según el ciclo de la cuenta). */
function fechasDesde(cta, primera, n, cfg) {
  if (!primera) return new Array(n).fill(null);
  const out = [primera];
  if (n <= 1) return out;
  if (cta.modo === 'Corte mensual') {
    const lista = ciclos(cta, addDias(primera, -62), n + 4, cfg).map(function (c) { return c.limite; })
      .filter(function (l) { return l > primera; });
    for (let k = 0; out.length < n && k < lista.length; k++) out.push(lista[k]);
    while (out.length < n) out.push(addMeses(out[out.length - 1], 1));
    return out;
  }
  for (let k = 1; k < n; k++) out.push(addMeses(primera, k));
  return out;
}

/** Los primeros n ciclos (corte y fecha límite) cuyo corte es igual o posterior a "desde". */
function ciclos(cta, desde, n, cfg) {
  const out = [];
  if (String(cta.diaCorte).toLowerCase() === 'tabla') {
    const tabla = (cfg.davi || []).slice().sort(function (a, b) { return a.corte - b.corte; });
    tabla.forEach(function (c) { if (c.corte >= desde && out.length < n) out.push({ corte: c.corte, limite: c.limite }); });
    let ultimo = tabla.length ? tabla[tabla.length - 1].corte : new Date(desde.getFullYear(), desde.getMonth() - 1, 1);
    let guard = 0;
    while (out.length < n && guard++ < 600) {
      const c = corteEstimadoDavibank(ultimo.getFullYear(), ultimo.getMonth() + 1);
      ultimo = c;
      if (c >= desde) out.push({ corte: c, limite: addDias(c, 19) });
    }
    return out;
  }
  let y = desde.getFullYear(), m = desde.getMonth() - 1, guard = 0;
  while (out.length < n && guard++ < 600) {
    const ultimoDia = new Date(y, m + 1, 0).getDate();
    const txt = String(cta.diaCorte).toLowerCase();
    const dc = txt === 'último' || txt === 'ultimo' ? ultimoDia : Math.min(Number(cta.diaCorte) || ultimoDia, ultimoDia);
    const corte = new Date(y, m, dc);
    if (corte >= desde) {
      const mp = m + (cta.mesPago === 'Siguiente' ? 1 : 0);
      const ultimoPago = new Date(y, mp + 1, 0).getDate();
      out.push({ corte: corte, limite: new Date(y, mp, Math.min(Number(cta.diaPago) || 1, ultimoPago)) });
    }
    m++;
  }
  return out;
}

/** Corte estimado de Davibank cuando se acaba la tabla: primer viernes a partir del día 16. */
function corteEstimadoDavibank(anio, mes) {
  const d = new Date(anio, mes, 16);
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
  return d;
}

/* =================================================================
 * RECORDATORIOS POR CORREO
 * ================================================================= */

function recordatorioDiario() {
  // Mismo candado que doPost: evita registrar dos veces un gasto automático si llega un registro al mismo tiempo.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(60000)) { console.error('Recordatorio: la hoja estaba ocupada.'); return; }
  try { return recordatorioDiario_(); } finally { lock.releaseLock(); }
}
function recordatorioDiario_() {
  asegurarEsquema();
  const cfg = leerConfig();
  registrarFijosAutomaticos(cfg);
  const movs = leerMovimientos();
  const hoyF = hoy();
  const est = calcular(movs, cfg, hoyF);
  // El día 1 también llega el balance del mes que acaba de cerrar (si falla, los avisos siguen).
  if (hoyF.getDate() === 1) {
    try { enviarBalanceMensual(clavesMes(new Date(hoyF.getFullYear(), hoyF.getMonth() - 1, 1)), false); }
    catch (err) { console.error('Balance mensual: ' + err); }
  }
  const antes = Number(cfg.ajustes.diasAntes) || 3;
  const avisos = [];
  const toca = function (d) { return d === antes || d === 1 || d === 0 || d === -1; };
  est.deudas.forEach(function (d) {
    (d.calendario || []).forEach(function (g) {
      if (toca(g.dias)) avisos.push({ tipo: 'credito', nombre: d.nombre, emoji: d.emoji, monto: g.monto, fecha: g.fecha, dias: g.dias,
        detalle: g.detalle.map(function (x) { return x.desc + ': ' + pesos(x.monto); }).join('<br>') });
    });
    if (d.reto && d.reto.hechas < d.reto.minimo && d.reto.diasRestantes <= 3) {
      avisos.push({ tipo: 'reto', nombre: d.nombre, emoji: d.emoji, monto: 0, fecha: new Date(hoyF.getFullYear(), hoyF.getMonth() + 1, 0),
        dias: d.reto.diasRestantes, detalle: 'Llevas ' + d.reto.hechas + ' de ' + d.reto.minimo + ' compras este mes. Te faltan ' +
        (d.reto.minimo - d.reto.hechas) + ' para no pagar cuota de manejo.' });
    }
  });
  estadoFijos(cfg, movs, hoyF).forEach(function (o) {
    if (o.pagado) return;
    if (o.aviso === 'Cancelar') {
      if (o.dias === 5 || o.dias === 2 || o.dias === 1 || o.dias === 0) avisos.push({ tipo: 'cancelar', nombre: o.nombre, emoji: '✂️',
        monto: o.valor, fecha: o.fecha, dias: o.dias, detalle: 'Cancélalo antes de esa fecha para que no te cobren.' });
      return;
    }
    if (o.cobro === 'Manual' && toca(o.dias)) avisos.push({ tipo: 'fijo', nombre: o.nombre, emoji: '📌', monto: o.valor, fecha: o.fecha,
      dias: o.dias, detalle: 'Gasto fijo · se paga con ' + o.cuenta });
  });
  if (!avisos.length) return 'Sin avisos hoy.';
  enviarCorreo(avisos, cfg);
  return 'Correo enviado con ' + avisos.length + ' aviso(s).';
}

/** Asunto corto (Gmail no acepta asuntos muy largos): los dos primeros avisos y cuántos más hay. */
function asuntoCorreo(avisos, urgentes, titulo) {
  const partes = avisos.slice(0, 2).map(function (a) { return titulo(a) + (a.monto ? ' ' + pesos(a.monto) : ''); });
  let s = (urgentes ? '⚠️ ' : '🔔 ') + partes.join(' · ') + (avisos.length > 2 ? ' y ' + (avisos.length - 2) + ' más' : '');
  if (s.length > 180) s = s.slice(0, 177) + '…';
  return s;
}

function enviarCorreo(avisos, cfg) {
  const para = cfg.ajustes.correo || Session.getEffectiveUser().getEmail();
  const cuando = function (a) {
    if (a.tipo === 'reto') return 'el mes termina en ' + a.dias + ' día' + (a.dias === 1 ? '' : 's');
    const pre = a.tipo === 'cancelar' ? 'cobran ' : 'vence ';
    if (a.dias === 0) return '<b style="color:#ff7a86">' + pre + 'HOY</b>';
    if (a.dias === -1) return '<b style="color:#ff7a86">venció AYER</b>';
    if (a.dias === 1) return '<b>' + pre + 'mañana</b>';
    return pre + 'en ' + a.dias + ' días';
  };
  const titulo = function (a) {
    if (a.tipo === 'cancelar') return 'Cancela ' + a.nombre;
    if (a.tipo === 'reto') return 'Reto ' + a.nombre;
    return a.nombre;
  };
  const filas = avisos.map(function (a) {
    return '<tr><td style="padding:12px;border-bottom:1px solid #1e2a44">' + a.emoji + ' <b>' + titulo(a) + '</b><br>' +
      '<span style="color:#8fa3c7;font-size:12px">' + a.detalle + '</span></td>' +
      '<td style="padding:12px;border-bottom:1px solid #1e2a44;text-align:right;white-space:nowrap">' +
      (a.monto ? '<b style="font-size:16px">' + pesos(a.monto) + '</b><br>' : '') +
      '<span style="font-size:12px">' + fmtLargo(a.fecha) + ' · ' + cuando(a) + '</span></td></tr>';
  }).join('');
  const html = '<div style="font-family:Arial,sans-serif;background:#070b16;color:#e8eefc;padding:24px;border-radius:16px;max-width:560px">' +
    '<h2 style="margin:0 0 4px">🔔 Tus pagos y avisos</h2><p style="color:#8fa3c7;margin:0 0 16px">Para que nada se te pase.</p>' +
    '<table style="width:100%;border-collapse:collapse;background:#0e1628;border-radius:12px">' + filas + '</table>' +
    '<p style="margin-top:16px"><a href="' + URL_APP + '" style="color:#5aa9ff">Abrir mi dashboard →</a></p>' +
    '</div>';
  const urgentes = avisos.filter(function (a) { return a.dias <= 1 || a.tipo === 'cancelar'; }).length;
  MailApp.sendEmail({
    to: para,
    subject: asuntoCorreo(avisos, urgentes, titulo),
    htmlBody: html
  });
}

function probarRecordatorio() {
  const cfg = leerConfig();
  const movs = leerMovimientos();
  const hoyF = hoy();
  const est = calcular(movs, cfg, hoyF);
  const avisos = [];
  est.deudas.forEach(function (d) {
    (d.calendario || []).forEach(function (g) {
      if (g.dias <= 35) avisos.push({ tipo: 'credito', nombre: d.nombre, emoji: d.emoji, monto: g.monto, fecha: g.fecha, dias: g.dias,
        detalle: g.detalle.map(function (x) { return x.desc + ': ' + pesos(x.monto); }).join('<br>') });
    });
  });
  estadoFijos(cfg, movs, hoyF).forEach(function (o) {
    if (!o.pagado && o.dias >= 0 && o.dias <= 35) avisos.push({ tipo: o.aviso === 'Cancelar' ? 'cancelar' : 'fijo', nombre: o.nombre,
      emoji: o.aviso === 'Cancelar' ? '✂️' : '📌', monto: o.valor, fecha: o.fecha, dias: o.dias,
      detalle: o.aviso === 'Cancelar' ? 'Cancélalo antes de esa fecha.' : (o.cobro + ' · ' + o.cuenta) });
  });
  if (!avisos.length) { mostrar('No hay pagos pendientes en los próximos 35 días.'); return; }
  avisos.sort(function (a, b) { return a.fecha - b.fecha; });
  enviarCorreo(avisos, cfg);
  mostrar('Te envié un correo de prueba con ' + avisos.length + ' aviso(s).');
}

/* =================================================================
 * ADMINISTRAR DESDE LA APP: gastos fijos y cuentas (escribe en Configuración)
 * ================================================================= */

/** Escribe (o crea) la fila "clave" de una tabla de Configuración; agrega las columnas que falten. */
function guardarFilaConfig(encabezado, clave, valores, crear) {
  const h = hojaConfig();
  const v = h.getDataRange().getValues();
  const i = filaEncabezado(v, encabezado);
  if (i < 0) throw new Error('No encontré la tabla "' + encabezado + '" en Configuración.');
  const enc = v[i].map(function (x) { return String(x).trim(); });
  Object.keys(valores).forEach(function (k) {
    if (enc.indexOf(k) >= 0) return;
    let col = enc.indexOf('');
    if (col < 0) col = enc.length;
    h.getRange(i + 1, col + 1).setValue(k).setFontWeight('bold').setBackground('#dbe8ff').setWrap(true);
    enc[col] = k;
  });
  let fila = -1;
  for (let j = i + 1; j < v.length && String(v[j][0]).trim().indexOf('▸') !== 0; j++) {
    if (String(v[j][0]).trim() === clave) { fila = j + 1; break; }
  }
  if (fila < 0) {
    if (!crear) throw new Error('"' + clave + '" no existe en Configuración.');
    fila = filaLibre(h, h.getDataRange().getValues(), encabezado);
    h.getRange(fila, 1).setValue(clave);
  }
  Object.keys(valores).forEach(function (k) { h.getRange(fila, enc.indexOf(k) + 1).setValue(valores[k]); });
  CACHE_CFG_ = null;
}

/**
 * Metas de ahorro: cada meta va ligada a una cuenta de plata (un bolsillo): el progreso es el saldo de esa cuenta.
 * Aportar a una meta es "Mover plata" hacia su cuenta, así que no hay contabilidad aparte.
 */
const FOTO_META_MAX = 45000;   // una celda de Google Sheets aguanta 50.000 caracteres
function estadoMetas(cfg, est, hoyF) {
  return (cfg.metas || []).map(function (m) {
    const ahorrado = Math.max(0, Math.round(est.saldos[m.cuenta] || 0));
    const falta = Math.max(0, m.objetivo - ahorrado);
    const dias = m.fecha ? Math.round((soloFecha(m.fecha).getTime() - soloFecha(hoyF).getTime()) / 86400000) : null;
    const meses = dias === null ? 0 : Math.max(1, dias / 30.4375);
    const cta = cfg.cuentas.find(function (x) { return x.nombre === m.cuenta; });
    return { nombre: m.nombre, emoji: m.emoji, objetivo: m.objetivo, fecha: m.fecha ? fmt(m.fecha) : '', cuenta: m.cuenta, principal: cta && cta.alimentaDesde && !cta.apartaPara ? cta.alimentaDesde : '', foto: m.foto,
      ahorrado: ahorrado, falta: falta, pct: Math.min(100, Math.floor(ahorrado / m.objetivo * 100)), lograda: falta === 0,
      dias: dias, vencida: dias !== null && dias < 0 && falta > 0,
      mensual: dias !== null && dias >= 0 && falta > 0 ? Math.ceil(falta / meses) : 0 };
  });
}
function asegurarTablaMetas(h) {
  const v = h.getDataRange().getValues();
  if (filaEncabezado(v, 'Meta') >= 0) return;
  const f = h.getLastRow() + 2;
  h.getRange(f, 1).setValue('▸ METAS DE AHORRO').setFontWeight('bold').setFontColor('#0b3d91').setFontSize(12);
  h.getRange(f + 1, 1, 1, 6).setValues([['Meta', 'Emoji', 'Objetivo', 'Fecha límite', 'Cuenta', 'Foto']]).setFontWeight('bold').setBackground('#dbe8ff');
  CACHE_CFG_ = null;
}
/** guardar: anterior, nombre, emoji, objetivo, fecha (opcional), cuenta (existente) o cuentaNueva + principal (la cuenta de la que nace el bolsillo), foto (data:image/jpeg; vacío la quita; sin enviar, la deja). quitar: nombre. */
function administrarMeta(p, cfg) {
  const op = limpiar(p.op) || 'guardar';
  const h = hojaConfig();
  asegurarTablaMetas(h);
  const metas = cfg.metas || [];
  if (op === 'quitar') {
    const nombre = limpiar(p.nombre);
    const m = metas.find(function (x) { return x.nombre === nombre; });
    if (!m) throw new Error('La meta "' + nombre + '" no existe.');
    const cta = cfg.cuentas.find(function (x) { return x.nombre === m.cuenta; });
    // Un bolsillo creado para la meta (nació de otra cuenta): su plata vuelve a esa cuenta y el bolsillo se archiva.
    const propio = !!(cta && cta.alimentaDesde && !cta.apartaPara && cta.tipo === 'Plata' && cta.activa);
    let msg = '🗂️ Quité la meta "' + nombre + '".';
    if (propio) {
      const usa = cfg.fijos.filter(function (f) { return f.activo && f.cuenta === cta.nombre; }).map(function (f) { return f.nombre; });
      if (usa.length) throw new Error('Antes cambia la cuenta de estos gastos fijos (o quítalos): ' + usa.join(', ') + '.');
      cuentaPorNombre(cfg, cta.alimentaDesde);
      const saldo = saldoDe(cfg, cta.nombre);
      if (saldo < 0) throw new Error('El bolsillo "' + cta.nombre + '" está en negativo (' + pesos(saldo) + '). Cuádralo antes de quitar la meta.');
      if (saldo > 0) agregarMovimiento([hoy(), TIPO.TRANSF, 'Meta "' + nombre + '": plata de vuelta a ' + cta.alimentaDesde, saldo, '', cta.nombre, cta.alimentaDesde, '', '', '', '']);
      guardarFilaConfig('Cuenta', cta.nombre, { 'Activa': 'No' });
      msg += saldo > 0 ? '\n↩️ Los ' + pesos(saldo) + ' del bolsillo volvieron a ' + cta.alimentaDesde + ' y archivé "' + cta.nombre + '".' : '\n🗂️ Archivé el bolsillo "' + cta.nombre + '" (estaba en $0).';
    } else {
      msg += ' La cuenta "' + m.cuenta + '" y su plata siguen igual.';
    }
    const v = h.getDataRange().getValues(), i = filaEncabezado(v, 'Meta');
    for (let j = i + 1; j < v.length && String(v[j][0]).trim().indexOf('▸') !== 0; j++) {
      if (String(v[j][0]).trim() === nombre) { h.getRange(j + 1, 1, 1, 6).setValues([['', '', '', '', '', '']]); break; }
    }
    CACHE_CFG_ = null;
    return msg;
  }
  const anterior = limpiar(p.anterior);
  const nombre = limpiar(p.nombre);
  if (!nombre) throw new Error('Escribe el nombre de la meta.');
  const previa = anterior ? metas.find(function (x) { return x.nombre === anterior; }) : null;
  if (anterior && !previa) throw new Error('La meta "' + anterior + '" no existe.');
  if (!previa || anterior !== nombre) nombreValido(nombre);
  if (metas.some(function (x) { return x.nombre !== anterior && normalizarTexto(x.nombre) === normalizarTexto(nombre); })) throw new Error('Ya tienes una meta llamada "' + nombre + '".');
  const objetivo = aNumero(p.objetivo);
  if (!(objetivo > 0)) throw new Error('El objetivo no es válido.');
  const emoji = (limpiar(p.emoji) || '🎯').slice(0, 8);
  let fd = '';
  if (limpiar(p.fecha)) {
    const mf = limpiar(p.fecha).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!mf) throw new Error('La fecha límite no es válida.');
    fd = new Date(+mf[1], +mf[2] - 1, +mf[3]);
    if (fd.getFullYear() !== +mf[1] || fd.getMonth() !== +mf[2] - 1 || fd.getDate() !== +mf[3]) throw new Error('La fecha límite no existe.');
    const igual = previa && previa.fecha && soloFecha(previa.fecha).getTime() === fd.getTime();
    if (fd < hoy() && !igual) throw new Error('La fecha límite no puede ser pasada.');
  }
  let cuenta = limpiar(p.cuenta);
  const nueva = limpiar(p.cuentaNueva);
  if (nueva) {
    const prin = cuentaPorNombre(cfg, p.principal);
    if (prin.tipo !== 'Plata' || !prin.activa || prin.nombre === CUENTA_MAMA) throw new Error('El bolsillo tiene que salir de una de tus cuentas de plata.');
    administrarCuenta({ op: 'guardar', nombre: nueva, tipo: 'Plata', emoji: emoji, saldo: 0 }, cfg);
    guardarFilaConfig('Cuenta', nueva, { 'Se alimenta desde': prin.nombre }, false);
    cuenta = nueva;
  } else {
    const c = cuentaPorNombre(cfg, cuenta);
    if (c.tipo !== 'Plata' || !c.activa || c.nombre === CUENTA_MAMA || c.apartaPara) throw new Error('Esa cuenta no sirve para una meta: elige una de tu plata, que no sea un bolsillo de tarjeta.');
    const ocupada = metas.find(function (x) { return x.cuenta === c.nombre && x.nombre !== anterior; });
    if (ocupada) throw new Error('"' + c.nombre + '" ya es el bolsillo de la meta "' + ocupada.nombre + '".');
  }
  // Si la meta cambia de cuenta y la anterior era un bolsillo creado para ella, su plata pasa a la cuenta nueva y el bolsillo se archiva.
  let msgCambio = '';
  if (previa && previa.cuenta && previa.cuenta !== cuenta) {
    const vieja = cfg.cuentas.find(function (x) { return x.nombre === previa.cuenta; });
    const propia = !!(vieja && vieja.alimentaDesde && !vieja.apartaPara && vieja.tipo === 'Plata' && vieja.activa);
    if (propia) {
      const usa = cfg.fijos.filter(function (f) { return f.activo && f.cuenta === vieja.nombre; }).map(function (f) { return f.nombre; });
      if (usa.length) throw new Error('Antes cambia la cuenta de estos gastos fijos (o quítalos): ' + usa.join(', ') + '.');
      const saldo = saldoDe(cfg, vieja.nombre);
      if (saldo < 0) throw new Error('El bolsillo "' + vieja.nombre + '" está en negativo (' + pesos(saldo) + '). Cuádralo antes de cambiar la cuenta de la meta.');
      if (saldo > 0) agregarMovimiento([hoy(), TIPO.TRANSF, 'Meta "' + nombre + '": plata pasa a ' + cuenta, saldo, '', vieja.nombre, cuenta, '', '', '', '']);
      guardarFilaConfig('Cuenta', vieja.nombre, { 'Activa': 'No' });
      msgCambio = saldo > 0 ? '\n↪️ Los ' + pesos(saldo) + ' de "' + vieja.nombre + '" pasaron a "' + cuenta + '" y archivé el bolsillo anterior.' : '\n🗂️ Archivé el bolsillo anterior "' + vieja.nombre + '" (estaba en $0).';
    } else msgCambio = '\nℹ️ "' + previa.cuenta + '" sigue como estaba: ahora la meta cuenta lo que haya en "' + cuenta + '".';
  }
  const valores = { 'Emoji': emoji, 'Objetivo': objetivo, 'Fecha límite': fd || '', 'Cuenta': cuenta };
  if (p.foto !== undefined && p.foto !== null) {
    const foto = String(p.foto).trim();
    if (foto && (!/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(foto) || foto.length > FOTO_META_MAX)) throw new Error('La foto no es válida o es muy pesada.');
    valores['Foto'] = foto;
  }
  if (anterior && anterior !== nombre) valores['Meta'] = nombre;
  guardarFilaConfig('Meta', anterior || nombre, valores, !anterior);
  return (previa ? '✏️ Actualicé ' : '🏁 Creé ') + 'la meta "' + nombre + '": ' + pesos(objetivo) + ' en "' + cuenta + '"' + (fd ? ' para el ' + fmt(fd) : '') +
    (nueva ? '\n🆕 Creé el bolsillo "' + nueva + '" (sale de ' + limpiar(p.principal) + ').' : '') + msgCambio;
}

/**
 * Límites de gasto (presupuestos mensuales): un nombre, un tope y las categorías que cuentan para él.
 * Una categoría solo cuenta en un límite: asignarla a este la saca del otro. Quitar un límite no borra categorías ni movimientos.
 * guardar: anterior (nombre actual, vacío si es nuevo), nombre, tope, categorias ("Mercado|Ropa"). quitar: nombre.
 */
function administrarLimite(p, cfg) {
  const op = limpiar(p.op) || 'guardar';
  const h = hojaConfig();
  const grupos = Object.keys(cfg.presupuestos);
  const catsDe = function (g) { return cfg.categorias.filter(function (c) { return c.grupo === g; }).map(function (c) { return c.nombre; }); };
  if (op === 'quitar') {
    const nombre = limpiar(p.nombre);
    if (grupos.indexOf(nombre) < 0) throw new Error('El límite "' + nombre + '" no existe.');
    catsDe(nombre).forEach(function (c) { guardarFilaConfig('Categoría', c, { 'Presupuesto': '' }, false); });
    // La fila del límite se elimina al final: así no se corre ninguna fila que aún falte por editar.
    const v = h.getDataRange().getValues();
    const i = filaEncabezado(v, 'Presupuesto');
    for (let j = i + 1; j < v.length && String(v[j][0]).trim().indexOf('▸') !== 0; j++) {
      if (String(v[j][0]).trim() === nombre) { h.deleteRow(j + 1); break; }
    }
    CACHE_CFG_ = null;
    return '🗂️ Quité el límite "' + nombre + '". Las categorías y tus movimientos siguen igual.';
  }
  if (op !== 'guardar') throw new Error('Acción de límite desconocida.');
  const anterior = limpiar(p.anterior);
  const nombre = limpiar(p.nombre);
  if (!nombre) throw new Error('Escribe el nombre del límite.');
  if (nombre.length > 40) throw new Error('El nombre es muy largo (máximo 40 letras).');
  if (anterior && grupos.indexOf(anterior) < 0) throw new Error('El límite "' + anterior + '" ya no existe.');
  if (nombre !== anterior) {
    nombreValido(nombre);
    const igual = grupos.find(function (g) { return normalizarTexto(g) === normalizarTexto(nombre); });
    if (igual) throw new Error('Ya tienes un límite llamado "' + igual + '".');
  }
  const tope = aNumero(p.tope);
  if (!(tope > 0)) throw new Error('El tope mensual no es válido.');
  const elegidas = String(p.categorias || '').split('|').map(limpiar).filter(String);
  if (!elegidas.length) throw new Error('Elige al menos una categoría para este límite.');
  elegidas.forEach(function (c) { if (!cfg.categorias.some(function (x) { return x.nombre === c; })) throw new Error('La categoría "' + c + '" no existe.'); });
  const movidas = [];
  // 1) Categorías: las elegidas pasan a este límite; las que tenía y ya no elige, quedan sin límite.
  cfg.categorias.forEach(function (c) {
    const eligio = elegidas.indexOf(c.nombre) >= 0;
    const era = anterior && c.grupo === anterior;
    if (eligio && c.grupo !== nombre) {
      if (c.grupo && c.grupo !== anterior) movidas.push(c.nombre + ' (antes en "' + c.grupo + '")');
      guardarFilaConfig('Categoría', c.nombre, { 'Presupuesto': nombre }, false);
    } else if (!eligio && era) guardarFilaConfig('Categoría', c.nombre, { 'Presupuesto': '' }, false);
  });
  // 2) El límite mismo (si cambia de nombre, se renombra su fila).
  if (anterior && nombre !== anterior) {
    const v = h.getDataRange().getValues();
    const i = filaEncabezado(v, 'Presupuesto');
    for (let j = i + 1; j < v.length && String(v[j][0]).trim().indexOf('▸') !== 0; j++) {
      if (String(v[j][0]).trim() === anterior) { h.getRange(j + 1, 1).setValue(nombre); break; }
    }
  }
  guardarFilaConfig('Presupuesto', nombre, { 'Tope mensual': tope }, !anterior);
  try {
    const v2 = h.getDataRange().getValues(), i2 = filaEncabezado(v2, 'Presupuesto');
    for (let j = i2 + 1; j < v2.length && String(v2[j][0]).trim().indexOf('▸') !== 0; j++)
      if (String(v2[j][0]).trim() === nombre) { h.getRange(j + 1, 2).setNumberFormat('$#,##0'); break; }
  } catch (e) { /* cosmético */ }
  CACHE_CFG_ = null;
  return (anterior ? '✏️ Actualicé ' : '🎯 Creé ') + 'el límite "' + nombre + '": ' + pesos(tope) + ' al mes · ' + elegidas.join(', ') +
    (movidas.length ? '\nPasaron a este límite: ' + movidas.join(', ') + '.' : '');
}

function administrarFijo(p, cfg) {
  const op = limpiar(p.op);
  const nombre = limpiar(p.nombre);
  if (!nombre) throw new Error('Falta el nombre del gasto fijo.');
  const f = cfg.fijos.find(function (x) { return x.nombre === nombre; });
  const hoyF = hoy();
  if (op === 'guardar') {
    if (!f) {
      nombreValido(nombre);
      const parecido = cfg.fijos.find(function (x) { return normalizarTexto(x.nombre) === normalizarTexto(nombre); });
      if (parecido) throw new Error('Ya tienes "' + parecido.nombre + '". Usa otro nombre.');
    }
    const valor = aNumero(p.valor);
    if (!(valor > 0)) throw new Error('El valor no es válido.');
    const frec = /^anual/i.test(p.frecuencia) ? 'Anual' : /^una/i.test(p.frecuencia) ? 'Una vez' : 'Mensual';
    const dia = Math.min(31, Math.max(1, parseInt(p.dia, 10) || 1));
    const prox = p.proximo ? leerFecha(p.proximo) : '';
    if (frec !== 'Mensual' && !prox) throw new Error('Elige la fecha del próximo cobro.');
    const cta = cuentaPorNombre(cfg, p.cuenta);
    const datos = { 'Valor': valor, 'Frecuencia': frec, 'Día': frec === 'Mensual' ? dia : (prox ? prox.getDate() : dia), 'Próximo cobro': frec === 'Mensual' ? '' : prox,
      'Categoría': limpiar(p.categoria) || 'Otros', 'Cuenta': cta.nombre, 'Cobro': p.cobro === 'Automático' ? 'Automático' : 'Manual',
      'Aviso': p.aviso === 'Cancelar' ? 'Cancelar' : '', 'Activo': 'Sí' };
    if (!f || !f.activo) datos['Desde'] = hoyF;   // un gasto nuevo (o que vuelve) no se cobra hacia atrás
    guardarFilaConfig('Gasto fijo', nombre, datos, !f);
    return (f ? '✏️ Actualicé ' : '📌 Agregué ') + nombre + ' · ' + pesos(valor) + (frec === 'Mensual' ? ' cada mes el día ' + dia : frec === 'Anual' ? ' al año' : ' una vez');
  }
  if (!f) throw new Error('El gasto fijo "' + nombre + '" no existe.');
  if (op === 'quitar') { guardarFilaConfig('Gasto fijo', nombre, { 'Activo': 'No' }); return '🗂️ Quité ' + nombre + ' de tus gastos fijos. Lo puedes reactivar cuando quieras.'; }
  if (op === 'reactivar') { guardarFilaConfig('Gasto fijo', nombre, { 'Activo': 'Sí', 'Desde': hoyF, 'Cancelado el': '' }); return '✅ ' + nombre + ' vuelve a tus gastos fijos.'; }
  if (op === 'cancelada') {
    guardarFilaConfig('Gasto fijo', nombre, { 'Activo': 'No', 'Aviso': '', 'Cancelado el': hoyF });
    const anual = f.frecuencia === 'Anual' ? f.valor : f.valor * 12;
    return '✂️ Cancelaste ' + nombre + '. Te ahorras ' + pesos(anual) + ' al año 🎉';
  }
  if (op === 'mantener') {
    const datos = { 'Aviso': '' };
    if (f.frecuencia === 'Una vez') {
      datos['Frecuencia'] = 'Mensual'; datos['Día'] = f.proximo ? f.proximo.getDate() : f.dia; datos['Próximo cobro'] = '';
      // Si el cobro único ya se pagó, la mensualidad arranca después de esa fecha (no vuelve a pedir el mismo mes).
      const pagado = leerMovimientos().some(function (m) { return m.id === 'fijo:' + f.nombre + ':unica'; });
      if (pagado && f.proximo) datos['Desde'] = addDias(f.proximo, 1);
    }
    guardarFilaConfig('Gasto fijo', nombre, datos);
    return '👍 Te quedas con ' + nombre + '. Queda como suscripción mensual; márcala como pagada cuando te cobren.';
  }
  throw new Error('Acción desconocida.');
}

/** Imagen de tarjeta: dirección https o archivo de la app (cards/…); vacío la quita. */
function imagenValida(v) {
  const t = limpiar(v);
  if (!t) return '';
  if (!/^(https:\/\/[^\s"'<>]+|cards\/[\w.-]+)$/.test(t) || t.length > 500) throw new Error('La dirección de la imagen no es válida.');
  return t;
}
function administrarCuenta(p, cfg) {
  const op = limpiar(p.op);
  const nombre = limpiar(p.nombre);
  if (!nombre) throw new Error('Falta el nombre de la cuenta.');
  const c = cfg.cuentas.find(function (x) { return x.nombre === nombre; });
  if (op === 'guardar') {
    const deuda = p.tipo === 'Deuda';
    if (c && (c.tipo === 'Deuda') !== deuda) throw new Error('No se puede cambiar una cuenta de plata a crédito (o al revés). Crea una nueva.');
    if (!c) {
      nombreValido(nombre);
      const parecida = cfg.cuentas.find(function (x) { return normalizarTexto(x.nombre) === normalizarTexto(nombre); });
      if (parecida) throw new Error('Ya tienes "' + parecida.nombre + '". Usa otro nombre.');
    }
    // Editar no reactiva una cuenta archivada (para eso está "Reactivar").
    const datos = { 'Tipo': deuda ? 'Deuda' : 'Plata' };
    if (!c) datos['Activa'] = 'Sí';
    if (p.emoji) datos['Emoji'] = limpiar(p.emoji);
    if (/^#?[0-9a-f]{6}$/i.test(limpiar(p.color))) datos['Color'] = limpiar(p.color).replace(/^#?/, '#');
    if (!c) {
      const saldo = aNumero(p.saldo) || 0;
      datos['Saldo inicial'] = saldo; datos['Saldo a la fecha'] = new Date();
    }
    if (deuda) {
      const modo = p.modo === 'Por compra' ? 'Por compra' : 'Corte mensual';
      datos['Cuotas'] = modo;
      datos['Pedir valor cuota'] = p.pideValor === 'si' ? 'Sí' : 'No';
      datos['Máx. cuotas'] = Math.max(1, parseInt(p.maxCuotas, 10) || 36);
      datos['Tasa mensual'] = Math.max(0, Number(String(p.tasa || '0').replace(',', '.')) || 0) / 100;
      datos['Cupo'] = aNumero(p.cupo) || 0;
      if (modo === 'Corte mensual') {
        // "Tabla" (fechas de corte desde la tabla del banco) y "Último" se respetan; un campo vacío deja lo que había.
        const dc = limpiar(p.diaCorte).toLowerCase();
        if (dc === 'tabla') datos['Día de corte'] = 'Tabla';
        else if (dc === 'último' || dc === 'ultimo') datos['Día de corte'] = 'Último';
        else if (parseInt(dc, 10) > 0) datos['Día de corte'] = Math.min(31, parseInt(dc, 10));
        else if (!c) datos['Día de corte'] = 1;
        if (parseInt(p.diaPago, 10) > 0) datos['Día de pago'] = Math.min(31, parseInt(p.diaPago, 10));
        else if (!c) datos['Día de pago'] = 1;
        datos['Mes de pago'] = p.mesPago === 'Mismo' ? 'Mismo mes' : 'Siguiente';
      }
      datos['1 cuota sin interés'] = p.unaSinInteres === 'si' ? 'Sí' : 'No';
      datos['Intereses desde cuota 1'] = p.interesDesde1 === 'si' ? 'Sí' : 'No';
    }
    if (p.imagen !== undefined) datos['Imagen'] = imagenValida(p.imagen);
    guardarFilaConfig('Cuenta', nombre, datos, !c);
    return (c ? '✏️ Actualicé ' : '✅ Agregué ') + nombre + (c ? '' : ' con ' + (deuda ? 'deuda de ' : 'saldo de ') + pesos(aNumero(p.saldo) || 0));
  }
  if (!c) throw new Error('La cuenta "' + nombre + '" no existe.');
  if (op === 'archivar') {
    const usa = cfg.fijos.filter(function (f) { return f.activo && f.cuenta === nombre; }).map(function (f) { return f.nombre; });
    if (usa.length) throw new Error('Antes cambia la cuenta de estos gastos fijos (o quítalos): ' + usa.join(', ') + '.');
    const saldo = Math.round(saldoDe(cfg, nombre) || 0);
    if (saldo !== 0) throw new Error(nombre + ' todavía tiene ' + pesos(Math.abs(saldo)) + (c.tipo === 'Deuda' ? ' de deuda' : ' de saldo') + '. Déjala en $0 (paga, mueve la plata o ajusta el saldo) y luego la archivas.');
    guardarFilaConfig('Cuenta', nombre, { 'Activa': 'No' });
    return '🗂️ Archivé ' + nombre + '. Su historial se conserva y la puedes reactivar cuando quieras.';
  }
  if (op === 'reactivar') { guardarFilaConfig('Cuenta', nombre, { 'Activa': 'Sí' }); return '✅ ' + nombre + ' está activa otra vez.'; }
  if (op === 'imagen') { guardarFilaConfig('Cuenta', nombre, { 'Imagen': imagenValida(p.imagen) }); return '🖼️ Imagen de ' + nombre + ' actualizada.'; }
  throw new Error('Acción desconocida.');
}

/* =================================================================
 * BALANCE MENSUAL (llega el día 1 con el resumen del mes anterior)
 * ================================================================= */

const HOJA_CIERRES = 'Cierres';

/** Guarda (o actualiza) la foto de tus totales al cierre de un mes, para comparar mes a mes. */
function registrarCierre(claveMes, est, soloLeer) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let h = libro.getSheetByName(HOJA_CIERRES);
  if (!h) {
    h = libro.insertSheet(HOJA_CIERRES);
    h.getRange(1, 1, 1, 7).setValues([['Mes', 'Plata', 'Deudas', 'Te deben', 'Les debes', 'Patrimonio', 'Tomado el']]).setFontWeight('bold');
    h.setFrozenRows(1);
  }
  const fila = [claveMes, Math.round(est.totalPlata), Math.round(est.totalDeudas), Math.round(est.totalMeDeben),
    Math.round(est.totalLesDebo), Math.round(est.patrimonio), new Date()];
  const datos = h.getLastRow() > 1 ? h.getRange(2, 1, h.getLastRow() - 1, 7).getValues() : [];
  let anterior = null, idx = -1;
  datos.forEach(function (r, i) {
    // Sheets puede convertir "2026-09" en fecha: se lee de las dos formas.
    const k = r[0] instanceof Date ? clavesMes(r[0]) : String(r[0]).trim();
    if (k === claveMes) idx = i;
    else if (k < claveMes && (!anterior || k > anterior.mes)) anterior = { mes: k, plata: Number(r[1]) || 0, deudas: Number(r[2]) || 0, patrimonio: Number(r[5]) || 0 };
  });
  if (soloLeer) return anterior;
  const r = h.getRange(idx >= 0 ? idx + 2 : h.getLastRow() + 1, 1, 1, 7);
  r.getCell(1, 1).setNumberFormat('@');
  r.setValues([fila]);
  return anterior;
}

/** Arma y envía el balance de un mes ("2026-09"). */
function enviarBalanceMensual(claveMes, prueba) {
  const cfg = leerConfig();
  const movs = leerMovimientos();
  const hoyF = hoy();
  const est = calcular(movs, cfg, hoyF);
  const p = claveMes.split('-').map(Number);
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const nombreMes = function (k) { const q = k.split('-').map(Number); return MESES[q[1] - 1] + ' ' + q[0]; };
  const suma = function (o) { return Object.keys(o).reduce(function (s, k) { return s + o[k]; }, 0); };
  const cats = est.gastosMes(claveMes), ings = est.ingresosMes(claveMes);
  const ingresos = suma(ings), gastos = suma(cats), ahorro = ingresos - gastos;

  // Histórico: hasta 6 meses con datos (el resumen arranca en septiembre de 2026).
  const hist = [];
  for (let i = 5; i >= 0; i--) {
    const k = clavesMes(new Date(p[0], p[1] - 1 - i, 1));
    const ig = suma(est.ingresosMes(k)), gs = suma(est.gastosMes(k));
    if (ig || gs || k === claveMes) hist.push({ mes: k, ingresos: ig, gastos: gs });
  }
  const previos = hist.filter(function (h) { return h.mes !== claveMes; });
  const ant = previos.length ? previos[previos.length - 1] : null;
  const promGasto = previos.length ? previos.reduce(function (s, h) { return s + h.gastos; }, 0) / previos.length : 0;

  // Compras del mes: contado vs. a crédito, y las más grandes.
  const cuentas = {};
  cfg.cuentas.forEach(function (c) { cuentas[c.nombre] = c; });
  let contado = 0, financiado = 0;
  const compras = [];
  movs.forEach(function (m) {
    if (m.tipo !== TIPO.GASTO || clavesMes(m.fecha) !== claveMes || !cuentaEnResumen(m)) return;
    const mio = reparto(m).mio;
    if (!mio) return;
    const c = cuentas[m.cuenta];
    if (c && c.tipo === 'Deuda') financiado += mio; else contado += mio;
    compras.push({ desc: m.desc, monto: mio, cat: m.cat, fecha: m.fecha, cuenta: m.cuenta, cuotas: m.cuotas });
  });
  compras.sort(function (a, b) { return b.monto - a.monto; });

  const anterior = registrarCierre(claveMes, est, !!prueba);   // una prueba no toca el cierre real

  // ---------- HTML (estilos en línea para que Gmail lo respete) ----------
  const C = { bg: '#070b16', card: '#0e1628', line: '#1e2a44', ink: '#e8eefc', ink2: '#8fa3c7', good: '#2fd07a', crit: '#ff7a86', acc: '#5aa9ff', gold: '#f2c14e' };
  const emo = {};
  cfg.categorias.forEach(function (c) { emo[c.nombre] = c.emoji || ''; });
  const pct = function (a, b) { return b ? Math.round(a / b * 100) : 0; };
  const flecha = function (actual, antes, menosEsMejor) {
    if (!antes) return '';
    const d = Math.round((actual - antes) / antes * 100);
    if (!d) return '<span style="color:' + C.ink2 + '">igual que ' + nombreMes(ant.mes).split(' ')[0] + '</span>';
    const bien = menosEsMejor ? d < 0 : d > 0;
    return '<span style="color:' + (bien ? C.good : C.crit) + '">' + (d > 0 ? '▲ ' : '▼ ') + Math.abs(d) + '% vs ' + nombreMes(ant.mes).split(' ')[0] + '</span>';
  };
  const caja = function (titulo, cuerpo) {
    return '<tr><td style="padding:0 0 14px"><div style="background:' + C.card + ';border:1px solid ' + C.line + ';border-radius:14px;padding:16px">' +
      '<div style="font-size:13px;color:' + C.ink2 + ';text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">' + titulo + '</div>' + cuerpo + '</div></td></tr>';
  };
  const stat = function (t, v, color, extra) {
    return '<td style="padding:6px;width:33%;vertical-align:top"><div style="font-size:12px;color:' + C.ink2 + '">' + t + '</div>' +
      '<div style="font-size:20px;font-weight:bold;color:' + color + ';white-space:nowrap">' + v + '</div>' +
      (extra ? '<div style="font-size:11px;margin-top:2px">' + extra + '</div>' : '') + '</td>';
  };
  const barra = function (v, max, color) {
    const w = max ? Math.max(2, Math.round(v / max * 100)) : 0;
    return '<div style="background:' + C.line + ';border-radius:99px;height:6px;margin-top:5px"><div style="width:' + w + '%;height:6px;border-radius:99px;background:' + color + '"></div></div>';
  };

  let html = '<div style="font-family:Arial,sans-serif;background:' + C.bg + ';color:' + C.ink + ';padding:22px;border-radius:16px;max-width:600px">' +
    '<h2 style="margin:0 0 4px">📊 Tu balance de ' + nombreMes(claveMes) + '</h2>' +
    '<p style="color:' + C.ink2 + ';margin:0 0 16px">' + (prueba ? 'Prueba · datos hasta el ' + fmtLargo(hoyF) + ' (el mes aún no cierra).' : 'Así te fue el mes pasado.') + '</p>' +
    '<table style="width:100%;border-collapse:collapse;color:#e8eefc">';

  html += caja('Resumen',
    '<table style="width:100%;border-collapse:collapse;color:#e8eefc"><tr>' +
    stat('Ingresos', pesos(ingresos), C.good, ant ? flecha(ingresos, ant.ingresos, false) : '') +
    stat('Gastos', pesos(gastos), C.crit, ant ? flecha(gastos, ant.gastos, true) : '') +
    stat(ahorro >= 0 ? 'Ahorraste' : 'Gastaste de más', pesos(Math.abs(ahorro)), ahorro >= 0 ? C.acc : C.gold,
      ingresos ? '<span style="color:' + C.ink2 + '">' + pct(Math.abs(ahorro), ingresos) + '% de tus ingresos</span>' : '') +
    '</tr></table>' +
    (financiado ? '<p style="margin:12px 0 0;font-size:13px;color:' + C.ink2 + '">💳 ' + pesos(financiado) + ' de tus compras fueron a crédito y ' + pesos(contado) + ' de contado.</p>' : ''));

  const listaCats = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; });
  if (listaCats.length) {
    const top = listaCats.slice(0, 8), resto = listaCats.slice(8).reduce(function (s, k) { return s + cats[k]; }, 0);
    const maxC = cats[top[0]];
    let t = '';
    top.forEach(function (k) {
      t += '<div style="margin:0 0 10px"><table style="width:100%;border-collapse:collapse;color:#e8eefc"><tr><td style="font-size:14px">' + (emo[k] ? emo[k] + ' ' : '') + k + '</td>' +
        '<td style="text-align:right;font-size:14px;white-space:nowrap"><b>' + pesos(cats[k]) + '</b> <span style="color:' + C.ink2 + ';font-size:12px">' + pct(cats[k], gastos) + '%</span></td></tr></table>' +
        barra(cats[k], maxC, k === CAT_INTERESES ? C.gold : C.acc) + '</div>';
    });
    if (resto) t += '<div style="font-size:13px;color:' + C.ink2 + '">Otras ' + (listaCats.length - 8) + ' categorías: ' + pesos(resto) + '</div>';
    html += caja('¿En qué se fue la plata?', t);
  }

  const pres = est.presupuestosMes(claveMes).filter(function (x) { return x.tope > 0; });
  if (pres.length) {
    let t = '';
    pres.forEach(function (x) {
      const r = x.gastado / x.tope, color = r > 1 ? C.crit : r > 0.85 ? C.gold : C.good;
      t += '<div style="margin:0 0 10px"><table style="width:100%;border-collapse:collapse;color:#e8eefc"><tr><td style="font-size:14px">' + x.grupo + '</td>' +
        '<td style="text-align:right;font-size:13px;white-space:nowrap"><b style="color:' + color + '">' + pesos(x.gastado) + '</b> de ' + pesos(x.tope) + '</td></tr></table>' +
        barra(Math.min(x.gastado, x.tope), x.tope, color) + '</div>';
    });
    html += caja('Presupuestos', t);
  }

  if (compras.length) {
    let t = '<table style="width:100%;border-collapse:collapse;color:#e8eefc">';
    compras.slice(0, 5).forEach(function (c) {
      t += '<tr><td style="padding:7px 0;border-bottom:1px solid ' + C.line + ';font-size:14px">' + (emo[c.cat] ? emo[c.cat] + ' ' : '') + c.desc +
        '<br><span style="font-size:12px;color:' + C.ink2 + '">' + fmtLargo(c.fecha) + ' · ' + c.cuenta + (c.cuotas > 1 ? ' · ' + c.cuotas + ' cuotas' : '') + '</span></td>' +
        '<td style="padding:7px 0;border-bottom:1px solid ' + C.line + ';text-align:right;white-space:nowrap"><b>' + pesos(c.monto) + '</b></td></tr>';
    });
    html += caja('Tus compras más grandes', t + '</table>');
  }

  const fila = function (t, v, color, extra) {
    return '<tr><td style="padding:6px 0;font-size:14px">' + t + '</td><td style="padding:6px 0;text-align:right;white-space:nowrap"><b style="color:' + (color || C.ink) + '">' + v + '</b>' +
      (extra ? '<br><span style="font-size:11px">' + extra + '</span>' : '') + '</td></tr>';
  };
  const cambio = function (actual, antes, menosEsMejor) {
    if (antes == null) return '';
    const d = Math.round(actual - antes);
    if (!d) return '<span style="color:' + C.ink2 + '">sin cambio</span>';
    const bien = menosEsMejor ? d < 0 : d > 0;
    return '<span style="color:' + (bien ? C.good : C.crit) + '">' + (d > 0 ? '+' : '−') + pesos(Math.abs(d)).replace('-', '') + ' vs ' + nombreMes(anterior.mes).split(' ')[0] + '</span>';
  };
  html += caja('Cómo quedaste',
    '<table style="width:100%;border-collapse:collapse;color:#e8eefc">' +
    fila('💵 Plata en tus cuentas', pesos(est.totalPlata), C.ink, anterior ? cambio(est.totalPlata, anterior.plata, false) : '') +
    fila('💳 Lo que debes en créditos', pesos(est.totalDeudas), C.crit, anterior ? cambio(est.totalDeudas, anterior.deudas, true) : '') +
    (est.totalMeDeben ? fila('🤝 Te deben', pesos(est.totalMeDeben), C.good) : '') +
    (est.totalLesDebo ? fila('🙋 Les debes', pesos(est.totalLesDebo), C.gold) : '') +
    '<tr><td colspan="2" style="border-top:1px solid ' + C.line + ';padding:0"></td></tr>' +
    fila('<b>Patrimonio neto</b>', pesos(est.patrimonio), est.patrimonio >= 0 ? C.good : C.crit, anterior ? cambio(est.patrimonio, anterior.patrimonio, false) : '') +
    '</table>');

  let th = '<table style="width:100%;border-collapse:collapse;color:#e8eefc;font-size:13px"><tr style="color:' + C.ink2 + '"><td style="padding:5px 0">Mes</td><td style="text-align:right">Ingresos</td><td style="text-align:right">Gastos</td><td style="text-align:right">Ahorro</td></tr>';
  hist.forEach(function (h) {
    const a = h.ingresos - h.gastos, esEste = h.mes === claveMes;
    th += '<tr style="' + (esEste ? 'font-weight:bold' : '') + '"><td style="padding:6px 0;border-top:1px solid ' + C.line + '">' + cap_(nombreMes(h.mes).split(' ')[0].slice(0, 3)) + ' ' + String(h.mes).slice(2, 4) + '</td>' +
      '<td style="text-align:right;border-top:1px solid ' + C.line + ';color:' + C.good + '">' + pesos(h.ingresos) + '</td>' +
      '<td style="text-align:right;border-top:1px solid ' + C.line + ';color:' + C.crit + '">' + pesos(h.gastos) + '</td>' +
      '<td style="text-align:right;border-top:1px solid ' + C.line + ';color:' + (a >= 0 ? C.acc : C.gold) + '">' + pesos(a) + '</td></tr>';
  });
  th += '</table>';
  th += previos.length
    ? '<p style="margin:10px 0 0;font-size:13px;color:' + C.ink2 + '">Gastas en promedio ' + pesos(promGasto) + ' al mes. Este mes ' +
      (gastos > promGasto ? 'fueron ' + pesos(gastos - promGasto) + ' más.' : gastos < promGasto ? 'fueron ' + pesos(promGasto - gastos) + ' menos. 👏' : 'fue igual.') + '</p>'
    : '<p style="margin:10px 0 0;font-size:13px;color:' + C.ink2 + '">Es tu primer mes completo en la app: desde el próximo balance vas a ver la comparación mes a mes.</p>';
  html += caja('Tu histórico', th);

  html += '</table><p style="margin:6px 0 0"><a href="' + URL_APP + '" style="color:' + C.acc + '">Abrir mi dashboard →</a></p></div>';

  const para = cfg.ajustes.correo || Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({
    to: para,
    subject: '📊 Balance de ' + nombreMes(claveMes) + ': ' + (ahorro >= 0 ? 'ahorraste ' : 'gastaste de más ') + pesos(Math.abs(ahorro)) + (prueba ? ' (prueba)' : ''),
    htmlBody: html
  });
  return 'Balance de ' + nombreMes(claveMes) + ' enviado.';
}
function cap_(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/** Prueba: envía el balance del mes en curso. */
function probarBalance() { mostrar(enviarBalanceMensual(clavesMes(hoy()), true)); }

/* =================================================================
 * INSTALACIÓN Y MENÚ
 * ================================================================= */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('💰 Finanzas')
    .addItem('Configurar / reparar', 'configurarTodo')
    .addItem('Enviar recordatorio de prueba', 'probarRecordatorio')
    .addItem('Ver enlace del dashboard', 'verEnlace')
    .addToUi();
}

function configurarTodo() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  if (libro.getSpreadsheetTimeZone() !== Session.getScriptTimeZone()) {
    throw new Error('La zona horaria del script (' + Session.getScriptTimeZone() + ') no coincide con la de la hoja (' +
      libro.getSpreadsheetTimeZone() + '). Pon ambas en (GMT-05:00) Bogotá y vuelve a ejecutar.');
  }
  const creada = !libro.getSheetByName(HOJA_CONFIG);
  hojaConfig();
  const mov = hojaMovimientos();
  const migrados = migrarVersionAnterior(mov);
  formatearMovimientos(mov);
  asegurarEsquema();

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'recordatorioDiario') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('recordatorioDiario').timeBased().everyDays(1).atHour(7).create();

  libro.setActiveSheet(libro.getSheetByName(HOJA_CONFIG));
  mostrar('Listo ✅\n\n' +
    (creada ? '• Creé la pestaña Configuración con tus saldos, créditos y gastos fijos. Revísala.\n' : '') +
    (migrados ? '• Pasé ' + migrados + ' registro(s) de la versión anterior a Movimientos.\n' : '') +
    '• Recordatorio diario activado (7 a. m.).');
}

/* ---------- Actualizaciones del esquema (se aplican solas una vez) ---------- */

function asegurarEsquema() {
  const props = PropertiesService.getScriptProperties();
  const actual = Number(props.getProperty('esquema')) || 0;
  if (actual >= ESQUEMA) return;
  // Aquí van las migraciones futuras: if (actual < 10) migrarA10();
  props.setProperty('esquema', String(ESQUEMA));
  CACHE_CFG_ = null;
  CACHE_MOVS_ = null;
}

/* Las migraciones 5–9 (una sola vez, con el historial inicial del dueño) ya se aplicaron y se retiraron del código. */

function renombrarEn(hoja, viejo, nuevo) {
  const rango = hoja.getDataRange();
  const v = rango.getValues();
  v.forEach(function (fila, i) {
    fila.forEach(function (x, j) {
      if (typeof x === 'string' && x.trim() === viejo) hoja.getRange(i + 1, j + 1).setValue(nuevo);
    });
  });
}

/** Primera fila vacía de la tabla que empieza con ese encabezado (inserta una si la tabla está llena). */
function filaLibre(h, v, encabezado) {
  const i = filaEncabezado(v, encabezado);
  if (i < 0) throw new Error('No encontré la tabla "' + encabezado + '" en Configuración.');
  const esTitulo = function (k) { return k < v.length && String(v[k][0]).trim().indexOf('▸') === 0; };
  const vacia = function (k) { return v[k].every(function (x) { return x === '' || x === null; }); };
  for (let j = i + 1; j < v.length; j++) {
    // Tabla llena, o solo queda la fila en blanco que la separa del siguiente título: inserta una fila nueva.
    if (esTitulo(j) || (vacia(j) && esTitulo(j + 1))) { h.insertRowBefore(j + 1); return j + 1; }
    if (vacia(j)) return j + 1;
  }
  return v.length + 1;
}

function verEnlace() {
  mostrar('Tu dashboard:\n' + URL_APP);
}

function mostrar(t) {
  try { SpreadsheetApp.getUi().alert(t); } catch (e) { Logger.log(t); }
}

/* =================================================================
 * HOJAS
 * ================================================================= */

function hojaMovimientos() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let h = libro.getSheetByName(HOJA_MOV);
  if (!h) {
    h = libro.insertSheet(HOJA_MOV, 0);
    h.getRange(1, 1, 1, ENC_MOV.length).setValues([ENC_MOV]);
  }
  return h;
}

function agregarMovimiento(fila, id) {
  const h = hojaMovimientos();
  if (!id && RID_) { id = RID_ + (RID_N_ ? '#' + (RID_N_ + 1) : ''); RID_N_++; }
  // Un texto que empieza por = + - @ se volvería fórmula en Sheets: se guarda como texto.
  fila = fila.map(function (x) { return typeof x === 'string' && /^[=+\-@]/.test(x) && !/^-?\d[\d.,]*$/.test(x) ? "'" + x : x; });
  const completa = fila.slice(0, ENC_MOV.length - 2).concat([new Date(), id || Utilities.getUuid().slice(0, 8)]);
  ULT_ID_ = completa[completa.length - 1];
  while (completa.length < ENC_MOV.length) completa.splice(completa.length - 2, 0, '');
  CACHE_MOVS_ = null;
  if (PEND_) { PEND_.push(completa); return; }   // dentro de doPost: se escribe al final, todo junto
  h.appendRow(completa);
  formatoFilas_(h, h.getLastRow(), 1);
}

function formatoFilas_(h, r, n) {
  h.getRange(r, 1, n, 1).setNumberFormat('dd/mm/yyyy');
  h.getRange(r, 4, n, 1).setNumberFormat('$#,##0;-$#,##0');
  h.getRange(r, 10, n, 2).setNumberFormat('$#,##0');
  h.getRange(r, 12, n, 1).setNumberFormat('dd/mm/yyyy hh:mm');
}

/** Escribe de una vez las filas pendientes del registro en curso. */
function guardarPendientes_() {
  const filas = PEND_ || [];
  PEND_ = null;
  if (!filas.length) return;
  const h = hojaMovimientos();
  const r = h.getLastRow() + 1;
  h.getRange(r, 1, filas.length, ENC_MOV.length).setValues(filas);
  try { formatoFilas_(h, r, filas.length); } catch (e) { /* el formato es cosmético: los datos ya quedaron */ }
  CACHE_MOVS_ = null;
}

let CACHE_MOVS_ = null;
function leerMovimientos() {
  if (CACHE_MOVS_) return CACHE_MOVS_;
  const h = hojaMovimientos();
  const n = h.getLastRow() - 1;
  const filas = (n < 1 ? [] : h.getRange(2, 1, n, ENC_MOV.length).getValues()).concat(PEND_ || []);
  CACHE_MOVS_ = filas
    .filter(function (r) { return r[0] instanceof Date && r[1] && r[3] !== ''; })
    .map(function (r) {
      return {
        fecha: soloFecha(r[0]), tipo: String(r[1]).trim(), desc: String(r[2]), monto: Number(r[3]) || 0,
        cat: String(r[4]).trim(), cuenta: String(r[5]).trim(), destino: String(r[6]).trim(), para: String(r[7]).trim(),
        cuotas: parseInt(r[8], 10) || 0, valorCuota: Number(r[9]) || 0, costo: Number(r[10]) || 0,
        registrado: r[11] instanceof Date ? r[11] : null, id: String(r[12] || '')
      };
    })
    .map(function (m) {
      if (m.tipo === TIPO.GASTO && m.cuotas > 0 && m.valorCuota > 0 && !m.costo) m.costo = Math.max(0, Math.round(m.valorCuota * m.cuotas - m.monto));
      return m;
    });
  return CACHE_MOVS_;
}

function formatearMovimientos(h) {
  const cols = ENC_MOV.length;
  const filas = h.getMaxRows();
  h.getRange(1, 1, 1, cols).setValues([ENC_MOV]).setFontWeight('bold').setFontColor('#ffffff')
    .setBackground('#0b3d91').setHorizontalAlignment('center').setVerticalAlignment('middle');
  h.setRowHeight(1, 30);
  h.setFrozenRows(1);
  [95, 115, 230, 110, 200, 130, 130, 180, 65, 105, 110, 135, 150].forEach(function (w, i) { h.setColumnWidth(i + 1, w); });
  h.getRange(2, 1, filas - 1, 1).setNumberFormat('dd/mm/yyyy');
  h.getRange(2, 4, filas - 1, 1).setNumberFormat('$#,##0;-$#,##0');
  h.getRange(2, 10, filas - 1, 2).setNumberFormat('$#,##0');
  h.getRange(2, 12, filas - 1, 1).setNumberFormat('dd/mm/yyyy hh:mm');
  h.getRange(2, 12, filas - 1, 2).setFontColor('#8a94a6');
  const zona = h.getRange(2, 1, filas - 1, cols);
  const regla = function (tipo, color) {
    return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$B2="' + tipo + '"')
      .setBackground(color).setRanges([zona]).build();
  };
  h.setConditionalFormatRules([
    regla(TIPO.INGRESO, '#e8f5e9'), regla(TIPO.MEPAGARON, '#e0f2f1'),
    regla(TIPO.TRANSF, '#e3f2fd'), regla(TIPO.AJUSTE, '#f3e5f5'),
    regla(TIPO.MEPRESTARON, '#fff8e1'), regla(TIPO.LEPAGUE, '#fbe9e7')
  ]);
  h.setTabColor('#1e6bff');
}

function migrarVersionAnterior(mov) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const vieja = libro.getSheetByName('Gastos');
  if (!vieja || mov.getLastRow() > 1) return 0;
  const n = vieja.getLastRow() - 1;
  if (n < 1) { vieja.setName('Gastos (versión anterior)'); return 0; }
  const ancho = vieja.getLastColumn();
  const enc = vieja.getRange(1, 1, 1, ancho).getValues()[0].map(String);
  const col = function (nombre) { return enc.indexOf(nombre); };
  const mapaCat = { 'Ropa y compras en línea': 'Tecnología y accesorios', 'Deudas': 'Otros', 'Salud': 'Otros' };
  const filas = vieja.getRange(2, 1, n, ancho).getValues()
    .filter(function (r) { return r[0] instanceof Date && Number(r[col('Monto')]) > 0; })
    .map(function (r) {
      const cat = String(r[col('Categoría')] || 'Otros');
      return [r[0], TIPO.GASTO, r[col('Descripción')], Number(r[col('Monto')]), mapaCat[cat] || cat,
        r[col('Método de pago')], '', '', col('Cuotas') >= 0 ? r[col('Cuotas')] : '', col('Valor cuota') >= 0 ? r[col('Valor cuota')] : '', '',
        r[col('Registrado el')] instanceof Date ? r[col('Registrado el')] : r[0], Utilities.getUuid().slice(0, 8)];
    });
  if (filas.length) mov.getRange(2, 1, filas.length, ENC_MOV.length).setValues(filas);
  vieja.setName('Gastos (versión anterior)');
  return filas.length;
}

/* ---------- Configuración ---------- */

const ENC_CUENTAS = ['Cuenta', 'Tipo', 'Emoji', 'Sitio web', 'Color', 'Color texto', 'Saldo inicial', 'Saldo a la fecha',
  'Cuotas', 'Día de corte', 'Día de pago', 'Mes de pago', 'Tasa mensual', 'Cargo inicial', '1 cuota sin interés',
  'Pedir valor cuota', 'Máx. cuotas', 'Cupo', 'Compras mínimas al mes', 'Aparta para', 'Se alimenta desde', 'Activa'];
const ENC_PREVIAS = ['Crédito', 'Detalle', 'Valor cuota', 'Cuotas que faltan', 'Primer pago', 'Va en la cuota', 'De', 'Capital pendiente'];
const ENC_FIJOS = ['Gasto fijo', 'Valor', 'Frecuencia', 'Día', 'Próximo cobro', 'Categoría', 'Cuenta', 'Cobro',
  'Compartido con', 'Cada uno pone', 'Aviso', 'Sitio web', 'Color', 'Color texto', 'Desde', 'Activo'];

function hojaConfig() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let h = libro.getSheetByName(HOJA_CONFIG);
  if (h) return h;
  h = libro.insertSheet(HOJA_CONFIG);
  h.setTabColor('#5aa9ff');
  const F = leerFecha;
  const foto = new Date(2026, 8, 29, 15, 0); // momento en que se tomaron los saldos iniciales
  const alta = new Date(2026, 8, 30); // los gastos fijos automáticos se registran desde esta fecha
  let fila = 1;

  h.getRange(fila, 1, 1, 10).merge().setValue('⚙️ CONFIGURACIÓN DE MIS FINANZAS')
    .setFontSize(15).setFontWeight('bold').setFontColor('#ffffff').setBackground('#0b3d91');
  h.setRowHeight(fila, 36);
  fila += 1;
  h.getRange(fila, 1, 1, 10).merge()
    .setValue('Los menús del celular y el dashboard salen de aquí. Para agregar algo, escribe en una fila vacía de la tabla correspondiente (antes del título ▸ de la siguiente sección).')
    .setFontColor('#5b6b85').setFontStyle('italic').setWrap(true);
  h.setRowHeight(fila, 34);
  fila += 2;

  const seccion = function (titulo, nota) {
    h.getRange(fila, 1).setValue('▸ ' + titulo).setFontWeight('bold').setFontColor('#0b3d91').setFontSize(12);
    if (nota) h.getRange(fila, 2, 1, 10).merge().setValue(nota).setFontColor('#5b6b85').setFontSize(9).setWrap(true);
    h.setRowHeight(fila, 30);
    fila++;
  };
  const tabla = function (enc, filas, libres) {
    h.getRange(fila, 1, 1, enc.length).setValues([enc]).setFontWeight('bold').setBackground('#dbe8ff')
      .setWrap(true).setVerticalAlignment('middle');
    h.setRowHeight(fila, 34);
    const ini = fila + 1;
    if (filas.length) h.getRange(ini, 1, filas.length, enc.length).setValues(filas);
    fila = ini + filas.length + libres + 1;
    return { ini: ini, n: filas.length + libres };
  };
  const lista = function (t, col, valores) {
    h.getRange(t.ini, col, t.n, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(valores, true).setAllowInvalid(true).build());
  };

  // ---- Cuentas ----
  seccion('CUENTAS', 'Tipo: Plata o Deuda. "Saldo inicial": lo que había (o lo que debías) en la fecha de la columna H; solo cuentan los registros posteriores. ' +
    'Cuotas: "Corte mensual" (tarjetas), "Por compra" (cada compra con su propio plazo mensual, como Credifin) o "Sin cuotas". Día de corte: número, "Último" o "Tabla".');
  const c = function (nombre, tipo, emoji, sitio, color, texto, saldo, extra) {
    const e = extra || {};
    return [nombre, tipo, emoji, sitio, color, texto, saldo, foto, e.cuotas || 'Sin cuotas', e.corte || '', e.pago || '', e.mes || '',
      e.tasa || '', e.cargo || '', e.una || '', e.valor || '', e.max || '', e.cupo || '', e.min || '', e.aparta || '', e.desde || '', 'Sí'];
  };
  // Datos de EJEMPLO (ficticios) para una hoja nueva: cámbialos por los tuyos en la pestaña Configuración.
  const tC = tabla(ENC_CUENTAS, [
    c('Nequi', 'Plata', '🩷', 'nequi.com.co', '#CA0080', '#FFFFFF', 500000),
    c('Daviplata', 'Plata', '❤️', 'daviplata.com', '#DD141D', '#FFFFFF', 120000),
    c('Efectivo', 'Plata', '💵', '', '#1F9D5A', '#FFFFFF', 0),
    c('Bolsillo para la tarjeta', 'Plata', '🎯', 'daviplata.com', '#DD141D', '#FFFFFF', 0, { aparta: 'TC Davibank', desde: 'Daviplata' }),
    c('Addi', 'Deuda', '🔵', 'addi.com', '#3C6AF0', '#FFFFFF', 600000,
      { cuotas: 'Corte mensual', corte: 24, pago: 1, mes: 'Siguiente', tasa: 0.0215, cargo: 0, una: 'No', valor: 'Sí', max: 24, cupo: 2000000 }),
    c('TC Nubank', 'Deuda', '🟣', 'nu.com.co', '#820AD1', '#FFFFFF', 300000,
      { cuotas: 'Corte mensual', corte: 1, pago: 21, mes: 'Mismo', tasa: 0.0213, cargo: 0, una: 'Sí', valor: 'No', max: 36, cupo: 1500000 }),
    c('TC Davibank', 'Deuda', '🔴', 'davibank.com', '#0B0B0B', '#ED1C27', 1200000,
      { cuotas: 'Corte mensual', corte: 'Tabla', pago: 'Tabla', tasa: 0.0213, cargo: 0, una: 'Sí', valor: 'No', max: 36, cupo: 3000000, min: 7 }),
    c('Credifin', 'Deuda', '🧾', 'credifin.com.co', '#1D8DC6', '#FFFFFF', 100000,
      { cuotas: 'Por compra', tasa: 0.021605, cargo: 0.1547, una: 'No', valor: 'Sí', max: 6, cupo: 500000 }),
    c(CUENTA_MAMA, 'Deuda', '👩', '', '#F2994A', '#FFFFFF', 0)
  ], 6);
  h.getRange(tC.ini, 7, tC.n, 1).setNumberFormat('$#,##0').setBackground('#fff8d6');
  h.getRange(tC.ini, 8, tC.n, 1).setNumberFormat('dd/mm/yyyy hh:mm');
  h.getRange(tC.ini, 13, tC.n, 2).setNumberFormat('0.00%');
  h.getRange(tC.ini, 18, tC.n, 1).setNumberFormat('$#,##0');
  lista(tC, 2, ['Plata', 'Deuda']);
  lista(tC, 9, ['Corte mensual', 'Por compra', 'Sin cuotas']);
  lista(tC, 12, ['Mismo', 'Siguiente']);
  [15, 16, 22].forEach(function (col) { lista(tC, col, ['Sí', 'No']); });

  // ---- Deudas previas ----
  seccion('DEUDAS QUE YA TRAÍAS', 'Las cuotas pendientes al momento de empezar. "Primer pago": fecha de la próxima cuota; las siguientes se calculan con el ciclo de la tarjeta (o mes a mes). ' +
    'Lo que no esté aquí queda como "saldo sin calendario".');
  const tP = tabla(ENC_PREVIAS, [
    ['Addi', 'Tienda de ropa', 50000, 3, F('2026-10-01'), 1, 3, 150000],
    ['Addi', 'Repuestos moto', 100000, 4, F('2026-10-01'), 3, 6, 400000],
    ['TC Nubank', 'Extracto de octubre', 180000, 1, F('2026-10-21'), '', '', ''],
    ['TC Nubank', 'Droguería', 40000, 1, F('2026-11-21'), 2, 2, ''],
    ['TC Davibank', 'Pago mínimo extracto septiembre', 350000, 1, F('2026-10-07'), '', '', ''],
    ['TC Davibank', 'Supermercado', 60000, 2, F('2026-11-04'), 2, 3, ''],
    ['TC Davibank', 'Electrodoméstico', 90000, 10, F('2026-11-04'), 3, 12, ''],
    ['Credifin', 'Cine', 50000, 2, F('2026-10-09'), 2, 3, '']
  ], 8);
  h.getRange(tP.ini, 3, tP.n, 1).setNumberFormat('$#,##0');
  h.getRange(tP.ini, 5, tP.n, 1).setNumberFormat('dd/mm/yyyy');

  // ---- Me deben desde antes ----
  seccion('ME DEBEN DESDE ANTES', 'Plata que alguien te debía al empezar. Cuando te pague, regístralo con 🤝 Me pagaron.');
  const tM = tabla(['Persona', 'Concepto', 'Monto', 'Ya pagado', 'Fecha de pago'], [
    ['Ana', 'Boletas de cine', 60000, '', '']
  ], 6);
  h.getRange(tM.ini, 3, tM.n, 2).setNumberFormat('$#,##0');
  h.getRange(tM.ini, 5, tM.n, 1).setNumberFormat('dd/mm/yyyy');

  // ---- Gastos fijos ----
  seccion('GASTOS FIJOS Y SUSCRIPCIONES', 'Frecuencia: Mensual (usa "Día"), Anual o Una vez (usan "Próximo cobro"). Cobro: Automático (se registra solo ese día) o Manual (lo pagas desde el botón: 📌). ' +
    'Aviso "Cancelar": te recuerda cancelarlo antes del cobro. "Compartido con": nombres separados por coma; cada uno te debe "Cada uno pone".');
  const fj = function (nombre, valor, frec, dia, prox, cat, cuenta, cobro, comp, cada, aviso, sitio, color, texto) {
    return [nombre, valor, frec, dia || '', prox ? F(prox) : '', cat, cuenta, cobro, comp || '', cada || '', aviso || '', sitio, color, texto, alta, 'Sí'];
  };
  const tF = tabla(ENC_FIJOS, [
    fj('Gimnasio', 120000, 'Mensual', 18, '', 'Gimnasio y suplementos', 'Nequi', 'Automático', '', '', '', '', '#FBBA00', '#1A1A1A'),
    fj('Google One', 19900, 'Mensual', 22, '', 'Suscripciones', 'TC Davibank', 'Automático', '', '', '', 'one.google.com', '#4285F4', '#FFFFFF'),
    fj('Spotify', 300000, 'Anual', '', '2027-07-22', 'Suscripciones', 'TC Davibank', 'Automático', '', '', '', 'spotify.com', '#1DB954', '#FFFFFF'),
    fj('Streaming familiar', 42000, 'Mensual', 9, '', 'Suscripciones', 'TC Davibank', 'Automático', 'Ana, Carlos, Luisa', 7000, '', 'netflix.com', '#E50914', '#FFFFFF'),
    fj('Internet y TV', 107000, 'Mensual', 21, '', 'Servicios públicos', 'Nequi', 'Manual', '', '', '', '', '#019DF4', '#FFFFFF'),
    fj('Plan celular familiar', 32000, 'Mensual', 26, '', 'Servicios públicos', 'Nequi', 'Manual', '', '', '', '', '#019DF4', '#FFFFFF'),
    fj('Suscripción de apps', 66000, 'Mensual', 28, '', 'Suscripciones', 'TC Nubank', 'Automático', '', '', '', '', '#D97757', '#FFFFFF'),
    fj('Prueba gratis', 24490, 'Una vez', '', '2026-10-20', 'Suscripciones', 'Nequi', 'Manual', '', '', 'Cancelar', '', '#FF441F', '#FFFFFF'),
    fj('Cuota de manejo Nubank', 12000, 'Mensual', 1, '', CAT_INTERESES, 'TC Nubank', 'Automático', '', '', '', 'nu.com.co', '#820AD1', '#FFFFFF'),
    fj('Seguro de vida Davibank', 5490, 'Mensual', 18, '', CAT_INTERESES, 'TC Davibank', 'Automático', '', '', '', 'davibank.com', '#0B0B0B', '#ED1C27')
  ], 8);
  h.getRange(tF.ini, 2, tF.n, 1).setNumberFormat('$#,##0');
  h.getRange(tF.ini, 5, tF.n, 1).setNumberFormat('dd/mm/yyyy');
  h.getRange(tF.ini, 10, tF.n, 1).setNumberFormat('$#,##0');
  h.getRange(tF.ini, 15, tF.n, 1).setNumberFormat('dd/mm/yyyy');
  lista(tF, 3, ['Mensual', 'Anual', 'Una vez']);
  lista(tF, 8, ['Automático', 'Manual']);
  lista(tF, 11, ['', 'Cancelar']);
  lista(tF, 16, ['Sí', 'No']);

  // ---- Categorías ----
  seccion('CATEGORÍAS DE GASTO', 'La columna "Presupuesto" agrupa categorías bajo un tope mensual (tabla siguiente).');
  tabla(['Categoría', 'Emoji', 'Presupuesto'], [
    ['Mercado', '🛒', ''],
    ['Comidas afuera', '🍔', 'Ocio'],
    ['Entretenimiento y videojuegos', '🎮', 'Ocio'],
    ['Ropa', '👕', ''],
    ['Suscripciones', '📺', ''],
    ['Gimnasio y suplementos', '💪', ''],
    ['Transporte', '🚗', ''],
    ['Servicios públicos', '💡', ''],
    ['Hogar y enseres', '🏠', ''],
    ['Salud y farmacia', '💊', ''],
    ['Mascotas', '🐕', ''],
    ['Regalos y detalles', '🎁', ''],
    ['Tecnología y accesorios', '💻', ''],
    ['Préstamos a personas', '🤝', ''],
    ['Otros', '🔖', '']
  ], 5);

  seccion('PRESUPUESTOS MENSUALES', 'Se reinician solos cada mes.');
  const tPr = tabla(['Presupuesto', 'Tope mensual'], [['Ocio', 350000]], 3);
  h.getRange(tPr.ini, 2, tPr.n, 1).setNumberFormat('$#,##0');

  seccion('TIPOS DE INGRESO', '');
  tabla(['Tipo de ingreso', 'Emoji'], [
    ['Salario', '💼'], ['Honorarios', '📄'], ['Transferencias recibidas', '📲'], [CAT_APORTE, '👩'], ['Otros', '💰']
  ], 3);

  seccion('METAS DE AHORRO', 'Cada meta va ligada a una cuenta de plata (un bolsillo): el progreso es su saldo. Se administran desde Más → Metas de ahorro.');
  tabla(['Meta', 'Emoji', 'Objetivo', 'Fecha límite', 'Cuenta', 'Foto'], [], 3);

  seccion('AJUSTES', '');
  tabla(['Ajuste', 'Valor'], [['Nombre', ''], ['Recordar días antes', 3], ['Correo para recordatorios', '']], 0);

  seccion('FECHAS DE DAVIBANK', 'Agrega las nuevas cuando el banco las publique. Si se acaban, se estiman (primer viernes desde el 16 + 19 días).');
  const davi = [
    ['2025-12-19', '2026-01-07'], ['2026-01-16', '2026-02-04'], ['2026-02-20', '2026-03-10'],
    ['2026-03-20', '2026-04-13'], ['2026-04-17', '2026-05-06'], ['2026-05-22', '2026-06-09'],
    ['2026-06-19', '2026-07-08'], ['2026-07-17', '2026-08-10'], ['2026-08-21', '2026-09-08'],
    ['2026-09-18', '2026-10-07'], ['2026-10-16', '2026-11-04'], ['2026-11-20', '2026-12-09'],
    ['2026-12-18', '2027-01-12']
  ].map(function (p) { return [F(p[0]), F(p[1])]; });
  const tD = tabla(['Corte Davibank', 'Límite de pago'], davi, 12);
  h.getRange(tD.ini, 1, tD.n, 2).setNumberFormat('dd/mm/yyyy');

  h.setColumnWidth(1, 220);
  for (let col = 2; col <= ENC_CUENTAS.length; col++) h.setColumnWidth(col, 110);
  h.setColumnWidth(2, 230);
  h.setFrozenColumns(1);
  return h;
}

/** Fila del encabezado de una tabla de Configuración: la que va justo después de su título ▸
 *  (así una cuenta llamada "Crédito" o "Persona" no se confunde con el encabezado de otra tabla). */
function filaEncabezado(v, encabezado) {
  let primero = -1;
  for (let k = 0; k < v.length; k++) {
    if (String(v[k][0]).trim() !== encabezado) continue;
    if (k > 0 && String(v[k - 1][0]).trim().indexOf('▸') === 0) return k;
    if (primero < 0) primero = k;
  }
  return primero;
}
const NOMBRES_RESERVADOS = ['meta', 'cuenta', 'gasto fijo', 'credito', 'persona', 'presupuesto', 'categoria', 'tipo de ingreso', 'ajuste', 'corte davibank'];
function nombreValido(nombre) {
  if (/^▸/.test(nombre)) throw new Error('El nombre no puede empezar con ▸.');
  if (NOMBRES_RESERVADOS.indexOf(normalizarTexto(nombre)) >= 0) throw new Error('"' + nombre + '" es un nombre reservado de la hoja. Usa otro (por ejemplo "' + nombre + ' 1").');
}

function leerTabla(valores, encabezado) {
  const i = filaEncabezado(valores, encabezado);
  if (i < 0) return [];
  const enc = valores[i].map(function (x) { return String(x).trim(); });
  const filas = [];
  for (let j = i + 1; j < valores.length; j++) {
    const a = String(valores[j][0]).trim();
    if (a.indexOf('▸') === 0) break;
    if (!a) continue;
    const o = {};
    enc.forEach(function (k, c) { if (k) o[k] = valores[j][c]; });
    filas.push(o);
  }
  return filas;
}

let CACHE_CFG_ = null;
function leerConfig() {
  if (CACHE_CFG_) return CACHE_CFG_;
  const h = hojaConfig();
  const v = h.getDataRange().getValues();
  const si = function (x) { return /^s[ií]/i.test(String(x).trim()); };
  const tasa = function (x) { let t = Number(x) || 0; if (t >= 1) t = t / 100; return t; };
  const fecha = function (x) { return x instanceof Date ? soloFecha(x) : null; };
  const color = function (x, def) { const s = String(x || '').trim(); return /^#?[0-9a-f]{6}$/i.test(s) ? (s[0] === '#' ? s : '#' + s) : def; };

  const cuentas = leerTabla(v, 'Cuenta').map(function (r) {
    const deuda = /^deuda/i.test(String(r['Tipo']));
    return {
      nombre: String(r['Cuenta']).trim(),
      tipo: deuda ? 'Deuda' : 'Plata',
      emoji: String(r['Emoji'] || '').trim() || (deuda ? '💳' : '🏦'),
      sitio: String(r['Sitio web'] || '').trim(),
      color: color(r['Color'], deuda ? '#3D8BFF' : '#2A78D6'),
      colorTexto: color(r['Color texto'], '#FFFFFF'),
      saldoInicial: Number(r['Saldo inicial']) || 0,
      saldoFecha: r['Saldo a la fecha'] instanceof Date ? r['Saldo a la fecha'] : null,
      modo: String(r['Cuotas'] || 'Sin cuotas').trim(),
      diaCorte: r['Día de corte'],
      diaPago: r['Día de pago'],
      mesPago: /^sig/i.test(String(r['Mes de pago'])) ? 'Siguiente' : 'Mismo',
      tasa: tasa(r['Tasa mensual']),
      cargo: tasa(r['Cargo inicial']),
      unaSinInteres: si(r['1 cuota sin interés']),
      pideValor: si(r['Pedir valor cuota']),
      maxCuotas: Number(r['Máx. cuotas']) || 36,
      cupo: Number(r['Cupo']) || 0,
      comprasMin: Number(r['Compras mínimas al mes']) || 0,
      apartaPara: String(r['Aparta para'] || '').trim(),
      alimentaDesde: String(r['Se alimenta desde'] || '').trim(),
      activa: String(r['Activa'] || '').trim() === '' || si(r['Activa']),
      interesDesde1: si(r['Intereses desde cuota 1']),
      imagen: String(r['Imagen'] || '').trim()
    };
  });
  const previas = leerTabla(v, 'Crédito').map(function (r) {
    return { credito: String(r['Crédito']).trim(), detalle: String(r['Detalle'] || 'Cuota pendiente').trim(),
      valor: Number(r['Valor cuota']) || 0, cuotas: Math.max(1, parseInt(r['Cuotas que faltan'], 10) || 1), primerPago: fecha(r['Primer pago']),
      desde: parseInt(r['Va en la cuota'], 10) || 0, de: parseInt(r['De'], 10) || 0, capital: Number(r['Capital pendiente']) || 0 };
  }).filter(function (p) { return p.valor > 0; });
  const deudoresIniciales = leerTabla(v, 'Persona').map(function (r) {
    return { persona: String(r['Persona']).trim(), concepto: String(r['Concepto'] || '').trim(), monto: Number(r['Monto']) || 0,
      pagado: Number(r['Ya pagado']) || 0, vence: fecha(r['Fecha de pago']) };
  }).filter(function (x) { return x.persona && x.monto > 0; });
  const fechasFavor = {};
  leerTabla(v, 'ID favor').forEach(function (r) { const f = fecha(r['Fecha de pago']); const id = String(r['ID favor']).trim(); if (id && f) fechasFavor[id] = f; });
  const fijos = leerTabla(v, 'Gasto fijo').map(function (r) {
    const frec = String(r['Frecuencia'] || 'Mensual').trim();
    return {
      nombre: String(r['Gasto fijo']).trim(), valor: Number(r['Valor']) || 0,
      frecuencia: /^anual/i.test(frec) ? 'Anual' : /^una/i.test(frec) ? 'Una vez' : 'Mensual',
      dia: Number(r['Día']) || 1, proximo: fecha(r['Próximo cobro']),
      categoria: String(r['Categoría'] || 'Otros').trim(), cuenta: String(r['Cuenta'] || '').trim(),
      cobro: /^auto/i.test(String(r['Cobro'])) ? 'Automático' : 'Manual',
      compartido: String(r['Compartido con'] || '').split(',').map(function (s) { return s.trim(); }).filter(String),
      porPersona: Number(r['Cada uno pone']) || 0,
      aviso: /^cancel/i.test(String(r['Aviso'] || '')) ? 'Cancelar' : '',
      sitio: String(r['Sitio web'] || '').trim(),
      color: color(r['Color'], '#3D8BFF'), colorTexto: color(r['Color texto'], '#FFFFFF'),
      desde: fecha(r['Desde']),
      canceladoEl: fecha(r['Cancelado el']),
      activo: String(r['Activo'] || '').trim() === '' || si(r['Activo'])
    };
  }).filter(function (f) { return f.nombre && f.valor > 0; });
  const categorias = leerTabla(v, 'Categoría').map(function (r) {
    return { nombre: String(r['Categoría']).trim(), emoji: String(r['Emoji'] || '🔖').trim(), grupo: String(r['Presupuesto'] || '').trim() };
  });
  const presupuestos = {};
  leerTabla(v, 'Presupuesto').forEach(function (r) {
    const t = Number(r['Tope mensual']);
    if (t > 0) presupuestos[String(r['Presupuesto']).trim()] = t;
  });
  const metas = leerTabla(v, 'Meta').map(function (r) {
    return { nombre: String(r['Meta']).trim(), emoji: String(r['Emoji'] || '🎯').trim(), objetivo: Number(r['Objetivo']) || 0,
      fecha: fecha(r['Fecha límite']), cuenta: String(r['Cuenta'] || '').trim(), foto: String(r['Foto'] || '').trim() };
  }).filter(function (m) { return m.nombre && m.objetivo > 0; });
  const ingresos = leerTabla(v, 'Tipo de ingreso').map(function (r) {
    return { nombre: String(r['Tipo de ingreso']).trim(), emoji: String(r['Emoji'] || '💰').trim() };
  });
  const ajustes = {};
  leerTabla(v, 'Ajuste').forEach(function (r) {
    const k = String(r['Ajuste']).trim();
    if (k === 'Nombre') ajustes.nombre = String(r['Valor']).trim();
    if (k === 'Recordar días antes') ajustes.diasAntes = Number(r['Valor']) || 3;
    if (k === 'Correo para recordatorios') ajustes.correo = String(r['Valor']).trim();
  });
  const davi = leerTabla(v, 'Corte Davibank')
    .filter(function (r) { return r['Corte Davibank'] instanceof Date && r['Límite de pago'] instanceof Date; })
    .map(function (r) { return { corte: soloFecha(r['Corte Davibank']), limite: soloFecha(r['Límite de pago']) }; });

  CACHE_CFG_ = { cuentas: cuentas, previas: previas, deudoresIniciales: deudoresIniciales, fijos: fijos, categorias: categorias, presupuestos: presupuestos,
    ingresos: ingresos, ajustes: ajustes, davi: davi, metas: metas, fechasFavor: fechasFavor };
  return CACHE_CFG_;
}

function cuentaPorNombre(cfg, nombre) {
  const n = limpiar(nombre);
  const c = cfg.cuentas.find(function (x) { return x.nombre === n; });
  if (!c) throw new Error('La cuenta "' + n + '" no existe en Configuración.');
  return c;
}

function bolsilloDe(cfg, deuda) {
  return cfg.cuentas.find(function (c) { return c.tipo === 'Plata' && c.activa && c.apartaPara === deuda; }) || null;
}

/* =================================================================
 * AVISOS DE NOTIFICACIONES
 * Una macro del celular (MacroDroid/Tasker) reenvía cada notificación o SMS del banco con la acción "aviso".
 * Aquí se leen, se unen los avisos repetidos (app + SMS + correo + Billetera) y quedan en la hoja "Avisos"
 * como "Pendiente" hasta que Hector los resuelve en la app ("Por confirmar"). En modo "auto" los gastos
 * simples (a 1 cuota) y las transferencias entre sus cuentas se registran solos.
 * Credifin y Addi no se leen a propósito (cuotas especiales): siempre se registran a mano.
 * ================================================================= */

const HOJA_AV = 'Avisos';
const ENC_AV = ['ID', 'Hora del aviso', 'Fuentes', 'Avisos', 'Banco', 'Cuenta', 'Tipo', 'Monto', 'Comercio / persona', 'Destino',
  'Recurrente', 'Tarjeta', 'Estado', 'ID movimiento', 'Nota', 'Recibido el', 'Resolución', 'Texto', 'PSE', 'Origen'];
const AV_MODOS = ['avisar', 'auto'];

const AV = (function () {
  const MS_MIN = 60000;
  /** "8.749,21" "$42.850,00" "$440.000" "74,915" "COP12,480" "25000" -> número */
  function num(s) {
    s = String(s).replace(/[^\d.,]/g, '');
    if (!s) return NaN;
    const p = s.lastIndexOf('.'), c = s.lastIndexOf(',');
    if (p >= 0 && c >= 0) {
      const dec = Math.max(p, c);
      return parseFloat(s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1));
    }
    const sep = p >= 0 ? '.' : c >= 0 ? ',' : '';
    if (!sep) return parseFloat(s);
    const partes = s.split(sep);
    const ultima = partes[partes.length - 1];
    if (partes.length > 2 || (ultima.length === 3 && partes[0].length >= 1 && partes[0].length <= 3)) return parseFloat(partes.join(''));
    return parseFloat(partes.join('.'));
  }
  const limpio = function (s) { return String(s || '').replace(/\s+/g, ' ').trim(); };
  const norm = function (s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, ''); };
  const esMio = function (n, yo) { const x = norm(String(yo || '').split(/\s+/)[0]); return !!x && norm(n).indexOf(x) === 0; };

  function fechaTexto(t, ts) {
    const m = /(\d{4})[\/-](\d{2})[\/-](\d{2})[ .]+(\d{2}):(\d{2})(?::(\d{2}))?/.exec(t);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)).getTime() : ts;
  }

  /** n = { app, titulo, texto, ts } -> { banco, tc, tipo: gasto|entrada|salida|retiro, comercio, persona, monto, ts, recurrente, pse, correo, fuente } | null */
  function parse(n) {
    // La macro puede perder tildes y signos (¡, í) y agregar llaves o corchetes: el lector no depende de ellos.
    const t = limpio(String((n.titulo ? n.titulo + ' ' : '') + (n.texto || '')).replace(/[{}\[\]]/g, ' '));
    const ts = n.ts || Date.now();
    let m;
    const ev = function (o) { o.ts = o.ts || ts; o.fuente = n.app; o.crudo = t; return o; };

    // Credifin y Addi: sus PROPIOS avisos nunca se leen (cuotas especiales). Un pago que TÚ les haces desde otro banco
    // ("compra aprobada … En MERCADO PAGO CREDIFIND") sí es un movimiento tuyo.
    if (/credifin|addi\b/i.test(n.app || '') || /^(credifin|addi)\b/i.test(t)) return null;

    // Davibank (tarjeta de crédito) por SMS
    if ((m = /DAVIbank\s*:?\s*(Compra recurrente|Realizaste\s+transaccion) en (.+?) por ([\d.,]+) con tu tarjeta/i.exec(t)))
      return ev({ banco: 'davibank', tc: true, tipo: 'gasto', comercio: limpio(m[2]), monto: num(m[3]), recurrente: /recurrente/i.test(m[1]), ts: fechaTexto(t, ts) });
    if (/DAVIbank/i.test(t)) return null;

    // Daviplata por SMS
    if ((m = /DaviPlata:\s*Pagaste\s+([\d.,]+)\s+con tu Tarjeta/i.exec(t)))
      return ev({ banco: 'daviplata', tipo: 'gasto', comercio: '', monto: num(m[1]) });
    if ((m = /^Recibiste\s+([\d.,]+)\./i.exec(t)))
      return ev({ banco: 'daviplata', tipo: 'entrada', persona: '', monto: num(m[1]) });
    if ((m = /Pasaste\s+\$?([\d.,]+)\s+a\s+(.+?)\s+usando Llaves/i.exec(t)))      // "Transaccion exitosa: Pasaste $84.500 a Juan Santamaria usando Llaves"
      return ev({ banco: 'daviplata', tipo: 'salida', persona: limpio(m[2]), monto: num(m[1]) });
    if ((m = /DaviPlata:\s*acabas de Sacar\s+([\d.,]+)/i.exec(t)))
      return ev({ banco: 'daviplata', tipo: 'retiro', monto: num(m[1]) });

    // Nubank (tarjeta de crédito)
    if ((m = /Compra aprobada por \$?([\d.,]+).*?Tu compra en (.+?) por \$?([\d.,]+) con tu tarjeta terminada en/i.exec(t)))
      return ev({ banco: 'nubank', tc: true, tipo: 'gasto', comercio: limpio(m[2]), monto: num(m[3]) });

    // Falabella: compra con la tarjeta (débito) — "BANCO FALABELLA, informa compra aprobada $56.592 09/10/2026 17:30 con tu tarjeta *3095 … En COMERCIO.-"
    if ((m = /informa compra aprobada \$?([\d.,]+)\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}).*?\bEn\s+(.+?)\s*(?:\.-|\.)?\s*$/i.exec(t)))
      return ev({ banco: 'falabella', tipo: 'gasto', comercio: limpio(m[7]), monto: num(m[1]), ts: new Date(+m[4], +m[3] - 1, +m[2], +m[5], +m[6]).getTime() });

    // Falabella
    if ((m = /Transferiste con .*?Enviaste \$?([\d.,]+) a (?:Llave \w+ de )?(.+?)\.\s*(\d{4}-\d{2}-\d{2}.*)$/i.exec(t)))
      return ev({ banco: 'falabella', tipo: 'salida', persona: limpio(m[2]), monto: num(m[1]), ts: fechaTexto(m[3], ts) });
    if ((m = /Transferencia recibida\W*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑ ]*?) te ha enviado \$?([\d.,]+) a tu cuenta\.\s*(\d{4}-\d{2}-\d{2}.*)$/i.exec(t)))
      return ev({ banco: 'falabella', tipo: 'entrada', persona: limpio(m[1]), monto: num(m[2]), ts: fechaTexto(m[3], ts) });

    // Billetera de Google: título = comercio, texto = "COP12,480 con Tarjeta Nequi Visa ••4335"
    if (/wallet|billetera/i.test(n.app || '') && (m = /COP\s*([\d.,]+)\s+con\s+(Tarjeta\s+)?(.+?)\s*[•·*]*\s*\d{4}/i.exec(String(n.texto || '')))) {
      const tarjeta = m[3];
      const banco = /nequi/i.test(tarjeta) ? 'nequi' : /nu\b|nubank/i.test(tarjeta) ? 'nubank' : /davi.*oro|oro/i.test(tarjeta) ? 'davibank' : /davi/i.test(tarjeta) ? 'daviplata' : '';
      return ev({ banco: banco, tc: banco === 'nubank' || banco === 'davibank', tipo: 'gasto', comercio: limpio(String(n.titulo || '').replace(/[{}\[\]]/g, ' ')), monto: num(m[1]) });
    }

    // Nequi (app y SMS)
    if ((m = /(?:NEQUI:\s*)?Pagaste ([\d.,]+) en (.+?)$/i.exec(t.replace(/^Compra exitosa con Tarjeta[^P]*/i, ''))))
      return ev({ banco: 'nequi', tipo: 'gasto', comercio: limpio(m[2]), monto: num(m[1]) });
    if ((m = /Hiciste un pago en (.+?) por \$?([\d.,]+)/i.exec(t)))
      return ev({ banco: 'nequi', tipo: 'gasto', comercio: limpio(m[1]).replace(/- /g, ''), monto: num(m[2]), pse: true });
    if (/Pago exitoso por PSE/i.test(t)) return null;
    if ((m = /de plata por \$?([\d.,]+) fue exitoso/i.exec(t)))
      return ev({ banco: 'nequi', tipo: 'salida', persona: '', monto: num(m[1]) });
    if ((m = /Te enviaron\s+\$?([\d.,]+)/i.exec(t)))                       // Nequi por Bre-B: no dice quién
      return ev({ banco: /daviplata/i.test(n.app || '') ? 'daviplata' : /falabella/i.test(n.app || '') ? 'falabella' : 'nequi', tipo: 'entrada', persona: '', monto: num(m[1]) });
    if ((m = /^(.+?) te envi\S{0,2}\s+\$?([\d.,]+)/i.exec(t.replace(/^Env\S{0,2}o\s+/i, ''))))
      return ev({ banco: 'nequi', tipo: 'entrada', persona: limpio(m[1]), monto: num(m[2]) });

    // Correo de PlacetoPay: confirma un pago PSE que ya llegó por Nequi
    if ((m = /Transacci\S{0,2}n aprobada en (\w+).*?COP \$?([\d.,]+)/i.exec(t)))
      return ev({ banco: 'nequi', tipo: 'gasto', comercio: limpio(m[1]), monto: num(m[2]), pse: true, correo: true });
    return null;
  }

  /* Dos avisos son el mismo hecho si coinciden monto, banco y comercio dentro de una ventana corta.
     a y b: { tipo, monto, banco, t (ms), quien, pse } */
  function mismoHecho(a, b) {
    if (Math.abs(a.monto - b.monto) > 0.5) return false;
    if (a.tipo === 'transferencia' || b.tipo === 'transferencia') {
      const tr = a.tipo === 'transferencia' ? a : b, o = tr === a ? b : a;
      if (Math.abs(a.t - b.t) > 20 * MS_MIN) return false;
      if (o.tipo === 'transferencia') return (!tr.cuenta || !o.cuenta || tr.cuenta === o.cuenta) && (!tr.destino || !o.destino || tr.destino === o.destino);
      if (o.tipo === 'salida') return !(o.banco && tr.banco && o.banco !== tr.banco);         // sale del mismo banco de origen
      if (o.tipo === 'entrada') {
        if (o.mio === false) return false;                                                    // te la mandó otra persona: es otro hecho
        return !(o.cuenta && tr.destino && o.cuenta !== tr.destino);                           // entra a la cuenta de destino
      }
      return false;
    }
    if (a.tipo !== b.tipo) return false;
    if (a.banco && b.banco && a.banco !== b.banco) return false;
    if (Math.abs(a.t - b.t) > 12 * MS_MIN) return false;
    const x = norm(a.quien), y = norm(b.quien);
    if (x && y && x.indexOf(y) < 0 && y.indexOf(x) < 0 && !(a.pse && b.pse)) return false;
    return true;
  }

  /* ¿Ya lo registraste a mano? mismo monto, cuenta compatible y fecha ±1 día. libre(m) filtra movimientos ya enlazados. */
  // Solo cuenta como "ya registrado" un movimiento del mismo sentido: una entrada nunca es duplicado de un gasto.
  const SALE = ['Gasto', 'Transferencia', 'Le pagué'], ENTRA = ['Ingreso', 'Me pagaron', 'Me prestaron', 'Transferencia'];
  function compatible(ev, m) {
    // Sin cuenta asignada (p. ej. dos cuentas con el nombre del banco), la del movimiento debe ser al menos de ese banco.
    const cuentaOk = function (c) { return !!ev.cuenta && c === ev.cuenta; };   // sin cuenta clara no se decide solo: queda por confirmar
    if (ev.tipo === 'transferencia') return m.tipo === 'Transferencia' && (!ev.cuenta || m.cuenta === ev.cuenta) && (!ev.destino || m.destino === ev.destino);
    if (ev.tipo === 'entrada') {
      if (ENTRA.indexOf(m.tipo) < 0) return false;
      if (m.tipo === 'Transferencia' && ev.quien && ev.mio === false) return false;   // si te la mandó otra persona, no es un movimiento entre tus cuentas
      return cuentaOk(m.tipo === 'Transferencia' ? m.destino : m.cuenta);
    }
    if (SALE.indexOf(m.tipo) < 0) return false;            // gasto, salida o retiro
    return cuentaOk(m.cuenta);
  }
  /* ¿El movimiento m puede ser el mismo hecho que avisó el banco a la hora ev.t?
     - Debe ser del mismo día del aviso, o del día vecino si lo registraste cerca de la medianoche: hasta 3 h antes del aviso
       o hasta 16 h después (compra de noche que anotas a la mañana siguiente con la fecha de hoy).
     - Si lo registraste a mano MÁS de 2 horas ANTES de que llegara el aviso, es otro movimiento (el banco avisa al instante).
     - Si lo registraste después del aviso (mismo día), sí puede ser: lo anotaste más tarde.
     - Los movimientos sin hora de registro (extractos "hist:") solo se comparan por día (±1). */
  function mismaHora(ev, m) {
    const dia = 86400000, H = 3600000;
    const dias = Math.round((soloFecha(new Date(ev.t)).getTime() - m.fecha.getTime()) / dia);
    if (!(m.registrado instanceof Date)) return Math.abs(dias) <= 1;
    const antes = ev.t - m.registrado.getTime();            // > 0: lo registraste antes del aviso
    if (antes > 2 * H) return false;
    if (dias === 0) return true;
    return Math.abs(dias) === 1 && antes >= -16 * H && antes <= 3 * H;
  }
  function yaRegistrado(ev, movimientos, libre) {
    return movimientos.find(function (m) {
      if (Math.abs(m.monto - ev.monto) > 0.5) return false;
      if (!mismaHora(ev, m)) return false;
      if (!compatible(ev, m)) return false;
      return !libre || libre(m);
    }) || null;
  }

  /* ¿Este aviso que el lector no entendió parece un movimiento de plata? (para no perderlo en silencio).
     Necesita un monto y una palabra de movimiento; descarta códigos, promociones y lo que se ignora a propósito.
     Devuelve { monto } (0 si no se pudo leer) o null. */
  function pareceMovimiento(t) {
    t = limpio(String(t || '').replace(/[{}\[\]]/g, ' '));
    if (/credifin|addi\b/i.test(t) && !/davibank|nequi|nubank|daviplata|falabella|compra aprobada|pagaste|pago a/i.test(t)) return null;   // sus propios avisos nunca se leen
    if (/Pago exitoso por PSE/i.test(t)) return null;                                             // repite un pago ya avisado
    if (/c\S?digo|clave|contrase|\botp\b|token|verificaci|inscribiste|promo|descuento|sorteo|oferta|aprovecha|preaprobad|gana\b|ganaste|invita|\bbono\b|cashback|beneficio|premio|regal|saldo disponible|tu saldo es|\brecibe\b|\btransfiere\b|\bpaga\b|cupo disponible|participa|aplican|\bt\s?y\s?c\b|t\S?rminos y condiciones|\bdesde \$|boleta|concierto|\bpromo|campa\S?a/i.test(t)) return null;
    const m = /(?:\$|COP)\s?([\d.,]*\d)|\b(\d{1,3}(?:[.,]\d{3})+(?:,\d{1,2})?)\b/i.exec(t);
    // Sin monto, solo si es claramente un movimiento hecho ("Tu plata llegó con éxito", "Envío exitoso"): el monto lo pones tú.
    if (!m) return /env\S{0,2}o exitoso|plata lleg\S{0,2} con \S{0,2}xito|transferencia exitosa|pago exitoso|compra exitosa|compra aprobada/i.test(t) ? { monto: 0 } : null;
    if (!/compra|pag|env\S{0,2}o|envi|recib|transf|retir|saca|d\S?bito|debit|abon|consign|cargo|cobr|deposit|desembols|avance|transacci|movimiento/i.test(t)) return null;
    const monto = num(m[1] || m[2]);
    return { monto: monto > 0 ? monto : 0 };
  }

  return { num: num, parse: parse, pareceMovimiento: pareceMovimiento, mismoHecho: mismoHecho, yaRegistrado: yaRegistrado, esMio: esMio, norm: norm, MS_MIN: MS_MIN };
})();

function avModo_() {
  const m = String(PropertiesService.getScriptProperties().getProperty('AVISOS_MODO') || '').trim();
  return AV_MODOS.indexOf(m) >= 0 ? m : 'avisar';
}

function hojaAvisos_() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let h = libro.getSheetByName(HOJA_AV);
  if (!h) {
    h = libro.insertSheet(HOJA_AV);
    h.getRange(1, 1, 1, ENC_AV.length).setValues([ENC_AV]);
    h.setFrozenRows(1);
  } else if (h.getLastColumn() < ENC_AV.length) {
    h.getRange(1, 1, 1, ENC_AV.length).setValues([ENC_AV]);   // hojas creadas antes de la columna "Origen"
  }
  return h;
}

/** De dónde llegó un aviso: la macro del celular (MacroDroid), el lector de la app, o ambos. */
function avOrigen_(p) { return limpiar(p.origen).toLowerCase() === 'app' ? 'app' : 'macro'; }
function avMezclarOrigen_(a, b) { return !a ? b : !b || a === b ? a : 'ambos'; }

/** Últimos avisos (por defecto 300) como objetos; `fila` es el número de fila en la hoja. */
function leerAvisos_(max) {
  const h = hojaAvisos_();
  const ult = h.getLastRow();
  if (ult < 2) return [];
  const desde = Math.max(2, ult - (max || 300) + 1);
  return h.getRange(desde, 1, ult - desde + 1, ENC_AV.length).getValues().map(function (v, i) {
    const t = v[1] instanceof Date ? v[1].getTime() : 0;
    return {
      fila: desde + i, id: String(v[0]), t: t, fuentes: String(v[2]).split('+').filter(Boolean), n: Number(v[3]) || 1,
      banco: String(v[4]), cuenta: String(v[5]), tipo: String(v[6]), monto: Number(v[7]) || 0, quien: String(v[8]), destino: String(v[9]),
      recurrente: v[10] === 'sí', tc: v[11] === 'sí', estado: String(v[12]), idMov: String(v[13] || ''), nota: String(v[14] || ''),
      recibido: v[15] instanceof Date ? v[15] : null, res: String(v[16] || ''), texto: String(v[17] || ''), pse: v[18] === 'sí',
      origen: String(v[19] || '') || 'macro'
    };
  }).filter(function (r) { return r.id && r.t; });
}

function avFilaDe_(r) {
  return [r.id, new Date(r.t), r.fuentes.join('+'), r.n, r.banco, r.cuenta, r.tipo, r.monto, r.quien, r.destino,
    r.recurrente ? 'sí' : '', r.tc ? 'sí' : '', r.estado, r.idMov, r.nota, r.recibido || new Date(), r.res, String(r.texto).slice(0, 600), r.pse ? 'sí' : '', r.origen || 'macro'];
}

function avGuardar_(r) {
  const h = hojaAvisos_();
  if (r.fila) h.getRange(r.fila, 1, 1, ENC_AV.length).setValues([avFilaDe_(r)]);
  else { r.fila = h.getLastRow() + 1; h.getRange(r.fila, 1, 1, ENC_AV.length).setValues([avFilaDe_(r)]); }
}

/** Las escrituras de avisos esperan a que los movimientos ya estén guardados (así nunca queda "Registrado" sin movimiento). */
let AV_POST_ = null;
function avDiferir_(fn) { (AV_POST_ = AV_POST_ || []).push(fn); }
function avEjecutarDiferidos_() { const f = AV_POST_ || []; AV_POST_ = null; f.forEach(function (fn) { fn(); }); }

/** Cuenta de la hoja que corresponde al banco del aviso (vacía si no hay una sola candidata). */
function avCuenta_(cfg, banco, tc) {
  if (!banco) return '';
  const c = cfg.cuentas.filter(function (x) {
    return x.activa !== false && AV.norm(x.nombre).indexOf(AV.norm(banco)) >= 0 && ((x.tipo === 'Deuda') === !!tc);
  });
  if (c.length === 1) return c[0].nombre;
  const exacta = c.filter(function (x) { return AV.norm(x.nombre) === AV.norm(banco) || AV.norm(x.nombre) === AV.norm('TC ' + banco); });
  return exacta.length === 1 ? exacta[0].nombre : '';   // "Daviplata" gana sobre "Bolsillo Daviplata …"
}

function avTs_(v) {
  const s = limpiar(v);
  if (!s) return Date.now();
  if (/^\d{10,13}$/.test(s)) return s.length <= 10 ? Number(s) * 1000 : Number(s);
  const t = new Date(s).getTime();
  return isNaN(t) ? Date.now() : Math.min(t, Date.now() + 3600000);
}

function avFechaISO_(t) {
  const hoyF = hoy();
  const f = soloFecha(new Date(t));
  return Utilities.formatDate(f > hoyF ? hoyF : f, zona(), 'yyyy-MM-dd');
}

function avEnlazados_(recientes) {
  const c = {};
  recientes.forEach(function (r) { if (r.idMov) c[r.idMov] = (c[r.idMov] || 0) + 1; });
  return c;
}

/** Acción "aviso": lo manda la macro del celular con app, titulo, texto y ts (milisegundos). */
function registrarAviso(p, cfg) {
  const texto = String(p.texto || '').trim(), titulo = String(p.titulo || '').trim();
  if (!texto && !titulo) throw new Error('El aviso viene vacío.');
  const t = avTs_(p.ts);
  // La macro puede mandar varias versiones del texto separadas por "||" (texto normal, texto grande, ticker): se usa la primera que se entienda.
  const variantes = texto.split(/\s*\|\|\s*/).map(function (x) { return x.trim(); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; })
    .sort(function (x, y) { return y.length - x.length; });
  let ev = null;
  (variantes.length ? variantes : ['']).some(function (v) {
    ev = AV.parse({ app: limpiar(p.app).toLowerCase() || 'sms', titulo: titulo, texto: v, ts: t });
    return !!ev;
  });
  const origen = avOrigen_(p);
  if (!ev || !(ev.monto > 0)) return avNoReconocido_(p, titulo, variantes, t, origen, cfg);
  const yo = cfg.ajustes.nombre || '';
  const nuevo = {
    t: ev.ts, tipo: ev.tipo === 'retiro' ? 'retiro' : ev.tipo, monto: ev.monto, banco: ev.banco || '', quien: ev.comercio || ev.persona || '',
    cuenta: avCuenta_(cfg, ev.banco, ev.tc), destino: '', pse: !!ev.pse, tc: !!ev.tc, recurrente: !!ev.recurrente, origen: origen
  };
  if (nuevo.tipo === 'entrada' && nuevo.quien) nuevo.mio = AV.esMio(nuevo.quien, yo);   // false = te la mandó otra persona
  const recientes = leerAvisos_(300);

  // 1) Mismo hecho avisado por otro canal (app + SMS + Billetera + correo): solo suma un aviso.
  const dup = recientes.find(function (r) { return AV.mismoHecho(r, nuevo); });
  if (dup) {
    dup.n++;
    if (dup.fuentes.indexOf(ev.fuente) < 0) dup.fuentes.push(ev.fuente);
    dup.origen = avMezclarOrigen_(dup.origen, origen);
    if (nuevo.quien && (!dup.quien || (nuevo.quien.length > dup.quien.length && !ev.correo))) dup.quien = nuevo.quien;
    if (!dup.cuenta && nuevo.cuenta) dup.cuenta = nuevo.cuenta;
    if (!dup.banco && nuevo.banco) dup.banco = nuevo.banco;
    dup.texto = (dup.texto + ' | ' + ev.crudo).slice(0, 600);
    avDiferir_(function () { avGuardar_(dup); });
    return '👌 Aviso repetido (' + dup.n + ' avisos del mismo movimiento). No lo dupliqué.';
  }

  // 2) Salida de una cuenta tuya + entrada propia en otra, por el mismo monto y casi a la misma hora: es una transferencia.
  const sentido = nuevo.tipo === 'salida' ? 'entrada' : (nuevo.tipo === 'entrada' && AV.esMio(nuevo.quien, yo)) ? 'salida' : '';
  const par = sentido && recientes.find(function (r) {
    return r.estado === 'Pendiente' && r.tipo === sentido && Math.abs(r.monto - nuevo.monto) < 0.5 && Math.abs(r.t - nuevo.t) <= 20 * AV.MS_MIN &&
      r.banco !== nuevo.banco && (sentido === 'salida' || AV.esMio(r.quien, yo));
  });
  if (par) {
    const salida = sentido === 'salida' ? par : nuevo, entrada = sentido === 'salida' ? nuevo : par;
    const desde = { t: salida.t, banco: salida.banco, cuenta: salida.cuenta }, hacia = entrada.cuenta;   // se copian antes de tocar `par` (puede ser la entrada)
    par.tipo = 'transferencia';
    par.t = desde.t;
    par.banco = desde.banco; par.cuenta = desde.cuenta; par.destino = hacia; par.quien = 'Tú';
    par.n++;
    if (par.fuentes.indexOf(ev.fuente) < 0) par.fuentes.push(ev.fuente);
    par.origen = avMezclarOrigen_(par.origen, origen);
    par.texto = (par.texto + ' | ' + ev.crudo).slice(0, 600);
    return avAsentar_(par, cfg, recientes, 'Transferencia entre tus cuentas detectada');
  }

  nuevo.id = 'av' + Utilities.getUuid().slice(0, 8);
  nuevo.fuentes = [ev.fuente]; nuevo.n = 1; nuevo.estado = 'Pendiente'; nuevo.idMov = ''; nuevo.nota = ''; nuevo.res = ''; nuevo.texto = ev.crudo; nuevo.fila = 0;
  return avAsentar_(nuevo, cfg, recientes, 'Aviso nuevo');
}

/** Un aviso de banco que el lector no entendió pero parece un movimiento: queda en "Por confirmar" como "No reconocido",
 *  con su texto original, para registrarlo a mano y ajustar el lector. El ruido (códigos, promociones) se sigue ignorando. */
function avNoReconocido_(p, titulo, variantes, t, origen, cfg) {
  const texto = String((titulo ? titulo + ' · ' : '') + (variantes[0] || '')).replace(/[{}\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  const pm = AV.pareceMovimiento(texto);
  if (!pm) return 'ℹ️ Ese aviso no es un movimiento. Lo ignoré.';
  const fuente = limpiar(p.app).toLowerCase() || 'sms';
  // La macro pierde tildes y emojis ("Dbito" vs "Débito ✨"): la llave quita todo lo que no sea ASCII antes de comparar.
  const llaveDe = function (x) { return AV.norm(String(x || '').replace(/[^\x00-\x7F]/g, '')); };
  const llave = llaveDe(texto);
  const recientes = leerAvisos_(300);
  const dup = recientes.find(function (r) { return r.tipo === 'noreconocido' && Math.abs(r.t - t) <= 30 * AV.MS_MIN && llaveDe(r.texto.split(' | ')[0]) === llave; });
  if (dup) {
    dup.n++;
    if (dup.fuentes.indexOf(fuente) < 0) dup.fuentes.push(fuente);
    dup.origen = avMezclarOrigen_(dup.origen, origen);
    avDiferir_(function () { avGuardar_(dup); });
    return '👌 Aviso no reconocido repetido. No lo dupliqué.';
  }
  const banco = ['nequi', 'daviplata', 'davibank', 'nubank', 'falabella'].filter(function (b) { return AV.norm(fuente + ' ' + texto).indexOf(AV.norm(b)) >= 0; })[0] || '';
  // Si se sabe el banco, la cuenta queda puesta (al registrarlo ya sale "pagué con Nequi"); las tarjetas: Nubank y Davibank.
  const cuenta = banco && cfg ? avCuenta_(cfg, banco, banco === 'nubank' || (banco === 'davibank' && !/daviplata/i.test(texto))) : '';
  const r = { id: 'av' + Utilities.getUuid().slice(0, 8), t: t, tipo: 'noreconocido', monto: pm.monto, banco: banco, quien: '', cuenta: cuenta, destino: '',
    pse: false, tc: false, recurrente: false, fuentes: [fuente], n: 1, estado: 'Pendiente', idMov: '', nota: '', res: '', texto: texto, fila: 0, origen: origen };
  avDiferir_(function () { avGuardar_(r); });
  return '❓ No entendí ese aviso, pero parece un movimiento: quedó en "Por confirmar" como "No reconocido".';
}

/** Decide qué pasa con un aviso recién creado o recién emparejado: ya estaba, se registra solo o queda pendiente. */
function avAsentar_(r, cfg, recientes, titulo) {
  const enl = avEnlazados_(recientes);
  r.mio = r.tipo === 'entrada' ? AV.esMio(r.quien, cfg.ajustes.nombre) : undefined;
  const ya = AV.yaRegistrado(r, leerMovimientos(), function (m) { return (enl[m.id] || 0) < (m.tipo === TIPO.TRANSF ? 2 : 1); });
  if (ya) {
    r.estado = 'Ya estaba'; r.idMov = ya.id; r.nota = 'Coincide con "' + ya.desc + '" que ya registraste';
    avDiferir_(function () { avGuardar_(r); });
    return '👌 Ya lo tenías registrado ("' + ya.desc + '").';
  }
  const monto = r.monto;
  if (avModo_() === 'auto' && r.tipo === 'gasto' && r.cuenta) {
    const antes = PEND_ ? PEND_.length : 0;
    registrarGasto({ descripcion: r.quien || ('Compra ' + r.cuenta), monto: monto, cuenta: r.cuenta, cuotas: r.tc ? '1' : '', fecha: avFechaISO_(r.t) }, cfg);
    r.estado = 'Registrado'; r.idMov = PEND_ && PEND_[antes] ? String(PEND_[antes][12]) : ULT_ID_;
    r.nota = 'Automático' + (r.tc ? ' · 1 cuota (aclárala editando el movimiento)' : '');
    avDiferir_(function () { avGuardar_(r); });
    return '✅ Registrado solo: ' + pesos(monto) + ' en ' + (r.quien || r.cuenta) + ' (' + r.cuenta + ')';
  }
  if (avModo_() === 'auto' && r.tipo === 'transferencia' && r.cuenta && r.destino) {
    const antes = PEND_ ? PEND_.length : 0;
    registrarTransferencia({ desde: r.cuenta, hacia: r.destino, monto: monto, fecha: avFechaISO_(r.t) }, cfg);
    r.estado = 'Registrado'; r.idMov = PEND_ && PEND_[antes] ? String(PEND_[antes][12]) : ULT_ID_; r.nota = 'Automático';
    avDiferir_(function () { avGuardar_(r); });
    return '✅ Transferencia registrada sola: ' + pesos(monto) + ' · ' + r.cuenta + ' → ' + r.destino;
  }
  r.estado = 'Pendiente';
  avDiferir_(function () { avGuardar_(r); });
  return '🔔 ' + titulo + ' por confirmar: ' + pesos(monto) + (r.quien ? ' · ' + r.quien : '');
}

/** Acción "avisoresolver": como = gasto|ingreso|mepagaron|meprestaron|lepague|transferencia|pagocredito (con `datos` JSON igual al de esa acción) | ignorar | reabrir. */
function resolverAviso(p, cfg) {
  const id = limpiar(p.id);
  const r = leerAvisos_(400).find(function (x) { return x.id === id; });
  if (!r) throw new Error('No encontré ese aviso (¿ya es muy antiguo?).');
  const como = limpiar(p.como);
  if (como === 'reabrir') {
    if (r.estado !== 'Ignorado' && r.estado !== 'Ya estaba') throw new Error('Solo se pueden reabrir los avisos ignorados o los que coincidieron con otro movimiento.');
    r.estado = 'Pendiente'; r.nota = ''; r.idMov = '';
    avDiferir_(function () { avGuardar_(r); });
    return '↩️ El aviso volvió a "Por confirmar".';
  }
  if (r.estado !== 'Pendiente') throw new Error('Ese aviso ya se resolvió (' + r.estado + ').');
  if (como === 'ignorar') {
    r.estado = 'Ignorado'; r.nota = limpiar(p.nota) || 'Lo ignoraste';
    avDiferir_(function () { avGuardar_(r); });
    return '🙈 Aviso ignorado.';
  }
  const manejadores = { gasto: registrarGasto, ingreso: registrarIngreso, mepagaron: registrarMePagaron, meprestaron: registrarMePrestaron,
    lepague: registrarLePague, transferencia: registrarTransferencia, pagocredito: registrarPagoCredito };
  const f = manejadores[como];
  if (!f) throw new Error('No sé cómo registrar "' + como + '".');
  let datos = {};
  try { datos = typeof p.datos === 'string' ? JSON.parse(p.datos || '{}') : (p.datos || {}); } catch (e) { throw new Error('Los datos del aviso no tienen un formato válido.'); }
  const q = {};
  Object.keys(datos).forEach(function (k) { q[k] = datos[k]; });
  if (r.tipo === 'noreconocido') {          // el lector no entendió el monto: vale el que escribiste
    q.monto = Number(q.monto) || 0;
    if (!(q.monto > 0)) throw new Error('Escribe el monto del movimiento.');
  } else q.monto = r.monto;                  // el monto es el que dijo el banco
  if (!limpiar(q.fecha)) q.fecha = avFechaISO_(r.t);
  const antes = PEND_ ? PEND_.length : 0;
  const msg = f(q, cfg);
  r.estado = 'Registrado'; r.idMov = PEND_ && PEND_[antes] ? String(PEND_[antes][12]) : ULT_ID_;
  r.nota = como; r.res = JSON.stringify({ como: como, datos: datos }).slice(0, 900);
  avDiferir_(function () { avGuardar_(r); });
  return msg;
}

function cambiarModoAvisos(p) {
  const m = limpiar(p.modo);
  if (AV_MODOS.indexOf(m) < 0) throw new Error('Modo no válido (avisar o auto).');
  PropertiesService.getScriptProperties().setProperty('AVISOS_MODO', m);
  return m === 'auto' ? '⚡ Modo automático: los gastos simples y las transferencias entre tus cuentas se registran solos.' : '🔔 Modo "solo avisar": nada se registra hasta que lo confirmes.';
}

/** Lo que muestra la app en "Por confirmar": pendientes + lo reciente ya resuelto. */
function resumenAvisos(cfg, movs) {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_AV);
  const base = { modo: avModo_(), pendientes: 0, items: [] };
  if (!h || h.getLastRow() < 2) return base;
  const corte = Date.now() - 14 * 86400000;
  const todos = leerAvisos_(300).filter(function (r) { return r.estado === 'Pendiente' || r.t >= corte; });
  let sug = 0;
  base.pendientes = todos.filter(function (r) { return r.estado === 'Pendiente'; }).length;
  // Comparación MacroDroid vs. lector de la app (últimos 7 días, desde el primer aviso que llegó por la app).
  const semana = Date.now() - 7 * 86400000;
  // Solo la publicidad/ruido que ignoraste (No reconocido + Ignorado) sale de la comparación; un movimiento real ignorado
  // (p. ej. una compra y su reverso) sigue contando, porque la comparación mide si el lector se pierde avisos.
  const ruido = function (r) { return r.estado === 'Ignorado' && r.tipo === 'noreconocido'; };
  const conApp = todos.filter(function (r) { return r.origen !== 'macro' && !ruido(r); }).map(function (r) { return r.t; });
  if (conApp.length) {
    const desde = Math.max(semana, Math.min.apply(null, conApp));
    const c = { ambos: 0, macro: 0, app: 0 };
    todos.forEach(function (r) { if (r.t >= desde && !ruido(r) && c[r.origen] != null) c[r.origen]++; });
    base.comparacion = c;
  }
  base.items = todos.sort(function (a, b) { return b.t - a.t; }).slice(0, 80).map(function (r) {
    let cat = '';
    if (r.estado === 'Pendiente' && r.tipo === 'gasto' && r.quien && sug < 30) { sug++; cat = sugerirCategoria(r.quien, cfg, movs) || ''; }
    return { id: r.id, t: Utilities.formatDate(new Date(r.t), zona(), "yyyy-MM-dd'T'HH:mm"), fuentes: r.fuentes, n: r.n, banco: r.banco, cuenta: r.cuenta,
      tipo: r.tipo, monto: r.monto, quien: r.quien, destino: r.destino, recurrente: r.recurrente, tc: r.tc, estado: r.estado, idMov: r.idMov,
      nota: r.nota, origen: r.origen, sugCategoria: cat, texto: r.texto.slice(0, r.tipo === 'noreconocido' ? 500 : 220), mio: r.tipo === 'entrada' && AV.esMio(r.quien, cfg.ajustes.nombre) };
  });
  return base;
}

/* =================================================================
 * UTILIDADES
 * ================================================================= */

let ZONA_ = null;
function zona() {
  if (!ZONA_) ZONA_ = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  return ZONA_;
}
function soloFecha(d) {
  const s = Utilities.formatDate(d, zona(), 'yyyy-MM-dd').split('-');
  return new Date(Number(s[0]), Number(s[1]) - 1, Number(s[2]));
}
function hoy() { return soloFecha(new Date()); }
function leerFecha(valor) {
  const m = String(valor || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return hoy();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
/** Fecha de un movimiento: vacía = hoy; acepta aaaa-mm-dd o dd/mm/aaaa; rechaza fechas imposibles o futuras. */
function leerFechaMov(valor) {
  const t = limpiar(valor);
  if (!t) return hoy();
  let y, mo, d, m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) { y = +m[3]; mo = +m[2]; d = +m[1]; }
  else throw new Error('La fecha "' + t + '" no es válida.');
  const f = new Date(y, mo - 1, d);
  if (f.getFullYear() !== y || f.getMonth() !== mo - 1 || f.getDate() !== d) throw new Error('La fecha "' + t + '" no existe.');
  if (f > addDias(hoy(), 1)) throw new Error('No se registran movimientos con fecha futura (' + fmt(f) + ').');
  return f;
}
/** Usa el nombre ya conocido de una persona aunque se escriba con otras mayúsculas o tildes ("sara" → "Sara"). */
function personaCanonica(cfg, nombre) {
  const n = normalizarTexto(nombre);
  if (!n) return nombre;
  const conocidas = (cfg.deudoresIniciales || []).map(function (x) { return x.persona; });
  (cfg.fijos || []).forEach(function (f) { (f.compartido || []).forEach(function (x) { conocidas.push(x); }); });
  leerMovimientos().forEach(function (m) {
    if (m.tipo === TIPO.MEPAGARON || m.tipo === TIPO.MEPRESTARON || m.tipo === TIPO.LEPAGUE) conocidas.push(m.para);
    else if (m.tipo === TIPO.GASTO && m.para) reparto(m).otros.forEach(function (o) { conocidas.push(o.p); });
  });
  return conocidas.find(function (x) { return x && normalizarTexto(x) === n; }) || nombre;
}
function paraCanonico(cfg, para) {
  if (!para) return para;
  return para.split(';').map(function (parte) {
    const x = parte.split(':');
    return personaCanonica(cfg, limpiar(x[0])) + (x.length > 1 ? ':' + limpiar(x.slice(1).join(':')) : '');
  }).join('; ');
}
function addDias(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function addMeses(d, n) {
  const ultimo = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), ultimo));
}
function dos(n) { return (n < 10 ? '0' : '') + n; }
function fmt(d) { return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
function clavesMes(d) { return d.getFullYear() + '-' + dos(d.getMonth() + 1); }
function fmtLargo(d) {
  const m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return d.getDate() + ' ' + m[d.getMonth()];
}
function limpiar(v) { return String(v == null ? '' : v).trim(); }
function aNumero(v) {
  if (typeof v === 'number') return v;
  const s = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (!s) return NaN;
  const limpio = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/[.,](?=\d{3}(\D|$))/g, '');
  return Number(limpio);
}
function pesos(n) {
  const v = Math.round(Math.abs(Number(n) || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-$' : '$') + v;
}
function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
