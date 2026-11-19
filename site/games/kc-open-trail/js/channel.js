/* Channel: is this the Google Play app, the iPhone/iPad app, or the open web?

   The Play app is a Trusted Web Activity: the same files, opened by the Android shell. Google Play's payments policy
   says digital things sold inside a Play app go through Google Play Billing, and the app may not send people to another
   way to pay. So the game needs to know which of the two it is:

     'play'  no word about buying anywhere else. The store is either hidden (PLAY_BILLING is 'off' in
             js/store-config.js, the default) or sells through Google Play Billing.
     'ios'   the App Store app (ios/kc-open-trail, a small native shell around these same files). Like 'play' with
             PLAY_BILLING 'off', for good: no real-money store, no prices, no buy prompts and no word about buying
             anywhere else. There is no Apple in-app purchase in this version, and PLAY_BILLING does not turn one on.
     'web'   no real-money store at all (owner decision: Google Play Billing only; Stripe is not used).

   How the Play app is recognised, strongest first:
     1. the address carries ?src=play. The Android shell's start URL is .../games/kc-open-trail/?src=play.
     2. the page was opened by OUR Android app: document.referrer is android-app://<PLAY_PACKAGE>. This holds in any
        window, also when Android shows the app as a Custom Tab (which it does until the Play signing fingerprint is in
        assetlinks.json, or whenever link verification fails) and the app was opened by a link with no ?src=play.
     3. the page was opened by some Android app (referrer starts with android-app://) AND is not in a browser tab.
        A link tapped in a mail app also has such a referrer, but opens in a browser tab, which is the web.
     4. it was the Play app earlier in this tab (sessionStorage), e.g. after "Start over" reloads the page.
     5. it was the Play app on an earlier launch (localStorage) AND is not in a browser tab. On Android the shell and
        Chrome share storage, so a plain Chrome tab is deliberately not caught by this: Chrome is the web.
   How the iOS app is recognised (checked first, and it wins over everything above, since it can only be true there):
     a. the native shell sets window.KC_IOS_APP = true before the page's own scripts run (window.DEWCLAW_IOS_APP, set by
        the Dewclaw iOS app, counts too: inside any App Store app the game must not sell).
     b. the address carries ?src=ios. The iOS shell's start URL is .../games/kc-open-trail/?src=ios.
     c. it was the iOS app earlier in this tab (sessionStorage) or on an earlier launch (localStorage, not in a browser tab).
   It is remembered for later launches on a, or on b when the page is not in a browser tab, the same rule as 'play'.

   When in doubt between 'play' and 'web' the answer leans to 'play': the cost of a wrong 'play' is a hidden store, the cost of a
   wrong 'web' is a purchase path inside the Play app that is not Google Play Billing.

   What is remembered for later launches (localStorage): only real evidence of the app, which is 2, 3, or 1 when the page
   is not in a browser tab. Someone who merely opens a ?src=play link in an ordinary browser is 'play' for that tab only,
   so a web app they install later is still the web.

   Nothing here is sent anywhere. The one stored value is the word 'play' or 'ios'. */
export const CHANNEL_KEY = 'kc-open-trail-channel';
/* the Android app's package id (android/kc-open-trail/twa-manifest.json, packageId) */
export const PLAY_PACKAGE = 'com.kcbeyondlimits.kcopentrail';

/* w: a window-like object ({ location, document, sessionStorage, localStorage, matchMedia, KC_IOS_APP }); tests pass a fake one */
export function detectChannel(w = globalThis) {
  const safe = (fn, d) => { try { return fn(); } catch (e) { return d; } };
  const inTab = safe(() => !!w.matchMedia('(display-mode: browser)').matches, true);
  const src = safe(() => new URLSearchParams(w.location.search).get('src'), null);
  const was = safe(() => w.sessionStorage.getItem(CHANNEL_KEY), null);
  const kept = inTab ? null : safe(() => w.localStorage.getItem(CHANNEL_KEY), null);
  const mark = (word, lasting) => { safe(() => w.sessionStorage.setItem(CHANNEL_KEY, word)); if (lasting) safe(() => w.localStorage.setItem(CHANNEL_KEY, word)); };

  /* the iPhone/iPad app */
  const injected = safe(() => w.KC_IOS_APP === true || w.DEWCLAW_IOS_APP === true, false);
  const askedIos = src === 'ios';
  if (injected || askedIos || was === 'ios' || kept === 'ios') { mark('ios', injected || (askedIos && !inTab)); return 'ios'; }

  /* the Google Play app */
  const asked = src === 'play';
  const ref = safe(() => String(w.document.referrer || ''), '');
  const fromOurs = ref === 'android-app://' + PLAY_PACKAGE || ref.startsWith('android-app://' + PLAY_PACKAGE + '/');
  const fromApp = ref.startsWith('android-app://') && !inTab;
  const play = asked || fromOurs || fromApp || was === 'play' || kept === 'play';
  /* remembered for later launches only on real evidence of the app; ?src=play typed into an ordinary browser tab is not that */
  if (play) mark('play', fromOurs || fromApp || (asked && !inTab));
  return play ? 'play' : 'web';
}
