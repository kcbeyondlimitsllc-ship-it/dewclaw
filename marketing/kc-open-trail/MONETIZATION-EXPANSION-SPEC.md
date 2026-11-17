# KC: Open Trail: monetisation and expansion spec

Written 2026-11-16. One merged design from three drafts ("depth", "revenue", "simple"). Nothing in this file has been built or playtested. Every number is a starting value.

This is a design document, not legal or tax advice. Section 6 lists rules as I read them from the sources; a lawyer should check them before launch.

## 0. Read this first

### What the code says today (checked 2026-11-16)

| Brief said | What is actually there | Effect on this spec |
|---|---|---|
| `game.economy.grant / owns / catalog / setFlag / getFlag` and `game.shop.registerTab` exist | `js/economy.js`, `js/shop.js`, `js/store.js` and `js/missions.js` are stubs whose `init(game)` returns `{}` | The spec is written to that contract as stated. It has to be built first (stage 1). |
| The worker's GRANTS table already holds the `ot_` SKUs | `/home/user/dewclaw/worker/dewclaw-worker.js` has only `PP_GRANTS` (`pp_*`) and `WEB_PRODUCTS`. There is no `ot_` SKU anywhere in it. | Section 4 gives the full `OT_GRANTS` table to add. |
| Grants are `{bones, gems, items, consumable}` | `oneTimeGrant` returns `{ bones, items }` only. There is no `gems` field. | One-line worker change, listed in section 4.4. |
| Checkout returns to the game | `success_url` is `APP_ORIGIN/?cs=...#path` and `RETURN_PATHS` is `/plus`, `/pocket`, `/geopet` | The game at `/games/kc-open-trail/` needs its own return target and, if it is on another origin, an `ALLOWED_ORIGIN` entry. |
| Idempotent grants | True per Checkout session (`claim:<hash>` in KV, 400 days). There is no Stripe webhook, so the worker never hears about refunds or disputes. | Refunds are handled by hand at launch. |
| The world has shops to hang systems on | `js/data.js` was rewritten today into St. Helens, Scappoose, Sauvie Island and Portland. The place names used in all three drafts (Trailhead Outfitters, Paws & Co., Hollow Post and so on) no longer exist. | This spec uses the buildings that are in `data.js` now. If that file changes again, re-map the places in section 5.1. |

Other facts the design rests on:

