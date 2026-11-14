# Dewclaw growth playbook

Researched and written 2026-11-10. Every source was checked that day. Labels: **Verified** = read on the official page, **Secondary** = a blog or tracker said so, **Estimate** = my own arithmetic or judgment.

## The short version

1. **Paid installs will lose money at today's prices.** Spend effort on search, your own audience and partners, not ads.
2. **The biggest free channel is search.** People search for calorie calculators and breed weight, feeding and lifespan facts in large numbers, and no app with real traction answers with numbers. This branch adds 188 crawlable pages built from the app's own engine to capture that.
3. **Dewclaw's honest position is "free, no account, no trial trap, real numbers for your breed."** The category's loudest complaints are paywalls on open and surprise renewals.
4. **The Play listing is the next unlock,** and it has a 14-day clock you cannot shorten, so start the closed test first.

## Unit economics (why not ads)

| Input | Value | Basis |
|---|---|---|
| Plus yearly | $11.99 | `site/config.js` |
| Net after Google Play's 15% | about $10.19 | Verified fee: [Play Console Help](https://support.google.com/googleplay/android-developer/answer/112622) |
| Net on web after Stripe (2.9% + $0.30) | about $11.34 | Estimate from Stripe's standard US rate |
| Install to Plus conversion | 2% | **Assumption.** There is no data yet. Replace it with the real figure. |
| Revenue per install, first year | about $0.20 to $0.23 | Estimate |
| Cost per US Android install | $1.50 to $4 | Estimate from secondary blogs; no pet-app benchmark exists |

At a 2% conversion an install is worth about 20 cents and costs $1.50 or more. Ads only break even above roughly a 15% conversion to yearly Plus, which no consumer app should plan on. A paid install can also buy merch, so revisit this once you can see merch revenue per app user.

**Against the $25,000 a month goal:** Plus alone would need about 28,000 active yearly subscribers. Treat Dewclaw as the top of the funnel for the brand (audience, repeat visits, merch through the "What KC uses" card) with Plus as a second income line, not the whole plan.

## Search demand (Google Keyword Planner, US, monthly)

Verified through the keyword tool on 2026-11-10. Planner groups close variants, so read these as tiers.

| Query | Searches | Dewclaw page that answers it |
|---|---|---|
| dog years / dog age calculator | 49,500 to 60,500 | Not built. See backlog. |
| puppy weight calculator | 18,100 | Not built. Needs growth-curve data the engine does not have. |
| french bulldog lifespan | 12,100 | `/dogs/french-bulldog/` |
| dog food / feeding calculator | 8,100 | `/dog-calorie-calculator/` |
| cat weight chart | 8,100 | `/cats/` breed pages, `/body-condition-score/` |
| dog calorie calculator | 6,600 | `/dog-calorie-calculator/` |
| cat calorie calculator | 5,400 | `/cat-calorie-calculator/` |
| foods toxic to dogs | 5,400 | Not built. See backlog. |
| canine body condition score | 2,400 | `/body-condition-score/` |
| french bulldog health problems | 2,400 | `/dogs/french-bulldog/` |
| labrador weight / growth chart | 320 to 1,900 | `/dogs/labrador-retriever/` |
| labrador feeding chart by age | 480 | `/dogs/labrador-retriever/` |

Per breed, people search lifespan most, then health problems, then weight, then feeding, then exercise. The breed pages lead with weight and lifespan for that reason.

**Who ranks now:** vet and non-profit calculators (Pet Nutrition Alliance, Merck, Purina Institute) for calculators; PetMD and clinic blogs with a vet byline for health problems; programmatic sites such as plainbowl.com and dogweightcalculator.com for breed feeding and weight. Exercise queries are the weakest field (forums and short articles).

**Realistic expectation (Estimate):** a new page on a `netlify.app` address will take months to rank, and the health-problem queries will stay hard without a vet reviewer. The calculators and long-tail breed queries are the reachable ones.

### The risk to manage: scaled content

Google's spam policy targets pages "generated for the primary purpose of manipulating search rankings and not helping users" ([Verified](https://developers.google.com/search/docs/essentials/spam-policies)). What keeps these pages on the right side:

