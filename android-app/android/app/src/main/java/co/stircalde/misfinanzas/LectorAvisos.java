package co.stircalde.misfinanzas;

import android.app.Notification;
import android.content.ComponentName;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Lee las notificaciones de las apps de bancos (Nequi, Daviplata, Davibank, Nu, Falabella, Billetera de Google)
 * y las manda al backend como "aviso". Las demás apps se ignoran sin leer su contenido.
 */
public class LectorAvisos extends NotificationListenerService {
    static final Pattern BANCO = Pattern.compile("nequi|daviplata|davibank|davivienda|^nu$|^nu |nubank|\\bnu\\.|falabella|billetera|wallet", Pattern.CASE_INSENSITIVE);

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null || getPackageName().equals(sbn.getPackageName())) return;
            Notification n = sbn.getNotification();
            if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            String pkg = sbn.getPackageName();
            String nombre = etiqueta(pkg);
            if (!BANCO.matcher(nombre).find() && !BANCO.matcher(pkg).find()) return;
            Bundle x = n.extras;
            String titulo = txt(x.getCharSequence(Notification.EXTRA_TITLE));
            List<String> v = new ArrayList<>();
            agregar(v, txt(x.getCharSequence(Notification.EXTRA_TEXT)));
            agregar(v, txt(x.getCharSequence(Notification.EXTRA_BIG_TEXT)));
            CharSequence[] lineas = x.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
            if (lineas != null) { StringBuilder sb = new StringBuilder(); for (CharSequence l : lineas) sb.append(l).append(' '); agregar(v, sb.toString().trim()); }
            agregar(v, txt(n.tickerText));
            if (v.isEmpty() && titulo.isEmpty()) return;
            Envio.avisar(this, nombre.toLowerCase(), titulo, android.text.TextUtils.join(" || ", v), sbn.getPostTime());
        } catch (Exception ignored) { }
    }

    @Override
    public void onListenerDisconnected() {
        if (Build.VERSION.SDK_INT >= 24) requestRebind(new ComponentName(this, LectorAvisos.class));
    }

    private String etiqueta(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            return String.valueOf(pm.getApplicationLabel(ai));
        } catch (Exception e) { return pkg; }
    }

    private static String txt(CharSequence c) { return c == null ? "" : c.toString().replaceAll("\\s+", " ").trim(); }
    private static void agregar(List<String> v, String s) { if (!s.isEmpty() && !v.contains(s)) v.add(s); }
}
