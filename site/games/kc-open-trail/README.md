# KC: Open Trail

A free-roam 3D dog adventure. You are KC (she is a real dog), loose in a
stylised St. Helens, Oregon: the riverfront old town and courthouse plaza, the
docks and Sand Island on the Columbia, parks and a quarry, then Highway 30
south-east past Scappoose and Sauvie Island's farms to a compact Portland with
the St. Johns Bridge, the car-free Tilikum Crossing with a little tram, a
riverside park, Forest Park trails, a brick market square, food carts and dog
parks. Snow-capped volcanoes sit on the horizon.
Original game; plain HTML/CSS/JS, no build step.

Served at `/games/kc-open-trail/`. The world is procedural: geometry and
textures are built in code and all sound is WebAudio synthesis. No CDN, no
fonts, no analytics, no ads, no tracking. As shipped the game makes no network
call outside its own folder (the real-money store is switched off by
placeholder config; see "Money" below). Works offline after the first visit
(service worker + manifest).

The setting follows `marketing/kc-open-trail/SETTING-BRIEF.md`. Real public
places keep their names; every private business is an invented stand-in; the
autumn event is the game's own "Fog Bell Festival" with an original
centrepiece, the Lantern Stack. Nothing from any film is used.

## Run it

```sh
cd site/games/kc-open-trail && python3 -m http.server 8931
# open http://localhost:8931/
```

ES modules need http(s); opening `index.html` from disk will not work.
`?q=low|medium|high` forces a quality level, `?nosw` skips the service worker,
`?debug=1` adds the debug hooks. `?debug=1&mock=1` together also give the
store a pretend payment page for tests, but only when the game is served from
`localhost` or `127.0.0.1`: on any other host the two words do nothing.

## Controls

| | Keyboard / mouse | Touch | Gamepad |
| --- | --- | --- | --- |
| Move | W A S D or arrows | left thumb stick (anywhere on the left half) | left stick |
| Look | drag with the mouse, wheel to zoom, Q / E | drag on the other half; pinch with two fingers to zoom | right stick |
| Zoomies (sprint, uses stamina) | Shift | Zoom (hold) | right trigger / bumper |
| Jump (ollie on a skateboard) | Space | Jump | A |
| Paw: sniff, pick up, talk, hop on / off | F or Enter | Paw, or tap the prompt | X |
| Bark / Sit / Dig / Shake | B / C / G / X | buttons | B / Y / d-pad down / d-pad up |
| Map / Photo mode / Pause | M / K / Esc or P | HUD buttons | Back / LB / Start |

Settings: graphics quality (with automatic step-down), mute, sound and music
volume, invert camera, left-handed touch layout, rain, and the Fog Bell
Festival dressing. A mute button sits in the HUD.

## What is in the core

- World (1000 x 1000 units): heightfield terrain with collision, the Columbia,
  the Multnomah Channel and the Willamette to swim or paddle, three lakes,
  Sand Island, painted roads / trails / fields, about 100 buildings, four
  bridges you can cross (St. Johns, Hawthorne, Wapato and the car-free
  Tilikum Crossing), a railway beside Highway 30 with level crossings, instanced trees / rocks / bushes / flowers, a
  day-night cycle, light rain, 42 named districts shown on the HUD and maps.
- KC: walk, run, sprint with a stamina bar, jump, swim, sit, bark, dig, shake,
  carry things in her mouth. Collision with buildings, props and water. A
  follow camera with mouse / touch look that shortens instead of clipping.
- Life: about 75 townspeople on walking routes with talk prompts (they chat,
  wave and pet her), ten other dogs that play, birds / ducks / squirrels /
  chickens / sheep that scatter, polite traffic that stops and honks.
- Rides: skateboards (anywhere dry, ollie), canoes (water only), camper vans
  (roads; they crawl on grass). One button in, same button out. A ride stays
  where it was left (saved). The Heron Line tram (an invented two-stop line)
  shuttles over Tilikum Crossing and KC can board it at either stop; a freight
  train in an invented livery shuttles along the Highway 30 line. Both stop
  for anyone on the track.
- Things to find: bones (respawn), 36 golden tennis balls, 32 dig spots,
  16 photo spots, 36 signposts, the Old Fog Bell to ring, free treat samples,
  KC's orange-and-blue ball (drop it by a person and they throw it).
