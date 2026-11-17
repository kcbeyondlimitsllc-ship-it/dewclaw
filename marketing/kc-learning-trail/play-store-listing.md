# KC's Learning Trail: Google Play listing

Nothing here has been submitted. Policy points were read from Google's help pages on 2026-11-15; the Dashboard checklist in Play Console is the authority if it differs.

## Create app

| Field | Value |
|---|---|
| App name | `KC's Learning Trail` |
| Default language | English (United States) |
| App or game | Game |
| Free or paid | **Paid** |

Choose Paid before anything else. Google's rule: once an app has been offered free it can never be changed to paid ([source](https://support.google.com/googleplay/android-developer/answer/6334373)). A paid app also needs a payments profile (legal name, address, bank account) before you can set a price.

## Price

Recommended: **USD 2.99**.

- Paid preschool apps on Play sit between 0.99 and 5.99; 8.99 is only reached by established names (prices read from the store on 2026-11-15).
- After Google's 15% fee on a US sale, 2.99 leaves about 2.54.
- You can raise the price or run a sale later. Going free is the only move you cannot undo.

## Short description (80 characters max)

```
Counting, letters, shapes and patterns with KC the dog. No ads. Works offline.
```

## Full description

```
Walk the trail with KC the dog and learn along the way.

KC's Learning Trail is six short activities for children aged 3 to 6:

• Counting to ten
• Letters and first sounds
• Colors and shapes
• Patterns
• Memory match
• Bigger, smaller, more and fewer

Made for small hands
Every question is read aloud, so children who cannot read yet can play on their own. Buttons are big. There are no timers and no wrong-answer penalties. A wrong tap gets a gentle hint and another try.

It grows with your child
Each activity has three levels. The game moves up a level when your child is ready.

Stickers to collect
Finishing a round earns a sticker for the sticker book.

For grown-ups
• Pay once. There are no ads and no in-app purchases.
• Nothing leaves the device. The app does not ask for internet access.
• Works anywhere: in the car, on a plane, at the campsite.
• A grown-ups corner, behind a lock, shows each skill's level and lets you turn the voice and music on or off.

KC is a real dog from Oregon. Her adventures are at KC Beyond Limits.
```

## Graphics (all in this folder)

| Asset | File | Size |
|---|---|---|
| Icon | `icon-512.png` | 512 × 512 |
| Feature graphic | `feature-graphic-1024x500.png` | 1024 × 500 |
| Phone screenshots | `screenshots/phone-1-trail.png` to `phone-6-compare.png` | 1080 × 1920 |

These are plain captures of the game. The feature graphic is the home screen at banner size; a designed one would look better.

## App content answers

| Section | Answer |
|---|---|
| Privacy policy | `https://dewclaw-app.netlify.app/kc-learning-trail/privacy.html` (live once this branch is merged) |
| App access | All functionality is available without special access |
| Ads | No ads |
| Content rating | Game; answer No to every content question. Expect "Everyone" |
| Target audience | **Ages 5 and under** only. Add 6–8 only if you want Google to review it against that band too |
| Data safety | No data collected, no data shared |
| Category | Educational (games) |

Children's apps can take longer to review; Google says up to seven days or more.

## The file to upload

`kc-learning-trail-1.0.0-v1.aab`, signed with its own upload key (`kclearningtrail-upload.keystore`). Keep that keystore and its password file private and backed up; every update needs them.

- Package: `com.kcbeyondlimits.kclearningtrail`
- Version 1.0.0 (code 1), targets Android 16 (API 36), runs on Android 7 and up
- Requests no permissions

## Not yet checked

- The app has not been run on a real phone. Install the test APK on an Android phone and listen to the voice before uploading.
- The spoken voice is whichever one the phone has installed, so it will sound different between phones.
