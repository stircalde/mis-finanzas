package co.stircalde.misfinanzas;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Lista blanca EXACTA de apps de bancos (por nombre de paquete). Se arma con:
 * - paquetes conocidos, y
 * - las apps instaladas cuyo nombre visible es EXACTAMENTE el de un banco (Nequi Colombia, DaviPlata, DAVIbank, Nubank,
 *   Banco Falabella, Billetera…). Nada de "contiene": una app "Crypto Wallet" no entra.
 */
final class Bancos {
    private Bancos() {}

    static final Set<String> PAQUETES = new HashSet<>(Arrays.asList(
        "com.google.android.apps.walletnfcrel", "com.nu.production", "com.nequi.MobileApp", "com.davivienda.daviplataapp"));
    static final Set<String> NOMBRES = new HashSet<>(Arrays.asList(
        "nequi", "nequicolombia", "daviplata", "davibank", "nu", "nubank", "nucolombia", "bancofalabella", "falabella",
        "billetera", "billeteradegoogle", "googlewallet"));

    private static volatile Map<String, String> cache = null;   // paquete -> nombre visible

    static String norm(String s) {
        return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("[^A-Za-z0-9]", "").toLowerCase();
    }

    /** Paquetes permitidos con su nombre visible (se recalcula al abrir la app). */
    static Map<String, String> permitidos(Context c) {
        Map<String, String> m = cache;
        if (m == null) m = resolver(c);
        return m;
    }

    static synchronized Map<String, String> resolver(Context c) {
        Map<String, String> m = new LinkedHashMap<>();
        try {
            PackageManager pm = c.getPackageManager();
            Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> apps = pm.queryIntentActivities(i, 0);
            for (ResolveInfo r : apps) {
                String pkg = r.activityInfo.packageName;
                if (pkg.equals(c.getPackageName())) continue;
                String nombre = String.valueOf(r.loadLabel(pm));
                if (PAQUETES.contains(pkg) || NOMBRES.contains(norm(nombre))) m.put(pkg, nombre);
            }
        } catch (Exception ignored) { }
        cache = m;
        return m;
    }

    static String nombre(Context c, String pkg) {
        Map<String, String> m = permitidos(c);
        if (m.containsKey(pkg)) return m.get(pkg);
        if (PAQUETES.contains(pkg)) return pkg;
        return null;   // no es un banco: no se lee
    }
}
