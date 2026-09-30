/* MIS FINANZAS · app instalable (v5)
   Lee los datos de tu Google Sheet a través de tu Apps Script (solo lectura) y los pinta.
   La clave se guarda únicamente en este dispositivo. */
(function () {
  'use strict';
  var API = 'https://script.google.com/macros/s/AKfycbw_iGmjzli6yfDNnBGkNVIJKgGSG1xJKzMMMm-RqElcQf9IlUb7wZlc6YFLaiYFkm9a/exec';
  var app = document.getElementById('app');
  var tip = document.getElementById('tip');
  var nav = document.getElementById('nav');

  var DEMO = window.DEMO || null;
  var datos = null;
  var mesSel = '';
  var sync = 'ok';               // ok | on | off
  var abiertos = {};             // listas desplegadas: { clave: true }
  var busq = { q: '', tipo: 'todos', cat: '', cuenta: '', mes: '' };
  var SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  /* ---------- almacenamiento local (solo comodidad; la app funciona sin él) ---------- */
  function leerLocal(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function guardarLocal(k, v) { try { if (v === null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  var oculto = leerLocal('ocultar') === '1';
  var memoriaClave = null;
  function clave() { return memoriaClave || leerLocal('clave') || ''; }

  /* ---------- formato ---------- */
  function pesosReal(n) { var v = Math.round(Math.abs(n || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return (n < 0 ? '−$' : '$') + v; }
  function pesos(n) { return oculto ? '$ •••••' : pesosReal(n); }
  function corto(n) {
    if (oculto) return '•••';
    var a = Math.abs(n);
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',').replace(',0', '') + ' M';
    if (a >= 1e3) return '$' + Math.round(n / 1e3) + ' mil';
    return '$' + Math.round(n);
  }
  function fecha(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fechaCorta(s) { var d = fecha(s); return d.getDate() + ' ' + MES_C[d.getMonth()]; }
  function nombreMes(k) { var p = k.split('-'); return MESES[+p[1] - 1] + ' ' + p[0]; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  var ICON = {
    up: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 10l4-4 4 4"/></svg>',
    down: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6l4 4 4-4"/></svg>',
    alert: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 4.5v4M8 11.2v.3"/><circle cx="8" cy="8" r="6.5"/></svg>',
    clock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.8V8l2.2 1.4"/></svg>',
    check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>',
    auto: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3"/></svg>',
    scissors: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="4" cy="4" r="2"/><circle cx="4" cy="12" r="2"/><path d="M5.6 5.2L14 12M5.6 10.8L14 4"/></svg>',
    back: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L5 8l5 5"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    chevron: '<svg viewBox="0 0 16 16"><path d="M4 6l4 4 4-4"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    left: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
  };

  /* ---------- entidades: logos y colores ---------- */
  function ent(nombre, esFijo) { return ((datos && datos.entidades) || {})[(esFijo ? 'fijo:' : '') + nombre] || null; }
  function lum(hex) {
    var h = String(hex || '#000000').replace('#', ''), r = parseInt(h.substr(0, 2), 16) / 255, g = parseInt(h.substr(2, 2), 16) / 255, b = parseInt(h.substr(4, 2), 16) / 255;
    var f = function (c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  /** Color de marca para degradados (si la marca es negra, usa su color de texto). */
  function colorMarca(nombre, esFijo) {
    var e = ent(nombre, esFijo);
    if (!e) return nombre === 'Mamá' ? '#F2994A' : '#3d8bff';
    return lum(e.color) < 0.03 ? e.colorTexto : e.color;
  }
  function iniciales(n) {
    var w = n.replace(/^TC\s+/i, '').split(/\s+/).filter(Boolean);
    return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
  }
  function logo(nombre, esFijo, grande) {
    var e = ent(nombre, esFijo) || {};
    var cls = 'logo' + (grande ? ' lg' : '');
    var src = (window.LOGOS || {})[nombre] || (e.sitio && /^https?:\/\//i.test(e.sitio) ? e.sitio : '') || (window.logoDe ? window.logoDe(nombre) : '');
    var color = e.color || (nombre === 'Mamá' ? '#F2994A' : '#1b2a4a');
    var texto = e.colorTexto || '#FFFFFF';
    if (!src && e.emoji && !e.sitio) {
      return '<span class="' + cls + '" style="--c:' + color + ';--t:' + texto + ';font-size:' + (grande ? 24 : 18) + 'px">' + esc(e.emoji) + '</span>';
    }
    if (!src && nombre === 'Mamá') return '<span class="' + cls + '" style="--c:#F2994A;font-size:' + (grande ? 24 : 18) + 'px">👩</span>';
    var img = src ? '<img alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="' + esc(src) + '" onerror="this.remove()">' : '';
    return '<span class="' + cls + (lum(color) < 0.03 ? ' dark' : '') + '" style="--c:' + color + ';--t:' + texto + '">' + esc(iniciales(nombre)) + img + '</span>';
  }
  function etiqueta(nombre) {
    var e = ent(nombre, false);
    if (!e) return '<span class="ent" style="background:var(--surface-2);color:var(--ink-2)">' + esc(nombre) + '</span>';
    var borde = lum(e.color) < 0.03 ? ';box-shadow:inset 0 0 0 1px ' + e.colorTexto : '';
    return '<span class="ent" style="background:' + e.color + ';color:' + e.colorTexto + borde + '">' + esc(nombre) + '</span>';
  }

  /* ---------- gráfica de línea para las tarjetas ---------- */
  function sparkline(serie, color, alto) {
    var pts = (serie || []).map(function (p) { return p.s; });
    if (!pts.length) return '';
    if (pts.length === 1) pts = [pts[0], pts[0]];
    var W = 200, H = alto || 38, min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
    var rango = max - min || 1, pad = 4;
    var x = function (i) { return (i / (pts.length - 1)) * W; };
    var y = function (v) { return max === min ? H * 0.6 : pad + (H - 2 * pad) * (1 - (v - min) / rango); };
    var d = pts.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
    var id = 'g' + Math.random().toString(36).slice(2, 8);
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + d + ' L' + W + ' ' + H + ' L0 ' + H + 'Z" fill="url(#' + id + ')"/>' +
      '<path d="' + d + '" fill="none" stroke="' + (color || '#fff') + '" stroke-opacity=".7" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  /* ---------- datos ---------- */
  function urlDatos(mes) { return API + '?api=1&clave=' + encodeURIComponent(clave()) + '&mes=' + encodeURIComponent(mes || ''); }
  function cargar(mes, silencioso) {
    if (DEMO) { datos = DEMO; mesSel = datos.mes; pintar(); return Promise.resolve(); }
    var k = 'datos:' + (mes || 'actual');
    var guardado = leerLocal(k);
    if (guardado && !datos) {
      try { datos = JSON.parse(guardado); mesSel = datos.mes; } catch (e) { datos = null; }
      if (datos) { sync = 'on'; pintar(); }
    } else if (!silencioso) {
      sync = 'on'; marcarSync();
    }
    return fetch(urlDatos(mes), { redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (!r.ok) {
          if (/restringido/i.test(r.error || '')) { guardarLocal('clave', null); memoriaClave = null; return pedirClave('La clave no es correcta.'); }
          throw new Error(r.error || 'Error desconocido');
        }
        var nuevo = JSON.stringify(r.datos), habia = !!datos, igual = habia && nuevo === JSON.stringify(datos);
        datos = r.datos; mesSel = datos.mes; sync = 'ok';
        guardarLocal(k, nuevo);
        // Si ya estabas viendo la app: sin cambios no se repinta nada; con cambios se repinta sin animación ni saltos.
        if (igual) marcarSync();
        else if (habia) pintarSuave();
        else pintar();
      })
      .catch(function (e) {
        sync = 'off';
        if (datos) { pintar(); return; }
        app.innerHTML = '<div class="state"><p><b>No pude cargar tus datos.</b></p><p>' + esc(e && e.message || e) +
          '</p><p><button class="btn" id="reint" type="button">Reintentar</button></p></div>';
        document.getElementById('reint').onclick = function () { cargar(mes); };
      });
  }
  function marcarSync() {
    var s = document.querySelector('.sync');
    if (!s) return;
    s.className = 'sync ' + sync;
    s.lastChild.textContent = sync === 'on' ? 'Actualizando…' : sync === 'off' ? 'Sin conexión · datos guardados' : 'Al día';
  }

  function pedirClave(error) {
    nav.hidden = true;
    app.innerHTML = '';
    var n = el('<form class="login"><img src="icons/icon-192.png" alt=""><h1>Mis finanzas</h1>' +
      '<p style="color:var(--ink-2);margin:0">Escribe tu clave para ver tus datos. Queda guardada solo en este dispositivo.</p>' +
      '<input id="clave" type="password" autocomplete="current-password" placeholder="Tu clave" required>' +
      (error ? '<div class="err">' + esc(error) + '</div>' : '') +
      '<button class="btn primary" type="submit">Entrar</button></form>');
    n.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var v = n.querySelector('#clave').value.trim();
      if (!v) return;
      memoriaClave = v; guardarLocal('clave', v);
      nav.hidden = false;
      app.innerHTML = '<div class="state"><div class="spinner"></div>Cargando tus finanzas…</div>';
      cargar('');
    });
    app.appendChild(n);
    n.querySelector('#clave').focus();
  }

  /* ---------- navegación ---------- */
  function ruta() {
    var h = (location.hash || '#/inicio').slice(2).split('/');
    return { v: h[0] || 'inicio', nombre: h[1] ? decodeURIComponent(h[1]) : '' };
  }
  function ir(hash) { location.hash = hash; }
  // Al volver de una cuenta o un crédito, regresa al mismo punto de la pantalla anterior (y con lo que tenías abierto).
  var rutaActual = location.hash || '#/inicio', posiciones = {}, abiertosPor = {};
  window.addEventListener('scroll', function () { posiciones[rutaActual] = window.scrollY; }, { passive: true });
  window.addEventListener('hashchange', function () {
    var nuevo = location.hash || '#/inicio';
    var desdeDetalle = /^#\/(cuenta|credito)\//.test(rutaActual) && !/^#\/(cuenta|credito)\//.test(nuevo);
    abiertosPor[rutaActual] = abiertos;
    var w = document.querySelector('.wallet'); if (w) posiciones[rutaActual + '|wallet'] = w.scrollLeft;
    var volver = desdeDetalle && posiciones[nuevo] != null;
    rutaActual = nuevo;
    abiertos = volver ? (abiertosPor[nuevo] || {}) : {};
    var y = volver ? posiciones[nuevo] : 0;
    pintar();
    window.scrollTo(0, y);
    posiciones[nuevo] = y;
    // La billetera vuelve a mostrar la tarjeta que estabas viendo.
    var w2 = document.querySelector('.wallet');
    if (w2 && volver && posiciones[nuevo + '|wallet']) w2.scrollLeft = posiciones[nuevo + '|wallet'];
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.hit, .seg')) ocultarTip(); });

  function mostrarTip(ev, html) {
    tip.innerHTML = html; tip.hidden = false;
    var x = ev.clientX, y = ev.clientY, w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 14)) + 'px';
    tip.style.top = (y - h - 12 < 8 ? y + 16 : y - h - 12) + 'px';
  }
  function ocultarTip() { tip.hidden = true; }
  window.addEventListener('scroll', ocultarTip, { passive: true });

  // Repinta en silencio (datos nuevos o cambio de tamaño): sin animación de entrada, en el mismo punto de la pantalla
  // y sin cerrar lo que tengas abierto (si hay un detalle abierto, espera a que lo cierres).
  var repintarAlCerrar = false;
  function pintarSuave() {
    if (hojaAbierta) { repintarAlCerrar = true; marcarSync(); return; }
    var y = window.scrollY, w = document.querySelector('.wallet'), wx = w ? w.scrollLeft : 0;
    pintar();
    for (var i = 0; i < app.children.length; i++) app.children[i].style.animation = 'none';
    window.scrollTo(0, y);
    var w2 = document.querySelector('.wallet'); if (w2) w2.scrollLeft = wx;
  }
  function pintar() {
    if (!datos) return;
    repintarAlCerrar = false;
    ocultarTip();
    document.body.classList.toggle('oculto', oculto);
    var r = ruta();
    indexarPlanes();
    cerrarHoja();
    var vistaNav = r.v === 'cuenta' ? 'inicio' : r.v === 'credito' ? 'creditos' : r.v;
    nav.querySelectorAll('a').forEach(function (a) { a.classList.toggle('on', a.dataset.v === vistaNav); });
    app.innerHTML = '';
    if (DEMO) app.appendChild(el('<div class="demo-banner">Vista previa con tus saldos y créditos reales y algunos movimientos de prueba. Los logos se ven en la app instalada.</div>'));
    if (r.v === 'cuenta') return paginaCuenta(r.nombre);
    if (r.v === 'credito') return paginaCredito(r.nombre);
    if (r.v === 'creditos') return vistaCreditos();
    if (r.v === 'movimientos') return vistaMovimientos();
    if (r.v === 'medeben') return vistaMeDeben();
    if (r.v === 'calendario') return vistaCalendario();
    return inicio();
  }

  /* =================== INICIO =================== */
  function inicio() {
    var d = datos;
    app.appendChild(barraSuperior(d, true));
    app.appendChild(hero(d));
    app.appendChild(billetera(d));
    var g = el('<div class="grid"></div>');
    g.appendChild(proximos(d, true));
    var st = el('<div class="stack flat c-5"></div>');
    st.appendChild(presupuesto(d));
    st.appendChild(ultimoMovimiento(d));
    g.appendChild(st);
    app.appendChild(g);
    app.appendChild(categorias(d));
    var g3 = el('<div class="grid"></div>');
    g3.appendChild(historico(d));
    g3.appendChild(semanal(d));
    app.appendChild(g3);
  }

  function barraSuperior(d, conMes) {
    var h = new Date().getHours();
    var saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    var opts = d.meses.map(function (k) { return '<option value="' + k + '"' + (k === d.mes ? ' selected' : '') + '>' + cap(nombreMes(k)) + '</option>'; }).join('');
    var n = el('<div class="top"><div class="hello"><h1>' + saludo + (d.nombre ? ', ' + esc(d.nombre) : '') + '</h1>' +
      '<p>' + cap(DIAS[fecha(d.hoy).getDay()]) + ' ' + fechaCorta(d.hoy) + ' · <span class="sync ' + sync + '"><i class="dot"></i><span></span></span></p></div>' +
      '<div class="controls">' + (conMes ? '<select id="mes" class="select" aria-label="Mes">' + opts + '</select>' : '') +
      '<button class="icon-btn" id="ojo" type="button" aria-label="' + (oculto ? 'Mostrar montos' : 'Ocultar montos') + '" aria-pressed="' + oculto + '">' + (oculto ? ICON.eyeOff : ICON.eye) + '</button>' +
      '<button class="icon-btn" id="tema" type="button" aria-label="' + (temaActual() === 'claro' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro') + '">' + (temaActual() === 'claro' ? ICON.moon : ICON.sun) + '</button>' +
      '<button class="icon-btn" id="recargar" type="button" aria-label="Actualizar">' + ICON.refresh + '</button>' +
      '<button class="icon-btn" id="miscuentas" type="button" aria-label="Mis cuentas y créditos" title="Mis cuentas">' + ICON.gear + '</button></div></div>');
    n.querySelector('#miscuentas').addEventListener('click', function () { if (window.MFAdmin) MFAdmin.cuentas(); });
    n.querySelector('#tema').addEventListener('click', function () { temaGuardado = temaActual() === 'claro' ? 'oscuro' : 'claro'; guardarLocal('tema', temaGuardado); aplicarTema(); pintar(); });
    var m = n.querySelector('#mes');
    if (m) m.addEventListener('change', function (e) { cargar(e.target.value); });
    n.querySelector('#ojo').addEventListener('click', function () { oculto = !oculto; guardarLocal('ocultar', oculto ? '1' : '0'); pintar(); });
    n.querySelector('#recargar').addEventListener('click', function () { cargar(mesSel === datos.meses[0] ? '' : mesSel); });
    setTimeout(marcarSync, 0);
    return n;
  }

  function hero(d) {
    var delta = d.gastosMesAnterior > 0 ? Math.round((d.gastos - d.gastosMesAnterior) / d.gastosMesAnterior * 100) : null;
    var mesPrev = MESES[(+d.mes.split('-')[1] + 10) % 12];
    var deltaHtml = delta === null ? '<span>Sin datos del mes anterior</span>'
      : (delta <= 0 ? ICON.down : ICON.up) + '<span>' + Math.abs(delta) + ' % ' + (delta <= 0 ? 'menos' : 'más') + ' que en ' + mesPrev + '</span>';
    var disp = d.disponible || { valor: d.totalPlata, tienes: d.totalPlata, creditos: 0, fijos: 0 };
    var neg = disp.valor < 0;
    // Inicio simple: tu balance (lo que tienes en tus cuentas) y los ingresos y gastos del mes.
    var nodo = el('<section class="hero hero-simple" aria-label="Resumen">' +
      '<svg class="ribbon" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="rb" x1="0" x2="1"><stop offset="0" stop-color="#63d4ff" stop-opacity="0"/><stop offset=".55" stop-color="#9fe6ff" stop-opacity=".9"/><stop offset="1" stop-color="#ffffff" stop-opacity=".2"/></linearGradient><filter id="bl"><feGaussianBlur stdDeviation="6"/></filter></defs>' +
      '<path d="M-20 250 C 180 120, 340 330, 520 150 S 760 40, 840 90" stroke="url(#rb)" stroke-width="46" fill="none" filter="url(#bl)" opacity=".45"/>' +
      '<path d="M-20 240 C 180 110, 340 320, 520 140 S 760 30, 840 80" stroke="url(#rb)" stroke-width="1.5" fill="none"/></svg>' +
      '<div class="hero-left"><div class="disp bal-caja"><div class="eyebrow">Tu balance</div>' +
      '<div class="big num">' + pesos(d.totalPlata) + '</div>' +
      // Disponible para gastar: lo que tienes menos lo que pagas en los próximos 30 días (verde si alcanza, rojo si no).
      // Pequeña y mínima: solo el número; al tocarla muestra de dónde sale (créditos y fijos de 30 días).
      '<button type="button" class="disp-caja ' + (neg ? 'mal' : 'bien') + (dispAbierta ? ' abierta' : '') + '" aria-expanded="' + dispAbierta + '">' +
      '<span class="dc-k">' + (neg ? 'Te falta para pagos de 30 d' : 'Disponible para gastar') + ICON.chevron + '</span>' +
      '<span class="dc-v num">' + (neg ? '−' : '') + pesos(Math.abs(disp.valor)) + '</span>' +
      '<span class="dc-d"><span class="dc-in"><span>Tienes <b>' + pesos(disp.tienes) + '</b></span><span>Créditos 30 d <b>−' + pesos(disp.creditos) + '</b></span>' +
      (disp.fijos ? '<span>Fijos 30 d <b>−' + pesos(disp.fijos) + '</b></span>' : '') + '</span></span></button>' +
      '</div></div>' +
      '<div><div class="eyebrow" style="margin-bottom:10px">' + cap(nombreMes(d.mes)) + '</div><div class="month-tiles dos">' +
      '<div class="tile"><div class="k">Ingresos</div><div class="v num">' + pesos(d.ingresos) + '</div><div class="d"><span>' + d.tiposIngreso.length + ' fuente' + (d.tiposIngreso.length === 1 ? '' : 's') + '</span></div></div>' +
      '<div class="tile"><div class="k">Gastos</div><div class="v num">' + pesos(d.gastos) + '</div><div class="d">' + deltaHtml + '</div></div>' +
      '</div></div></section>');
    var caja = nodo.querySelector('.disp-caja');
    caja.addEventListener('click', function () { dispAbierta = !dispAbierta; caja.classList.toggle('abierta', dispAbierta); caja.setAttribute('aria-expanded', String(dispAbierta)); });
    return nodo;
  }
  var dispAbierta = false;

  function tarjetaMarca(nombre, saldo, extra, onClick, serie) {
    var c = colorMarca(nombre);
    var b = el('<button type="button" class="acct brand-card' + (saldo < 0 ? ' neg' : '') + '" style="--bc:' + c + '">' +
      sparkline(serie, '#ffffff') +
      '<div class="row1">' + logo(nombre) + '<span class="name">' + esc(nombre) + '</span></div>' +
      '<div class="bal num">' + pesos(saldo) + '</div>' + (extra || '') + '</button>');
    b.addEventListener('click', onClick);
    return b;
  }

  function cuentas(d) {
    var orden = d.cuentas.filter(function (c) { return !c.apartaPara; }).concat(d.cuentas.filter(function (c) { return c.apartaPara; }));
    var n = el('<section class="card"><div class="card-h"><h2>Tus cuentas</h2><span class="aside">Total <b>' + pesos(d.totalPlata) + '</b></span></div><div class="tiles"></div></section>');
    var cont = n.querySelector('.tiles');
    orden.forEach(function (c) {
      var sub = c.apartaPara ? '<div class="sub">Bolsillo · para ' + esc(c.apartaPara) + '</div>' : '';
      cont.appendChild(tarjetaMarca(c.nombre, c.saldo, sub, function () { ir('#/cuenta/' + encodeURIComponent(c.nombre)); }, c.serie));
    });
    return n;
  }

  function extraCredito(c) {
    if (c.persona) return '<div class="util"><span>Sin intereses · la devuelves cuando puedas</span></div>';
    if (c.cupo > 0) {
      var pct = Math.round(c.saldo / c.cupo * 100);
      return '<div class="util"><div class="meter ' + (pct >= 85 ? 'crit' : pct >= 60 ? 'warn' : '') + '"><i style="width:' + Math.min(100, Math.max(0, pct)) + '%"></i></div>' +
        '<span>' + pct + ' % de ' + corto(c.cupo) + (c.proximo ? ' · próx. ' + fechaCorta(c.proximo.fecha) : '') + '</span></div>';
    }
    if (c.proximo) return '<div class="util"><span>Próx. ' + pesos(c.proximo.monto) + ' · ' + fechaCorta(c.proximo.fecha) + '</span></div>';
    return '';
  }

  function creditosCard(d) {
    var n = el('<section class="card"><div class="card-h"><h2>Tus créditos</h2><span class="aside">Debes <b>' + pesos(d.totalDeudas) + '</b></span></div><div class="tiles"></div></section>');
    var cont = n.querySelector('.tiles');
    d.creditos.forEach(function (c) {
      cont.appendChild(tarjetaMarca(c.nombre, c.saldo, extraCredito(c), function () { ir('#/credito/' + encodeURIComponent(c.nombre)); }, c.serie));
    });
    return n;
  }

  function chipDias(dias) {
    if (dias < 0) return '<span class="chip crit">' + ICON.alert + 'Vencido hace ' + (-dias) + ' d</span>';
    if (dias === 0) return '<span class="chip crit">' + ICON.alert + 'Hoy</span>';
    if (dias <= 3) return '<span class="chip crit">' + ICON.alert + 'En ' + dias + ' d</span>';
    if (dias <= 7) return '<span class="chip warn">' + ICON.clock + 'En ' + dias + ' días</span>';
    return '<span class="chip neutral">' + ICON.clock + 'En ' + dias + ' días</span>';
  }

  function botonVerTodo(clave, total, textoAbierto, textoCerrado) {
    var abierto = !!abiertos[clave];
    var b = el('<button type="button" class="ver-todo" aria-expanded="' + abierto + '">' +
      (abierto ? textoAbierto : textoCerrado.replace('{n}', total)) + '<span style="display:inline-flex;transform:rotate(' + (abierto ? 180 : 0) + 'deg)">' + ICON.chevron + '</span></button>');
    b.addEventListener('click', function () { abiertos[clave] = !abierto; var y = window.scrollY; pintar(); window.scrollTo(0, y); });
    return b;
  }

  function filaPago(p, d) {
    var esFijo = p.tipo === 'fijo';
    var sub = '', chip = '';
    if (esFijo) {
      if (p.estado === 'automatico') { sub = 'Se cobra solo a ' + etiqueta(p.cuenta); chip = '<span class="chip auto">' + ICON.auto + 'Automático</span>'; }
      else if (p.estado === 'cobrado') { sub = 'Cobrado a ' + etiqueta(p.cuenta); chip = '<span class="chip ok">' + ICON.check + 'Cobrado</span>'; }
      else if (p.estado === 'pagado') { sub = 'Pagado'; chip = '<span class="chip ok">' + ICON.check + 'Pagado</span>'; }
      else if (p.estado === 'cancelar') { sub = 'Prueba gratis: cancélalo antes para que no te cobren'; chip = '<span class="chip crit">' + ICON.scissors + 'Cancelar</span>'; }
      else { sub = 'Pago manual · ' + etiqueta(p.cuenta); chip = chipDias(p.dias); }
      if (p.compartido) sub += ' · te devuelven ' + pesos(p.compartido * p.porPersona);
      if (p.frecuencia === 'Anual') sub = 'Anual · ' + sub;
    } else {
      sub = esc(p.detalle);
      chip = chipDias(p.dias);
    }
    var done = p.estado === 'cobrado' || p.estado === 'pagado';
    var row = el('<div class="due' + (done ? ' done' : '') + (esFijo ? '' : ' link') + '"' + (esFijo ? '' : ' role="button" tabindex="0"') + '>' +
      logo(p.nombre, esFijo) + '<div style="min-width:0"><div class="n">' + esc(p.nombre) + '</div><div class="s">' + sub + '</div></div>' +
      '<div class="r"><span class="v">' + pesos(p.monto) + '</span>' + chip + '</div></div>');
    if (esFijo) {
      row.classList.add('link'); row.setAttribute('role', 'button'); row.setAttribute('tabindex', '0');
      var abrirF = function () { if (window.MFAdmin) MFAdmin.fijo(p); };
      row.addEventListener('click', abrirF);
      row.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirF(); } });
    } else {
      var abrir = function () { ir('#/credito/' + encodeURIComponent(p.nombre)); };
      row.addEventListener('click', abrir);
      row.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
    }
    return row;
  }

  function proximos(d, comprimido) {
    var n = el('<section class="card c-7 o2"><div class="card-h"><h2>Próximos pagos</h2><span class="aside"></span></div><div class="agenda"></div></section>');
    var cont = n.querySelector('.agenda');
    var porPagar = 0;
    d.proximos.forEach(function (p) { if (p.estado === 'pendiente' && p.dias <= 30) porPagar += p.monto; });
    n.querySelector('.aside').innerHTML = 'En 30 días <b>' + pesos(porPagar) + '</b>';
    var lista = d.proximos;
    var pendientes = lista.filter(function (p) { return p.estado === 'pendiente' || p.estado === 'automatico' || p.estado === 'cancelar'; });
    var abierto = !comprimido || abiertos.proximos;
    var mostrar = abierto ? lista : pendientes.slice(0, 1);
    var dia = '';
    mostrar.forEach(function (p) {
      if (p.fecha !== dia) {
        dia = p.fecha;
        var f = fecha(p.fecha);
        var rel = p.dias === 0 ? 'Hoy' : p.dias === 1 ? 'Mañana' : cap(DIAS[f.getDay()]);
        cont.appendChild(el('<div class="day">' + rel + ' · ' + fechaCorta(p.fecha) + '</div>'));
      }
      cont.appendChild(filaPago(p, d));
    });
    if (!lista.length) cont.appendChild(el('<div class="empty">No tienes pagos en los próximos 35 días.</div>'));
    if (comprimido && lista.length > 1) n.appendChild(botonVerTodo('proximos', lista.length, 'Ver menos', 'Ver todos los pagos ({n})'));
    return n;
  }

  function presupuesto(d) {
    var html = d.presupuestos.map(function (b) {
      var pct = b.tope > 0 ? Math.round(b.gastado / b.tope * 100) : 0;
      var cls = pct > 100 ? 'crit' : pct >= 80 ? 'warn' : '';
      var chip = pct > 100 ? '<span class="chip crit">' + ICON.alert + 'Te pasaste ' + pesos(b.gastado - b.tope) + '</span>'
        : pct >= 80 ? '<span class="chip warn">' + ICON.alert + 'Quedan ' + pesos(b.tope - b.gastado) + '</span>'
        : '<span class="chip ok">' + ICON.check + 'Quedan ' + pesos(b.tope - b.gastado) + '</span>';
      var filas = b.categorias.map(function (c) {
        var m = (d.categorias.find(function (x) { return x.nombre === c; }) || { monto: 0 }).monto;
        return '<div><span>' + esc(c) + '</span><span>' + pesos(m) + '</span></div>';
      }).join('');
      return '<div class="budget"><div class="card-h" style="margin:0"><h2>' + esc(b.grupo) + ' del mes</h2>' + chip + '</div>' +
        '<div class="fig"><span class="v num">' + pesos(b.gastado) + '</span><span class="of">de ' + pesos(b.tope) + ' · ' + pct + ' %</span></div>' +
        '<div class="meter big ' + cls + '" role="img" aria-label="' + pct + ' % del presupuesto"><i style="width:' + Math.min(100, pct) + '%"></i></div>' +
        '<div class="rows">' + filas + '</div></div>';
    }).join('<hr style="border:0;border-top:1px solid var(--line);margin:6px 0">');
    return el('<section class="card o3">' + (html || '<div class="empty">Define un tope en la pestaña Configuración.</div>') + '</section>');
  }

  function ultimoMovimiento(d) {
    var n = el('<section class="card o4"><div class="card-h"><h2>Último movimiento</h2><span class="aside"></span></div><div class="tx"></div></section>');
    var m = d.movimientos[0];
    n.querySelector('.tx').innerHTML = m ? filaMovimiento(m) : '<div class="empty">Todavía no hay movimientos.</div>';
    var b = el('<button type="button" class="ver-todo">Ver todos los movimientos<span style="display:inline-flex;transform:rotate(-90deg)">' + ICON.chevron + '</span></button>');
    b.addEventListener('click', function () { ir('#/movimientos'); });
    n.appendChild(b);
    return n;
  }

  /* ---------- dona ---------- */
  function categorias(d) {
    var cats = d.categorias.slice(), top = cats.slice(0, 7), resto = cats.slice(7);
    if (resto.length) top.push({ nombre: 'Otras (' + resto.length + ')', monto: resto.reduce(function (s, c) { return s + c.monto; }, 0), detalle: resto });
    var total = top.reduce(function (s, c) { return s + c.monto; }, 0);
    var R = 80, W = 24, C = 2 * Math.PI * R, gap = 2, off = 0;
    var segs = top.map(function (c, i) {
      var len = total > 0 ? c.monto / total * C : 0, dash = Math.max(0.01, len - gap);
      var s = '<circle class="seg" data-i="' + i + '" cx="100" cy="100" r="' + R + '" fill="none" stroke="' + SERIES[i] + '" stroke-width="' + W +
        '" stroke-dasharray="' + dash + ' ' + (C - dash) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 100 100)"/>';
      off += len; return s;
    }).join('');
    var lista = top.map(function (c, i) {
      return '<button type="button" data-i="' + i + '"><span class="sw" style="background:' + SERIES[i] + '"></span><span class="nm">' + esc(c.nombre) + '</span>' +
        '<span class="pc">' + (total > 0 ? Math.round(c.monto / total * 100) : 0) + ' %</span><span class="mv">' + pesos(c.monto) + '</span></button>';
    }).join('');
    var n = el('<section class="card"><div class="card-h"><h2>¿En qué se fue la plata?</h2><span class="aside">' + nombreMes(d.mes) + '</span></div>' +
      (total > 0 ? '<div class="donut-layout"><div class="donut-wrap chart-wrap"><svg viewBox="0 0 200 200" role="img" aria-label="Gastos por categoría">' +
      '<circle cx="100" cy="100" r="' + R + '" fill="none" stroke="var(--surface-2)" stroke-width="' + W + '"/>' + segs +
      '<text x="100" y="94" text-anchor="middle" fill="var(--muted)" font-size="12" font-family="Figtree, sans-serif">Gastaste</text>' +
      '<text x="100" y="118" text-anchor="middle" fill="var(--ink)" font-size="19" font-weight="600" font-family="Sora, sans-serif">' + corto(total) + '</text>' +
      '</svg></div><div class="cat-list">' + lista + '</div></div>' : '<div class="empty">Todavía no hay gastos este mes.</div>') + '</section>');
    var svg = n.querySelector('svg');
    function activar(i, ev) {
      if (!svg) return;
      svg.classList.add('dim');
      n.querySelectorAll('.seg').forEach(function (s) { s.classList.toggle('on', +s.dataset.i === i); });
      n.querySelectorAll('.cat-list button').forEach(function (b) { b.classList.toggle('on', +b.dataset.i === i); });
      if (ev) {
        var c = top[i];
        var det = c.detalle ? c.detalle.map(function (x) { return '<div class="r"><span>' + esc(x.nombre) + '</span><span>' + pesos(x.monto) + '</span></div>'; }).join('') : '';
        mostrarTip(ev, '<div class="t">' + esc(c.nombre) + '</div><div class="r"><span><i style="background:' + SERIES[i] + '"></i>' + Math.round(c.monto / total * 100) + ' %</span><b>' + pesos(c.monto) + '</b></div>' + det);
      }
    }
    function soltar() { if (svg) svg.classList.remove('dim'); n.querySelectorAll('.on').forEach(function (x) { x.classList.remove('on'); }); ocultarTip(); }
    n.querySelectorAll('.seg').forEach(function (s) {
      s.addEventListener('pointermove', function (ev) { if (ev.pointerType !== 'touch') activar(+s.dataset.i, ev); });
      s.addEventListener('click', function (ev) { ev.stopPropagation(); activar(+s.dataset.i, ev); });
      s.addEventListener('pointerleave', function (ev) { if (ev.pointerType !== 'touch') soltar(); });
    });
    n.querySelectorAll('.cat-list button').forEach(function (b) {
      b.addEventListener('pointerenter', function () { activar(+b.dataset.i); }); b.addEventListener('pointerleave', soltar);
      b.addEventListener('click', function () { busq = { q: '', tipo: 'Gasto', cat: top[+b.dataset.i].detalle ? '' : top[+b.dataset.i].nombre, cuenta: '', mes: d.mes }; ir('#/movimientos'); });
    });
    return n;
  }

  /* ---------- barras ---------- */
  function escala(max) {
    if (max <= 0) return { max: 1, ticks: [0] };
    var paso = Math.pow(10, Math.floor(Math.log10(max))), ops = [1, 2, 2.5, 5, 10], p = paso;
    for (var i = 0; i < ops.length; i++) { p = ops[i] * paso; if (max / p <= 4) break; }
    var top = Math.ceil(max / p) * p, ticks = [];
    for (var v = 0; v <= top + 1e-6; v += p) ticks.push(v);
    return { max: top, ticks: ticks };
  }
  function barra(x, y, w, h, r, color) {
    if (h <= 0) return ''; r = Math.min(r, h, w / 2);
    return '<path fill="' + color + '" d="M' + x + ' ' + (y + h) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h) + 'Z"/>';
  }
  function rect(x, y, w, h, color) { return h > 0 ? '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + color + '"/>' : ''; }
  function anchoGrafico() { var w = app.clientWidth || window.innerWidth; return window.innerWidth >= 1100 ? (w - 22) / 2 - 46 : w - 38; }
  var ultimoAncho = window.innerWidth;
  window.addEventListener('resize', function () {
    if (!datos || Math.abs(window.innerWidth - ultimoAncho) < 40) return;
    ultimoAncho = window.innerWidth; clearTimeout(window.__rz); window.__rz = setTimeout(pintarSuave, 200);
  });
  function graficoBarras(opts) {
    var W = Math.round(Math.max(300, Math.min(640, opts.ancho || 640))), H = W < 480 ? 210 : 240, L = 54, R = 6, T = 10, B = 28;
    var filas = opts.filas, max = 0;
    filas.forEach(function (f) { max = Math.max(max, opts.apilado ? f.valores.reduce(function (s, x) { return s + x; }, 0) : Math.max.apply(null, f.valores)); });
    var sc = escala(max), y = function (v) { return T + (H - T - B) * (1 - v / sc.max); };
    var banda = (W - L - R) / filas.length, bw = Math.min(24, opts.apilado ? banda * 0.5 : (banda * 0.7) / opts.series.length);
    var s = '<g class="axis">';
    sc.ticks.forEach(function (t) { s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="var(--grid)" stroke-width="1"/><text x="' + (L - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + corto(t) + '</text>'; });
    s += '</g><g class="bands"></g>';
    filas.forEach(function (f, i) {
      var cx = L + banda * i + banda / 2;
      if (opts.apilado) {
        var acum = 0, x0 = cx - bw / 2, vis = f.valores.map(function (v, k) { return v > 0 ? k : -1; }).filter(function (k) { return k >= 0; });
        f.valores.forEach(function (v, k) {
          if (v <= 0) return;
          var yTop = y(acum + v), h = y(acum) - yTop - (acum > 0 ? 2 : 0);
          s += k === vis[vis.length - 1] ? barra(x0, yTop, bw, h, 4, opts.series[k].color) : rect(x0, yTop, bw, h, opts.series[k].color);
          acum += v;
        });
      } else {
        var tot = opts.series.length * bw + (opts.series.length - 1) * 2;
        f.valores.forEach(function (v, k) { s += barra(cx - tot / 2 + k * (bw + 2), y(v), bw, y(0) - y(v), 4, opts.series[k].color); });
      }
      s += '<text class="tick" x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(f.etiqueta) + '</text>';
      s += '<rect class="hit" data-i="' + i + '" x="' + (L + banda * i) + '" y="' + T + '" width="' + banda + '" height="' + (H - T - B) + '"/>';
    });
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="var(--line-strong)" stroke-width="1"/>';
    var wrap = el('<div class="chart-wrap"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.titulo) + '">' + s + '</svg><div class="legend">' +
      opts.series.map(function (x) { return '<span><i style="background:' + x.color + '"></i>' + esc(x.nombre) + '</span>'; }).join('') + '</div></div>');
    var bands = wrap.querySelector('.bands');
    wrap.querySelectorAll('.hit').forEach(function (h) {
      function mostrar(ev) {
        var f = filas[+h.dataset.i];
        bands.innerHTML = '<rect class="band-hover" x="' + h.getAttribute('x') + '" y="' + T + '" width="' + banda + '" height="' + (H - T - B) + '" rx="6"/>';
        var rows = opts.series.map(function (x, k) { return opts.soloConValor && !f.valores[k] ? '' : '<div class="r"><span><i style="background:' + x.color + '"></i>' + esc(x.nombre) + '</span><b>' + pesos(f.valores[k]) + '</b></div>'; }).join('');
        mostrarTip(ev, '<div class="t">' + esc(f.titulo || f.etiqueta) + '</div>' + rows + (opts.pie ? opts.pie(f) : ''));
      }
      h.addEventListener('pointermove', function (ev) { if (ev.pointerType !== 'touch') mostrar(ev); });
      h.addEventListener('click', function (ev) { ev.stopPropagation(); mostrar(ev); });
      h.addEventListener('pointerleave', function (ev) { if (ev.pointerType !== 'touch') { bands.innerHTML = ''; ocultarTip(); } });
    });
    return wrap;
  }
  function historico(d) {
    var n = el('<section class="card c-6"><div class="card-h"><h2>Ingresos vs. gastos</h2><span class="aside">Últimos 6 meses</span></div></section>');
    n.appendChild(graficoBarras({ titulo: 'Ingresos y gastos por mes', ancho: anchoGrafico(),
      series: [{ nombre: 'Ingresos', color: 'var(--s1)' }, { nombre: 'Gastos', color: 'var(--s2)' }],
      filas: d.historico.map(function (m) { return { etiqueta: MES_C[+m.mes.split('-')[1] - 1], titulo: nombreMes(m.mes), valores: [m.ingresos, m.gastos] }; }),
      pie: function (f) { return '<div class="r" style="margin-top:4px;color:var(--ink-2)"><span>Balance</span><b>' + pesos(f.valores[0] - f.valores[1]) + '</b></div>'; } }));
    return n;
  }
  function semanal(d) {
    var n = el('<section class="card c-6"><div class="card-h"><h2>Gasto semanal</h2><span class="aside">De contado y por crédito · 8 semanas</span></div></section>');
    var angosto = anchoGrafico() < 480;
    // Un tramo por cada crédito, con el color de su marca (en el orden de "Tus créditos").
    var usados = {};
    d.semanas.forEach(function (s) { Object.keys(s.porCredito || {}).forEach(function (k) { usados[k] = true; }); });
    var nombres = d.creditos.map(function (c) { return c.nombre; }).filter(function (k) { return usados[k]; });
    Object.keys(usados).forEach(function (k) { if (nombres.indexOf(k) < 0) nombres.push(k); });
    var series = [{ nombre: 'De contado', color: 'var(--s3)' }].concat(nombres.map(function (k) { return { nombre: k, color: colorMarca(k) }; }));
    if (!d.semanas.some(function (s) { return s.porCredito; })) series.push({ nombre: 'Con tarjeta o crédito', color: 'var(--s2)' });
    n.appendChild(graficoBarras({ titulo: 'Gasto por semana', apilado: true, ancho: anchoGrafico(), series: series,
      filas: d.semanas.map(function (s) {
        var ini = fecha(s.inicio), fin = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 6);
        var vals = s.porCredito ? [s.contado].concat(nombres.map(function (k) { return s.porCredito[k] || 0; })) : [s.contado, s.financiado];
        return { etiqueta: angosto ? ini.getDate() + '/' + (ini.getMonth() + 1) : ini.getDate() + ' ' + MES_C[ini.getMonth()],
          titulo: 'Semana del ' + ini.getDate() + ' ' + MES_C[ini.getMonth()] + ' al ' + fin.getDate() + ' ' + MES_C[fin.getMonth()], valores: vals };
      }),
      soloConValor: true,
      pie: function (f) { return '<div class="r" style="margin-top:4px;color:var(--ink-2)"><span>Total</span><b>' + pesos(f.valores.reduce(function (a, b) { return a + b; }, 0)) + '</b></div>'; } }));
    return n;
  }

  /* =================== MOVIMIENTOS =================== */
  /** Logo del comercio (Terpel, Metro, D1…) o de la suscripción, según la descripción. */
  function icoComercio(m) {
    var txt = norm(m.desc);
    var lista = window.COMERCIOS || [];
    for (var i = 0; i < lista.length; i++) {
      var r = lista[i];
      if (r.p.test(txt) || (r.cat && m.cat === r.cat && m.tipo === 'Gasto')) {
        if (r.img) return '<span class="logo" style="--c:#1b2a4a;--t:#eaf1ff;width:40px;height:40px;border-radius:12px">' + (r.txt || '') + '<img alt="" loading="lazy" referrerpolicy="no-referrer" src="' + r.img + '" onerror="this.remove()"></span>';
        return '<span class="logo" style="--c:' + r.c + ';--t:' + r.t + ';width:40px;height:40px;border-radius:12px">' + r.txt + '</span>';
      }
    }
    // Diccionario automático de comercios y entidades (logos.js): logo de su página web, con iniciales de respaldo.
    var dom = window.logoDe ? window.logoDe(m.desc) : '';
    if (dom) return '<span class="logo" style="--c:#1b2a4a;--t:#eaf1ff;width:40px;height:40px;border-radius:12px">' + esc(iniciales(m.desc)) + '<img alt="" loading="lazy" referrerpolicy="no-referrer" src="' + dom + '" onerror="this.remove()"></span>';
    if (m.tipo === 'Transferencia' && esDeuda(m.destino)) return logo(m.destino).replace('class="logo', 'style="width:40px;height:40px;border-radius:12px" class="logo');
    return '';
  }
  /** Grupo para filtrar lo que no tiene categoría: pagos, retiros, ajustes… */
  function grupoMov(m) {
    if (m.tipo === 'Gasto' || m.tipo === 'Ingreso') return m.cat || 'Otros';
    if (m.tipo === 'Me pagaron') return 'Me pagaron';
    if (m.tipo === 'Me prestaron' || m.tipo === 'Le pagué') return 'Préstamos con personas';
    if (m.tipo === 'Ajuste') return 'Ajustes de saldo';
    if (esDeuda(m.destino)) return 'Pagos de créditos';
    if (m.destino === 'Efectivo') return 'Retiros en efectivo';
    if (esDeuda(m.cuenta)) return 'Avances';
    return 'Movimientos entre cuentas';
  }
  function esDeuda(n) { var e = ent(n); return !!(e && e.tipo === 'Deuda') || n === 'Mamá'; }
  function filaMovimiento(m, ctx) {
    var meta = [], signo = '', cls = '', extra = '';
    meta.push('<span>' + fechaCorta(m.fecha) + '</span>');
    if (m.hist) meta.push('<span class="tag-hist">extracto</span>');
    if (m.tipo === 'Gasto') {
      if (m.cat) meta.push('<span>' + esc(m.cat) + '</span>');
      if (!ctx || ctx !== m.cuenta) meta.push(m.cuenta === 'Mamá (regalo)' ? '<span>👩 lo pagó mamá</span>' : etiqueta(m.cuenta));
      if (m.para) meta.push('<span>para ' + esc(m.para) + '</span>');
      if (m.compartido) meta.push('<span>compartido con ' + m.compartido + '</span>');
      signo = '−';
      if (m.cuotas > 1) extra = '<small>' + m.cuotas + ' cuotas</small>';
      else if (m.compartido) extra = '<small>tu parte ' + pesos(m.mio) + '</small>';
      else if (m.fijo) extra = '<small>gasto fijo</small>';
    } else if (m.tipo === 'Ingreso') {
      meta.push('<span>' + esc(m.cat) + '</span>');
      if (ctx !== m.cuenta && m.cuenta !== 'Mamá (regalo)') meta.push(esDeuda(m.cuenta) ? '<span>pagó</span>' + etiqueta(m.cuenta) : etiqueta(m.cuenta));
      signo = '+'; cls = 'in';
    } else if (m.tipo === 'Me pagaron') { if (ctx !== m.cuenta) meta.push(etiqueta(m.cuenta)); signo = '+'; cls = 'in'; extra = '<small>devolución</small>'; }
    else if (m.tipo === 'Me prestaron') { if (ctx !== m.cuenta) meta.push(etiqueta(m.cuenta)); signo = '+'; cls = 'mv'; extra = '<small>préstamo · le debes</small>'; }
    else if (m.tipo === 'Le pagué') { if (ctx !== m.cuenta) meta.push(etiqueta(m.cuenta)); signo = '−'; cls = 'mv'; extra = '<small>le devolviste</small>'; }
    else if (m.tipo === 'Transferencia') {
      meta.push(m.cuenta ? etiqueta(m.cuenta) + '<span>→</span>' + etiqueta(m.destino) : '<span>→</span>' + etiqueta(m.destino));
      if (ctx) { signo = ctx === m.cuenta ? '−' : '+'; cls = ctx === m.destino ? 'in' : ''; }
      else cls = 'mv';
      extra = '<small>' + (esDeuda(m.destino) ? 'pago' : esDeuda(m.cuenta) ? 'avance' : 'entre cuentas') + '</small>';
    } else if (m.tipo === 'Ajuste') { if (ctx !== m.cuenta) meta.push(etiqueta(m.cuenta)); cls = 'mv'; signo = m.monto < 0 ? '−' : '+'; extra = '<small>ajuste</small>'; }
    if (ctx && esDeuda(ctx)) {
      if (m.tipo === 'Gasto') { signo = '+'; cls = ''; }
      else if (m.tipo === 'Transferencia' && m.destino === ctx) { signo = '−'; cls = 'in'; }
      else if (m.tipo === 'Transferencia' && m.cuenta === ctx) { signo = '+'; cls = ''; }
      else if (m.tipo === 'Ingreso') { signo = '−'; cls = 'in'; }
    }
    var ico = icoComercio(m);
    var plan = m.id && PLANES['m:' + m.id];
    return '<div class="tx-row' + (plan ? ' tx-plan' : '') + '"' + (plan ? ' data-plan="' + esc(plan.id) + '" role="button" tabindex="0"' : '') + '>' + (ico ? '<div aria-hidden="true">' + ico + '</div>' : '<div class="ico" aria-hidden="true">' + esc(m.emoji) + '</div>') + '<div style="min-width:0"><div class="d">' + esc(m.desc) + '</div>' +
      '<div class="m">' + meta.join('<span>·</span>') + '</div>' + (plan ? miniPlan(plan) : '') + '</div><div class="a ' + cls + '">' + signo + pesos(Math.abs(m.monto)).replace('−', '') + extra + '</div></div>';
  }
  function listaAgrupada(items, ctx) {
    var html = '', mes = '';
    items.forEach(function (m) {
      if (m.fecha.slice(0, 7) !== mes) { mes = m.fecha.slice(0, 7); html += '<div class="tx-month">' + nombreMes(mes) + '</div>'; }
      html += filaMovimiento(m, ctx);
    });
    return html;
  }

  function vistaMovimientos() {
    var d = datos;
    app.appendChild(barraSuperior(d, false));
    var cats = {}, ctas = {};
    d.movimientos.forEach(function (m) { cats[grupoMov(m)] = 1; if (m.cuenta && m.cuenta !== 'Mamá (regalo)') ctas[m.cuenta] = 1; if (m.destino) ctas[m.destino] = 1; });
    var meses = {};
    d.movimientos.forEach(function (m) { meses[m.fecha.slice(0, 7)] = 1; });
    var opt = function (obj, sel, vacio) {
      return '<option value="">' + vacio + '</option>' + Object.keys(obj).sort().map(function (k) {
        return '<option value="' + esc(k) + '"' + (k === sel ? ' selected' : '') + '>' + esc(k.length === 7 && /^\d{4}-/.test(k) ? cap(nombreMes(k)) : k) + '</option>';
      }).join('');
    };
    var n = el('<section class="card"><div class="card-h"><h2>Movimientos</h2><span class="aside total-filtro"></span></div>' +
      '<div class="buscador"><label class="search">' + ICON.search + '<input type="search" placeholder="Buscar: Ara, Temu, gasolina…" value="' + esc(busq.q) + '" aria-label="Buscar movimientos"></label>' +
      '<div class="filters" role="group" aria-label="Tipo">' + ['todos:Todos', 'Gasto:Gastos', 'Ingreso:Entradas', 'Transferencia:Pagos y transferencias'].map(function (x) {
        var p = x.split(':'); return '<button type="button" data-f="' + p[0] + '" aria-pressed="' + (busq.tipo === p[0]) + '">' + p[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="fil-row"><select class="select" data-k="cat" aria-label="Categoría">' + opt(cats, busq.cat, 'Categoría: todas') + '</select>' +
      '<select class="select" data-k="cuenta" aria-label="Cuenta">' + opt(ctas, busq.cuenta, 'Cuenta: todas') + '</select>' +
      '<select class="select" data-k="mes" aria-label="Mes">' + opt(meses, busq.mes, 'Mes: todos') + '</select></div></div>' +
      '<div class="tx"></div></section>');
    app.appendChild(n);
    var cont = n.querySelector('.tx'), total = n.querySelector('.total-filtro');
    function filtrar() {
      var q = norm(busq.q);
      var items = d.movimientos.filter(function (m) {
        if (busq.tipo === 'Gasto' && m.tipo !== 'Gasto') return false;
        if (busq.tipo === 'Ingreso' && !(m.tipo === 'Ingreso' || m.tipo === 'Me pagaron' || m.tipo === 'Me prestaron')) return false;
        if (busq.tipo === 'Transferencia' && !(m.tipo === 'Transferencia' || m.tipo === 'Ajuste' || m.tipo === 'Le pagué')) return false;
        if (busq.cat && grupoMov(m) !== busq.cat) return false;
        if (busq.cuenta && m.cuenta !== busq.cuenta && m.destino !== busq.cuenta) return false;
        if (busq.mes && m.fecha.slice(0, 7) !== busq.mes) return false;
        if (q && norm(m.desc + ' ' + m.cat + ' ' + m.cuenta + ' ' + m.destino + ' ' + m.para).indexOf(q) < 0) return false;
        return true;
      });
      var suma = items.filter(function (m) { return m.tipo === 'Gasto'; }).reduce(function (s, m) { return s + (m.mio || m.monto); }, 0);
      total.innerHTML = items.length + ' movimiento' + (items.length === 1 ? '' : 's') + (suma ? ' · gastos <b>' + pesos(suma) + '</b>' : '');
      var ver = abiertos.movs ? items : items.slice(0, 40);
      cont.innerHTML = listaAgrupada(ver) || '<div class="empty">No hay movimientos con ese filtro.</div>';
      var viejo = n.querySelector('.ver-todo'); if (viejo) viejo.remove();
      if (items.length > 40 && !abiertos.movs) {
        var b = el('<button type="button" class="ver-todo">Ver los ' + items.length + ' movimientos</button>');
        b.addEventListener('click', function () { abiertos.movs = true; filtrar(); });
        n.appendChild(b);
      }
    }
    n.querySelector('input').addEventListener('input', function (e) { busq.q = e.target.value; filtrar(); });
    n.querySelectorAll('.filters button').forEach(function (b) {
      b.addEventListener('click', function () {
        busq.tipo = b.dataset.f;
        n.querySelectorAll('.filters button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        filtrar();
      });
    });
    n.querySelectorAll('select').forEach(function (s) { s.addEventListener('change', function () { busq[s.dataset.k] = s.value; filtrar(); }); });
    filtrar();
  }

  /* =================== CRÉDITOS =================== */
  function vistaCreditos() {
    var d = datos;
    app.appendChild(barraSuperior(d, false));
    app.appendChild(creditosCard(d));
    app.appendChild(cuentas(d));
    app.appendChild(agendaPlegable(d, d.proximos.filter(function (p) { return p.tipo === 'credito'; }), 'Calendario de pagos de tus créditos', 'agCred', 'pagos'));
    var fj = agendaPlegable(d, d.proximos.filter(function (p) { return p.tipo === 'fijo'; }), 'Gastos fijos y suscripciones', 'agFijos', 'gastos fijos');
    var adm = el('<button type="button" class="btn-mini">' + ICON.gear + ' Administrar</button>');
    adm.addEventListener('click', function () { if (window.MFAdmin) MFAdmin.fijos(); });
    fj.querySelector('.card-h').appendChild(adm);
    app.appendChild(fj);
  }

  // Agenda que muestra solo los 2 más próximos; al tocar "Ver…" se despliega el resto con la animación suave de la app.
  function agendaPlegable(d, lista, titulo, clave, palabra) {
    var n = el('<section class="card agenda-card"><div class="card-h"><h2>' + esc(titulo) + '</h2><span class="aside"></span></div><div class="agenda"></div></section>');
    var porPagar = 0;
    lista.forEach(function (p) { if (p.estado === 'pendiente' && p.dias <= 30) porPagar += p.monto; });
    n.querySelector('.aside').innerHTML = 'En 30 días <b>' + pesos(porPagar) + '</b>';
    var cont = n.querySelector('.agenda');
    if (!lista.length) { cont.appendChild(el('<div class="empty">No tienes pagos en los próximos 35 días.</div>')); return n; }
    var pend = lista.filter(function (p) { return p.estado === 'pendiente' || p.estado === 'automatico' || p.estado === 'cancelar'; });
    var primeros = (pend.length ? pend : lista).slice(0, 2);
    var resto = lista.filter(function (p) { return primeros.indexOf(p) < 0; });
    var pintarDias = function (items, dest) {
      var dia = '';
      items.forEach(function (p) {
        if (p.fecha !== dia) {
          dia = p.fecha;
          var f = fecha(p.fecha), rel = p.dias === 0 ? 'Hoy' : p.dias === 1 ? 'Mañana' : cap(DIAS[f.getDay()]);
          dest.appendChild(el('<div class="day">' + rel + ' · ' + fechaCorta(p.fecha) + '</div>'));
        }
        dest.appendChild(filaPago(p, d));
      });
    };
    pintarDias(primeros, cont);
    if (!resto.length) return n;
    var abierto = !!abiertos[clave];
    var pleg = el('<div class="plegable' + (abierto ? ' abierta' : '') + '"><div class="plegable-in agenda"></div></div>');
    pintarDias(resto, pleg.firstChild);
    cont.appendChild(pleg);
    var txt = function (a) { return a ? 'Ver menos' : 'Ver los ' + lista.length + ' ' + palabra; };
    var btn = el('<button type="button" class="ver-todo plegar" aria-expanded="' + abierto + '"><span>' + txt(abierto) + '</span>' + ICON.chevron + '</button>');
    btn.addEventListener('click', function () {
      abierto = !abierto; abiertos[clave] = abierto;
      pleg.classList.toggle('abierta', abierto); btn.classList.toggle('abierta', abierto);
      btn.setAttribute('aria-expanded', String(abierto)); btn.firstChild.textContent = txt(abierto);
    });
    if (abierto) btn.classList.add('abierta');
    n.appendChild(btn);
    return n;
  }

  /* =================== FAVORES (te deben / les debes) =================== */
  function mismaPersona(a, b) { return norm(a) === norm(b); }
  function listaLesDebo(d) {
    var out = (d.lesDebo || []).map(function (x) {
      return { persona: x.persona, saldo: x.saldo, aFavor: x.aFavor || 0, teDebe: x.teDebe || 0, prestamos: x.prestamos || [], devoluciones: x.devoluciones || [],
        prestado: (x.prestamos || []).reduce(function (s, m) { return s + m.monto; }, 0), devuelto: (x.devoluciones || []).reduce(function (s, m) { return s + m.monto; }, 0), credito: 0 };
    });
    var mama = d.creditos.find(function (c) { return c.persona; });
    if (mama && mama.saldo > 0) {
      var x = out.find(function (y) { return mismaPersona(y.persona, 'Mamá'); });
      if (!x) { x = { persona: 'Mamá', saldo: 0, aFavor: 0, teDebe: 0, prestamos: [], devoluciones: [], prestado: 0, devuelto: 0, credito: 0 }; out.push(x); }
      x.mama = true; x.persona = 'Mamá'; x.credito = mama.saldo; x.saldo += mama.saldo;
    }
    out.forEach(function (x) { var t = (d.meDeben || []).find(function (p) { return mismaPersona(p.persona, x.persona); }); x.teDebe = t ? t.saldo : 0; });
    return out.sort(function (a, b) { return b.saldo - a.saldo; });
  }
  function tambienLeDebo(d, persona) { var x = listaLesDebo(d).find(function (y) { return mismaPersona(y.persona, persona); }); return x ? x.saldo : 0; }
  function detalleDeudor(p) {
    function concepto(c, pagado, i) {
      var linea, abre = !pagado && c.detalle && c.detalle.length > 1, k = 'debc:' + p.persona + ':' + i, abierto = abre && abiertos[k];
      if (c.cuotas > 1) {
        linea = c.cuotas + ' cuotas mensuales de ' + pesos(c.valorCuota) + ' · lleva ' + c.cuotasPagadas + ' de ' + c.cuotas;
        if (!pagado && c.proxima) linea += '<br>Próxima: <b>' + pesos(c.proxima.monto) + '</b> el ' + fechaCorta(c.proxima.fecha) + (c.ultima ? ' · última el ' + fechaCorta(c.ultima) : '');
      } else linea = pagado ? 'Pagado' : 'De una sola vez' + (c.pendiente < c.total ? ' · te abonó ' + pesos(c.total - c.pendiente) : '');
      var pct = c.total > 0 ? Math.round((c.total - c.pendiente) / c.total * 100) : 100;
      var h = '<div class="deb-c' + (pagado ? ' done' : '') + (abre ? ' abre' : '') + (abierto ? ' open' : '') + '"' + (abre ? ' data-debc="' + esc(k) + '" role="button" tabindex="0" aria-expanded="' + !!abierto + '"' : '') + '>' +
        '<div class="deb-t"><span>' + esc(c.desc) + (abre ? ' <span class="chev">' + (abierto ? '▾' : '▸') + '</span>' : '') + '</span><b class="num">' + pesos(pagado ? c.total : c.pendiente) + '</b></div>' +
        '<div class="deb-s">' + (c.fecha ? fechaCorta(c.fecha) + ' · ' : '') + (c.cuenta ? etiqueta(c.cuenta) + ' · ' : '') + 'le tocó ' + pesos(c.total) + '</div>' +
        (c.cuotas > 1 && !pagado ? '<div class="plan-bar sm"><i style="width:' + pct + '%"></i></div>' : '') +
        '<div class="deb-s">' + linea + '</div>';
      if (abierto) {
        h += segmentos(c.detalle.map(function (u) { return { estado: u.pagado >= u.monto ? 'pagada' : u.fecha && u.fecha < datos.hoy ? 'vencida' : 'pendiente' }; }));
        h += '<div class="cuotas">' + c.detalle.map(function (u, j) {
          var est = u.pagado >= u.monto ? 'pagada' : u.fecha && u.fecha < datos.hoy ? 'vencida' : 'pendiente';
          return filaCuotaPlan({ n: j + 1, fecha: u.fecha, monto: u.monto, pagado: u.pagado, estado: est });
        }).join('') + '</div>';
        if (c.plan && PLANES[c.plan]) h += '<button type="button" class="btn link" data-plan="' + esc(c.plan) + '">Ver la compra completa en ' + esc(PLANES[c.plan].cuenta) + '</button>';
      }
      return h + '</div>';
    }
    var h = '<div class="deb">' + (p.conceptos || []).map(function (c, i) { return concepto(c, false, i); }).join('');
    if (p.vencido > 0) h += '<div class="deb-nota">A hoy ya debería haberte pagado <b>' + pesos(p.vencido) + '</b>.</div>';
    if (p.abonos && p.abonos.length) h += '<div class="deb-sub">Pagos que te ha hecho</div>' + p.abonos.map(function (a) {
      return '<div class="deb-t deb-ab"><span>' + fechaCorta(a.fecha) + ' · ' + esc(a.desc || 'Abono') + '</span><b class="num">+' + pesos(a.monto) + '</b></div>'; }).join('');
    if (p.pagados && p.pagados.length) h += '<div class="deb-sub">Ya saldado</div>' + p.pagados.map(function (c, i) { return concepto(c, true, 'p' + i); }).join('');
    return h + '</div>';
  }
  function vistaMeDeben() {
    var d = datos;
    app.appendChild(barraSuperior(d, false));
    var html = d.meDeben.map(function (p, i) {
      var abierto = abiertos['deb:' + p.persona];
      return '<div class="owed-item' + (abierto ? ' open' : '') + '"><div class="owed-row" role="button" tabindex="0" aria-expanded="' + !!abierto + '" data-i="' + i + '"><div><div class="p">' + esc(p.persona) +
        ' <span class="chev">' + (abierto ? '▾' : '▸') + '</span></div><div class="s">Le cubriste ' + pesos(p.prestado) +
        (p.pagado ? ' · te pagó ' + pesos(p.pagado) : '') + (p.vencido > 0 ? ' · <b class="venc">vencido ' + pesos(p.vencido) + '</b>' : '') +
        (tambienLeDebo(d, p.persona) ? ' · <b class="lede">tú le debes ' + pesos(tambienLeDebo(d, p.persona)) + '</b>' : '') + '</div></div><div class="v">' + pesos(p.saldo) + '</div></div>' +
        (abierto ? detalleDeudor(p) : '') + '</div>';
    }).join('');
    var lesDebo = listaLesDebo(d);
    var totLes = lesDebo.reduce(function (s, x) { return s + x.saldo; }, 0), neto = d.totalMeDeben - totLes;
    app.appendChild(el('<section class="card favores-top"><div><div class="eyebrow">Favores</div><h2>Plata entre tú y otras personas</h2></div>' +
      '<div class="fav-stats"><div class="stat"><div class="k">Te deben</div><div class="v num" style="color:var(--good)">' + pesos(d.totalMeDeben) + '</div></div>' +
      '<div class="stat"><div class="k">Les debes</div><div class="v num" style="color:var(--crit)">' + pesos(totLes) + '</div></div>' +
      '<div class="stat"><div class="k">Balance</div><div class="v num">' + (neto >= 0 ? '+' : '−') + pesos(Math.abs(neto)).replace('−', '') + '</div><div class="d">' + (neto >= 0 ? 'a tu favor' : 'en contra') + '</div></div></div></section>'));
    var sec = el('<section class="card"><div class="card-h"><h2>Te deben</h2><span class="aside">Total <b>' + pesos(d.totalMeDeben) + '</b></span></div>' +
      '<div class="owed">' + (html || '<div class="empty">Nadie te debe plata en este momento.</div>') + '</div>' +
      '<p class="hint">Toca un nombre para ver por qué te debe. Cuando alguien te pague, regístralo en el botón del celular: Ingreso → 🤝 Me pagaron.</p></section>');
    sec.querySelectorAll('.owed-row[data-i]').forEach(function (r) {
      function tocar() { var k = 'deb:' + d.meDeben[+r.dataset.i].persona; abiertos[k] = !abiertos[k]; pintar(); }
      r.addEventListener('click', tocar);
      r.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tocar(); } });
    });
    sec.querySelectorAll('[data-debc]').forEach(function (r) {
      function tocar(e) { if (e.target.closest('[data-plan]')) return; abiertos[r.dataset.debc] = !abiertos[r.dataset.debc]; var y = window.scrollY; pintar(); window.scrollTo(0, y); }
      r.addEventListener('click', tocar);
      r.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tocar(e); } });
    });
    app.appendChild(sec);
    // Les debes: préstamos que te hicieron, pagos de más a su favor y los préstamos de mamá para tus créditos.
    var htmlL = lesDebo.map(function (x, i) {
      var abierto = abiertos['les:' + x.persona];
      var sub = [];
      if (x.credito) sub.push('préstamos para tus pagos ' + pesos(x.credito));
      if (x.prestado) sub.push('te prestó ' + pesos(x.prestado));
      if (x.aFavor) sub.push('saldo a su favor ' + pesos(x.aFavor));
      if (x.devuelto) sub.push('le devolviste ' + pesos(x.devuelto));
      if (x.teDebe) sub.push('<b class="venc2">te debe ' + pesos(x.teDebe) + '</b>');
      var det = '';
      if (abierto) {
        var filas = [];
        x.prestamos.forEach(function (m) { filas.push('<div class="deb-t deb-ab"><span>' + fechaCorta(m.fecha) + ' · ' + esc(m.desc) + ' → ' + esc(m.cuenta) + '</span><b class="num">' + pesos(m.monto) + '</b></div>'); });
        var h2 = '<div class="deb">' + (filas.length ? '<div class="deb-sub">Lo que te prestó</div>' + filas.join('') : '');
        if (x.devoluciones.length) h2 += '<div class="deb-sub">Lo que le has devuelto</div>' + x.devoluciones.map(function (m) { return '<div class="deb-t deb-ab"><span>' + fechaCorta(m.fecha) + ' · desde ' + esc(m.cuenta) + '</span><b class="num">−' + pesos(m.monto) + '</b></div>'; }).join('');
        if (x.aFavor) h2 += '<div class="deb-nota">Te pagó ' + pesos(x.aFavor) + ' de más; quedó como saldo a su favor.</div>';
        if (x.credito) h2 += '<button type="button" class="btn link" data-mama>Ver los préstamos de mamá para tus créditos</button>';
        det = h2 + '</div>';
      }
      return '<div class="owed-item' + (abierto ? ' open' : '') + '"><div class="owed-row les" role="button" tabindex="0" data-l="' + i + '"><div><div class="p">' + (x.mama ? '👩 ' : '') + esc(x.persona) +
        ' <span class="chev">' + (abierto ? '▾' : '▸') + '</span></div><div class="s">' + sub.join(' · ') + '</div></div><div class="v">' + pesos(x.saldo) + '</div></div>' + det + '</div>';
    }).join('');
    var sl = el('<section class="card"><div class="card-h"><h2>Les debes</h2><span class="aside">Total <b>' + pesos(totLes) + '</b></span></div>' +
      '<div class="owed">' + (htmlL || '<div class="empty">No le debes plata a nadie. 🙌</div>') + '</div>' +
      '<p class="hint">Si alguien te presta: botón del celular → Ingreso → 🙋 Alguien me prestó plata. Para devolverle: 💳 Pagar → 🙋 Devolverle a…</p></section>');
    sl.querySelectorAll('.owed-row[data-l]').forEach(function (r) {
      r.addEventListener('click', function () { var k = 'les:' + lesDebo[+r.dataset.l].persona; abiertos[k] = !abiertos[k]; var y = window.scrollY; pintar(); window.scrollTo(0, y); });
    });
    sl.querySelectorAll('[data-mama]').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); ir('#/credito/Mam%C3%A1'); }); });
    app.appendChild(sl);
    // Últimos movimientos con personas
    var comp = d.movimientos.filter(function (m) { return m.tipo === 'Me pagaron' || m.tipo === 'Me prestaron' || m.tipo === 'Le pagué'; }).slice(0, 10);
    if (comp.length) app.appendChild(el('<section class="card"><div class="card-h"><h2>Últimos movimientos con personas</h2></div><div class="tx">' + comp.map(function (m) { return filaMovimiento(m); }).join('') + '</div></section>'));
  }

  /* =================== PÁGINA DE CUENTA =================== */
  function volver(hash, texto) {
    var b = el('<div><button class="btn back" type="button">' + ICON.back + texto + '</button></div>');
    b.querySelector('button').addEventListener('click', function () { if (history.length > 1) history.back(); else ir(hash); });
    return b;
  }
  function cabecera(nombre, sub, grande, serie, extra, stats) {
    var c = colorMarca(nombre);
    return el('<section class="detail-head" style="--c:' + c + '"><div class="dh-top"><div class="dh-main"><div class="who">' + logo(nombre, false, true) +
      '<div><h1>' + esc(nombre) + '</h1><div class="kind">' + sub + '</div></div></div>' + grande + '</div><div class="dh-plastic">' + plastico(nombre) + '</div></div>' +
      '<div>' + sparkline(serie, c, 90).replace('class="spark"', 'class="spark-big"') + '</div>' + (extra || '') +
      '<div class="stats">' + stats + '</div></section>');
  }
  function paginaCuenta(nombre) {
    var d = datos, c = d.cuentas.find(function (x) { return x.nombre === nombre; }) || { nombre: nombre, saldo: 0, serie: [] };
    var movs = d.movimientos.filter(function (m) { return m.cuenta === nombre || m.destino === nombre; });
    var entra = 0, sale = 0, nMes = 0;
    movs.forEach(function (m) {
      if (m.fecha.slice(0, 7) !== d.mes || m.hist) return;
      nMes++;
      if (m.tipo === 'Gasto') sale += m.monto;
      else if (m.tipo === 'Ingreso' || m.tipo === 'Me pagaron' || m.tipo === 'Me prestaron') entra += m.monto;
      else if (m.tipo === 'Le pagué') sale += m.monto;
      else if (m.tipo === 'Transferencia') { if (m.destino === nombre) entra += m.monto; else sale += m.monto; }
      else if (m.tipo === 'Ajuste') { if (m.monto > 0) entra += m.monto; else sale -= m.monto; }
    });
    app.appendChild(volver('#/inicio', 'Volver'));
    var sub = c.apartaPara ? 'Bolsillo para ' + esc(c.apartaPara) + (c.alimentaDesde ? ' · dentro de ' + esc(c.alimentaDesde) : '') : 'Cuenta';
    var extra = '';
    if (c.apartaPara) {
      var cr = d.creditos.find(function (x) { return x.nombre === c.apartaPara; });
      if (cr) {
        var meta = cr.proximo ? cr.proximo.monto : cr.saldo, pct = meta > 0 ? Math.min(100, Math.round(c.saldo / meta * 100)) : 100;
        extra = '<div class="util" style="font-size:.85rem;color:var(--ink-2)"><span>Cubre el ' + pct + ' % del próximo pago de ' + esc(cr.nombre) + ' (' + pesos(meta) + ')</span>' +
          '<div class="meter big ' + (pct >= 100 ? 'ok' : pct >= 50 ? '' : 'warn') + '"><i style="width:' + pct + '%"></i></div></div>';
      }
    }
    var mesN = MESES[+d.mes.split('-')[1] - 1];
    app.appendChild(cabecera(nombre, sub,
      '<div><div class="eyebrow" style="color:var(--muted)">Saldo actual</div><div class="big num"' + (c.saldo < 0 ? ' style="color:var(--crit)"' : '') + '>' + pesos(c.saldo) + '</div></div>',
      c.serie, extra,
      '<div class="stat"><div class="k">Entró en ' + mesN + '</div><div class="v num" style="color:var(--good)">+' + pesos(entra) + '</div></div>' +
      '<div class="stat"><div class="k">Salió en ' + mesN + '</div><div class="v num">−' + pesos(sale) + '</div></div>' +
      '<div class="stat"><div class="k">Movimientos del mes</div><div class="v num">' + nMes + '</div></div>'));
    app.appendChild(listaCorta('Movimientos de ' + nombre, movs, nombre, 'movsCuenta', 10, 'Aún no hay movimientos en esta cuenta.'));
  }

  function listaCorta(titulo, items, ctx, clave, n, vacio) {
    var s = el('<section class="card"><div class="card-h"><h2>' + esc(titulo) + '</h2><span class="aside">' + items.length + '</span></div><div class="tx"></div></section>');
    var ver = abiertos[clave] ? items : items.slice(0, n);
    s.querySelector('.tx').innerHTML = listaAgrupada(ver, ctx) || '<div class="empty">' + vacio + '</div>';
    if (items.length > n) s.appendChild(botonVerTodo(clave, items.length, 'Ver menos', 'Ver todos ({n})'));
    return s;
  }

  /* =================== PÁGINA DE CRÉDITO =================== */
  /** Qué cuotas se ven sin desplegar: la próxima; en Credifin, todas las del mes (y las del siguiente si faltan menos de 15 días para que termine). */
  function calendarioVisible(c, hoyS) {
    if (!c.calendario.length) return [];
    if (c.modo !== 'Por compra') return c.calendario.slice(0, 1);
    var hoyD = fecha(hoyS), finMes = new Date(hoyD.getFullYear(), hoyD.getMonth() + 1, 0);
    var faltan = Math.round((finMes - hoyD) / 86400000);
    var esteMes = hoyS.slice(0, 7);
    var sig = new Date(hoyD.getFullYear(), hoyD.getMonth() + 1, 1);
    var mesSig = sig.getFullYear() + '-' + String(sig.getMonth() + 1).padStart(2, '0');
    var vis = c.calendario.filter(function (g) { var k = g.fecha.slice(0, 7); return k <= esteMes || (faltan < 15 && k === mesSig); });
    return vis.length ? vis : c.calendario.slice(0, 1);
  }
  function filaCuota(g) {
    var f = fecha(g.fecha);
    return '<div class="sched-row"><div class="date">' + f.getDate() + ' ' + MES_C[f.getMonth()] + '<small>' + f.getFullYear() + '</small></div>' +
      '<div class="v">' + pesos(g.monto) + '<div style="margin-top:6px">' + (g.dias <= 30 ? chipDias(g.dias) : '') + '</div></div>' +
      '<ul>' + g.detalle.map(function (x) { return '<li><span>' + esc(x.desc) + '</span><span>' + pesos(x.monto) + '</span></li>'; }).join('') + '</ul></div>';
  }
  function paginaCredito(nombre) {
    var d = datos, c = d.creditos.find(function (x) { return x.nombre === nombre; });
    if (!c) { ir('#/creditos'); return; }
    var movs = d.movimientos.filter(function (m) { return m.cuenta === nombre || m.destino === nombre; });
    var comprasMes = 0, pagosMes = 0;
    movs.forEach(function (m) {
      if (m.fecha.slice(0, 7) !== d.mes) return;
      if (m.tipo === 'Gasto' && m.cuenta === nombre) comprasMes += m.monto;
      if ((m.tipo === 'Transferencia' && m.destino === nombre) || (m.tipo === 'Ingreso' && m.cuenta === nombre)) pagosMes += m.monto;
    });
    app.appendChild(volver('#/creditos', 'Volver'));
    var extra = '';
    if (c.cupo > 0) {
      var pct = Math.round(c.saldo / c.cupo * 100);
      extra += '<div class="util" style="font-size:.85rem;color:var(--ink-2)"><span>Usas ' + pct + ' % del cupo · disponible ' + pesos(Math.max(0, c.cupo - c.saldo)) + ' de ' + pesos(c.cupo) + '</span>' +
        '<div class="meter big ' + (pct >= 85 ? 'crit' : pct >= 60 ? 'warn' : '') + '"><i style="width:' + Math.min(100, Math.max(0, pct)) + '%"></i></div></div>';
    }
    if (c.reto) {
      var ok = c.reto.hechas >= c.reto.minimo, rp = Math.min(100, Math.round(c.reto.hechas / c.reto.minimo * 100));
      extra += '<div class="util" style="font-size:.85rem;color:var(--ink-2)"><span>' + (ok ? 'Reto cumplido: ' : 'Reto del mes: ') + c.reto.hechas + ' de ' + c.reto.minimo + ' compras' +
        (ok ? ' · sin cuota de manejo' : ' · faltan ' + (c.reto.minimo - c.reto.hechas) + ' en ' + c.reto.diasRestantes + ' día' + (c.reto.diasRestantes === 1 ? '' : 's')) + '</span>' +
        '<div class="meter big ' + (ok ? 'ok' : c.reto.diasRestantes <= 3 ? 'crit' : 'warn') + '"><i style="width:' + rp + '%"></i></div></div>';
    }
    if (c.bolsillo) {
      var meta = c.proximo ? c.proximo.monto : c.saldo, bp = meta > 0 ? Math.min(100, Math.round(c.apartado / meta * 100)) : 100;
      extra += '<div class="util" style="font-size:.85rem;color:var(--ink-2)"><span>Apartado en ' + esc(c.bolsillo) + ': ' + pesos(c.apartado) + ' · cubre el ' + bp + ' % del próximo pago</span>' +
        '<div class="meter big ' + (bp >= 100 ? 'ok' : bp >= 50 ? '' : 'warn') + '"><i style="width:' + bp + '%"></i></div></div>';
    }
    var prox = c.proximo ? '<div class="stat"><div class="k">Próximo pago · ' + fechaCorta(c.proximo.fecha) + '</div><div class="v num">' + pesos(c.proximo.monto) + '</div><div class="d">' + chipDias(c.proximo.dias) + '</div></div>'
      : '<div class="stat"><div class="k">Próximo pago</div><div class="v num">$0</div><div class="d">' + (c.persona ? 'Sin fecha fija' : 'Al día') + '</div></div>';
    var mesN = MESES[+d.mes.split('-')[1] - 1];
    app.appendChild(cabecera(nombre, c.persona ? 'Préstamos de tu mamá · sin intereses' : 'Crédito',
      '<div><div class="eyebrow" style="color:var(--muted)">' + (c.persona ? 'Le debes' : 'Debes') + '</div><div class="big num">' + pesos(c.saldo) + '</div></div>',
      c.serie, extra,
      prox +
      '<div class="stat"><div class="k">Compras en ' + mesN + '</div><div class="v num">' + pesos(comprasMes) + '</div></div>' +
      '<div class="stat"><div class="k">Pagos en ' + mesN + '</div><div class="v num" style="color:var(--good)">' + pesos(pagosMes) + '</div></div>' +
      (c.persona ? '' : '<div class="stat"><div class="k">Intereses y cargos' + (c.cicloDesde ? ' · ciclo actual' : '') + '</div><div class="v num">' + pesos(c.intereses) + '</div><div class="d">' +
        (c.cicloDesde ? 'Del ' + fechaCorta(c.cicloDesde) + (c.corteEst ? ' al ' + fechaCorta(c.corteEst) : ' a hoy') + (c.interesesEst > 0 ? ' · ' + pesos(c.interesesEst) + ' estimados de compras a cuotas' : '') :
          c.interesesEst > 0 ? 'incluye ' + pesos(c.interesesEst) + ' estimados de compras a cuotas' + (c.corteEst ? ' al corte del ' + fechaCorta(c.corteEst) : ' a la próxima cuota') : 'intereses, seguros y comisiones') + '</div></div>')));

    // Calendario: comprimido
    var vis = calendarioVisible(c, d.hoy);
    var todos = abiertos.cal;
    var sched = (todos ? c.calendario : vis).map(filaCuota).join('');
    if (todos && c.sinFecha > 0) sched += '<div class="sched-row"><div class="date">—<small>sin fecha</small></div><div class="v">' + pesos(c.sinFecha) + '</div><ul><li><span>Saldo sin calendario</span></li></ul></div>';
    var cal = el('<section class="card"><div class="card-h"><h2>' + (todos ? 'Calendario de pagos' : c.modo === 'Por compra' ? 'Cuotas por pagar pronto' : 'Próximo pago') + '</h2>' +
      '<span class="aside">' + c.calendario.length + ' fecha' + (c.calendario.length === 1 ? '' : 's') + '</span></div>' +
      '<div class="sched">' + (sched || '<div class="empty">' + (c.sinFecha > 0 ? 'Saldo sin fecha: ' + pesos(c.sinFecha) : 'No tienes cuotas pendientes.') + '</div>') + '</div></section>');
    if (c.calendario.length > vis.length || (c.sinFecha > 0 && c.calendario.length)) cal.appendChild(botonVerTodo('cal', c.calendario.length, 'Ver menos', 'Ver calendario completo ({n} fechas)'));
    app.appendChild(cal);
    if (c.planes && c.planes.length) app.appendChild(seccionPlanes(c));
    app.appendChild(listaCorta('Compras y pagos', movs, nombre, 'movsCred', 10, 'Aún no hay compras ni pagos registrados con este crédito.'));
  }


  /* =================== TEMA CLARO / OSCURO =================== */
  var temaGuardado = leerLocal('tema');
  var mqClaro = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function temaActual() { return temaGuardado || (mqClaro && mqClaro.matches ? 'claro' : 'oscuro'); }
  function aplicarTema() {
    var claro = temaActual() === 'claro';
    document.documentElement.setAttribute('data-theme', claro ? 'light' : 'dark');
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', claro ? '#f3f5fb' : '#050912');
  }
  aplicarTema();
  if (mqClaro && mqClaro.addEventListener) mqClaro.addEventListener('change', function () { if (!temaGuardado) { aplicarTema(); pintar(); } });

  /* =================== PLANES DE PAGO DE CADA COMPRA =================== */
  var PLANES = {};
  function indexarPlanes() {
    PLANES = {};
    ((datos && datos.creditos) || []).forEach(function (c) {
      (c.planes || []).forEach(function (p) { PLANES[p.id] = p; if (p.mov) PLANES['m:' + p.mov] = p; });
    });
  }
  function pctPlan(p) { return p.monto > 0 ? Math.max(0, Math.min(100, Math.round((1 - p.capitalPendiente / p.monto) * 100))) : 0; }
  function miniPlan(p) {
    return '<div class="mini-plan"><div class="plan-bar sm"><i style="width:' + pctPlan(p) + '%"></i></div><span>' + p.pagadas + '/' + p.cuotas + '</span></div>';
  }
  function segmentos(lista) {
    return '<div class="segs" aria-hidden="true">' + lista.map(function (x) { return '<i class="' + x.estado + '"></i>'; }).join('') + '</div>';
  }
  var ESTADO = { pagada: 'Pagada', pendiente: 'Pendiente', vencida: 'Vencida' };
  function filaCuotaPlan(x) {
    var txt = x.extracto && x.estado !== 'pagada' ? 'En el extracto' : ESTADO[x.estado] || x.estado;
    if (x.estado !== 'pagada' && x.pagado > 0) txt = 'Abonada ' + pesos(x.pagado);
    return '<div class="cuota ' + x.estado + '"><span class="n">' + x.n + '</span><span class="f">' + (x.fecha ? fechaCorta(x.fecha) + ' ' + x.fecha.slice(0, 4) : 'Sin fecha') + '</span>' +
      '<b class="num">' + pesos(x.monto) + '</b><span class="est">' + txt + '</span></div>';
  }
  function icoPlan(p) { return icoComercio({ desc: p.desc, cat: '', tipo: 'Gasto' }) || logo(p.cuenta); }
  function filaPlan(p) {
    var pct = pctPlan(p);
    return '<button type="button" class="plan-row" data-plan="' + esc(p.id) + '"><div class="pi">' + icoPlan(p) + '</div><div class="pb">' +
      '<div class="pt"><span>' + esc(p.desc) + '</span><b class="num">' + pesos(p.monto) + '</b></div>' +
      '<div class="plan-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="ps"><span>' + (p.pendiente > 0 ? 'Capital pendiente' : 'Pagada') + ' · ' + p.pagadas + ' de ' + p.cuotas + ' cuotas</span><span class="num">' + (p.pendiente > 0 ? pesos(p.capitalPendiente) : '✓') + '</span></div></div></button>';
  }
  function seccionPlanes(c) {
    var act = c.planes.filter(function (p) { return p.pendiente > 0; }), fin = c.planes.filter(function (p) { return p.pendiente <= 0; });
    var ver = abiertos.planes ? c.planes : act.slice(0, 6);
    var s = el('<section class="card"><div class="card-h"><h2>Compras a cuotas</h2><span class="aside">Capital pendiente <b>' +
      pesos(act.reduce(function (t, p) { return t + p.capitalPendiente; }, 0)) + '</b></span></div><div class="plan-list">' + ver.map(filaPlan).join('') + '</div>' +
      '<p class="hint">Toca una compra para ver sus cuotas, fechas y cuáles ya pagaste.</p></section>');
    if (c.planes.length > ver.length || abiertos.planes) s.appendChild(botonVerTodo('planes', c.planes.length, 'Ver menos', 'Ver todas (' + act.length + ' activas' + (fin.length ? ', ' + fin.length + ' pagadas' : '') + ')'));
    return s;
  }
  var hojaAbierta = null;
  // Cierra el detalle. Con "animar" (cuando lo cierras tú) baja suavemente; al cambiar de pantalla se quita al instante.
  function cerrarHoja(animar) {
    if (!hojaAbierta) return;
    var h = hojaAbierta; hojaAbierta = null; document.body.classList.remove('con-hoja');
    if (animar === true && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      h.classList.add('cerrando'); h.style.pointerEvents = 'none';
      setTimeout(function () { h.remove(); }, 320);
    } else h.remove();
    if (repintarAlCerrar) setTimeout(pintarSuave, animar === true ? 330 : 0);
  }
  function abrirPlan(p) {
    cerrarHoja();
    var pct = pctPlan(p);
    var hoja = el('<div class="sheet-bg es-plan" role="dialog" aria-modal="true" aria-label="Plan de pagos de ' + esc(p.desc) + '"><div class="sheet glass-sheet">' +
      '<div class="sheet-h"><div class="who">' + icoPlan(p) + '<div><h2>' + esc(p.desc) + '</h2><div class="kind">' + etiqueta(p.cuenta) +
      (p.fecha ? ' · compra del ' + fechaCorta(p.fecha) + ' ' + p.fecha.slice(0, 4) : '') + '</div></div></div>' +
      '<button type="button" class="icon-btn" data-cerrar aria-label="Cerrar">' + ICON.close + '</button></div>' +
      '<div class="plan-top"><div><div class="k">Capital pendiente</div><div class="big num">' + pesos(p.capitalPendiente) + '</div>' +
      '<div class="k">de ' + pesos(p.monto) + ' · ' + pct + ' % pagado</div></div>' +
      '<div class="plan-meta"><span><b>' + p.pagadas + '</b> de ' + p.cuotas + ' cuotas</span><span>Cuota ' + pesos(p.valorCuota) + '</span>' +
      (p.proxima ? '<span>Próxima ' + fechaCorta(p.proxima.fecha) + '</span>' : '<span class="ok">Pagada</span>') + '</div></div>' +
      '<div class="plan-bar lg"><i style="width:' + pct + '%"></i></div>' + segmentos(p.detalle) +
      '<div class="cuotas">' + p.detalle.map(filaCuotaPlan).join('') + '</div>' +
      '<p class="hint">' + (p.pendiente > 0 ? 'Te falta pagar ' + pesos(p.pendiente) + (p.pendiente > p.capitalPendiente + 5 ? ' con intereses y cargos' : '') + '. ' : '') +
      (p.capitalApp ? 'El capital sale de la app de Addi y baja a medida que pagas las cuotas. ' : '') +
      (p.estimado ? 'Fechas estimadas con el ciclo de la tarjeta. ' : '') + 'Las cuotas se marcan pagadas a medida que registras pagos al crédito.</p>' +
      '<button type="button" class="btn" data-ir>Ver ' + esc(p.cuenta) + '</button></div></div>');
    hoja.addEventListener('click', function (e) {
      if (e.target === hoja || e.target.closest('[data-cerrar]')) cerrarHoja(true);
      else if (e.target.closest('[data-ir]')) { var dest = '#/credito/' + encodeURIComponent(p.cuenta); cerrarHoja(); if (location.hash !== dest) ir(dest); }
    });
    document.body.appendChild(hoja); document.body.classList.add('con-hoja'); hojaAbierta = hoja;
    var b = hoja.querySelector('[data-cerrar]'); if (b) b.focus();
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') cerrarHoja(true);
    var r = e.target.closest && e.target.closest('.tx-row[data-plan]');
    if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (PLANES[r.dataset.plan]) abrirPlan(PLANES[r.dataset.plan]); }
  });
  document.addEventListener('click', function (e) {
    if (hojaAbierta && hojaAbierta.classList.contains('es-plan') && hojaAbierta.contains(e.target)) return;
    var r = e.target.closest('[data-plan]');
    if (r && PLANES[r.dataset.plan]) { e.stopPropagation(); abrirPlan(PLANES[r.dataset.plan]); }
  }, true);

  /* =================== BILLETERA: TUS TARJETAS =================== */
  var PLASTICOS = {
    'TC Nubank': { img: 'cards/nubank.webp', nombre: 'Nu Mastercard Gold' },
    'TC Davibank': { img: 'cards/davibank.webp', nombre: 'Davibank Cencosud Visa Oro' },
    'Nequi': { img: 'cards/nequi.webp', nombre: 'Tarjeta Nequi Visa débito' },
    'Daviplata': { img: 'cards/daviplata.webp', nombre: 'MasterDebit Daviplata' }
  };
  function plastico(nombre) {
    var t = PLASTICOS[nombre];
    if (t) return '<div class="plastic"><img src="' + t.img + '" alt="' + esc(t.nombre) + '" loading="lazy" decoding="async"></div>';
    var e = ent(nombre) || {}, c = colorMarca(nombre);
    var tipo = nombre === 'Mamá' ? 'Préstamo familiar' : e.tipo === 'Deuda' ? 'Crédito' : /bolsillo/i.test(nombre) ? 'Bolsillo' : nombre === 'Efectivo' ? 'Efectivo' : 'Cuenta';
    return '<div class="plastic virtual" style="--bc:' + c + '"><div class="v-top">' + logo(nombre) + '<span>' + tipo + '</span></div>' +
      '<div class="v-name">' + esc(nombre.replace(/^Bolsillo Daviplata /, 'Bolsillo · ')) + '</div><svg class="v-wave" viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 90 C 80 40, 150 130, 300 50 L300 120 L0 120Z"/></svg></div>';
  }
  // Billetera: "Deslizar" (carrusel) o "Apilar" (bolsillo con las tarjetas asomando). Se recuerda en este dispositivo.
  var modoBilletera = leerLocal('billetera') === 'apilar' ? 'apilar' : 'deslizar', bolSel = null;
  function billetera(d) {
    var cred = d.creditos.filter(function (c) { return !c.persona; });
    var items = [];
    cred.forEach(function (c) { items.push({ nombre: c.nombre, deuda: true, x: c }); });
    d.cuentas.forEach(function (c) { items.push({ nombre: c.nombre, deuda: false, x: c }); });
    items.sort(function (a, b) { return (PLASTICOS[b.nombre] ? 1 : 0) - (PLASTICOS[a.nombre] ? 1 : 0); });
    items.forEach(function (it) {
      var c = it.x, info = '';
      if (it.deuda) {
        if (c.proximo) info = 'Próx. ' + pesos(c.proximo.monto) + ' · ' + fechaCorta(c.proximo.fecha);
        if (c.cupo > 0) info += (info ? ' · ' : '') + Math.round(c.saldo / c.cupo * 100) + ' % del cupo';
      } else if (c.apartaPara) info = 'Para ' + c.apartaPara;
      it.info = info;
      it.ruta = (it.deuda ? '#/credito/' : '#/cuenta/') + encodeURIComponent(it.nombre);
    });
    var apilar = modoBilletera === 'apilar';
    var n = el('<section class="card wallet-card' + (apilar ? ' apilada' : '') + '"><div class="card-h"><h2>Tu billetera</h2>' +
      '<div class="seg-mini" role="group" aria-label="Cómo ver tus tarjetas"><button type="button" data-bm="deslizar" aria-pressed="' + !apilar + '">Deslizar</button>' +
      '<button type="button" data-bm="apilar" aria-pressed="' + apilar + '">Apilar</button></div></div></section>');
    n.querySelectorAll('[data-bm]').forEach(function (b) {
      b.addEventListener('click', function () { modoBilletera = b.dataset.bm; bolSel = null; guardarLocal('billetera', modoBilletera); pintarSuave(); });
    });
    if (apilar) { n.appendChild(bolsillo(d, items)); return n; }
    n.appendChild(el('<p class="aside wallet-tot">Tienes <b>' + pesos(d.totalPlata) + '</b> · Debes <b>' + pesos(d.totalDeudas) + '</b></p>'));
    var w = el('<div class="wallet" role="list"></div>');
    items.forEach(function (it) {
      var c = it.x;
      var b = el('<button type="button" class="wcard" role="listitem" aria-label="' + esc(it.nombre) + '">' + plastico(it.nombre) +
        '<div class="wstrip"><div><span class="k">' + (it.deuda ? 'Debes' : 'Saldo') + '</span><b class="num">' + pesos(c.saldo) + '</b></div>' +
        (it.info ? '<span class="s">' + esc(it.info) + '</span>' : '') + '</div></button>');
      b.addEventListener('click', function () { ir(it.ruta); });
      w.appendChild(b);
    });
    n.appendChild(w);
    return n;
  }
  function bolsillo(d, items) {
    var porNombre = {};
    items.forEach(function (it) { porNombre[it.nombre] = it; });
    // Cada tarjeta se abre en su mismo lugar de la pila: las de arriba siguen encima y las de abajo se corren.
    var h = '<div class="bolsillo"><div class="bol-pila">' + items.map(function (it, i) {
      var ab = it.nombre === bolSel;
      // Capas: cada tarjeta queda por debajo de las que están más arriba en la pila.
      return '<div class="bol-item' + (ab ? ' abierta' : '') + '" data-n="' + esc(it.nombre) + '" style="z-index:' + (items.length - i) + '">' +
        '<button type="button" class="bol-tira" aria-expanded="' + ab + '" aria-label="' + esc(it.nombre) + '">' + plastico(it.nombre) +
        '<span class="bol-top"><span class="nm">' + esc(it.nombre.replace(/^Bolsillo Daviplata /, 'Bolsillo · ')) + '</span><b class="num">' + pesos(it.x.saldo) + '</b></span></button>' +
        '<div class="bol-exp"><div class="bol-exp-in"><div class="bol-det"><div><span class="k">' + (it.deuda ? 'Debes' : 'Saldo') + '</span>' +
        '<b class="num' + (it.deuda ? ' rojo' : '') + '">' + pesos(it.x.saldo) + '</b>' + (it.info ? '<span class="s">' + esc(it.info) + '</span>' : '') + '</div>' +
        '<button type="button" class="bol-ver" data-ver' + (ab ? '' : ' tabindex="-1"') + '>Ver detalle ' + ICON.right + '</button></div></div></div></div>';
    }).join('') + '</div>';
    h += '<div class="bol-bolsa"><svg class="bol-boca" viewBox="0 0 358 34" preserveAspectRatio="none" aria-hidden="true"><path class="f" d="M0 34 V26 Q0 4 22 4 H112 C140 4 150 30 179 30 C208 30 218 4 246 4 H336 Q358 4 358 26 V34 Z"/>' +
      '<path class="c" d="M8 34 V27 Q8 11 24 11 H112 C142 11 150 36 179 36 C208 36 216 11 246 11 H334 Q350 11 350 27 V34"/></svg>' +
      '<div class="bol-cuerpo"><div class="bol-cost"><span class="k">Tienes en tus cuentas</span><b class="num">' + pesos(d.totalPlata) + '</b>' +
      '<span class="s">Debes en créditos <b class="rojo">' + pesos(d.totalDeudas) + '</b></span>' +
      '<button type="button" class="bol-ojo" data-ojo>' + (oculto ? ICON.eye + ' Mostrar saldos' : ICON.eyeOff + ' Ocultar saldos') + '</button></div></div></div></div>';
    var nodo = el(h), quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // La franja crece de 64 px a la altura real de la tarjeta (y vuelve), con la misma curva suave del resto de la app.
    var mover = function (item, abrir) {
      var tira = item.querySelector('.bol-tira');
      tira.setAttribute('aria-expanded', String(abrir));
      item.querySelector('[data-ver]').tabIndex = abrir ? 0 : -1;
      if (quieto) { item.classList.toggle('abierta', abrir); return; }
      var desde = tira.getBoundingClientRect().height;
      tira.style.transition = 'none';                 // medir sin disparar transiciones intermedias
      item.classList.toggle('abierta', abrir);
      tira.style.height = '';
      var hasta = tira.getBoundingClientRect().height;
      tira.style.height = desde + 'px';
      void tira.offsetHeight;
      tira.style.transition = '';
      tira.style.height = hasta + 'px';
      var fin = function (e) { if (e.propertyName !== 'height') return; tira.removeEventListener('transitionend', fin); tira.style.height = ''; };
      tira.addEventListener('transitionend', fin);
    };
    // De abajo hacia arriba: el bolsillo se queda quieto en la pantalla y la tarjeta sube de él;
    // las tarjetas de arriba se corren hacia arriba (compensando el scroll mientras dura la animación).
    var fijarBolsillo = function () {
      if (quieto) return;
      var bolsa = nodo.querySelector('.bol-bolsa'), y0 = bolsa.getBoundingClientRect().top, t0 = performance.now();
      document.documentElement.style.overflowAnchor = 'none';
      (function paso(t) {
        var dy = bolsa.getBoundingClientRect().top - y0;
        var ab = nodo.querySelector('.bol-item.abierta .bol-tira');
        if (dy > 0 && ab) dy = Math.min(dy, Math.max(0, ab.getBoundingClientRect().top - 72));   // que la tarjeta no se salga por arriba
        if (Math.abs(dy) >= 0.5) window.scrollBy(0, dy);
        y0 = bolsa.getBoundingClientRect().top;
        if (t - t0 < 560) requestAnimationFrame(paso);
        else document.documentElement.style.overflowAnchor = '';
      })(t0);
    };
    nodo.querySelectorAll('.bol-item').forEach(function (item) {
      item.querySelector('.bol-tira').addEventListener('click', function () {
        var n = item.dataset.n, antes = bolSel;
        if (antes && antes !== n) { var otra = nodo.querySelector('.bol-item.abierta'); if (otra) mover(otra, false); }
        bolSel = antes === n ? null : n;
        mover(item, bolSel === n);
        fijarBolsillo();
      });
      item.querySelector('[data-ver]').addEventListener('click', function () { ir(porNombre[item.dataset.n].ruta); });
    });
    nodo.querySelector('[data-ojo]').addEventListener('click', function () { oculto = !oculto; guardarLocal('ocultar', oculto ? '1' : '0'); pintarSuave(); });
    return nodo;
  }



  /* =================== CALENDARIO =================== */
  var calMes = null, calModo = 'pagos', calSel = null;
  var DIAS_C = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  function clave7(dt) { return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0'); }
  function iso(dt) { return clave7(dt) + '-' + String(dt.getDate()).padStart(2, '0'); }
  function eventosPagos(d) {
    var ev = [];
    d.creditos.forEach(function (c) {
      var lista = c.pagosCal && c.pagosCal.length ? c.pagosCal : (c.calendario || []).map(function (g) { return { fecha: g.fecha, monto: g.monto, restante: g.monto }; });
      var primera = lista.filter(function (x) { return x.restante > 0; })[0];
      lista.forEach(function (x) {
        ev.push({ fecha: x.fecha, tipo: 'credito', nombre: c.nombre, minimo: x.restante > 0 ? x.restante : x.monto,
          total: x === primera && !c.persona && c.saldo > x.restante + 1 ? c.saldo : 0,
          estado: x.restante <= 0 ? 'pagado' : x.fecha < d.hoy ? 'vencido' : 'pendiente', link: '#/credito/' + encodeURIComponent(c.nombre) });
      });
    });
    var fijos = d.calFijos || d.proximos.filter(function (p) { return p.tipo === 'fijo'; }).map(function (p) {
      return { nombre: p.nombre, fecha: p.fecha, valor: p.monto, pagado: p.estado === 'pagado' || p.estado === 'cobrado', cobro: p.estado === 'automatico' ? 'Automático' : 'Manual', cuenta: p.cuenta };
    });
    fijos.forEach(function (o) {
      ev.push({ fecha: o.fecha, tipo: 'fijo', nombre: o.nombre, minimo: o.valor, auto: o.cobro === 'Automático', cuenta: o.cuenta,
        estado: o.pagado ? 'pagado' : o.fecha < d.hoy ? 'vencido' : 'pendiente', link: esDeuda(o.cuenta) ? '#/credito/' + encodeURIComponent(o.cuenta) : '#/creditos' });
    });
    d.movimientos.forEach(function (m) {
      if ((m.tipo === 'Ingreso' || m.tipo === 'Me pagaron') && !m.hist && m.cuenta !== 'Mamá (regalo)' && !esDeuda(m.cuenta)) {
        ev.push({ fecha: m.fecha, tipo: 'ingreso', nombre: m.tipo === 'Me pagaron' ? m.desc : (m.desc || m.cat), minimo: m.monto, estado: 'ingreso', cuenta: m.cuenta, link: '#/cuenta/' + encodeURIComponent(m.cuenta) });
      }
    });
    return ev;
  }
  function gastosPorDia(d) {
    var g = {};
    d.movimientos.forEach(function (m) {
      if (m.tipo !== 'Gasto' || m.resumen === false) return;
      var v = m.mio != null ? m.mio : m.monto;
      if (v > 0) g[m.fecha] = (g[m.fecha] || 0) + v;
    });
    return g;
  }
  function colorMov(m) {
    if (m.tipo === 'Ingreso' || m.tipo === 'Me pagaron') return 'ingreso';
    if (m.tipo === 'Gasto') return esDeuda(m.cuenta) ? 'credito' : 'gasto';
    if (m.tipo === 'Transferencia' && esDeuda(m.destino)) return 'pago';
    return 'mov';
  }
  function unicos(l) { return l.filter(function (x, i) { return l.indexOf(x) === i; }); }
  function abrirHoja(html, onReady) {
    cerrarHoja();
    var hoja = el('<div class="sheet-bg" role="dialog" aria-modal="true"><div class="sheet glass-sheet">' + html + '</div></div>');
    hoja.addEventListener('click', function (e) { if (e.target === hoja || e.target.closest('[data-cerrar]')) cerrarHoja(true); });
    document.body.appendChild(hoja); document.body.classList.add('con-hoja'); hojaAbierta = hoja;
    if (onReady) onReady(hoja);
  }
  function vistaCalendario() {
    var d = datos, hoyD = fecha(d.hoy);
    if (!calMes) calMes = clave7(hoyD);
    if (calModo !== 'pagos' && calModo !== 'detallado') calModo = 'pagos';
    app.appendChild(barraSuperior(d, false));
    var p = calMes.split('-'), y = +p[0], mo = +p[1] - 1;
    var primero = new Date(y, mo, 1), dias = new Date(y, mo + 1, 0).getDate(), off = (primero.getDay() + 6) % 7;
    var ev = eventosPagos(d);
    var porDia = {};
    ev.forEach(function (e) { (porDia[e.fecha] = porDia[e.fecha] || []).push(e); });
    var movDia = {};
    d.movimientos.forEach(function (m) { if (m.fecha.slice(0, 7) === calMes) (movDia[m.fecha] = movDia[m.fecha] || []).push(m); });
    var gd = gastosPorDia(d), maxG = 0, totMes = 0, nMov = 0;
    Object.keys(gd).forEach(function (k) { if (k.slice(0, 7) === calMes) { maxG = Math.max(maxG, gd[k]); totMes += gd[k]; } });
    Object.keys(movDia).forEach(function (k) { nMov += movDia[k].length; });
    var celdas = '';
    for (var i = 0; i < off; i++) celdas += '<div class="cal-d vacio"></div>';
    for (var dd = 1; dd <= dias; dd++) {
      var f = iso(new Date(y, mo, dd)), cls = 'cal-d' + (f === d.hoy ? ' hoy' : '') + (f === calSel ? ' sel' : ''), inner = '', st = '';
      if (calModo === 'pagos') {
        var es = porDia[f] || [];
        if (es.length) {
          cls += ' con ' + (es.some(function (e) { return e.estado === 'vencido'; }) ? 't-vencido' : es.some(function (e) { return e.estado === 'pendiente'; }) ? 't-pendiente'
            : es.some(function (e) { return e.estado === 'pagado'; }) ? 't-pagado' : 't-ingreso');
          inner = '<div class="marks">' + unicos(es.map(function (e) { return e.estado; })).map(function (k) { return '<i class="' + k + '"></i>'; }).join('') + '</div>' +
            '<div class="labels">' + es.slice(0, 3).map(function (e) { return '<span class="' + e.estado + '">' + esc(e.nombre.replace(/^TC /, '')) + '</span>'; }).join('') + (es.length > 3 ? '<span class="mas">+' + (es.length - 3) + ' más</span>' : '') + '</div>';
        }
      } else {
        var ms = movDia[f] || [];
        if (ms.length) {
          var a = gd[f] && maxG ? 0.08 + 0.32 * Math.sqrt(gd[f] / maxG) : 0;
          st = ' style="--heat:' + a.toFixed(2) + '"';
          cls += ' con det';
          inner = (gd[f] ? '<div class="gv num"><span class="gv-l">' + corto(gd[f]) + '</span><span class="gv-s">' + (gd[f] >= 1e6 ? (gd[f] / 1e6).toFixed(1).replace('.', ',') + 'M' : Math.round(gd[f] / 1000) + 'k') + '</span></div>' : '') +
            '<div class="marks">' + unicos(ms.map(colorMov)).map(function (k) { return '<i class="' + k + '"></i>'; }).join('') + '</div>' +
            '<div class="labels">' + ms.slice(0, 2).map(function (m) { return '<span class="' + colorMov(m) + '">' + esc(m.desc) + '</span>'; }).join('') + (ms.length > 2 ? '<span class="mas">+' + (ms.length - 2) + ' más</span>' : '') + '</div>';
        }
      }
      celdas += '<button type="button" class="' + cls + '" data-f="' + f + '"' + st + '><span class="dn">' + dd + '</span>' + inner + '</button>';
    }
    var ley = calModo === 'pagos'
      ? '<span><i class="pendiente"></i>Por pagar</span><span><i class="vencido"></i>Vencido</span><span><i class="pagado"></i>Pagado</span><span><i class="ingreso"></i>Ingreso</span>'
      : '<span><i class="gasto"></i>Gasto</span><span><i class="credito"></i>Con crédito</span><span><i class="ingreso"></i>Ingreso</span><span><i class="pago"></i>Pago de crédito</span><span><i class="mov"></i>Entre cuentas, retiros y préstamos</span>' +
        '<span class="tot">' + nMov + ' movimiento' + (nMov === 1 ? '' : 's') + ' · gastaste <b>' + pesos(totMes) + '</b></span>';
    var sec = el('<section class="card cal-glass"><div class="glow g1"></div><div class="glow g2"></div>' +
      '<div class="cal-top"><div class="cal-nav"><button type="button" class="icon-btn glass-btn" data-m="-1" aria-label="Mes anterior">' + ICON.left + '</button>' +
      '<h2>' + cap(MESES[mo]) + ' <span>' + y + '</span></h2><button type="button" class="icon-btn glass-btn" data-m="1" aria-label="Mes siguiente">' + ICON.right + '</button></div>' +
      '<div class="seg-glass" role="group" aria-label="Vista"><button type="button" data-modo="pagos" aria-pressed="' + (calModo === 'pagos') + '">Pagos</button>' +
      '<button type="button" data-modo="detallado" aria-pressed="' + (calModo === 'detallado') + '">Detallado</button></div></div>' +
      '<div class="cal-grid">' + DIAS_C.map(function (x) { return '<div class="cal-h">' + x + '</div>'; }).join('') + celdas + '</div>' +
      '<div class="cal-ley">' + ley + '</div></section>');
    var lado = el('<div class="cal-side"></div>');
    var wrap = el('<div class="cal-wrap"></div>');
    wrap.appendChild(sec); wrap.appendChild(lado);
    app.appendChild(wrap);
    var ancho = window.innerWidth >= 1000;

    function contenidoDia(f) {
      var fd = fecha(f), titulo = cap(DIAS[fd.getDay()]) + ' ' + fechaCorta(f);
      var h = '<div class="sheet-h"><div><h2>' + titulo + '</h2><div class="kind">' + (calModo === 'pagos' ? 'Pagos e ingresos' : 'Todo lo que registraste') + '</div></div>' +
        (ancho ? '' : '<button type="button" class="icon-btn" data-cerrar aria-label="Cerrar">' + ICON.close + '</button>') + '</div>';
      if (calModo === 'pagos') {
        var es = porDia[f] || [];
        h += es.length ? '<div class="cal-evs">' + es.map(function (e, i) {
          var montos = e.tipo === 'credito' ? '<div class="ev-m"><span>Pago mínimo <b class="num">' + pesos(e.minimo) + '</b></span>' + (e.total ? '<span>Pago total <b class="num">' + pesos(e.total) + '</b></span>' : '') + '</div>'
            : e.tipo === 'ingreso' ? '<div class="ev-m"><span>Entró <b class="num in">+' + pesos(e.minimo) + '</b> a ' + esc(e.cuenta) + '</span></div>'
            : '<div class="ev-m"><span>Valor <b class="num">' + pesos(e.minimo) + '</b>' + (e.auto ? ' · cobro automático' : '') + '</span></div>';
          var chip = { pendiente: 'Por pagar', vencido: 'Vencido', pagado: 'Pagado', ingreso: 'Ingreso' }[e.estado];
          return '<button type="button" class="ev ' + e.estado + '" data-i="' + i + '">' + logo(e.tipo === 'ingreso' ? e.cuenta : e.nombre, e.tipo === 'fijo') +
            '<div class="ev-b"><div class="ev-t"><span>' + esc(e.nombre) + '</span><span class="chip-e">' + chip + '</span></div>' + montos + '</div></button>';
        }).join('') + '</div><p class="hint">Toca un pago para ver su detalle.</p>' : '<div class="empty">No hay pagos ni ingresos este día.</div>';
      } else {
        var ms = movDia[f] || [];
        h += ms.length ? (gd[f] ? '<div class="dia-tot">Gastaste <b>' + pesos(gd[f]) + '</b></div>' : '') + '<div class="tx">' + ms.map(function (m) { return filaMovimiento(m); }).join('') + '</div>'
          : '<div class="empty">No registraste movimientos este día.</div>';
      }
      return h;
    }
    function conectar(cont, f) {
      var es = porDia[f] || [];
      cont.querySelectorAll('.ev').forEach(function (b) { b.addEventListener('click', function () { cerrarHoja(); ir(es[+b.dataset.i].link); }); });
    }
    function pintarLado() {
      lado.innerHTML = '';
      if (ancho && calSel) {
        var box = el('<section class="card glass-card dia-card">' + contenidoDia(calSel) + '</section>');
        conectar(box, calSel);
        lado.appendChild(box);
      }
      var prox = ev.filter(function (e) { return e.fecha >= d.hoy && e.estado === 'pendiente'; }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; }).slice(0, 8);
      var venc = ev.filter(function (e) { return e.estado === 'vencido'; });
      var box2 = el('<section class="card glass-card"><div class="card-h"><h2>Lo que viene</h2>' + (venc.length ? '<span class="chip crit">' + venc.length + ' vencido' + (venc.length === 1 ? '' : 's') + '</span>' : '') + '</div><div class="cal-evs sm">' +
        (prox.map(function (e, i) {
          var f = fecha(e.fecha);
          return '<button type="button" class="ev-s" data-i="' + i + '"><span class="dt"><b>' + f.getDate() + '</b>' + MES_C[f.getMonth()] + '</span>' + logo(e.nombre, e.tipo === 'fijo') +
            '<span class="nm">' + esc(e.nombre) + '</span><b class="num">' + pesos(e.minimo) + '</b></button>';
        }).join('') || '<div class="empty">Nada pendiente.</div>') + '</div><p class="hint">Toca un pago para ir a su detalle.</p></section>');
      box2.querySelectorAll('.ev-s').forEach(function (b) { b.addEventListener('click', function () { ir(prox[+b.dataset.i].link); }); });
      lado.appendChild(box2);
    }
    pintarLado();
    sec.querySelectorAll('.cal-d[data-f]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.dataset.f, es = porDia[f] || [];
        if (ancho && calModo === 'pagos' && calSel === f && es.length === 1) { ir(es[0].link); return; }
        calSel = f;
        sec.querySelectorAll('.cal-d.sel').forEach(function (x) { x.classList.remove('sel'); });
        b.classList.add('sel');
        if (ancho) pintarLado();
        else abrirHoja(contenidoDia(f), function (h) { conectar(h, f); });
      });
    });
    sec.querySelectorAll('[data-m]').forEach(function (b) {
      b.addEventListener('click', function () { var dt = new Date(y, mo + +b.dataset.m, 1); calMes = clave7(dt); calSel = null; pintar(); });
    });
    sec.querySelectorAll('[data-modo]').forEach(function (b) { b.addEventListener('click', function () { calModo = b.dataset.modo; pintar(); }); });
  }

  /* ---------- lo que necesita el botón de registrar (registro.js) ---------- */
  window.MF = {
    API: API, DEMO: DEMO, clave: clave, leerLocal: leerLocal, guardarLocal: guardarLocal, esc: esc, el: el, pesos: pesosReal,
    datos: function () { return datos; }, abrirHoja: abrirHoja, cerrarHoja: function () { cerrarHoja(true); }, logo: logo, ir: ir, fechaCorta: fechaCorta, icon: ICON,
    hoy: function () { return datos && datos.hoy; },
    listo: function () { return !!datos && !nav.hidden; },
    refrescar: function () { if (datos && !DEMO) cargar(mesSel === datos.meses[0] ? '' : mesSel, true); }
  };

  /* ---------- arranque ---------- */
  if (!DEMO && 'serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').then(function (reg) { reg.update(); }).catch(function () { /* sin modo sin conexión */ });
    // Cuando llega una versión nueva de la app, se recarga sola una vez.
    // Cuando llega una versión nueva, se aplica sola, pero nunca mientras la estás usando:
    // se recarga cuando sales de la app (o cambias de pestaña) y al volver ya está la nueva.
    var hadCtrl = !!navigator.serviceWorker.controller, recargada = false, versionNueva = false;
    var recargar = function () { if (!recargada) { recargada = true; location.reload(); } };
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (!hadCtrl) return; if (document.hidden) recargar(); else versionNueva = true; });
    document.addEventListener('visibilitychange', function () { if (document.hidden && versionNueva) recargar(); });
  }
  if (!DEMO && !clave()) pedirClave();
  else cargar('');
  // Al volver a la app, actualiza en silencio.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && datos && !DEMO) cargar(mesSel === datos.meses[0] ? '' : mesSel, true);
  });
})();
