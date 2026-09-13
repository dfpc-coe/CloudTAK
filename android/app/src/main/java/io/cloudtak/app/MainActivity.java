package io.cloudtak.app;

import android.os.SystemClock;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private static final long RELOAD_AFTER_BACKGROUND_MS = 30_000;

    private long backgroundedAt = -1;

    @Override
    protected void load() {
        super.load();

        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                recreate();
                return true;
            }
        });
    }

    @Override
    public void onStop() {
        super.onStop();
        backgroundedAt = SystemClock.elapsedRealtime();
    }

    @Override
    public void onStart() {
        super.onStart();

        if (backgroundedAt < 0) return;

        long elapsed = SystemClock.elapsedRealtime() - backgroundedAt;
        backgroundedAt = -1;

        if (elapsed >= RELOAD_AFTER_BACKGROUND_MS && getBridge() != null) {
            getBridge().getWebView().reload();
        }
    }
}
