# Mis Finanzas · protocolo de desarrollo

App personal de finanzas (Colombia, pesos COP, sin decimales). Este documento es la referencia para
quien desarrolla (Claude) y para quien audita (ChatGPT, Gemini u otra persona). **Léelo antes de
reportar hallazgos**: la sección *Decisiones intencionales* explica comportamientos que parecen
errores pero no lo son.

## Roles

| Quién | Qué hace |
|---|---|
| **Hector** (dueño) | Decide qué se implementa y qué hallazgos se aceptan. Aprueba los cambios. |
| **Claude** | Único que escribe código: implementa, corre las pruebas, publica la app y despliega el backend. |
| **ChatGPT** | Auditor: experiencia en el celular, interfaz, consistencia del producto, arquitectura del frontend, rendimiento y regresiones. |
| **Gemini** | Auditor técnico: cálculos financieros, casos extremos, integridad de datos en la hoja y seguridad del backend. |

Los auditores **no modifican archivos**. Reportan hallazgos; Claude los verifica (idealmente con una
prueba que reproduzca el caso) antes de corregir.

## Reglas

1. **Secretos fuera del repositorio.** La clave vive en las *Propiedades de script* del proyecto de
   Apps Script (`CLAVE`) y en el dispositivo de cada usuario. Nunca en el código, en las pruebas ni en
   los documentos.
2. **Sin datos personales.** Los datos de este repositorio (cuentas, saldos, personas, compras) son
   ficticios. Los números de tarjeta nunca se guardan; la app solo usa nombres de cuenta.
3. **Lo que toca dinero pasa por revisión.** Cualquier cambio en saldos, créditos, cuotas, intereses,
   pagos, gastos fijos, fechas o el backend va en una rama con Pull Request, con las pruebas en verde,
   y puede recibir auditoría antes de unirse a `main`.
4. **Cambios de interfaz: primero una previsualización.** Hector aprueba una vista previa funcional
   antes de que el cambio llegue a producción. Los ajustes visuales pequeños ya aprobados pueden ir
   directo a `main`.
5. **Nada se borra de la hoja sin aprobación** (movimientos, cuentas de prueba, etc.).
6. Textos de la app en español de Colombia. El nombre del dueño se escribe *Hector*, sin tilde.

## Estructura

```
index.html, app.js, registro.js, admin.js, app.css   PWA (JavaScript puro, sin frameworks ni compilación)
sw.js                     service worker: red primero (3 s) y caché de respaldo; VERSION se sube en cada publicación
cards.js, cards/, logos/  catálogo de imágenes de tarjetas y logos de bancos
backend/Codigo.gs         Google Apps Script (API + correos + cálculos). Es la misma versión que está en línea.
backend/Dashboard.html    tablero antiguo servido por Apps Script (sin mantenimiento activo)
tests/                    pruebas del backend en Node (ver abajo)
```

**Flujo de datos.** El celular (atajo de *HTTP Request Shortcuts*) y la app envían registros con
`POST` al Apps Script (`doPost`, parámetro `accion`). La app lee todo con
`GET ?api=1&clave=…&mes=yyyy-MM` (`doGet` → `datosDashboard`). Todo se guarda en una Google Sheet:
pestaña **Movimientos** (una fila por registro) y pestaña **Configuración** (cuentas, deudas previas,
gastos fijos, categorías, presupuestos, ajustes y fechas de corte de Davibank).

## Pruebas

```
node tests/correr.js               # todas; código 1 si hay una regresión
node tests/correr.js --actualizar  # acepta un cambio de cálculo intencional (actualiza la foto de números)
node tests/correr.js --anotar      # lista las fallas actuales en formato de conocidos.json
```

GitHub Actions las corre en cada push y en cada Pull Request (`.github/workflows/pruebas.yml`).

- `tests/mock.js` simula Google Sheets, `PropertiesService`, `MailApp`, etc., y carga
  `backend/Codigo.gs` en Node. El reloj es falso y controlable.
- `tests/base.js` trae los ayudantes: `fresco()` (hoja nueva con los datos de ejemplo), `reloj(año, mes0, día, hora)`,
  `tic()`, `P({accion, …})` (= un `doPost`), `D(mes)` (= lo que lee la app) y `ok(condición, mensaje)`.