- Every page has numbers no other page has (weights, calories across the breed's own range, lifespan, five breed-specific conditions).
- Every breed page has a working calculator, not just a link out.
- `/how-we-calculate/` states the formulas, who is responsible, and that pages are computed from breed data.
- A real "Last reviewed" date. It is one constant in `tools/build-pages.mjs`. Change it only when someone has actually reviewed the data.
- No invented ratings, reviewers or testimonials.

FAQ rich results were removed for all sites in May 2026 ([Verified](https://developers.google.com/search/updates)), so the pages use Breadcrumb and Article markup only.

## Competitors (Google Play US, checked 2026-11-10)

| App | Installs / rating | Price | What reviewers complain about |
|---|---|---|---|
| Dogo | 5M+ / 4.6 | about $11.99/mo, $59.99/yr | Subscription needed for almost everything |
| Woofz | 1M+ / 4.0 | $7.99 to $11.99 a week, $59.99/yr | Hard to cancel, surprise renewals |
| EveryDoggy | 1M+ / 4.4 | up to $189.99 | "Hidden subscription" |
| PetDesk | 1M+ / 4.7 | free through clinics | Scheduling bugs |
| Zigzag | 500K+ / 4.6 | $9.99/mo, $49.99/yr | Price shown only after sign-up |
| Puppr | 500K+ / 4.5 | $9.99 to $13.99/mo | Android lags iOS |
| 11pets | 500K+ / 2.2 | $1.99 to $21.99 | Errors and lost data after a redesign |
| DogLog | 100K+ / 4.5 | $3.99/mo, $39.99/yr | Glitches |
| Pet First Aid (Red Cross) | 100K+ / 4.6 | free | Thin: "says call a vet" |

Complaints are from the three reviews each listing features, so a small sample.

**Where Dewclaw is different:** price ($2.99 a month against roughly $10), no trial trap, breed-specific numbers (the calculator apps that do this have under 100 installs each), and breadth (tracker, first aid, lost-pet poster and sitter sheet in one).

**Where it is weaker:** no installs or ratings yet, no video training, no clinic integration, and a crowded "pet care tracker" search. "DewclawMD" and first aid carry trust risk next to the Red Cross app, and Play's health-content rules may apply to that name (not checked).

**Open search phrases on Play:** "dog calorie calculator", "dog food portion", "pet first aid", "lost pet poster", "pet sitter".

## Channels, ranked

Ranked by expected impact for the effort, at a budget under $300 a month.

### 1. Search pages (built on this branch)
Merge, then submit `sitemap.xml` in Google Search Console. Cost: nothing. Search Console also gives you search data without adding any tracking to the site, which matters because the privacy policy says Dewclaw uses no analytics.

### 2. Your own channels
You already have YouTube, TikTok, Instagram and Facebook audiences who like KC. One short video a week showing a real number for a real dog ("this is how much KC should actually eat") with the calculator link in bio. Scripts are in `launch-copy.md`.

### 3. Google Play
- **Verified:** $25 once. A new personal account needs a closed test with **12 testers opted in for 14 days in a row** before you can apply for production ([source](https://support.google.com/googleplay/android-developer/answer/14151465)). New apps must target Android 16, API 36 ([source](https://support.google.com/googleplay/android-developer/answer/11926878)).
- **Verified:** digital features sold inside a Play app must use Play Billing ([source](https://support.google.com/googleplay/android-developer/answer/9858738)). The app already has Play SKUs; make sure the Play build never shows the Stripe or PayPal buttons.
- `site/.well-known/assetlinks.json` still holds a placeholder fingerprint. Until the real one from Play Console is in, the app opens with a browser bar.
- Listing copy and graphics are in `play-store-listing.md` and `marketing/store/`.

### 4. Shelters and rescues
Real precedent: GoodPup, Zigzag and Petszel all reach adopters through shelters, and Petszel's free browser app is sent automatically to Maricopa County adopters ([source](https://www.maricopa.gov/CivicAlerts.aspx?AID=3255)). Dewclaw fits better than most because it is free with no account. `/for-shelters/` is the page to send them; the email is in `launch-copy.md`. Start with five Oregon rescues.

### 5. Free listings
- **Microsoft Store:** free for individuals ([Verified](https://learn.microsoft.com/en-us/windows/apps/publish/whats-new-individual-developer)); PWABuilder makes the package.
- **AlternativeTo, SaaSHub, Product Hunt:** free (Secondary). List Dewclaw as an alternative to Dogo, 11pets and DogLog.
- Skip Amazon Appstore and Samsung Galaxy Store. Neither has a working web-app route that I could confirm.

### 6. Reddit and Facebook groups
**Not verified.** Reddit was blocked from this session, so I could not read any subreddit's rules. A secondary tracker says r/puppy101 prohibits self-promotion. Assume pet subreddits ban app posts. The safe pattern is answering feeding questions with the actual numbers and no link, and messaging moderators before posting anything.

### 7. Journalist requests
HARO was relaunched free by Featured.com in 2025 (Secondary). Qwoted's free plan allows two pitches a month ([Verified](https://app.qwoted.com/pricing_plans)). Answer pet-care queries as the maker of a pet-care app. Low volume, but each hit is a link to the site.

### 8. Paid, only as a boost
- **TikTok:** ad group minimum $20 a day ([Verified](https://ads.tiktok.com/help/article/budget)). Use only in short bursts behind a video that already did well for free.
- **Meta:** about $1 a day minimum (Secondary).
- **Reddit ads:** $5 a day (Secondary).
- **Google App campaigns:** need the Play listing first.

### iOS
Add to Home Screen works today. An App Store wrapper costs $99 a year, needs a Mac, and risks rejection under guideline 4.2 for repackaged websites ([Verified](https://developer.apple.com/app-store/review/guidelines/)). Defer it.

## Decisions for you

1. **Move to your own domain before printing or promoting anything.** `dewclaw.kcbeyondlimits.com` costs nothing since you own the domain, looks more trustworthy than `netlify.app`, and keeps every link and QR code valid for good. It needs a Netlify domain setting, `ALLOWED_ORIGIN` and `APP_ORIGIN` in `worker/wrangler.toml`, the Play package's host, and `DEWCLAW_ORIGIN=… node tools/build-pages.mjs`. I recommend doing this before merging so Google first sees the pages at their permanent address.
2. **Breed facts that sit behind Plus in the app are free on the guide pages** (exercise minutes, grooming cadence, the five-condition watchlist). I did that on purpose: it is commodity information every breed site gives away, and it is what people search for. What stays paid is the personal plan, schedule and reminders. Say so if you would rather hold the watchlist back.
3. **Analytics.** The privacy policy promises none. Search Console and Play Console give enough to start. Adding anything on-site means editing that policy first.
4. **A vet reviewer.** One named veterinarian reviewing the breed data would do more for the health pages' ranking and for trust than any other single thing. Do not claim one until you have one.

## Backlog, in order

1. Foods toxic to dogs and cats page (5,400 a month plus a long tail such as "can dogs eat grapes" at 110,000). Needs sourced content from ASPCA; I did not write medical content without a source in hand.
2. Dog age calculator (about 50,000 a month). Needs an agreed, citable formula.
3. A "share my pet's chart" image from the app, so each user's chart is a small ad.
4. Play closed test, then production.
5. Microsoft Store package.