- Festival layer, off by default: `game.economy.setFlag('festival', true)` or
  the Settings checkbox.
- HUD: minimap with district names and markers, compass, objective pointer,
  wallet (bones, gems), stamina, prompts, toasts, pause menu, settings, help,
  world map, photo mode (saves a PNG).
- Save: localStorage, versioned (`kc-open-trail-save-v2`), tolerant of damaged
  data, every access wrapped in try/catch.

## What the modules add

Seven modules sit on the core (`js/main.js` boots them in this order). The
contract between them and the core, and each module's public API, are in
`ARCHITECTURE.md` ("Module seams" and "The feature modules as built").

- **Economy and upgrades** (`economy.js`, `upgrades.js`): 30 upgrade ladders
  bought with bones (KC's abilities, gear, storage, the Trail Camera, parts
  for the three rides), KC's Den in six stages a short walk from the spawn
  (pay-later bar, nap, bone bowl, decor with a full refund), ten Trail
  Buddies and the Buddy Whistle, three small businesses whose tills fill only
  while the game is played, the Lantern Fund, the Town Fund and eight Trail
  Markers. Bones cosmetics, bakery treats, and gem cosmetics that always
  carry a bones price too. Every price is multiplied by one constant,
  `ECON_SCALE` in `economy.js` (1.0). It is the price knob only: mission
  pay, tills, digs and loose bones do not move with it.
- **Income** (measured with bots, see the notes at the top of `economy.js`
  and in `missions.js`): bots that do one thing and nothing else earned far
  more than spec 3.1 plans, so the sources are throttled: a loose bone comes
  back after 50 to 60 minutes, a dig spot rests 30 minutes, fetch pays for
  the first 6 fetches in any 10 minutes of play, Pop Deck pays only on the
  move and at most 30 times in 10 minutes, and a finished mission pays its
  job rate in full once in every 40 minutes of play (one extra run in
  between pays a tenth, more pay 1 bone; a nap or a new game day does not
  bring it round sooner). Re-measured with the same bots after the throttles (simulated time, a
  bot that walks straight at its target, so an upper bound): one short job
  replayed back to back pays about 290 to 370 bones an hour (it was 4,200
  to 4,700); the 16 jobs in a loop about 1,300 an hour; dig spots alone
  about 300 an hour on a fresh save and about 1,100 with the full late kit
  and Lucky Jerky; fetch about 100 to 150 an hour from fetching itself.
  Still above the spec's plan and left as it is: the first sweep of a new
  map (770 loose bones, one-time finds, Trail Journal steps and the 1,800
  bones of first-time mission pay) gave a bot 1,900 to 2,500 bones an hour
  for its first 40 minutes. None of it has been measured with children; if
  income is still off, raise `ECON_SCALE` (prices) or the windows above,
  not single prices.
- **Shop** (`shop.js` and the tabs other modules register): nine tabs on one
  screen: Upgrades, Wardrobe, Rides, Den & Buddies, Businesses, Town, Trail
  Journal, KC Gear, Store. It opens from the pause menu and from prompts at
  ten shop doors and market stalls. Two-step confirm on every spend.
- **Missions** (`missions.js`, `activities.js`): 16 story missions with a
  giver on the map, 8 Fog Bell Festival activities (only while the festival
  is on), a journal in the pause menu, three weekly trail tasks and the Sand
  Island ferry. Bones only; failing costs nothing.
- **First steps** (`guide.js`): a new player is pointed at the first job
  (Clockkeeper Odile on the plaza, 50 bones), then at Tailwind Pet Supply for
  a first upgrade (Super Sniffer, 80 bones), then left alone.
- **Store** (`store.js`, `store-config.js`): the real-money catalogue (16
  items, prices always shown in dollars), a device spending limit, a purchase
  journal, restore by Trail Key, and the Trail Journal (30 steps earned by
  play: a free column and a paid cosmetic column).
- **KC Gear** (`merch.js`, `merch.json`, `img/merch/`): shelves in the world
  with 14 in-game twins of real KC Beyond Limits products, bought with bones.
  Behind the grown-up gate: the 54 real products with local thumbnails and a
  "You are leaving the game" screen before the shop page opens in a new tab.

## Money

