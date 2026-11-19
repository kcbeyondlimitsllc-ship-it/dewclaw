# KC: Open Trail: on your phone today (Google Play internal testing)

Written 2026-11-19. Made to read on a phone. About 30 minutes of clicking, then a short wait for Google.

**Why internal testing:** it is the only Play track you can use today with no review and no set-up beforehand. Google: "Internal tests might not be subject to standard Play policy or security reviews", and the requirement to use it is "None" ([answer 14151465](https://support.google.com/googleplay/android-developer/answer/14151465), [answer 9845334](https://support.google.com/googleplay/android-developer/answer/9845334)). Up to 100 testers, added by email.

**What testers see:** the app opens the live game at `https://dewclaw-app.netlify.app/games/kc-open-trail/`. That live copy already has purchases switched off (`PLAY_BILLING = 'off'`, checked on the live site 2026-11-19), so nothing needs deploying for today's test.

Nobody has run these steps for this app yet. Menu names in Play Console move; if a label reads a little differently, pick the one that means the same thing.

---

## Before you start: get the app file

- File: `kc-open-trail-1.0.0-1.aab` (about 2.2 MB, already signed with your upload key).
- Where it is: in this Claude session's files, at `release-upload/kc-open-trail-1.0.0-1.aab`. **It is not in GitHub** (that folder is kept out of the repo on purpose). Download it from the Claude app's file view to the computer or phone you will use for Play Console.
- Check (optional): its SHA-256 is

```
3314518651acf79bf871c927775cb8242f29d639b49969ec3b121e2c512698d3
```

Never upload the keystore or its password anywhere, and never put them in the repo or in a chat.

---

## Step 1. Create the app (5 minutes)

Play Console > **Home** (all apps) > **Create app**. Only these fields are asked for ([answer 9859152](https://support.google.com/googleplay/android-developer/answer/9859152)):

| Field | Answer |
|---|---|
| App name | `KC: Open Trail` |
| Default language | English (United States) – en-US |
| App or game | **Game** |
| Free or paid | **Free** (in-app purchases later are still allowed) |
| Declarations | Tick **Developer Program Policies** and **US export laws** |
| Play App Signing | Accept the **Play App Signing Terms of Service** if shown |

Tap **Create app**.

App name to paste:

```
KC: Open Trail
```

The package name (`com.kcbeyondlimits.kcopentrail`) is read from the file at first upload and **can never be changed** after that. It is already correct in the file.

---

## Step 2. App content: what is needed today, and what can wait

Google: "You can start an internal test before completing app setup" and "You can create an internal testing release if your app is not fully configured" ([answer 9845334](https://support.google.com/googleplay/android-developer/answer/9845334)). Internal-only apps "are exempt from inclusion in Google Play's Data safety section" (same page).

| Declaration (Policy and programs > App content) | Needed for internal test today? |
|---|---|
| Privacy policy | Can wait (needed before closed testing) |
| Ads | Can wait |
| App access (sign-in details) | Can wait |
| Content rating | Can wait |
| Target audience and content | Can wait |
| Data safety | Can wait (internal-only apps are exempt) |
| Store listing | Can wait (Google shows a temporary name and listing) |

The declarations are required later, before closed testing ("Complete app setup") and before open testing or production ([answer 14151465](https://support.google.com/googleplay/android-developer/answer/14151465), [answer 9859455](https://support.google.com/googleplay/android-developer/answer/9859455)).

**If Play Console still blocks the release and names a card**, fill only that card with the answers in `PLAY-STORE-LAUNCH.md`, Step 7. That is faster than arguing with it. The short version, same answers as that guide:

- Privacy policy URL:

```
https://dewclaw-app.netlify.app/kc-open-trail/privacy.html
```

- Ads: **No**.
- App access: **All functionality is available without special access.** Reviewer note:

```
No sign-in is needed. Tap Play to start.
This version has no in-app purchases: there is no store screen and nothing costs real money.
The app file includes Google Play Billing for a later update; it is not used in this version.
Bones and gems are earned by playing. There are no ads and no links out of the app.
```

- Content rating: Category **Game**; **No** to violence, fear, sexuality, language, drugs, gambling, user interaction, location sharing, digital purchases and unrestricted web access.
- Target audience: **6-8, 9-12, 13-15, 16-17, 18 and over** (not "5 and under"). Appeals to children: **Yes**.
- Data safety: collects or shares data: **No**. Accounts: **No accounts**.
- Advertising ID: **No**.

**One blank to fill before you submit any declaration.** The privacy page (and the terms page) still says `OWNER_FILLS_IN` where the support contact goes, on the live site and in the repo. Google treats a policy with no contact as incomplete. **Send Claude the support email address (or contact page) you want shown**, and it will put it in both pages for you to merge. Claude will not make one up. This does not block today's internal test.

---

## Step 3. Testers: make the list (5 minutes)

1. In the app: **Test and release** > **Testing** > **Internal testing**.
2. **Testers** tab > **Create email list**.
3. List name:

```
Open Trail internal
```

4. Add the Gmail address **you use in the Play Store app on your phone** (and anyone else, up to 100). Comma-separated, or upload a CSV that is not "UTF-8 with BOM".
5. **Save**. Tick the list so it is selected for this track.
6. **Feedback URL or email address**: add your support address (or leave it until you have one, if Play lets you).
7. **Save**.

The **join link** (Copy link) only appears once the release in Step 4 says **Published** ([answer 9845334](https://support.google.com/googleplay/android-developer/answer/9845334)). You copy it in Step 5.

---

## Step 4. Create the release and upload the file (10 minutes)

1. Still in **Internal testing** > **Create new release** (top right).
2. **Play App Signing**: if asked, keep **Use Google-generated key** (the default) and accept. New apps are enrolled automatically when the file is uploaded ([answer 9842756](https://support.google.com/googleplay/android-developer/answer/9842756)). Your own keystore stays your *upload* key.
3. **App bundles** > **Upload** > pick `kc-open-trail-1.0.0-1.aab`. Wait for it to finish processing.
4. Release name:

```
1.0.0 (1) – Internal test
```

5. Release notes (paste the whole block, tags included; 442 characters of text, under the 500 limit):

```
<en-US>
Internal test of KC: Open Trail.
Please try: start a game, walk KC around town, try the bridge, canoe and skate missions, then open Pause > Shop and Settings > Privacy policy.
Turn on airplane mode, close the app fully and open it again: does it still start?
Purchases are switched off in this build. There is no Store tab and nothing costs money.
Tell us about crashes, a browser address bar at the top of the screen, or anything confusing.
</en-US>
```

6. **Next**. Read any warnings. A warning (yellow) does not stop you; an error (red) does.
   - If it says the app uses the billing permission and needs a **payments profile**: create one (Settings > Payments profile). It is free. Nobody has checked whether Google asks for it at this point.
   - If it names an App content card: see Step 2.
7. **Save and publish** (some layouts: **Save** > **Go to overview** > **Send changes for review / Publish**). Internal testing only reaches the people on your list.

---

## Step 5. Get it on your phone

1. Wait until the release status says **Published** (Internal testing page, Releases).
2. **Testers** tab > **Copy link** (under "How testers join your test"). Send it to yourself.
3. On your Android phone, open the link in Chrome while signed in to **the same Gmail you put on the list**.
4. Tap **Accept invite** (or **Become a tester**), then **download it on Google Play** > **Install**.

**How long:** Google says first-time uploads are "available immediately to internal testers", with a temporary name and listing for up to 48 hours, and new versions arrive "within minutes". It also says a first test link "can take several hours to become available" ([answer 9845334](https://support.google.com/googleplay/android-developer/answer/9845334)). Plan for minutes, allow a few hours.

Quick checks once it opens:

- [ ] Full screen, no browser address bar (if there is one, see Step 6; that is expected until it is done).
- [ ] Pause > Shop: **no Store tab**, no prices, no "buy" wording.
- [ ] Settings > **Privacy policy** opens; **Back to the game** returns.
- [ ] No permission requests (notifications, location).

---

## Step 6. Right after the first upload: send Claude the signing fingerprint (2 minutes)

Google signs the copy it sends to phones with **its own key**, not yours. Until the website lists that key, Android cannot prove the app and the site belong together, so the installed game opens with a **browser address bar** at the top (it looks like "a website in a wrapper"). Nothing else breaks.

1. Play Console > the app > **Protected with Play** > **Play Store protection** > **Manage Play app signing** ([answer 9842756](https://support.google.com/googleplay/android-developer/answer/9842756)). Older layouts: **Test and release** > **App integrity** > **Play app signing**.
2. Section **App signing key certificate** > copy the **SHA-256 certificate fingerprint** (looks like `AB:CD:...`, 32 pairs).
3. **Send it to Claude.** Claude adds it next to your upload-key line for `com.kcbeyondlimits.kcopentrail` in `site/.well-known/assetlinks.json`. You merge, Netlify publishes it.
4. Then on the phone: uninstall the game and install it again from Play. The address bar should be gone.

A fingerprint is public, not a secret. It is safe to paste in chat.

---

## If it won't install

| What you see | Most likely cause | Fix |
|---|---|---|
| Link says the app or test is not available, or a blank page | Not live yet: status is not **Published**, or Google is still processing the first link | Check the status says Published. Wait an hour and open the link again. |
| Play Store shows the app but no **Install** button, or "not available" | You opened the store page but did not join | Open the **join link** first, tap **Accept invite / Become a tester**, then use the Play link on that page. |
| "You're not a tester" / "item not found" | Wrong Google account: the phone's Play Store uses a different Gmail from the one on the list, or the list is not ticked for this track | In the Play Store app tap your picture and switch to the listed account, or add this account to the list (Step 3) and Save. Make sure the list is ticked. |
| Joined, but Play still says not available | Cache: Play remembers the old answer | Play Store > your picture > Settings, or Android Settings > Apps > Google Play Store > **Storage** > **Clear cache**. Force stop, reopen the link. |
| Installs, but shows a browser bar at the top | Google's signing key is not in `assetlinks.json` yet | Step 6. |
| Installs, but a white screen or "offline" message | The phone has no internet the first time | Connect once and reopen. The game is meant to keep a copy after the first load, but offline start in the installed app is not yet checked. |

---

## Next: closed test (12 testers × 14 days) → production

Internal testing does not count toward going public. For **a personal developer account created after 13 November 2023**, Google requires a closed test with **at least 12 testers opted in for 14 days in a row** before production; closed testing itself needs **Complete app setup** (every App content card from Step 2), and open testing needs production access ([answer 14151465](https://support.google.com/googleplay/android-developer/answer/14151465)). Dewclaw being in open testing does not exempt this app; the rule is per app.

1. Fill the support contact (Step 2) and finish every App content card using `PLAY-STORE-LAUNCH.md` Step 7.
2. **Test and release** > **Testing** > **Closed testing** > create a track > **Add from library** (same `1.0.0 (1)` bundle) > send for review.
3. Add at least 12 Google accounts (email list or Google Group) and send them the join link. Keep them opted in for 14 days.
4. Then **Dashboard** > **Apply for production access**, and follow `PLAY-STORE-LAUNCH.md` Steps 6 to 11.

An **organization** account, or a personal account made before 13 November 2023, can skip the 14 days and go from App content straight to production (`PLAY-STORE-LAUNCH.md`, Step 1).

Sources, all read 2026-11-19: Play Console Help [9845334](https://support.google.com/googleplay/android-developer/answer/9845334) (internal testing), [14151465](https://support.google.com/googleplay/android-developer/answer/14151465) (track requirements), [9859152](https://support.google.com/googleplay/android-developer/answer/9859152) (create an app), [9859455](https://support.google.com/googleplay/android-developer/answer/9859455) (app content), [9842756](https://support.google.com/googleplay/android-developer/answer/9842756) (Play App Signing).
