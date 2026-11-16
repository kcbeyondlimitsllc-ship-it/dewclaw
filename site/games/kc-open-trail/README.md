# KC: Open Trail

A free-roam 3D dog adventure. You are KC (she is a real dog), loose in a
stylised St. Helens, Oregon: the riverfront old town and courthouse plaza, the
docks and Sand Island on the Columbia, parks and a quarry, then Highway 30
south-east past Scappoose and Sauvie Island's farms to a compact Portland with
the St. Johns Bridge, a riverside park, Forest Park trails, a brick market
square, food carts and dog parks. Snow-capped volcanoes sit on the horizon.
Original game; plain HTML/CSS/JS, no build step.

Served at `/games/kc-open-trail/`. Everything is procedural: geometry and
textures are built in code and all sound is WebAudio synthesis. No CDN, no
fonts, no analytics, no ads, no network calls. Works offline after the first
visit (service worker + manifest).

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
`?debug=1` adds the debug hooks.

## Controls

| | Keyboard / mouse | Touch | Gamepad |
| --- | --- | --- | --- |
| Move | W A S D or arrows | left thumb stick (anywhere on the left half) | left stick |
| Look | drag with the mouse, wheel to zoom, Q / E | drag on the other half | right stick |
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
  Sand Island, painted roads / trails / fields, about 100 buildings, three
  bridges you can cross, instanced trees / rocks / bushes / flowers, a
  day-night cycle, light rain, 38 named districts shown on the HUD and maps.
- KC: walk, run, sprint with a stamina bar, jump, swim, sit, bark, dig, shake,
  carry things in her mouth. Collision with buildings, props and water. A
  follow camera with mouse / touch look that shortens instead of clipping.
- Life: about 75 townspeople on walking routes with talk prompts (they chat,
  wave and pet her), ten other dogs that play, birds / ducks / squirrels /
  chickens / sheep that scatter, polite traffic that stops and honks.
- Rides: skateboards (anywhere dry, ollie), canoes (water only), camper vans
  (roads; they crawl on grass). One button in, same button out.
- Things to find: bones (respawn), 36 golden tennis balls, 32 dig spots,
  16 photo spots, 34 signposts, the Old Fog Bell to ring, free treat samples,
  KC's orange-and-blue ball (drop it by a person and they throw it).
- Festival layer, off by default: `game.economy.setFlag('festival', true)` or
  the Settings checkbox.
- HUD: minimap with district names and markers, compass, objective pointer,
  wallet (bones, gems), stamina, prompts, toasts, pause menu, settings, help,
  world map, photo mode (saves a PNG).
- Save: localStorage, versioned (`kc-open-trail-save-v2`), tolerant of damaged
  data, every access wrapped in try/catch.

Missions, the economy, the shop and real-money purchases are separate modules
(`js/missions.js`, `js/economy.js`, `js/shop.js`, `js/store.js`); they are
deliberate stubs here. **Read `ARCHITECTURE.md`** for the seams
(`game.economy.grant / owns / catalog / setFlag / getFlag`,
`game.shop.registerTab`), the event list and the registry API.

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
js/npc.js                  people (with chat), dogs, wildlife
js/vehicles.js             traffic and rideables
js/collect.js              bones, golden balls, dig / photo spots, signposts, fog bell, carriables
js/api.js                  registry: interactables, markers, zones, wallet, economy + shop seams
js/hud.js                  HUD, modal shell, menus, shop shell, map, photo mode
js/audio.js, js/fx.js      synthesised sound; particles + blob shadows
js/events.js, js/save.js, js/util.js   bus, save, helpers + geometry builder
js/economy.js, js/missions.js, js/shop.js, js/store.js   stubs for later modules
tools/make-icons.js        regenerates icons/ (dev only, needs Playwright)
tests/smoke.js             Playwright smoke test
```

When you change any shipped file, bump `VERSION` in `sw.js`
(`kc-open-trail-vN`) and keep its `SHELL` list in step with the real files
(the smoke test checks the list).

## Test

```sh
cd site/games/kc-open-trail
for f in js/*.js sw.js tests/smoke.js; do node --check "$f"; done
NODE_PATH=$(npm root -g) node tests/smoke.js /tmp/kc-shots
```

The test starts its own static server (port 8947, `PORT=` to change) and, at
390x844 and 844x390 with touch and at 1280x720 with mouse and keys: loads,
starts play, checks the HUD and thumb controls fit, walks / sprints / jumps /
swims, tours the districts, rides the skateboard, canoe and van, swings the
camera against walls, talks to a townsperson, exercises the economy, shop and
festival seams, pauses, saves and reloads, measures frame time, and fails on
any console error or off-origin request. It also checks a damaged save, the
offline reload and the service worker file list. Screenshots go to the folder
given as the first argument. Exit code is non-zero if anything fails.

Headless Chromium draws WebGL in software, so the frame times it prints are
only a guard against regressions; they say nothing about real phones.
