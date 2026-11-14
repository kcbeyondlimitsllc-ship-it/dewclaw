# Google Play listing

Limits (verified 2026-11-10, [Play Console Help](https://support.google.com/googleplay/android-developer/answer/9859152)): title 30 characters, short description 80, full description 4,000. The [metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842) bans price words such as "free" and ranking claims in the title, and keyword lists in the description.

## Title (recommended)

```
Dewclaw: Pet Care Plan
```

Alternatives, each a different search bet:

```
Dewclaw: Dog & Cat Care Plan
```
```
Dewclaw: Pet Feeding & Care
```

Why the first: "pet care" is the category term, and it leaves the species open, which matches what the app covers. Test the second if most installs turn out to come from dog searches.

## Short description

```
A care plan from your pet's breed, age and weight. No account. Works offline.
```

## Full description

```
Dewclaw builds a care plan for your pet from three things you already know: their breed, their age and their weight.

Enter them once and you get a chart with real numbers for your animal, not an average one.

WHAT THE CHART WORKS OUT
• Daily calories and how many cups that is of your own food
• A treat budget that comes out of meals, not on top of them
• A healthy weight range and where your pet sits in it
• A daily walk or play target for their breed and age
• Their life stage, and when senior care should start

EVERY DAY
• Reminders for vaccines, preventives and checkups
• Walk and potty logging
• Short training sessions
• A sitter sheet you can hand over in a minute

WHEN SOMETHING GOES WRONG
• First-aid cards for the first minutes of common emergencies, with poison-control numbers. They work with no signal.
• A lost-pet poster ready to print or share

ASK DEWCLAWMD
Ask a question about your pet in plain words and get an answer that knows their breed, age and weight. DewclawMD is a research assistant, not a veterinarian, and it will tell you when something needs a vet now.

NEARBY AND GEOPET
Find dog parks, trails, vets and groomers around you. Adopt a Geopet, a virtual pup that earns bones when you take real walks.

MADE FOR 140 DOG BREEDS AND 41 CAT BREEDS
Mixed breeds are covered by size. Rabbits, guinea pigs, birds, reptiles and other pets get a care sheet too.

NO ACCOUNT. YOUR DATA STAYS ON YOUR PHONE.
There is no sign-up. Your pet's details are stored on your device. Dewclaw shows no ads and uses no tracking.

DEWCLAW PLUS (OPTIONAL)
The chart, reminders, first aid, lost-pet poster, Nearby and Geopet do not need a subscription. Plus adds the full plan: the exercise program, the complete preventive-care calendar, the breed health watchlist, grooming routine, weight program, GPS walk tracking and more DewclawMD answers.

Dewclaw is not a veterinarian. Every number comes from published formulas and breed tendencies and is a starting point for a conversation with your vet.

Made in Oregon by KC Beyond Limits.
```

Before you paste it: check the Plus paragraph against what the Play build actually locks, and put the price in Play Console's own fields, not here.

## Graphics

| Asset | File | Spec |
|---|---|---|
| Feature graphic | `marketing/store/feature-graphic-1024x500.png` | 1024 × 500 PNG, no "free" or "best" wording |
| Phone screenshots | `site/screenshots/phone-1-chart.png` to `phone-4-geopet.png` | 1080 × 1920, four of them, which meets the minimum for large-format promotion |
| Icon | `site/icons/icon-512.png` | 512 × 512 |

The screenshots are plain captures of the app with the sample Labrador, Juno. They are honest and usable today. Captioned versions with KC's real photo and chart would convert better; that needs KC's photo and details from you.

## Category and tags

Category: Lifestyle (my recommendation; Health & Fitness invites closer health-content review). Pick tags from Play Console's own list when you get there.

## Data safety form (answers follow from `site/privacy.html`)

- No account, no data collected by the developer for the free app.
- Location: used on the device for walk tracking and Geopet check-ins, not sent to you. An approximate area (rounded to about 11 km) goes to OpenStreetMap services for Nearby.
- DewclawMD: question text and a pet summary are sent to your server and on to the model provider, and are not stored.
- Purchases: the Play purchase token is stored on your server.

Confirm each answer against the policy when you fill the form in. I have not seen the form itself.

## Before you can publish

1. Closed test: 12 testers opted in for 14 days in a row. Ask your followers; a pinned post is in `launch-copy.md`.
2. Replace the placeholder in `site/.well-known/assetlinks.json` with the SHA-256 fingerprint from Play Console, App integrity.
3. Set `playUrl` in `site/config.js` once the listing is live.
4. The Play build must sell Plus through Play Billing only.
