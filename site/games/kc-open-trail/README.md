# KC: Open Trail

A free-roam 3D dog adventure. You are KC, exploring Cedar Hollow: a small town
with a main street and a park, a river with a bridge and a dock, an evergreen
forest with a campground, a lake and beach, a farm, and a mountain trail up to
a lookout. Original game, original world; plain HTML/CSS/JS, no build step.

Served at `/games/kc-open-trail/`. Everything is procedural: geometry and
textures are built in code and all sound is WebAudio synthesis. No CDN, no
fonts, no analytics, no ads. Works offline after the first visit.

## Run it

```sh
cd site && python3 -m http.server 8931
# open http://localhost:8931/games/kc-open-trail/
```

ES modules need http(s); opening `index.html` from disk will not work.
`?q=low|medium|high` forces a quality level, `?nosw` skips the service worker,
`?debug=1` adds the debug hooks.

## Controls

| | Keyboard / mouse | Touch | Gamepad |
| --- | --- | --- | --- |
| Move | W A S D or arrows | left thumb stick (anywhere on the left half) | left stick |
| Look | drag with the mouse, wheel to zoom, Q / E | drag on the other half | right stick |
| Zoomies (sprint) | Shift | Zoom (hold) | right trigger / bumper |
| Jump (ollie on a skateboard) | Space | Jump | A |
| Paw: sniff, pick up, say hi, hop on / off | F or Enter | Paw, or tap the prompt | X |
| Bark / Sit / Dig / Shake | B / C / G / X | buttons | B / Y / d-pad down / d-pad up |
| Map / Photo mode / Pause | M / K / Esc or P | HUD buttons | Back / LB / Start |

Settings: graphics quality (with automatic step-down), sound, music, invert
camera, left-handed touch layout, rain, and a spooky-season town toggle (off
by default).

## What is in the core

- World "Cedar Hollow" (600 x 600 units): heightfield terrain, river and lake,
  painted roads and trails, ~40 buildings and landmarks with made-up names,
  instanced trees / rocks / bushes / flowers, day-night cycle, light rain.
- KC: walk, run, sprint with a stamina bar, jump, swim, sit, bark, dig, shake,
  carry things in her mouth. Collision with buildings, props and water.
- Life: pedestrians who wave and pet her (sit next to one), five other dogs
  that play, birds / ducks / squirrels / chickens / sheep that scatter, slow
  traffic that always stops and honks rather than bump anyone.
- Rides: two skateboards, two canoes, two camper vans (her human drives, KC
  rides shotgun, you steer). One button in, same button out.
- Things to find: bones (respawn), 24 golden tennis balls, 20 dig spots,
  10 photo spots, 12 signposts, sausages (mischief!), KC's orange-and-blue ball
  (drop it by a person and they throw it).
- Mischief meter (0-3 paw prints) and a friendly ranger who jogs after KC with
  a leash; getting caught costs a few bones and resets her to the station.
- HUD: minimap, compass, objective pointer, wallet (bones, gems), stamina,
  toasts, pause menu, settings, world map, photo mode (saves a PNG).

Missions, the economy, the shop and real-money purchases are separate modules
(`js/missions.js`, `js/economy.js`, `js/shop.js`, `js/store.js`); they are stubs
here. **Read `ARCHITECTURE.md`** for the event list and the registry API.

## Files

```
index.html, style.css      page shell, HUD markup, UI styles
sw.js, manifest.webmanifest, icons/   offline shell + install metadata
vendor/three/              three.js r170 (0.170.0) module build + licence
js/main.js                 boot, loop, quality, debug hooks
js/data.js                 all world data (roads, buildings, collectibles ...)
js/world.js                terrain, water, colliders, zones, sky, weather
js/scenery.js              buildings + props (baked chunk meshes), sign atlas
js/flora.js                instanced trees, rocks, bushes, flowers
js/kc.js                   dog model, animation, player controller, cosmetics
js/camera.js, js/input.js  follow camera; keyboard / mouse / touch / gamepad
js/npc.js                  people, dogs, critters, ranger + mischief
js/vehicles.js             traffic and rideables
js/collect.js              bones, golden balls, dig / photo spots, carriables
js/api.js                  registry: interactables, markers, zones, wallet
js/hud.js                  HUD, modal shell, menus, map, photo mode
js/audio.js, js/fx.js      synthesised sound; particles + blob shadows
js/events.js, js/save.js, js/util.js   bus, save, helpers + geometry builder
tools/make-icons.js        regenerates icons/ (dev only, needs Playwright)
tests/smoke.js             Playwright smoke test
```

When you change any shipped file, bump `VERSION` in `sw.js`
(`kc-open-trail-vN`) and add new files to its `SHELL` list.

## Debug hooks (`?debug=1` only)

`window.__ot`: `state()`, `start()`, `teleport(x, z, yaw)`, `give({ bones, gems })`,
`setTime(h)`, `setRain(0..1)`, `setQuality(q)`, `setCam(yaw, pitch, dist)`,
`step(n, dt)` (run n simulation steps now), `info()` (draw calls, triangles),
`press(action)`, `hold(keyCode, down)`, `mischief(n)`, `clearMischief()`,
`enter(rideId)`, `exit()`, `rides()`, `save()`, `startMission(id)`,
`completeMission()` (delegate to `game.modules.missions` when it provides
`start` / `complete`), `emit(type, data)`, `events` (recent bus events),
`game` (everything). None of this exists without the flag.

## Test

```sh
cd site/games/kc-open-trail
NODE_PATH=/opt/node-tools/node_modules node tests/smoke.js
```

It starts its own static server (port 8947, `PORT=` to change), then checks:
load without console errors, keyboard and touch movement, mouse and touch
camera, every rideable in and out, pause, save / reload, damaged saves,
offline reload through the service worker, HUD layout at 360x640 and 844x390,
and that no request leaves the origin. Headless Chromium draws WebGL in
software, so it says nothing about frame rate on real hardware.
