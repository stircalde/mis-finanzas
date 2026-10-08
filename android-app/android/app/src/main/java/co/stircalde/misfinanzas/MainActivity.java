package co.stircalde.misfinanzas;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IconoPlugin.class);
        registerPlugin(LectorPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
