# KC: Open Trail: get it live on Google Play

Updated 2026-11-19 for the owner. Made to read on a phone, one step at a time.

The words to paste are in `play-store-listing.md`. The pictures are in `play-assets/`. Nothing in this guide calls Google, Stripe or Cloudflare for you: every click is yours.

**Owner decisions this guide follows (2026-11-19)**

- Payments are **Google Play Billing only**. No Stripe for this game, anywhere. The website version sells nothing. (`GO-LIVE-STRIPE.md` and `tools/stripe-setup-open-trail.mjs` are kept but **not used**.)
- The Android file you upload **has Play Billing built in**. Do not rebuild it.
- In the game, purchases stay **switched off** (`PLAY_BILLING = 'off'`) until Part 2 is done. While off, the app has no Store tab, no prices, no "buy" wording, and no outside links.

**What has been checked, and what has not.** The app file was signed and checked with Google's tools, and the game was tested in a browser as the Play app. Nobody has opened Play Console for this app, installed it on a real phone, or talked to Google. Where something could not be checked it says so.

---

# PART 1. Get the app live now

Your own work: about half a day. Then Google's review. How long the wait is depends on your account (step 1).

## Step 0. Two things to have ready

1. **The app file.** `kc-open-trail-1.0.0-1.aab` (about 2.2 MB). Its SHA-256 is `3314518651acf79bf871c927775cb8242f29d639b49969ec3b121e2c512698d3`. This is the signed file with Play Billing inside. Keep its upload keystore and password safe and outside the repo.
2. **The website, published.** The game files and privacy page changed on 2026-11-19 (the web store was removed, Stripe was taken out of the privacy and terms pages). Merge the branch so Netlify publishes `site/`, then check on your phone:
   - [ ] `https://dewclaw-app.netlify.app/games/kc-open-trail/?src=play` opens the game. Pause > Shop: there is **no Store tab**.
   - [ ] `https://dewclaw-app.netlify.app/kc-open-trail/privacy.html` opens.
   - [ ] `https://dewclaw-app.netlify.app/.well-known/assetlinks.json` lists `com.kcbeyondlimits.kcopentrail`.
3. **Fill the two blanks first.** `site/kc-open-trail/privacy.html` and `site/kc-open-trail/terms.html` still say `OWNER_FILLS_IN` where the support email goes. Google treats a policy without a contact as incomplete. Type your support email or contact page there, merge, and wait for Netlify.

## Step 1. Check your account type (2 minutes)

Play Console > ⚙ Settings > Developer account > Account details.

- **Organization**, or **Personal made before 13 Nov 2023**: you can go straight to production. Skip step 9.
- **Personal made after 13 Nov 2023**: you must run a closed test with **at least 12 testers for 14 days in a row** before production is allowed. Start step 9 as early as you can; the 14 days only start once 12 people have opted in.

## Step 2. Create the app (5 minutes)

1. Play Console > **All apps** > **Create app**.
2. App name: `KC: Open Trail`
3. Default language: **English (United States)**
4. App or game: **Game**
5. Free or paid: **Free** (in-app purchases are still allowed in a free app).
6. Tick the two declarations > **Create app**.

## Step 3. Upload the app file to internal testing (15 minutes)

1. In the app: **Test and release** > **Testing** > **Internal testing**.
2. **Testers** tab > create an email list > add your own Google account > Save. (The opt-in link only appears once the release is **Published**; copy it after item 7.) Shortest phone-first version of this step: `PLAY-INTERNAL-TEST-TODAY.md`.
3. **Create new release**.
4. App integrity / Play App Signing: choose **Use Google-generated key** (the default).
5. **Upload** > pick `kc-open-trail-1.0.0-1.aab`.
6. Release name: `1.0.0`. Release notes: `First release.`
7. **Next** > **Save and publish** (internal testing only reaches your testers).
8. If Play Console says the app uses the billing permission and needs a **payments profile**, create one now (Part 2, step A). It is free. Nobody could check whether Google asks for it at upload.

## Step 4. Add Google's signing fingerprint to the website (10 minutes + a deploy)

