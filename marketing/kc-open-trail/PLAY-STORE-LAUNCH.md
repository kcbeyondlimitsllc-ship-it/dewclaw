# KC: Open Trail: getting onto Google Play

Written 2026-11-17 for the owner. The words to paste are in `play-store-listing.md`; the pictures are in `play-assets/`; building the Android file is in `android/kc-open-trail/README.md`; Stripe on the website is `GO-LIVE-STRIPE.md`.

**Where things stand.** Nothing has been uploaded, no Play Console form has been filled in, and no Google, Stripe or Printify service was called to write this. The answers below follow research done today against Google's own help pages. Where a point could not be checked on an official page it says so.

## The short version

1. **Version 1.0 of the Play app sells nothing.** No gems, no sets, no prices, no link to the website shop. That is how the repo ships it (`PLAY_BILLING = 'off'`), and it is the only route that needs no Google billing work and no payments-policy risk. Stripe goes live on the website only, in parallel.
2. **Stripe must never open inside the Play app.** Google's Payments policy requires Google Play Billing for gems and cosmetics and forbids leading Play users to another way to pay. The US exceptions (alternative billing, external content links) need enrolment, native Android code the app shell does not have, and still cost 10% to Google on top of Stripe.
3. **Purchases come in a later update through Google Play Billing** (15% all-in under US$1M a year once you enrol in the reduced-fee tier). Part F.
4. **How fast "live" is depends on two things you do not control from here:** which kind of Play Console account you have (Part A), and Google's review. Your own work is about half a day. Then:

   | Your account | Wait before the public can install |
   |---|---|
   | Organization account, or personal account created before 13 Nov 2023 | Review only. Google says up to 7 days, longer in exceptional cases, and publishes no typical time. |
   | Personal account created after 13 Nov 2023 | A closed test with at least 12 testers opted in for 14 days in a row, then a production-access review (usually 7 days or less), then the app review. Three to four weeks. Nothing shortens the 14 days. |
   | No account yet, opening an organization one | Add the D-U-N-S number wait: up to 30 days if the LLC does not already have one. |

---

## Part A. Check the account (5 minutes, do it first)

Play Console > Settings (gear) > Developer account > Account details.

- [ ] Is the account type **Organization** or **Personal**?
- [ ] If Personal: when was it created? Before or after 13 November 2023?
- [ ] Is Dewclaw live in production on this account? (Not required, but an account in good standing with a live app is the account to use.)

If it is a personal account created after that date, start Part D step 9 (the closed test) today, before anything else is polished. The 14 days only start counting when 12 testers have opted in.

Do not open a new organization account "for speed". Only consider it if the LLC already has a D-U-N-S number whose name and address match the Google payments profile exactly.

Source: https://support.google.com/googleplay/android-developer/answer/14151465 and https://support.google.com/googleplay/android-developer/answer/13628312 (read 2026-11-17).

---

## Part B. Target audience: the recommendation

**Recommended: tick 6-8, 9-12, 13-15, 16-17 and 18 and over. Do not tick "5 and under".**

Why:

- The game is a cartoon dog in a friendly town with no violence, and families are its stated audience. Choosing "13 and over" only would not be honest. It is also risky: Google reviews the declared audience and may reject an app that is not declared for children when its listing has "youthful animation or young characters". Misrepresentation can mean removal or suspension, on an account that also carries Dewclaw.
- Ticking any band under 13 puts the app under the Families policy. The game already fits it: no ads, no advertising ID, no location, no social features, no third-party SDKs in the game, child-appropriate content. Version 1.0 sells nothing, so the monetization rules have little to bite on.
- "5 and under" should stay unticked. The jobs, the shop and the settings need reading, and nobody has tested the game with children that young.

The trade-offs, plainly:

| Choice | What you gain | What it costs |
|---|---|---|
| 6-8 and up (recommended) | Honest. Matches who will actually install it. Eligible to be considered for the Teacher Approved badge (not guaranteed). | Families policy applies for good. Every future change (ads, analytics, an SDK, purchases) has to meet it. The review may take longer. |
| 9-12 and up | Same policy burden as above; slightly less claim about very young readers. | Nothing saved: the Families policy applies as soon as one under-13 band is ticked. Choose this only if you think 6 to 8 year olds cannot play it. |
| 13 and over only | No Families policy on paper. | Not honest for this game, and the likeliest way to get rejected or have to redo the listing. Not recommended. |

