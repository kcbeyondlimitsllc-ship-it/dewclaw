# KC: Open Trail: Google Play store listing

Written 2026-11-17. Everything here is ready to paste into Play Console. The order to do things in, and the answers for the declaration forms, are in `PLAY-STORE-LAUNCH.md` next to this file.

This listing describes **version 1.0 of the Play app, which sells nothing**: no gems, no sets, no prices. That is the build the repo ships (`PLAY_BILLING = 'off'`). When purchases are added through Google Play Billing, use the wording under "When purchases are switched on" near the end.

Anything marked `OWNER_FILLS_IN` is yours to type. No address, phone number or key is stored in this file on purpose.

---

## 1. Main store listing

Play Console: Grow users > Store presence > Main store listing. Default language: English (United States).

### App name (limit 30 characters)

```
KC: Open Trail
```

14 characters. It matches the name inside the app and on the home screen, which is what Google expects.

Optional longer form, exactly 30 characters, if you want a search word in the name: `KC: Open Trail - Dog Adventure`. The short one is the safer choice; use one or the other, not a third.

### Short description (limit 80 characters)

```
Roam a low-poly Oregon river town as KC the dog. Dig, fetch, paddle and skate.
```

78 characters.

### Full description (limit 4,000 characters)

About 2,260 characters. Every number in it comes from the game's own README; if the game changes, change the number here too.

```
KC: Open Trail is a gentle free-roam 3D adventure. You play as KC (she is a real dog), off the leash in a low-poly St. Helens, Oregon, with the whole road to Portland ahead of her.

There is no score to chase and nothing to lose. Go where your nose points.

EXPLORE
• One open world: the riverfront old town and Courthouse Plaza, the docks and Sand Island on the Columbia, parks and a quarry, farm country, and a compact Portland with the St. Johns Bridge, Tilikum Crossing, forest trails and food carts.
• 42 named districts to discover, with a map, a compass and signposts.
• A day and night cycle, light rain, and snow-capped volcanoes on the horizon.

BE A DOG
• Run, sprint, jump, swim, sit, bark, dig and shake.
• Meet the townspeople: they chat, wave and pet KC. Other dogs want to play.
• Find bones, golden tennis balls, dig spots and photo spots. Drop KC's ball by a person and they throw it.

HOP ON
• Skateboards, canoes and camper vans. One button on, the same button off.
• Ride the little tram over the car-free bridge.

HELP OUT
• 16 story jobs around town, from a paper round to ringing the Old Fog Bell. Jobs pay in bones. Failing a job costs nothing.
• Switch on the Fog Bell Festival for lanterns in the plaza, the Lantern Stack and 8 festival activities.

MAKE IT YOURS
• Spend the bones KC earns on upgrades, hats, bandanas, collars, ride parts and KC's Den.
• Ten Trail Buddies to bring along.
• Photo mode with frames, filters and stickers.

MADE WITH FAMILIES IN MIND
• No ads.
• No accounts, no chat, no tracking.
• The save stays on your device.
• This version has nothing to buy with real money. Bones and gems are earned by playing.
• For grown-ups: the KC Gear shelf can show real KC merchandise sold on a separate website. That part is off until a grown-up switches it on in Settings, and a grown-up question comes before any link leaves the game.

PLAY YOUR WAY
• Touch, keyboard and mouse, or a gamepad.
• Portrait or landscape. A left-handed touch layout is in Settings.
• Graphics quality steps down by itself on slower devices.

KC: Open Trail is an original game. Real public places keep their names; every shop and business in it is invented.

Questions or a problem? Write to us at the address under Developer contact.
```

Before pasting, check three lines against the build you are submitting:

- "nothing to buy with real money" is only true while `PLAY_BILLING` is `'off'`.
- "Ten Trail Buddies", "16 story jobs", "8 festival activities", "42 named districts" are from `site/games/kc-open-trail/README.md` as of today.
- The description does not promise offline play. The game has an offline shell, but nobody has tested it inside the installed Play app yet (see the launch checklist). Add a line such as "After the first launch it also starts without a connection." only after you have seen that work on a phone.

What was left out on purpose: any other game's or film's name, "best", "#1", "free" in the name, prices, and the word "educational" (the game makes no such claim).

---

## 2. Graphics

All files are in `marketing/kc-open-trail/play-assets/`. Every screenshot is the real game running as the Play app, with its own HUD; nothing was drawn on top. How they were made, and how to make them again, is in `play-assets/README.md`.

