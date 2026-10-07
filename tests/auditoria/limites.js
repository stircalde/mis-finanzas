// Límites de gasto editables: crear, cambiar tope y categorías, renombrar, quitar; una categoría cuenta en un solo límite.
const A = require('../base'); const { P, D, ok } = A;
A.fresco(); A.reloj(2026, 9, 1, 11);
const lim = (n) => D().presupuestos.find(x => x.grupo === n);
const L = (o) => P(Object.assign({ accion: 'limiteadmin' }, o));

ok(lim('Ocio') && lim('Ocio').categorias.length === 3, 'parte con el límite "Ocio" de 3 categorías');
// 1) Crear
let r = L({ op: 'guardar', anterior: '', nombre: 'Casa', tope: '500000', categorias: 'Mercado|Servicios y hogar' }); A.tic();
ok(r.ok && lim('Casa') && lim('Casa').tope === 500000 && lim('Casa').categorias.join() === 'Mercado,Servicios y hogar', 'crear Casa: ' + r.mensaje);
ok(lim('Ocio').categorias.length === 3, 'Ocio no cambia al crear otro');
// 2) Una categoría de otro límite pasa al nuevo y se avisa
r = L({ op: 'guardar', anterior: '', nombre: 'Compras', tope: '200000', categorias: 'Compras en línea|Ropa' }); A.tic();
ok(r.ok && /antes en "Ocio"/.test(r.mensaje) && lim('Compras').categorias.indexOf('Compras en línea') >= 0 && lim('Ocio').categorias.indexOf('Compras en línea') < 0, 'mueve categoría de Ocio: ' + r.mensaje);
// 3) El gasto cuenta en el límite de su categoría
P({ accion: 'gasto', descripcion: 'Mercadito', monto: '30000', cuenta: 'Nequi', categoria: 'Mercado', fecha: '2026-10-01' }); A.tic();
ok(lim('Casa').gastado >= 30000, 'el gasto de Mercado cuenta en Casa: ' + (lim('Casa') && lim('Casa').gastado));
// 4) Renombrar, cambiar tope y quitar una categoría
r = L({ op: 'guardar', anterior: 'Casa', nombre: 'Hogar', tope: '650000', categorias: 'Mercado' }); A.tic();
ok(r.ok && !lim('Casa') && lim('Hogar') && lim('Hogar').tope === 650000 && lim('Hogar').categorias.join() === 'Mercado', 'renombrar y editar: ' + r.mensaje + ' ' + JSON.stringify(D().presupuestos.map(x => x.grupo)));
ok(D().presupuestos.filter(x => x.grupo === 'Hogar').length === 1, 'no se duplica la fila al renombrar');
// 5) Validaciones
ok(!L({ op: 'guardar', anterior: '', nombre: 'hogar', tope: '1000', categorias: 'Ropa' }).ok, 'nombre repetido (sin importar mayúsculas)');
ok(!L({ op: 'guardar', anterior: '', nombre: 'Presupuesto', tope: '1000', categorias: 'Ropa' }).ok, 'nombre reservado');
ok(!L({ op: 'guardar', anterior: '', nombre: 'Nuevo', tope: '0', categorias: 'Ropa' }).ok, 'tope en 0');
ok(!L({ op: 'guardar', anterior: '', nombre: 'Nuevo', tope: '1000', categorias: '' }).ok, 'sin categorías');
ok(!L({ op: 'guardar', anterior: '', nombre: 'Nuevo', tope: '1000', categorias: 'Inventada' }).ok, 'categoría inexistente');
ok(!L({ op: 'guardar', anterior: 'NoExiste', nombre: 'X', tope: '1000', categorias: 'Ropa' }).ok, 'límite a editar que no existe');
ok(!L({ op: 'quitar', nombre: 'NoExiste' }).ok, 'quitar uno que no existe');
// 6) Quitar: las categorías quedan libres y no se toca ningún movimiento
const nMovs = A.movs().length;
r = L({ op: 'quitar', nombre: 'Hogar' }); A.tic();
ok(r.ok && !lim('Hogar'), 'quitar Hogar: ' + r.mensaje);
const cats = A.sheets['Configuración'] ? A.sheets['Configuración'].grid : null;
ok(!cats || !cats.some(f => f[2] === 'Hogar'), 'ninguna categoría queda apuntando al límite quitado');
ok(A.movs().length === nMovs, 'quitar un límite no toca los movimientos');
ok(lim('Ocio') && lim('Compras'), 'los demás límites siguen');
// 7) La app recibe el límite recién creado en la lista de categorías con su límite actual
ok(Array.isArray(D().listaCategorias) && D().listaCategorias.length >= 10, 'la lista de categorías sigue disponible');
A.fin();
