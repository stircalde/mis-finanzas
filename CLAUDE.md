# Contexto para Claude

Proyecto personal de **Hector** (sin tilde), abogado en Colombia. Se habla en español. Lee primero
`DEVELOPMENT.md`: roles, reglas, estructura, pruebas y decisiones intencionales.

## Reglas que no se negocian
- **Nunca** subas a este repositorio (es público) la clave, la URL de la API con la clave, números de
  tarjeta, direcciones ni datos personales reales. Los datos de ejemplo del backend son ficticios.
- No escribas claves ni contraseñas en campos de ningún sitio; eso lo hace Hector.
- No borres datos de su hoja (movimientos, cuentas de prueba) sin su aprobación explícita.
- Cambios de interfaz: primero una **previsualización funcional** para que Hector apruebe.
- Cambios que tocan dinero o el backend: rama + Pull Request + `node tests/correr.js` en verde.
- Gasta pocos tokens: respuestas cortas, sin repetir lo que él ya vio.

## Publicar la app (PWA en GitHub Pages)
1. Edita los archivos en la raíz del repo.
2. Sube `VERSION` en `sw.js` (formato `mf-v5-NN`) para que los celulares tomen el cambio.
3. Commit y push a `main` (o PR). GitHub Pages publica en 1–2 minutos.

## Desplegar el backend (Apps Script)
`backend/Codigo.gs` es exactamente el código que está en línea. La clave NO está en el código: se lee
de *Propiedades de script → CLAVE*.
1. Cambia `backend/Codigo.gs` y corre `node tests/correr.js`. Si un cambio de cálculo es intencional,
   `--actualizar` y explica la diferencia en el PR.
2. Abre el editor de Apps Script de la hoja "Registro de gastos" (Extensiones → Apps Script) en el
   navegador de Hector y reemplaza el contenido de `Codigo.gs` (vía el modelo de Monaco:
   `monaco.editor.getModels()`, `pushEditOperations` sobre `getFullModelRange()`); verifica con un hash
   que quedó idéntico al archivo del repo.
3. Ctrl+S → Implementar → Gestionar implementaciones → Editar → Versión: **Versión nueva** →
   Implementar → Hecho. (Editar la implementación existente conserva la URL que usan la app y el atajo.)
4. Verifica desde la app (`stircalde.github.io/mis-finanzas`) que la API responde `ok`.
5. Si algo falla: Gestionar implementaciones → Editar → elige la versión anterior.

