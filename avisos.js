/* MIS FINANZAS · "Por confirmar": los avisos de tus bancos (notificaciones y SMS) que una macro del celular reenvía a tu hoja.
   Aquí decides qué fue cada uno. Todo se resuelve con el mismo formulario de "Registrar" (monto, cuenta y fecha ya puestos). */
(function () {
  'use strict';
  var MF = window.MF;
  if (!MF) return;
  var esc = MF.esc, el = MF.el, pesos = MF.pesos, ICON = MF.icon;
  var abierto = null, verRevisados = false, confirmandoAuto = false, ocupado = {}, error = '', mostrarOrigen = false;

  /* ---------- lector nativo (solo en la app Android): notificaciones + SMS de los bancos ---------- */
  function lector() {
    var C = window.Capacitor;
    try { return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.Lector && C.Plugins.Lector.estado ? C.Plugins.Lector : null; } catch (e) { return null; }
  }
  var lecEstado = null, lecConfig = '';
  function configurarLector() {
    var L = lector(), clave = MF.clave && MF.clave();
    if (!L || !clave || !MF.API) return Promise.resolve(null);
    var firma = MF.API + '|' + clave;
    var p = lecConfig === firma ? L.estado() : L.configurar({ url: MF.API, clave: clave });
    return p.then(function (e) { lecConfig = firma; lecEstado = e; return e; }, function () { return null; });
  }
  setTimeout(configurarLector, 3000);
  document.addEventListener('visibilitychange', function () {   // al volver de los ajustes del celular
    if (!document.hidden && lector()) configurarLector().then(function () { repintar(); });
  });
  var ORIGEN = { app: '📲 App', macro: '🤖 MacroDroid', ambos: '📲🤖 Ambos' };

  var BANCOS = { nequi: ['🩷', 'Nequi'], daviplata: ['❤️', 'Daviplata'], davibank: ['🔴', 'Davibank'], nubank: ['🟣', 'Nubank'], falabella: ['🟢', 'Falabella'] };
  function datosAv() { var d = MF.datos(); return (d && d.avisos) || { modo: 'avisar', pendientes: 0, items: [] }; }
  function ahoraISO() { return MF.hoy() || new Date().toISOString().slice(0, 10); }

  function hora(t) {
    var dia = t.slice(0, 10), hh = +t.slice(11, 13), mm = t.slice(14, 16);
    var h12 = (hh % 12) || 12, ampm = hh < 12 ? 'a. m.' : 'p. m.';
    var hoy = ahoraISO(), ay = new Date(hoy + 'T12:00:00'); ay.setDate(ay.getDate() - 1);
    var ayer = ay.getFullYear() + '-' + ('0' + (ay.getMonth() + 1)).slice(-2) + '-' + ('0' + ay.getDate()).slice(-2);
    var d = dia === hoy ? 'Hoy' : dia === ayer ? 'Ayer' : MF.fechaCorta(dia);
    return d + ' · ' + h12 + ':' + mm + ' ' + ampm;
  }
  function titulo(a) {
    if (a.tipo === 'gasto') return a.quien || 'Compra' + (a.cuenta ? ' con ' + a.cuenta : '');
    if (a.tipo === 'salida') return 'Enviaste plata' + (a.quien ? ' a ' + a.quien : '');
    if (a.tipo === 'entrada') return a.quien ? a.quien + ' te envió' : 'Recibiste plata';
    if (a.tipo === 'retiro') return 'Retiro de efectivo';
    if (a.tipo === 'transferencia') return 'Entre tus cuentas';
    if (a.tipo === 'noreconocido') return 'No reconocido' + (BANCOS[a.banco] ? ' · ' + BANCOS[a.banco][1] : '');
    return a.quien || 'Movimiento';
  }
  function sub(a) {
    var ico = BANCOS[a.banco] ? BANCOS[a.banco][0] : '🏦';
    if (a.tipo === 'noreconocido') return ico + ' ' + esc((a.fuentes || []).join(' + ') || 'aviso') + ' · ' + hora(a.t);
    var cuenta = a.tipo === 'transferencia' ? esc(a.cuenta || '¿?') + ' → ' + esc(a.destino || '¿?') : a.cuenta ? esc(a.cuenta) : '<b class="av-warn">cuenta sin asignar</b>';
    return ico + ' ' + cuenta + ' · ' + hora(a.t);
  }
  function etiquetas(a) {
    var e = [];
    if (a.tipo === 'noreconocido') e.push('❓ el lector no lo entendió · revisa el texto');
    if (mostrarOrigen && ORIGEN[a.origen]) e.push(ORIGEN[a.origen]);
    if (a.tc) e.push('💳 tarjeta · entra a 1 cuota');
    if (a.recurrente) e.push('🔁 recurrente');
    if (a.n > 1) e.push(a.n + ' avisos del mismo movimiento');
    if (a.tipo === 'entrada' && a.mio) e.push('de tu mismo nombre');
    return e.map(function (x) { return '<span class="av-tag">' + x + '</span>'; }).join('');
  }

  /* ---------- lo que puedes hacer con cada aviso ---------- */
  function cfgListo() { return MF.cfgRegistro() ? Promise.resolve(MF.cfgRegistro()) : MF.cargarCfgRegistro(); }
  function abrirForm(a, tab, pre) {
    cfgListo().then(function () {
      var ctx = { id: a.id, monto: a.monto, cuenta: a.cuenta || '', fecha: a.t.slice(0, 10), quien: a.quien, entrada: a.tipo === 'entrada', libre: a.tipo === 'noreconocido', texto: a.texto };
      MF.registrarCon(tab, pre || {}, ctx);
    }).catch(function (e) { error = 'No pude cargar tus cuentas: ' + (e && e.message || e); repintar(); });
  }
  function enviarAccion(a, datos, ok) {
    if (ocupado[a.id]) return;
    ocupado[a.id] = true; error = ''; repintar();
    datos.id = a.id; datos.rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    MF.enviar(datos).then(function (r) {
      if (!r.ok) throw new Error(String(r.mensaje || 'No se pudo.').replace(/^❌\s*/, ''));
      delete ocupado[a.id]; abierto = null; MF.refrescar(); repintar();
    }).catch(function (e) {
      delete ocupado[a.id];
      error = e instanceof TypeError ? 'No pude conectarme. Revisa tu internet.' : e.message;
      repintar();
    });
  }
  function ignorar(a) { enviarAccion(a, { accion: 'avisoresolver', como: 'ignorar' }); }
  function opciones(a) {
    var cfg = MF.cfgRegistro();
    var hayMama = cfg && (cfg.ingresos || []).some(function (c) { return c.n === 'Aporte de mamá'; });
    var o = [];
    if (a.tipo === 'gasto') {
      o.push(['✅ Registrar gasto' + (a.tc ? ' (aclaro las cuotas)' : ''), function () { abrirForm(a, 'gasto'); }]);
      o.push(['🤝 Es para otra persona', function () { abrirForm(a, 'gasto', { para: '__otra' }); }]);
    } else if (a.tipo === 'salida') {
      o.push(['💸 Fue un gasto', function () { abrirForm(a, 'gasto'); }]);
      o.push(['🤝 Pagué o presté por alguien', function () { abrirForm(a, 'gasto', { para: '__otra' }); }]);
      o.push(['🙋 Le devolví plata a alguien', function () { abrirForm(a, 'pagar'); }]);
      o.push(['💳 Pagué una tarjeta o crédito', function () { abrirForm(a, 'pagar'); }]);
      o.push(['🔄 Fue a otra cuenta mía', function () { abrirForm(a, 'mover'); }]);
    } else if (a.tipo === 'entrada') {
      o.push(['💰 Es un ingreso', function () { abrirForm(a, 'ingreso'); }]);
      if (hayMama) o.push(['👩 Aporte de mamá', function () { abrirForm(a, 'ingreso', { tipoIng: 'Aporte de mamá' }); }]);
      o.push(['🤝 Me pagaron algo que me debían', function () { abrirForm(a, 'ingreso', { tipoIng: '__mepagaron' }); }]);
      o.push(['🙋 Me prestaron plata', function () { abrirForm(a, 'ingreso', { tipoIng: '__meprestaron' }); }]);
      o.push(['🔄 Viene de otra cuenta mía', function () { abrirForm(a, 'mover'); }]);
    } else if (a.tipo === 'retiro') {
      o.push(['🪙 Retiré efectivo', function () { abrirForm(a, 'mover', { hacia: 'Efectivo' }); }]);
      o.push(['💸 Fue un gasto', function () { abrirForm(a, 'gasto'); }]);
    } else if (a.tipo === 'transferencia') {
      if (a.cuenta && a.destino) o.push(['✅ Confirmar: ' + a.cuenta + ' → ' + a.destino, function () {
        enviarAccion(a, { accion: 'avisoresolver', como: 'transferencia', datos: JSON.stringify({ desde: a.cuenta, hacia: a.destino }) }); }]);
      o.push(['✏️ Cambiar las cuentas', function () { abrirForm(a, 'mover', { desde: a.cuenta || undefined, hacia: a.destino || undefined }); }]);
      o.push(['💸 No, fue un gasto', function () { abrirForm(a, 'gasto'); }]);
    } else if (a.tipo === 'noreconocido') {
      o.push(['💸 Fue un gasto', function () { abrirForm(a, 'gasto'); }]);
      o.push(['💰 Me entró plata', function () { abrirForm(a, 'ingreso'); }]);
      o.push(['💳 Pagué una tarjeta, crédito o deuda', function () { abrirForm(a, 'pagar'); }]);
      o.push(['🔄 Fue entre mis cuentas', function () { abrirForm(a, 'mover'); }]);
      o.push(['🙈 No era un movimiento', function () { ignorar(a); }, 'tenue']);
      return o;
    }
    o.push(['🙈 Ignorar', function () { ignorar(a); }, 'tenue']);
    return o;
  }

  /* ---------- pantalla ---------- */
  var raiz = null, ultimoD = null;
  function repintar() { if (raiz && location.hash === '#/avisos') vista(raiz, ultimoD, true); }

  function tarjeta(a, lista) {
    var abierta = abierto === a.id, bloqueado = !!ocupado[a.id];
    var nr = a.tipo === 'noreconocido';
    var signo = a.tipo === 'entrada' ? '+' : a.tipo === 'transferencia' || nr ? '' : '−';
    var cls = a.tipo === 'entrada' ? 'in' : a.tipo === 'transferencia' || nr ? 'mid' : 'out';
    var h = '<div class="av-item' + (abierta ? ' open' : '') + '" data-id="' + esc(a.id) + '"><button type="button" class="av-fila" data-abrir aria-expanded="' + abierta + '">' +
      '<div class="av-tx"><b>' + esc(titulo(a)) + '</b><small>' + sub(a) + '</small></div><div class="av-v ' + cls + '">' + (nr ? (a.monto > 0 ? '¿' + pesos(a.monto) + '?' : '¿$?') : signo + pesos(a.monto)) + '</div></button>';
    if (lista === 'pend') {
      h += '<div class="av-tags">' + etiquetas(a) + '</div>';
      if (nr && !abierta && a.texto) h += '<p class="av-crudo">“' + esc(a.texto) + '”</p>';
      if (abierta) {
        h += '<div class="av-ops">' + (bloqueado ? '<div class="av-gu"><span class="spin-mini"></span> Guardando…</div>' : opciones(a).map(function (x, i) {
          return '<button type="button" class="op av-op' + (x[2] ? ' tenue' : '') + '" data-op="' + i + '">' + esc(x[0]) + '</button>'; }).join('')) + '</div>' +
          (a.texto ? '<p class="av-crudo">“' + esc(a.texto) + '”</p>' : '');
      } else h += '<div class="av-cta"><button type="button" class="btn av-resolver" data-abrir>Elegir qué fue</button></div>';
    } else {
      h += '<div class="av-nota">' + (a.estado === 'Registrado' ? '✓ ' + (/^Autom/.test(a.nota) ? esc(a.nota) : 'Registrado') : a.estado === 'Ignorado' ? '🙈 Ignorado' : '👌 ' + esc(a.nota || 'Ya lo tenías registrado')) +
        (a.idMov && a.estado === 'Registrado' && window.MFAdmin ? ' <button type="button" class="av-link" data-editar="' + esc(a.idMov) + '">Ver / editar</button>' : '') +
        (a.estado === 'Ignorado' ? ' <button type="button" class="av-link" data-reabrir>Volver a revisar</button>' : a.estado === 'Ya estaba' ? ' <button type="button" class="av-link" data-reabrir>No es ese</button>' : '') + '</div>';
    }
    var nodo = el(h + '</div>');
    nodo.querySelectorAll('[data-abrir]').forEach(function (b) { b.addEventListener('click', function () { abierto = abierta ? null : a.id; repintar(); }); });
    nodo.querySelectorAll('[data-op]').forEach(function (b) { b.addEventListener('click', function () { var x = opciones(a)[+b.dataset.op]; if (x) x[1](); }); });
    var ed = nodo.querySelector('[data-editar]'); if (ed) ed.addEventListener('click', function () { MFAdmin.movimiento(ed.dataset.editar); });
    var re = nodo.querySelector('[data-reabrir]'); if (re) re.addEventListener('click', function () { enviarAccion(a, { accion: 'avisoresolver', como: 'reabrir' }); });
    return nodo;
  }

  function seccion(titulo_, aside, items, lista, vacio) {
    var s = el('<section class="card av-sec"><div class="card-h"><h2>' + titulo_ + '</h2>' + (aside ? '<span class="aside">' + aside + '</span>' : '') + '</div><div class="av-lista"></div></section>');
    var cont = s.querySelector('.av-lista');
    if (!items.length) cont.innerHTML = '<p class="av-vacio">' + vacio + '</p>';
    items.forEach(function (a) { cont.appendChild(tarjeta(a, lista)); });
    return s;
  }

  function tarjetaLector(av) {
    var L = lector(), e = lecEstado;
    if (!L) return null;
    var c = av.comparacion;
    if (!e) return el('<section class="card av-lector"><div class="card-h"><h2>📲 Lector del celular</h2></div><p class="nota">Revisando permisos…</p></section>');
    function fila(ok, ico, t, sub, acc, btn) {
      return '<div class="av-perm"><span class="av-pi">' + ico + '</span><span class="av-pt"><b>' + t + '</b><small>' + sub + '</small></span>' +
        (ok ? '<span class="av-ok">✓</span>' : '<button type="button" class="btn av-pb" data-l="' + acc + '">' + btn + '</button>') + '</div>';
    }
    var listo = e.notificaciones && e.activo;
    var h = '<section class="card av-lector"><div class="card-h"><h2>📲 Lector del celular</h2><span class="aside">' +
      (!e.notificaciones ? '<b class="av-warn">Sin activar</b>' : e.activo ? '<b class="av-on">● Activo</b>' : '<b>Pausado</b>') + '</span></div>' +
      '<p class="nota">La app lee sola las notificaciones y los SMS de tus bancos y los manda aquí, igual que MacroDroid. No lee nada de otras apps.</p>' +
      '<div class="av-perms">' +
      fila(e.notificaciones, '🔔', 'Acceso a notificaciones', e.apps && e.apps.length ? 'Solo lee: ' + e.apps.map(esc).join(', ') : 'Nequi, Daviplata, Davibank, Nu, Falabella y Billetera', 'notif', 'Activar') +
      (!e.notificaciones || !e.sms ? '<p class="nota av-xi">¿Android dice “se le negó el acceso”? Ve a Ajustes → Apps → Mis finanzas → <b>⋮</b> (arriba a la derecha) → <b>Permitir ajustes restringidos</b>, y vuelve a intentarlo. <button type="button" class="av-link" data-l="ajustes">Abrir ajustes</button></p>' : '') +
      fila(e.sms, '✉️', 'SMS de los bancos', 'Solo 899979, 85888, 85954 y 890806', 'sms', 'Permitir') +
      fila(e.bateria, '🔋', 'Batería sin restricciones', 'Para que no se duerma en segundo plano', 'bat', 'Permitir') +
      '</div><p class="nota av-xi">En Xiaomi, activa también <b>Inicio automático</b> en los ajustes de la app. <button type="button" class="av-link" data-l="ajustes">Abrir ajustes</button></p>';
    if (e.notificaciones) {
      h += '<div class="av-cont"><b>' + (e.enviados || 0) + '</b> avisos enviados' + (e.cola ? ' · <b class="av-warn">' + e.cola + ' en cola</b> (se reintentan solos cuando haya internet)' : '') + '</div>';
      var hist = (e.historial || []).slice(-3).reverse();
      if (hist.length) h += '<ul class="av-hist">' + hist.map(function (x) {
        return '<li><span>' + esc(hora(x.hora || '')) + ' · ' + esc(x.app || '') + '</span><small>' + esc(String(x.r || '').slice(0, 90)) + '</small></li>'; }).join('') + '</ul>';
      if (e.error && e.cola) h += '<p class="nota av-warn">' + esc(e.error) + '</p>';
    }
    if (c) h += '<div class="av-comp"><b>Comparación con MacroDroid</b> (desde que el lector empezó, máx. 7 días)<div class="av-comp-n">' +
      '<span><b>' + c.ambos + '</b> por ambos</span><span><b>' + c.macro + '</b> solo MacroDroid</span><span><b>' + c.app + '</b> solo App</span></div>' +
      '<small>' + (c.macro === 0 && c.ambos > 0 ? 'Hasta ahora el lector no se ha perdido ninguno. Si sigue así varios días, ya puedes apagar MacroDroid.' :
        c.macro > 0 ? 'Hay avisos que solo vio MacroDroid: no lo apagues todavía.' : 'Aún no hay suficientes avisos para comparar.') + '</small></div>';
    if (e.notificaciones) h += '<div class="av-cta"><button type="button" class="btn" data-l="pausa">' + (e.activo ? '⏸ Pausar lector' : '▶️ Reanudar lector') + '</button></div>';
    var n = el(h + '</section>');
    n.querySelectorAll('[data-l]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.l, p;
        if (k === 'notif') p = L.abrirNotificaciones();
        else if (k === 'sms') p = L.pedirSms();
        else if (k === 'bat') p = L.pedirBateria();
        else if (k === 'ajustes') p = L.abrirAjustesApp();
        else if (k === 'pausa') p = L.activar({ activo: !e.activo });
        Promise.resolve(p).then(function () { return configurarLector(); }).then(function () { repintar(); }, function () { repintar(); });
      });
    });
    return n;
  }

  function vista(app, d, silencioso) {
    raiz = app; ultimoD = d;
    var av = datosAv();
    var items = av.items || [];
    mostrarOrigen = !!av.comparacion;
    if (lector() && !lecEstado) configurarLector().then(function () { repintar(); });
    var pend = items.filter(function (a) { return a.estado === 'Pendiente'; });
    var auto = items.filter(function (a) { return a.estado === 'Registrado' && /^Autom/.test(a.nota); });
    var ya = items.filter(function (a) { return a.estado === 'Ya estaba'; });
    var rev = items.filter(function (a) { return (a.estado === 'Registrado' && !/^Autom/.test(a.nota)) || a.estado === 'Ignorado'; });
    var y = silencioso ? window.scrollY : 0;
    app.innerHTML = '';
    var top = el('<div class="top"><div class="hello"><h1>Por confirmar</h1><p>' + (pend.length ? pend.length + (pend.length === 1 ? ' aviso por revisar' : ' avisos por revisar') : 'Todo al día 🎉') + '</p></div></div>');
    var volver = el('<div><button class="btn back" type="button">' + ICON.back + 'Volver</button></div>');
    volver.querySelector('button').addEventListener('click', function () { if (history.length > 1) history.back(); else MF.ir('#/mas'); });
    app.appendChild(volver);
    app.appendChild(top);
    if (error) app.appendChild(el('<div class="reg-err av-err" role="alert">' + esc(error) + '</div>'));

    // Modo
    var auto_ = av.modo === 'auto';
    var modo = el('<section class="card av-modo"><div class="card-h"><h2>Cómo quieres que se registren</h2></div>' +
      '<div class="opciones"><button type="button" class="op" data-modo="avisar" aria-pressed="' + !auto_ + '">🔔 Solo avisarme</button>' +
      '<button type="button" class="op" data-modo="auto" aria-pressed="' + auto_ + '">⚡ Registrar solos los simples</button></div>' +
      '<p class="nota">' + (auto_ ? 'Los gastos con una sola cuenta (las tarjetas entran a <b>1 cuota</b>) y las transferencias entre tus cuentas se registran solos. Todo lo demás, y lo que te envía otra persona, espera tu decisión.' :
        'Nada se registra hasta que tú lo confirmes. Es el modo más seguro para empezar.') + '</p>' +
      (confirmandoAuto ? '<div class="av-conf"><p>¿Activar el registro automático? Podrás revisar y corregir cada movimiento en “Registrados automáticamente”.</p><button type="button" class="btn primary" data-si>Sí, activar</button> <button type="button" class="btn" data-no>Cancelar</button></div>' : '') + '</section>');
    modo.querySelectorAll('[data-modo]').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = b.dataset.modo;
        if (m === av.modo) return;
        if (m === 'auto') { confirmandoAuto = true; repintar(); return; }
        cambiarModo('avisar');
      });
    });
    var si = modo.querySelector('[data-si]'); if (si) si.addEventListener('click', function () { confirmandoAuto = false; cambiarModo('auto'); });
    var no = modo.querySelector('[data-no]'); if (no) no.addEventListener('click', function () { confirmandoAuto = false; repintar(); });
    app.appendChild(modo);
    var tl = tarjetaLector(av); if (tl) app.appendChild(tl);

    app.appendChild(seccion('Necesitan tu decisión', pend.length ? '<b>' + pend.length + '</b>' : '', pend, 'pend',
      items.length ? 'No tienes avisos pendientes. 🙌' : 'Todavía no ha llegado ningún aviso. Cuando llegue una notificación o SMS de tu banco, aparecerá aquí.'));
    if (auto.length) app.appendChild(seccion('Registrados automáticamente', '<b>' + auto.length + '</b>', auto, 'otros', ''));
    if (ya.length) app.appendChild(seccion('Ya estaban en tu app', '<b>' + ya.length + '</b>', ya, 'otros', ''));
    if (rev.length) {
      var s = seccion('Revisados', '<button type="button" class="av-link" data-ver>' + (verRevisados ? 'Ocultar' : 'Ver ' + rev.length) + '</button>', verRevisados ? rev : [], 'otros', '');
      if (!verRevisados) s.querySelector('.av-lista').innerHTML = '';
      s.querySelector('[data-ver]').addEventListener('click', function () { verRevisados = !verRevisados; repintar(); });
      app.appendChild(s);
    }
    if (silencioso) window.scrollTo(0, y);
  }
  function cambiarModo(m) {
    error = '';
    MF.enviar({ accion: 'avisosmodo', modo: m, rid: Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }).then(function (r) {
      if (!r.ok) throw new Error(String(r.mensaje || '').replace(/^❌\s*/, ''));
      MF.refrescar();
    }).catch(function (e) { error = e instanceof TypeError ? 'No pude conectarme. Revisa tu internet.' : e.message; repintar(); });
  }

  window.MFAvisos = { vista: vista, pendientes: function () { return datosAv().pendientes || 0; } };
})();
