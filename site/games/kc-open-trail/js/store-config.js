/* KC: Open Trail store settings. THE OWNER FILLS THESE IN. Nothing here is secret: the worker's address is a public
   value. Never put a key, a password or a personal address in this file.

   OWNER DECISION (2026-11-19): payments are Google Play Billing ONLY. Stripe is not used for this game anywhere, and
   the website version of the game sells nothing, whatever is set here (js/store.js). STRIPE_PRICE_IDS below is left in
   place only because tools/stripe-setup-open-trail.mjs (also not used) reads this file; the game ignores it.
   Steps to turn purchases on: marketing/kc-open-trail/PLAY-STORE-LAUNCH.md, section "Turn on purchases".

   WORKER_URL       the https address of the deployed Dewclaw worker, with no slash at the end,
                    e.g. 'https://dewclaw.your-account.workers.dev'. Needed for Google Play purchases.
   STRIPE_PRICE_IDS NOT USED (no Stripe for this game). Leave as it is.
   SUPPORT_CONTACT  where a grown-up asks for a refund or help (a support email address or an https contact page).
   PLAY_BILLING     only matters inside the Google Play app (js/channel.js). 'off' (the default): the Play app has no
                    real-money store at all, no prices, no buy prompts and no checkout. 'on': the Play app sells the
                    16 items through Google Play Billing. Turn it on only after (1) the 16 products exist and are
                    active in Play Console with ids equal to the names below, (2) the worker is deployed with
                    OT_PLAY_PACKAGE and the Google service account (GOOGLE_SA_EMAIL, GOOGLE_SA_KEY), and (3) WORKER_URL
                    above is filled in. The Android app already has Play Billing built in (twa-manifest.json).
   PLAY_BILLING never affects the iOS app (js/channel.js 'ios'): it has no real-money store in this version.
   PLAY_REAL_GEAR   only matters inside the Google Play app and the iOS app (one setting for both app builds). 'off' (the default): the Play app shows the bones-only KC gear
                    and nothing about the real products, the shop website or claiming a twin, and has no link out of the
                    game. 'on': the grown-ups' real-gear shelf, its link to the shop website and the claim screen work in
                    the Play app as they do on the web (behind the Settings switch and the grown-up gate). Read
                    marketing/kc-open-trail/PLAY-STORE-LAUNCH.md Part C before turning it on: Google Play's Families policy
                    has rules about commercial content shown to children.

   This file is the one game file the service worker always asks the network for first (sw.js, FRESH), so a change here
   reaches players the next time they open the game. No version number needs bumping for it. */
export const WORKER_URL = 'OWNER_FILLS_IN';

/* NOT USED: no Stripe for KC: Open Trail (owner decision 2026-11-19). The game ignores these. */
export const STRIPE_PRICE_IDS = {
  ot_gems_80: 'OWNER_FILLS_IN',          /* $0.99  */
  ot_gems_500: 'OWNER_FILLS_IN',         /* $4.99  */
  ot_gems_1200: 'OWNER_FILLS_IN',        /* $9.99  */
  ot_gems_2600: 'OWNER_FILLS_IN',        /* $19.99 */
  ot_gems_7000: 'OWNER_FILLS_IN',        /* $49.99 */
  ot_starter: 'OWNER_FILLS_IN',          /* $4.99  */
  ot_trail_pass: 'OWNER_FILLS_IN',       /* $5.99  */
  ot_pack_forest: 'OWNER_FILLS_IN',      /* $3.99  */
  ot_pack_galaxy: 'OWNER_FILLS_IN',      /* $3.99  */
  ot_pack_roadtrip: 'OWNER_FILLS_IN',    /* $3.99  */
  ot_pack_halloween: 'OWNER_FILLS_IN',   /* $3.99  */
  ot_treat_3: 'OWNER_FILLS_IN',          /* $1.99  */
  ot_treat_10: 'OWNER_FILLS_IN',         /* $4.99  */
  ot_supporter: 'OWNER_FILLS_IN',        /* $9.99  */
  ot_everything: 'OWNER_FILLS_IN',       /* $24.99 */
  ot_tip_3: 'OWNER_FILLS_IN'             /* $3.00  */
};

export const SUPPORT_CONTACT = 'OWNER_FILLS_IN';

export const PLAY_BILLING = 'off';

export const PLAY_REAL_GEAR = 'off';
