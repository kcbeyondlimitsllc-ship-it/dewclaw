package com.kcbeyondlimits.kclearningtrail;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import java.util.Locale;

/* One screen: the game, loaded from files inside the app.
   Nothing here can reach the network, and no link can leave the game. */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/www/index.html";

    private WebView web;
    private TextToSpeech tts;
    private boolean ttsReady;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        final WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))   /* assets/www/… */
                .build();

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);            /* progress and stickers are saved on the device */
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);                      /* the game does its own sizing */
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setLongClickable(false);
        web.setOnLongClickListener(v -> true);   /* no text-selection or image menus for small fingers */
        web.setHapticFeedbackEnabled(false);
        web.addJavascriptInterface(new Bridge(), "KCNative");

        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost())) return assets.shouldInterceptRequest(u);
                /* anything else gets an empty answer: the game is offline by design */
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not found", null, null);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return !HOST.equals(r.getUrl().getHost());   /* true = do not follow: no link leaves the game */
            }
        });

        setContentView(web);
        if (saved != null) web.restoreState(saved); else web.loadUrl(START);

        tts = new TextToSpeech(getApplicationContext(), status -> {
            if (status != TextToSpeech.SUCCESS) return;
            int r = tts.setLanguage(Locale.US);
            ttsReady = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
        });
    }

    /* What the game can ask the phone to do: speak, and nothing else. */
    private final class Bridge {
        @JavascriptInterface public boolean canSpeak() { return ttsReady; }
        @JavascriptInterface public void speak(String text, float rate, float pitch) {
            if (!ttsReady || text == null || text.length() > 400) return;
            tts.setSpeechRate(Math.max(0.5f, Math.min(1.5f, rate)));
            tts.setPitch(Math.max(0.5f, Math.min(2f, pitch)));
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "kc");
        }
        @JavascriptInterface public void stopSpeaking() { if (tts != null) tts.stop(); }
    }

    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }
    @Override public void onWindowFocusChanged(boolean has) { super.onWindowFocusChanged(has); if (has) immersive(); }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onPause() { if (tts != null) tts.stop(); web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); immersive(); }
    @Override protected void onDestroy() { if (tts != null) tts.shutdown(); web.destroy(); super.onDestroy(); }

    /* Back goes back inside the game (the game treats it as its Home button);
       from the trail map it leaves the app. */
    @Override public void onBackPressed() {
        web.evaluateJavascript("(window.KCBack && window.KCBack()) ? '1' : '0'", v -> {
            if (!"\"1\"".equals(v)) finish();
        });
    }
}
