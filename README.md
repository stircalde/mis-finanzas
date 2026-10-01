# Mis finanzas

App personal (instalable en el celular y el PC) que muestra mis cuentas, créditos, pagos y gastos.

- Los datos viven en mi Google Sheet y se leen a través de mi Google Apps Script (solo lectura).
- Este repositorio no contiene datos personales: la clave se escribe al abrir la app y queda guardada solo en el dispositivo.
- Los registros se hacen desde el botón del celular (HTTP Request Shortcuts).

## Para desarrollar o auditar

- `DEVELOPMENT.md`: roles, reglas, estructura, pruebas y decisiones intencionales.
- `backend/Codigo.gs`: el backend de Google Apps Script (la clave se configura aparte, en las propiedades del proyecto).
- `tests/`: pruebas del backend en Node; corren solas en GitHub Actions. `node tests/correr.js`
