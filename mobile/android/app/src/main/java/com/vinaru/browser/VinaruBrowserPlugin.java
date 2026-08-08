package com.vinaru.browser;

import android.content.Intent;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VinaruBrowser")
public class VinaruBrowserPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("url is required");
            return;
        }

        boolean incognito = Boolean.TRUE.equals(call.getBoolean("incognito", false));
        int tabCount = 1;
        try {
            Integer tc = call.getInt("tabCount");
            if (tc != null && tc > 0) tabCount = tc;
        } catch (Exception ignored) {
        }

        final int finalTabCount = tabCount;
        getActivity().runOnUiThread(() -> {
            Intent intent = new Intent(getContext(), BrowserActivity.class);
            intent.putExtra(BrowserActivity.EXTRA_URL, url.trim());
            intent.putExtra(BrowserActivity.EXTRA_INCOGNITO, incognito);
            intent.putExtra(BrowserActivity.EXTRA_TAB_COUNT, finalTabCount);
            getActivity().startActivity(intent);
            call.resolve();
        });
    }
}
