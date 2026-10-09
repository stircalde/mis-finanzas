package co.stircalde.misfinanzas;

import android.app.Notification;
import android.content.ComponentName;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.ArrayList;
import java.util.List;

/**
 * Lee las notificaciones SOLO de las apps de bancos de la lista blanca exacta (Bancos.java) y las manda al backend
 * como "aviso". Las demás apps se ignoran sin leer su contenido.
 */
public class LectorAvisos extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null || getPackageName().equals(sbn.getPackageName())) return;
            Notification n = sbn.getNotification();
            if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            String pkg = sbn.getPackageName();
            String nombre = Bancos.nombre(this, pkg);
            if (nombre == null) return;                       // no es una app de banco de la lista blanca
            Bundle x = n.extras;
            String titulo = txt(x.getCharSequence(Notification.EXTRA_TITLE));
            List<String> v = new ArrayList<>();
            agregar(v, txt(x.getCharSequence(Notification.EXTRA_TEXT)));
            agregar(v, txt(x.getCharSequence(Notification.EXTRA_BIG_TEXT)));
            CharSequence[] lineas = x.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
            if (lineas != null) { StringBuilder sb = new StringBuilder(); for (CharSequence l : lineas) sb.append(l).append(' '); agregar(v, sb.toString().trim()); }
            agregar(v, txt(n.tickerText));
            if (v.isEmpty() && titulo.isEmpty()) return;
            String texto = android.text.TextUtils.join(" || ", v);
            // Misma notificación (misma clave y misma hora del evento) re-publicada = repetida; dos compras iguales tienen otra hora.
            String llave = sbn.getKey() + "|" + n.when + "|" + titulo + "|" + texto;
            Envio.avisar(this, nombre.toLowerCase(), titulo, texto, sbn.getPostTime(), llave, null);
        } catch (Exception ignored) { }
    }

    /**
     * Al (re)conectarse —por ejemplo, después de que Xiaomi cerró la app a la fuerza y la volviste a abrir— revisa las
     * notificaciones de bancos que siguen en la barra (de las últimas 24 h) y manda las que se perdió. Las ya enviadas
     * se reconocen por su huella y no se repiten.
     */
    @Override
    public void onListenerConnected() {
        Bancos.resolver(this);
        Envio.reintentar(this);
        try {
            StatusBarNotification[] activas = getActiveNotifications();
            long limite = System.currentTimeMillis() - 24 * 3600000L;
            if (activas != null) for (StatusBarNotification sbn : activas) if (sbn != null && sbn.getPostTime() >= limite) onNotificationPosted(sbn);
        } catch (Exception ignored) { }
    }

    @Override
    public void onListenerDisconnected() {
        if (Build.VERSION.SDK_INT >= 24) requestRebind(new ComponentName(this, LectorAvisos.class));
    }


    private static String txt(CharSequence c) { return c == null ? "" : c.toString().replaceAll("\\s+", " ").trim(); }
    private static void agregar(List<String> v, String s) { if (!s.isEmpty() && !v.contains(s)) v.add(s); }
}
