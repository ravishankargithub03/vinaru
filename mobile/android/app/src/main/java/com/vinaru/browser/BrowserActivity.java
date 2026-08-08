package com.vinaru.browser;

import android.annotation.SuppressLint;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ProgressBar;

import androidx.appcompat.app.AppCompatActivity;

public class BrowserActivity extends AppCompatActivity {
    public static final String EXTRA_URL = "url";

    private WebView webView;
    private EditText addressBar;
    private ProgressBar progress;
    private ImageButton btnBack;
    private ImageButton btnForward;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_browser);

        webView = findViewById(R.id.webView);
        addressBar = findViewById(R.id.addressBar);
        progress = findViewById(R.id.progress);
        btnBack = findViewById(R.id.btnBack);
        btnForward = findViewById(R.id.btnForward);
        ImageButton btnReload = findViewById(R.id.btnReload);
        ImageButton btnHome = findViewById(R.id.btnHome);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Keep every navigation inside this WebView (do not hand off to Chrome).
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                addressBar.setText(displayUrl(url));
                updateNavButtons();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                addressBar.setText(displayUrl(url));
                updateNavButtons();
                progress.setVisibility(View.GONE);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress >= 100) {
                    progress.setVisibility(View.GONE);
                } else {
                    progress.setVisibility(View.VISIBLE);
                    progress.setProgress(newProgress);
                }
            }

            @Override
            public void onReceivedTitle(WebView view, String title) {
                // keep address bar focused on URL display
            }
        });

        btnBack.setOnClickListener(v -> {
            if (webView.canGoBack()) webView.goBack();
            else finish();
        });
        btnForward.setOnClickListener(v -> {
            if (webView.canGoForward()) webView.goForward();
        });
        btnReload.setOnClickListener(v -> webView.reload());
        btnHome.setOnClickListener(v -> finish());

        addressBar.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_GO
                    || actionId == EditorInfo.IME_ACTION_DONE
                    || (event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER && event.getAction() == KeyEvent.ACTION_DOWN)) {
                String resolved = resolveInput(addressBar.getText().toString());
                if (resolved != null) webView.loadUrl(resolved);
                return true;
            }
            return false;
        });

        String startUrl = getIntent().getStringExtra(EXTRA_URL);
        if (startUrl == null || startUrl.trim().isEmpty()) {
            startUrl = "https://www.google.com";
        }
        addressBar.setText(displayUrl(startUrl));
        webView.loadUrl(startUrl);
        updateNavButtons();
    }

    private void updateNavButtons() {
        btnBack.setEnabled(true);
        btnForward.setEnabled(webView.canGoForward());
        btnForward.setAlpha(webView.canGoForward() ? 1f : 0.35f);
    }

    private static String displayUrl(String url) {
        if (url == null) return "";
        if (url.startsWith("https://")) return url.substring("https://".length());
        return url;
    }

    private static String resolveInput(String raw) {
        if (raw == null) return null;
        String input = raw.trim();
        if (input.isEmpty()) return null;
        if (input.matches("(?i)^[a-z][a-z0-9+.-]*://.*")) return input;
        if (input.matches("(?i)^localhost(:\\d+)?(/.*)?$")) return "http://" + input;
        if (!input.contains(" ") && input.matches(".*\\.[a-zA-Z]{2,}(/.*)?$")) return "https://" + input;
        try {
            return "https://www.google.com/search?q=" + java.net.URLEncoder.encode(input, "UTF-8");
        } catch (Exception e) {
            return "https://www.google.com/search?q=" + input.replace(" ", "+");
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}
