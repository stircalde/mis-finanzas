/* MIS FINANZAS · administrar desde la app: gastos fijos y suscripciones, y tus cuentas y créditos.
   Escribe en la pestaña Configuración de tu hoja a través del Apps Script. */
(function () {
  'use strict';
  var MF = window.MF;
  if (!MF) return;
  var esc = MF.esc, pesos = MF.pesos;
  var ICON = MF.icon;

  /* ---------- utilidades de formulario (mismo estilo del botón Registrar) ---------- */
  function aNum(v) { var s = String(v == null ? '' : v).replace(/\D/g, ''); return s ? Number(s) : NaN; }
  function miles(n) { return isNaN(n) || n === '' || n == null ? '' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function campo(label, dentro, nota) { return '<div class="campo"><label>' + label + '</label>' + dentro + (nota ? '<p class="nota">' + nota + '</p>' : '') + '</div>'; }
  function fTexto(st, k, label, ph, bloqueado) {
    return campo(label, '<input class="in" data-k="' + k + '" type="text" autocomplete="off" placeholder="' + esc(ph || '') + '" value="' + esc(st[k] || '') + '"' + (bloqueado ? ' disabled' : '') + '>');
  }
  function fMonto(st, k, label, nota) {
    return campo(label, '<div class="money big"><span>$</span><input class="in" data-k="' + k + '" data-money="1" inputmode="numeric" autocomplete="off" placeholder="0" value="' + miles(st[k]) + '"></div>', nota);
  }
  function fNumero(st, k, label, ph, nota) {
    return campo(label, '<input class="in" data-k="' + k + '" inputmode="decimal" autocomplete="off" placeholder="' + esc(ph || '') + '" value="' + esc(st[k] == null ? '' : st[k]) + '">', nota);
  }
  function fSelect(st, k, label, ops, ph) {
    var h = '<select class="in" data-k="' + k + '">' + (ph ? '<option value=""' + (st[k] ? '' : ' selected') + ' disabled>' + esc(ph) + '</option>' : '');
    ops.forEach(function (o) {
      if (o.grupo) { h += '<optgroup label="' + esc(o.grupo) + '">'; return; }
      if (o.fin) { h += '</optgroup>'; return; }
      h += '<option value="' + esc(o[0]) + '"' + (String(st[k]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    });
    return campo(label, h + '</select>');
  }
  function fChips(st, k, label, ops, nota) {
    return campo(label, '<div class="opciones">' + ops.map(function (o) {
      return '<button type="button" class="op" data-op="' + k + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (String(st[k]) === String(o[0])) + '">' + esc(o[1]) + '</button>';
    }).join('') + '</div>', nota);
  }
  function fFecha(st, k, label) { return campo(label, '<input class="in" data-k="' + k + '" type="date" value="' + esc(st[k] || '') + '">'); }

  // Hoja con formulario: pinta, enlaza y repinta cuando cambia algo que muestra u oculta preguntas.
  function hojaFormulario(titulo, sub, st, cuerpo, alGuardar, extra) {
    var hoja = null;
    var pintar = function () {
      var html = '<div class="sheet-h"><div><h2>' + esc(titulo) + '</h2>' + (sub ? '<div class="kind">' + sub + '</div>' : '') + '</div>' +
        '<button class="icon-btn" type="button" data-cerrar aria-label="Cerrar">' + ICON.close + '</button></div>' +
        '<form class="reg-form adm-form" novalidate>' + cuerpo(st) + '<div class="reg-err" hidden></div>' +
        '<div class="reg-pie"><button class="btn primary guardar" type="submit">Guardar</button>' + (extra ? extra(st) : '') + '</div></form>';
      if (!hoja) MF.abrirHoja(html, function (h) { hoja = h; enlazar(); });
      else { var sh = hoja.querySelector('.sheet'), y = sh.scrollTop; sh.innerHTML = html; sh.scrollTop = y; sh.classList.add('sin-cascada'); enlazar(); }
    };
    var enlazar = function () {
      var form = hoja.querySelector('form');
      form.querySelectorAll('input[data-k]').forEach(function (i) {
        i.addEventListener('input', function () {
          if (i.dataset.money) { var n = aNum(i.value); i.value = miles(n); st[i.dataset.k] = n; }
          else st[i.dataset.k] = i.value;
        });
      });
      form.querySelectorAll('select[data-k]').forEach(function (s) { s.addEventListener('change', function () { st[s.dataset.k] = s.value; pintar(); }); });
      form.querySelectorAll('[data-op]').forEach(function (b) { b.addEventListener('click', function () { st[b.dataset.op] = b.dataset.v; pintar(); }); });
      form.querySelectorAll('[data-alt]').forEach(function (b) { b.addEventListener('click', function () { var m = st[b.dataset.alt] = st[b.dataset.alt] || {}; m[b.dataset.v] = !m[b.dataset.v]; pintar(); }); });
      form.querySelectorAll('[data-accion]').forEach(function (b) { b.addEventListener('click', function () { if (extraAccion) extraAccion(b, form); }); });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var datos;
        try { datos = alGuardar(st); } catch (err) { mostrarError(form, err.message); return; }
        ejecutar(form, form.querySelector('.guardar'), datos);
      });
    };
    var extraAccion = null;
    pintar();
    return { alAccion: function (fn) { extraAccion = fn; }, repintar: function () { pintar(); } };
  }
  function mostrarError(form, msg) { var e = form.querySelector('.reg-err'); e.textContent = msg; e.hidden = false; e.scrollIntoView({ block: 'nearest' }); }

  // Envía la acción; al terminar muestra el resultado en la misma hoja y actualiza el dashboard.
  function ejecutar(cont, btn, datos) {
    if (btn.disabled) return;
    var txt = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spin-mini"></span> Guardando…';
    var img = datos._img; delete datos._img;
    MF.enviar(datos).then(function (r) {
      if (!r.ok) throw new Error(String(r.mensaje || 'No se pudo guardar.').replace(/^❌\s*/, ''));
      if (img) guardarImagen(img.nombre, img.url);   // la imagen se guarda solo si la hoja aceptó el cambio
      var sh = cont.closest('.sheet');
      sh.innerHTML = '<div class="reg-ok"><div class="reg-ok-ico">✓</div><h3>Listo</h3><p>' + esc(r.mensaje || '').replace(/\n/g, '<br>') + '</p>' +
        '<div class="reg-ok-acc"><button class="btn primary" type="button" data-cerrar>Cerrar</button></div></div>';
      MF.refrescar();
    }).catch(function (e) {
      btn.disabled = false; btn.innerHTML = txt;
      var form = cont.closest('form') || cont;
      var err = form.querySelector('.reg-err');
      if (err) { err.textContent = e instanceof TypeError ? 'No pude conectarme. Revisa tu internet e intenta de nuevo.' : e.message; err.hidden = false; }
    });
  }

  function cuentasActivas() {
    var d = MF.datos();
    return (d.cuentasCfg || []).filter(function (c) { return c.activa && !c.mama; });
  }
  function opsCuentas() {
    var act = cuentasActivas();
    return [{ grupo: 'Tu plata' }].concat(act.filter(function (c) { return c.tipo === 'Plata'; }).map(function (c) { return [c.nombre, c.nombre]; }), [{ fin: 1 }, { grupo: 'Tarjetas y créditos' }],
      act.filter(function (c) { return c.tipo === 'Deuda'; }).map(function (c) { return [c.nombre, c.nombre]; }), [{ fin: 1 }]);
  }
  function anual(f) { return f.frecuencia === 'Anual' ? f.valor : f.valor * 12; }
  function textoFrec(f) {
    if (f.frecuencia === 'Mensual') return 'Mensual · día ' + f.dia;
    if (f.frecuencia === 'Anual') return 'Anual' + (f.proximo ? ' · ' + MF.fechaCorta(f.proximo) : '');
    return 'Una vez' + (f.proximo ? ' · ' + MF.fechaCorta(f.proximo) : '');
  }

  /* =================== GASTOS FIJOS Y SUSCRIPCIONES =================== */
  function formFijo(f) {
    var d = MF.datos(), nuevo = !f;
    var st = f ? { nombre: f.nombre, valor: f.valor, frecuencia: f.frecuencia, dia: f.dia, proximo: f.proximo, categoria: f.categoria, cuenta: f.cuenta, cobro: f.cobro, aviso: f.aviso || '' }
      : { frecuencia: 'Mensual', dia: new Date().getDate(), cobro: 'Manual', aviso: '', categoria: 'Suscripciones' };
    hojaFormulario(nuevo ? 'Nuevo gasto fijo' : 'Editar ' + f.nombre, nuevo ? 'Suscripción, servicio o cuota que pagas seguido' : 'Cambia lo que necesites', st, function (st) {
      var h = fTexto(st, 'nombre', 'Nombre', 'Ej: Netflix, arriendo, gimnasio', !nuevo) + fMonto(st, 'valor', 'Valor');
      h += fChips(st, 'frecuencia', '¿Cada cuánto?', [['Mensual', 'Cada mes'], ['Anual', 'Cada año'], ['Una vez', 'Una sola vez']]);
      h += st.frecuencia === 'Mensual' ? fNumero(st, 'dia', 'Día del mes en que se paga', '1 a 31') : fFecha(st, 'proximo', 'Fecha del próximo cobro');
      h += fChips(st, 'cobro', '¿Cómo se paga?', [['Automático', '🔁 Se cobra solo'], ['Manual', '✋ Lo pago yo']],
        st.cobro === 'Automático' ? 'Se registra solo el día del cobro.' : 'Te recuerdo antes y lo marcas como pagado.');
      h += fSelect(st, 'cuenta', st.cobro === 'Automático' ? '¿A qué cuenta o tarjeta se cobra?' : '¿Con qué lo pagas normalmente?', opsCuentas(), 'Elige la cuenta');
      h += fSelect(st, 'categoria', 'Categoría', (d.listaCategorias || []).map(function (c) { return [c.nombre, (c.emoji ? c.emoji + ' ' : '') + c.nombre]; }), 'Elige una');
      h += fChips(st, 'aviso', '¿Es una prueba gratis que piensas cancelar?', [['', 'No'], ['Cancelar', '✂️ Sí, avísame para cancelarla']]);
      return h;
    }, function (st) {
      var nombre = String(st.nombre || '').trim();
      if (!nombre) throw new Error('Escribe el nombre.');
      if (nuevo && (d.fijosCfg || []).some(function (x) { return x.nombre.toLowerCase() === nombre.toLowerCase(); })) throw new Error('Ya tienes un gasto fijo con ese nombre.');
      if (!(st.valor > 0)) throw new Error('Escribe el valor.');
      if (st.frecuencia === 'Mensual' && !(Number(st.dia) >= 1 && Number(st.dia) <= 31)) throw new Error('El día debe estar entre 1 y 31.');
      if (st.frecuencia !== 'Mensual' && !st.proximo) throw new Error('Elige la fecha del próximo cobro.');
      if (!st.cuenta) throw new Error('Elige la cuenta.');
      return { accion: 'fijoadmin', op: 'guardar', nombre: nombre, valor: st.valor, frecuencia: st.frecuencia, dia: st.dia, proximo: st.proximo || '',
        categoria: st.categoria || 'Otros', cuenta: st.cuenta, cobro: st.cobro, aviso: st.aviso };
    });
  }

  // Detalle de un gasto fijo del calendario: pagarlo, cancelarlo o quedarse con él, editarlo o quitarlo.
  function fijo(p) {
    var d = MF.datos();
    var f = (d.fijosCfg || []).find(function (x) { return x.nombre === p.nombre; }) || { nombre: p.nombre, valor: p.monto, frecuencia: p.frecuencia || 'Mensual', dia: 1, cuenta: p.cuenta, cobro: p.cobro || 'Manual' };
    var cuando = p.dias < 0 ? 'venció hace ' + (-p.dias) + ' d' : p.dias === 0 ? 'vence hoy' : p.dias === 1 ? 'vence mañana' : 'vence en ' + p.dias + ' días';
    var acciones = '';
    if (p.estado === 'cancelar') {
      acciones += '<p class="adm-nota">Es una prueba gratis. Si la cancelaste, deja de sumar a tus pagos.</p>' +
        '<button type="button" class="btn adm-btn verde" data-a="cancelada">✂️ La cancelé · ahorras ' + pesos(anual(f)) + ' al año</button>' +
        '<button type="button" class="btn adm-btn" data-a="mantener">👍 Me quedo con ella</button>';
    } else if (p.estado === 'pendiente') {
      acciones += '<button type="button" class="btn adm-btn verde" data-a="pagar">✅ Marcar como pagado</button>';
    } else if (p.estado === 'automatico') {
      acciones += '<p class="adm-nota">Se cobra solo a ' + esc(p.cuenta) + ' y se registra el día del cobro.</p>';
    } else {
      acciones += '<p class="adm-nota">Este cobro ya está registrado.</p>';
    }
    acciones += '<div class="adm-fila"><button type="button" class="btn adm-btn" data-a="editar">✏️ Editar</button>' +
      '<button type="button" class="btn adm-btn rojo" data-a="quitar">🗂️ Quitar</button></div>';
    var html = '<div class="sheet-h"><div class="who">' + MF.logo(p.nombre, true) + '<div><h2>' + esc(p.nombre) + '</h2><div class="kind">' + esc(textoFrec(f)) + ' · ' + (f.cobro === 'Automático' ? 'se cobra solo' : 'pago manual') + '</div></div></div>' +
      '<button class="icon-btn" type="button" data-cerrar aria-label="Cerrar">' + ICON.close + '</button></div>' +
      '<div class="adm-monto"><span class="num">' + pesos(p.monto) + '</span><span>' + MF.fechaCorta(p.fecha) + ' · ' + cuando + '</span></div>' +
      '<div class="adm-acciones">' + acciones + '<div class="reg-err" hidden></div></div>';
    MF.abrirHoja(html, function (h) {
      var cont = h.querySelector('.adm-acciones');
      var confirmar = null;
      cont.querySelectorAll('[data-a]').forEach(function (b) {
        b.addEventListener('click', function () {
          var a = b.dataset.a;
          if (a === 'editar') { formFijo(f); return; }
          if (a === 'pagar') { pagarFijo(p, f); return; }
          if (a === 'quitar' && confirmar !== b) { confirmar = b; b.textContent = '¿Seguro? Toca otra vez para quitarlo'; return; }
          ejecutar(cont, b, { accion: 'fijoadmin', op: a, nombre: p.nombre });
        });
      });
    });
  }

  function pagarFijo(p, f) {
    var hoyS = MF.datos().hoy;
    var st = { monto: p.monto, cuenta: f.cuenta || p.cuenta, fecha: hoyS };
    hojaFormulario('Pagar ' + p.nombre, 'Cobro de ' + MF.fechaCorta(p.fecha), st, function (st) {
      return fMonto(st, 'monto', '¿Cuánto pagaste?') + fSelect(st, 'cuenta', '¿Con qué pagaste?', opsCuentas(), 'Elige la cuenta') + fFecha(st, 'fecha', '¿Cuándo?');
    }, function (st) {
      if (!(st.monto > 0)) throw new Error('Escribe el monto.');
      if (!st.cuenta) throw new Error('Elige la cuenta.');
      return { accion: 'fijo', fijo: p.nombre, periodo: p.periodo || '', monto: st.monto, cuenta: st.cuenta, fecha: st.fecha || hoyS };
    });
  }

  // Lista completa: activos para editar, y quitados/cancelados para reactivar.
  function fijos() {
    var d = MF.datos(), todos = (d.fijosCfg || []).slice();
    var act = todos.filter(function (f) { return f.activo; }), inac = todos.filter(function (f) { return !f.activo; });
    var mensual = act.reduce(function (s, f) { return s + (f.frecuencia === 'Mensual' ? f.valor : f.frecuencia === 'Anual' ? f.valor / 12 : 0); }, 0);
    var ahorro = inac.filter(function (f) { return f.canceladoEl; }).reduce(function (s, f) { return s + anual(f); }, 0);
    var fila = function (f, i, inactivo) {
      return '<div class="adm-item' + (inactivo ? ' off' : '') + '">' + MF.logo(f.nombre, true) + '<div class="adm-info"><b>' + esc(f.nombre) + '</b><span>' + esc(textoFrec(f)) + ' · ' + (f.cobro === 'Automático' ? 'automático' : 'manual') +
        (inactivo ? (f.canceladoEl ? ' · cancelado el ' + MF.fechaCorta(f.canceladoEl) : ' · quitado') : '') + '</span></div>' +
        '<span class="num adm-v">' + pesos(f.valor) + '</span>' +
        (inactivo ? '<button type="button" class="btn-mini" data-re="' + i + '">Reactivar</button>' : '<button type="button" class="btn-mini" data-ed="' + i + '" aria-label="Editar ' + esc(f.nombre) + '">✏️</button>') + '</div>';
    };
    var html = '<div class="sheet-h"><div><h2>Gastos fijos y suscripciones</h2><div class="kind">Pagas ≈ ' + pesos(mensual) + ' al mes' + (ahorro ? ' · ahorras ' + pesos(ahorro) + ' al año por lo que cancelaste' : '') + '</div></div>' +
      '<button class="icon-btn" type="button" data-cerrar aria-label="Cerrar">' + ICON.close + '</button></div>' +
      '<button type="button" class="btn adm-btn verde" data-nuevo>➕ Agregar gasto fijo o suscripción</button>' +
      '<div class="adm-lista">' + act.map(function (f) { return fila(f, todos.indexOf(f), false); }).join('') + '</div>' +
      (inac.length ? '<h3 class="adm-sub">Quitados y cancelados</h3><div class="adm-lista">' + inac.map(function (f) { return fila(f, todos.indexOf(f), true); }).join('') + '</div>' : '') +
      '<div class="reg-err" hidden></div>';
    MF.abrirHoja(html, function (h) {
      h.querySelector('[data-nuevo]').addEventListener('click', function () { formFijo(null); });
      h.querySelectorAll('[data-ed]').forEach(function (b) { b.addEventListener('click', function () { formFijo(todos[+b.dataset.ed]); }); });
      h.querySelectorAll('[data-re]').forEach(function (b) { b.addEventListener('click', function () { ejecutar(h.querySelector('.sheet'), b, { accion: 'fijoadmin', op: 'reactivar', nombre: todos[+b.dataset.re].nombre }); }); });
    });
  }

  /* =================== LÍMITES DE GASTO =================== */
  // Cada límite: nombre, tope mensual y las categorías que cuentan. Una categoría solo cuenta en un límite.
  function limiteDeCategoria(d) {
    var m = {};
    (d.presupuestos || []).forEach(function (b) { (b.categorias || []).forEach(function (c) { m[c] = b.grupo; }); });
    return m;
  }
  function limites() {
    var d = MF.datos(), lista = d.presupuestos || [];
    var emoji = {}; (d.listaCategorias || []).forEach(function (c) { emoji[c.nombre] = c.emoji || ''; });
    var fila = function (b, i) {
      var pct = b.tope > 0 ? Math.round(b.gastado / b.tope * 100) : 0;
      var cls = pct > 100 ? 'crit' : pct >= 80 ? 'warn' : '';
      return '<div class="adm-item lim"><div class="adm-info"><b>' + esc(b.grupo) + '</b>' +
        '<span>' + (b.categorias || []).map(function (c) { return (emoji[c] || '') + ' ' + esc(c); }).join(' · ') + '</span>' +
        '<div class="meter ' + cls + '" role="img" aria-label="' + pct + ' % usado"><i style="width:' + Math.min(100, pct) + '%"></i></div></div>' +
        '<span class="num adm-v">' + pesos(b.tope) + '<small>' + pct + ' % usado</small></span>' +
        '<button type="button" class="btn-mini" data-ed="' + i + '" aria-label="Editar ' + esc(b.grupo) + '">✏️</button></div>';
    };
    var libres = (d.listaCategorias || []).filter(function (c) { return !limiteDeCategoria(d)[c.nombre]; });
    var html = '<div class="sheet-h"><div><h2>Límites de gasto</h2><div class="kind">Un tope al mes para las categorías que elijas</div></div>' +
      '<button class="icon-btn" type="button" data-cerrar aria-label="Cerrar">' + ICON.close + '</button></div>' +
      '<button type="button" class="btn adm-btn verde" data-nuevo>➕ Nuevo límite</button>' +
      '<div class="adm-lista">' + (lista.length ? lista.map(fila).join('') : '<p class="adm-nota">Todavía no tienes límites. Crea uno y elige qué categorías cuentan.</p>') + '</div>' +
      (libres.length && lista.length ? '<p class="adm-nota">Sin límite: ' + libres.map(function (c) { return (c.emoji || '') + ' ' + esc(c.nombre); }).join(' · ') + '</p>' : '');
    MF.abrirHoja(html, function (h) {
      h.querySelector('[data-nuevo]').addEventListener('click', function () { formLimite(null); });
      h.querySelectorAll('[data-ed]').forEach(function (b) { b.addEventListener('click', function () { formLimite(lista[+b.dataset.ed]); }); });
    });
  }
  function formLimite(b) {
    var d = MF.datos(), nuevo = !b, de = limiteDeCategoria(d);
    var cats = {}; if (b) (b.categorias || []).forEach(function (c) { cats[c] = true; });
    var st = { anterior: b ? b.grupo : '', nombre: b ? b.grupo : '', tope: b ? b.tope : NaN, cats: cats };
    var ctl = hojaFormulario(nuevo ? 'Nuevo límite' : 'Editar ' + b.grupo, nuevo ? 'Elige un nombre, el tope del mes y qué categorías cuentan' : 'Cambia el nombre, el tope o las categorías', st, function (st) {
      var h = fTexto(st, 'nombre', 'Nombre del límite', 'Ej: Ocio, Casa, Antojos') + fMonto(st, 'tope', 'Tope mensual', 'Se reinicia solo el primer día de cada mes.');
      var lista = (d.listaCategorias || []).map(function (c) {
        var on = !!st.cats[c.nombre], otro = de[c.nombre] && de[c.nombre] !== st.anterior ? de[c.nombre] : '';
        return '<button type="button" class="op cat-op" data-alt="cats" data-v="' + esc(c.nombre) + '" aria-pressed="' + on + '">' + (c.emoji ? c.emoji + ' ' : '') + esc(c.nombre) +
          (otro ? '<small>' + (on ? 'pasa de "' + esc(otro) + '"' : 'hoy en "' + esc(otro) + '"') + '</small>' : '') + '</button>';
      }).join('');
      var n = Object.keys(st.cats).filter(function (k) { return st.cats[k]; }).length;
      return h + campo('¿Qué categorías cuentan?', '<div class="opciones cat-lista">' + lista + '</div>',
        n ? n + (n === 1 ? ' categoría elegida' : ' categorías elegidas') + '. Una categoría cuenta en un solo límite: si la eliges aquí, sale del otro.' : 'Elige al menos una.');
    }, function (st) {
      var nombre = String(st.nombre || '').trim();
      if (!nombre) throw new Error('Escribe el nombre del límite.');
      if ((d.presupuestos || []).some(function (x) { return x.grupo !== st.anterior && x.grupo.toLowerCase() === nombre.toLowerCase(); })) throw new Error('Ya tienes un límite con ese nombre.');
      if (!(st.tope > 0)) throw new Error('Escribe el tope mensual.');
      var sel = Object.keys(st.cats).filter(function (k) { return st.cats[k]; });
      if (!sel.length) throw new Error('Elige al menos una categoría.');
      return { accion: 'limiteadmin', op: 'guardar', anterior: st.anterior, nombre: nombre, tope: st.tope, categorias: sel.join('|') };
    }, nuevo ? null : function () { return '<button type="button" class="btn adm-btn rojo" data-accion="quitar">🗂️ Quitar este límite</button>'; });
    if (!nuevo) ctl.alAccion(function (btn) {
      if (btn.dataset.accion !== 'quitar') return;
      MF.abrirHoja('<div class="sheet-h"><div><h2>¿Quitar "' + esc(b.grupo) + '"?</h2></div><button class="icon-btn" type="button" data-cerrar aria-label="Cerrar">' + ICON.close + '</button></div>' +
        '<p class="adm-nota">Tus categorías y movimientos no se tocan: solo dejan de contar para este tope.</p>' +
        '<div class="reg-err" hidden></div><button type="button" class="btn adm-btn rojo" data-quitar>Sí, quitar el límite</button><button type="button" class="btn adm-btn" data-cerrar>No, volver</button>', function (h) {
          h.querySelector('[data-quitar]').addEventListener('click', function (e) { ejecutar(h.querySelector('.sheet'), e.currentTarget, { accion: 'limiteadmin', op: 'quitar', nombre: b.grupo }); });
        });
    });
  }

  /* =================== MIS CUENTAS Y CRÉDITOS =================== */
  var COLORES = ['#1D5FD1', '#7A2FD6', '#C3137A', '#D8263C', '#E0572D', '#C8952B', '#1FA35C', '#11A39A', '#0B0B0B', '#5B6B85'];
  function tipoDe(c) { return c.tipo === 'Plata' ? 'plata' : (c.modo === 'Corte mensual' && !c.pideValor) ? 'tarjeta' : 'credito'; }

  /* ---------- imagen de la tarjeta (catálogo de cards.js; se guarda en este dispositivo) ---------- */
  function guardarImagen(nombre, url) {
    var m = {};
    try { m = JSON.parse(MF.leerLocal('imgTarjetas') || '{}') || {}; } catch (e) { m = {}; }
    if (url) m[nombre] = url; else delete m[nombre];
    MF.guardarLocal('imgTarjetas', JSON.stringify(m));
  }
  function campoImagen(st) {
    var cat = window.CATALOGO_TARJETAS || [];
    if (!cat.length) return '';
    var bancos = []; cat.forEach(function (x) { if (bancos.indexOf(x.b) < 0) bancos.push(x.b); });
    var h = '<div class="img-act"><div class="mini">' + (st.imagen ? MF.fotoTarjeta(st.imagen, '') : 'Sin imagen') + '</div>' +
      '<button type="button" class="btn-mini" data-op="pabierto" data-v="' + (st.pabierto ? '' : '1') + '">' + (st.pabierto ? 'Cerrar catálogo' : (st.imagen ? 'Cambiar imagen' : 'Elegir imagen')) + '</button>' +
      (st.imagen ? '<button type="button" class="btn-mini" data-op="imagen" data-v="">Quitar</button>' : '') + '</div>';
    if (st.pabierto) {
      if (!st.pbanco) st.pbanco = bancos[0];
      h += '<div class="img-pick">' + fSelect(st, 'pbanco', 'Banco', bancos.map(function (b) { return [b, b]; }));
      var lista = cat.filter(function (x) { return x.b === st.pbanco; });
      h += '<div class="img-grid">' + lista.map(function (x) {
        return '<button type="button" data-op="imagen" data-v="' + esc(x.u) + '" aria-pressed="' + (st.imagen === x.u) + '"><span class="mini-ft">' + MF.fotoTarjeta(x.u, '') + '</span><span>' + esc(x.n) + (x.k === 'D' ? ' · débito' : '') + '</span></button>';
      }).join('') + '</div></div>';
    }
    return campo('Imagen de la tarjeta (opcional)', h, 'Se ve solo en este dispositivo. Si la imagen no carga, se muestra la tarjeta dibujada de siempre.');
  }
  function formCuenta(c) {
    var nuevo = !c;
    var st = c ? { tipo: tipoDe(c), nombre: c.nombre, color: c.color, cupo: c.cupo, tasa: c.tasa ? String(Math.round(c.tasa * 10000) / 100).replace('.', ',') : '',
      diaCorte: c.diaCorte, diaPago: c.diaPago, mesPago: c.mesPago || 'Siguiente', maxCuotas: c.maxCuotas, interesDesde1: c.interesDesde1 ? 'si' : 'no',
      unaSinInteres: c.unaSinInteres ? 'si' : 'no', modo: c.modo === 'Por compra' ? 'Por compra' : 'Corte mensual', imagen: MF.imgTarjeta(c.nombre) }
      : { tipo: 'plata', color: COLORES[0], mesPago: 'Siguiente', maxCuotas: 36, interesDesde1: 'no', unaSinInteres: 'no', modo: 'Corte mensual' };
    var ctrl = hojaFormulario(nuevo ? 'Nueva cuenta o crédito' : c.nombre, nuevo ? 'Se agrega a tu billetera y al botón Registrar' : 'Cambia sus datos; para el saldo usa "Ajustar saldo"', st, function (st) {
      var h = '';
      if (nuevo) h += fChips(st, 'tipo', '¿Qué es?', [['plata', '💵 Cuenta de plata'], ['tarjeta', '💳 Tarjeta de crédito'], ['credito', '🧾 Crédito de compras']]);
      h += fTexto(st, 'nombre', 'Nombre', st.tipo === 'plata' ? 'Ej: Bancolombia ahorros' : st.tipo === 'tarjeta' ? 'Ej: TC Bancolombia Amex' : 'Ej: Sistecrédito', !nuevo);
      if (nuevo) h += fMonto(st, 'saldo', st.tipo === 'plata' ? '¿Cuánto tiene hoy?' : '¿Cuánto debes hoy?', st.tipo === 'plata' ? '' : 'Si está en cero, déjalo vacío.');
      if (st.tipo === 'tarjeta') {
        h += fMonto(st, 'cupo', 'Cupo total');
        h += fNumero(st, 'tasa', 'Tasa de interés mensual (%)', 'Ej: 2,13', 'La encuentras en tu extracto como "tasa mes vencido".');
        h += '<div class="adm-2">' + fNumero(st, 'diaCorte', 'Día de corte', '1 a 31') + fNumero(st, 'diaPago', 'Día límite de pago', '1 a 31') + '</div>';
        h += fChips(st, 'mesPago', 'El pago cae', [['Siguiente', 'El mes siguiente al corte'], ['Mismo', 'El mismo mes del corte']]);
        h += fChips(st, 'interesDesde1', '¿Cobra intereses desde la primera cuota?', [['si', 'Sí (como Davibank)'], ['no', 'No, la primera sin interés (como Nubank)']]);
        h += fNumero(st, 'maxCuotas', 'Máximo de cuotas', '36');
      } else if (st.tipo === 'credito') {
        h += fChips(st, 'modo', '¿Cómo se pagan las cuotas?', [['Corte mensual', 'Un día fijo cada mes (como Addi)'], ['Por compra', 'Cada mes desde la compra (como Credifin)']]);
        if (st.modo === 'Corte mensual') h += '<div class="adm-2">' + fNumero(st, 'diaCorte', 'Día de corte', '1 a 31') + fNumero(st, 'diaPago', 'Día de pago', '1 a 31') + '</div>';
        h += fMonto(st, 'cupo', 'Cupo (opcional)');
        h += fNumero(st, 'maxCuotas', 'Máximo de cuotas', '24', 'Al registrar una compra te pediré el valor de cada cuota que te muestra la app del crédito.');
      }
      h += campoImagen(st);
      h += campo('Color', '<div class="opciones">' + COLORES.map(function (col) {
        return '<button type="button" class="op swatch" data-op="color" data-v="' + col + '" aria-pressed="' + (String(st.color).toUpperCase() === col) + '" aria-label="Color ' + col + '" style="--sw:' + col + '"></button>';
      }).join('') + '</div>');
      return h;
    }, function (st) {
      var nombre = String(st.nombre || '').trim();
      if (!nombre) throw new Error('Escribe el nombre.');
      var d = MF.datos();
      if (nuevo && (d.cuentasCfg || []).some(function (x) { return x.nombre.toLowerCase() === nombre.toLowerCase(); })) throw new Error('Ya tienes una cuenta con ese nombre (revisa también las archivadas).');
      var datos = { accion: 'cuentaadmin', op: 'guardar', nombre: nombre, tipo: st.tipo === 'plata' ? 'Plata' : 'Deuda', color: st.color, saldo: st.saldo > 0 ? st.saldo : 0 };
      if (st.tipo !== 'plata') {
        // "Tabla" (fechas de corte del banco) y "Último" se respetan tal cual.
        var dia = function (x, q) { if (/^(tabla|[uú]ltimo)$/i.test(String(x || '').trim())) return String(x).trim(); var n = parseInt(x, 10); if (!(n >= 1 && n <= 31)) throw new Error('Escribe el ' + q + ' (1 a 31).'); return n; };
        datos.cupo = st.cupo > 0 ? st.cupo : 0;
        datos.maxCuotas = parseInt(st.maxCuotas, 10) || (st.tipo === 'tarjeta' ? 36 : 24);
        datos.tasa = String(st.tasa || '0').replace(',', '.');
        if (st.tipo === 'tarjeta') {
          if (!(Number(datos.tasa) > 0)) throw new Error('Escribe la tasa mensual de la tarjeta.');
          datos.modo = 'Corte mensual'; datos.pideValor = 'no';
          datos.diaCorte = dia(st.diaCorte, 'día de corte'); datos.diaPago = dia(st.diaPago, 'día de pago'); datos.mesPago = st.mesPago;
          datos.interesDesde1 = st.interesDesde1; datos.unaSinInteres = st.unaSinInteres;
        } else {
          datos.modo = st.modo; datos.pideValor = 'si';
          if (st.modo === 'Corte mensual') { datos.diaCorte = dia(st.diaCorte, 'día de corte'); datos.diaPago = dia(st.diaPago, 'día de pago'); datos.mesPago = 'Siguiente'; }
        }
      }
      datos._img = { nombre: nombre, url: st.imagen || '' };
      datos.imagen = st.imagen || '';   // también en tu hoja, para verla en todos tus dispositivos
      return datos;
    }, function (st) {
      if (nuevo) return '';
      return '<button type="button" class="btn adm-btn rojo" data-accion="archivar">🗂️ Archivar ' + esc(c.nombre) + '</button>';
    });
    var confirmar = false;
    ctrl.alAccion(function (b, form) {
      if (!confirmar) { confirmar = true; b.textContent = '¿Seguro? Toca otra vez para archivarla'; return; }
      ejecutar(form, b, { accion: 'cuentaadmin', op: 'archivar', nombre: c.nombre });
    });
  }

  function cuentas() {
    var d = MF.datos(), todas = (d.cuentasCfg || []).filter(function (c) { return !c.mama; });
    var grupo = function (titulo, lista, off) {
      if (!lista.length) return '';
      return '<h3 class="adm-sub">' + titulo + '</h3><div class="adm-lista">' + lista.map(function (c) {
        var i = todas.indexOf(c), t = tipoDe(c);
        var sub = t === 'plata' ? 'Cuenta de plata' : t === 'tarjeta' ? 'Tarjeta de crédito · ' + (c.tasa ? String(Math.round(c.tasa * 10000) / 100).replace('.', ',') + ' % mes' : 'sin tasa') : 'Crédito de compras';
        return '<div class="adm-item' + (off ? ' off' : '') + '">' + MF.logo(c.nombre, false) + '<div class="adm-info"><b>' + esc(c.nombre) + '</b><span>' + esc(sub) + '</span></div>' +
          '<span class="num adm-v">' + pesos(c.saldo) + '</span>' +
          (off ? '<button type="button" class="btn-mini" data-re="' + i + '">Reactivar</button>' : '<button type="button" class="btn-mini" data-ed="' + i + '" aria-label="Editar ' + esc(c.nombre) + '">✏️</button>') + '</div>';
      }).join('') + '</div>';
    };
    var act = todas.filter(function (c) { return c.activa; }), inac = todas.filter(function (c) { return !c.activa; });
    var html = '<div class="sheet-h"><div><h2>Mis cuentas y créditos</h2><div class="kind">Agrega, edita o archiva tus productos</div></div>' +
      '<button class="icon-btn" type="button" data-cerrar aria-label="Cerrar">' + ICON.close + '</button></div>' +
      '<button type="button" class="btn adm-btn verde" data-nuevo>➕ Agregar cuenta, tarjeta o crédito</button>' +
      grupo('Tu plata', act.filter(function (c) { return c.tipo === 'Plata'; })) +
      grupo('Tarjetas y créditos', act.filter(function (c) { return c.tipo === 'Deuda'; })) +
      grupo('Archivadas', inac, true) +
      '<p class="adm-nota">Archivar oculta el producto de la app pero conserva su historial. Para archivar, su saldo debe estar en $0.</p><div class="reg-err" hidden></div>';
    MF.abrirHoja(html, function (h) {
      h.querySelector('[data-nuevo]').addEventListener('click', function () { formCuenta(null); });
      h.querySelectorAll('[data-ed]').forEach(function (b) { b.addEventListener('click', function () { formCuenta(todas[+b.dataset.ed]); }); });
      h.querySelectorAll('[data-re]').forEach(function (b) { b.addEventListener('click', function () { ejecutar(h.querySelector('.sheet'), b, { accion: 'cuentaadmin', op: 'reactivar', nombre: todas[+b.dataset.re].nombre }); }); });
    });
  }

  /* =================== CORREGIR UN MOVIMIENTO =================== */
  function hoyISO() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function opsConActual(actual) {
    var ops = opsCuentas();
    var hay = ops.some(function (o) { return o[0] === actual; });
    return actual && !hay ? ops.concat([[actual, actual]]) : ops;
  }
  // "Para quién": '' (mío) · 'Ana' (todo para ella) · 'Ana:30000; Leo:20000' (compartido; el resto es tuyo).
  function leerPara(txt) {
    txt = String(txt || '').trim();
    if (!txt) return { modo: 'mio', uno: '', filas: [] };
    if (txt.indexOf(':') < 0) return { modo: 'uno', uno: txt, filas: [] };
    var filas = txt.split(';').map(function (s) { var x = s.split(':'); return { p: String(x[0]).trim(), v: aNum(x[1]) }; }).filter(function (x) { return x.p; });
    return { modo: 'compartido', uno: '', filas: filas };
  }
  function nombresConocidos() {
    var d = MF.datos(), n = {};
    (d.meDeben || []).forEach(function (x) { n[x.persona] = 1; });
    (d.lesDebo || []).forEach(function (x) { n[x.persona] = 1; });
    (d.movimientos || []).forEach(function (m) { if (m.persona) n[m.persona] = 1; if (m.para) n[m.para] = 1; });
    return Object.keys(n);
  }
  function fPersona(st, k, label, ph) {
    return campo(label, '<input class="in" data-k="' + k + '" list="dl-personas" type="text" autocomplete="off" placeholder="' + esc(ph || 'Nombre') + '" value="' + esc(st[k] || '') + '">' +
      '<datalist id="dl-personas">' + nombresConocidos().map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>');
  }
  function paraDeEstado(st) {
    if (st.paraModo === 'mio') return '';
    if (st.paraModo === 'uno') { var u = String(st.paraUno || '').trim(); if (!u) throw new Error('Escribe para quién fue el gasto.'); return u; }
    var partes = [], suma = 0, n = Number(st.paraN) || 2;
    for (var i = 0; i < n; i++) {
      var p = String(st['pp' + i] || '').trim(), v = st['pv' + i];
      if (!p && !(v > 0)) continue;
      if (!p) throw new Error('Falta el nombre de una de las personas.');
      if (!(v > 0)) throw new Error('Escribe cuánto le toca a ' + p + '.');
      partes.push(p + ':' + v); suma += v;
    }
    if (!partes.length) throw new Error('Agrega al menos una persona o elige "Para mí".');
    if (suma > st.monto) throw new Error('Lo que repartes (' + pesos(suma) + ') supera el monto del gasto (' + pesos(st.monto) + ').');
    return partes.join('; ');
  }
  function bloquePara(st) {
    var h = fChips(st, 'paraModo', '¿Para quién fue?', [['mio', '🙋 Para mí'], ['uno', '👤 Para otra persona'], ['compartido', '👥 Compartido']]);
    if (st.paraModo === 'uno') h += fPersona(st, 'paraUno', '¿Para quién?');
    if (st.paraModo === 'compartido') {
      var n = Number(st.paraN) || 2, suma = 0;
      for (var i = 0; i < n; i++) {
        suma += st['pv' + i] > 0 ? st['pv' + i] : 0;
        h += '<div class="fila-2">' + fPersona(st, 'pp' + i, i ? 'Persona ' + (i + 1) : 'Persona 1') + fMonto(st, 'pv' + i, 'Le toca') + '</div>';
      }
      h += fChips(st, 'paraN', '', [[String(n + 1), '➕ Agregar otra persona']], 'Te quedan a ti ' + pesos(Math.max(0, (st.monto || 0) - suma)) + '. Lo que no repartas es tuyo.');
    }
    return h;
  }

  function movimiento(id) {
    var d = MF.datos();
    var m = (d.movimientos || []).find(function (x) { return x.id === id; });
    if (!m) return;
    if (m.hist || m.tipo === 'Ajuste') {
      MF.abrirHoja('<div class="sheet-h"><div><h2>' + esc(m.desc) + '</h2><div class="kind">' + esc(m.tipo) + ' · ' + pesos(m.monto) + '</div></div>' +
        '<button class="icon-btn" type="button" data-cerrar aria-label="Cerrar">' + ICON.close + '</button></div>' +
        '<p class="adm-nota">' + (m.hist ? 'Viene de un extracto y prevalece: ya está incluido en el saldo inicial, así que no se edita ni se elimina.' : 'Un ajuste de saldo no se edita. Si quedó mal, puedes eliminarlo y volver a usar "Ajustar saldo".') + '</p>' +
        (m.hist ? '' : '<button type="button" class="btn adm-btn rojo" data-eliminar>🗑️ Eliminar este ajuste</button>'), function (h) {
          var b = h.querySelector('[data-eliminar]'); if (b) b.addEventListener('click', function () { eliminarMov(m); });
        });
      return;
    }
    var esGasto = m.tipo === 'Gasto', esIng = m.tipo === 'Ingreso', esTr = m.tipo === 'Transferencia';
    var conCuotas = esGasto && m.cuotas > 0;
    var para0 = leerPara(m.paraRaw);
    var orig = { fecha: m.fecha, desc: m.desc, monto: m.monto, cat: m.cat, cuenta: m.cuenta, destino: m.destino || '', cuotas: m.cuotas || '', valorCuota: m.valorCuota || '', para: String(m.paraRaw || '').trim() };
    var st = { fecha: orig.fecha, desc: orig.desc, monto: orig.monto, cat: orig.cat, cuenta: orig.cuenta, destino: orig.destino, cuotas: orig.cuotas, valorCuota: orig.valorCuota,
      paraModo: para0.modo, paraUno: para0.uno, paraN: String(Math.max(2, para0.filas.length)) };
    para0.filas.forEach(function (f, i) { st['pp' + i] = f.p; st['pv' + i] = f.v; });
    var formulario = hojaFormulario('Corregir movimiento', esc(m.tipo) + ' · lo que cambies se actualiza en tu hoja y en tus saldos', st, function (st) {
      var h = campo('Fecha', '<input class="in" data-k="fecha" type="date" max="' + hoyISO() + '" value="' + esc(st.fecha) + '">');
      h += fTexto(st, 'desc', 'Descripción', '');
      h += fMonto(st, 'monto', 'Monto');
      if (esGasto) h += fSelect(st, 'cat', 'Categoría', (d.listaCategorias || []).map(function (c) { return [c.nombre, (c.emoji ? c.emoji + ' ' : '') + c.nombre]; }).concat((d.listaCategorias || []).some(function (c) { return c.nombre === orig.cat; }) ? [] : [[orig.cat, orig.cat]]));
      if (esIng) h += fSelect(st, 'cat', 'Tipo de ingreso', (d.tiposIngreso || []).map(function (c) { return [c.nombre, (c.emoji ? c.emoji + ' ' : '') + c.nombre]; }).concat((d.tiposIngreso || []).some(function (c) { return c.nombre === orig.cat; }) ? [] : [[orig.cat, orig.cat]]));
      if (orig.cuenta || !esTr) h += fSelect(st, 'cuenta', esTr ? 'Sale de' : 'Cuenta', opsConActual(orig.cuenta));
      if (esTr) h += fSelect(st, 'destino', 'Llega a', opsConActual(orig.destino));
      if (conCuotas) {
        h += fNumero(st, 'cuotas', 'Número de cuotas', '1');
        h += fMonto(st, 'valorCuota', 'Valor de la cuota', 'Si cambias el monto o las cuotas y dejas este valor igual, se recalcula solo.');
      }
      if (esGasto) h += bloquePara(st);
      return h;
    }, function (st) {
      var datos = { accion: 'editarmov', id: id };
      var desc = String(st.desc || '').trim();
      if (!desc) throw new Error('Escribe la descripción.');
      if (!(st.monto > 0)) throw new Error('Escribe el monto.');
      if (!st.fecha) throw new Error('Elige la fecha.');
      if (st.fecha !== orig.fecha) datos.fecha = st.fecha;
      if (desc !== orig.desc) datos.descripcion = desc;
      if (st.monto !== orig.monto) datos.monto = st.monto;
      if ((esGasto || esIng) && st.cat !== orig.cat) datos.categoria = st.cat;
      if (st.cuenta !== orig.cuenta) datos.cuenta = st.cuenta;
      if (esTr && st.destino !== orig.destino) datos.destino = st.destino;
      if (esTr && (st.cuenta || orig.cuenta) && (st.destino || orig.destino) && (st.cuenta || orig.cuenta) === (st.destino || orig.destino)) throw new Error('El origen y el destino no pueden ser la misma cuenta.');
      if (conCuotas) {
        var n = parseInt(st.cuotas, 10);
        if (!(n >= 1)) throw new Error('Escribe cuántas cuotas.');
        if (n !== Number(orig.cuotas)) datos.cuotas = n;
        if (st.valorCuota !== orig.valorCuota) datos.valorCuota = st.valorCuota;
      }
      if (esGasto) { var para = paraDeEstado(st); if (para !== orig.para) datos.para = para; }
      if (Object.keys(datos).length === 2) throw new Error('No cambiaste nada.');
      return datos;
    }, function () { return '<button type="button" class="btn adm-btn rojo" data-accion="eliminar">🗑️ Eliminar</button>'; });
    formulario.alAccion(function (b) { if (b.dataset.accion === 'eliminar') eliminarMov(m); });
  }

  /* =================== ELIMINAR UN MOVIMIENTO (vista previa → ELIMINAR → deshacer) =================== */
  function eliminarMov(m) {
    function cuerpoSimple(titulo, html) {
      return '<div class="sheet-h"><div><h2>' + esc(titulo) + '</h2></div><button class="icon-btn" type="button" data-cerrar aria-label="Cerrar">' + ICON.close + '</button></div>' + html;
    }
    MF.abrirHoja(cuerpoSimple('Eliminar movimiento', '<div class="state"><div class="spinner"></div>Calculando qué cambiaría…</div>'));
    MF.enviar({ accion: 'previsualizarborrado', id: m.id }).then(function (r) {
      if (!r.ok) throw new Error(String(r.mensaje || '').replace(/^❌\s*/, ''));
      var x = r.extra || {};
      var lista = (x.movimientos || []).map(function (f) { return '<div class="deb-t"><span>' + MF.fechaCorta(f.fecha) + ' · ' + esc(f.desc) + (f.cuenta ? ' · ' + esc(f.cuenta) : '') + '</span><b class="num">' + pesos(f.monto) + '</b></div>'; }).join('');
      var efectos = (x.efectos || []).map(function (e) { return '<div class="deb-t"><span>' + esc(e.cuenta) + '</span><b class="num">' + pesos(e.antes) + ' → ' + pesos(e.despues) + '</b></div>'; }).join('');
      var pers = (x.personas || []).map(function (e) { return '<div class="deb-t"><span>' + esc(e.persona) + (e.despues < e.antes ? ' · te debe menos' : e.despues > e.antes ? ' · te debe más' : '') + '</span><b class="num">' + pesos(e.antes) + ' → ' + pesos(e.despues) + '</b></div>'; }).join('');
      var avisos = (x.avisos || []).map(function (a) { return '<p class="adm-nota">⚠️ ' + esc(a) + '</p>'; }).join('');
      var html = '<p class="adm-nota">Se eliminará' + ((x.movimientos || []).length > 1 ? 'n estos ' + x.movimientos.length + ' movimientos, que nacieron del mismo registro' : ' este movimiento') + ':</p><div class="deb">' + lista + '</div>' +
        (efectos ? '<h3 class="adm-sub">Cómo quedan tus saldos</h3><div class="deb">' + efectos + '</div>' : '') +
        (pers ? '<h3 class="adm-sub">Personas</h3><div class="deb">' + pers + '</div>' : '') + avisos +
        '<p class="adm-nota">No se pierde: queda guardado en la pestaña "Eliminados" de tu hoja y podrás deshacerlo.</p>' +
        '<div class="reg-err" hidden></div><button type="button" class="btn adm-btn rojo" data-sigue>🗑️ Continuar</button>';
      MF.abrirHoja(cuerpoSimple('Eliminar movimiento', html), function (h) {
        h.querySelector('[data-sigue]').addEventListener('click', function () { confirmar(m, x, cuerpoSimple); });
      });
    }).catch(function (e) {
      MF.abrirHoja(cuerpoSimple('Eliminar movimiento', '<p class="adm-nota">' + esc(e instanceof TypeError ? 'No pude conectarme. Revisa tu internet.' : e.message) + '</p>'));
    });
  }
  function confirmar(m, x, cuerpoSimple) {
    var html = '<p class="adm-nota">Última confirmación. Para eliminar <b>' + esc(m.desc) + '</b> escribe <b>ELIMINAR</b>:</p>' +
      '<input class="in" data-palabra type="text" autocomplete="off" autocapitalize="characters" placeholder="ELIMINAR">' +
      '<div class="reg-err" hidden></div><button type="button" class="btn adm-btn rojo" data-borrar disabled>🗑️ Eliminar definitivamente</button>';
    MF.abrirHoja(cuerpoSimple('Confirmar eliminación', html), function (h) {
      var inp = h.querySelector('[data-palabra]'), btn = h.querySelector('[data-borrar]'), err = h.querySelector('.reg-err');
      inp.addEventListener('input', function () { btn.disabled = inp.value.trim() !== 'ELIMINAR'; });
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        btn.disabled = true; btn.textContent = 'Eliminando…';
        MF.enviar({ accion: 'borrarmov', id: m.id, confirmo: inp.value.trim() }).then(function (r) {
          if (!r.ok) throw new Error(String(r.mensaje || '').replace(/^❌\s*/, ''));
          MF.refrescar();
          var e = r.extra || {};
          var acc = '<div class="reg-ok-acc">' + (e.mover ? '<button class="btn" type="button" data-mover>🔁 Mover ' + pesos(e.mover.monto) + ' de ' + esc(e.mover.desde) + ' a ' + esc(e.mover.hacia) + '</button>' : '') +
            '<button class="btn" type="button" data-deshacer>↩️ Deshacer</button><button class="btn primary" type="button" data-cerrar>Listo</button></div>';
          MF.abrirHoja('<div class="reg-ok"><div class="reg-ok-ico">✓</div><h3>Eliminado</h3><p>' + esc(r.mensaje || '').replace(/\n/g, '<br>') + '</p>' + acc + '</div>', function (h2) {
            var mv = h2.querySelector('[data-mover]');
            if (mv) mv.addEventListener('click', function () { MF.cerrarHoja(); if (MF.registrarCon) MF.registrarCon('mover', { desde: e.mover.desde, hacia: e.mover.hacia, monto: e.mover.monto }); });
            h2.querySelector('[data-deshacer]').addEventListener('click', function (ev) {
              var b = ev.currentTarget; b.disabled = true; b.textContent = 'Restaurando…';
              MF.enviar({ accion: 'restaurarmov', lote: e.lote }).then(function (r2) {
                if (!r2.ok) throw new Error(String(r2.mensaje || '').replace(/^❌\s*/, ''));
                MF.refrescar(); b.textContent = '✓ ' + String(r2.mensaje || 'Restaurado').split('\n')[0]; b.classList.add('primary');
              }).catch(function (er) { b.disabled = false; b.textContent = '↩️ Deshacer'; err2(h2, er); });
            });
          });
        }).catch(function (er) { btn.disabled = inp.value.trim() !== 'ELIMINAR'; btn.textContent = '🗑️ Eliminar definitivamente'; err.textContent = er instanceof TypeError ? 'No pude conectarme. Revisa tu internet.' : er.message; err.hidden = false; });
      });
    });
  }
  function err2(h, er) { var p = document.createElement('p'); p.className = 'adm-nota'; p.textContent = er.message; h.appendChild(p); }

  /* =================== METAS DE AHORRO =================== */
  // Cada meta va ligada a un bolsillo (una cuenta de plata): lo que hay en él es lo que llevas. Aportar = mover plata hacia ese bolsillo.
  var FOTO_MAX = 42000;   // la foto viaja y se guarda como texto en una celda (límite 50.000 caracteres)
  // Reduce la foto (cámara o galería) a un JPEG pequeño que quepa en la hoja.
  function reducirFoto(archivo) {
    return new Promise(function (ok, mal) {
      var url = URL.createObjectURL(archivo), img = new Image();
      img.onload = function () {
        try {
          var lado = 420, w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) throw new Error('vacía');
          for (var intento = 0; intento < 6; intento++) {
            var f = Math.min(1, lado / Math.max(w, h)), cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(w * f)); cv.height = Math.max(1, Math.round(h * f));
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            for (var q = 0.72; q >= 0.34; q -= 0.1) {
              var data = cv.toDataURL('image/jpeg', q);
              if (data.length <= FOTO_MAX) { URL.revokeObjectURL(url); ok(data); return; }
            }
            lado = Math.round(lado * 0.8);
          }
          throw new Error('pesada');
        } catch (e) { URL.revokeObjectURL(url); mal(new Error('No pude preparar esa foto. Prueba con otra.')); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('No pude abrir esa foto. Prueba con otra.')); };
      img.src = url;
    });
  }
  function elegirFoto(camara) {
    return new Promise(function (ok, mal) {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; if (camara) inp.setAttribute('capture', 'environment');
      inp.style.display = 'none'; document.body.appendChild(inp);
      inp.addEventListener('cancel', function () { inp.remove(); ok(null); });
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0]; inp.remove();
        if (!f) { ok(null); return; }
        reducirFoto(f).then(ok, mal);
      });
      inp.click();
    });
  }
  function metas() {
    var d = MF.datos(), lista = d.metas || [];
    var fila = function (m, i) {
      var cls = m.lograda ? 'ok' : m.vencida ? 'crit' : '';
      return '<div class="adm-item meta-item"><div class="meta-foto">' + MF.fotoMeta(m) + '</div><div class="adm-info"><b>' + esc(m.nombre) + '</b>' +
        '<span>' + esc(MF.detalleMeta(m)) + '</span>' +
        '<div class="meter ' + cls + '" role="img" aria-label="' + m.pct + ' % de la meta"><i style="width:' + m.pct + '%"></i></div></div>' +
        '<span class="num adm-v">' + pesos(m.ahorrado) + '<small>de ' + pesos(m.objetivo) + '</small></span>' +
        '<div class="meta-acc">' + (m.lograda ? '' : '<button type="button" class="btn-mini" data-ap="' + i + '">➕ Aportar</button>') +
        '<button type="button" class="btn-mini" data-ed="' + i + '" aria-label="Editar ' + esc(m.nombre) + '">✏️</button></div></div>';
    };
    var html = '<div class="sheet-h"><div><h2>Metas de ahorro</h2><div class="kind">Cada meta vive en un bolsillo: lo que hay en él es lo que llevas</div></div>' +
      '<button class="icon-btn" type="button" data-cerrar aria-label="Cerrar">' + ICON.close + '</button></div>' +
      '<button type="button" class="btn adm-btn verde" data-nuevo>➕ Nueva meta</button>' +
      '<div class="adm-lista">' + (lista.length ? lista.map(fila).join('') : '<p class="adm-nota">Todavía no tienes metas. Crea una, ponle foto y elige el bolsillo donde la vas a guardar.</p>') + '</div>';
    MF.abrirHoja(html, function (h) {
      h.querySelector('[data-nuevo]').addEventListener('click', function () { formMeta(null); });
      h.querySelectorAll('[data-ed]').forEach(function (b) { b.addEventListener('click', function () { formMeta(lista[+b.dataset.ed]); }); });
      h.querySelectorAll('[data-ap]').forEach(function (b) {
        b.addEventListener('click', function () {
          var m = lista[+b.dataset.ap];
          MF.cerrarHoja();
          // Espera a que termine de cerrarse esta hoja; si no, abrir el registro en el mismo instante lo arrastra.
          setTimeout(function () { if (MF.registrarCon) MF.registrarCon('mover', { hacia: m.cuenta }); }, 320);
        });
      });
    });
  }
  function formMeta(m) {
    var d = MF.datos(), nuevo = !m;
    var ocupadas = {}; (d.metas || []).forEach(function (x) { if (!m || x.nombre !== m.nombre) ocupadas[x.cuenta] = 1; });
    var libres = (d.cuentasCfg || []).filter(function (c) { return c.tipo === 'Plata' && c.activa && !c.mama && !ocupadas[c.nombre] && !/^Bolsillo para /.test(c.nombre) && !c.apartaPara; });
    var st = { anterior: m ? m.nombre : '', nombre: m ? m.nombre : '', emoji: m ? m.emoji : '🎯', objetivo: m ? m.objetivo : NaN, fecha: m ? m.fecha : '',
      cuentaModo: m ? 'existente' : 'nueva', cuenta: m ? m.cuenta : '', cuentaNueva: '', principal: '', foto: m ? m.foto : '', fotoCambio: false, errorFoto: '' };
    var ctl = hojaFormulario(nuevo ? 'Nueva meta' : 'Editar ' + m.nombre, nuevo ? 'Ponle nombre, cuánto quieres juntar y dónde la guardas' : 'Cambia lo que necesites', st, function (st) {
      var h = '<div class="campo"><label>Foto de tu meta (opcional)</label><div class="meta-foto-sel"><div class="meta-foto grande">' +
        MF.fotoMeta({ foto: st.foto, emoji: st.emoji }) + '</div><div class="meta-foto-bt">' +
        '<button type="button" class="btn-mini" data-accion="camara">📷 Tomar foto</button>' +
        '<button type="button" class="btn-mini" data-accion="galeria">🖼️ Elegir de la galería</button>' +
        (st.foto ? '<button type="button" class="btn-mini" data-accion="sinfoto">Quitar foto</button>' : '') + '</div></div>' +
        (st.errorFoto ? '<p class="nota" style="color:var(--crit)">' + esc(st.errorFoto) + '</p>' : '<p class="nota">Se reduce y se guarda en tu hoja, así la ves en todos tus dispositivos.</p>') + '</div>';
      h += fTexto(st, 'nombre', 'Nombre de la meta', 'Ej: Viaje a Cartagena, Moto, Colchón');
      h += campo('Emoji (se ve si no hay foto)', '<input class="in" data-k="emoji" type="text" maxlength="4" autocomplete="off" value="' + esc(st.emoji) + '">');
      h += fMonto(st, 'objetivo', '¿Cuánto quieres juntar?');
      h += fFecha(st, 'fecha', '¿Para cuándo? (opcional)');
      var ops = [['nueva', '🆕 Crear un bolsillo nuevo']];
      if (libres.length) ops.push(['existente', '🏦 Usar una cuenta que ya tengo']);
      h += fChips(st, 'cuentaModo', '¿Dónde la guardas?', ops, 'Lo que haya en esa cuenta cuenta como ahorrado. Para ahorrar, mueves plata hacia ella.');
      if (st.cuentaModo === 'nueva') {
        var madres = (d.cuentasCfg || []).filter(function (c) { return c.tipo === 'Plata' && c.activa && !c.mama && !c.apartaPara && !/^Bolsillo /.test(c.nombre); });
        h += fTexto(st, 'cuentaNueva', 'Nombre del bolsillo', st.nombre ? 'Bolsillo ' + st.nombre : 'Ej: Bolsillo Viaje');
        h += fSelect(st, 'principal', '¿De qué cuenta nace el bolsillo?', madres.map(function (c) { return [c.nombre, c.emoji + ' ' + c.nombre]; }), 'Elige la cuenta');
        h += '<p class="nota">Si algún día quitas la meta, la plata del bolsillo vuelve a esa cuenta.</p>';
      }
      else h += fSelect(st, 'cuenta', 'Cuenta', libres.concat(m ? (d.cuentasCfg || []).filter(function (c) { return c.nombre === m.cuenta; }) : []).filter(function (c, i, a) { return a.indexOf(c) === i; }).map(function (c) { return [c.nombre, c.emoji + ' ' + c.nombre]; }), 'Elige la cuenta');
      return h;
    }, function (st) {
      var nombre = String(st.nombre || '').trim();
      if (!nombre) throw new Error('Escribe el nombre de la meta.');
      if (!(st.objetivo > 0)) throw new Error('Escribe cuánto quieres juntar.');
      var dato = { accion: 'metaadmin', op: 'guardar', anterior: st.anterior, nombre: nombre, emoji: String(st.emoji || '').trim() || '🎯', objetivo: st.objetivo, fecha: st.fecha || '' };
      if (st.cuentaModo === 'nueva') {
        if (!st.principal) throw new Error('Elige la cuenta de la que nace el bolsillo.');
        dato.cuentaNueva = String(st.cuentaNueva || '').trim() || 'Bolsillo ' + nombre;
        dato.principal = st.principal;
      } else {
        if (!st.cuenta) throw new Error('Elige la cuenta donde guardas la meta.');
        dato.cuenta = st.cuenta;
      }
      if (nuevo || st.fotoCambio) dato.foto = st.foto || '';
      return dato;
    }, nuevo ? null : function () { return '<button type="button" class="btn adm-btn rojo" data-accion="quitar">🗂️ Quitar esta meta</button>'; });
    var pintarFoto = function (cual, btn) {
      elegirFoto(cual === 'camara').then(function (f) {
        if (f) { st.foto = f; st.fotoCambio = true; st.errorFoto = ''; }
      }).catch(function (e) { st.errorFoto = e.message; }).then(function () { ctl.repintar(); });
    };
    ctl.alAccion(function (btn) {
      var a = btn.dataset.accion;
      if (a === 'camara' || a === 'galeria') { pintarFoto(a, btn); return; }
      if (a === 'sinfoto') { st.foto = ''; st.fotoCambio = true; ctl.repintar(); return; }
      if (a !== 'quitar' || nuevo) return;
      MF.abrirHoja('<div class="sheet-h"><div><h2>¿Quitar "' + esc(m.nombre) + '"?</h2></div><button class="icon-btn" type="button" data-cerrar aria-label="Cerrar">' + ICON.close + '</button></div>' +
        '<p class="adm-nota">' + (m.principal
          ? (m.ahorrado > 0 ? 'Los ' + pesos(m.ahorrado) + ' que hay en el bolsillo "' + esc(m.cuenta) + '" vuelven a ' + esc(m.principal) + ' y el bolsillo se archiva. No pierdes plata.'
            : 'El bolsillo "' + esc(m.cuenta) + '" está en $0: solo se archiva.')
          : 'Tu plata no se toca: "' + esc(m.cuenta) + '" y su saldo siguen igual. Solo dejas de ver esta meta.') + '</p>' +
        '<div class="reg-err" hidden></div><button type="button" class="btn adm-btn rojo" data-quitar>Sí, quitar la meta</button><button type="button" class="btn adm-btn" data-cerrar>No, volver</button>', function (h) {
          h.querySelector('[data-quitar]').addEventListener('click', function (e) { ejecutar(h.querySelector('.sheet'), e.currentTarget, { accion: 'metaadmin', op: 'quitar', nombre: m.nombre }); });
        });
    });
  }

  /* =================== AÑADIR REGISTRO (Favores) =================== */
  function anadirRegistro(sentido) {
    var les = sentido === 'les', d = MF.datos();
    var html = '<div class="sheet-h"><div><h2>Añadir registro</h2><div class="kind">' + (les ? 'Lo que le debes a alguien' : 'Lo que te deben') + '</div></div>' +
      '<button class="icon-btn" type="button" data-cerrar aria-label="Cerrar">' + ICON.close + '</button></div>' +
      '<div class="adm-lista">' +
      '<button type="button" class="btn adm-btn verde" data-nuevo><span>🆕 Registrar nuevo favor</span><small>' + (les ? 'Alguien te prestó plata: entra a tu cuenta.' : 'Le prestaste plata a alguien: sale de tu cuenta.') + '</small></button>' +
      '<button type="button" class="btn adm-btn" data-antiguo><span>🕰️ Registrar favor antiguo</span><small>Algo de antes que no anotaste. No mueve tus cuentas: solo suma a lo que ' + (les ? 'le debes.' : 'te deben.') + '</small></button></div>';
    MF.abrirHoja(html, function (h) {
      h.querySelector('[data-nuevo]').addEventListener('click', function () {
        MF.cerrarHoja();
        if (!MF.registrarCon) return;
        var pre = les ? { tipoIng: '__meprestaron' } : { desc: 'Préstamo', para: '__otra' };
        if (!les && (d.listaCategorias || []).some(function (c) { return c.nombre === 'Préstamos a personas'; })) { pre.cat = 'Préstamos a personas'; pre._catManual = true; }
        // Espera a que termine de cerrarse esta hoja; si no, abrir el registro en el mismo instante lo arrastra.
        setTimeout(function () { MF.registrarCon(les ? 'ingreso' : 'gasto', pre); }, 320);
      });
      h.querySelector('[data-antiguo]').addEventListener('click', function () { MF.cerrarHoja(); setTimeout(function () { deudaAntigua(sentido); }, 320); });
    });
  }

  /* =================== ALGO QUE ME DEBÍAN DESDE ANTES =================== */
  function deudaAntigua(sentido) {
    var d = MF.datos(), les = sentido === 'les';
    var nombres = {};
    (d.meDeben || []).forEach(function (x) { nombres[x.persona] = 1; });
    (d.lesDebo || []).forEach(function (x) { nombres[x.persona] = 1; });
    var st = { persona: '', concepto: '', monto: NaN, saldoActual: NaN, fecha: hoyISO(), fechaPago: '' };
    hojaFormulario(les ? 'Favor antiguo: lo que le debes' : 'Favor antiguo: lo que te deben',
      'Para lo que se te olvidó anotar al empezar. No mueve tus cuentas: solo suma a lo que ' + (les ? 'le debes.' : 'te deben.'), st, function (st) {
      var h = campo(les ? '¿A quién se lo debías?' : '¿Quién te lo debe?', '<input class="in" data-k="persona" list="dl-personas" type="text" autocomplete="off" placeholder="Nombre" value="' + esc(st.persona) + '">' +
          '<datalist id="dl-personas">' + Object.keys(nombres).map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>') +
        fTexto(st, 'concepto', les ? '¿Por qué se lo debías?' : '¿Por qué te lo debe?', 'Ej: Mercado de agosto, préstamo de julio') +
        fMonto(st, 'monto', 'Valor inicial', les ? 'Lo que le debías al principio.' : 'Lo que le prestaste al principio.') +
        fMonto(st, 'saldoActual', 'Saldo actual (opcional)', 'Lo que todavía ' + (les ? 'le debes' : 'te debe') + '. Si ya ' + (les ? 'le pagaste' : 'te pagó') + ' algo, la diferencia queda como pago anterior. Vacío = no ' + (les ? 'le has pagado' : 'te ha pagado') + ' nada.');
      if (les) h += campo('¿Desde cuándo?', '<input class="in" data-k="fecha" type="date" max="' + hoyISO() + '" value="' + esc(st.fecha) + '">');
      else h += campo('📅 ¿Para cuándo te paga? (opcional)', '<input class="in" data-k="fechaPago" type="date" value="' + esc(st.fechaPago || '') + '">', 'Si no hay fecha acordada, déjala vacía.');
      return h;
    }, function (st) {
      var persona = String(st.persona || '').trim(), concepto = String(st.concepto || '').trim();
      if (!persona) throw new Error(les ? 'Escribe a quién se lo debías.' : 'Escribe quién te lo debe.');
      if (!concepto) throw new Error('Escribe el concepto.');
      if (!(st.monto > 0)) throw new Error('Escribe el valor inicial.');
      var tieneSaldo = typeof st.saldoActual === 'number' && !isNaN(st.saldoActual);
      if (tieneSaldo && !(st.saldoActual > 0)) throw new Error('El saldo actual debe ser mayor que cero. Si ya te lo pagaron todo, no hace falta registrarlo.');
      if (tieneSaldo && st.saldoActual > st.monto) throw new Error('El saldo actual no puede ser mayor que el valor inicial.');
      if (les && !st.fecha) throw new Error('Elige la fecha.');
      var sa = tieneSaldo ? st.saldoActual : '';
      return les ? { accion: 'ledebiaantes', persona: persona, concepto: concepto, monto: st.monto, saldoActual: sa, fecha: st.fecha }
        : { accion: 'deudaantigua', persona: persona, concepto: concepto, monto: st.monto, saldoActual: sa, fechaPago: String(st.fechaPago || '') };
    });
  }

  window.MFAdmin = { fijo: fijo, fijos: fijos, cuentas: cuentas, movimiento: movimiento, deudaAntigua: deudaAntigua, anadirRegistro: anadirRegistro, limites: limites, metas: metas };
})();