| Play Console field | File | Size | Play's rule |
|---|---|---|---|
| App icon | `icon-512.png` | 512 x 512, 32-bit PNG, 52 KB | 512 x 512, 32-bit PNG, up to 1024 KB |
| Feature graphic | `feature-graphic-1024x500.png` | 1024 x 500, 24-bit PNG, no alpha | 1024 x 500, JPEG or 24-bit PNG, no alpha |
| Phone screenshots | `phone-portrait/*.png` (8) | 1080 x 1920 | 2 to 8, each side 320 to 3840 px, long side at most twice the short side |
| Phone screenshots, other set | `phone-landscape/*.png` (7) | 1920 x 1080 | same; three or more 16:9 at 1920 x 1080 or larger make a game eligible for recommendations |
| 7-inch tablet screenshots | `tablet-7/*.png` (4) | 1920 x 1200 | optional, up to 8 |
| 10-inch tablet screenshots | `tablet-10/*.png` (4) | 1920 x 1200 | optional, up to 8 |

The icon is the same picture as the app's home-screen icon (`site/games/kc-open-trail/icons/maskable-512.png`), a full square with no rounded corners; Google Play rounds it.

**Which phone screenshots to upload.** Play takes at most 8 for phones. Two good choices:

- The 8 portrait ones, in this order: `plaza`, `bridge`, `canoe`, `skate`, `mission`, `festival`, `upgrades`, `wardrobe`.
- Or, to qualify for the recommendation rule for games (at least three landscape 16:9): `phone-landscape/plaza`, `bridge`, `canoe`, `skate`, `festival`, `mission`, then `phone-portrait/upgrades`, `wardrobe`. Portrait and landscape can be mixed in one listing.

Tablet screenshots are not required by the research for this launch. They are included because they cost nothing and let the listing show properly on tablets.

What each picture shows:

| File | What is on screen |
|---|---|
| `plaza` | KC on Courthouse Plaza, old town shops behind her |
| `mission` | The Plaza Paper Round job in old town: job timer and count on the HUD |
| `bridge` | KC on the deck of the St. Johns Bridge |
| `canoe` | KC paddling a canoe on the Willamette under the bridge |
| `skate` | KC on a skateboard in Columbia View Park, wearing the Ranger hat and red bandana (both bought with bones) |
| `upgrades` | The Shop, Upgrades tab: prices in bones |
| `wardrobe` | The Shop, Wardrobe tab: hats priced in bones |
| `festival` | The Fog Bell Festival at dusk: lanterns and the Lantern Stack |
| `dressed` (landscape only) | KC close up in the hat and bandana |

No preview video has been made. It is optional.

---

## 3. Store settings

Play Console: Grow users > Store presence > Store settings.

