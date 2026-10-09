package co.stircalde.misfinanzas;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Manda los avisos del lector nativo al mismo backend que usa MacroDroid (accion=aviso, origen=app).
 * La URL y la clave las pone la app (plugin Lector.configurar) y quedan solo en este celular.
 * Si no hay internet, el aviso queda en cola y se reintenta con el siguiente aviso o al abrir la app.
 */
public final class Envio {
    static final String PREFS = "lector";
    private static final Object LOCK = new Object();
    private static final Map<String, Long> RECIENTES = new LinkedHashMap<>();
    private static final long VENTANA = 10 * 60 * 1000L;

    private Envio() {}

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static boolean activo(Context c) {
        SharedPreferences p = prefs(c);
        return p.getBoolean("activo", true) && !p.getString("url", "").isEmpty() && !p.getString("clave", "").isEmpty();
    }

    /**
     * ¿Esta notificación concreta ya se mandó? Se recuerda en memoria (10 min) y también en el celular (las últimas 400),
     * para que al ponerse al día tras un reinicio o un cierre forzado no se reenvíe lo que ya llegó.
     */
    static synchronized boolean repetido(Context c, String llave) {
        long ahora = System.currentTimeMillis();
        Iterator<Map.Entry<String, Long>> it = RECIENTES.entrySet().iterator();
        while (it.hasNext()) if (ahora - it.next().getValue() > VENTANA) it.remove();
        if (RECIENTES.containsKey(llave)) return true;
        String h = huella(llave);
        JSONArray vistas;
        try { vistas = new JSONArray(prefs(c).getString("vistas", "[]")); } catch (Exception e) { vistas = new JSONArray(); }
        for (int i = 0; i < vistas.length(); i++) if (h.equals(vistas.optString(i))) { RECIENTES.put(llave, ahora); return true; }
        RECIENTES.put(llave, ahora);
        while (RECIENTES.size() > 200) { RECIENTES.remove(RECIENTES.keySet().iterator().next()); }
        vistas.put(h);
        while (vistas.length() > 400) vistas.remove(0);
        prefs(c).edit().putString("vistas", vistas.toString()).commit();
        return false;
    }