- `tests/auditoria/*.js` son **sondas**: cada `ok()` que falla imprime `  ✗ mensaje`. Las fallas ya
  revisadas están en `tests/conocidos.json` con su estado (`pendiente`, `intencional`, `mitigado`,
  `decidido`). **Una falla que no esté ahí hace fallar la prueba.**
- `tests/auditoria/fuzz.js` hace 400 operaciones al azar con semilla fija, verifica invariantes en cada
  paso y deja una foto de saldos, deudas, calendarios y meses. Si un solo número cambia respecto a
  `tests/instantanea.json`, la prueba falla y muestra dónde.

**No se usa ningún framework de pruebas** (ni Jest ni Mocha): JavaScript plano con `ok()`. Un caso
nuevo se ve así:

```js
const A = require('../base'); const { P, D, ok } = A;
A.fresco(); A.reloj(2026, 9, 1, 12);                       // 1 de octubre de 2026 (mes 0 = enero)
P({ accion: 'gasto', descripcion: 'Mercado', monto: '300000', cuenta: 'TC Nubank', cuotas: '3', categoria: 'Mercado' });
const nu = D().creditos.find(c => c.nombre === 'TC Nubank');
ok(nu.calendario.length > 0, 'la compra a 3 cuotas no aparece en el calendario');
A.fin('mi_caso');
```

## Decisiones intencionales (no son errores)

**Dinero y saldos**
- **No se bloquea un gasto o transferencia por falta de saldo.** Los saldos de la app pueden ir
  atrasados respecto al banco; bloquear impediría registrar la realidad. Se corrige con un *ajuste*.
- **Saldo inicial + "Saldo a la fecha".** Cada cuenta arranca con un saldo tomado en una fecha; solo
  cuentan los movimientos con *Registrado el* posterior a esa fecha.
- **Movimientos históricos (`id` que empieza por `hist:`)** no mueven saldos (ya están en el saldo
  inicial); en los resúmenes mensuales solo cuentan desde `RESUMEN_DESDE`.
- **Cuenta "Mamá" y "Mamá (regalo)".** "Mamá" es una deuda (lo que ella presta). "Mamá (regalo)" es una
  cuenta de paso que siempre queda en $0: registra lo que ella paga y regala, como ingreso y gasto a la vez.
- **Pagarle a alguien más de lo que le debes** exige decir qué pasa con la diferencia (`exceso`):
  `debe` (te la queda debiendo → pasa a *Me deben*) o `regalo` (gasto tuyo). Sin eso, el backend lo
  rechaza, para que nunca desaparezca plata. Al revés (*Me pagaron* de más) existe `exceso=ingreso`.
  El exceso se calcula contra lo que se debe **hoy** (con todos los préstamos y pagos registrados), no
  contra lo que se debía en la fecha del pago: el resultado final —quién le debe a quién y cuánto— es
  el mismo, sin importar el orden en que se registren.
- **Cada registro se escribe en la hoja de una sola vez** al final de `doPost` (aunque genere varias
  filas). Si la escritura falla no queda nada a medias, y el reintento con el mismo `rid` lo guarda completo.
- **Bolsillos** (cuenta de plata con "Aparta para"): dinero separado para pagar una tarjeta; cuenta
  como plata y se muestra junto a la tarjeta que alimenta.
- **"Disponible para gastar"** = plata total − cuotas de créditos que vencen en los próximos 30 días −
  gastos fijos pendientes de esos 30 días que salen de cuentas de plata.

**Tarjetas y créditos**
- Tres modos: **Corte mensual** (tarjetas: día de corte y de pago, "Mismo" o "Siguiente" mes, o
  "Tabla" con las fechas publicadas por el banco), **Por compra** (cada compra con su propio plazo
  mensual desde la fecha de compra, como Credifin) y **Sin cuotas**.