| Field | Value |
|---|---|
| App or game | Game |
| Category | Adventure |
| Tags (up to 5) | Pick from Play's own list the ones closest to: Adventure, Casual, Simulation, Single player, Stylized. The exact tag names in the Console list were not checked; choose only tags that are true of the game. Do not pick "Educational" or "Racing". |
| Email | `OWNER_FILLS_IN` (a support address you read; it is shown publicly) |
| Phone | `OWNER_FILLS_IN` or leave empty (optional on the listing; shown publicly if given) |
| Website | `OWNER_FILLS_IN` (suggested: the game's own page, `https://dewclaw-app.netlify.app/games/kc-open-trail/`) |
| Privacy policy | `https://dewclaw-app.netlify.app/kc-open-trail/privacy.html` (must be live before you submit; the page itself has owner blanks to fill first) |
| External marketing | Your choice; it only controls whether Google may advertise the app outside Play |

On an organization account Google also shows the developer's legal name and address publicly. Those come from the account, not from this listing.

---

## 4. Google Play Billing products (for the later update, not for version 1.0)

Version 1.0 needs **none** of these. Create them only when you are ready to switch purchases on (`PLAY-STORE-LAUNCH.md`, Part F). Creating them early does no harm as long as they stay inactive or the app keeps `PLAY_BILLING = 'off'`.

Play Console: Monetize with Play > Products > One-time products. All 16 are one-time products; none is a subscription.

Rules that matter:

- **The product ID must be typed exactly as below.** The game and the worker look products up by these names. A product ID cannot be changed after it is created.
- "Used up" means the worker tells Google the item was consumed, so it can be bought again. "Kept" means the worker acknowledges it once and Google remembers the account owns it. You do not set this in Play Console; it is how the worker treats each ID (`OT_GRANTS` in `worker/dewclaw-worker.js`). The column is here so you can check the two agree.
- Prices are the US dollar prices before tax. Let Play Console convert them for other countries, or sell in the United States only at first.
- The price shown in the game comes from Google Play, so whatever you type here is what players see.
- Titles and descriptions below are short on purpose. The limits (55 characters for a name, 200 for a description) are from memory, not from a page checked today; everything below is well inside them.

| # | Product ID | In the game | Name | Description | Price (USD) |
|---|---|---|---|---|---|
| 1 | `ot_gems_80` | Used up | 80 gems | 80 gems for KC: Open Trail. Gems buy cosmetics only. | 0.99 |
| 2 | `ot_gems_500` | Used up | 500 gems | 500 gems for KC: Open Trail. Gems buy cosmetics only. | 4.99 |
| 3 | `ot_gems_1200` | Used up | 1,200 gems | 1,200 gems for KC: Open Trail. Gems buy cosmetics only. | 9.99 |
| 4 | `ot_gems_2600` | Used up | 2,600 gems | 2,600 gems for KC: Open Trail. Gems buy cosmetics only. | 19.99 |
| 5 | `ot_gems_7000` | Used up | 7,000 gems | 7,000 gems for KC: Open Trail. Gems buy cosmetics only. | 49.99 |
| 6 | `ot_starter` | Kept (once) | First Trail set | 400 gems and four First Trail cosmetics. Can be bought once. | 4.99 |
| 7 | `ot_trail_pass` | Kept | Trail Journal pass | The second column of the Trail Journal: 15 cosmetics and 300 gems, paid out as KC reaches each step. It never runs out. | 5.99 |
| 8 | `ot_pack_forest` | Kept | Whispering Firs set | Eight cosmetic items. Each one can also be earned in the game. | 3.99 |
| 9 | `ot_pack_galaxy` | Kept | Night Sky set | Eight cosmetic items. Each one can also be earned in the game. | 3.99 |
| 10 | `ot_pack_roadtrip` | Kept | Open Road set | Eight cosmetic items. Each one can also be earned in the game. | 3.99 |
| 11 | `ot_pack_halloween` | Kept | Spooky Hollow set | Eight cosmetic items. Each one can also be earned in the game. | 3.99 |
| 12 | `ot_treat_3` | Used up | 3 Party Treats | A town dog walks with KC for ten minutes, with confetti. Changes nothing about how KC plays. | 1.99 |
| 13 | `ot_treat_10` | Used up | 10 Party Treats | A town dog walks with KC for ten minutes, with confetti. Changes nothing about how KC plays. | 4.99 |
| 14 | `ot_supporter` | Kept | Supporter set | 600 gems and four Supporter cosmetics. A thank-you; it gives no boost of any kind. | 9.99 |
| 15 | `ot_everything` | Kept | Everything bundle | The four cosmetic sets, the Trail Journal pass and the Supporter set with its 600 gems. | 24.99 |
| 16 | `ot_tip_3` | Used up | Tip the maker | A thank-you to the person who makes the game. You get a "Good Human" tag the first time. It buys nothing else. | 3.00 |

Where these come from: IDs and prices are `OT_PRICES` in `worker/dewclaw-worker.js` and the comments in `site/games/kc-open-trail/js/store-config.js`; names and what each grants are `CATALOG` in `site/games/kc-open-trail/js/store.js`. `worker/test.js` fails if the game and the worker disagree, so if a price changes, change it in those places and here together.

Two wording points for a game children play (Families policy, monetization rules):

- Keep "gems" and "dollars" clearly apart. Never write a gem amount next to a dollar sign without the word "gems".
- No "limited time", "best value" or "only today" in a product name or description. Nothing in this table uses them.

---

## 5. When purchases are switched on (later)

Change these together, in the same update:

1. Full description: replace the line "This version has nothing to buy with real money. Bones and gems are earned by playing." with:

   ```
   • Optional in-app purchases for grown-ups: gems and cosmetic sets. They change how KC looks, never how she plays. The shop is off until a grown-up switches it on.
   ```

2. Data safety, content rating and the "contains in-app purchases" label: see `PLAY-STORE-LAUNCH.md`, Part F.
3. Do not mention the website shop, Stripe, or any other way to pay anywhere in the listing or the app. Google's Payments policy forbids pointing Play users to another way to pay for digital items.
