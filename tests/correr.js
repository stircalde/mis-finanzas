// Corre todas las pruebas del backend y compara contra los hallazgos ya conocidos.
//   node tests/correr.js            → falla (código 1) si aparece una falla NUEVA o una prueba se cae
//   node tests/correr.js --anotar   → muestra las fallas actuales en formato de conocidos.json
//   node tests/correr.js --actualizar → guarda la foto nueva de números (cuando un cambio de cálculo es intencional)
//
// Además, fuzz.js (400 operaciones con semilla fija) deja una "foto" de saldos, deudas, calendarios y meses.
// Si un solo número cambia respecto a tests/instantanea.json, la prueba falla y muestra dónde.
//
// Las pruebas de tests/auditoria/ son "sondas": cada ✗ describe un comportamiento que en algún
// momento se consideró sospechoso. Las que ya se revisaron están en conocidos.json con su estado
// (pendiente, intencional, mitigado). Lo importante es que NO aparezcan fallas nuevas: eso sería
// una regresión.
const { spawnSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'auditoria');
const conocidos = JSON.parse(fs.readFileSync(path.join(__dirname, 'conocidos.json'), 'utf8'));
// Los montos cambian si cambian los datos de ejemplo; se comparan los textos sin números.
const norma = (t) => t.replace(/-?\d[\d.,]*/g, '#').replace(/\s+/g, ' ').trim();
const mapa = new Map(conocidos.map((k) => [k.suite + '|' + norma(k.falla), k]));

let nuevas = 0, caidas = 0, ok = 0;
const vistas = new Set(), anotar = [];
for (const archivo of fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
  const suite = archivo.replace(/\.js$/, '');
  const foto = path.join(os.tmpdir(), 'mf-foto-' + process.pid + '.json');
  const env = Object.assign({}, process.env, suite === 'fuzz' ? { FOTO: foto } : {});
  const r = spawnSync(process.execPath, [path.join(dir, archivo)], { encoding: 'utf8', timeout: 300000, env });
  const salida = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0) {
    caidas++;
    console.log('💥 ' + suite + ': la prueba se cayó\n' + salida.split('\n').slice(-15).join('\n'));
    continue;
  }
  const resumen = salida.match(/^== .*$/m);
  const fallas = salida.split('\n').filter((l) => l.startsWith('  ✗ ')).map((l) => l.slice(4));
  const sinConocer = [];
  for (const f of fallas) {
    const k = mapa.get(suite + '|' + norma(f));
    if (k) vistas.add(k); else sinConocer.push(f);
    anotar.push({ suite, falla: f, estado: k ? k.estado : '?', nota: k ? k.nota : '' });
  }
  if (suite === 'fuzz') {
    const ref = path.join(__dirname, 'instantanea.json');
    const nueva = fs.readFileSync(foto, 'utf8'); fs.unlinkSync(foto);
    if (process.argv.includes('--actualizar') || !fs.existsSync(ref)) { fs.writeFileSync(ref, nueva); console.log('📸 instantanea.json actualizada'); }
    else {
      const dif = []; const cmp = (a, b, ruta) => {
        if (dif.length >= 8) return;
        if (a && b && typeof a === 'object' && typeof b === 'object') { new Set([...Object.keys(a), ...Object.keys(b)]).forEach((k) => cmp(a[k], b[k], ruta + (Array.isArray(a) ? '[' + k + ']' : '.' + k))); }
        else if (JSON.stringify(a) !== JSON.stringify(b)) dif.push(ruta + ': antes ' + JSON.stringify(a) + ' → ahora ' + JSON.stringify(b));
      };
      cmp(JSON.parse(fs.readFileSync(ref, 'utf8')), JSON.parse(nueva), 'foto');
      if (dif.length) { nuevas++; console.log('❌ fuzz: cambiaron números respecto a tests/instantanea.json (si el cambio es intencional: node tests/correr.js --actualizar)'); dif.forEach((x) => console.log('   ' + x)); }
    }
  }
  nuevas += sinConocer.length;
  ok += sinConocer.length ? 0 : 1;
  console.log((sinConocer.length ? '❌ ' : '✅ ') + suite + (resumen ? '  ' + resumen[0].slice(3) : '  (sin verificaciones: solo que no se caiga)'));
  sinConocer.forEach((f) => console.log('   NUEVA ✗ ' + f));
}
const arregladas = conocidos.filter((k) => !vistas.has(k));
if (arregladas.length) {
  console.log('\nℹ️  Ya no fallan (bórralas de tests/conocidos.json):');
  arregladas.forEach((k) => console.log('   ✔ [' + k.suite + '] ' + k.falla));
}
if (process.argv.includes('--anotar')) console.log('\n' + JSON.stringify(anotar, null, 2));
console.log('\n' + (nuevas || caidas
  ? '❌ ' + nuevas + ' falla(s) nueva(s), ' + caidas + ' prueba(s) caída(s).'
  : '✅ Sin regresiones. ' + vistas.size + ' hallazgo(s) conocido(s) siguen documentados en tests/conocidos.json.'));
process.exit(nuevas || caidas ? 1 : 0);
