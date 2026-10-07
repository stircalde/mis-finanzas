/* Compartir un favor como imagen: resumen de la persona y, si se acaba de registrar algo, el movimiento.
   La imagen se dibuja en un canvas (sin librerías), con los colores del tema actual. No incluye cuentas ni datos bancarios.
   Uso: MF.compartirFavor({ sentido: 'me' | 'les', persona, evento?: { tipo, monto, fecha, desc, saldoAntes } })
   tipo del evento: 'pago' (me pagó), 'devolucion' (le pagué), 'nuevo' (le presté), 'prestamo' (me prestó). */
(function () {
  'use strict';
  var MFx = window.MF;
  if (!MFx) return;
  var W = 1080, PAD = 64;

  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase(); }
  function pesos(n) { return MFx.pesos(Math.round(n)); }
  function fecha(f) { return f ? MFx.fechaCorta(f) : ''; }

  // Color real de una variable CSS del tema (resuelve color-mix) para dibujar en el canvas.
  function color(css) {
    var p = document.createElement('i'); p.style.cssText = 'position:absolute;visibility:hidden;color:' + css; document.body.appendChild(p);
    var v = getComputedStyle(p).color; p.remove(); return v;
  }

  /* ---------- datos del favor ---------- */
  function resumen(sentido, persona, ev) {
    var d = MFx.datos() || {};
    var lista = sentido === 'les' ? (d.lesDebo || []) : (d.meDeben || []);
    var p = lista.filter(function (x) { return norm(x.persona) === norm(persona); })[0] || null;
    var r = { sentido: sentido, persona: persona, filas: [], lineas: [], saldo: 0, evento: ev || null };
    if (sentido === 'me') {
      var prestado = p ? p.prestado || 0 : 0, pagado = p ? p.pagado || 0 : 0, saldo = p ? p.saldo || 0 : 0;
      // Justo después de registrar, la hoja aún no se actualizó: se parte de lo que había al registrar.
      if (ev && ev.saldoAntes != null) {
        if (ev.tipo === 'pago') { saldo = Math.max(0, ev.saldoAntes - ev.monto); pagado = (ev.pagadoAntes || 0) + ev.monto; prestado = ev.prestadoAntes != null ? ev.prestadoAntes : prestado; }
        if (ev.tipo === 'nuevo') { saldo = ev.saldoAntes + ev.monto; prestado = (ev.prestadoAntes || 0) + ev.monto; pagado = ev.pagadoAntes || 0; }
      }
      r.saldo = saldo; r.titulo = saldo > 0 ? 'Te debe' : 'Está al día';
      r.filas = [['Le cubriste', pesos(prestado)], ['Te ha pagado', pesos(pagado)], ['Pendiente', pesos(saldo)]];
      (p && p.conceptos || []).forEach(function (c) { r.lineas.push([c.desc, pesos(c.pendiente), (c.fecha ? fecha(c.fecha) : '') + (c.cuotas > 1 ? ' · ' + c.cuotasPagadas + ' de ' + c.cuotas + ' cuotas' : '')]); });
      if (ev && ev.tipo === 'nuevo' && !r.lineas.some(function (l) { return norm(l[0]) === norm(ev.desc); })) r.lineas.unshift([ev.desc || 'Préstamo', pesos(ev.monto), fecha(ev.fecha)]);
    } else {
      var pr = p ? (p.prestamos || []).reduce(function (s, m) { return s + m.monto; }, 0) : 0, dv = p ? (p.devoluciones || []).reduce(function (s, m) { return s + m.monto; }, 0) : 0, sl = p ? p.saldo || 0 : 0;
      if (ev && ev.saldoAntes != null) {
        if (ev.tipo === 'devolucion') { sl = Math.max(0, ev.saldoAntes - ev.monto); dv = (ev.pagadoAntes || 0) + ev.monto; pr = ev.prestadoAntes != null ? ev.prestadoAntes : pr; }
        if (ev.tipo === 'prestamo') { sl = ev.saldoAntes + ev.monto; pr = (ev.prestadoAntes || 0) + ev.monto; dv = ev.pagadoAntes || 0; }
      }
      r.saldo = sl; r.titulo = sl > 0 ? 'Le debes' : 'Estás al día';
      r.filas = [['Te prestó', pesos(pr)], ['Le has devuelto', pesos(dv)], ['Pendiente', pesos(sl)]];
      (p && p.prestamos || []).slice(0, 6).forEach(function (m) { r.lineas.push([m.desc || 'Préstamo', pesos(m.monto), fecha(m.fecha)]); });
    }
    // Tras un pago la lista por concepto aún no está al día (la hoja se actualiza después): se omite para no mostrar saldos viejos.
    if (ev && (ev.tipo === 'pago' || ev.tipo === 'devolucion')) r.lineas = [];
    return r;
  }

  /* ---------- logo de la marca como imagen (con los colores del tema) ---------- */
  function logoImagen(px) {
    return new Promise(function (ok) {
      try {
        var svg = MFx.logoMarca(px), probe = document.createElement('div'); probe.style.cssText = 'position:absolute;visibility:hidden'; probe.innerHTML = svg; document.body.appendChild(probe);
        var el = probe.firstChild, cs = getComputedStyle(el);
        svg = svg.replace(/var\((--lg-[a-z0-9]+)\)/g, function (m, v) { var x = cs.getPropertyValue(v).trim(); return x ? color(x) : '#888'; });
        probe.remove();
        if (!document.documentElement.hasAttribute('data-estilo') || document.documentElement.getAttribute('data-estilo') !== 'cristal') svg = svg.replace(/<path class="lg-gloss"[^>]*\/>/, '');
        svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
        var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); };
        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      } catch (e) { ok(null); }
    });
  }

  /* ---------- dibujo ---------- */
  function envolver(ctx, texto, ancho) {
    var pal = String(texto).split(/\s+/), ls = [], l = '';
    pal.forEach(function (w) { var t = l ? l + ' ' + w : w; if (ctx.measureText(t).width > ancho && l) { ls.push(l); l = w; } else l = t; });
    if (l) ls.push(l); return ls;
  }
  function dibujar(r, logo) {
    var cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    var C = { bg: color('var(--bg)'), card: color('var(--surface)'), ink: color('var(--ink)'), ink2: color('var(--ink-2)'), muted: color('var(--muted)'),
      line: color('var(--line-strong)'), acc: color('var(--accent)'), good: color('var(--good)'), crit: color('var(--crit)'), on: color('var(--on-accent)') };
    var F = function (peso, px, fam) { return peso + ' ' + px + 'px ' + (fam || 'Figtree') + ', "Segoe UI", system-ui, sans-serif'; };
    var lineas = r.lineas.slice(0, 6), mas = r.lineas.length - lineas.length;
    var ev = r.evento;
    var alto = PAD + 96 + 36 + 70 + 150 + (ev ? 190 : 0) + 3 * 76 + (lineas.length ? 70 + lineas.length * 96 + (mas > 0 ? 56 : 0) : 0) + 70 + PAD;
    cv.width = W; cv.height = alto; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, alto);
    var y = PAD;
    if (logo) ctx.drawImage(logo, PAD, y, 96, 96);
    ctx.fillStyle = C.ink; ctx.font = F(600, 40, 'Sora'); ctx.fillText('Mis finanzas', PAD + (logo ? 120 : 0), y + 62);
    ctx.textAlign = 'right'; ctx.fillStyle = C.muted; ctx.font = F(500, 30); ctx.fillText('Favor', W - PAD, y + 60); ctx.textAlign = 'left';
    y += 96 + 36;
    ctx.fillStyle = C.ink; ctx.font = F(700, 64, 'Sora'); ctx.fillText(r.persona.length > 22 ? r.persona.slice(0, 21) + '…' : r.persona, PAD, y + 56);
    y += 70;
    ctx.fillStyle = C.muted; ctx.font = F(500, 32); ctx.fillText(r.titulo, PAD, y + 30);
    ctx.font = F(700, 78, 'Sora'); ctx.fillStyle = r.saldo > 0 ? (r.sentido === 'me' ? C.good : C.crit) : C.good;
    ctx.fillText(pesos(r.saldo), PAD, y + 124);
    y += 150;
    if (ev) {
      var tx = { pago: ['Pago recibido', '+', C.good], devolucion: ['Pago realizado', '−', C.crit], nuevo: ['Favor nuevo', '', C.acc], prestamo: ['Préstamo recibido', '', C.acc] }[ev.tipo] || ['Movimiento', '', C.acc];
      ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(PAD, y, W - 2 * PAD, 160, 28); else ctx.rect(PAD, y, W - 2 * PAD, 160); ctx.fill(); ctx.stroke();
      ctx.fillStyle = tx[2]; ctx.font = F(700, 30); ctx.fillText(tx[0].toUpperCase(), PAD + 36, y + 56);
      ctx.fillStyle = C.ink; ctx.font = F(700, 52, 'Sora'); ctx.fillText(tx[1] + pesos(ev.monto), PAD + 36, y + 124);
      ctx.textAlign = 'right'; ctx.fillStyle = C.ink2; ctx.font = F(500, 30); ctx.fillText(fecha(ev.fecha), W - PAD - 36, y + 124); ctx.textAlign = 'left';
      y += 190;
    }
    r.filas.forEach(function (f, i) {
      var ult = i === r.filas.length - 1;
      ctx.fillStyle = ult ? C.ink : C.ink2; ctx.font = F(ult ? 700 : 500, 36); ctx.fillText(f[0], PAD, y + 44);
      ctx.textAlign = 'right'; ctx.fillText(f[1], W - PAD, y + 44); ctx.textAlign = 'left';
      ctx.fillStyle = C.line; ctx.fillRect(PAD, y + 66, W - 2 * PAD, 2); y += 76;
    });
    if (lineas.length) {
      y += 24; ctx.fillStyle = C.muted; ctx.font = F(700, 28); ctx.fillText((r.sentido === 'me' ? 'LO QUE FALTA POR PAGAR' : 'PRÉSTAMOS').split('').join(' '), PAD, y + 24); y += 46;
      lineas.forEach(function (l) {
        ctx.fillStyle = C.ink; ctx.font = F(600, 36);
        var t = l[0]; while (ctx.measureText(t).width > W - 2 * PAD - 260 && t.length > 4) t = t.slice(0, -2);
        ctx.fillText(t === l[0] ? t : t.trim() + '…', PAD, y + 40);
        ctx.textAlign = 'right'; ctx.fillText(l[1], W - PAD, y + 40); ctx.textAlign = 'left';
        ctx.fillStyle = C.muted; ctx.font = F(500, 28); ctx.fillText(l[2] || '', PAD, y + 78); y += 96;
      });
      if (mas > 0) { ctx.fillStyle = C.muted; ctx.font = F(500, 28); ctx.fillText('y ' + mas + (mas === 1 ? ' concepto más' : ' conceptos más'), PAD, y + 28); y += 56; }
    }
    ctx.fillStyle = C.muted; ctx.font = F(500, 26); ctx.fillText('Al ' + fecha(MFx.hoy()) + ' · generado con Mis finanzas', PAD, alto - PAD - 4);
    return cv;
  }

  /* ---------- hoja de vista previa + compartir ---------- */
  function compartirFavor(o) {
    if (!MFx.datos()) return;
    var r = resumen(o.sentido, o.persona, o.evento);
    var html = '<div class="sheet-h"><div><h2>Compartir favor</h2><div class="kind">Vista previa de la imagen</div></div>' +
      '<button class="icon-btn" type="button" data-cerrar aria-label="Cerrar">' + MFx.icon.close + '</button></div>' +
      '<div class="cmp-prev"><div class="cmp-carga">Preparando imagen…</div></div>' +
      '<div class="cmp-acc"><button class="btn primary" type="button" data-compartir-img disabled>📤 Compartir</button>' +
      '<button class="btn" type="button" data-descargar disabled>⬇️ Guardar imagen</button></div>' +
      '<p class="hint">La imagen no incluye tus cuentas ni datos bancarios.</p>';
    MFx.abrirHoja(html, function (h) {
      var prev = h.querySelector('.cmp-prev'), bs = h.querySelector('[data-compartir-img]'), bd = h.querySelector('[data-descargar]');
      Promise.all([logoImagen(96), document.fonts && document.fonts.ready ? document.fonts.ready : null]).then(function (res) {
        var cv = dibujar(r, res[0]);
        cv.toBlob(function (blob) {
          if (!blob) { prev.innerHTML = '<div class="cmp-carga">No se pudo crear la imagen.</div>'; return; }
          var url = URL.createObjectURL(blob), nombre = 'favor-' + norm(r.persona).replace(/[^a-z0-9]+/g, '-') + '.png';
          prev.innerHTML = '<img alt="Vista previa del favor" src="' + url + '">';
          var file = null; try { file = new File([blob], nombre, { type: 'image/png' }); } catch (e) { file = null; }
          var puede = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
          bd.disabled = false; bs.disabled = false; if (!puede) bs.hidden = true;
          bs.addEventListener('click', function () { navigator.share({ files: [file], title: 'Favor con ' + r.persona }).catch(function () { /* cancelado */ }); });
          bd.addEventListener('click', function () { var a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); });
        }, 'image/png');
      });
    });
  }
  MFx.compartirFavor = compartirFavor;
})();
