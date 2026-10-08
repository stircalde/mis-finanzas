package co.stircalde.misfinanzas;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Cambia el ícono del lanzador según el color de Apariencia (un activity-alias por color). */
@CapacitorPlugin(name = "Icono")
public class IconoPlugin extends Plugin {
    static final String[] COLORES = {"azul", "indigo", "violeta", "rosa", "cian", "esmeralda", "oro", "grafito"};

    @PluginMethod
    public void poner(PluginCall call) {
        String color = call.getString("color", "azul");
        boolean ok = false;
        for (String c : COLORES) if (c.equals(color)) ok = true;
        if (!ok) { call.reject("color desconocido"); return; }
        PackageManager pm = getContext().getPackageManager();
        String pkg = getContext().getPackageName();
        // Primero activa el nuevo y luego apaga los demás, para que nunca falte un ícono.
        for (String c : COLORES) if (c.equals(color)) cambiar(pm, pkg, c, true);
        for (String c : COLORES) if (!c.equals(color)) cambiar(pm, pkg, c, false);
        JSObject r = new JSObject(); r.put("color", color); call.resolve(r);
    }

    private void cambiar(PackageManager pm, String pkg, String c, boolean on) {
        ComponentName cn = new ComponentName(pkg, "co.stircalde.misfinanzas.Icono_" + c);
        int est = on ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
        if (pm.getComponentEnabledSetting(cn) != est) pm.setComponentEnabledSetting(cn, est, PackageManager.DONT_KILL_APP);
    }
}