- **Intereses de tarjeta (Opción A, implementada):** en cada corte la app suma los intereses a la deuda; el
  extracto solo sirve para cuadrar diferencias de pesos con un *ajuste*. Dos modelos:
  - **Diario** (tarjetas con "interés desde la cuota 1", p. ej. Davibank; `motorDiario`): tasa diaria = tasa mensual / 30
    sobre el **capital** (no sobre intereses ni cargos); compras a cuotas y avances desde el día de la compra (incluido);
    compras a 1 cuota sin interés **solo si el extracto anterior se pagó completo** antes de la fecha límite; si no, se
    cobran retroactivas desde la compra en el corte siguiente. Un pago reduce el capital desde el día siguiente y cubre
    primero lo facturado que no es capital. Verificado con dos extractos reales: agosto exacto, septiembre con $18 de
    diferencia sobre $57.258 (Davibank aplica luego un "reintegro" de pesos). Los cortes futuros se proyectan
    suponiendo que pagas lo del calendario; `ahorroTotal` compara contra pagar el total.
  - **Por cuota** (las demás, p. ej. Nubank): la 1.ª cuota sin interés y luego tasa mensual sobre lo que falta; el
    interés de cada cuota entra a la deuda el día de su corte.
  - Un interés registrado a mano (gasto de "Intereses y cargos" con "interés" en la descripción) reemplaza el cálculo
    de ese corte, para no contarlo dos veces.
  - Compras en el exterior con tarjeta: opción en el registro que agrega la comisión de la franquicia (0,45 %), que no
    genera intereses.
- **Total de cuotas entre 0,98 y 2 veces el monto.** Si el usuario escribe el valor de la cuota y el
  total queda fuera de ese rango, se rechaza: casi siempre es un error de digitación.
- "1 cuota sin interés" e "interés desde la cuota 1" son ajustes por cuenta.

**Integridad y seguridad**
- **Idempotencia con `rid`.** La app envía un id por registro; si llega dos veces, el backend responde
  "Ya estaba registrado" sin duplicar. El atajo del celular todavía no lo envía (pendiente).
- **Anti-fórmulas.** Un texto que empieza por `= + - @` se guarda con un apóstrofo delante para que
  Sheets no lo ejecute (los números negativos no se tocan).
- **Fechas:** se aceptan `yyyy-mm-dd` o `dd/mm/yyyy`; se rechazan fechas imposibles y fechas más de
  1 día en el futuro.
- **Concurrencia:** `doPost` y el recordatorio diario usan `LockService`.
- **Nombres reservados:** no se pueden crear cuentas o fijos que se llamen como un encabezado de la
  pestaña Configuración ("Cuenta", "Persona", etc.), ni duplicados que solo cambien tildes o mayúsculas.
- La API exige la clave en cada llamada; sin la propiedad `CLAVE` configurada, rechaza todo.

**Frontend**
- **Cola de registro instantánea:** al registrar, la app cierra el formulario de inmediato y envía en
  segundo plano (cola en `localStorage`, con reintento y botón "Corregir").
- **Sin `backdrop-filter`** en superficies grandes ni en el calendario: se quitó por fluidez en celulares.
- **Transiciones entre pestañas** con View Transitions; nunca se quita una clase que vuelva a disparar
  la animación de entrada (se usa `style.animation = 'none'`).
- La clave se escribe una vez en la app y queda solo en ese dispositivo.
- **Movimientos → Filtros → "Elegir mes"** preselecciona el mes más reciente (se ve en el selector). Decidido por Hector.
- **Apariencia** (Más → Configuración → Apariencia; se guarda por dispositivo): 4 ejes independientes, todos con
  variables CSS en `<html>` (`data-theme`, `data-color`, `data-estilo`, `data-oled`). Cada color define solo
  7 valores (`--c1…--c4`, `--c1c`, `--on`, `--ch`); fondos, superficies, textos y bordes se derivan con
  `color-mix()` desde `--tinte`. Los colores con significado (verde, rojo, ámbar), la paleta de gráficas y
  los colores de bancos **no cambian**. `tests/auditoria/apariencia.js` verifica contraste y que ningún
  color se confunda con los semánticos ni con colores de bancos. Cristal **no usa `backdrop-filter`**.
  OLED solo aplica en tema oscuro (en Automático, cuando el sistema está en oscuro); no se puede detectar
  el tipo de pantalla desde el navegador, por eso es un interruptor visible para todos.
  En **Automático** el interruptor OLED está disponible aunque el sistema esté en claro: queda guardado y se
  aplica solo cuando el sistema pase a oscuro (el resumen dice "OLED en oscuro"). Al pasar a Claro no se
  borra la elección; se ignora mientras el tema sea claro y vuelve al regresar a oscuro. Decidido.
