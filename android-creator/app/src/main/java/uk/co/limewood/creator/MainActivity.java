package uk.co.limewood.creator;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {

    /*
     * LIMEWOOD CREATOR - NATIVE SHELL
     *
     * Future native-shell updates are deliberately concentrated in this file.
     * Normal Limewood Engineering changes do NOT require an APK rebuild because
     * the app loads the live site below.
     */
    private static final String APP_URL = "https://limewood-engineering.pro/?creator=1&creator_shell=1.2.4";
    private static final int FILE_CHOOSER_REQUEST = 401;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private FrameLayout root;
    private View offlineView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Allow Creator to follow the phone/tablet orientation in both directions.
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR);

        getWindow().setStatusBarColor(Color.rgb(23, 61, 51));
        getWindow().setNavigationBarColor(Color.rgb(23, 61, 51));

        root = new FrameLayout(this);
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        configureWebView();

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setUserAgentString(
                settings.getUserAgentString() + " LimewoodCreatorAndroid/1.2.4");

        webView.clearCache(true);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view,
                    WebResourceRequest request) {

                Uri uri = request.getUrl();
                String host = uri.getHost() == null
                        ? ""
                        : uri.getHost().toLowerCase();

                // Keep all Limewood Engineering pages inside the Creator app.
                if (host.equals("limewood-engineering.pro")
                        || host.endsWith(".limewood-engineering.pro")) {
                    return false;
                }

                // BMS, manufacturer sites and other external links open outside
                // the Creator shell rather than trapping them in the WebView.
                openExternal(uri);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                hideOffline();
                CookieManager.getInstance().flush();
                injectCreatorControls(view);
            }

            @Override
            public void onReceivedError(
                    WebView view,
                    WebResourceRequest request,
                    WebResourceError error) {
                if (request.isForMainFrame()) {
                    showOffline();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {

                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }

                fileCallback = callback;

                try {
                    Intent chooser = params.createIntent();
                    startActivityForResult(
                            chooser,
                            FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException ex) {
                    fileCallback = null;
                    return false;
                }
            }
        });

        webView.setDownloadListener(
                (url, userAgent, contentDisposition, mimetype, contentLength) ->
                        openExternal(Uri.parse(url)));
    }


    private void injectCreatorControls(WebView view) {
        String js = "(function(){" +
                "if(document.getElementById('lwCreatorDock'))return;" +
                "var style=document.createElement('style');" +
                "style.id='lwCreatorStyle';" +
                "style.textContent='#lwCreatorDock{position:fixed;left:10px;right:10px;bottom:10px;z-index:2147483647;background:#173d33;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:18px;box-shadow:0 12px 34px rgba(0,0,0,.28);padding:8px;display:flex;gap:7px;align-items:center;overflow-x:auto;font-family:Arial,sans-serif}#lwCreatorDock button{flex:0 0 auto;border:0;border-radius:12px;padding:11px 13px;background:#f4f0e8;color:#173d33;font-weight:800;font-size:13px}#lwCreatorDock .creatorHome{background:#c8a96a;color:#173d33}#lwCreatorBadge{flex:0 0 auto;padding:0 7px;font-size:11px;font-weight:900;letter-spacing:.08em}body{padding-bottom:78px!important}';" +
                "document.head.appendChild(style);" +
                "var dock=document.createElement('div');dock.id='lwCreatorDock';" +
                "dock.innerHTML='<span id=\\\"lwCreatorBadge\\\">CREATOR</span><button class=\\\"creatorHome\\\" data-c=\\\"home\\\">Home</button><button data-c=\\\"assets\\\">Assets</button><button data-c=\\\"addAsset\\\">+ Asset</button><button data-c=\\\"docs\\\">Documents</button><button data-c=\\\"ppm\\\">PPM</button><button data-c=\\\"logs\\\">Logs</button><button data-c=\\\"logBuilder\\\">Log Builder</button>';" +
                "dock.addEventListener('click',function(e){var b=e.target.closest('button[data-c]');if(!b)return;var a=b.dataset.c;function hit(id){var x=document.getElementById(id);if(x){x.click();return true}return false}if(a==='home'){if(typeof showView==='function'){showView('dashboard')}else{location.href='/?creator=1'}}else if(a==='assets'){if(!hit('quickEstateRegister')&&typeof showAssetRegisterDirectory==='function')showAssetRegisterDirectory()}else if(a==='addAsset'){if(!hit('quickAddAsset')){if(typeof showRegister==='function')showRegister('');if(typeof newAsset==='function')newAsset()}}else if(a==='docs'){if(!hit('quickDocuments')&&typeof showDocuments==='function')showDocuments('')}else if(a==='ppm'){if(!hit('quickPpm')&&typeof showPpmDirectory==='function')showPpmDirectory()}else if(a==='logs'){if(!hit('quickLogs')&&typeof showLogsHome==='function')showLogsHome()}else if(a==='logBuilder'){(function openBuilder(attempt){if(window.LIMEWOOD_CREATOR&&typeof window.LIMEWOOD_CREATOR.openLogBuilder==='function'){window.LIMEWOOD_CREATOR.openLogBuilder();return}if(attempt<20){setTimeout(function(){openBuilder(attempt+1)},150);return}alert('Log Builder did not finish loading. Close Creator completely and reopen it.')})(0)}});" +
                "document.body.appendChild(dock);" +
                "})();";
        view.evaluateJavascript(js, null);
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
        }
    }

    private void showOffline() {
        if (offlineView != null) return;

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(48, 48, 48, 48);
        panel.setBackgroundColor(Color.rgb(244, 240, 232));

        TextView title = new TextView(this);
        title.setText("Limewood Creator is offline");
        title.setTextSize(24f);
        title.setTextColor(Color.rgb(23, 61, 51));
        title.setGravity(Gravity.CENTER);

        TextView body = new TextView(this);
        body.setText(
                "Check the phone's connection, then retry. " +
                "Your Limewood login remains on this device.");
        body.setTextSize(15f);
        body.setTextColor(Color.rgb(70, 86, 78));
        body.setGravity(Gravity.CENTER);
        body.setPadding(0, 18, 0, 24);

        Button retry = new Button(this);
        retry.setText("Retry");
        retry.setOnClickListener(v -> {
            hideOffline();
            webView.loadUrl(APP_URL);
        });

        panel.addView(title);
        panel.addView(body);
        panel.addView(retry);

        offlineView = panel;
        root.addView(panel, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
    }

    private void hideOffline() {
        if (offlineView != null) {
            root.removeView(offlineView);
            offlineView = null;
        }
    }

    @Override
    protected void onActivityResult(
            int requestCode,
            int resultCode,
            Intent data) {

        super.onActivityResult(
                requestCode,
                resultCode,
                data);

        if (requestCode == FILE_CHOOSER_REQUEST
                && fileCallback != null) {

            Uri[] result =
                    WebChromeClient.FileChooserParams
                            .parseResult(resultCode, data);

            fileCallback.onReceiveValue(result);
            fileCallback = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
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
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }
}
