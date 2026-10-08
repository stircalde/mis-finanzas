package co.stircalde.misfinanzas;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.util.concurrent.TimeUnit;

/** Reintenta la cola de avisos cuando vuelve internet, aunque la app esté cerrada (WorkManager). */
public class EnvioWorker extends Worker {
    public EnvioWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    @NonNull
    @Override
    public Result doWork() {
        try { return Envio.vaciarAhora(getApplicationContext()) ? Result.success() : Result.retry(); }
        catch (Exception e) { return Result.retry(); }
    }

    static void programar(Context c) {
        try {
            OneTimeWorkRequest w = new OneTimeWorkRequest.Builder(EnvioWorker.class)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .build();
            WorkManager.getInstance(c).enqueueUniqueWork("mf-envio-avisos", ExistingWorkPolicy.KEEP, w);
        } catch (Exception ignored) { }
    }
}