Without this the installed app shows a browser address bar, and a reviewer sees "a website in a wrapper".

1. **Protected with Play** > **Play Store protection** > **Manage Play app signing** (older layouts: **Test and release** > **App integrity** > **Play app signing**). Source: [answer 9842756](https://support.google.com/googleplay/android-developer/answer/9842756), read 2026-11-19.
2. Under **App signing key certificate**, copy the **SHA-256 certificate fingerprint**.
3. In `site/.well-known/assetlinks.json`, in the block for `com.kcbeyondlimits.kcopentrail`, add it as a second line. Keep the line already there (your upload key). Do not touch the Dewclaw block (it already has its two lines).

   ```json
   "sha256_cert_fingerprints": [
     "F7:BD:DD:4C:C2:9F:68:43:97:6E:8E:BA:0C:16:30:42:DA:58:AA:A6:6E:BA:65:84:03:E7:FB:D8:E4:57:5F:63",
     "PASTE:THE:APP:SIGNING:FINGERPRINT:HERE"
   ]
   ```

4. Commit and merge so Netlify publishes it. Open the assetlinks address in a browser: both lines must show.

A fingerprint is public, not a secret.

## Step 5. Test on your phone (30 minutes)

Open the opt-in link from step 3 on your Android phone, accept, then install from Google Play (the first time it can take a few hours to appear). If you installed before step 4 went live, uninstall and install again.

- [ ] Opens full screen with **no address bar**.
- [ ] Pause > Shop: tabs are Upgrades, Wardrobe, Rides, Den & Buddies, Businesses, Town, Trail Journal, KC Gear. **No Store tab.**
- [ ] No dollar sign or "buy" wording anywhere. The KC Gear tab shows bones-only items, with no real products, no website, no "ask a grown-up".
- [ ] Settings > **Privacy policy** opens the page; **Back to the game** returns to the game.
- [ ] Settings has **no** real-money switch, limit or restore row.
- [ ] Airplane mode on, close the app fully, open it again: the game starts. (If it does not, do not claim offline play anywhere.)
- [ ] Rotate; press Back on the first screen; leave the app and come back.
- [ ] No request for notification, location or any other permission.

## Step 6. Store listing (20 minutes)

**Grow users** > **Store presence** > **Main store listing**. Paste from `play-store-listing.md` section 1:

1. App name, short description, full description.
2. App icon: `play-assets/icon-512.png`
3. Feature graphic: `play-assets/feature-graphic-1024x500.png`
4. Phone screenshots: the 8 in `play-assets/phone-portrait/` in this order: plaza, bridge, canoe, skate, mission, festival, upgrades, wardrobe.
5. Tablet screenshots (optional): `play-assets/tablet-7/` and `play-assets/tablet-10/`.
6. **Save**.

Then **Store settings** (same menu): Category **Adventure**, tags, contact email, and Website (see `play-store-listing.md` section 3).

## Step 7. App content: every declaration (30-45 minutes)

**Policy and programs** > **App content**. Answer each card. These answers are for **this exact upload: Play Billing is built in, the store is switched off, nothing can be bought, nothing leaves the device.**

### Privacy policy
- URL: `https://dewclaw-app.netlify.app/kc-open-trail/privacy.html`

### Ads
- Does your app contain ads? **No**
- Why it is true: no ad SDK, no banners, no sponsored content. In the Play app the KC Gear tab shows only in-game items paid with bones; the real merchandise, the shop website and the "claim a twin" screen are switched off in the Play app (`PLAY_REAL_GEAR = 'off'`).

### App access
- **All functionality is available without special access.**
- Instructions for reviewers (paste):

  ```
  No sign-in is needed. Tap Play to start.
  This version has no in-app purchases: there is no store screen and nothing costs real money.
  The app file includes Google Play Billing for a later update; it is not used in this version.
  Bones and gems are earned by playing. There are no ads and no links out of the app.
  ```

### Content rating (IARC questionnaire)
- Email: your support email.
- Category: **Game** (all other categories do not fit).
- Violence, fear/horror, sexuality, bad language, drugs/alcohol/tobacco, gambling or simulated gambling: **No** to each. (KC barks and animals run off, nothing is hurt; the autumn festival has pumpkins and a bedsheet ghost.)
- Users can interact or exchange content: **No** (no chat, no multiplayer; photo mode saves to the device).
- Shares the user's location: **No**.
- Allows purchases of digital goods: **No** for this release. Nothing can be bought until you switch it on; change this to **Yes** in Part 2 step H, in the same release that turns purchases on.
- Unrestricted internet / web browser: **No**.
- Answer any other question truthfully. Expected rating: the lowest in each region (for example Everyone / PEGI 3), not guaranteed.

### Target audience and content
- Tick **6-8, 9-12, 13-15, 16-17, 18 and over**. Do **not** tick "5 and under".
- Why: the game is a cartoon dog for families; declaring 13+ only would not be honest and is a common reason for rejection. Ticking an under-13 band puts the app under Google's Families policy, which this build meets: no ads, no advertising ID, no tracking, no social features, nothing to buy, no links out.
- "Could your store listing unintentionally appeal to children?" If asked: **Yes**.
- One known review risk: Families apps "must not merely provide a webview of a website". This is a full game on your own site, starts full screen with no browser bar (after step 4), and works offline. If rejected on this, appeal saying exactly that.

### Data safety
- Does your app collect or share any of the required user data types? **No**.
- Why it is true: the save, the settings and the random install number stay on the device. With the store off the game sends nothing to any server. The website host sees the IP address while sending the game files, like any website; the privacy page says so, and that is normally not "collection" for this form (not confirmed on a Google page).
- Account creation: **No accounts**.
- Caveat to know: the app file contains Google's Play Billing library (and a small Google reporting component that comes with it). Nobody could find a Google page saying whether that alone needs declaring. If Play Console flags it after upload, follow its prompt.

### Advertising ID
- Does your app use an advertising ID? **No**. (The app has no `AD_ID` permission. Its permissions are internet, network state and `com.android.vending.BILLING`.)

### Government apps / Financial features / Health / News
- Not a government app. **None** of the financial features (buying game items is not a "financial feature"). **None** of the health features. Not a news app.

### Anything else
- Permissions declaration: should not appear. If it asks about a sensitive permission, stop: the game needs none.
- Physical goods: not applicable in this build (the merchandise shelf is off in the Play app).

## Step 8. Countries (2 minutes)

**Production** (or the closed track) > **Countries / regions** > add **United States**. Add more later, once the privacy page has had its legal read for the EU and UK.

## Step 9. Closed test (ONLY for a personal account made after 13 Nov 2023)

1. **Test and release** > **Testing** > **Closed testing** > **Create track**.
2. Create a release > **Add from library** > pick the same `1.0.0` bundle > Save > send for review.
3. Testers: add **at least 12** Google accounts (email list or Google Group). Send them the opt-in link. They must stay opted in for **14 days in a row**.
4. After 14 days: **Dashboard** > **Apply for production access**, answer the questions about your test. Google usually answers within 7 days. Production stays greyed out until then.

## Step 10. Production release (10 minutes)

1. **Test and release** > **Production** > **Create new release**.
2. **Add from library** > pick the `1.0.0` bundle (or promote the internal release).
3. Release notes: `First release. Roam St. Helens and the road to Portland as KC.`
4. **Next** > **Save**.

## Step 11. Send for review

1. **Publishing overview**: every section must show as done.
2. Optional: turn on **Managed publishing** if you want to press "Publish" yourself after approval.
3. **Send changes for review**.
4. Wait. Google says up to 7 days, sometimes longer for a new app with children in its audience.
5. If rejected: fix only the policy named in the email and resubmit. Never change the audience to 13+ to get through.
6. When live: install from the public listing on a phone that was never a tester and repeat step 5.

---

# PART 2. Turn on purchases (later, after the app is live)

Do these in order. Until the very last switch (step F) players see nothing new. Budget one to two weeks including testing. The purchase path in the game and the worker has been tested against a pretend Google Play only, never the real one.

## A. Payments profile (and the lower fee)

1. Play Console > ⚙ **Settings** > **Payments profile** (in some layouts: Settings > Monetization > Payments profile). Create it with the LLC's legal details and add the bank account. Bank verification can take a few days.
2. Optional but worth it: **Settings** > **Associated developer accounts** / service fee programme > enrol in the **15% service fee** tier. The lower rate counts only from the day you enrol.

## B. Create the 16 products

**Monetize with Play** > **Products** > **One-time products** > **Create product**, 16 times. Type each **Product ID exactly**; it cannot be changed later.

| Product ID | Name | Price (USD) | Kind in the game |
|---|---|---|---|
| `ot_gems_80` | 80 gems | 0.99 | used up |
| `ot_gems_500` | 500 gems | 4.99 | used up |
| `ot_gems_1200` | 1,200 gems | 9.99 | used up |
| `ot_gems_2600` | 2,600 gems | 19.99 | used up |
| `ot_gems_7000` | 7,000 gems | 49.99 | used up |
| `ot_starter` | First Trail set | 4.99 | kept, once |
| `ot_trail_pass` | Trail Journal pass | 5.99 | kept |
| `ot_pack_forest` | Whispering Firs set | 3.99 | kept |
| `ot_pack_galaxy` | Night Sky set | 3.99 | kept |
| `ot_pack_roadtrip` | Open Road set | 3.99 | kept |
| `ot_pack_halloween` | Spooky Hollow set | 3.99 | kept |
| `ot_treat_3` | 3 Party Treats | 1.99 | used up |
| `ot_treat_10` | 10 Party Treats | 4.99 | used up |
| `ot_supporter` | Supporter set | 9.99 | kept |
| `ot_everything` | Everything bundle | 24.99 | kept |
| `ot_tip_3` | Tip the maker | 3.00 | used up |

All are **one-time products**, none is a subscription. Descriptions to paste are in `play-store-listing.md` section 4. "Used up" and "kept" are not settings in Play Console: the worker consumes or acknowledges each one. Let Play convert prices for other countries. **Activate** each product.

## C. Give the worker access to Google Play

The worker checks every purchase with Google using a Google Cloud **service account**. Dewclaw's own Play checks already use the same two secrets, so first look:

1. Open `<your worker address>/health` in a browser. If it shows `"play": true`, the secrets `GOOGLE_SA_EMAIL` and `GOOGLE_SA_KEY` are **already set**. Do **not** change them (that could break Dewclaw); skip to step 3.
2. If not set: in Google Cloud console create a service account, make a **JSON key**, and keep the file private (never in the repo, never in chat). Then, on your computer in the `worker` folder:
   - `npx wrangler secret put GOOGLE_SA_EMAIL` and paste the service account's email.
   - `npx wrangler secret put GOOGLE_SA_KEY` and paste the `private_key` value from the JSON file.
3. Play Console > **Users and permissions** > **Invite new users** (or open the service account if it is already listed) > the service account's email > **App permissions** > add **KC: Open Trail** with:
   - **View financial data, orders, and cancellation survey responses**
   - **Manage orders and subscriptions** (needed to acknowledge and consume purchases)
   
   Save. Google can take up to a day before the new access works.
4. In `worker/wrangler.toml`, under `[vars]`, add the line:

   ```
   OT_PLAY_PACKAGE = "com.kcbeyondlimits.kcopentrail"
   ```

   Do **not** add any `ot_` Stripe prices and do **not** set `OT_STRIPE`.

## D. Deploy the worker

In the `worker` folder: `node test.js` (all must pass), then `npx wrangler deploy --env=""`. Open `<worker address>/health`: `"otPlay": true`.

Before real money moves, know these limits of the worker (written up in `worker/dewclaw-worker.js` above the Play section). They are low-risk for small amounts but are yours to accept or have a developer close:

- Two worker copies handling the **same** gem purchase at the very same instant could both grant it (needs a Durable Object to close).
- A paid permanent item (a set, the bundle) can be restored on any number of devices; gems are never restored.
- Refunds made after a grant are not taken back automatically (no Voided Purchases check); handle abuse by hand.
- No rate limit on the purchase-check route.

## E. Set the game's store settings

In `site/games/kc-open-trail/js/store-config.js`:

1. `WORKER_URL = 'https://<your worker address>'` (no slash at the end).
2. `SUPPORT_CONTACT = '<support email or contact page>'`.
3. Leave `PLAY_BILLING = 'off'` for now and leave `PLAY_REAL_GEAR = 'off'`.

## F. Switch it on, and test with a licence tester first

1. Play Console > ⚙ **Settings** > **License testing** > add your Google account (and anyone helping) > Save. Licence testers pay with test cards; no real money moves.
2. Set `PLAY_BILLING = 'on'` in `store-config.js` and merge. Netlify publishes it; the game always fetches this one file fresh, so phones pick it up on the next launch (no cache version to bump).
3. **Important:** from this moment the public app shows the store too (to a grown-up who turns it on). If you want testers only first, do steps 2-4 at a quiet time and be ready to set it back to `'off'`.
4. On a licence tester's phone, in the installed app:
   - [ ] Settings shows "Real-money shop (grown-ups only)". Turn it on through the grown-up question.
   - [ ] Shop > Store shows prices from Google Play (in local currency).
   - [ ] Buy **80 gems** twice: 80 gems arrive each time.
   - [ ] Buy one **set**: its 8 items arrive, and a Trail Key is shown.
   - [ ] Uninstall, reinstall, Settings > **Restore purchases**: the set comes back, the gems do not.
   - [ ] Play Console > **Order management**: the orders show as acknowledged/consumed (an unacknowledged purchase is refunded by Google after three days).
   - [ ] Refund one test order in Order management. Note: the game does not take refunded items back.
5. Anything wrong: set `PLAY_BILLING = 'off'`, merge, and nothing can be bought on the next launch.

## G. Store listing line

In the full description, replace the line about nothing to buy with the purchases line in `play-store-listing.md` section 5. Never mention Stripe, the website, or any other way to pay, in the app or the listing.

## H. Update the declarations (same day you switch on)

| Form | New answer |
|---|---|
| Content rating | Allows purchases of digital goods: **Yes**. Submit the questionnaire again. |
| Data safety | **Yes**, data is collected. **Purchase history** (Financial info) and **Device or other IDs** (the random install number, the Trail Key and the Google purchase token sent to our server). Purpose: **App functionality**. **Not shared.** Encrypted in transit: **Yes**. Users can ask for deletion: **Yes** (support address; the privacy page promises 30 days). Card details are handled by Google and never reach the app. |
| App access notes | Replace with: "No sign-in. Purchases are off until a grown-up turns on 'Real-money shop' in Settings (pause, Settings). The switch, each purchase and Restore ask a multiplication question such as 7 x 8 on a keypad. Payments use Google Play Billing only." |
| Ads | Still **No**. |
| Target audience | Unchanged. Families rules now apply to the store in full: nothing for accidental taps, no pressure, prices equal Google's. The store was built that way; get the short legal read listed in `MONETIZATION.md` before taking real money in a game children play. |

Re-check each answer against what the app really does that day. If anything in the game changed, the answers change with it.

---

## What is not known

- Your account type, and so the timeline (step 1).
- How long Google's review takes.
- Whether Play Console asks for a payments profile, or shows an "In-app purchases" label, just because the file contains Play Billing while no product exists. Check the listing preview after upload; if the label appears before purchases exist, nothing in the app is untrue, but you may mention "no purchases in this version" in the reviewer notes (already there).
- Whether Google's billing library needs its own Data safety entry.
- How reviewers apply the Families "webview" line to this app.
- Whether the installed app starts offline (the website version does in tests).
- The exact current wording of each Play Console question; menu names move. Where a question reads differently, the honest answer is still the one that matches what the app does.

Sources (read 2026-11-17): Google Play Console Help answers 14151465 (testing requirements), 9285070 (target audience), 9893335 (Families), 9859455 (app content), 9859655 (content ratings), 10787469 (Data safety), 9858738 (Payments), 7161426 (payments profile), 112622 and 10632485 (service fees).
