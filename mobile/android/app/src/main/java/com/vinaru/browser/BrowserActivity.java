package com.vinaru.browser;

import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONObject;

public class BrowserActivity extends AppCompatActivity {
    public static final String EXTRA_URL = "url";
    public static final String EXTRA_INCOGNITO = "incognito";
    public static final String EXTRA_TAB_COUNT = "tabCount";
    public static final String ACTION_EXTRA = "vinaru_action";

    private WebView webView;
    private EditText addressBar;
    private ProgressBar progress;
    private boolean incognito;
    private int tabCount = 1;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_browser);

        incognito = getIntent().getBooleanExtra(EXTRA_INCOGNITO, false);
        tabCount = Math.max(1, getIntent().getIntExtra(EXTRA_TAB_COUNT, 1));

        webView = findViewById(R.id.webView);
        addressBar = findViewById(R.id.addressBar);
        progress = findViewById(R.id.progress);
        ImageButton btnReload = findViewById(R.id.btnReload);
        TextView privateLabel = findViewById(R.id.privateLabel);
        if (privateLabel != null) {
            privateLabel.setVisibility(incognito ? View.VISIBLE : View.GONE);
        }

        TextView btnBottomTabs = findViewById(R.id.btnBottomTabs);
        styleTabCount(btnBottomTabs, tabCount);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        if (incognito) {
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(false);
            settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
            settings.setSaveFormData(false);
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
            webView.clearCache(true);
            webView.clearHistory();
            webView.clearFormData();
        } else {
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            CookieManager.getInstance().setAcceptCookie(true);
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                String resolvedMime = VinaruDownloadsPlugin.guessMime(fileName, mimeType);

                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(resolvedMime);
                request.addRequestHeader("User-Agent", userAgent);
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null && !cookies.isEmpty()) {
                    request.addRequestHeader("Cookie", cookies);
                }
                request.setDescription("Downloading via Vinaru");
                request.setTitle(fileName);
                request.allowScanningByMediaScanner();
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);

                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm == null) {
                    Toast.makeText(this, "Download manager unavailable", Toast.LENGTH_SHORT).show();
                    return;
                }
                long downloadId = dm.enqueue(request);

                JSONObject item = new JSONObject();
                item.put("id", "dl-" + downloadId);
                item.put("downloadId", downloadId);
                item.put("filename", fileName);
                item.put("url", url);
                item.put("mimeType", resolvedMime);
                item.put("state", "queued");
                item.put("localUri", "");
                item.put("createdAt", System.currentTimeMillis());
                DownloadStore.add(this, item);

                Toast.makeText(this, "Downloading " + fileName, Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Download failed", Toast.LENGTH_SHORT).show();
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                addressBar.setText(displayUrl(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                addressBar.setText(displayUrl(url));
                progress.setVisibility(View.GONE);
                if (!incognito && url != null && !url.isEmpty()) {
                    LibraryStore.recordHistory(BrowserActivity.this, view.getTitle(), url);
                }
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
        });

        btnReload.setOnClickListener(v -> webView.reload());

        findViewById(R.id.btnBottomHome).setOnClickListener(v -> returnToShell("home"));
        findViewById(R.id.btnBottomBookmark).setOnClickListener(v -> {
            String url = webView.getUrl();
            if (url == null || url.isEmpty()) {
                Toast.makeText(this, "Nothing to bookmark", Toast.LENGTH_SHORT).show();
                return;
            }
            if (incognito) {
                Toast.makeText(this, "Bookmarks disabled in private mode", Toast.LENGTH_SHORT).show();
                return;
            }
            try {
                LibraryStore.addBookmark(this, webView.getTitle(), url);
                Toast.makeText(this, "Bookmark saved", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Could not save bookmark", Toast.LENGTH_SHORT).show();
            }
        });
        findViewById(R.id.btnBottomSearch).setOnClickListener(v -> {
            addressBar.requestFocus();
            addressBar.selectAll();
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) imm.showSoftInput(addressBar, InputMethodManager.SHOW_IMPLICIT);
        });
        findViewById(R.id.btnBottomNewTab).setOnClickListener(v -> returnToShell("newtab"));
        btnBottomTabs.setOnClickListener(v -> returnToShell("tabs"));
        findViewById(R.id.btnBottomMore).setOnClickListener(v -> returnToShell("more"));

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
    }

    private void styleTabCount(TextView view, int count) {
        view.setText(String.valueOf(Math.max(1, count)));
        view.setTypeface(Typeface.DEFAULT_BOLD);
        view.setTextSize(13f);
        view.setGravity(android.view.Gravity.CENTER);
    }

    private void returnToShell(String action) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra(ACTION_EXTRA, action);
        startActivity(intent);
        finish();
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
            returnToShell("home");
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            if (incognito) {
                webView.clearCache(true);
                webView.clearHistory();
                webView.clearFormData();
                CookieManager.getInstance().removeSessionCookies(null);
            }
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}
