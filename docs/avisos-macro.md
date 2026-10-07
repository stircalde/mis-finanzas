# Avisos de los bancos → "Por confirmar" (Android)

Una macro del celular (MacroDroid o Tasker) reenvía cada notificación o SMS del banco a la hoja con la acción `aviso`.
El backend lee el texto, une los avisos repetidos (app + SMS + Billetera de Google + correo), mira si ya lo registraste a mano
y lo deja en la hoja **Avisos** como *Pendiente*. En la app aparece en **Más → Por confirmar** y en la campana de Inicio.

> La URL de la API y la clave **no van en este repositorio**: las pega Hector directamente en la macro.

## Qué se envía (POST, formulario `application/x-www-form-urlencoded`)

| Campo | Valor |
|---|---|
| `accion` | `aviso` |
| `clave` | tu clave (la misma de la app) |
| `app` | `nequi`, `nubank`, `falabella`, `wallet`, `correo` o `sms` (según de dónde viene) |
| `titulo` | título de la notificación (vacío en SMS) |
| `texto` | texto de la notificación o del SMS |
| `ts` | hora en milisegundos (en MacroDroid: la variable de hora del sistema en ms) |

## Macros sugeridas

1. **Notificaciones**: disparador *Notificación recibida* de Nequi, Nubank, Falabella y Billetera de Google (`app` = `wallet`).
   Acción *HTTP Request* POST a la URL de la API con los campos de arriba (`titulo` = título, `texto` = texto).
2. **SMS**: disparador *SMS recibido* de los remitentes del banco (Davibank, Daviplata, Nequi 890806). `app` = `sms`, `texto` = mensaje.
3. **Correos de PSE** (opcional): notificación de Gmail con "Pago exitoso" / "Transacción aprobada". `app` = `correo`.
4. Que la macro reintente si no hay internet (ya hay idempotencia: un aviso repetido no se duplica).

Credifin y Addi **no** se envían (cuotas especiales): se registran a mano.

## Cómo se comporta

- Modo por defecto: **solo avisar**. Nada toca saldos hasta que lo resuelves.
- Modo **automático** (se cambia en Por confirmar): los gastos con una sola cuenta (tarjetas a 1 cuota) y las transferencias entre tus cuentas se registran solas; lo demás y lo que te envía otra persona siempre espera tu decisión.
- Lo que ya registraste a mano se marca como *Ya estaba* (mismo monto, cuenta y fecha ±1 día).
- Salida de una cuenta + entrada con tu nombre en otra, mismo monto y casi misma hora = una **transferencia**.
- El monto siempre es el del banco; en el formulario de resolución no se puede cambiar.
