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
    return { alAccion: function (fn) { extraAccion = fn; } };
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

  /* =================== MIS CUENTAS Y CRÉDITOS =================== */
  var COLORES = ['#3D8BFF', '#7A2FD6', '#C3137A', '#D8263C', '#E0572D', '#C8952B', '#1FA35C', '#11A39A', '#0B0B0B', '#5B6B85'];
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

  window.MFAdmin = { fijo: fijo, fijos: fijos, cuentas: cuentas };
})();
