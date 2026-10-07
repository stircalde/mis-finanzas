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
- Backend desplegado: versión 21 (intereses de tarjeta Opción A; clave en Propiedades de script). App: ver `VERSION` en `sw.js`.
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
  8. Registro: error — si primero pongo la fecha y luego el resto de la info, la fecha se reinicia a hoy (corregir para que conserve la fecha elegida).
  9. Backend (Davibank): regla real del banco (2-oct-2026) — una compra a 1 cuota NO es sin interés si en el mismo extracto hay compras diferidas a más de 1 cuota, o si no se paga el total a tiempo: genera interés desde la fecha de compra hasta la fecha límite. Hoy `motorDiario` solo cobra ese interés retroactivo cuando el extracto anterior no se pagó completo. Además, compras internacionales = 36 cuotas automáticas con interés desde el día de compra. Requiere rama + PR + tests + aprobación de Hector.
  Nota del 9: Hector quiere hacerlo la semana del 5-oct-2026 (con el extracto de Davibank del 16-oct a mano para validar). Corrige solo el interés estimado; no explica el ajuste de +$16.450 del 1-oct (queda por revisar con el extracto).
  Prioridad que fijó Hector (7-oct-2026), con sus apuntes; los números 1-9 de arriba siguen valiendo:
  A. Primero: (a) editar movimientos ya registrados para corregir errores [nuevo]; (b) registrar desde la app deudas/favores antiguos que se olvidaron al inicio (hoy solo existe la tabla "Me deben desde antes" en Configuración) [nuevo]; (c) bug de fecha del Registro (idea 8).
  B. Después: límites de gasto editables (idea 2) y Metas de ahorro en Más (idea 4).
  C. Luego: "Próximos pagos" a la altura de las vecinas (idea 1) y logo dinámico coherente con color y estilo (idea 3).
  D. Al final, estudios: registro automático por notificaciones (notificación → transacción detectada → verificación → registro; incluye compras a cuotas y conciliar transferencias entre cuentas; Android), compartir la app (datos independientes, actualizaciones, novedades por versión) e iOS (limitaciones frente a Android).
