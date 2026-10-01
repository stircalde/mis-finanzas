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
- Backend desplegado: versión 20 (clave en Propiedades de script). App: ver `VERSION` en `sw.js`.
- Apariencia (tema, 8 colores, Original/Cristal/Mate, OLED) publicada: ver DEVELOPMENT.md.
- Pendientes conocidos: `tests/conocidos.json`. El más importante: intereses de tarjeta **Opción A**
  (ver DEVELOPMENT.md), que se hace con los extractos reales de Davibank y Nubank.
- Ideas propuestas, sin empezar: versión para otras personas (plantilla), registro automático desde
  notificaciones.