- Save is `localStorage` only (`kc-open-trail-save-v1`). No accounts. A cleared browser loses everything unless a restore path exists.
- Core hooks that exist: `setModifier` keys `speed, stamina, jump, magnet, carry, swim, bones`; `setCosmetic` slots `bandana, harness, collar, hat, tag, trail`; `setSkin` for `skateboard, canoe, van`; `kc.registerHat`; `spawnProp`; `kc.teleport`; `world.setTime`; tunable `game.rewards`.
- Hooks that do not exist: ride tuning (speed, turn and the van's off-road slowdown are constants inside `vehicles.js`), a dog-follows-KC call, a way to change the dig cooldown (240 s, hard-coded) or the ranger fine.
- Current payouts: bone 1, dig 3-8, photo 5, sign 2, fetch 2, zone 3, golden ball 1 gem + 10 bones.
- Current world counts: 36 golden balls, 32 dig spots, 16 photo spots, 34 signposts, 38 zones, 10 dog spots, 11 rides (3 skateboards, 4 canoes, 4 vans), 9 market stalls, 7 food carts.
- `ARCHITECTURE.md` allows one cross-origin call: the worker, after a real-money Buy press. Merch images therefore cannot be loaded from `images-api.printify.com`, and prices cannot be fetched live.
- Merch catalogue: 54 products at `https://kcbeyondlimits.com/product/{id}`. The file says its prices were sale prices on 2026-11-16 (53 of the 54 carry a `was` price; 34460077 does not).

### What I did not receive

The research hand-off was cut off partway through the free-to-play verification list (after item F05). The merch-store research and the rules research did not arrive at all. To fill the gap I re-checked the store and rules facts by web search on 2026-11-16. Printify's help pages refused direct reads (HTTP 403), so Printify facts below come from search summaries of those pages and are marked "likely", not "confirmed".

### How I judged the three drafts

| Test | Depth | Revenue | Simple |
|---|---|---|---|
| Evidence | Best use of the ladder research. Total sinks of about 1.3 million bones had no income model behind them. | Best use of the pricing and payer research; rejected the items the research marked wrong. | Used the least evidence but invented the least. |
| Hard rules | Sold a permanent +25% bones boost and a paid bones boost treat. Both sit too close to paying for progress. | Clean. Its confirm, cap and chargeback rules are kept here. | Clean, but changed the price of existing gem SKUs so the smallest pack cost more per gem than the ids imply. |
| Value to a solo owner | Careers, Season Stars and weekly goals need steady content work. | Seasons, gift codes, weekly bulletin and manual merch checks all cost owner time. | Best. Nothing rotates, nothing expires. |
| Buildable | Assumed hooks that are not in the core. | Flagged the missing ride hook. | Flagged the hooks and wrote to one data table. |

What this spec takes from each: the ladder breadth and business shape from Depth; the price ladder, confirm screen, spend cap and compliance thinking from Revenue; the "one table, nothing rotates, money never buys bones or stats" spine and the Trail Journal from Simple.

---

## 1. What other games do

Sources were read on 2026-11-16 by the research step. "Verdict" is mine.

| Pattern | Example games | Evidence | Verdict | Why |
|---|---|---|---|---|
| Housing ladder that adds storage, upgrade first and pay later | Animal Crossing: New Horizons | Seven loan stages from 98,000 to 2,498,000 Bells, then six storage-only steps paid up front. Final payoff makes exterior changes free. Confirmed. [Nookipedia](https://nookipedia.com/wiki/Player_house) | Use | Fits a den for KC. The pay-later bar has no interest and no deadline, so it cannot hurt a child. |
| Tiered tool upgrades, 3-4 steps at about 2-2.5x | Stardew Valley | Tools at 2,000 / 5,000 / 10,000 / 25,000g, bought in order, tool locked away for 2 days. Confirmed. [Stardew Valley Wiki](https://stardewvalleywiki.com/Tools) | Adapt | Same curve for KC's abilities and gear. No lock-out period and no material grind. |
| Vehicle performance tracks | GTA Online | Engine 4 levels, brakes and transmission 3 tiers. Confirmed. [gta.wiki](https://gta.wiki/w/Los_Santos_Customs) | Adapt | Three tracks of three tiers per ride. Needs a small core hook first. |
| Income property with three upgrades and a capped till | GTA Online nightclub | Three upgrades at 1,425,000 / 475,000 / 695,000; safe capped at 250,000; income falls as popularity decays. Confirmed. [gta.wiki](https://gta.wiki/w/Nightclubs) | Adapt | Keep the capped till and three upgrades. Drop popularity decay: it is a chore loop and needs tuning time. |
| Recurring upkeep fees | GTA Online bunker | 4,500 a day fully upgraded; the developer halved it after complaints. Confirmed. [gta.wiki](https://gta.wiki/w/Bunker) | Avoid | A fee that drains a child's balance while they are away is a dark pattern in this setting. |
| Post-story prestige sinks | Stardew Valley | Obelisks at 500,000-1,000,000g and a 10,000,000g Gold Clock that only removes chores. Confirmed. [Stardew Valley Wiki](https://stardewvalleywiki.com/Wizard%27s_Tower) | Use | Trail markers and a Town Fund ending in a Golden Hydrant. |
| Daily objectives with streak bonuses | GTA Online | 3 a day; 7-day and 28-day streak bonuses. Confirmed. [gta.wiki](https://gta.wiki/w/Daily_Objectives) | Adapt | Three daily sniff-outs, made on the device from the date. No streak, so nothing is lost by missing a day. |
| Weekly rotating discounts | GTA Online | Pattern supported; the specific examples in the research did not check out. Unconfirmed. [recap](https://racinggames.gg/article/gta-online-weekly-update-live-4-march-2021-new-podium-car-discounts-new-content-revealed-diamond-casino-deals-money-glitch-save) | Avoid | Needs weekly owner work and reads as urgency. |
| Daily rotating cosmetic shop | Battle-royale item shops | Criticised for artificial scarcity; a 2025 US class action over timers is reported in secondary coverage only. Likely. [GameSpot](https://gamespot.com/articles/fortnites-item-shop-wont-stop-being-weird/1100-6520635/) | Avoid | Everything in this game is always on the shelf. |
| Premium currency price ladder | 32 mobile games; GTA Online | Most common ladder is $4.99 / $9.99 / $19.99 / $49.99 / $99.99, and the $4.99 pack sells best. Confirmed. [Gamesbrief](https://www.gamesbrief.com/2014/09/premium-currency-pricing-trends-and-tricks/) GTA's top card gives 2x the per-dollar value of the bottom one. Confirmed. [gta.wiki](https://gta.wiki/w/Shark_Cards) | Adapt | Keep the five existing gem ids, stop at $49.99, keep the top pack under 2x the bottom pack per dollar (it is 1.73x). |
| Half-price one-time starter | Red Dead Online; survey of 54 F2P staff | 25 gold for $4.99 once; 59% would price a starter under $5; 77% of converters convert in their first two weeks. Likely (the last items of this research batch reached me unverified). [Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2024/4/8/free-to-play-starter-pack-pricing-when-conversion-is-king-we-may-price-too-low), [Unity](https://unity.com/blog/games/the-2023-mobile-growth-and-monetization-report-is-here) | Use | `ot_starter` at $4.99, listed in the store after the first mission, with no countdown and no window. No pop-up; like every cash screen it is visible only once a grown-up has turned spending on. |
| Season pass | Mobile games; Red Dead Online Outlaw Pass | $5-$15, monthly seasons; the Outlaw Pass returned its full cost at 8 ranks. Confirmed for structure; buy rates are not reliably published. [Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2022/6/4/battle-passes-analysis), [Shacknews](https://www.shacknews.com/article/119470/red-dead-online-outlaw-pass-no-3-ranks-and-rewards) | Adapt | One permanent Trail Journal. No seasons, no expiry. Buying late pays out every step already reached. |
| One-off permanent purchases instead of currency | Forza Horizon 5; Roblox passes | Forza sells only one-time packs. Roblox separates "pass" (once) from "product" (repeatable). Confirmed. [forza.net](https://forza.net/fh5dlclist), [Roblox docs](https://create.roblox.com/docs/production/monetization/passes) | Use | Two SKU types only: permanent entitlements and consumables. Packs list every item. |
| Permanent paid earnings multiplier | Roblox simulators; Forza VIP | Listing prices and stacking rules conflict between sources. Unverified. [Rolimons](https://www.rolimons.com/gamepass/5944009) | Avoid | It sells gameplay. The EU proposal reported this month targets pay-to-progress for minors (section 6). |
| Career gated by a licence, gear bought with currency plus rank tokens | Red Dead Online | 15 gold licence, 20 ranks, gear costs cash plus tokens. Confirmed. [GTABase](https://www.gtabase.com/red-dead-redemption-2/roles/trader-role) | Avoid for now | Good idea, but it is a second game's worth of mission content. Revisit after launch. |
| Monthly subscription | GTA+ | $5.99 at launch, $7.99 from April 2024, monthly currency stipend. Confirmed from a fan wiki. [gta.wiki](https://gta.wiki/w/GTA%2B) | Avoid at launch | See section 4.5. |
| Loot boxes and paid random rewards | Gacha games | FTC action in January 2025: $20 million, no loot boxes for under-16s without parental consent. [FTC](https://ftc.gov/business-guidance/blog/2025/01/level-tips-businesses-ftcs-settlement-genshin-impact-developer-hoyoverse) | Avoid | Hard rule. Every purchase shows exactly what it contains. |
| Piggy bank and first-purchase doubler | Mobile casual games | Structure documented, no price or conversion data. Likely at best. [Heroic Labs](https://heroiclabs.com/blog/understanding-piggy-bank-mechanics-mobile-games/) | Avoid | A filling bank that can only be opened with money is pressure aimed at a child. |
| Tip jar | itch.io | 30% of money spent there was paid above the minimum (2015 data, paid downloads). Unverified for free games. [itch.io](https://itch.io/docs/creators/pricing) | Adapt, late | `ot_tip_3`, low priority. |
| $0.99 entry price | Mobile stores | On Stripe, a $0.99 charge loses $0.33 to fees. Confirmed. [Stripe pricing](https://stripe.com/pricing) | Adapt | Kept only as an exact top-up so nobody has to overbuy. Not promoted. Owner decision in section 8. |

Reality check from the same research: a self-hosted browser game should plan on 10-15% of players returning the next day ([CrazyGames docs](https://docs.crazygames.com/resources/basic-launch-metrics/)) and on 0.5-2% of players ever paying. No public benchmark exists for an indie web game with its own checkout.

---

## 2. Upgrade ladders

All ladders cost bones. Bones cannot be bought with money (section 4). Tiers are bought in order.

**Time to afford** is the tier's cost divided by the income rate of the stage the tier is aimed at (section 3.1): up to 300 bones uses 300 an hour, up to 1,500 uses 600, up to 6,000 uses 1,200, above that 2,000. A dearer tier can therefore show a shorter time than the tier before it.

Every bone price is multiplied by one constant, `ECON_SCALE` (start at 1.0), so the whole economy can be retuned in one place after playtest.

| Ladder | Group | Hook | Tier costs (bones) | Effect per tier | Time to afford | Ladder total |
|---|---|---|---|---|---|---|
| 1. Trail Legs | KC abilities | `setModifier` speed | 120 / 350 / 900 / 2,200 | x1.05 / x1.10 / x1.15 / x1.20 | 24 min / 35 min / 1.5 h / 1.8 h | 3,570 |
| 2. Big Lungs | KC abilities | `setModifier` stamina | 100 / 300 / 800 / 2,000 | x1.15 / x1.30 / x1.45 / x1.60 | 20 min / 60 min / 80 min / 1.7 h | 3,200 |
| 3. Spring Paws | KC abilities | `setModifier` jump | 150 / 450 / 1,200 | x1.07 / x1.14 / x1.20 | 30 min / 45 min / 2.0 h | 1,800 |
| 4. Super Sniffer | KC abilities | `setModifier` magnet (pickup radius) | 80 / 250 / 700 / 1,800 | x1.25 / x1.5 / x1.75 / x2.0 | 16 min / 50 min / 70 min / 1.5 h | 2,830 |
| 5. Otter Paddle | KC abilities | `setModifier` swim | 150 / 450 / 1,200 | x1.10 / x1.20 / x1.30 | 30 min / 45 min / 2.0 h | 1,800 |
| 6. Lucky Nose | KC abilities | `setModifier` bones (pickups and digs only) | 400 / 1,200 / 3,000 / 7,000 | x1.10 / x1.20 / x1.30 / x1.40 | 40 min / 2.0 h / 2.5 h / 3.5 h | 11,600 |
| 7. Dig Mitts | Gear | `game.rewards.dig` | 250 / 700 / 1,800 | dig pays 4-9 / 5-11 / 6-13 | 50 min / 70 min / 1.5 h | 2,750 |
| 8. Fetch Ball | Gear | `game.rewards.fetch` | 200 / 600 / 1,500 | fetch pays 3 / 4 / 6 | 40 min / 60 min / 2.5 h | 2,300 |
| 9. Saddlebags | Storage | `setModifier` carry | 300 / 900 / 2,400 | carry 2 / carry 3 / carry 4 | 60 min / 1.5 h / 2.0 h | 3,600 |
| 10. Treat Pouch | Storage | module state | 200 / 600 / 1,500 | hold 2 bakery treats (base 1) / hold 4 / hold 6 | 40 min / 60 min / 2.5 h | 2,300 |
| 11. Trail Camera | Photo mode | photo screen overlay | 250 / 700 / 1,800 | 6 frames / 5 colour filters + zoom / sticker placement, 4 KC poses, photo wall slot in the den | 50 min / 70 min / 1.5 h | 2,750 |
| 12. Skateboard: Smooth Wheels | Rides | needs tuning hook | 200 / 500 / 1,200 | top speed +8% / +16% / +24% | 40 min / 50 min / 2.0 h | 1,900 |
| 13. Skateboard: Carving Trucks | Rides | needs tuning hook | 200 / 500 / 1,200 | turn rate +10% / +20% / +30% | 40 min / 50 min / 2.0 h | 1,900 |
| 14. Skateboard: Pop Deck | Rides | `trick` event (no hook) | 200 / 500 / 1,200 | each ollie pays 1 bone (max 1 per 5 s) / 2 bones / 3 bones | 40 min / 50 min / 2.0 h | 1,900 |
| 15. Canoe: Cedar Paddle | Rides | needs tuning hook | 250 / 600 / 1,500 | top speed +8% / +16% / +24% | 50 min / 60 min / 2.5 h | 2,350 |
| 16. Canoe: Steady Keel | Rides | needs tuning hook | 250 / 600 / 1,500 | turn rate +10% / +20% / +30% | 50 min / 60 min / 2.5 h | 2,350 |
| 17. Canoe: Dry Box | Rides | `setModifier` carry while aboard (no hook) | 250 / 600 / 1,500 | carry +1 in the canoe / +2 / +3 | 50 min / 60 min / 2.5 h | 2,350 |
| 18. Van: Tuned Engine | Rides | needs tuning hook | 300 / 800 / 2,000 | top speed +5% / +10% / +15% | 60 min / 80 min / 1.7 h | 3,100 |
| 19. Van: Trail Tyres | Rides | needs tuning hook | 300 / 800 / 2,000 | off-road slowdown 0.70 -> 0.80 / 0.90 / 1.00 (none) | 60 min / 80 min / 1.7 h | 3,100 |
| 20. Van: Roof Rack | Rides | `setModifier` carry while aboard (no hook) | 300 / 800 / 2,000 | carry +1 in the van / +2 / +3 | 60 min / 80 min / 1.7 h | 3,100 |
| 21. KC's Den | Home | `spawnProp('building')` swap, `kc.teleport`, `world.setTime` | free / 400 / 1,200 / 3,000 / 7,000 / 15,000 | Pup Tent: wardrobe, 4 decor slots / Doghouse: 8 slots, nap to pick the time of day / Garden Shed: 12 slots, fast travel home from the map / Trail Cabin: 18 slots, bone bowl (25 bones once per calendar day) / River Cottage: 26 slots, planning board (opens a mission chain) / Bluff Lodge: 36 slots, trophy wall, ride and den repaints free forever | free / 40 min / 2.0 h / 2.5 h / 3.5 h / 7.5 h | 26,600 |
| 22. Den Storage | Storage | module state | 500 / 1,000 / 2,000 / 4,000 | +6 decor slots, +1 saved outfit / +6, +1 / +6, +1 / +6, +1 | 50 min / 1.7 h / 1.7 h / 3.3 h | 7,500 |
| 23. Trail Buddies (x10 dogs) | Companions | `dogPlay` event, module state | 40 / 120 / 300 | heart 1: the dog greets KC / heart 2: the dog shows its favourite dig spot on the map / heart 3: the dog can be called as a buddy | 8 min / 24 min / 60 min | 4,600 |
| 24. Buddy Whistle | Companions | needs follower hook | 500 / 1,500 / 4,000 | call one heart-3 buddy to walk with KC for 10 min / buddy stays until sent home / two buddies at once | 50 min / 2.5 h / 3.3 h | 6,000 |
| 25. Biscuit Cart (Food Cart Pod) | Businesses | module state, `second` event | 800 / 400 / 640 / 960 | entry: 2 bones/min while playing, till holds 60 / Better Kit: rate +50% / Helper Pup: till holds 120 / Painted Sign: rate +25% and a new look | 80 min / 40 min / 64 min / 1.6 h | 2,800 |
| 26. Canoe Hire (North Marina) | Businesses | same | 2,500 / 1,250 / 2,000 / 3,000 | entry: 3 bones/min, till holds 90 / Better Kit: rate +50% / Helper Pup: till holds 180 / Painted Sign: rate +25% | 2.1 h / 2.1 h / 1.7 h / 2.5 h | 8,750 |
| 27. Pumpkin Stand (Wapato Patch Farm) | Businesses | same | 6,000 / 3,000 / 4,800 / 7,200 | entry: 6 bones/min, till holds 180 / Better Kit: rate +50% / Helper Pup: till holds 360 / Painted Sign: rate +25% | 5.0 h / 2.5 h / 4.0 h / 3.6 h | 21,000 |
| 28. Lantern Fund (autumn festival) | Festival | `spawnProp`, module state | 300 / 800 / 2,000 / 5,000 / 12,000 | ring 1 lit; unlocks the ghost-sheet costume at the tailor / ring 2; scarecrow outfit / ring 3; bat wings / ring 4; lantern vest that glows at dusk / top lantern lit all year; pumpkin suit; a brass plaque on the plaza | 60 min / 80 min / 1.7 h / 4.2 h / 6.0 h | 20,100 |
| 29. Trail Markers (8 hubs) | Town | `kc.teleport` | 1,500 | fast travel to that signpost, after reading it | 2.5 h | 12,000 |
| 30. Town Fund (St. Helens City Hall) | Town | `spawnProp` | 500 / 2,000 / 5,000 / 12,000 / 25,000 | plaza bench / dog drinking fountain / riverwalk lanterns / lookout telescope on Nob Hill / Golden Hydrant: collect every till from the den | 50 min / 1.7 h / 4.2 h / 6.0 h / 12.5 h | 44,500 |

That is 30 ladders. Notes that the table cannot hold:

- **Ladders 1-6** are plain `game.setModifier('upgrade:<id>', {...})` calls, re-applied from `state.upgrades` at boot because the core does not persist modifiers. The top tier of each also needs a free play milestone read from `state.stats` (for example 200 jumps for Spring Paws tier 3), so bones alone cannot skip play.
- **Ladder 6, Lucky Nose**: the core applies the `bones` modifier to pickups and dig spots only, not to missions or tills. Say so on the card.
- **Ladder 11, Trail Camera** is the photo mode ladder. Frames, filters and stickers are drawn over the photo screen. Check how `hud.js` builds the photo view before promising sticker placement.
- **Ladders 12-20, rides.** Each of the three ride kinds has three parts with three tiers. Upgrades apply to the kind, so all three skateboards improve together. Six of the nine tracks need a core hook such as `game.vehicles.setTuning(kind, { max, turn, offroad })`. The other three (Pop Deck, Dry Box, Roof Rack) can ship without it. The van's top speed stops at +15% so it stays polite around pedestrians.
- **Ladder 21, KC's Den.** One fixed plot near the Columbia View Park spawn. The building model is swapped in place, so nothing is traded in or lost. A stage is delivered at once and paid off through a progress bar: no interest, no deadline, the bar cannot go negative, and the next stage unlocks when the bar is full. "Time to afford" is the time to fill the bar.
- **Ladder 23, Trail Buddies.** The ten dogs already in `DOG_SPOTS` (Biscuit, Pepper, Cliff, Sandy, Clover, Mochi, Bruno, Juniper, Tabor, Rosie). Hearts are bought with gifts from Tailwind Pet Supply. Cost is per dog; the total is for all ten.
- **Ladder 24, Buddy Whistle** needs either a core follower call or the module moving the dog's mesh itself. Hold it until that is settled.
- **Ladders 25-27, businesses.** Each has an entry price and three upgrade levels. They earn only while the game is being played. The till stops when full and never goes negative. There is no upkeep, no decay and no supplies. Better Kit and Painted Sign add to the base rate (+75% together), so the three businesses fully upgraded make at most 3.5 + 5.25 + 10.5 = 19.25 bones a minute. The Biscuit Cart's entry is the reward of the last story mission in `SETTING-BRIEF.md` ("first payment toward your own treat cart"), so the player pays the 800 through that chain.
- **Ladder 28, Lantern Fund.** The festival runs in game time (late September to 31 October in the game's calendar), not on real dates, so nothing is missed by not playing. Contributions are accepted all year. The festival has no chosen name yet; "Lantern Tide" is one of five options in `SETTING-BRIEF.md` and none has been trademark-searched. The word "Halloweentown" is not used anywhere.
- **Ladder 29, Trail Markers.** Eight of the 34 signposts become fast-travel points: welcome, marina, mccormick, scappoose, farm, stjohns, square, tabor.

Left out on purpose: careers with 20 ranks, business "season star" resets, crafting materials, weekly goals, a second soft currency. Each one is weeks of content or tuning for one person.

---

## 3. Sinks and balance

### 3.1 Expected income

These rates are design targets, not measurements. Missions do not exist yet, so the missions builder should size rewards to hit them.

| Stage | Hours played | Target bones per hour | Where it comes from | Total earned by the end of the stage |
|---|---|---|---|---|
| A. Pup | 0-2 | 300 | Loose bones (about 150), first finds of signs, zones, photos and golden balls (about 100), the tutorial mission (about 50) | 600 |
| B. Scout | 2-8 | 600 | The 16 story missions (about 300), dig spots and bones with the first upgrades (about 250), fetch (about 50) | 4,200 |
| C. Guide | 8-25 | 1,200 | Repeatable jobs and festival activities (about 800), digs and bones with Lucky Nose and Dig Mitts (about 250), first business tills (about 150) | 24,600 |
| D. Trailblazer | 25 and up | 2,000 | Repeatable jobs (about 1,100), tills (about 900, which is about 78% of the 1,155 an hour the three businesses make when fully upgraded and always collected) | 94,600 at hour 60; 174,600 at hour 100 |

One-time world finds are small on purpose: 16 photos x 5 + 34 signs x 2 + 38 zones x 3 + 36 golden balls x 10 = 622 bones.

### 3.2 What there is to spend on

| Sink | Where (building id in `data.js`) | Price | Total |
|---|---|---|---|
| The 30 ladders in section 2 | various | see table | 214,400 |
| Bandanas, 12 colours | Bandana Bay stall, Bridgeside Makers Market | 40 each | 480 |
| Collars, 8 colours | Knotty Collars stall | 60 each | 480 |
| Collar tags, 6 | Tag & Stamp stall | 80 each | 480 |
| Harness colours, 6 | Tailwind Pet Supply (`pets`) | 100 each | 600 |
| Hats, the 7 built in | Stitch & Sit Costume Tailor (`tailor`) | 150 / 150 / 200 / 250 / 300 / 400; crown 2,000 | 3,450 |
| Sparkle trails, 6 | Driftwood Toys (`toys`) | 300 each | 1,800 |
| Ride paint, 6 per ride kind | Channel Cyclery (`bikes`), Knot & Oar Chandlery (`chandlery`), Scappoose Fuel & Treats (`fuel`) | 200 each | 3,600 |
| Festival costumes, 5 (unlocked by the Lantern Fund) | Stitch & Sit Costume Tailor | 300 / 450 / 600 / 750 / 900 | 3,000 |
| Den decor, about 30 props | catalogue at the den | 40-600, average 200; full refund on removal | 6,000 |
| Merch twins, 14 (section 5.3) | same shelves as the real products | 300-800 | 7,300 |
| **Everything above** | | | **241,590** |
| Premium cosmetics (pack contents sold singly) | Stitch & Sit Costume Tailor | 40 / 80 / 120 / 160 gems, or 50 bones per gem | open-ended |
| Bakery treats, used up | Flour & Paw Bakery (`bakery`) | Zoomie Biscuit 60 (speed x1.15 for 3 minutes); Lucky Jerky 120 (bones x1.5 for 5 minutes, pickups and digs only); Party Treat 80 (a town dog walks with KC for 10 minutes, confetti, no stats) | repeatable |
| Ranger fine | already in core | min(bones, 5 x mischief level) | repeatable |

### 3.3 Does it balance

- The cheapest useful things are a 40-bone bandana (8 minutes at stage A) and Super Sniffer tier 1 at 80 bones (16 minutes).
- All six ability ladders cost 24,800 bones. A player who spent on nothing else would finish them at about hour 25.
- All 30 ladders cost 214,400 bones, which the income curve reaches at about hour 120. Adding every bones cosmetic and twin brings the total to 241,590, about hour 133.
- The Town group (trail markers and Town Fund, 56,500 bones) is the post-story sink. Without it, the other 28 ladders are done by about hour 92.
- Businesses pay back slowly on purpose: the Biscuit Cart's 800 returns in 6.7 hours of play at 120 bones an hour, Canoe Hire's 2,500 in 13.9 hours, the Pumpkin Stand's 6,000 in 16.7 hours. Ship the Town Fund in the same release as the businesses, so passive bones always have somewhere to go.
- If playtest income is off by a factor, change `ECON_SCALE`, not individual prices.

### 3.4 Gems for players who never pay

Gems buy cosmetics only. They are never needed for anything that changes how KC plays.

| Free source | Gems | How often |
|---|---|---|
| Golden balls (already in core) | 36 | once |
| First visit to each of the 38 zones (listen for `discover`) | 38 | once |
| Trail Journal free column (section 4.3) | 30 | once |
| Three daily sniff-outs, generated on the device from the date | 2 a day | daily, no streak |
| Any gem item bought with bones instead | 50 bones per gem | any time, no cap |

That is 104 gems once, plus about 14 a week. The dual price is the only bridge between the currencies and it runs one way: bones can stand in for gems, gems can never become bones.

### 3.5 Rules on every spend

- Two steps: tap the item, then a confirm screen showing the item, the price and the balance afterwards.
- Try-on preview before buying any cosmetic.
- A 10-minute Undo on gem purchases that have not been used up.
- Descriptive labels only. No timers, no "most popular" badges, no "only today".
- Owned things stay owned. The price of an existing item never goes up.

---

## 4. Real-money catalogue

### 4.1 Principles

1. Money buys gems, cosmetics and a thank-you. It never buys bones, stats, boosts, skips or anything random. Every grant below has `"bones": 0`.
2. One paid currency. Every gem price shows its dollar value at the smallest pack's rate, with no bulk discount: 80 gems = $0.99, so 40 gems is shown as "about $0.50", 120 as "about $1.49", 160 as "about $1.98" (half-cents round up, so the figure is never below the true cost). That rate overstates the cost for anyone who bought a bigger pack; it never understates it.
3. Gem prices are multiples of 40, so the 80-gem pack buys whole items and strands nothing.
4. The dollar price is on every Buy button and again on the confirm screen, with the exact contents.
5. Real-money screens, and the shop itself, are off until a grown-up turns spending on for that device (section 4.4).

### 4.2 Every SKU

Net is the price minus Stripe's standard US online card fee of 2.9% + $0.30, rounded to the cent ([Stripe pricing](https://stripe.com/pricing), read 2026-11-16). International cards cost a further 1.5% and currency conversion 1%. Sales tax and Stripe Tax's 0.5% are not included.

| SKU | Price | Type | What the buyer gets | Stripe fee | Net | Kept |
|---|---|---|---|---|---|---|
| `ot_gems_80` | $0.99 | consumable | 80 gems | $0.33 | $0.66 | 67% |
| `ot_gems_500` | $4.99 | consumable | 500 gems | $0.44 | $4.55 | 91% |
| `ot_gems_1200` | $9.99 | consumable | 1,200 gems | $0.59 | $9.40 | 94% |
| `ot_gems_2600` | $19.99 | consumable | 2,600 gems | $0.88 | $19.11 | 96% |
| `ot_gems_7000` | $49.99 | consumable | 7,000 gems | $1.75 | $48.24 | 96% |
| `ot_starter` | $4.99 | once per save | 400 gems and the First Trail set (bandana, tag, sparkle trail, skateboard paint) | $0.44 | $4.55 | 91% |
| `ot_trail_pass` | $5.99 | permanent | The second column of the Trail Journal: 15 cosmetics and 300 gems, paid out as steps are reached | $0.47 | $5.52 | 92% |
| `ot_pack_forest` | $3.99 | permanent | Whispering Firs set, 8 listed items | $0.42 | $3.57 | 89% |
| `ot_pack_galaxy` | $3.99 | permanent | Night Sky set, 8 listed items | $0.42 | $3.57 | 89% |
| `ot_pack_roadtrip` | $3.99 | permanent | Open Road set, 8 listed items | $0.42 | $3.57 | 89% |
| `ot_pack_halloween` | $3.99 | permanent, sold all year | Spooky Hollow set, 8 listed items | $0.42 | $3.57 | 89% |
| `ot_treat_3` | $1.99 | consumable | 3 Party Treats (cosmetic, no stats) | $0.36 | $1.63 | 82% |
| `ot_treat_10` | $4.99 | consumable | 10 Party Treats | $0.44 | $4.55 | 91% |
| `ot_supporter` (new) | $9.99 | permanent | 600 gems and the Supporter set (tag, bandana, gold den trim, photo frame). No boost of any kind. | $0.59 | $9.40 | 94% |
| `ot_everything` (new) | $24.99 | permanent | The four packs, the Trail Journal pass and the Supporter set with its 600 gems. Bought separately these cost $31.94. | $1.02 | $23.97 | 96% |
| `ot_tip_3` (new) | $3.00 | repeatable | A "Good Human" tag the first time. The card says plainly that it buys nothing else. | $0.39 | $2.61 | 87% |

Gems per dollar by pack: 80.8, 100.2, 120.1, 130.1, 140.0. The top pack is 1.73 times the bottom pack per dollar. Show the gem count as a plain number; do not print "bonus" percentages or a "best value" badge.

`OT_GRANTS`, in the shape the worker uses, with `gems` added:

```js
const OT_GRANTS = {
  ot_gems_80:   { bones: 0, gems: 80,   items: [], consumable: true },
  ot_gems_500:  { bones: 0, gems: 500,  items: [], consumable: true },
  ot_gems_1200: { bones: 0, gems: 1200, items: [], consumable: true },
  ot_gems_2600: { bones: 0, gems: 2600, items: [], consumable: true },
  ot_gems_7000: { bones: 0, gems: 7000, items: [], consumable: true },
  ot_starter:   { bones: 0, gems: 400,  items: ["bandana:first-trail", "tag:first-trail", "trail:sunbeam", "skin:skateboard:first-trail"], consumable: false },
  ot_trail_pass: { bones: 0, gems: 0,   items: ["pass:trail"], consumable: false },
  ot_pack_forest:    { bones: 0, gems: 0, items: ["hat:moss-beanie", "bandana:fern", "collar:cedar", "trail:firefly", "skin:skateboard:forest", "skin:canoe:forest", "skin:van:forest", "decor:mushroom-lamp"], consumable: false },
  ot_pack_galaxy:    { bones: 0, gems: 0, items: ["hat:comet-cap", "bandana:starfield", "collar:nebula", "trail:stardust", "skin:skateboard:galaxy", "skin:canoe:galaxy", "skin:van:galaxy", "decor:moon-lamp"], consumable: false },
  ot_pack_roadtrip:  { bones: 0, gems: 0, items: ["hat:road-visor", "bandana:route-stripe", "collar:mile-marker", "trail:dust", "skin:skateboard:roadtrip", "skin:canoe:roadtrip", "skin:van:roadtrip", "decor:roadside-sign"], consumable: false },
  ot_pack_halloween: { bones: 0, gems: 0, items: ["hat:pumpkin-patch", "bandana:candy-corn", "collar:cobweb", "trail:ember", "skin:skateboard:spooky", "skin:canoe:spooky", "skin:van:spooky", "decor:jack-lantern"], consumable: false },
  ot_treat_3:   { bones: 0, gems: 0, items: ["treat:3"],  consumable: true },
  ot_treat_10:  { bones: 0, gems: 0, items: ["treat:10"], consumable: true },
  ot_supporter: { bones: 0, gems: 600, items: ["tag:supporter", "bandana:supporter", "den:gold-trim", "frame:supporter"], consumable: false },
  ot_everything: { bones: 0, gems: 600, items: ["pass:trail",
    "hat:moss-beanie", "bandana:fern", "collar:cedar", "trail:firefly", "skin:skateboard:forest", "skin:canoe:forest", "skin:van:forest", "decor:mushroom-lamp",
    "hat:comet-cap", "bandana:starfield", "collar:nebula", "trail:stardust", "skin:skateboard:galaxy", "skin:canoe:galaxy", "skin:van:galaxy", "decor:moon-lamp",
    "hat:road-visor", "bandana:route-stripe", "collar:mile-marker", "trail:dust", "skin:skateboard:roadtrip", "skin:canoe:roadtrip", "skin:van:roadtrip", "decor:roadside-sign",
    "hat:pumpkin-patch", "bandana:candy-corn", "collar:cobweb", "trail:ember", "skin:skateboard:spooky", "skin:canoe:spooky", "skin:van:spooky", "decor:jack-lantern",
    "tag:supporter", "bandana:supporter", "den:gold-trim", "frame:supporter"], consumable: false },
  ot_tip_3:     { bones: 0, gems: 0, items: ["tag:good-human"], consumable: true }
};
```

`treat:3` and `treat:10` follow the worker's existing `revive:1` style: the client adds that many Party Treats to `state.owned['treat:party']`.

What is and is not money-only:

- Every item in the four packs is also sold singly for gems (hat 120, bandana 80, collar 80, trail 120, each ride paint 80, decor 80; 720 gems for a full set, shown as "about $8.91"), and every gem price has a bones price at 50 bones per gem. So a pack is a shortcut, never the only route.
- The Party Treat is also 80 bones at the bakery.
- The First Trail set, the Supporter set, the 15 cosmetics in the Trail Journal pass column and the "Good Human" tag are money-only. The `tag:real-gear` tag comes only from a merch claim (section 5.3). All are cosmetic and the cards say so.

Not sold, with reasons: bones (pay-to-progress); any multiplier or boost (the market evidence for it failed verification, and it sells gameplay); a paid treasure map (it changes play; if wanted later, sell it for bones at Rain City Books); timer skips, streak repair, energy (none of those systems exist); gift codes and a 30-day gem drip (extra server state and support mail for one person; revisit after launch); a $99.99 pack.

### 4.3 The Trail Journal

Thirty lifetime milestones that every player works through free: zones found, golden balls, photos, digs, distance, missions.

- Free column: bones on every step and 30 gems in total.
- Pass column (`pass:trail`): 15 cosmetics and 300 gems (shown as "about $3.72": 300 x $0.99 / 80 = $3.7125, rounded up to the cent as rule 4.1(2) says), one reward every step, alternating.
- Nothing resets and nothing expires. Buying the pass late pays out every step already reached, at once.
- No later seasons are planned. If a second journal is ever made it gets its own SKU and the first stays on sale.

### 4.4 Purchase flow

1. **Spending lock.** Off by default. A grown-up turns it on for that device in Settings, through the gate. While it is off, the store tab shows only "Ask a grown-up to turn on the shop".
2. **Grown-up gate.** One function in `store.js`, used before every cash screen, every outbound shop link, the merch claim and restore. It is a deterrent, not proof of age (see section 6).
3. **Spend cap.** $50 per rolling 30 days per device by default, changeable behind the gate. It lives in the save, so say on the screen that it is a device limit and not a bank limit.
4. **Checkout.** Buy, gate, a confirm screen with price and exact contents, then the worker's `/stripe/checkout` and Stripe Checkout in the same tab. On return, `/stripe/claim`, then `game.economy.grant(grant, 'store:' + sku)`.
5. **Applying a grant once.** The worker answers `already: true` on every repeat call for a session. The client keeps its own list of applied session hashes in `state.modules.store` and applies a grant only if the hash is not in that list. To stop a copied return link being replayed on another device, send a random install id (made once, kept in the save) with the checkout call, store it in the session metadata, and have the claim refuse a different id.
6. **Prices on screen** come from a `prices.json` shipped with the game, because the worker may not be called before a Buy press. A developer script compares it with Stripe before each release.
7. **Restore ("Trail Key").** On the first permanent purchase the worker issues a short code using its existing `makeCode` / `saveCode` pattern and records permanent SKUs against it. Typing the code on another device grants the permanent items again. Gems and treats are not restorable, and the confirm screen says so before the purchase.
8. **Owned permanent SKUs** are hidden on that device. `ot_everything` is hidden once two or more of its parts are owned.
9. **Refunds and disputes.** There is no webhook, so handle them by hand in the Stripe dashboard. Never lock a save over a dispute. State the policy on the store screen: unused gems refunded on request within 14 days.

Worker changes this needs (not made here):

- Add `OT_GRANTS`; include it wherever `PP_GRANTS` is looked up (checkout, claim, one-time grant, price list).
- Return `gems` from `oneTimeGrant`.
- Add a return target for `/games/kc-open-trail/` and, if the game is on a different origin from the Dewclaw app, add it to `ALLOWED_ORIGIN`.
- Install-id check on claim; Trail Key issue and restore.
- `/ot/merch-claim` (section 5.4).
- Checkout currently sets `allow_promotion_codes: true`. Leave it on only if the owner intends to hand out Stripe promotion codes.

### 4.5 Supporter membership

**Not offered at launch. The one-time `ot_supporter` pack takes its place.**

What the rules research I could do today says:

- The FTC's "click-to-cancel" rule was struck down by the Eighth Circuit on 8 July 2025. The older law, ROSCA, still applies to online auto-renewing sales: clear disclosure of all terms before taking payment details, express informed consent, and a simple way to cancel. Many US states add their own auto-renewal laws. ([Steptoe](https://www.steptoe.com/en/news-publications/ftcs-click-to-cancel-rule-vacated-by-eighth-circuit.html), read 2026-11-16)
- The European Commission is reported to have presented its Digital Fairness Act proposal on 10 or 11 November 2026, covering subscriptions and dark patterns as well as game purchases. It is a proposal, not law, and I have not read the official text. ([Massively Overpowered](https://massivelyop.com/2026/11/11/eu-digital-fairness-act-proposes-major-regulation-on-gaming-lockboxes-subscriptions-and-dark-patterns/), read 2026-11-16)
- Stripe Billing adds 0.7% of subscription volume on top of card fees. ([Stripe pricing](https://stripe.com/pricing))

So a membership is legal to offer, but it does not suit this game yet: there are no accounts to hang a renewal on, the audience includes children, and it creates a members-and-others split among them. The worker already runs subscriptions for another product (`WEB_PRODUCTS` with `mode: "subscription"`), so the plumbing exists if the owner wants it later.

If the owner decides to offer one, the owner must:

1. Have a lawyer check ROSCA and the auto-renewal law of each state sold into (California first), and the EU and UK position.
2. Put price, renewal period and how to cancel on the screen before Stripe opens, and keep a record of the consent.
3. Turn on Stripe's customer portal so cancelling takes one link, and email a reminder before each renewal.
4. Give members cosmetics and a gem allowance only. No boosts.
5. Decide how a member proves membership on a new device (the worker's signed-token pattern does this for the other product).
6. Sell it only behind the grown-up gate, to an adult, with no in-game prompts aimed at the child.

---

## 5. In-game merch shop

### 5.1 Layout

Children see only in-game items priced in bones. The real product (photo, title, price, link) is one tap further, behind the grown-up gate.

| Place in the world (`data.js` id) | Shelf | Real products |
|---|---|---|
| Stitch & Sit Costume Tailor (`tailor`), St. Helens | Hats and clothes | 5 hats, 4 adult tops, 9 youth, kids and toddler tops |
| Tailwind Pet Supply (`pets`), St. Helens | Dog gear | Collar, leash, 2 dog tanks, feeding mat, pet bed |
| Fogline Coffee (`cafe`), St. Helens | Mugs | 3 mugs, 2 travel mugs, can cooler |
| Tag & Stamp and Clay Paws stalls, Bridgeside Makers Market, Portland | Stickers, bags and small things | 2 decals, round sticker, car magnet, 3 totes, 2 phone cases, laptop sleeve, mouse pad, acrylic panel |
| The same market, one extra stall | Winter shelf | 12 Christmas items. Shown from 1 November to 5 January by the device's date. Those are real dates and no countdown is shown. |
| Pause menu, "Real Gear" tab (`game.shop.registerTab`) | Everything above, plus "Claim a twin" and "Restore purchases" | all 54 |

The shelf counts are my sort of the 54 titles; confirm them when `merch.json` is generated.

A real-product card shows: the game's own copy of the thumbnail, the title, "from $X, checked on <date>; today's price is on the shop page", and "printed to order, shipping added at checkout, no returns". Then a leaving screen: "You are leaving the game for the KC Beyond Limits shop, a separate website", with a line on whether that shop uses tracking (section 8). The link opens the exact product page in a new tab with `rel="noopener noreferrer"`.

### 5.2 Featured products

Eight products on the front of the shelves, chosen for a spread of price and because each has a twin:

| Product id | Title | Price in the catalogue file (a sale price on 2026-11-16) | Why featured |
|---|---|---|---|
| 34460072 | KC Mountain Paw Dad Cap | $32.00 | A hat KC can wear too |
| 34460076 | KC Compass Knit Beanie | $21.59 | Winter; uses the built-in beanie shape |
| 34341309 | KC River Logo Hooded Sweatshirt | $29.71 | The logo piece |
| 34395138 | KC River Pattern Clip-On Dog Collar | $19.76 | The closest match between the real dog and the game dog |
| 34399813 | KC Camp KC Dog Tank | $31.92 | Dog gear |
| 34399669 | KC Camp KC Accent Coffee Mug | $8.89 | Lowest-priced mug (the decals, sticker, magnet, stocking and three ornaments cost less) |
| 34399759 | KC Squatch Country Round Vinyl Sticker | $3.80 | Pocket-money price |
| 34395132 | KC River Pattern Pet Bed | $112.27 | Top of the range |

These prices are shown here only as a record of what the file said. The game must not print them from this document; it prints them from `merch.json` with the date (section 5.5).

### 5.3 Twins

A twin is the in-game version of a real product. Fourteen at launch:

| Real product (id) | Twin item | How it is drawn | Bones price |
|---|---|---|---|
| Adventure Never Stops Snapback Trucker Cap (34460071) | `hat:trucker` | `registerHat` | 600 |
| Mountain Paw Dad Cap (34460072) | `hat:mountain-paw` | built-in cap, recoloured | 600 |
| PNW Adventure Club Flat Bill Snapback (34460075) | `hat:flatbill` | `registerHat` | 600 |
| Compass Knit Beanie (34460076) | `hat:compass-beanie` | built-in beanie | 600 |
| Mountain Paw Pom-Pom Beanie (34460077) | `hat:pom-beanie` | `registerHat` | 600 |
| River Pattern Clip-On Dog Collar (34395138) | `collar:river` | collar colour | 400 |
| Moon Compass Retractable Dog Leash (34395135) | `tag:moon-compass` | tag colour | 400 |
| Good Dogs Explore Further Pet Tank (34395136) | `harness:explore` | harness colour | 500 |
| Camp KC Dog Tank (34399813) | `harness:camp-kc` | harness colour | 500 |
| River Logo Hooded Sweatshirt (34341309) | `bandana:river-logo` | bandana colour | 400 |
| Adventure Club Vinyl Decal (34395112) | `skin:van:adventure-club` | `setSkin` | 500 |
| Squatch Country Round Vinyl Sticker (34399759) | `skin:skateboard:squatch` | `setSkin` | 500 |
| River Pattern Pet Bed (34395132) | `decor:river-bed` | den prop | 800 |
| Camp KC Accent Coffee Mug (34399669) | `decor:camp-mug` | den prop | 300 |

- Every twin can be bought with bones by anyone. A claim from a real order grants it free, plus a `tag:real-gear` collar tag that only a claim gives.
- Twins belong to one save. They cannot be traded, gifted or sold.
- The core draws collars, harnesses, bandanas and tags as flat colours, so most twins are a colour match, not a print. Say "inspired by", not "identical".
- The art is the owner's own designs redrawn in the game's low-poly style. I checked the 54 titles: none contains "Halloweentown". The artwork itself has not been checked against section 2 of `SETTING-BRIEF.md`.
- The other 40 products get twins later, by design family, as rows in the same table.

### 5.4 "Bought the real one, get the in-game one"

What the store can do, as far as I could establish on 2026-11-16:

| Question | Answer | Confidence |
|---|---|---|
| Can it print a unique code on each product or order? | No. Print on demand prints the same file every time. | Certain |
| Can a customer type a coupon code? | No feature found. The help centre describes store-wide product discounts set up under Promotions. | Likely. [Printify help](https://help.printify.com/hc/en-us/articles/25028388602897-How-do-discounts-work-for-Pop-Up-Store) |
| Does it tell another system when an order is placed? | Not documented for Pop-Up Stores. The Printify API lists shops and their orders, but no source says a Pop-Up Store appears there. | Unknown. [Printify API](https://developers.printify.com/) |
| Returns or exchanges? | Not supported; orders are made after purchase. | Likely. [Printify help](https://help.printify.com/hc/en-us/articles/12051129478417) |
| Can the game embed the shop or pass it a cart? | No embedding was possible when a draft tested it on the default domain. Untested on the custom domain. | Unconfirmed |

So an unlock that cannot be faked is not possible on this store today. The design makes faking it pointless instead.

**Launch design: claim by order number, with nothing of value attached.**

1. In the "Real Gear" tab, behind the gate, the grown-up types the order number from the confirmation email and picks the product.
2. The game calls the worker's `/ot/merch-claim` with the order number, the product id and the install id. The game sends nothing else and stores nothing personal.
3. The worker checks the format, stores only a hash of order number plus product id, and allows each pair to be claimed twice (two devices in one home). It also limits claims to three per install per 30 days and applies a daily limit per IP address.
4. The worker answers with `{ items: [twin, "tag:real-gear"] }` and the game applies it through `game.economy.grant(..., 'merch')`.

Why this is acceptable: the reward is a cosmetic that anyone can buy with bones, it cannot leave the save, and it carries no gems. A made-up order number gains a free hat. The claim grants no gems for exactly that reason.

If a real buyer finds their number already used, they email the owner, who grants it by hand and logs it. Expected volume is close to none.

**Do this ten-minute test before building the claim.** Make a read-only Printify personal access token and call `GET /v1/shops.json`. If the Pop-Up Store is listed and `GET /v1/shops/{shop_id}/orders.json` returns its orders, the worker can check order number plus shipping postcode for real, and a verified claim can then safely add a small gem thank-you (40 gems). Tokens are reported to expire after a year. Whether this works is unknown.

Rejected: codes printed on the product (not possible, and a visible code gets copied); asking buyers to email proof for every order (owner time, and it collects personal data for a free hat); the game's own Stripe checkout placing Printify orders (working capital, tax, shipping quotes and customer service; reconsider only above roughly 20 merch orders a month).

This claim call and the restore call are two new cross-origin requests. `ARCHITECTURE.md` currently allows only the Buy call, so its rule needs widening to "the worker, after a grown-up has passed the gate and pressed a button".

### 5.5 Prices, sales and discontinued products

- The game ships its own `merch.json`, made from `merch-catalog.json` by a developer script: `id, title, shelf, price, checkedOn, onSale, url, twin, retired`. The same script copies small thumbnails into the game folder. Thumbnails load only when a shelf is opened and are not in the service worker's precache list.
- A card shows "from $X, checked on <date>". If `checkedOn` is more than 30 days old the card drops the number and shows "See today's price on the shop page".
- The 2026-11-16 prices were sale prices for 53 of the 54 products; the Mountain Paw Pom-Pom Beanie (34460077) had no `was` price, so its `onSale` is false. While `onSale` is true the card says "sale price when checked". The catalogue's `was` price is never shown as a strike-through: the game cannot know it is still true, and it would read as pressure.
- When the owner schedules a store-wide discount, add one dated line to `merch.json` ("Shop sale, 20 to 27 November"). The game shows the dates as text. No timer.
- The script is run before every release and before and after every sale. It fails loudly if a product page is gone or a price moved. Players' browsers never run it.
- **Discontinued product:** set `retired: true`. The real card and the link disappear, so there is no dead link. The twin stays owned by everyone who has it and stays on sale for bones on a "Retired designs" shelf at the same price. It is never presented as rare. Claims for that product keep working with no end date.
- The leaving screen also links to the shop's home page, in case a product page has moved since the last release.

### 5.6 What cannot be done on the current store

- A fraud-proof link between a real order and a game save.
- A unique code per item or per order.
- A discount code for players, or a bundle of a real product with a game item at checkout.
- Checkout inside the game, or a prefilled cart.
- Live prices or stock in the game.
- Returns or exchanges for a buyer who changes their mind.
- Any knowledge in the game of whether a click became a sale, because the game has no analytics. Merch results are read from the Printify dashboard only.

---

## 6. Compliance checklist

Sources read 2026-11-16. "Reported" means I saw coverage, not the official text.

| # | Rule | Source | What the game does |
|---|---|---|---|
| 1 | No paid random rewards for children. The FTC's January 2025 settlement with a gacha publisher ($20 million) bars loot box sales to under-16s without parental consent and requires a direct dollar price. | [FTC business blog](https://ftc.gov/business-guidance/blog/2025/01/level-tips-businesses-ftcs-settlement-genshin-impact-developer-hoyoverse) | Sells nothing random. Every SKU and every gem item lists its exact contents. |
| 2 | Show the real-money price of things bought with a paid virtual currency. EU consumer authorities' key principles, 21 March 2025. Not binding, but it is how they read existing law. | [European Commission, CPC actions](https://commission.europa.eu/live-work-travel-eu/consumer-rights-and-complaints/enforcement-consumer-protection/coordinated-actions/social-media-online-games-and-search-engines_en), [Baker McKenzie summary](https://connectontech.bakermckenzie.com/european-consumer-protection-network-issues-new-key-principles-on-in-game-virtual-currencies-impact-for-gaming-and-gambling-entities-in-belgium-the-eu-and-beyond/) | Every gem price carries "about $X" at the smallest pack's rate. |
| 3 | Do not hide the cost behind layers of currency. Same principles. | as 2 | One paid currency. Gems cannot be converted to anything else. |
| 4 | Do not force buyers to buy more currency than they need. Same principles. | as 2 | Gem prices are multiples of 40 and the smallest pack is 80, so nothing is stranded. The four sets are also sold directly in dollars. |
| 5 | No charges without clear consent; no dark patterns; do not lock an account because someone disputed a charge. FTC order against a battle-royale publisher, $245 million. | [VGC report of the final order](https://videogameschronicle.com/news/epic-ordered-to-pay-245m-to-consumers-over-unwanted-fornite-purchases) | Two-step confirm on every spend, 10-minute Undo on gems, refunds for unused gems, and a save is never locked. |
| 6 | Children's privacy (COPPA). The amended rule took effect 23 June 2025 with full compliance due 22 April 2026. | [Hunton](https://www.hunton.com/privacy-and-cybersecurity-law-blog/coppa-rule-amendment-compliance-deadline-approaches), [Davis Polk](https://www.davispolk.com/insights/client-update/ftc-prioritizes-coppa-enforcement-new-compliance-obligations-take-effect) | Collects no personal information in play: no accounts, no analytics, no ads, no third-party requests. The install id is random, stays in the save and is sent only with a grown-up's purchase or claim. Have a lawyer confirm that this keeps the game outside the consent requirement. |
| 7 | Paid currency off by default for minors, and bans on paid loot boxes, pay-to-win and pay-to-progress in games aimed at them. EU Digital Fairness Act proposal, reported 10-11 November 2026. A proposal, not law; details may change. | [Massively Overpowered](https://massivelyop.com/2026/11/11/eu-digital-fairness-act-proposes-major-regulation-on-gaming-lockboxes-subscriptions-and-dark-patterns/), [gaming.net](https://www.gaming.net/european-commission-proposes-loot-box-and-virtual-currency-rules/) | Already designed this way: spending is off until a grown-up turns it on, and money buys no bones, stats or boosts. |
| 8 | EU 14-day right to withdraw from a digital purchase; commentary says it ends once the currency is used. | [Reed Smith Q&A](https://www.reedsmith.com/articles/qas-on-the-eu-consumer-protection-authorities-joint-guidance-paper/) | Unused gems are refunded on request within 14 days, everywhere. Lawyer to confirm the wording. |
| 9 | Auto-renewing sales need clear terms, express consent and simple cancellation (ROSCA and state laws). | [Steptoe](https://www.steptoe.com/en/news-publications/ftcs-click-to-cancel-rule-vacated-by-eighth-circuit.html) | No auto-renewing product is sold. Section 4.5 lists what is needed before one could be. |
| 10 | No fake urgency or false "was" prices. | Hard rule of this project; rows 2 and 5 | No timers, no countdowns, no "limited" labels, no strike-through prices. The only dates shown are real ones (winter shelf, a scheduled shop sale). |
| 11 | No advertising or tracking. | `ARCHITECTURE.md` | No ad or analytics code. Merch images are served from the game's own folder. Outbound links carry no referrer. |
| 12 | Grown-up gate before any purchase or outbound shop link. | Hard rule of this project | One gate function used everywhere money or an outside link is involved: the spending lock and spend cap settings, every cash screen, the real-product card and its leaving screen, the merch claim and restore. A gate of this kind is a deterrent, not verified parental consent; do not describe it as verification. |
| 13 | Tell people before sending them to a site that tracks. The store platform lets the owner add Google Analytics and a Meta Pixel. | [Printify help, marketing tools](https://help.printify.com/hc/en-us/articles/14813624741393-How-can-I-set-up-marketing-tools-for-my-Pop-Up-Store) (search summary) | The leaving screen says the shop is a separate site. If either tool is on, it says so; better, the owner keeps both off. |
| 14 | Merch buyers must know the terms: printed to order, no returns. | [Printify help](https://help.printify.com/hc/en-us/articles/12051129478417) (search summary), [Pop-Up Store terms](https://printify.com/terms-storefront-merchant/) | Every real-product card states it before the link. |
| 15 | Original names and art only. | `marketing/kc-open-trail/SETTING-BRIEF.md` | Item, set and shop names here are original. "Halloweentown", film elements, the city festival's branding, the Portland stag sign and the Portlandia statue are not used. The festival name is still to be chosen and searched. |
| 16 | Everything that affects play stays earnable free. | Hard rule of this project | Every ladder is bones-only. The only money-only items are three cosmetic sets (First Trail, Supporter, the Trail Journal pass column) and two tags ("Good Human", and `tag:real-gear` from a merch claim). |
| 17 | Card fees and tax. | [Stripe pricing](https://stripe.com/pricing) | Net figures use 2.9% + $0.30. `STRIPE_TAX=auto` with a digital-goods tax code on the `ot_` products. |

---

## 7. Revenue model

**These are estimates built from assumptions, not forecasts.** No benchmark exists for a self-hosted indie browser game with its own checkout. The payer rate and spend figures are from mobile games and are probably generous for the web. The merch click-through and conversion rates are my assumptions with no source. Merch profit is unknown because the margin on each product has not been verified; only merch sales are shown.

Formulae: payers = new players x payer rate. Gross = payers x spend. Stripe fees = 2.9% of gross + $0.30 x payers x purchases each. Merch orders = monthly players x click-through x conversion. Merch sales = orders x average order.

| | Conservative | Middle | Optimistic |
|---|---|---|---|
| New players a month | 500 | 3,000 | 15,000 |
| Share who ever pay | 0.5% | 1.0% | 2.0% |
| Average spend per payer | $6.00 | $7.26 | $10.00 |
| Purchases per payer | 1.2 | 1.5 | 2.0 |
| Payers a month | 2.5 | 30 | 300 |
| Gross from the game | $15.00 | $217.80 | $3,000.00 |
| Stripe fees | $1.34 | $19.82 | $267.00 |
| **Net from the game, before tax and hosting** | **$13.66** | **$197.98** | **$2,733.00** |
| Players active in the month | 600 | 4,000 | 20,000 |
| Share whose grown-up clicks through to the shop | 1% | 2% | 3% |
| Shop visits | 6 | 80 | 600 |
| Share of visits that order | 2% | 3% | 4% |
| Merch orders a month | 0.12 (about one every eight months) | 2.4 | 24 |
| Average order | $25 | $28 | $30 |
| **Merch sales a month (profit unknown)** | **$3.00** | **$67.20** | **$720.00** |

The $7.26 in the middle column is the casual-game spend per payer over 90 days from an AppsFlyer summary ([GameDev Reports](https://gamedevreports.substack.com/p/appsflyer-app-monetization-in-2026)). The verification step noted that the summary's own numbers do not fit together, so treat it as a rough guide.

Merch profit is merch sales times the margin. For each 10 points of margin, the three columns are worth $0.30, $6.72 and $72.00 a month. The owner can read the real margin per product in the Printify dashboard.

What would have to be true:

- **Conservative.** About 17 new players a day, from the merch customers and word of mouth. A working store and nothing else. Payers buy the starter once. This is the likely first few months.
- **Middle.** About 100 new players a day with no paid advertising, which means a steady outside source: a listing on a web game portal, a local news piece around the St. Helens setting, or a social following for the real dog. One in a hundred pays, and half of those buy a second thing (the journal pass or a set). The game must load in under about 10 seconds or most visitors never see the shop.
- **Optimistic.** About 500 new players a day, kept up for months. That needs repeated portal features or a clip that travels. Payer rate and spend at the top of the mobile range, on the web, with a grown-up gate in the way, would be unusual. Merch at this level means two dozen orders a month and real customer-service time.

Paid advertising does not work at these numbers: the research put the cost of buying one first-time purchaser at about $35 against about $7 of spend ([Xsolla](https://xsolla.com/blog/attracting-in-game-shopping-newbies)).

---

## 8. Build order and what needs the owner

### Stage 1: a complete bones game, no money

1. `economy.js`: one data table (`id, category, tier, bones, gems or null, requires, effect`), `grant / owns / catalog / setFlag / getFlag`, re-applying modifiers and cosmetics from the save at boot, `ECON_SCALE`.
2. `shop.js`: `registerTab`, two-step confirm, try-on preview, Undo, interactables at the tailor, pet supply, bakery, toys and market stalls.
3. Ladders 1-11 (abilities, gear, storage, camera) and the basic bones cosmetics.
4. KC's Den with the pay-later bar, den storage, decor placement, bakery treats.
5. Free gem sources, the daily sniff-outs and the Trail Journal free column.
6. The three ride tracks that need no hook (Pop Deck, Dry Box, Roof Rack).

Done when: a new player can earn, spend and see KC change, with the network tab showing no outside requests.

### Stage 2: the store and the merch shelves

1. Grown-up gate, spending lock and spend cap in `store.js`.
2. Worker: `OT_GRANTS`, `gems` in grants, return target, install-id check, Trail Key. Tests for claiming twice.
3. Store screens: five gem packs, `ot_starter`, the four packs, `ot_trail_pass` with the journal's second column, `ot_supporter`, restore, refund text.
4. Merch: the Printify API test; the sync script (`merch.json` and thumbnails); shelves, cards and the leaving screen; the 14 twins; `/ot/merch-claim` and the claim screen.

Done when: a test purchase in Stripe test mode grants once, survives a reload, restores on a second browser, and a merch link opens the right product page from behind the gate.

### Stage 3: depth, and only what earns its keep

1. Ride tuning (after the core hook), businesses with the Town Fund in the same release, trail markers.
2. Trail Buddies, then Buddy Whistle (after the follower question is settled).
3. Lantern Fund and festival costumes.
4. `ot_treat_3`, `ot_treat_10`, `ot_everything`, `ot_tip_3`.
5. Twins for the other 40 products.
6. Revisit, with real numbers: verified merch claims with a gem thank-you, gift codes, a membership.

### Needs the owner

1. **Stripe.** Create the 16 products and prices, add them to the `STRIPE_PRICES` secret, finish Stripe Tax settings with a digital-goods tax code. A SKU with no price id cannot be sold, which is also the way to hold one back.
2. **Deploy the worker changes** and say where the game is served from (same origin as the Dewclaw app or not).
3. **Decide the $0.99 pack.** Keep it as an exact top-up (a third goes to fees) or leave `ot_gems_80` unpriced and make 500 gems the smallest pack. If it is dropped, the "about $X" rate becomes 500 gems = $4.99.
4. **Run the Printify API test** (section 5.4) and report whether the Pop-Up Store and its orders are visible.
5. **Check the shop's Marketing settings** for Google Analytics and Meta Pixel. Turn them off, or tell me so the leaving screen can say they are on.
6. **Send one real order confirmation** (details removed) so the claim screen can check the order number's format.
7. **Verify merch margins** in the Printify dashboard. Until then merch profit is unknown.
8. **Support address and policy text**: refunds for unused gems within 14 days, how to ask for a manual merch claim, a privacy line.
9. **A lawyer**, once, covering: children's privacy with no accounts, the grown-up gate, EU and UK sales and the new EU proposal, refund wording, and tax on both Stripe and merch income.
10. **Pick the festival name** and have it trademark-searched.
11. **Check the merch artwork** against section 2 of `SETTING-BRIEF.md`. Only the titles were checked here.
12. **Ask the core builder for three hooks**: ride tuning, a dog follower, and a way for the photo screen to draw frames and stickers. Also agree the wider network rule in `ARCHITECTURE.md` for the claim and restore calls.
13. **Playtest for the real bones-per-hour figure** and set `ECON_SCALE`.
14. **Before each release or shop sale**, re-run the merch sync script.

### Sources

All read on 2026-11-16. Game and pricing research was gathered by the research step; rules and store links marked (S) were found by my own search today, and Printify help pages could be read only as search summaries.

- Animal Crossing house ladder: https://nookipedia.com/wiki/Player_house
- Stardew Valley tools, buildings, endgame: https://stardewvalleywiki.com/Tools , https://stardewvalleywiki.com/Carpenter%27s_Shop , https://stardewvalleywiki.com/Wizard%27s_Tower
- GTA Online: https://gta.wiki/w/Shark_Cards , https://gta.wiki/w/GTA%2B , https://gta.wiki/w/Apartments , https://gta.wiki/w/Nightclubs , https://gta.wiki/w/Bunker , https://gta.wiki/w/Los_Santos_Customs , https://gta.wiki/w/Daily_Objectives
- Red Dead Online: https://www.gtabase.com/red-dead-redemption-2/roles/trader-role , https://www.shacknews.com/article/119470/red-dead-online-outlaw-pass-no-3-ranks-and-rewards
- Forza Horizon 5 and Roblox: https://forza.net/fh5dlclist , https://create.roblox.com/docs/production/monetization/passes
- Retention and payer benchmarks: https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks , https://docs.crazygames.com/resources/basic-launch-metrics/ , https://gamedevreports.substack.com/p/appsflyer-app-monetization-in-2026 , https://gamedeveloper.com/business/report-whales-gobble-up-even-more-of-the-f2p-mobile-game-revenue-pie
- Pricing: https://www.gamesbrief.com/2014/09/premium-currency-pricing-trends-and-tricks/ , https://www.deconstructoroffun.com/blog/2024/4/8/free-to-play-starter-pack-pricing-when-conversion-is-king-we-may-price-too-low , https://www.deconstructoroffun.com/blog/2022/6/4/battle-passes-analysis , https://stripe.com/pricing
- Rules (S): https://ftc.gov/business-guidance/blog/2025/01/level-tips-businesses-ftcs-settlement-genshin-impact-developer-hoyoverse , https://commission.europa.eu/live-work-travel-eu/consumer-rights-and-complaints/enforcement-consumer-protection/coordinated-actions/social-media-online-games-and-search-engines_en , https://www.reedsmith.com/articles/qas-on-the-eu-consumer-protection-authorities-joint-guidance-paper/ , https://videogameschronicle.com/news/epic-ordered-to-pay-245m-to-consumers-over-unwanted-fornite-purchases , https://www.hunton.com/privacy-and-cybersecurity-law-blog/coppa-rule-amendment-compliance-deadline-approaches , https://www.steptoe.com/en/news-publications/ftcs-click-to-cancel-rule-vacated-by-eighth-circuit.html , https://massivelyop.com/2026/11/11/eu-digital-fairness-act-proposes-major-regulation-on-gaming-lockboxes-subscriptions-and-dark-patterns/ , https://www.gaming.net/european-commission-proposes-loot-box-and-virtual-currency-rules/
- Store (S): https://help.printify.com/hc/en-us/articles/12051129478417 , https://help.printify.com/hc/en-us/articles/25028388602897-How-do-discounts-work-for-Pop-Up-Store , https://help.printify.com/hc/en-us/articles/14813624741393-How-can-I-set-up-marketing-tools-for-my-Pop-Up-Store , https://printify.com/terms-storefront-merchant/ , https://developers.printify.com/
