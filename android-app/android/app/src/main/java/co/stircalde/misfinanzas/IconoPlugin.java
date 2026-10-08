package co.stircalde.misfinanzas;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Cambia el ícono del lanzador según el color de Apariencia (un activity-alias por color).
 * Cambiarlo con la app abierta hace que Android la cierre, así que aquí solo se anota el color
 * y el cambio se aplica cuando la app pasa a segundo plano (onStop).
 */
@CapacitorPlugin(name = "Icono")
public class IconoPlugin extends Plugin {
    static final String[] COLORES = {"azul", "indigo", "violeta", "rosa", "cian", "esmeralda", "oro", "grafito"};
    private static final String PREFS = "icono", PENDIENTE = "pendiente";

    @PluginMethod
    public void poner(PluginCall call) {
        String color = call.getString("color", "azul");
        boolean ok = false;
        for (String c : COLORES) if (c.equals(color)) ok = true;
        if (!ok) { call.reject("color desconocido"); return; }
        prefs().edit().putString(PENDIENTE, color).apply();
        JSObject r = new JSObject(); r.put("color", color); r.put("pendiente", true); call.resolve(r);
    }

    @Override
    protected void handleOnStop() {
        super.handleOnStop();
        aplicarPendiente();
    }

    private SharedPreferences prefs() { return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    private void aplicarPendiente() {
        SharedPreferences p = prefs();
        String color = p.getString(PENDIENTE, null);
        if (color == null) return;
        p.edit().remove(PENDIENTE).commit();
        PackageManager pm = getContext().getPackageManager();
        String pkg = getContext().getPackageName();
        // Primero activa el nuevo y luego apaga los demás, para que nunca falte un ícono.
        for (String c : COLORES) if (c.equals(color)) cambiar(pm, pkg, c, true);
        for (String c : COLORES) if (!c.equals(color)) cambiar(pm, pkg, c, false);
    }

    private void cambiar(PackageManager pm, String pkg, String c, boolean on) {
        ComponentName cn = new ComponentName(pkg, "co.stircalde.misfinanzas.Icono_" + c);
        int est = on ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
        if (pm.getComponentEnabledSetting(cn) != est) pm.setComponentEnabledSetting(cn, est, PackageManager.DONT_KILL_APP);
    }
}
