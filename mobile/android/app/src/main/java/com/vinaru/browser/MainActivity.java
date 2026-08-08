package com.vinaru.browser;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VinaruBrowserPlugin.class);
        registerPlugin(VinaruDownloadsPlugin.class);
        registerPlugin(VinaruLibraryPlugin.class);
        registerPlugin(VinaruProfilesPlugin.class);
        super.onCreate(savedInstanceState);
        handleChromeAction(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleChromeAction(intent);
    }

    private void handleChromeAction(Intent intent) {
        if (intent == null) return;
        String action = intent.getStringExtra(BrowserActivity.ACTION_EXTRA);
        if (action == null || action.isEmpty()) return;
        intent.removeExtra(BrowserActivity.ACTION_EXTRA);

        final String safeAction = action.replace("'", "");
        getWindow().getDecorView().postDelayed(() -> {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            String js =
                    "window.dispatchEvent(new CustomEvent('vinaru-chrome',{detail:{action:'"
                            + safeAction
                            + "'}}));";
            getBridge().getWebView().evaluateJavascript(js, null);
        }, 250);
    }
}
