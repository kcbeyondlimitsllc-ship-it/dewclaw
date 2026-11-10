/* Dewclaw settings.
   Edit this file, save it, and upload the website folder again. The installed
   app picks the change up the next time it opens — no new app version.
   While `cloud` is empty the paywall is off and everything in Dewclaw is free. */
self.DEWCLAW_VERSION = "2026.11.10";
/* the 3D library for Geopet World, shipped with the app so it works offline */
self.DEWCLAW_THREE_URL = "vendor/three.min.js";
self.DEWCLAW_CONFIG = {
  /* Your Dewclaw server address from server/SETUP.md,
     for example "https://dewclaw.yourname.workers.dev". Empty = Plus off. */
  cloud: "https://dewclaw.kcbeyondlimitsllc.workers.dev",

  /* The Android package name you chose in PWABuilder. Must match exactly. */
  package: "com.kcbeyondlimits.dewclaw",

  /* The app's Google Play page, once it is live, for example
     "https://play.google.com/store/apps/details?id=com.kcbeyondlimits.dewclaw" */
  playUrl: "",

  /* The Plus offer shown once, right after someone's first chart is saved.
     Set to false to turn it off. The price line is yours to edit: it must
     match what you entered in Play Console. */
  trialOffer: true,
  offerCopy: "$2.99 a month after a 7-day free trial, or $11.99 a year. Cancel anytime in Google Play.",

  /* Plus, Plus for life, a gift year and bone packs for people using Dewclaw
     in a browser (not the Play app), paid through Stripe on your server
     (server/SETUP.md Part 7). Needs `cloud`. Set to false to sell on Google
     Play only. */
  webBilling: true,

  /* The "What KC uses" gear card on the Today, Walks and Training screens.
     Leave it out to use the built-in list of KC Beyond Limits products, set
     it to false to hide the card, or give your own list:
     gear: [{ name: "PNW Adventure Dog Bandana", price: "from $30", note: "KC's own bandana.",
              url: "https://kcbeyondlimits.com/products/pnw-adventure-dog-bandana-kc-beyond-limits", for: ["today", "walks"] }]
     `for` is any of "today", "walks", "training". */

  /* KC's social links, shown as "Follow KC" buttons in Settings and on the
     KC's story screen. Any link left as "" is hidden. Paste the Facebook
     Page address (https://www.facebook.com/...) to add that button.
     Set `socials: false` to hide them all, or `story: false` to hide
     the KC's story screen. */
  socials: {
    instagram: "https://www.instagram.com/kcbeyondlimits/",
    tiktok: "https://www.tiktok.com/@kcbeyondlimits",
    youtube: "https://www.youtube.com/@KCBeyondLimits",
    facebook: "",
    x: "https://x.com/KCBeyondLimits"
  },

  /* DewclawMD answers from Claude per subscriber per month. Keep this the
     same as MONTHLY_ASKS on the server; the app only uses it for its copy. */
  monthlyAsks: 40
};
