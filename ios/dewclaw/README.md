# Dewclaw for iPhone and iPad

This folder is the iOS version of Dewclaw. It is a small native app (an Xcode
project) whose only job is to open the Dewclaw web app,
`https://dewclaw-app.netlify.app/index.html`, in a full-screen window, the way
the Android app from Google Play does. When you update the website, the iPhone
app shows the new version the next time it opens. You only need a new iOS build
when something in this folder changes.

It is based on Microsoft's open-source PWABuilder iOS template (its licence
text is in `LICENSE`), adjusted for Dewclaw.

There is a second iOS app next to this one: **KC: Open Trail**, in
`ios/kc-open-trail` (its own short README points back here). Both apps live in
the same Apple developer account and use the same GitHub secrets. The steps
below cover both; where something differs for the game, it says so.

**What has been proven so far:** both apps compile. On 19 November 2026 the
GitHub workflow **iOS build check** built Dewclaw and KC Open Trail on a
GitHub Mac with Xcode 26.6, for the iPhone simulator and for real iPhones and
iPads, with signing switched off. Both builds passed:
<https://github.com/kcbeyondlimitsllc-ship-it/dewclaw/actions/runs/44593274408>
That workflow runs again by itself whenever anything under `ios/` changes,
and needs no Apple account or secrets.

**What has not been proven:** signing, uploading to TestFlight, and running
on a real iPhone. Those need your Apple membership and the four secrets
below. See "What has not been tested" at the end.

You do not need a Mac. GitHub rents one for the few minutes each build takes.
This repository is public, so GitHub does not charge for those minutes.

---

## What you need to do, in order

### 1. Join the Apple Developer Program

1. Go to <https://developer.apple.com/programs/enroll/> and enrol. Apple
   charges a yearly fee (US$99 at the time of writing; check the page).
2. Enrol as **KC Beyond Limits LLC** if you want the company name shown as the
   seller in the App Store. Apple then asks for a D-U-N-S number and checks the
   company, which can take days or a couple of weeks. Enrolling as an
   individual is quicker but shows your personal name as the seller.
3. Wait for Apple's email saying the membership is active.

### 2. Register the apps' identifiers

Do this once for each app you want to send to TestFlight.

1. Go to <https://developer.apple.com/account/resources/identifiers/list>.
2. Press **+**, choose **App IDs**, then **App**.
3. For Dewclaw: Description `Dewclaw`. Bundle ID: choose **Explicit** and
   type exactly `com.kcbeyondlimits.dewclaw`. In the list of capabilities,
   tick **Associated Domains**.
4. For the game: Description `KC Open Trail`. Bundle ID: **Explicit**,
   exactly `com.kcbeyondlimits.kcopentrail`. Tick no capabilities.
5. Press **Continue**, then **Register**.

### 3. Create the app records in App Store Connect

1. Go to <https://appstoreconnect.apple.com/apps>.
2. Press **+**, then **New App**.
3. Platform: **iOS**. Primary language: English (U.S.).
   User access: Full Access.
   - Dewclaw: Name `Dewclaw` (if Apple says the name is taken, pick a
     variation such as `Dewclaw: Pet Care`). Bundle ID
     `com.kcbeyondlimits.dewclaw`. SKU: for example `dewclaw-ios`.
   - The game: Name `KC: Open Trail` (or `KC Open Trail`). Bundle ID
     `com.kcbeyondlimits.kcopentrail`. SKU: for example `kc-open-trail-ios`.
4. Press **Create**.

### 4. Create an App Store Connect API key

This is the "password" GitHub uses to sign the app and upload it for you.

1. Go to <https://appstoreconnect.apple.com/access/integrations/api>
   (Users and Access, then Integrations, then App Store Connect API).
   The first time, Apple asks you to request access; accept.
2. Under **Team Keys**, press **+**. Name: `GitHub TestFlight`.
   Access: **App Manager**. Press **Generate**.