## Estado
- Backend desplegado: avisos de bancos con lector sin tildes y variantes `||` (PR #18–#22; hash 22755511c024, PR #22 = Billetera de Google por nombre de app, pendiente de que Hector lo despliegue; Hector hizo los últimos despliegues a mano — v30 = primera versión de avisos; v29 = favor antiguo con pagos anteriores con fecha; clave en Propiedades de script). App: ver `VERSION` en `sw.js`.
- Apariencia (tema, 8 colores, Original/Cristal/Mate, OLED) publicada: ver DEVELOPMENT.md.
- Pendientes conocidos: `tests/conocidos.json`. Intereses de tarjeta Opción A ya en línea (v21); falta confirmar
  la fórmula de Nubank en cuotas siguientes con el extracto de noviembre.
- Ideas propuestas, sin empezar (pedidas por Hector, 1-oct-2026; no implementar sin su visto bueno):
  1. Inicio: que "Próximos pagos" muestre pagos suficientes para igualar el alto de las tarjetas vecinas (hoy muestra uno y queda vacío).
  2. Más: editar límites de gasto (presupuestos): renombrar, cambiar el tope y agregar nuevos (hoy solo "Ocio", sin edición).
  3. Revisar el logo dinámico (hablado con ChatGPT): que el logo cambie según el estilo de la app.
  4. Incluir el módulo de Metas de ahorro dentro de "Más".
  5. Estudiar registro automático de cobros enlazando apps bancarias (p. ej. notificaciones/MacroDroid).
  6. Compartir la app con otra persona: uso independiente, pero que reciba mis actualizaciones y un resumen de cambios (plantilla multiusuario + versiones/changelog).
  7. Que funcione en iOS (el registro automático probablemente no).
  8. (HECHO, PR #7) Registro: la fecha elegida ya no se reinicia a hoy.
  9. Backend (Davibank): regla real del banco (2-oct-2026) — una compra a 1 cuota NO es sin interés si en el mismo extracto hay compras diferidas a más de 1 cuota, o si no se paga el total a tiempo: genera interés desde la fecha de compra hasta la fecha límite. Hoy `motorDiario` solo cobra ese interés retroactivo cuando el extracto anterior no se pagó completo. Además, compras internacionales = 36 cuotas automáticas con interés desde el día de compra. Requiere rama + PR + tests + aprobación de Hector.
  Nota del 9: Hector quiere hacerlo la semana del 5-oct-2026 (con el extracto de Davibank del 16-oct a mano para validar). Corrige solo el interés estimado; no explica el ajuste de +$16.450 del 1-oct (queda por revisar con el extracto).
  Prioridad que fijó Hector (7-oct-2026), con sus apuntes; los números 1-9 de arriba siguen valiendo:
  A. HECHO y publicado el 7-oct (PR #7, app mf-v5-59, backend v22): (a) editar movimientos; (b) agregar desde Favores lo que me debían desde antes; (c) bug de fecha.
  B. HECHO 7-oct (backend v26, app mf-v5-63): límites de gasto editables + 15 categorías nuevas + Favores "Añadir registro" + Metas de ahorro (idea 4; tarjeta en Inicio sobre "¿En qué se fue la plata?").
  C. HECHO 7-oct: "Próximos pagos" a la altura de las vecinas (idea 1) y logo dinámico SVG con volumen (idea 3; app mf-v5-65; íconos de la PWA siguen estáticos y sin cambios).
  G. HECHO 7-oct: Favores → compartir el favor como imagen (resumen con pagos, y pago + resumen al registrar; app mf-v5-67, solo app, sin backend).
  H. HECHO 7-oct (backend v27, app mf-v5-68): fecha de pago opcional en favores, favor antiguo con valor inicial + saldo actual, "Le prestaste".
  I. FUNCIONANDO 7-oct (PR #17–#21, app mf-v5-70): macro "Avisos bancos" en MacroDroid probada con Nequi → Falabella real (se une en una transferencia). MacroDroid pierde tildes y "¡" y agrega llaves: el lector ya no depende de eso. Faltan las macros de Wallet y SMS: avisos de bancos por macro del celular → hoja `Avisos` → "Por confirmar" (Más + campana en Inicio). Backend acciones `aviso`/`avisoresolver`/`avisosmodo` (versión 30 cuando se despliegue), app mf-v5-69. Guía: `docs/avisos-macro.md`. Modo inicial "solo avisar"; sin opción de ajuste de saldo; Credifin/Addi no se leen. Después, app Android nativa que lea las notificaciones sola.
  D. Al final, estudios: registro automático por notificaciones (notificación → transacción detectada → verificación → registro; incluye compras a cuotas y conciliar transferencias entre cuentas; Android), compartir la app (datos independientes, actualizaciones, novedades por versión) e iOS (limitaciones frente a Android).
  E. HECHO y publicado el 7-oct (PR #8, app mf-v5-60, backend v23): editar "para quién" (varias personas) y borrar movimientos con doble confirmación; filas ligadas (apartado, comisión, aporte de mamá) se borran juntas y avisa si el bolsillo queda ≠ $0; los borrados pasan a una pestaña "Eliminados" (recuperables); los "hist:" de extractos prevalecen y no se tocan.
  F. Davibank, ajuste +$16.450 (7-oct): NO es interés diario sin facturar (el cupo/pago total del banco no se movió del 1 al 7-oct: $3.769.905; el mínimo del banco hoy $977.234 no lo incluye). Origen desconocido: revisar con el extracto del 16-oct (¿renglón de $16.450?). Los intereses ya facturados sí ocupan cupo (extractos ago/sep). No eliminar el ajuste hasta entonces.
