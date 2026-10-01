// Apariencia: contraste y distinción de los 8 colores de interfaz (lee los tokens de app.css).
// - Texto con el color principal: ≥ 4,5 sobre la superficie oscura y sobre blanco (versión "c1c").
// - Texto sobre botones del color (--on) y texto blanco sobre la tarjeta de balance (--ch): ≥ 4,5.
// - Distancia de color (OKLab) contra los colores con significado (ingresos, gastos, advertencias)
//   y contra colores comunes de bancos/tarjetas: que no se confundan.
const fs = require('fs'), path = require('path');
const css = fs.readFileSync(path.join(__dirname, '../../app.css'), 'utf8');
const fallas = [], oks = [];
const ok = (c, m) => { (c ? oks : fallas).push(m); };
const hx = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)); };
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const oklab = (c) => { const [r, g, b] = c.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]; };
const dE = (a, b) => Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i]));
const mix = (a, p, b) => a.map((v, i) => v * p + b[i] * (1 - p));   // color-mix(in srgb, a p, b)

// Paletas: Azul en :root, el resto en :root[data-color="…"]
const raiz = css.match(/:root \{([\s\S]*?)\n\}/)[1];
const tok = (txt, k) => { const m = txt.match(new RegExp('--' + k + ':\\s*(#[0-9a-fA-F]{3,6})')); return m && m[1]; };
const pal = { azul: { c1: tok(raiz, 'c1'), c1c: tok(raiz, 'c1c'), on: tok(raiz, 'on'), ch: tok(raiz, 'c4') } };
for (const m of css.matchAll(/:root\[data-color="([a-z]+)"\] \{([^}]*)\}/g)) pal[m[1]] = { c1: tok(m[2], 'c1'), c1c: tok(m[2], 'c1c'), on: tok(m[2], 'on'), ch: tok(m[2], 'ch') };
ok(Object.keys(pal).length === 8, 'se esperaban 8 colores y hay ' + Object.keys(pal).length + ': ' + Object.keys(pal).join(', '));

const SEM_OSC = { 'verde de ingresos': '#2fd07a', 'rojo de gastos': '#ff5c6c', 'ámbar de advertencia': '#fab219', 'ámbar de ingreso (calendario)': '#f2b33d' };
const SEM_CLA = { 'verde de ingresos': '#10a358', 'rojo de gastos': '#e23a4e', 'ámbar de advertencia': '#c27a00' };
const BANCOS = { Nequi: '#CA0080', 'Daviplata/Davivienda': '#DD141D', Addi: '#3C6AF0', Nubank: '#820AD1', 'Davibank': '#ED1C27', Credifin: '#1D8DC6',
  Bancolombia: '#FDDA24', BBVA: '#1973B8', 'BBVA oscuro': '#004481', 'Itaú': '#EC7000', RappiPay: '#FF441F', Falabella: '#43B02A', Colpatria: '#EC111A', 'AV Villas': '#003DA5' };
