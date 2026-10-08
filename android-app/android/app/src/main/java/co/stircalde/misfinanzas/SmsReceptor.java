package co.stircalde.misfinanzas;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import java.util.Arrays;
import java.util.List;

/** SMS de los bancos (solo estos remitentes): Davibank 899979, Daviplata 85888, Nequi 85954 y 890806. */
public class SmsReceptor extends BroadcastReceiver {
    static final List<String> REMITENTES = Arrays.asList("899979", "85888", "85954", "890806");

    @Override
    public void onReceive(Context c, Intent intent) {
        try {
            if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
            SmsMessage[] ms = Telephony.Sms.Intents.getMessagesFromIntent(intent);
            if (ms == null || ms.length == 0) return;
            String de = String.valueOf(ms[0].getOriginatingAddress()).replaceAll("\\D", "");
            if (!REMITENTES.contains(de)) return;
            StringBuilder sb = new StringBuilder();
            for (SmsMessage m : ms) sb.append(m.getMessageBody());
            Envio.avisar(c, "sms", "", sb.toString().replaceAll("\\s+", " ").trim(), ms[0].getTimestampMillis());
        } catch (Exception ignored) { }
    }
}