- **Hojas flotantes en vez de expandir** (decidido por Hector): en un crédito, tocar *Próximo pago* abre una hoja
  con fecha, total, conceptos y cuotas, y desde ahí el calendario completo; el bloque de abajo que lo repetía se
  quitó. En Inicio, *Ver todos los pagos* y tocar un pago de crédito también abren hoja (con botón para ir al
  crédito). Atrás cierra la hoja sin mover el scroll. Para ir a otra pantalla desde una hoja se usa
  `irDesdeHoja()`, que reemplaza la entrada de la hoja en el historial: así un solo Atrás vuelve a donde estabas.
- **Volver al mismo punto**: `ir()` y la barra inferior marcan la pantalla que dejas (`history.state.volver`);
  al volver con Atrás se restaura el scroll y lo abierto. Ir hacia adelante a una pantalla (barra inferior) la
  abre desde arriba.
- **Título de la pantalla**: el saludo ("Buenas noches, Hector") solo en Inicio; en las demás, el nombre de la sección.
- **Favores**: cada compra que te deben tiene "Registrar que me pagó esto" (abre Ingreso → Me pagaron con la
  persona y la compra elegidas) y cada persona a la que le debes, "Registrar que le pagué" (Pagar → Devolverle a…).
  "Algo que me debían desde antes" agrega una fila a ME DEBEN DESDE ANTES (acción `deudaantigua`); no mueve cuentas.
  "Algo que le debía desde antes" (acción `ledebiaantes`) guarda un "Me prestaron" sin cuenta: sube "Les debes" y no mueve
  ningún saldo; se paga luego con "Le pagué".
- **Corregir movimientos** (acción `editarmov`, por ID): tocar un movimiento en cualquier lista abre el formulario
  (fecha, descripción, monto, categoría, cuenta, destino en transferencias; cuotas y valor en gastos de crédito, que se
  recalculan con las reglas del registro). Las compras a cuotas se corrigen desde su hoja de plan. No se editan los
  históricos de extractos ("hist:") ni los ajustes de saldo. Si el registro creó otras filas (apartado, comisión), avisa.
- **"Para quién" editable** (en `editarmov`, campo `para`, mismo formato que el registro: `Ana` | `Ana:30000; Leo:20000`):
  solo gastos; el reparto no puede superar el monto.
- **Eliminar movimientos** (acciones `previsualizarborrado` → `borrarmov` → `restaurarmov`): el botón 🗑️ del formulario
  muestra primero qué filas se van (las ligadas por el mismo `rid`: apartado, comisión, aporte), cómo quedan los saldos y
  lo que cambia con cada persona (se simula `calcular` sin esas filas), y avisa si un bolsillo no queda en $0 con un botón
  para mover ese saldo. Luego exige escribir ELIMINAR. Nada se pierde: las filas pasan a la hoja "Eliminados" con un `lote`
  y "Deshacer" las devuelve. Los "hist:" de extractos nunca se borran (prevalecen); los registros viejos sin `rid` se
  borran solos (no hay forma segura de ligarlos).
- **Registro**: la fecha elegida se conserva al cambiar de tipo de movimiento; solo "Registrar otro" vuelve a hoy.
- **Calendario → Lo que viene / día**: un gasto fijo o suscripción abre su detalle (`MFAdmin.fijo`); un crédito
  sigue llevando al crédito.
- **Chips de marcas negras** (TC Davibank): fondo blanco con la letra de la marca (como Daviplata, invertido),
  porque negro con rojo sobre el fondo oscuro cansa la vista. Solo el chip; el logo y la tarjeta no cambian.
- **Intereses del ciclo** en el crédito muestra solo el valor y las fechas del ciclo; el cálculo no cambia.

## Cómo reportar un hallazgo (auditores)

- **Severidad:** Crítico (pierde o descuadra dinero/datos) / Alto / Medio / Bajo
- **Dónde:** archivo + función (o línea)
- **Escenario:** pasos y datos concretos (fechas, montos, cuotas)
- **Esperado vs. obtenido**, con la cuenta hecha
- **Confianza:** Alta / Media / Baja
- **Tipo:** Bug comprobado / Riesgo posible / Sugerencia
- Si puedes, el caso escrito como prueba (formato de arriba).

Antes de reportar, revisa `tests/conocidos.json`: ahí están los hallazgos que ya se conocen y su estado.