3. Write down three things from this page:
   - **Issuer ID**: the long code shown above the list of keys.
   - **Key ID**: the short code next to your new key.
   - Press **Download** to save the file `AuthKey_XXXXXXXXXX.p8`. Apple lets
     you download it **once**. Keep it somewhere safe and never put it in the
     repository or in an email.
4. Find your **Team ID**: go to <https://developer.apple.com/account>, scroll
   to **Membership details**. It is a 10-character code such as `A1B2C3D4E5`.

### 5. Add four secrets to GitHub

You add these once. Both apps use them.

In the Dewclaw repository on GitHub: **Settings**, then **Secrets and
variables**, then **Actions**, then **New repository secret**. Add these four,
with the names typed exactly:

| Name            | Value                                                                 |
|-----------------|-----------------------------------------------------------------------|
| `ASC_KEY_ID`    | The Key ID from step 4.                                               |
| `ASC_ISSUER_ID` | The Issuer ID from step 4.                                            |
| `ASC_KEY_P8`    | Open the `.p8` file in Notepad or TextEdit, select everything, paste. It starts with `-----BEGIN PRIVATE KEY-----` and ends with `-----END PRIVATE KEY-----`; include both lines. |
| `APPLE_TEAM_ID` | The Team ID from step 4.                                              |

### 6. Run the build

The workflow file `.github/workflows/ios-testflight.yml` must be on the
repository's main branch for the button to appear.

1. On GitHub open the **Actions** tab.
2. In the list on the left choose **iOS TestFlight**.
3. Press **Run workflow**. In **Which app to build and upload** pick
   `dewclaw` or `kc-open-trail`. Leave the other two boxes empty and press
   the green **Run workflow** button. To send both apps, run it twice, once
   for each.
4. It takes roughly 10 to 20 minutes. A green tick means the app was uploaded.
   A red cross means something failed: open the run, open the failed step and
   read the last lines, or download **ios-build-logs** at the bottom of the
   run page (it is called **ios-build-logs-dewclaw** or
   **ios-build-logs-kc-open-trail**) and send it to whoever is helping you.

Each run uses its run number as the build number, so every upload is newer
than the last. To release a new version later (say 1.0.1), type it in the
**version** box when you run the workflow.

### 7. Find the build in TestFlight

1. Go to <https://appstoreconnect.apple.com/apps>, open **Dewclaw** (or
   **KC: Open Trail**), then the **TestFlight** tab. The build shows as "Processing" for 5 to 30 minutes.
2. Under **Internal Testing**, press **+** to make a group, add yourself (you
   must be listed under Users and Access), and add the build to the group.
3. On your iPhone install the **TestFlight** app from the App Store, sign in
   with the same Apple ID, and install the app from there. Internal testers
   (people on your App Store Connect team, up to 100) need no Apple review.
4. Test everything on a real phone before going further: the list in "What
   has not been tested" below is your checklist.

Sending the app to outside testers or to the App Store needs more from you in
App Store Connect: screenshots (iPhone and iPad, because this build also runs
on iPad), a description, the privacy policy address
`https://dewclaw-app.netlify.app/privacy.html`, the privacy questionnaire, an
age rating, and a support address.

---

## Review risks, frankly

Getting into TestFlight for your own testing is the easy part. Getting through
App Store review is not guaranteed. These are the things most likely to cause a
rejection. The rules change, so read the current text at
<https://developer.apple.com/app-store/review/guidelines/> before you submit;
nothing below is legal advice.

### Guideline 4.2, minimum functionality

Apple rejects apps that are "just a website in a wrapper". This app is exactly
a wrapper around the web app, so this is the biggest risk. Things that help:
Dewclaw behaves like an app rather than a web page (it works offline, has its
own navigation, tracks walks with location, stores pet profiles on the device,
has home-screen shortcuts). Things that hurt: any screen that looks like a
marketing web page, links that drop people into a browser, anything that says
"install the app" or mentions Google Play. Go through the app on an iPhone and
look for those. Be ready for a rejection on this point and for a conversation
with the reviewer; some wrappers pass and some do not.

