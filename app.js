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
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>'
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
    var src = (window.LOGOS || {})[nombre] || (e.sitio && /^https?:\/\//i.test(e.sitio) ? e.sitio : '');
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
    var W = 200, H = alto || 60, min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
    var rango = max - min || 1, pad = 6;
    var x = function (i) { return (i / (pts.length - 1)) * W; };
    var y = function (v) { return max === min ? H * 0.7 : pad + (H - 2 * pad) * (1 - (v - min) / rango); };
    var d = pts.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
    var id = 'g' + Math.random().toString(36).slice(2, 8);
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + d + ' L' + W + ' ' + H + ' L0 ' + H + 'Z" fill="url(#' + id + ')"/>' +
      '<path d="' + d + '" fill="none" stroke="' + (color || '#fff') + '" stroke-opacity=".75" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>';
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
        datos = r.datos; mesSel = datos.mes; sync = 'ok';
        guardarLocal(k, JSON.stringify(datos));
        pintar();
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
  window.addEventListener('hashchange', function () { abiertos = {}; pintar(); window.scrollTo(0, 0); });

  function mostrarTip(ev, html) {
    tip.innerHTML = html; tip.hidden = false;
    var x = ev.clientX, y = ev.clientY, w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 14)) + 'px';
    tip.style.top = (y - h - 12 < 8 ? y + 16 : y - h - 12) + 'px';
  }
  function ocultarTip() { tip.hidden = true; }
  window.addEventListener('scroll', ocultarTip, { passive: true });

  function pintar() {
    if (!datos) return;
    ocultarTip();
    document.body.classList.toggle('oculto', oculto);
    var r = ruta();
    var vistaNav = r.v === 'cuenta' ? 'inicio' : r.v === 'credito' ? 'creditos' : r.v;
    nav.querySelectorAll('a').forEach(function (a) { a.classList.toggle('on', a.dataset.v === vistaNav); });
    app.innerHTML = '';
    if (DEMO) app.appendChild(el('<div class="demo-banner">Vista previa con tus saldos y créditos reales y algunos movimientos de prueba. Los logos se ven en la app instalada.</div>'));
    if (r.v === 'cuenta') return paginaCuenta(r.nombre);
    if (r.v === 'credito') return paginaCredito(r.nombre);
    if (r.v === 'creditos') return vistaCreditos();
    if (r.v === 'movimientos') return vistaMovimientos();
    if (r.v === 'medeben') return vistaMeDeben();
    return inicio();
  }

  /* =================== INICIO =================== */
  function inicio() {
    var d = datos;
    app.appendChild(barraSuperior(d, true));
    app.appendChild(hero(d));
    app.appendChild(cuentas(d));
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
      '<button class="icon-btn" id="recargar" type="button" aria-label="Actualizar">' + ICON.refresh + '</button></div></div>');
    var m = n.querySelector('#mes');
    if (m) m.addEventListener('change', function (e) { cargar(e.target.value); });
    n.querySelector('#ojo').addEventListener('click', function () { oculto = !oculto; guardarLocal('ocultar', oculto ? '1' : '0'); pintar(); });
    n.querySelector('#recargar').addEventListener('click', function () { cargar(mesSel === datos.meses[0] ? '' : mesSel); });
    setTimeout(marcarSync, 0);
    return n;
  }

  function hero(d) {
    var balance = d.ingresos - d.gastos;
    var delta = d.gastosMesAnterior > 0 ? Math.round((d.gastos - d.gastosMesAnterior) / d.gastosMesAnterior * 100) : null;
    var mesPrev = MESES[(+d.mes.split('-')[1] + 10) % 12];
    var deltaHtml = delta === null ? '<span>Sin datos del mes anterior</span>'
      : (delta <= 0 ? ICON.down : ICON.up) + '<span>' + Math.abs(delta) + ' % ' + (delta <= 0 ? 'menos' : 'más') + ' que en ' + mesPrev + '</span>';
    var disp = d.disponible || { valor: d.totalPlata, tienes: d.totalPlata, creditos: 0, fijos: 0 };
    var neg = disp.valor < 0;
    return el('<section class="hero" aria-label="Resumen">' +
      '<svg class="ribbon" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="rb" x1="0" x2="1"><stop offset="0" stop-color="#63d4ff" stop-opacity="0"/><stop offset=".55" stop-color="#9fe6ff" stop-opacity=".9"/><stop offset="1" stop-color="#ffffff" stop-opacity=".2"/></linearGradient><filter id="bl"><feGaussianBlur stdDeviation="6"/></filter></defs>' +
      '<path d="M-20 250 C 180 120, 340 330, 520 150 S 760 40, 840 90" stroke="url(#rb)" stroke-width="46" fill="none" filter="url(#bl)" opacity=".45"/>' +
      '<path d="M-20 240 C 180 110, 340 320, 520 140 S 760 30, 840 80" stroke="url(#rb)" stroke-width="1.5" fill="none"/></svg>' +
      '<div class="hero-left"><div class="disp"><div class="eyebrow">' + (neg ? 'Te falta para tus pagos de 30 días' : 'Disponible para gastar') + '</div>' +
      '<div class="big num' + (neg ? ' neg' : '') + '">' + pesos(Math.abs(disp.valor)) + '</div>' +
      '<div class="expl"><span>Tienes <b>' + pesos(disp.tienes) + '</b></span><span>Créditos 30 d <b>−' + pesos(disp.creditos).replace('$', '$') + '</b></span>' +
      (disp.fijos ? '<span>Fijos 30 d <b>−' + pesos(disp.fijos) + '</b></span>' : '') + '</div>' +
      (neg ? '<div class="aviso-neg">' + ICON.alert + ' Necesitas ingresos antes de esos pagos</div>' : '') + '</div>' +
      '<div class="hero-split">' +
      '<div class="pill-stat"><div class="k">Patrimonio</div><div class="v num">' + pesos(d.patrimonio) + '</div></div>' +
      '<div class="pill-stat"><div class="k">Te deben</div><div class="v num">' + pesos(d.totalMeDeben) + '</div></div>' +
      '<div class="pill-stat"><div class="k">Debes</div><div class="v num">' + pesos(d.totalDeudas) + '</div></div></div></div>' +
      '<div><div class="eyebrow" style="margin-bottom:10px">' + cap(nombreMes(d.mes)) + '</div><div class="month-tiles">' +
      '<div class="tile"><div class="k">Ingresos</div><div class="v num">' + pesos(d.ingresos) + '</div><div class="d"><span>' + d.tiposIngreso.length + ' fuente' + (d.tiposIngreso.length === 1 ? '' : 's') + '</span></div></div>' +
      '<div class="tile"><div class="k">Gastos</div><div class="v num">' + pesos(d.gastos) + '</div><div class="d">' + deltaHtml + '</div></div>' +
      '<div class="tile"><div class="k">' + (balance >= 0 ? 'Te quedó' : 'Te faltó') + '</div><div class="v num">' + pesos(balance) + '</div>' +
      '<div class="d"><span>' + (d.ingresos > 0 ? Math.round(balance / d.ingresos * 100) + ' % de tus ingresos' : 'Sin ingresos registrados') + '</span></div></div>' +
      '</div></div></section>');
  }

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
    if (!esFijo) {
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
    n.querySelectorAll('.seg').forEach(function (s) { s.addEventListener('pointermove', function (ev) { activar(+s.dataset.i, ev); }); s.addEventListener('pointerleave', soltar); });
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
    ultimoAncho = window.innerWidth; clearTimeout(window.__rz); window.__rz = setTimeout(pintar, 200);
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
      h.addEventListener('pointermove', function (ev) {
        var f = filas[+h.dataset.i];
        bands.innerHTML = '<rect class="band-hover" x="' + h.getAttribute('x') + '" y="' + T + '" width="' + banda + '" height="' + (H - T - B) + '" rx="6"/>';
        var rows = opts.series.map(function (x, k) { return '<div class="r"><span><i style="background:' + x.color + '"></i>' + esc(x.nombre) + '</span><b>' + pesos(f.valores[k]) + '</b></div>'; }).join('');
        mostrarTip(ev, '<div class="t">' + esc(f.titulo || f.etiqueta) + '</div>' + rows + (opts.pie ? opts.pie(f) : ''));
      });
      h.addEventListener('pointerleave', function () { bands.innerHTML = ''; ocultarTip(); });
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
    var n = el('<section class="card c-6"><div class="card-h"><h2>Gasto semanal</h2><span class="aside">Contado y financiado · 8 semanas</span></div></section>');
    var angosto = anchoGrafico() < 480;
    n.appendChild(graficoBarras({ titulo: 'Gasto por semana', apilado: true, ancho: anchoGrafico(),
      series: [{ nombre: 'De contado', color: 'var(--s3)' }, { nombre: 'Con tarjeta o crédito', color: 'var(--s2)' }],
      filas: d.semanas.map(function (s) {
        var ini = fecha(s.inicio), fin = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 6);
        return { etiqueta: angosto ? ini.getDate() + '/' + (ini.getMonth() + 1) : ini.getDate() + ' ' + MES_C[ini.getMonth()],
          titulo: 'Semana del ' + ini.getDate() + ' ' + MES_C[ini.getMonth()] + ' al ' + fin.getDate() + ' ' + MES_C[fin.getMonth()], valores: [s.contado, s.financiado] };
      }),
      pie: function (f) { return '<div class="r" style="margin-top:4px;color:var(--ink-2)"><span>Total</span><b>' + pesos(f.valores[0] + f.valores[1]) + '</b></div>'; } }));
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
    if (m.tipo === 'Transferencia' && esDeuda(m.destino)) return logo(m.destino).replace('class="logo', 'style="width:40px;height:40px;border-radius:12px" class="logo');
    return '';
  }
  /** Grupo para filtrar lo que no tiene categoría: pagos, retiros, ajustes… */
  function grupoMov(m) {
    if (m.tipo === 'Gasto' || m.tipo === 'Ingreso') return m.cat || 'Otros';
    if (m.tipo === 'Me pagaron') return 'Me pagaron';
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
    else if (m.tipo === 'Transferencia') {
      meta.push(etiqueta(m.cuenta) + '<span>→</span>' + etiqueta(m.destino));
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
    return '<div class="tx-row">' + (ico ? '<div aria-hidden="true">' + ico + '</div>' : '<div class="ico" aria-hidden="true">' + esc(m.emoji) + '</div>') + '<div style="min-width:0"><div class="d">' + esc(m.desc) + '</div>' +
      '<div class="m">' + meta.join('<span>·</span>') + '</div></div><div class="a ' + cls + '">' + signo + pesos(Math.abs(m.monto)).replace('−', '') + extra + '</div></div>';
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
      '<div class="fil-row"><select class="select" data-k="cat" aria-label="Categoría">' + opt(cats, busq.cat, 'Todas las categorías') + '</select>' +
      '<select class="select" data-k="cuenta" aria-label="Cuenta">' + opt(ctas, busq.cuenta, 'Todas las cuentas') + '</select>' +
      '<select class="select" data-k="mes" aria-label="Mes">' + opt(meses, busq.mes, 'Todos los meses') + '</select></div></div>' +
      '<div class="tx"></div></section>');
    app.appendChild(n);
    var cont = n.querySelector('.tx'), total = n.querySelector('.total-filtro');
    function filtrar() {
      var q = norm(busq.q);
      var items = d.movimientos.filter(function (m) {
        if (busq.tipo === 'Gasto' && m.tipo !== 'Gasto') return false;
        if (busq.tipo === 'Ingreso' && !(m.tipo === 'Ingreso' || m.tipo === 'Me pagaron')) return false;
        if (busq.tipo === 'Transferencia' && !(m.tipo === 'Transferencia' || m.tipo === 'Ajuste')) return false;
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
    var soloCred = Object.assign({}, d, { proximos: d.proximos.filter(function (p) { return p.tipo === 'credito'; }) });
    var n = proximos(soloCred, false);
    n.querySelector('h2').textContent = 'Calendario de pagos de tus créditos';
    n.classList.remove('c-7');
    app.appendChild(n);
    var fijos = Object.assign({}, d, { proximos: d.proximos.filter(function (p) { return p.tipo === 'fijo'; }) });
    var f = proximos(fijos, false);
    f.querySelector('h2').textContent = 'Gastos fijos y suscripciones';
    f.classList.remove('c-7');
    app.appendChild(f);
  }

  /* =================== ME DEBEN =================== */
  function vistaMeDeben() {
    var d = datos;
    app.appendChild(barraSuperior(d, false));
    var html = d.meDeben.map(function (p) {
      return '<div class="owed-row"><div><div class="p">' + esc(p.persona) + '</div><div class="s">Le cubriste ' + pesos(p.prestado) +
        (p.pagado ? ' · te pagó ' + pesos(p.pagado) : '') + '</div></div><div class="v">' + pesos(p.saldo) + '</div></div>';
    }).join('');
    app.appendChild(el('<section class="card"><div class="card-h"><h2>Me deben</h2><span class="aside">Total <b>' + pesos(d.totalMeDeben) + '</b></span></div>' +
      '<div class="owed">' + (html || '<div class="empty">Nadie te debe plata en este momento.</div>') + '</div>' +
      '<p class="hint">Cuando alguien te pague, regístralo en el botón del celular: Ingreso → 🤝 Me pagaron.</p></section>'));
    var mama = d.creditos.find(function (c) { return c.persona; });
    if (mama && mama.saldo > 0) {
      var r = el('<section class="card"><div class="card-h"><h2>Le debes a tu mamá</h2><span class="aside">Total <b>' + pesos(mama.saldo) + '</b></span></div>' +
        '<div class="owed"><div class="owed-row mama-row" role="button" tabindex="0"><div><div class="p">👩 Mamá</div><div class="s">Préstamos para tus pagos · sin intereses</div></div><div class="v">' + pesos(mama.saldo) + '</div></div></div>' +
        '<p class="hint">Para devolverle: botón del celular → 💳 Pagar un crédito → Devolverle a mamá.</p></section>');
      r.querySelector('.owed-row').addEventListener('click', function () { ir('#/credito/Mam%C3%A1'); });
      app.appendChild(r);
    }
    // Quién pagó sus gastos compartidos
    var comp = d.movimientos.filter(function (m) { return m.tipo === 'Me pagaron'; }).slice(0, 10);
    if (comp.length) app.appendChild(el('<section class="card"><div class="card-h"><h2>Últimos pagos que te hicieron</h2></div><div class="tx">' + comp.map(function (m) { return filaMovimiento(m); }).join('') + '</div></section>'));
  }

  /* =================== PÁGINA DE CUENTA =================== */
  function volver(hash, texto) {
    var b = el('<div><button class="btn back" type="button">' + ICON.back + texto + '</button></div>');
    b.querySelector('button').addEventListener('click', function () { if (history.length > 1) history.back(); else ir(hash); });
    return b;
  }
  function cabecera(nombre, sub, grande, serie, extra, stats) {
    var c = colorMarca(nombre);
    return el('<section class="detail-head" style="--c:' + c + '"><div class="who">' + logo(nombre, false, true) +
      '<div><h1>' + esc(nombre) + '</h1><div class="kind">' + sub + '</div></div></div>' + grande +
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
      else if (m.tipo === 'Ingreso' || m.tipo === 'Me pagaron') entra += m.monto;
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
      (c.persona ? '' : '<div class="stat"><div class="k">Intereses y cargos</div><div class="v num">' + pesos(c.intereses) + '</div><div class="d">de tus compras registradas</div></div>')));

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
    app.appendChild(listaCorta('Compras y pagos', movs, nombre, 'movsCred', 10, 'Aún no hay compras ni pagos registrados con este crédito.'));
  }

  /* ---------- arranque ---------- */
  if (!DEMO && 'serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* sin modo sin conexión */ });
  }
  if (!DEMO && !clave()) pedirClave();
  else cargar('');
  // Al volver a la app, actualiza en silencio.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && datos && !DEMO) cargar(mesSel === datos.meses[0] ? '' : mesSel, true);
  });
})();
