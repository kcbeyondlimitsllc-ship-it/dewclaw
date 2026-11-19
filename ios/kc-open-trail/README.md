# KC: Open Trail for iPhone and iPad

This folder is the iOS version of the game KC: Open Trail. It is a small native
app (an Xcode project) that opens the game,
`https://dewclaw-app.netlify.app/games/kc-open-trail/?src=ios`, full screen,
the same way the Android app from Google Play does. When the game on the
website is updated, the iPhone app shows the new version the next time it
opens. A new iOS build is only needed when something in this folder changes.

It is a copy of the Dewclaw iOS app (`ios/dewclaw`), adapted for the game.
Both come from Microsoft's open-source PWABuilder iOS template; its licence
text is in `LICENSE`.

## Has it been built?

Yes, it compiles. On 19 November 2026 the GitHub workflow **iOS build check**
built it on a GitHub Mac with Xcode 26.6, for the iPhone simulator and for real
iPhones and iPads, with signing switched off:
<https://github.com/kcbeyondlimitsllc-ship-it/dewclaw/actions/runs/44593274408>

It has **not** been signed, uploaded to TestFlight, or opened on an iPhone yet.

## What you need to do

Follow the steps in `ios/dewclaw/README.md`. They cover both apps. For the game:

- Bundle ID: `com.kcbeyondlimits.kcopentrail` (no capabilities to tick).
- App Store Connect name: `KC: Open Trail` (or `KC Open Trail`).
- The four GitHub secrets are the same ones Dewclaw uses. Add them once.
- When you run **iOS TestFlight** on GitHub, pick `kc-open-trail` in
  **Which app to build and upload**.

## What this app does and does not do

- **No purchases.** The app tells the game it is the iOS app (the address ends
  in `?src=ios`, and the app sets `window.KC_IOS_APP = true` before the game
  starts). The game then shows no real-money store, no prices, no Google Play
  wording and nothing about buying anywhere else. This is fixed in the game
  code: the store settings file cannot switch a store on in the iOS app. There
  is no Apple in-app purchase in this version.
- **The real KC gear shelf** (real products and the link to the shop) follows
  the same setting as the Google Play app, `PLAY_REAL_GEAR` in
  `site/games/kc-open-trail/js/store-config.js`. It is off. If you ever turn it
  on, it shows only behind the Settings switch and the grown-up question, in
  both apps.
- **No location, camera, microphone or photo library.** The app asks for none
  of them and refuses any page that tries.
- **No tracking and no data collected** by the app. Its privacy manifest
  (`KCOpenTrail/PrivacyInfo.xcprivacy`) says so, and the Swift code uses none
  of the APIs Apple asks reasons for.
- Full screen: no status bar, the home bar fades, swipes from the edge go to the
  game first, no pull-to-refresh and no swipe-back.
- Pages on `dewclaw-app.netlify.app` stay inside the app. Any other website
  opens in a Safari sheet with a **Done** button.
- iPhone (portrait and both landscapes) and iPad (all four), iOS 15 or later,
  version 1.0.0.

## Before you send it to Apple for review

- **Guideline 4.2 (minimum functionality).** Apple turns down apps that are
  only a website in a wrapper. A full game is a better case than most, but
  this app still loads the game from the internet each time, so it needs a
  connection to start. Be ready for questions from the reviewer.
- **Children.** Do not put "for kids" or similar words in the App Store name,
  subtitle or description unless you choose the Kids category (Apple
  guideline 2.3.8). Answer the age-rating questions honestly. Keep the
  grown-up question in front of anything to do with money or leaving the game.
- **Privacy policy.** App Store Connect needs a privacy policy address, and the
  game's Settings links to `https://dewclaw-app.netlify.app/kc-open-trail/privacy.html`.
  That page still has `OWNER_FILLS_IN` placeholders; fill them in first.
- **The 1024-pixel App Store icon** was enlarged from the game's 512-pixel
  icon, so it may look slightly soft. Replace
  `KCOpenTrail/Assets.xcassets/AppIcon.appiconset/1024.png` with a sharper
  1024 x 1024 picture (no transparency) if you have one.

## What has not been tested

1. Signing, archiving and uploading (needs the secrets; see the Dewclaw README).
2. The game itself inside the iOS web view on a real iPhone or iPad: 3D speed,
   touch controls, sound (sound starts after the first tap, and the ring/silent
   switch may mute it), rotating the screen, the notch and home bar.
3. That the game really shows no store or prices on an iPhone (the game's tests
   check this in a desktop browser, not on an iPhone).
4. Saving progress between launches, and what happens with no internet.
