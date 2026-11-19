/* Channel: is this the Google Play app or the open web?

   The Play app is a Trusted Web Activity: the same files, opened by the Android shell. Google Play's payments policy
   says digital things sold inside a Play app go through Google Play Billing, and the app may not send people to another
   way to pay. So the game needs to know which of the two it is:

     'play'  no word about buying anywhere else. The store is either hidden (PLAY_BILLING is 'off' in
             js/store-config.js, the default) or sells through Google Play Billing.
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
   When in doubt between the two the answer leans to 'play': the cost of a wrong 'play' is a hidden store, the cost of a
   wrong 'web' is a purchase path inside the Play app that is not Google Play Billing.

   What is remembered for later launches (localStorage): only real evidence of the app, which is 2, 3, or 1 when the page
   is not in a browser tab. Someone who merely opens a ?src=play link in an ordinary browser is 'play' for that tab only,
   so a web app they install later is still the web.

   Nothing here is sent anywhere. The one stored value is the word 'play'. */
export const CHANNEL_KEY = 'kc-open-trail-channel';
/* the Android app's package id (android/kc-open-trail/twa-manifest.json, packageId) */
export const PLAY_PACKAGE = 'com.kcbeyondlimits.kcopentrail';

/* w: a window-like object ({ location, document, sessionStorage, localStorage, matchMedia }); tests pass a fake one */
export function detectChannel(w = globalThis) {
  const safe = (fn, d) => { try { return fn(); } catch (e) { return d; } };
  const inTab = safe(() => !!w.matchMedia('(display-mode: browser)').matches, true);
  const asked = safe(() => new URLSearchParams(w.location.search).get('src') === 'play', false);
  const ref = safe(() => String(w.document.referrer || ''), '');
  const fromOurs = ref === 'android-app://' + PLAY_PACKAGE || ref.startsWith('android-app://' + PLAY_PACKAGE + '/');
  const fromApp = ref.startsWith('android-app://') && !inTab;
  const session = safe(() => w.sessionStorage.getItem(CHANNEL_KEY) === 'play', false);
  const before = !inTab && safe(() => w.localStorage.getItem(CHANNEL_KEY) === 'play', false);
  const play = asked || fromOurs || fromApp || session || before;
  if (play) {
    safe(() => w.sessionStorage.setItem(CHANNEL_KEY, 'play'));
    /* remembered for later launches only on real evidence of the app; ?src=play typed into an ordinary browser tab is not that */
    if (fromOurs || fromApp || (asked && !inTab)) safe(() => w.localStorage.setItem(CHANNEL_KEY, 'play'));
  }
  return play ? 'play' : 'web';
}