Two things nobody has checked, and you should know:

- Income and difficulty were tuned with bots, never with children (the game's README says so). 6-8 is a judgement, not a measurement. If you can, watch one or two children of that age play before you tick it.
- The Families policy says an app for children "must not merely provide a webview of a website". This app is an Android shell around your own web game. A full game on your own site, linked to the app, is a strong position, but no Google page says how reviewers treat this kind of app. It is the one real review risk. If Google rejects on it, the answer is an appeal that explains it is a full game, your own site, works without a connection, with no browser bar.

In the same form Play Console asks follow-up questions. Answers:

| Question (wording may differ) | Answer | Reason |
|---|---|---|
| Could the store listing unintentionally appeal to children? | Not asked when child bands are ticked; if asked, Yes | A cartoon dog appeals to children. |
| Does the app contain ads? | No | There are none. The KC Gear shelf is the developer's own merchandise behind a grown-up gate, not an ad network or paid placement. See the note under "Ads" below. |

Source: https://support.google.com/googleplay/android-developer/answer/9285070 and https://support.google.com/googleplay/android-developer/answer/9893335 (read 2026-11-17).

---

## Part C. The declaration forms: exact answers

Play Console > Policy and programs > App content (also reachable from the Dashboard's "Set up your app" list). These answers are for **version 1.0, which sells nothing**. What changes when purchases are switched on is in Part F.

### Privacy policy

| Field | Answer |
|---|---|
| Privacy policy URL | `https://dewclaw-app.netlify.app/kc-open-trail/privacy.html` |

Reason: required for every app, and always when children are in the audience, even if nothing is collected. It must be a public https page (not a PDF), about this game, linked in the listing and inside the app. The game already links it from Settings.
To do first: the page has owner blanks (contact address and so on) and asks for a lawyer's read; fill them in and deploy the site before submitting.
Source: https://support.google.com/googleplay/android-developer/answer/9859455

### Ads

| Question | Answer |
|---|---|
| Does your app contain ads? | **No** |

Reason: no ad SDK, no banners, no sponsored content.
Judgement call to know about: the KC Gear shelf shows the developer's own physical merchandise. I read that as the app's own commerce, not "ads", and it sits behind the Settings switch and the grown-up gate. If you want zero argument on a first submission, the alternative is to leave the real-gear shelf out of the Play build until an update; that is a game change, not a form answer.
Source: https://support.google.com/googleplay/android-developer/answer/9859455 ; Families monetization rules at https://support.google.com/googleplay/android-developer/answer/9893335

### App access

| Question | Answer |
|---|---|
| Is any part of the app restricted (login, membership, location)? | **All functionality is available without special access** |

Reason: no accounts, no login, no paywall.
Add this in the notes for reviewers (Publishing overview or the release's review notes), because a reviewer will meet the grown-up gate:

```
No sign-in is needed. Tap Play to start.
Settings (pause button, then Settings) has one switch, "Real KC gear shelf (grown-ups only)". It is off by default.
Turning it on, and opening any link that leaves the game, asks a multiplication question such as "7 x 8 = ?". Type the answer on the keypad and press OK.
This version has no in-app purchases. The shelf links to the developer's own website for physical merchandise only.
```

Source: https://support.google.com/googleplay/android-developer/answer/9859455

### Content rating (IARC questionnaire)

| Question | Answer | Reason |
|---|---|---|
| Email address | `OWNER_FILLS_IN` | Rating certificates are sent there. |
| Category | Game | |
| Violence (any kind, including cartoon) | No | KC barks and animals run off; nothing is hurt. |
| Fear, horror, disturbing content | No | The autumn festival has pumpkins, a bedsheet-ghost costume and lanterns; nothing frightening. |
| Sexuality, nudity | No | None. |
| Bad language, crude humour | No | None. |
| Controlled substances (drugs, alcohol, tobacco) | No | None. |
| Gambling, simulated gambling, paid random items | No | Nothing is random for money; there are no loot boxes. |
| Can users interact or exchange content with each other? | No | No chat, no multiplayer, no sharing inside the app. Photo mode saves a picture to the device only. |
| Does the app share the user's location with others? | No | No location is read at all. |
| Does the app allow purchases of digital goods? | **No** for version 1.0 | The Play build sells nothing. Change to Yes in the same update that switches Play Billing on. |
| Does the app contain a web browser or unrestricted internet access? | No | It can open one fixed website (the merchandise shop) and the privacy page in the phone's own browser, behind a grown-up gate. |

Answer truthfully if a question appears that is not in this table; misrepresentation can lead to removal. The exact questions were not visible on the help page that was read, so the left-hand wording is from memory of the form and may differ. Expected result: the lowest rating in each region (for example "Everyone" / PEGI 3), not guaranteed.
Source: https://support.google.com/googleplay/android-developer/answer/9859655

### Target audience and content

Tick 6-8, 9-12, 13-15, 16-17, 18 and over. See Part B.

### Data safety

For version 1.0 (no store in the app):

| Question | Answer | Reason |
|---|---|---|
| Does your app collect or share any of the required user data types? | **No** | "Collect" means sending data off the device. The save, the settings and the random install number stay on the device. With no store, the game sends nothing to the worker. |
| Is all of the user data collected by your app encrypted in transit? | Not asked when the answer above is No | |
| Do you provide a way for users to request that their data is deleted? | Not asked when the answer above is No | |
| Does your app let users create an account? | No | There are no accounts. |

Three honest caveats:

- The game's files are loaded from your website, so the host (Netlify) sees the device's IP address, as for any website. The privacy page already says so. The usual reading is that ordinary web-server traffic like this is not "collection" for the form, but that reading was not confirmed on a Google page today. If you prefer to be strict, the alternative is: Yes, collected: "Device or other IDs"; not shared; purpose "App functionality"; processed ephemerally. Either way the form and `privacy.html` must say the same thing.
- The Android shell includes Google's own Play Billing library, which carries a small Google reporting component (`android/kc-open-trail/README.md`). It is Google's, and whether it needs declaring was not checked. If Play Console flags an SDK in the uploaded bundle, follow its prompt.
- The merchandise website the KC Gear shelf links to is a different site with its own privacy policy. It opens in the browser, outside the app, so it is not part of this form.

Source: https://support.google.com/googleplay/android-developer/answer/10787469

### Advertising ID

| Question | Answer |
|---|---|
| Does your app use an advertising ID? | **No** |

Reason: no ads, no analytics. The built app's permissions are `INTERNET`, `ACCESS_NETWORK_STATE` and `com.android.vending.BILLING` (`android/kc-open-trail/README.md`); there is no `AD_ID` permission. Check the uploaded bundle's permission list in Play Console (App bundle explorer) says the same. For a children's app the advertising ID must not be used at all.
Wording of this question was not confirmed on an official page.

### Government, financial, health, news

| Declaration | Answer | Reason |
|---|---|---|
| Government apps | No, not a government app | It is a game by a private company. |
| Financial features | None of the listed features | No banking, loans, crypto or payments services. (Buying game items later is not a "financial feature".) |
| Health | None of the listed features | No health or medical function. |
| News | No, not a news app | It publishes no news. |

The exact wording of these four forms was not confirmed on an official page today; if Play Console shows a different question, the true answer is the same: the app is a game and does none of these things.

### Other items that may appear

| Item | Answer |
|---|---|
| Permissions declaration form | Should not appear. If Play asks about a "sensitive" permission, stop and check the build: the game needs none. |
| COVID-19 contact tracing / status | Not such an app, if asked. |
| Sale of physical goods / "restricted content" prompts | Not applicable. The app does not sell physical goods; it links, behind a gate, to a website that does. Physical goods must not use Play Billing, so that link is allowed under the Payments policy. |
| Age-signals / state app-store age laws (Texas, Utah and others) | Google does not require its Age Signals API. Whether those laws put duties on this game is a legal question that was not researched. Put it on the lawyer's list. |

---

## Part D. Release checklist, in order

Times are your working time, not waiting time.

**Before Play Console**

1. [ ] **Deploy the site** so these are live (15 minutes plus the deploy):
   - `https://dewclaw-app.netlify.app/games/kc-open-trail/?src=play` (the game; the store tab must be absent)
   - `https://dewclaw-app.netlify.app/kc-open-trail/privacy.html` (owner blanks filled in)
   - `https://dewclaw-app.netlify.app/.well-known/assetlinks.json` (lists `com.kcbeyondlimits.kcopentrail`)
2. [ ] **Build the app file** following `android/kc-open-trail/README.md` (30 to 60 minutes the first time, mostly installing tools). You get one `.aab` to upload and one `-test.apk` to try on a phone. Back up the upload keystore and its password outside the repo before you go on.

**In Play Console**

3. [ ] **Create app** (5 minutes). All apps > Create app. Name `KC: Open Trail`; default language English (United States); **Game**; **Free**; tick the two declarations. A free app cannot be turned into a paid one later; that is fine here.
4. [ ] **Internal testing release** (15 minutes). Test and release > Testing > Internal testing > Create new release. Accept Play App Signing (use the Google-generated key). Upload the `.aab`. Add your own Google account as a tester and open the opt-in link on your phone. The install link can take from minutes to a few hours to work the first time.
5. [ ] **Copy the app signing fingerprint into `assetlinks.json`** (10 minutes plus a deploy). This is Part E. Do it now; without it the app shows a browser address bar, and a reviewer who sees a browser bar sees "a website in a wrapper".
6. [ ] **Test on a real phone from the internal-testing install** (30 minutes):
   - [ ] opens full screen, no address bar
   - [ ] no Store tab in the Shop, no dollar prices anywhere, no mention of the website shop outside the gated KC Gear shelf
   - [ ] Settings > Privacy policy opens the page
   - [ ] the grown-up gate appears before the real-gear switch and before any link out
   - [ ] airplane mode on, close the app fully, open it again: the game must start. If it does not, do not submit until it does, and do not claim offline play in the listing.
   - [ ] rotate the phone; press the Back button on the first screen; put the app in the background and return
   - [ ] the app does not ask for notification, location or any other permission
7. [ ] **Fill in the App content forms** with the answers in Part C (30 to 45 minutes).
8. [ ] **Store listing and store settings** from `play-store-listing.md` and `play-assets/` (20 minutes): name, short and full description, icon, feature graphic, phone screenshots, category, tags, contact email.
9. [ ] **Only if your account is a personal one created after 13 Nov 2023: closed test.** Testing > Closed testing > create a track, upload the same build, add at least 12 testers by email or Google Group, send them the opt-in link. They must stay opted in for 14 days in a row. Then Dashboard > Apply for production access and answer the questions about your test (review usually 7 days or less). Production stays greyed out until this is granted.
10. [ ] **Countries** (2 minutes). Production > Countries/regions. Suggested for 1.0: United States only. The app sells nothing, so tax is not the reason; the reason is that the privacy page's EU and UK section is still on the lawyer's list. Add countries in a later update.
11. [ ] **Production release** (10 minutes). Production > Create new release > "Add from library" and pick the bundle already uploaded (or promote the internal release). Release name `1.0.0`. Release notes, for example:

    ```
    First release. Roam St. Helens and the road to Portland as KC.
    ```

12. [ ] **Send for review.** Publishing overview > check every section is listed > "Send changes for review". If you want to choose the launch moment yourself, switch on Managed publishing first; otherwise the app goes live as soon as it is approved.

**After you press the button**

13. [ ] Wait. Google: review can take "up to seven days or longer in exceptional cases", more likely for a new app with children in its audience. There is no way to speed it up and no typical figure is published.
14. [ ] If rejected, read the exact policy named in the email, fix only that, and resubmit. The two most likely are the Families "webview" line (Part B) and a declaration mismatch (for example the privacy page not loading). Do not change the target audience to 13+ to get through.
15. [ ] When live: install from the public listing on a phone that was never a tester and run step 6 again.

Sources for the timings: https://support.google.com/googleplay/android-developer/answer/9859751 (review), https://support.google.com/googleplay/android-developer/answer/14151465 (closed test), https://support.google.com/googleplay/android-developer/answer/11926878 (target API 36, in force since 31 Aug 2026; the build recipe already targets it).

---

## Part E. After the first upload: the app-signing fingerprint

Google Play re-signs the app with its own key. The website has to list that key too, or the installed app opens with a browser address bar instead of full screen.

1. Play Console > the app > Test and release > App integrity > App signing (older layout: Setup > App signing).
2. Under **App signing key certificate**, copy the **SHA-256 certificate fingerprint** (64 hex characters in pairs with colons).
3. Open `site/.well-known/assetlinks.json`. In the block whose `package_name` is `com.kcbeyondlimits.kcopentrail`, add the copied fingerprint as a second line in `sha256_cert_fingerprints`. Keep the line that is already there (the upload key), and do not touch the Dewclaw block. It should look like this:

   ```json
   "sha256_cert_fingerprints": [
     "F7:BD:DD:4C:...:5F:63",
     "PASTE:THE:PLAY:APP:SIGNING:FINGERPRINT:HERE"
   ]
   ```

   A fingerprint is public, not a secret; it belongs in the repo.
4. Commit, then deploy the site (Netlify publishes `site/`).
5. Check `https://dewclaw-app.netlify.app/.well-known/assetlinks.json` in a browser shows both lines.
6. On the test phone, uninstall the app (or clear Chrome's storage for the site) and install again from the internal-testing link. It must open with no address bar. Chrome remembers a failed check for a while, which is why the reinstall matters.

While you are there: check whether the Dewclaw block also has Dewclaw's Play app-signing fingerprint. Today it lists one fingerprint only, and nobody could tell whether that is the upload key or the Play key.

---

## Part F. Later update: purchases through Google Play Billing

Not needed for launch. Roughly one to two weeks of work and testing after 1.0 is live. The game and the worker already contain the Play purchase path (`js/store.js`, `/ot/play-claim` in the worker), switched off; it has been tested with a pretend Google Play only, never with the real one.

1. **Enrol in the reduced service-fee tier now**, even before 1.0 is approved: Play Console > Settings > Associated developer accounts > create an Account Group > accept the terms. The lower rate (10% service fee plus 5% billing fee on the first US$1M a year) applies only from the day enrolment completes. Source: https://support.google.com/googleplay/android-developer/answer/10632485 and https://support.google.com/googleplay/android-developer/answer/112622
2. Set up a payments profile and bank account for payouts (bank verification can take up to five days).
3. Create the 16 one-time products from the table in `play-store-listing.md`, section 4, and activate them.
4. Give the worker its Google service account and `OT_PLAY_PACKAGE` (secrets go in with `wrangler secret put`, never in the repo), fill in `WORKER_URL`, then set `PLAY_BILLING = 'on'` in `js/store-config.js`. Details: `site/games/kc-open-trail/ARCHITECTURE.md`, "Channels".
5. Test with licence testers (Play Console > Settings > License testing) on the internal track: buy a gem pack twice, buy a set once, reinstall and restore, and check an item is acknowledged (an unacknowledged purchase is refunded by Google after three days).
6. In the same update, change the forms:

   | Form | New answer |
   |---|---|
   | Data safety | Yes, data is collected. Types: **Purchase history** (Financial info) and **Device or other IDs** (the random install number and the Trail Key). Purpose: App functionality. Not shared. Encrypted in transit: Yes. Deletion: Yes, by request to the support address (the privacy page promises 30 days). Card details are taken by Google, never seen by the app, and are not declared. |
   | Content rating | "Allows purchases of digital goods": Yes |
   | Store listing | Swap in the purchases line from `play-store-listing.md`, section 5 |
   | App access notes | Add how to turn the shop on, and that purchases use Google Play |

7. Families monetization rules then apply in full: nothing designed for accidental taps, no pressure tactics, gems clearly different from dollars, prices in the game equal to Google Play's. The store was designed that way (off by default, grown-up gate before each purchase, nothing random, no timers), but get the short legal read listed in `MONETIZATION.md` before real money is taken from a game children play.
8. Still never in the Play app or its listing: Stripe, the website shop for digital items, or any hint that things cost less elsewhere. You may say so freely outside the app (your own site, social posts).

Do not pursue Google's US "external content links" or "alternative billing" programmes for Stripe now. They need approval, native Android code beyond what the shell has, US-only limiting and 24-hour transaction reporting, and still cost 10% to Google plus Stripe's own fees, which is worse than Play Billing on small gem packs.
Source: https://support.google.com/googleplay/android-developer/answer/9858738 , https://support.google.com/googleplay/android-developer/answer/16470497 , https://support.google.com/googleplay/android-developer/answer/16497028 , https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing

---

## What is not known

- Which type your Play Console account is, and when it was created. This decides the timeline (Part A).
- How long review will take.
- How reviewers apply the Families "must not merely provide a webview" line to this kind of app (Part B).
- Whether the installed Play app starts with no connection. The website version does in tests; the installed app has not been tried on a phone.
- The exact current wording of the advertising ID, government, financial, health and news forms, and of the content rating questions.
- Whether ordinary web-host logs and Google's billing library component need a Data safety entry (Part C).
- Whether US state app-store age laws or COPPA put any duty on version 1.0. COPPA applies when personal information is collected from children; data that never leaves the device is not collection. That is general FTC guidance (https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions), not legal advice for this app.
- The Play product name and description length limits in `play-store-listing.md` are from memory.
