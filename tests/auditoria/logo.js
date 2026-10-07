// Logo dinámico de la marca: estructura (sin colores fijos, sin filtros pesados) y separación de los íconos de la PWA.
// El contraste real por color/tema/estilo se midió con el navegador al implementarlo (≥ 3:1 en las 72 combinaciones).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const R = path.join(__dirname, '../..');
const js = fs.readFileSync(path.join(R, 'app.js'), 'utf8'), css = fs.readFileSync(path.join(R, 'app.css'), 'utf8');
const fallas = [], oks = [];
const ok = (c, m) => { (c ? oks : fallas).push(m); };
const fn = (js.match(/function logoMarca\(px\) \{[\s\S]*?\n  \}\n/) || [''])[0];
ok(fn.length > 0, 'no se encontró logoMarca() en app.js');
const colores = (fn.match(/#[0-9a-fA-F]{3,8}\b/g) || []).filter((c) => c.toLowerCase() !== '#fff');
ok(colores.length === 0, 'logoMarca() tiene colores fijos (debe usar los tokens): ' + colores.join(', '));
ok(!/<filter|feGaussian|backdrop-filter/.test(fn), 'logoMarca() usa filtros SVG o backdrop-filter');
const bloque = css.slice(css.indexOf('Logo de la marca (SVG dinámico)'), css.indexOf('Hoja de Apariencia'));
ok(bloque.length > 200, 'falta el bloque de estilos del logo en app.css');
ok(!/backdrop-filter|filter:\s*blur|drop-shadow/.test(bloque.replace(/filter: none/g, '')), 'los estilos del logo usan filtros pesados');
ok(/data-theme="light"\] \.mf-logo/.test(bloque) && /data-oled\]\[data-theme="dark"\] \.mf-logo/.test(bloque), 'el logo no tiene variantes de tema claro y OLED');
for (const e of ['cristal', 'mate']) ok(new RegExp('data-estilo="' + e + '"\\] \\.mf-logo').test(bloque), 'el logo no reacciona al estilo ' + e);
ok(/logoMarca\(32\)/.test(js) && /logoMarca\(84\)/.test(js), 'el logo no se usa en la barra lateral y en el ingreso de clave');
ok(!/data-color="/.test(bloque), 'los estilos del logo no deben fijar un color por vista: usan --c1…--c4');
// Íconos de la PWA: siguen siendo archivos estáticos y están en el manifest, el favicon y la caché.
const man = JSON.parse(fs.readFileSync(path.join(R, 'manifest.webmanifest'), 'utf8'));
const srcs = man.icons.map((i) => i.src);
ok(srcs.length >= 2 && srcs.every((s) => fs.existsSync(path.join(R, s))), 'faltan íconos del manifest');
const idx = fs.readFileSync(path.join(R, 'index.html'), 'utf8');
ok(/rel="icon" href="icons\/icon-192\.png"/.test(idx) && /apple-touch-icon" href="icons\/icon-180\.png"/.test(idx), 'el favicon o apple-touch-icon ya no son estáticos');
const sw = fs.readFileSync(path.join(R, 'sw.js'), 'utf8');
ok(['icon-180.png', 'icon-192.png', 'icon-512.png'].every((f) => sw.includes('icons/' + f)), 'sw.js no cachea los íconos estáticos');
console.log('\n== logo: ' + (fallas.length ? fallas.length + ' FALLAS' : 'sin fallas') + ' (' + oks.length + ' verificaciones OK)');
fallas.forEach((f) => console.log('  ✗ ' + f));