- Real-money spending is **off** until a grown-up turns it on in Settings,
  behind the grown-up gate. The gate is asked again before every purchase,
  before restore, and before any link that leaves the game.
- Money never buys bones or anything that changes how KC plays. It buys gems
  (cosmetics only) and cosmetic sets. Everything that affects play is earned
  with bones. Nothing is random, nothing has a countdown.
- **Two channels.** On the web the store sells through Stripe. Inside the
  Google Play app (`?src=play`, see `js/channel.js`) Stripe is never used or
  mentioned, because Google Play requires its own billing for digital goods.
  There the store is absent (`PLAY_BILLING = 'off'`, the default) or sells
  the same 16 items through Google Play Billing (`'on'`), with prices read
  from Google Play. The real-gear shelf (physical products on a separate
  shop) is the same in both, behind the switch and the gate.
- **Nothing is live.** `js/store-config.js` holds placeholders, so every
  store item says "Coming soon" and no checkout can start. The owner's
  steps (Stripe products, worker settings, wording for a lawyer) are in
  `marketing/kc-open-trail/MONETIZATION.md`. The worker side is
  `worker/dewclaw-worker.js`, tested by `worker/test.js`.
- The merch claim ("bought the real one, get the twin") is local and on
  trust; no order number is stored or sent.
- Before each release and around each shop sale, refresh the product list:
  `node tools/sync-merch.js --live --accept` (`--check` verifies it).

## The Google Play app

The Play app is a Trusted Web Activity: an Android shell that opens this
same folder full screen. What it needs from the game is already here:

- Start URL `/games/kc-open-trail/?src=play`. That query is how the game
  knows it is the Play app; without it the app would behave like the web
  and offer Stripe, which Google Play does not allow.
- `manifest.webmanifest` (name, icons including a maskable one, fullscreen,
  any orientation, colours) and `sw.js` (the game starts with no network).
- The game's own package name and its two SHA-256 fingerprints (upload key
  and Play app signing key) in `site/.well-known/assetlinks.json`.
- A privacy policy inside the app: Settings, "Privacy policy", which opens
  `/kc-open-trail/privacy.html` on the same site.

As shipped the Play app sells nothing (`PLAY_BILLING = 'off'`): no store, no
prices, no ads, no accounts, no requests to anyone. To sell there later:
create the 16 products in Play Console with ids equal to the `ot_` names in
`js/store-config.js`, set `OT_PLAY_PACKAGE` and the Google service account on
the worker, fill in `WORKER_URL`, then set `PLAY_BILLING = 'on'`. The details
are in ARCHITECTURE.md, "Channels" and "`game.modules.store`".

To see the Play channel on a computer: `http://localhost:8931/?src=play`
(the store is absent). With `?src=play&debug=1&mock=1` the store is there,
but an ordinary browser has no Google Play in it, so every item says
"Coming soon"; `tests/play.test.js` puts a pretend Google Play in the page.
Close the tab to go back to the web channel.

## Files