### Guideline 3.1.1, in-app purchase (this one needs a change before review)

Apple requires digital goods and subscriptions that are used inside an iOS app
to be sold through Apple's in-app purchase. Dewclaw Plus, Plus for life, gift
years and bone packs are digital, and the web app sells them through Stripe and
PayPal.

**As the website stands today, the iPhone app will show the Stripe and PayPal
purchase buttons.** The website decides whether to show them, and on an iPhone
it currently does. That is very likely to be rejected. It is also broken in
practice: checkout opens in a Safari sheet on top of the app, and when the
payment finishes, the "welcome back" page loads in that sheet, not in the app,
so the app itself does not unlock.

Before submitting for review, one of these has to happen:

- **Simplest:** change the website so that inside the iOS app it hides every
  purchase button and price, and does not tell people to buy elsewhere. The
  iOS app makes this easy to detect: it sets `window.DEWCLAW_IOS_APP = true`
  on every page, and a cookie `app-platform=iOS App Store`. This is a change
  in `site/index.html`, not in this folder. It was being worked on separately
  when this README was updated; check on an iPhone that no price or purchase
  button shows before you submit.
- **Or** sell Plus through Apple's in-app purchase on iOS. That is real native
  development (StoreKit), plus server work, and Apple takes a commission.
- **Or** rely on the rules that allow links to outside payment in some
  countries. For the United States these rules changed in 2025 after a court
  ruling and may have changed again since. **I have not verified the current
  rules; check them on Apple's site, or with a lawyer, before depending on
  them.** They are specific to each country's App Store.

People who already bought Plus on the web also need a way to use it in the iOS
app (for example by entering their code). Check that this works and that the
wording does not steer people to buy outside the app.

### Privacy policy and privacy answers

- Apple requires a privacy policy address for every app. Use
  `https://dewclaw-app.netlify.app/privacy.html`. Make sure it covers the iOS
  app: location, camera, photos, the DewclawMD questions sent to your server,
  and payments.
