/* MIS FINANZAS · botón flotante para registrar desde la app.
   Hace lo mismo que el atajo del celular (gasto, ingreso, pagos, fijos, mover plata, ajustes y monedas)
   y guarda en tu hoja a través del mismo Apps Script. */
(function () {
  'use strict';
  var MF = window.MF;
  if (!MF) return;
  var esc = MF.esc, el = MF.el, pesos = MF.pesos;

  /* ---------- configuración (cuentas, categorías, personas…) ---------- */
  var cfg = null, pidiendo = null;
  try { cfg = JSON.parse(MF.leerLocal('cfgRegistro') || 'null'); } catch (e) { cfg = null; }
  if (MF.DEMO) cfg = window.DEMO_CFG || cfg;
  if (cfg && cfg.v !== 8) cfg = null;
  function guardarCfg(c) { if (c && c.plata) { cfg = c; if (!MF.DEMO) MF.guardarLocal('cfgRegistro', JSON.stringify(c)); } }

  function enviar(datos) {
    if (MF.DEMO) return new Promise(function (ok) { setTimeout(function () { ok({ ok: true, mensaje: '👀 Vista previa: no se guardó nada.', config: cfg }); }, 400); });
    var body = new URLSearchParams();
    datos.clave = MF.clave();
    Object.keys(datos).forEach(function (k) { body.append(k, datos[k] == null ? '' : String(datos[k])); });
    return fetch(MF.API, { method: 'POST', body: body })
      .then(function (r) { return r.json(); })
      .then(function (r) { if (r.config) guardarCfg(r.config); return r; });
  }
  function pedirCfg() {
    if (MF.DEMO) return Promise.resolve(cfg);
    if (!pidiendo) {
      pidiendo = enviar({ accion: 'config' }).then(function (r) {
        pidiendo = null;
        if (!r.ok) throw new Error(r.mensaje || 'No pude leer tus cuentas.');
        return r.config;
      }, function (e) { pidiendo = null; throw e; });
    }
    return pidiendo;
  }

  /* ---------- utilidades ---------- */
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function hoyISO() { if (MF.hoy()) return MF.hoy(); var d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function aNum(v) { var s = String(v == null ? '' : v).replace(/\D/g, ''); return s ? Number(s) : NaN; }
  function miles(n) { return isNaN(n) ? '' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function deuda(n) { return cfg && cfg.deudas.find(function (d) { return d.n === n; }); }
  function plata(n) { return cfg && cfg.plata.find(function (c) { return c.n === n; }); }
  function persona(n) { return cfg && cfg.personas.find(function (p) { return p.n === n; }); }
  function deudasSinMama() { return cfg.deudas.filter(function (d) { return !d.mama; }); }
  function cuando(d) { return d < 0 ? 'venció hace ' + (-d) + ' d' : d === 0 ? 'vence hoy' : 'vence en ' + d + ' d'; }

  // Categoría sugerida: primero lo que has registrado antes, luego el diccionario de comercios (igual que el atajo).
  var VACIAS = { de: 1, del: 1, la: 1, el: 1, los: 1, las: 1, para: 1, con: 1, por: 1, en: 1, y: 1, compra: 1, compras: 1, pago: 1, cuota: 1, san: 1, sas: 1, tienda: 1, tiendas: 1 };
  function normalizar(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function sugerir(desc) {
    var full = normalizar(desc);
    if (!full || !cfg) return '';
    var apr = cfg.aprende || {};
    var existe = function (c) { return cfg.categorias.some(function (x) { return x.n === c; }); };
    if (apr['=' + full] && existe(apr['=' + full])) return apr['=' + full];
    var votos = {};
    full.split(' ').forEach(function (w) { if (w.length >= 2 && !VACIAS[w] && apr[w]) votos[apr[w]] = (votos[apr[w]] || 0) + 1; });
    var mejor = Object.keys(votos).sort(function (a, b) { return votos[b] - votos[a]; })[0];
    if (mejor && existe(mejor)) return mejor;
    var d = (cfg.dic || []).find(function (x) { try { return new RegExp(x[0]).test(full); } catch (e) { return false; } });
    return d && existe(d[1]) ? d[1] : '';
  }

  /* ---------- piezas del formulario ---------- */
  function campo(label, dentro, nota, k) {
    return '<div class="campo"' + (k ? ' data-campo="' + k + '"' : '') + '><label>' + label + '</label>' + dentro + (nota ? '<p class="nota">' + nota + '</p>' : '') + '</div>';
  }
  function fTexto(k, label, ph, nota) {
    return campo(label, '<input class="in" data-k="' + k + '" type="text" autocomplete="off" enterkeyhint="next" placeholder="' + esc(ph || '') + '" value="' + esc(st[k] || '') + '">', nota, k);
  }
  function fMonto(k, label, nota, grande) {
    return campo(label, '<div class="money' + (grande ? ' big' : '') + '"><span>$</span><input class="in" data-k="' + k + '" data-money="1" inputmode="numeric" autocomplete="off" placeholder="0" value="' +
      (st[k] == null || isNaN(st[k]) ? '' : miles(st[k])) + '"></div>', nota, k);
  }
  function fSelect(k, label, ops, ph, nota) {
    var h = '<select class="in" data-k="' + k + '">';
    if (ph) h += '<option value=""' + (st[k] ? '' : ' selected') + ' disabled>' + esc(ph) + '</option>';
    ops.forEach(function (o) {
      if (o.grupo) { h += '<optgroup label="' + esc(o.grupo) + '">'; return; }
      if (o.fin) { h += '</optgroup>'; return; }
      h += '<option value="' + esc(o[0]) + '"' + (String(st[k]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    });
    return campo(label, h + '</select>', nota, k);
  }
  function fChips(k, label, ops, nota) {
    return campo(label, '<div class="opciones">' + ops.map(function (o) {
      return '<button type="button" class="op" data-op="' + k + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (String(st[k]) === String(o[0])) + '">' + esc(o[1]) + '</button>';
    }).join('') + '</div>', nota, k);
  }
  function fFecha() {
    return campo('Fecha', '<input class="in" data-k="fecha" type="date" max="' + hoyISO() + '" value="' + esc(st.fecha || hoyISO()) + '">', '', 'fecha');
  }
  function opsPlata(conSaldo) { return cfg.plata.map(function (c) { return [c.n, c.e + ' ' + c.n + (conSaldo ? ' · tiene ' + pesos(c.s) : '')]; }); }
  function opsDeudas() { return deudasSinMama().map(function (c) { return [c.n, c.e + ' ' + c.n]; }); }

  /* ---------- tipos de registro ---------- */
  var TIPOS = {
    gasto: { t: '💸 Gasto', titulo: 'Gasto' },
    ingreso: { t: '💰 Ingreso', titulo: 'Ingreso' },
    pagar: { t: '💳 Pagar', titulo: 'Pagar un crédito o devolver plata' },
    fijo: { t: '📌 Gasto fijo', titulo: 'Pagar un gasto fijo' },
    mover: { t: '🔄 Mover plata', titulo: 'Mover plata entre tus cuentas' },
    ajuste: { t: '⚖️ Ajustar saldo', titulo: 'Cuadrar el saldo de una cuenta' },
    monedas: { t: '🪙 Monedas', titulo: 'Regalé monedas' }
  };
  var tipo = 'gasto', st = {};
  // Qué se borra cuando cambia un dato del que depende.
  var DEPENDE = {
    cuenta: ['cuotas', 'cuotasOtro', 'valorCuota', 'apartar', 'mama'],
    tipoIng: ['persona', 'personaNueva', 'aplica', 'compra', 'exceso', 'monto', '_montoAuto'],
    persona: ['aplica', 'compra', 'exceso'],
    aplica: ['compra'],
    credito: ['monto', 'origen', 'mama', '_montoAuto'],
    origen: ['mama'],
    fijo: ['monto', 'cuenta', 'mama', '_montoAuto'],
    desde: ['hacia'],
    para: ['paraNueva']
  };

  function reiniciar() {
    st = { fecha: hoyISO() };
    var ult = MF.leerLocal('regCuenta');
    if (tipo === 'gasto' && ult && (plata(ult) || deuda(ult))) st.cuenta = ult;
    if (tipo === 'monedas') st.monto = (cfg.efectivo || 0) % 1000 || NaN;
  }

  function pendientesFijos() { return (cfg && cfg.fijos) || []; }
  function tiposVisibles() {
    return Object.keys(TIPOS).filter(function (k) {
      if (k === 'fijo') return pendientesFijos().length > 0;
      if (k === 'monedas') return (cfg.efectivo || 0) % 1000 > 0;
      return true;
    });
  }

  /* ----- cada formulario devuelve su HTML; enviarlo arma los datos o un error ----- */
  var FORM = {
    gasto: function () {
      var d = deuda(st.cuenta);
      var sug = sugerir(st.desc);
      if (!st._catManual) st.cat = sug || '';
      var h = fTexto('desc', '¿En qué gastaste?', 'Ej: Tiendas Ara, gasolina, Netflix') + fMonto('monto', '¿Cuánto fue?', '', true);
      h += fSelect('cat', 'Categoría', cfg.categorias.map(function (c) { return [c.n, (c.e ? c.e + ' ' : '') + c.n]; }), 'Elige una (o la adivino)',
        '<span data-sug>' + (st.cat && !st._catManual ? '✨ Sugerida por la descripción. Puedes cambiarla.' : st._catManual ? '' : 'Si no eliges, la adivino por la descripción.') + '</span>');
      h += fSelect('cuenta', '¿Con qué pagaste?', [{ grupo: 'Tu plata' }].concat(opsPlata(true), [{ fin: 1 }, { grupo: 'Tarjetas y créditos' }], opsDeudas(), [{ fin: 1 }]), 'Elige la cuenta');
      if (d && d.cuotas) {
        var posibles = (d.max <= 6 ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 6, 12, 24, 36]).filter(function (n) { return n <= d.max; });
        if (st.cuotas == null) st.cuotas = 1;
        var ops = posibles.map(function (n) { return [String(n), n === 1 ? '1 cuota' : n + ' cuotas']; });
        if (d.max > 6) ops.push(['otro', 'Otro…']);
        h += fChips('cuotas', '¿A cuántas cuotas?', ops);
        if (st.cuotas === 'otro') h += fMonto('cuotasOtro', '¿Cuántas cuotas? (máximo ' + d.max + ')');
        if (d.valor) h += fMonto('valorCuota', 'Valor de cada cuota', 'El que te muestra ' + esc(d.n) + '. Si lo dejas vacío, lo estimo.');
      }
      if (d && d.bolsillo) {
        if (!st.apartar) st.apartar = 'no';
        h += fChips('apartar', '¿Apartas el valor en "' + esc(d.bolsillo) + '"?', [['si', '🎯 Sí, apartar' + (d.desde ? ' desde ' + d.desde : '')], ['no', 'Ahora no']]);
      }
      if (st.para == null) st.para = '';
      h += fChips('para', '¿Para quién es?', [['', '🙋 Para mí']].concat(cfg.personas.map(function (p) { return [p.n, '🤝 ' + p.n]; }), [['__nueva', '➕ Otra persona']]));
      if (st.para === '__nueva') h += fTexto('paraNueva', '¿Cómo se llama?', 'Nombre');
      return h + fFecha();
    },
    ingreso: function () {
      var esPago = st.tipoIng === '__mepagaron', esPrest = st.tipoIng === '__meprestaron';
      var h = fSelect('tipoIng', 'Tipo de ingreso', cfg.ingresos.map(function (c) { return [c.n, (c.e ? c.e + ' ' : '') + c.n]; })
        .concat([['__mepagaron', '🤝 Me pagaron (me devolvieron plata)'], ['__meprestaron', '🙋 Alguien me prestó plata']]), 'Elige el tipo');
      if (esPago) {
        var deudores = cfg.personas.filter(function (p) { return p.debe > 0; });
        if (!deudores.length) return h + '<p class="nota solo">Nadie te debe plata en este momento. 🙌</p>';
        h += fSelect('persona', '¿Quién te pagó?', deudores.map(function (p) { return [p.n, p.n + ' · te debe ' + pesos(p.debe)]; }), 'Elige la persona');
        var p = persona(st.persona);
        var cs = p ? (p.c || []).filter(function (c) { return c.p > 0; }) : [];
        if (p && cs.length) {
          var ops = cs.filter(function (c) { return c.m > 0; }).map(function (c) { return ['mes|' + c.k, '📅 Cuota del mes: ' + c.d + ' · ' + pesos(c.m)]; });
          ops.push(['__compra', '🧾 A una compra en específico'], ['__libre', '💵 Solo el monto (a lo más antiguo)']);
          h += fChips('aplica', '¿A qué corresponde el pago?', ops);
          if (st.aplica === '__compra') h += fSelect('compra', '¿Qué compra te pagó?', cs.map(function (c) { return [c.k, c.d + ' · debe ' + pesos(c.p) + (c.q ? ' · próxima ' + pesos(c.q) : '')]; }), 'Elige la compra');
        }
      }
      if (esPrest) {
        if (st.persona == null && !cfg.personas.length) st.persona = '__nueva';
        h += fSelect('persona', '¿Quién te prestó?', cfg.personas.map(function (x) { return [x.n, '🙋 ' + x.n + (x.ledebo > 0 ? ' · ya le debes ' + pesos(x.ledebo) : '')]; }).concat([['__nueva', '➕ Alguien nuevo…']]), 'Elige la persona');
        if (st.persona === '__nueva') h += fTexto('personaNueva', '¿Cómo se llama?', 'Nombre');
      }
      if (!esPago) h += fTexto('desc', 'Detalle (opcional)', esPrest ? 'Ej: para la moto' : 'Ej: honorarios septiembre');
      if (esPago && p && st._montoAuto !== false) { var s = montoSugeridoPago(p, cs); if (s) { st.monto = s; st._montoAuto = true; } }
      h += fMonto('monto', esPago && p ? '¿Cuánto te pagó ' + esc(p.n) + '?' : esPrest ? '¿Cuánto te prestaron?' : '¿Cuánto recibiste?', '', true);
      if (esPago && p && st.monto > p.debe) {
        var extra = st.monto - p.debe;
        if (!st.exceso) st.exceso = 'favor';
        h += fChips('exceso', esc(p.n) + ' te pagó ' + pesos(extra) + ' de más', [['favor', '💚 Saldo a favor de ' + p.n], ['ingreso', '💰 Ingreso para mí']]);
      }
      h += fSelect('cuenta', '¿A qué cuenta llegó?', opsPlata(true), 'Elige la cuenta');
      return h + fFecha();
    },
    pagar: function () {
      var ops = [];
      cfg.deudas.forEach(function (d) {
        if (d.mama) { if (d.s > 0) ops.push([d.n, '👩 Devolverle a mamá · le debes ' + pesos(d.s)]); return; }
        ops.push([d.n, d.e + ' ' + d.n + (d.pm ? ' · ' + pesos(d.pm) + ' el ' + d.pf : ' · debes ' + pesos(d.s))]);
      });
      cfg.personas.filter(function (x) { return x.ledebo > 0; }).forEach(function (x) { ops.push(['p|' + x.n, '🙋 Devolverle a ' + x.n + ' · le debes ' + pesos(x.ledebo)]); });
      var h = fSelect('credito', '¿Qué vas a pagar?', ops, 'Elige el crédito o la persona');
      var d = credito();
      if (!d) return h;
      if (st._montoAuto !== false && st.monto == null) { st.monto = d.pm > 0 ? d.pm : d.s || NaN; st._montoAuto = true; }
      var rap = [];
      if (d.pm > 0) rap.push(['<b>' + pesos(d.pm) + '</b> próximo pago (' + esc(d.pf) + ')', d.pm]);
      if (d.s > 0 && d.s !== d.pm) rap.push(['<b>' + pesos(d.s) + '</b> ' + (d.mama || d.persona ? 'todo lo que le debes' : 'todo lo que debes'), d.s]);
      h += fMonto('monto', '¿Cuánto vas a pagar?', '', true);
      if (rap.length) h += '<div class="rapidos">' + rap.map(function (r) { return '<button type="button" class="op" data-llenar="' + r[1] + '" aria-pressed="' + (st.monto === r[1]) + '">' + r[0] + '</button>'; }).join('') + '</div>';
      var ori = [];
      if (d.bolsillo && !d.persona) { var b = plata(d.bolsillo); if (b) ori.push([b.n, '🎯 ' + b.n + ' · tiene ' + pesos(b.s)]); }
      cfg.plata.forEach(function (c) { if (!ori.some(function (o) { return o[0] === c.n; })) ori.push([c.n, c.e + ' ' + c.n + ' · tiene ' + pesos(c.s)]); });
      if (cfg.mama && !d.mama && !d.persona) ori.push(['__mama', '👩 Lo pagó mamá']);
      h += fSelect('origen', '¿De dónde sale la plata?', ori, 'Elige la cuenta');
      if (st.origen === '__mama') h += fChips('mama', '¿Tu mamá te lo regaló o te lo prestó?', [['regalo', '🎁 Me lo regaló'], ['prestamo', '🤝 Me lo prestó']]);
      return h + fFecha();
    },
    fijo: function () {
      var pend = pendientesFijos();
      var h = fSelect('fijo', '¿Cuál pagaste?', pend.map(function (f, i) { return [String(i), '📌 ' + f.n + ' · ' + pesos(f.v) + ' · ' + cuando(f.d)]; }), 'Elige el gasto fijo');
      var f = pend[Number(st.fijo)];
      if (!f || st.fijo === '' || st.fijo == null) return h;
      if (st.monto == null) st.monto = f.v;
      if (st.cuenta == null) st.cuenta = f.c;
      h += fMonto('monto', '¿Cuánto pagaste?', '', true);
      var ops = cfg.plata.concat(deudasSinMama()).map(function (c) { return [c.n, c.e + ' ' + c.n + (c.n === f.c ? ' (la de siempre)' : '')]; });
      if (cfg.mama) ops.push(['__mama', '👩 Lo pagó mamá']);
      h += fSelect('cuenta', '¿Con qué pagaste?', ops, 'Elige la cuenta');
      if (st.cuenta === '__mama') h += fChips('mama', '¿Tu mamá te lo regaló o te lo prestó?', [['regalo', '🎁 Me lo regaló'], ['prestamo', '🤝 Me lo prestó']]);
      return h + fFecha();
    },
    mover: function () {
      var h = fSelect('desde', '¿De dónde sale?', [{ grupo: 'Tu plata' }].concat(opsPlata(true), [{ fin: 1 }, { grupo: 'Avance en efectivo' }],
        deudasSinMama().map(function (c) { return [c.n, c.e + ' ' + c.n]; }), [{ fin: 1 }]), 'Elige la cuenta');
      h += fSelect('hacia', '¿A dónde va?', cfg.plata.filter(function (c) { return c.n !== st.desde; }).map(function (c) { return [c.n, c.e + ' ' + c.n]; }), 'Elige la cuenta');
      return h + fMonto('monto', '¿Cuánto?', '', true) + fFecha();
    },
    ajuste: function () {
      var h = fSelect('cuenta', '¿Qué cuenta quieres cuadrar?', cfg.plata.concat(cfg.deudas).map(function (c) { return [c.n, c.e + ' ' + c.n + ' · ' + pesos(c.s)]; }), 'Elige la cuenta');
      var esDeuda = !!deuda(st.cuenta);
      h += fMonto('real', esDeuda ? '¿Cuánto debes realmente hoy?' : '¿Cuánto tiene realmente en este momento?', 'Puede ser 0. La diferencia queda como ajuste.', true);
      return h + fFecha();
    },
    monedas: function () {
      return fMonto('monto', '¿Cuánto regalaste en monedas?', 'En Efectivo tienes ' + pesos(cfg.efectivo || 0) + '.', true) + fFecha();
    }
  };
  function credito() {
    if (!st.credito) return null;
    if (String(st.credito).indexOf('p|') === 0) { var n = st.credito.slice(2), x = persona(n) || {}; return { n: n, s: x.ledebo || 0, pm: 0, persona: true }; }
    return deuda(st.credito);
  }
  function montoSugeridoPago(p, cs) {
    if (st.aplica && st.aplica.indexOf('mes|') === 0) { var c = cs.find(function (x) { return x.k === st.aplica.slice(4); }); return c ? c.m : 0; }
    if (st.aplica === '__compra') { var q = cs.find(function (x) { return x.k === st.compra; }); return q ? (q.q || q.p) : 0; }
    if (st.aplica === '__libre' || !cs.length) return p.debe;
    return 0;
  }

  // Revisa y arma lo que se envía al Apps Script (mismas acciones que el atajo).
  function armar() {
    var f = st.fecha || hoyISO();
    var falta = function (m) { throw new Error(m); };
    var monto = function (k, msg) { if (!(st[k] > 0)) falta(msg || 'Escribe el monto.'); return st[k]; };
    switch (tipo) {
      case 'gasto': {
        if (!String(st.desc || '').trim()) falta('Escribe en qué gastaste.');
        monto('monto');
        if (!st.cuenta) falta('Elige con qué pagaste.');
        var d = deuda(st.cuenta), cuotas = '';
        if (d && d.cuotas) {
          cuotas = st.cuotas === 'otro' ? Math.min(st.cuotasOtro || 0, d.max) : Number(st.cuotas) || 1;
          if (!(cuotas > 0)) falta('Escribe a cuántas cuotas.');
        }
        var para = st.para === '__nueva' ? String(st.paraNueva || '').trim() : st.para || '';
        if (st.para === '__nueva' && !para) falta('Escribe el nombre de la persona.');
        return { accion: 'gasto', fecha: f, descripcion: st.desc.trim(), monto: st.monto, categoria: st.cat || '', para: para, cuenta: st.cuenta,
          cuotas: cuotas, valorCuota: d && d.valor && st.valorCuota > 0 ? st.valorCuota : '', apartar: d && d.bolsillo && st.apartar === 'si' ? 'si' : '' };
      }
      case 'ingreso': {
        if (!st.tipoIng) falta('Elige el tipo de ingreso.');
        monto('monto');
        if (!st.cuenta) falta('Elige a qué cuenta llegó.');
        if (st.tipoIng === '__mepagaron') {
          if (!st.persona) falta('Elige quién te pagó.');
          var p = persona(st.persona), cs = (p.c || []).filter(function (c) { return c.p > 0; });
          if (cs.length && !st.aplica) falta('Elige a qué corresponde el pago.');
          if (st.aplica === '__compra' && !st.compra) falta('Elige qué compra te pagó.');
          var aplica = st.aplica === '__compra' ? st.compra : st.aplica && st.aplica.indexOf('mes|') === 0 ? st.aplica.slice(4) : '';
          return { accion: 'mepagaron', fecha: f, persona: st.persona, monto: st.monto, cuenta: st.cuenta, aplica: aplica, exceso: st.monto > p.debe ? st.exceso || 'favor' : '' };
        }
        if (st.tipoIng === '__meprestaron') {
          var quien = st.persona === '__nueva' ? String(st.personaNueva || '').trim() : st.persona;
          if (!quien) falta('Escribe quién te prestó.');
          return { accion: 'meprestaron', fecha: f, persona: quien, descripcion: st.desc || '', monto: st.monto, cuenta: st.cuenta };
        }
        return { accion: 'ingreso', fecha: f, tipoIngreso: st.tipoIng, descripcion: st.desc || '', monto: st.monto, cuenta: st.cuenta };
      }
      case 'pagar': {
        if (!st.credito) falta('Elige qué vas a pagar.');
        monto('monto');
        if (!st.origen) falta('Elige de dónde sale la plata.');
        if (String(st.credito).indexOf('p|') === 0) return { accion: 'lepague', fecha: f, persona: st.credito.slice(2), monto: st.monto, cuenta: st.origen };
        if (st.origen === '__mama' && !st.mama) falta('Dime si tu mamá te lo regaló o te lo prestó.');
        var dt = { accion: 'pagocredito', fecha: f, credito: st.credito, monto: st.monto };
        if (st.origen === '__mama') dt.origen = st.mama; else { dt.origen = 'cuenta'; dt.cuenta = st.origen; }
        return dt;
      }
      case 'fijo': {
        var fj = pendientesFijos()[Number(st.fijo)];
        if (!fj || st.fijo == null || st.fijo === '') falta('Elige el gasto fijo.');
        monto('monto');
        if (!st.cuenta) falta('Elige con qué pagaste.');
        if (st.cuenta === '__mama' && !st.mama) falta('Dime si tu mamá te lo regaló o te lo prestó.');
        var df = { accion: 'fijo', fecha: f, fijo: fj.n, periodo: fj.p, monto: st.monto };
        if (st.cuenta === '__mama') df.mama = st.mama; else df.cuenta = st.cuenta;
        return df;
      }
      case 'mover':
        if (!st.desde) falta('Elige de dónde sale la plata.');
        if (!st.hacia) falta('Elige a dónde va.');
        monto('monto');
        return { accion: 'transferencia', fecha: f, desde: st.desde, hacia: st.hacia, monto: st.monto };
      case 'ajuste':
        if (!st.cuenta) falta('Elige la cuenta.');
        if (st.real == null || isNaN(st.real)) falta('Escribe el saldo real (puede ser 0).');
        return { accion: 'ajuste', fecha: f, cuenta: st.cuenta, saldoReal: st.real };
      case 'monedas':
        monto('monto');
        return { accion: 'monedas', fecha: f, monto: st.monto, cuenta: 'Efectivo' };
    }
    return null;
  }

  /* ---------- hoja de registro ---------- */
  var hoja = null, cuerpo = null, guardando = false, scrollTipos = 0;
  var ICO_X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function abrir() {
    if (hoja || !MF.listo()) return;
    hoja = el('<div class="sheet-bg reg" role="dialog" aria-modal="true" aria-label="Registrar un movimiento"><div class="sheet glass-sheet reg-sheet">' +
      '<div class="sheet-h"><div><h2>Registrar</h2><div class="kind">Se guarda directo en tu hoja</div></div>' +
      '<button class="icon-btn cerrar" type="button" aria-label="Cerrar">' + ICO_X + '</button></div><div class="reg-cuerpo"></div></div></div>');
    cuerpo = hoja.querySelector('.reg-cuerpo');
    hoja.addEventListener('click', function (e) { if (e.target === hoja || e.target.closest('.cerrar')) cerrar(); });
    document.body.appendChild(hoja);
    document.body.classList.add('con-reg'); scrollTipos = 0;
    try { history.pushState({ reg: 1 }, ''); } catch (e) { /* sin historial */ }
    if (cfg) { if (!st.fecha) reiniciar(); pintar(); }
    else cuerpo.innerHTML = '<div class="state"><div class="spinner"></div>Cargando tus cuentas…</div>';
    pedirCfg().then(function (c) {
      var nuevo = !cfg;
      guardarCfg(c);
      if (!hoja) return;
      if (nuevo) { reiniciar(); pintar(); }
      else if (!hoja.contains(document.activeElement) || document.activeElement === hoja) pintar();
    }).catch(function (e) {
      if (hoja && !cfg) cuerpo.innerHTML = '<div class="reg-err">No pude leer tus cuentas. ' + esc(e && e.message || e) + '</div>';
    });
  }
  function cerrar(desdeAtras) {
    if (!hoja) return;
    hoja.remove(); hoja = null; cuerpo = null;
    document.body.classList.remove('con-reg');
    if (!desdeAtras && history.state && history.state.reg) { try { history.back(); } catch (e) { /* nada */ } }
  }
  window.addEventListener('popstate', function () { if (hoja) cerrar(true); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && hoja) cerrar(); });

  function pintar() {
    if (!cuerpo) return;
    if (tiposVisibles().indexOf(tipo) < 0) { tipo = 'gasto'; reiniciar(); }
    var y = hoja.querySelector('.reg-sheet').scrollTop;
    cuerpo.innerHTML = '<div class="reg-tipos" role="tablist">' + tiposVisibles().map(function (k) {
      var n = k === 'fijo' ? ' (' + pendientesFijos().length + ')' : '';
      return '<button type="button" role="tab" class="op" data-tipo="' + k + '" aria-selected="' + (k === tipo) + '" aria-pressed="' + (k === tipo) + '">' + TIPOS[k].t + n + '</button>';
    }).join('') + '</div>' +
      '<form class="reg-form" novalidate><h3>' + TIPOS[tipo].titulo + '</h3>' + FORM[tipo]() +
      '<div class="reg-err" hidden></div>' +
      '<div class="reg-pie"><button class="btn primary guardar" type="submit">Guardar</button></div></form>';
    hoja.querySelector('.reg-sheet').scrollTop = y;
    // El tipo elegido queda a la vista en la fila (si hace falta, la fila se corre un poco).
    var row = cuerpo.querySelector('.reg-tipos'), sel = row.querySelector('[aria-selected="true"]');
    row.scrollLeft = scrollTipos;
    if (sel) {
      var rr = row.getBoundingClientRect(), rs = sel.getBoundingClientRect();
      if (rs.left < rr.left + 12) row.scrollLeft -= rr.left + 18 - rs.left;
      else if (rs.right > rr.right - 12) row.scrollLeft += rs.right - rr.right + 18;
    }
    row.addEventListener('scroll', function () { scrollTipos = row.scrollLeft; }, { passive: true });
    enlazar();
  }

  function cambiar(k, v) {
    var antes = st[k];
    st[k] = v;
    if (antes !== v) (DEPENDE[k] || []).forEach(function (x) { delete st[x]; });
    if (k === 'tipoIng' || k === 'credito' || k === 'fijo') st._montoAuto = undefined;
    if (k === 'aplica' || k === 'compra') st._montoAuto = undefined;
    if (k === 'cat') st._catManual = true;
    pintar();
  }

  function enlazar() {
    var form = cuerpo.querySelector('.reg-form');
    cuerpo.querySelectorAll('[data-tipo]').forEach(function (b) {
      b.addEventListener('click', function () { if (tipo !== b.dataset.tipo) { tipo = b.dataset.tipo; reiniciar(); pintar(); } });
    });
    form.querySelectorAll('input[data-k]').forEach(function (i) {
      var k = i.dataset.k;
      i.addEventListener('input', function () {
        if (i.dataset.money) {
          var n = aNum(i.value);
          i.value = miles(n);
          st[k] = n;
          if (k === 'monto') { st._montoAuto = false; form.querySelectorAll('[data-llenar]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.llenar) === n)); }); }
        } else st[k] = i.value;
        if (k === 'desc' && tipo === 'gasto' && !st._catManual) {
          st.cat = sugerir(i.value) || '';
          var sel = form.querySelector('select[data-k="cat"]'), nota = form.querySelector('[data-sug]');
          if (sel) sel.value = st.cat;
          if (nota) nota.textContent = st.cat ? '✨ Sugerida por la descripción. Puedes cambiarla.' : 'Si no eliges, la adivino por la descripción.';
        }
      });
      // Lo que cambia otras preguntas (p. ej. pagar de más) se repinta al salir del campo.
      if (k === 'monto' && tipo === 'ingreso') i.addEventListener('change', pintar);
      if (k === 'fecha') i.addEventListener('change', function () { st.fecha = i.value || hoyISO(); });
    });
    form.querySelectorAll('select[data-k]').forEach(function (s) { s.addEventListener('change', function () { cambiar(s.dataset.k, s.value); }); });
    form.querySelectorAll('[data-op]').forEach(function (b) { b.addEventListener('click', function () { cambiar(b.dataset.op, b.dataset.v); }); });
    form.querySelectorAll('[data-llenar]').forEach(function (b) {
      b.addEventListener('click', function () { st.monto = Number(b.dataset.llenar); st._montoAuto = false; pintar(); });
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); guardar(form); });
  }

  function guardar(form) {
    if (guardando) return;
    var err = form.querySelector('.reg-err'), btn = form.querySelector('.guardar'), datos;
    try { datos = armar(); } catch (e) { err.textContent = e.message; err.hidden = false; err.scrollIntoView({ block: 'nearest' }); return; }
    err.hidden = true;
    guardando = true; btn.disabled = true; btn.innerHTML = '<span class="spin-mini"></span> Guardando…';
    if (datos.cuenta && tipo === 'gasto') MF.guardarLocal('regCuenta', datos.cuenta);
    enviar(datos).then(function (r) {
      guardando = false;
      if (!r.ok) throw new Error(String(r.mensaje || 'No se registró.').replace(/^❌\s*/, ''));
      listo(r.mensaje);
      MF.refrescar();
    }).catch(function (e) {
      guardando = false;
      if (!hoja) return;
      btn.disabled = false; btn.textContent = 'Guardar';
      err.textContent = (e instanceof TypeError ? 'No pude conectarme. Revisa tu internet: no se registró nada.' : e.message || String(e));
      err.hidden = false;
    });
  }

  function listo(mensaje) {
    if (!cuerpo) return;
    cuerpo.innerHTML = '<div class="reg-ok"><div class="reg-ok-ico">✓</div><h3>Listo, quedó guardado</h3><p>' +
      esc(mensaje || '').replace(/\n/g, '<br>') + '</p><div class="reg-ok-acc">' +
      '<button class="btn" type="button" data-otro>➕ Registrar otro</button><button class="btn primary" type="button" data-fin>Listo</button></div></div>';
    cuerpo.querySelector('[data-otro]').addEventListener('click', function () { reiniciar(); pintar(); });
    cuerpo.querySelector('[data-fin]').addEventListener('click', function () { cerrar(); });
  }

  /* ---------- botón flotante: tócalo para registrar, deslízalo a la derecha para ocultarlo ---------- */
  var ICO_MAS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  var ICO_IZQ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var wrap = el('<div class="fab-wrap"><button class="fab" type="button" aria-label="Registrar un movimiento (desliza a la derecha para ocultar)">' + ICO_MAS + '<span>Registrar</span></button>' +
    '<button class="fab-tab" type="button" aria-label="Mostrar el botón de registrar">' + ICO_IZQ + '</button><div class="fab-tip" hidden>Desliza → para ocultarlo</div></div>');
  var fab = wrap.querySelector('.fab'), tab = wrap.querySelector('.fab-tab'), tip = wrap.querySelector('.fab-tip');
  function setOculto(v, guardar) {
    wrap.classList.toggle('oculto', v);
    fab.tabIndex = v ? -1 : 0; tab.tabIndex = v ? 0 : -1;
    if (guardar) MF.guardarLocal('fabOculto', v ? '1' : null);
  }
  setOculto(MF.leerLocal('fabOculto') === '1', false);
  document.body.appendChild(wrap);

  function arrastre(elem, alSoltar) {
    var x0 = null, y0 = 0, dx = 0, id = null;
    elem.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; dx = 0; id = e.pointerId; });
    elem.addEventListener('pointermove', function (e) {
      if (x0 === null || e.pointerId !== id) return;
      dx = e.clientX - x0;
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - y0)) {
        try { elem.setPointerCapture(id); } catch (err) { /* nada */ }
        elem.classList.add('arrastrando');
        alSoltar(dx, true);
      }
    });
    var fin = function (e) {
      if (x0 === null || (e && e.pointerId !== id)) return;
      elem.classList.remove('arrastrando');
      var d = dx; x0 = null;
      alSoltar(d, false);
    };
    elem.addEventListener('pointerup', fin);
    elem.addEventListener('pointercancel', function () { if (x0 !== null) { elem.classList.remove('arrastrando'); x0 = null; alSoltar(0, false); } });
  }
  var moviendo = false;
  arrastre(fab, function (dx, enCurso) {
    if (enCurso) { moviendo = true; fab.style.transform = 'translateX(' + Math.max(0, dx) + 'px)'; return; }
    fab.style.transform = '';
    if (dx > 40) { setOculto(true, true); tip.hidden = true; }
    setTimeout(function () { moviendo = false; }, 0);
  });
  fab.addEventListener('click', function () { if (!moviendo) { tip.hidden = true; abrir(); } });
  arrastre(tab, function (dx, enCurso) { if (!enCurso && dx < -20) setOculto(false, true); });
  tab.addEventListener('click', function () { setOculto(false, true); });

  // La primera vez, una pista corta de que se puede ocultar.
  if (!MF.leerLocal('fabTip') && !wrap.classList.contains('oculto')) {
    setTimeout(function () {
      if (!MF.listo() || wrap.classList.contains('oculto')) return;
      tip.hidden = false; MF.guardarLocal('fabTip', '1');
      setTimeout(function () { tip.hidden = true; }, 4500);
    }, 1800);
  }

  /* ---------- atajo del ícono de la app (mantener presionado → Registrar) ---------- */
  function revisarRuta() {
    if (location.hash !== '#/registrar') return;
    try { history.replaceState(null, '', '#/inicio'); } catch (e) { /* nada */ }
    var intentos = 0;
    (function esperar() { if (MF.listo()) abrir(); else if (intentos++ < 40) setTimeout(esperar, 250); })();
  }
  window.addEventListener('hashchange', revisarRuta);
  revisarRuta();
})();
