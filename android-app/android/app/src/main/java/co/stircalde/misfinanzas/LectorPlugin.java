package co.stircalde.misfinanzas;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Puente entre la app web y el lector nativo de avisos (notificaciones + SMS de los bancos). */
@CapacitorPlugin(name = "Lector", permissions = { @Permission(strings = { Manifest.permission.RECEIVE_SMS }, alias = "sms") })
public class LectorPlugin extends Plugin {

    @Override
    public void load() { Envio.reintentar(getContext()); revisarConexion(); }

    @Override
    protected void handleOnResume() { super.handleOnResume(); Envio.reintentar(getContext()); revisarConexion(); }

    /**
     * Xiaomi/HyperOS a veces deja el permiso marcado pero desconecta el lector (p. ej. tras "limpiar todo").
     * Si a los 4 s de abrir la app el lector sigue desconectado, se apaga y se prende su componente: eso obliga a
     * Android a volver a conectarlo (lo mismo que apagar y prender el acceso a notificaciones a mano).
     */
    private void revisarConexion() {
        final Context c = getContext();
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() { public void run() {
            try {
                if (LectorAvisos.instancia != null) return;
                if (!NotificationManagerCompat.getEnabledListenerPackages(c).contains(c.getPackageName())) return;
                if (!Envio.prefs(c).getBoolean("activo", true)) return;
                ComponentName cn = new ComponentName(c, LectorAvisos.class);
                android.content.pm.PackageManager pm = c.getPackageManager();
                pm.setComponentEnabledSetting(cn, android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED, android.content.pm.PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(cn, android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED, android.content.pm.PackageManager.DONT_KILL_APP);
                if (Build.VERSION.SDK_INT >= 24) android.service.notification.NotificationListenerService.requestRebind(cn);
                Envio.prefs(c).edit().putLong("reconexiones", Envio.prefs(c).getLong("reconexiones", 0) + 1).putLong("ultimaReconexion", System.currentTimeMillis()).apply();
            } catch (Exception ignored) { }
        } }, 4000);
    }

    /** La app le pasa la URL de la API y la clave (quedan solo en este celular, nunca en el repositorio). */
    @PluginMethod
    public void configurar(PluginCall call) {
        String url = call.getString("url", ""), clave = call.getString("clave", "");
        if (!url.startsWith("https://")) { call.reject("URL no válida"); return; }
        Envio.prefs(getContext()).edit().putString("url", url).putString("clave", clave).apply();
        Bancos.resolver(getContext());
        call.resolve(estadoObj());
    }

    @PluginMethod
    public void activar(PluginCall call) {
        Envio.prefs(getContext()).edit().putBoolean("activo", call.getBoolean("activo", true)).apply();
        call.resolve(estadoObj());
    }

    @PluginMethod
    public void estado(PluginCall call) { call.resolve(estadoObj()); }

    /** Botón "Revisar barra ahora": si el lector está conectado, revisa la barra; si no, le pide a Android que lo reconecte. */
    @PluginMethod
    public void revisarBarra(PluginCall call) {
        LectorAvisos l = LectorAvisos.instancia;
        JSObject r = estadoObj();
        if (l != null) r.put("revisadas", l.revisarBarra());
        else {
            try {
                ComponentName cn = new ComponentName(getContext(), LectorAvisos.class);
                android.content.pm.PackageManager pm = getContext().getPackageManager();
                pm.setComponentEnabledSetting(cn, android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED, android.content.pm.PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(cn, android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED, android.content.pm.PackageManager.DONT_KILL_APP);
                if (Build.VERSION.SDK_INT >= 24) android.service.notification.NotificationListenerService.requestRebind(cn);
            } catch (Exception ignored) { }
            r.put("revisadas", -1);
        }
        call.resolve(r);
    }

    @PluginMethod
    public void abrirNotificaciones(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        if (Build.VERSION.SDK_INT >= 30) {
            i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
            i.putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, new ComponentName(getContext(), LectorAvisos.class).flattenToString());
        }
        abrir(i, new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
        call.resolve();
    }

    @PluginMethod
    public void pedirSms(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) { call.resolve(estadoObj()); return; }
        requestPermissionForAlias("sms", call, "smsListo");
    }

    @PermissionCallback
    private void smsListo(PluginCall call) { call.resolve(estadoObj()); }

    @PluginMethod
    public void pedirBateria(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getContext().getPackageName()));
        abrir(i, new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        call.resolve();
    }

    /** Ajustes de la app (en Xiaomi: Inicio automático y Ahorro de batería). */
    @PluginMethod
    public void abrirAjustesApp(PluginCall call) {
        abrir(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())), null);
        call.resolve();
    }

    private void abrir(Intent i, Intent respaldo) {
        try { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(i); }
        catch (Exception e) { if (respaldo != null) try { respaldo.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(respaldo); } catch (Exception ignored) { } }
    }

    private JSObject estadoObj() {
        Context c = getContext();
        SharedPreferences p = Envio.prefs(c);
        JSObject o = new JSObject();
        o.put("notificaciones", NotificationManagerCompat.getEnabledListenerPackages(c).contains(c.getPackageName()));
        o.put("sms", getPermissionState("sms") == PermissionState.GRANTED);
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        o.put("bateria", pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName()));
        o.put("activo", p.getBoolean("activo", true));
        o.put("configurado", !p.getString("url", "").isEmpty() && !p.getString("clave", "").isEmpty());
        o.put("enviados", p.getInt("enviados", 0));
        try { o.put("cola", new org.json.JSONArray(p.getString("cola", "[]")).length()); } catch (Exception e) { o.put("cola", 0); }
        o.put("error", p.getString("error", ""));
        try { o.put("historial", new JSArray(p.getString("historial", "[]"))); } catch (Exception e) { o.put("historial", new JSArray()); }
        JSArray apps = new JSArray();
        for (String nombre : Bancos.resolver(c).values()) apps.put(nombre);
        o.put("apps", apps);
        o.put("conectado", LectorAvisos.instancia != null);
        o.put("reconexiones", p.getLong("reconexiones", 0));
        o.put("ultimaReconexion", p.getLong("ultimaReconexion", 0));
        o.put("conectadoDesde", LectorAvisos.conectadoDesde);
        o.put("ultimaVista", LectorAvisos.ultimaVista);
        o.put("ultimaApp", LectorAvisos.ultimaApp);
        o.put("ultimaBanco", LectorAvisos.ultimaBanco);
        o.put("ultimaBancoApp", LectorAvisos.ultimaBancoApp);
        return o;
    }
}