const presets = (fs.readFileSync(path.join(__dirname, '../../admin.js'), 'utf8').match(/var COLORES = \[([^\]]*)\]/) || ['', ''])[1].match(/#[0-9A-Fa-f]{6}/g) || [];
presets.forEach((p) => { BANCOS['color sugerido ' + p] = p; });
const MIN_SEM = 0.055, MIN_BANCO = 0.04;

const surf = mix(hx('#3d8bff'), 0.13, hx('#040404'));   // superficie oscura de referencia
for (const [n, P] of Object.entries(pal)) {
  const c1 = hx(P.c1), sup = mix(c1, 0.13, hx('#040404'));
  ok(cr(c1, sup) >= 4.5, n + ': el color sobre la superficie oscura tiene contraste ' + cr(c1, sup).toFixed(2) + ' (< 4,5)');
  ok(cr(hx(P.c1c), hx('#ffffff')) >= 4.5, n + ': la versión para tema claro tiene contraste ' + cr(hx(P.c1c), hx('#ffffff')).toFixed(2) + ' sobre blanco (< 4,5)');
  ok(cr(hx(P.on), c1) >= 4 || cr(hx(P.on), c1) >= 3 && P.on.toLowerCase().startsWith('#fff'), n + ': el texto sobre botones (' + P.on + ') tiene contraste ' + cr(hx(P.on), c1).toFixed(2));
  ok(cr(hx('#ffffff'), hx(P.ch)) >= 4.4, n + ': el texto blanco sobre la tarjeta de balance tiene contraste ' + cr(hx('#ffffff'), hx(P.ch)).toFixed(2));
  for (const [k, v] of Object.entries(SEM_OSC)) ok(dE(c1, hx(v)) >= MIN_SEM, n + ' se confunde con el ' + k + ' (distancia ' + dE(c1, hx(v)).toFixed(3) + ')');
  for (const [k, v] of Object.entries(SEM_CLA)) ok(dE(hx(P.c1c), hx(v)) >= MIN_SEM, n + ' (tema claro) se confunde con el ' + k + ' (distancia ' + dE(hx(P.c1c), hx(v)).toFixed(3) + ')');
  for (const [k, v] of Object.entries(BANCOS)) ok(dE(c1, hx(v)) >= MIN_BANCO, n + ' se confunde con ' + k + ' (distancia ' + dE(c1, hx(v)).toFixed(3) + ')');
}
// Tarjeta de balance en tema claro: cada parada del degradado debe dejar legible el texto blanco.
const heroClaro = (css.match(/:root\[data-theme="light"\] \.hero \{[^}]*linear-gradient\(135deg,([^;]*)\);/) || ['', ''])[1];
const paradas = [...heroClaro.matchAll(/color-mix\(in srgb, var\(--ch\) (\d+)%, (#[0-9a-fA-F]{6})\)|var\(--ch\)/g)].map((m) => m[1] ? [Number(m[1]) / 100, m[2]] : [1, '#000000']);
ok(paradas.length >= 2, 'no encontré el degradado de la tarjeta de balance en tema claro');
for (const [n, P] of Object.entries(pal)) for (const [q, otro] of paradas) {
  const c = mix(hx(P.ch), q, hx(otro)); ok(cr(hx('#ffffff'), c) >= 4.4, n + ' (claro): texto blanco sobre la tarjeta de balance con contraste ' + cr(hx('#ffffff'), c).toFixed(2));
}
// Texto sobre fondos del color elegido: no puede quedar fijo en blanco (se usa --on / --on-accent).
for (const sel of ['.cal-glass .cal-d.hoy .dn', '.op[aria-pressed="true"] b']) {
  const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}'));
  ok(m && !/color:\s*#fff/i.test(m[1]), sel + ' tiene texto blanco fijo sobre el color elegido');
}
// Negro puro: Cristal no puede dejar su fondo de manchas de color.
ok(/:root\[data-oled\]\[data-theme="dark"\]\[data-estilo="cristal"\] body::before \{ background: #000; \}/.test(css), 'OLED + Cristal no deja el fondo en negro puro');
// Cristal no usa desenfoque en la barra inferior.
ok(/:root\[data-estilo="cristal"\] \.nav \{[^}]*backdrop-filter: none/.test(css), 'Cristal sigue usando backdrop-filter en la barra inferior');
const ns = Object.keys(pal);
for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
  const d = dE(hx(pal[ns[i]].c1), hx(pal[ns[j]].c1)); ok(d >= 0.08, ns[i] + ' y ' + ns[j] + ' se parecen demasiado (distancia ' + d.toFixed(3) + ')');
}
console.log('\n== apariencia: ' + (fallas.length ? fallas.length + ' FALLAS' : 'sin fallas') + ' (' + oks.length + ' verificaciones OK)');
fallas.forEach((f) => console.log('  ✗ ' + f));