```
index.html, style.css      page shell, HUD markup, UI styles
sw.js, manifest.webmanifest, icons/   offline shell + install metadata
vendor/three/              three.js r170 (0.170.0) module build + licence
js/main.js                 boot, loop, quality, debug hooks
js/data.js                 all world data (rivers, roads, buildings, districts, collectibles ...)
js/world.js                terrain, water, colliders, districts, sky, weather, horizon peaks, festival fog
js/scenery.js              buildings, bridges, props (baked chunk meshes), sign atlas, festival layer
js/flora.js                instanced trees, rocks, bushes, flowers
js/kc.js                   dog model, animation, player controller, cosmetics
js/camera.js, js/input.js  follow camera; keyboard / mouse / touch / gamepad
js/npc.js                  people (with chat), dogs, wildlife, followers, standing NPCs
js/vehicles.js             traffic, rideables (with per-kind tuning), the freight train and the tram
js/collect.js              bones, golden balls, dig / photo spots, signposts, fog bell, carriables
js/api.js                  registry: interactables, markers, zones, wallet, economy + shop seams
js/hud.js                  HUD, modal shell, menus, shop shell, map, photo mode
js/uikit.js                shared screen pieces: tab strip, item cards, grown-up gate, confirm-spend, leaving links, extra settings
js/photo.js                photo mode frames, filters, stickers, zoom and poses (game.photo)
js/seams.js                module seams: cosmetics by id, world placement, staged objects, timed runs, fast travel, followers
js/audio.js, js/fx.js      synthesised sound; particles + blob shadows
js/events.js, js/save.js, js/util.js   bus, save, helpers + geometry builder
js/economy.js              price table: ladders, items, ECON_SCALE, free gems, daily sniff-outs (extends game.economy)
js/upgrades.js             what the ladders do: den, buddies, businesses, funds, trail markers
js/shop.js                 six Shop tabs and the shop-door prompts
js/missions.js, js/activities.js   story missions, festival activities, journal, weekly tasks, ferry
js/channel.js              'play' (the Google Play app) or 'web'; sets game.channel
js/store.js, js/store-config.js    real-money store (Stripe on the web, Google Play Billing in the Play app), Trail Journal; the config is placeholders until the owner fills it in
js/merch.js                KC shelves, twins, real products behind the gate, leaving screen, claim
js/guide.js                first steps for a new player
css/economy.css, css/missions.css, css/store.css, css/merch.css   the modules' styles (each injected by its module)
merch.json, img/merch/     the 54 real products and their 240 px thumbnails (made by tools/sync-merch.js)
tools/make-icons.js        regenerates icons/ (dev only, needs Playwright)
tools/sync-merch.js        rebuilds merch.json and the thumbnails from the shop (owner tool, run by hand)
tests/smoke.js             the single test entry point (Playwright); also runs the suites below
tests/economy.test.js, tests/missions.test.js, tests/store.test.js, tests/merch.test.js, tests/play.test.js   the module suites
```

When you change any shipped file, bump `VERSION` in `sw.js`
(`kc-open-trail-vN`) and keep its `SHELL` list in step with the real files
(the smoke test checks `js/`, `css/`, `merch.json` and the icons against it).
The thumbnails in `img/merch/` are left out of `SHELL` on purpose: they load
only when a grown-up opens the real-gear list, and the service worker keeps
each one from then on.

## Test

```sh
cd site/games/kc-open-trail
for f in js/*.js sw.js tests/*.js tools/*.js; do node --check "$f"; done
NODE_PATH=$(npm root -g) node tests/smoke.js /tmp/kc-shots
```

`tests/smoke.js` is the one command. It starts its own static server (port
8947, `PORT=` to change) and runs, in order:

1. **Static checks**: the service worker file list, the do-not-copy name
   scan over every shipped file, no network calls outside `store.js` /
   `merch.js`, the module imports.
2. **Core seams, modules stubbed**: at 390x844 and 844x390 with touch and at
   1280x720 with mouse and keys, every hook in "Module seams" is exercised
   with the seven module files replaced by empty ones, so the core's
   contract is tested on its own.
3. **The whole game, all modules live**, in the same three viewports: loads,
   the first-steps pointer, HUD and thumb controls, walking / sprinting /
   jumping / swimming, the district tour, the rides, the festival layer, then
   the integrated flow: first job pays the real wallet, the pet supply door
   opens the Shop, the first upgrade is bought by tapping, all nine Shop tabs
   fit a phone with 44 px targets, a mission in progress on the HUD, KC's Den,
   the Biscuit Cart handed over by the last story mission and its till, every
   store grant / journal reward / twin resolving to a real item, a twin on
   KC's head, the real-product cards and the leaving screen behind the switch
   and the gate, pause / settings / map, frame time, save and reload.
4. A damaged save, "Start over", and the offline reload from the service worker.
5. **The suites**, each as its own process: `tests/economy.test.js`,
   `tests/missions.test.js`, `tests/store.test.js`, `tests/merch.test.js`,
   `tests/play.test.js` (both channels, Google Play faked in the page) and
   `worker/test.js`. Each can also be run by itself the same way.

It fails on any console error or off-origin request. Screenshots go to the
folder given as the first argument (the suites write into sub-folders of it).
Exit code is non-zero if anything fails. Switches: `SEAMS_ONLY=1` (step 1 and
2), `LIVE_ONLY=1` (skip step 2), `SKIP_SUITES=1` (skip step 5),
`VIEWPORTS=phone-portrait,desktop` (only those viewports, no suites). The
full run takes about 20 to 25 minutes here in software rendering.

Headless Chromium draws WebGL in software, so the frame times it prints are
only a guard against regressions; they say nothing about real phones.