    private static String huella(String s) {
        try {
            byte[] d = java.security.MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 12; i++) sb.append(String.format("%02x", d[i]));
            return sb.toString();
        } catch (Exception e) { return String.valueOf(s.hashCode()); }
    }

    /**
     * llave: identifica la notificación concreta (clave del sistema + hora del evento); si llega dos veces la misma, se manda una.
     * alFinal (puede ser null) se llama cuando el envío terminó o quedó en cola: el receptor de SMS lo usa con goAsync().
     */
    static void avisar(final Context ctx, String app, String titulo, String texto, long ts, String llave, final Runnable alFinal) {
        final Context c = ctx.getApplicationContext();
        if (!activo(c) || repetido(c, llave)) { if (alFinal != null) alFinal.run(); return; }
        final JSONObject a = new JSONObject();
        try { a.put("app", app); a.put("titulo", titulo); a.put("texto", texto); a.put("ts", ts); } catch (Exception e) { if (alFinal != null) alFinal.run(); return; }
        // Primero queda guardado en la cola (si el sistema mata el proceso, se reintenta al abrir la app); luego se envía.
        synchronized (LOCK) { encolar(c, a); }
        new Thread(new Runnable() { public void run() {
            try { synchronized (LOCK) { vaciar(c); } } finally { if (alFinal != null) alFinal.run(); }
        } }).start();
    }

    /** Reintenta lo que quedó en cola (al abrir la app). */
    static void reintentar(final Context ctx) {
        final Context c = ctx.getApplicationContext();
        if (!activo(c)) return;
        new Thread(new Runnable() { public void run() { synchronized (LOCK) { vaciar(c); } } }).start();
    }

    /** Lo llama EnvioWorker (WorkManager) cuando vuelve internet. Devuelve true si la cola quedó vacía. */
    static boolean vaciarAhora(Context ctx) {
        Context c = ctx.getApplicationContext();
        if (!activo(c)) return true;
        synchronized (LOCK) { vaciar(c); return cola(c).length() == 0; }
    }

    private static JSONArray cola(Context c) {
        try { return new JSONArray(prefs(c).getString("cola", "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    private static void encolar(Context c, JSONObject a) {
        JSONArray q = cola(c);
        q.put(a);
        while (q.length() > 100) q.remove(0);
        prefs(c).edit().putString("cola", q.toString()).apply();
    }

    private static void vaciar(Context c) {
        JSONArray q = cola(c);
        JSONArray resto = new JSONArray();
        boolean caido = false;
        for (int i = 0; i < q.length(); i++) {
            JSONObject a = q.optJSONObject(i);
            if (a == null) continue;
            if (caido) { resto.put(a); continue; }
            String r = mandar(c, a);
            if (r == null) {
                caido = true;
                int n = a.optInt("intentos", 0) + 1;
                if (n >= 60) anotar(c, a.optString("app"), a.optLong("ts"), "❌ No se pudo enviar tras 60 intentos: " + prefs(c).getString("error", ""));
                else { try { a.put("intentos", n); } catch (Exception ignored) { } resto.put(a); }
            }
            else anotar(c, a.optString("app"), a.optLong("ts"), r);
        }
        prefs(c).edit().putString("cola", resto.toString()).commit();
        if (resto.length() > 0) EnvioWorker.programar(c);   // reintento con WorkManager cuando haya internet, aunque no abras la app
    }

    /** Devuelve el mensaje del servidor, o null si no se pudo conectar (queda en cola). */
    private static String mandar(Context c, JSONObject a) {
        SharedPreferences p = prefs(c);
        HttpURLConnection con = null;
        try {
            String cuerpo = "accion=aviso&origen=app" +
                "&clave=" + enc(p.getString("clave", "")) +
                "&app=" + enc(a.optString("app")) +
                "&titulo=" + enc(a.optString("titulo")) +
                "&texto=" + enc(a.optString("texto")) +
                "&ts=" + a.optLong("ts");
            con = (HttpURLConnection) new URL(p.getString("url", "")).openConnection();
            con.setConnectTimeout(15000); con.setReadTimeout(30000);
            con.setInstanceFollowRedirects(true);
            con.setRequestMethod("POST"); con.setDoOutput(true);
            con.setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=utf-8");
            OutputStream os = con.getOutputStream();
            os.write(cuerpo.getBytes(StandardCharsets.UTF_8)); os.close();
            int code = con.getResponseCode();
            if (code >= 500 || code == 408 || code == 429) { p.edit().putString("error", "HTTP " + code).apply(); return null; }   // temporal: queda en cola
            StringBuilder sb = new StringBuilder();
            BufferedReader br = new BufferedReader(new InputStreamReader(code >= 400 ? con.getErrorStream() : con.getInputStream(), StandardCharsets.UTF_8));
            String l; while ((l = br.readLine()) != null && sb.length() < 4000) sb.append(l);
            br.close();
            // Solo sale de la cola con una respuesta JSON del backend; cualquier otra cosa (página de error, redirect raro) se reintenta.
            try { JSONObject j = new JSONObject(sb.toString()); if (!j.has("ok")) throw new Exception("sin ok"); return (j.optBoolean("ok") ? "" : "❌ ") + j.optString("mensaje", "ok"); }
            catch (Exception e) { p.edit().putString("error", "Respuesta inesperada (HTTP " + code + ")").apply(); return null; }
        } catch (Exception e) {
            p.edit().putString("error", e.getClass().getSimpleName() + ": " + e.getMessage()).apply();
            return null;
        } finally { if (con != null) con.disconnect(); }
    }

    private static String enc(String s) throws Exception { return URLEncoder.encode(s == null ? "" : s, "UTF-8"); }

    /** Historial corto para la pantalla "Lector del celular": qué llegó y qué respondió el servidor. */
    private static void anotar(Context c, String app, long ts, String resultado) {
        SharedPreferences p = prefs(c);
        JSONArray h;
        try { h = new JSONArray(p.getString("historial", "[]")); } catch (Exception e) { h = new JSONArray(); }
        JSONObject o = new JSONObject();
        try {
            o.put("hora", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm", Locale.US).format(new Date(ts > 0 ? ts : System.currentTimeMillis())));
            o.put("app", app); o.put("r", resultado);
        } catch (Exception ignored) {}
        h.put(o);
        while (h.length() > 15) h.remove(0);
        p.edit().putString("historial", h.toString()).putInt("enviados", p.getInt("enviados", 0) + 1).remove("error").apply();
    }
}