- App Store Connect asks you to declare what data the app collects ("App
  Privacy"). The file `Dewclaw/PrivacyInfo.xcprivacy` in this folder declares
  that the app collects nothing and tracks nobody. Your answers in App Store
  Connect must agree with that and with what the web app really does. In
  particular, check with whoever built the web app whether the nearby-places
  search (which sends a location to OpenStreetMap services) and DewclawMD
  (which sends the question to your server) count as "collected" data under
  Apple's definitions. If they do, both the answers and that file need
  updating.
- The permission messages people see are in `Dewclaw/Info.plist`: location
  (walks and nearby places), camera and photo library (a picture of their
  pet). Apple rejects apps whose messages are vague or untrue, so change them
  if the app's use of these ever changes.

### Smaller things

- **Health content (guidelines 1.4.1 and 5.1.x).** DewclawMD and the first-aid
  cards give animal-health information. Keep the "not a substitute for a vet"
  wording visible; reviewers look for it.
- **Sign-in to review.** There is no account, which is good: the reviewer can
  use everything straight away. If Plus features are locked, give the reviewer
  a way to see them (a code) in the review notes.
- **iPad.** The build runs on iPad as well, so Apple asks for iPad screenshots
  and reviews it on an iPad. If you would rather ship iPhone-only, ask a
  developer to change `TARGETED_DEVICE_FAMILY` from `"1,2"` to `"1"` in the
  Xcode project.

---

## What is in this folder

| Path | What it is |
|------|------------|
| `Dewclaw.xcodeproj` | The Xcode project. One app target, `Dewclaw`, bundle ID `com.kcbeyondlimits.dewclaw`, version 1.0.0, iOS 15 or later, iPhone and iPad. No CocoaPods or other dependencies. |
| `Dewclaw/Settings.swift` | The web address the app opens and the list of sites allowed inside it. |
| `Dewclaw/WebView.swift`, `ViewController.swift`, `SceneDelegate.swift`, `AppDelegate.swift`, `Printer.swift` | The app's code: the web view, link handling, loading screen. |
| `Dewclaw/Info.plist` | App settings: name, permission messages, home-screen shortcuts, the one site allowed in the web view. |
| `Dewclaw/Entitlements/Entitlements.plist` | Associated Domains for `dewclaw-app.netlify.app`. |
| `Dewclaw/PrivacyInfo.xcprivacy` | Apple's privacy manifest. |
| `Dewclaw/Assets.xcassets` | App icons and the launch-screen logo, made from `site/icons/icon-512.png`. |
| `Dewclaw/Base.lproj` | Launch screen and main screen layouts. |

How links behave:

- Pages on `dewclaw-app.netlify.app` open inside the app.
- Every other website (Stripe, PayPal, kcbeyondlimits.com, the reference
  links, social links) opens in a Safari sheet on top of the app, with a
  **Done** button to come back.
- Phone numbers (the poison control lines), email addresses and text-message
  links are handed to the Phone, Mail and Messages apps.

Differences from the stock PWABuilder template, for a developer: Firebase,
CocoaPods and all push-notification code, entitlements and background modes
are removed; Mac Catalyst and the macOS sandbox entitlements are removed; the
navigation policy in `WebView.swift` is rewritten so that every main-frame
navigation outside the allowed host leaves the web view (the template let
script-driven ones through, where App-Bound Domains then blocked them); a
camera-permission delegate, a privacy manifest and a photo-library usage
string are added; `NSAllowsArbitraryLoads` is removed; the required device
capability is `arm64` (the template said `armv7`); the launch image set keeps
only the 1x, 2x and 3x pictures (Xcode ignores 4x and 8x).

### Optional: links that open the app

The app declares that it can open `https://dewclaw-app.netlify.app/...` links
(so a link in a text message opens the app instead of Safari). That only works
once the website serves a small file at
`https://dewclaw-app.netlify.app/.well-known/apple-app-site-association`
containing your Team ID and the bundle ID. That file does not exist yet.
Nothing breaks without it; links simply open in Safari as they do now.

---

## What has not been tested

Tested: both projects compile with Xcode 26.6 for the simulator and for
iPhone and iPad hardware, without signing (the **iOS build check** run linked
at the top). The built apps carry the right bundle id, version 1.0.0, the
icons and the privacy manifest.

Nothing has been signed, uploaded, or run on an iPhone or in a simulator.
Specifically unverified:

1. **Signing and archiving** with your Apple team. This only happens in the
   **iOS TestFlight** workflow, which needs the four secrets.
2. **That the TestFlight workflow works.** It has never run. The likely
   trouble spots:
   - **Signing.** The workflow lets Xcode create certificates and profiles
     automatically using your API key. If the archive or export step fails
     with a message about certificates, profiles or permissions, two things
     to try: create a new API key with the **Admin** role instead of App
     Manager and update the secrets; and at
     <https://developer.apple.com/account/resources/certificates/list> revoke
     any "Development" certificates that earlier failed runs left behind,
     then run again.
   - **Upload.** If the upload step says the app record or bundle ID is not
     found, check steps 2 and 3 above.
3. **Location inside the app.** Walk tracking and nearby places use the web
   page's location feature. iOS should show its permission prompt the first
   time, and may show a second, web-style prompt naming the site. Check on a
   phone that both walk tracking and nearby places work, including after
   closing and reopening the app. Tracking stops when the app is in the
   background or the phone is locked; this build does not ask for background
   location.
4. **Choosing or taking a pet photo.**
5. **Phone links** (poison control) on a real iPhone; they do nothing on an
   iPad without calling.
6. **Offline use**, home-screen shortcuts, dark mode, the loading screen, and
   how the app looks around the notch and home bar.
7. **The Geopet 3D screen** inside the app's web view.
8. **Buying Plus** (see guideline 3.1.1 above: expected not to work properly
   and not to be acceptable to Apple as it stands).
