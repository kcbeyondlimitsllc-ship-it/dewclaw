# KC: Open Trail: architecture and extension seams

Plain ES modules, no build step. three.js r170 is vendored in `vendor/three/`.
Everything visible is built in code (low-poly geometry + canvas textures) and
all sound is WebAudio synthesis. The only network traffic is same-origin game
files; the store module (when it exists) may call the Dewclaw worker after the
player presses a real-money Buy button, and nothing else may leave the origin.

## Boot order (`js/main.js`)

`save` -> `input` -> `audio` -> `fx` -> `world` (terrain, `scenery`, `flora`) ->
`camera` -> `api` (registry, wallet, **economy and shop seams**) -> `hud` (`game.ui`) -> `kc` -> `npc`
(people, dogs, wildlife) -> `vehicles` -> `collect` ->
**`economy.init(game)`, `missions.init(game)`, `shop.init(game)`, `store.init(game)`**.

`economy.js`, `missions.js`, `shop.js` and `store.js` are deliberate stubs: each
exports `init(game)` and whatever `init` returns is kept at `game.modules.<name>`.
They are for later work; the core does not build an economy, missions, a shop
or payments. What the core does provide is the seam they plug into (next section). The debug hooks call
`game.modules.missions.start(id)` and `.complete()` if they exist.

## The seams the stub modules build on

These exist before the four `init` calls run. A module may use them as they are,
wrap them, or replace individual methods (keep the signatures).

```js
/* economy seam (js/api.js). Every core payout already goes through grant(). */
game.economy.grant({ bones: 5, gems: 1, items: ['bandana-red', { id: 'treat', n: 3 }] }, 'source')
        // -> { bones, gems, items } actually granted; pays the wallet (emits `wallet`), marks items in state.owned, emits `grant`
game.economy.owns(id)                 // -> boolean (state.owned[id])
game.economy.catalog                  // [] for the economy module to fill with its item / upgrade definitions
game.economy.setFlag(key, value)      // saved in state.flags, emits `flag` { key, value }
game.economy.getFlag(key)

/* shop seam (js/api.js + the Shop shell in js/hud.js) */
game.shop.registerTab({ id, title, render(body, game, handle), badge })   // -> unregister function. badge: value or () => value
game.shop.tabs                        // registered tabs
game.shop.open(tabId?)                // opens the Shop screen; a "Shop" entry appears in the pause menu once a tab exists
```

Flags the core reacts to:

| Flag | Effect |
| --- | --- |
| `festival` | `true` switches on the Fog Bell Festival dressing layer (lantern strings, bunting, painted pumpkins, the lit Lantern Stack, a festival arch) and pulls the fog in; `false` removes it. Also a checkbox in Settings. |
| `coached` | set by the HUD once a touch player has both moved and looked; the first-run touch coach stays hidden after that. |

Edge cases the seams guarantee (so modules need not re-check):

- `wallet.add(cur, n)` ignores an unknown currency and a non-finite or zero
  `n`, rounds, and never lets a balance go below 0.
  `wallet.spend(cur, n)` returns `false` for a non-finite or negative `n` or
  when the balance is short; `spend(cur, 0)` is `true` and changes nothing.
- `grant(what)` treats `null` / a non-object as `{}`. `items` may be one id, one
  `{ id, n }` or an array of either. `n` is coerced with `Number` and floored;
  entries with a missing id or `n < 1` are skipped. An owned count is always
  `true` or a positive integer.
- `registerTab()` replaces a tab with the same id. Its unregister function
  removes the tab from `game.shop.tabs` in place (the array object never
  changes). `ui.addMenuItem()` likewise returns a working unregister function
  and replaces an entry with the same id.
- `spawnProp(...).remove()` and `addCarriable(...).remove()` take everything
  with them: meshes, GPU geometry, colliders, camera view volumes and any
  per-frame animation (the campfire flame). Calling `remove()` twice is safe.

The HUD wallet pill (bones, gems) redraws on every `wallet` event, so anything
paid through `grant()` or `game.wallet` shows up at once.

Debug hooks (only with `?debug=1`, on `window.__ot`): `state()`, `start()`,
`teleport(x, z, yaw)`, `give({ bones, gems, items })`, `grant(what, source)`,
`setFlag(key, value)`, `festival(on)`, `setTime(h)`, `setRain(0..1)`,
`setQuality(q)`, `setCam(yaw, pitch, dist)`, `step(n, dt)`, `info()`,
`frameStats()` / `resetFrameStats()`, `press(action)`, `hold(keyCode, down)`,
`enter(rideId)`, `exit()`, `rides()`, `transit()` (train and tram), `districts()`, `zoneAt(x, z)`,
`surfaceAt(x, z)`, `heightAt(x, z)`, `save()`, `startMission(id)` and
`completeMission()` (these two call `game.modules.missions.start / .complete`
when the missions module provides them), `emit(type, data)`, `events` (recent
bus events) and `game`.

## The `game` object

| Field | What it is |
| --- | --- |
| `game.bus`, `game.on(type, fn)`, `game.off`, `game.emit(type, data)` | event bus; `on` returns an unsubscribe function; `'*'` hears everything |
| `game.state` | the saved state object (below). Mutate it, it is saved every 20 s, on pause, on tab hide |
| `game.wallet` | `get(cur)`, `can(cur, n)`, `add(cur, n, reason)`, `spend(cur, n, reason)` -> boolean. `cur` is `'bones'` or `'gems'`. Emits `wallet` |
| `game.rewards` | tunable payouts: `{ bone: 1, goldenBall: { gems: 1, bones: 10 }, dig: [3, 8], photo: 5, sign: 2, fetch: 2, zone: 3 }`. Change values in `economy.init` |
| `game.kc` | KC: `pos` (THREE.Vector3), `yaw`, `speed`, `stamina`, `staminaMax`, `ride`, `carried`, `mods`, `base` (walk/run/sprint/jump/drain/regen/magnet), `teleport(x, z, yaw)`, `doBark/doSit/doDig/doShake()`, `carry(item)`, `drop()`, `isCarrying(kind)` |
| `game.world` | `heightAt(x, z)`, `groundAt(x, z, y)`, `surfaceAt(x, z)` (0 grass, 1 road, 2 trail / gravel, 3 sand, 4 water, 5 paving), `zoneAt(x, z)`, `waterDepth`, `riverSd(x, z, id?)` (signed distance to a river bank), `roadDist(id, x, z)`, `blockedAt(x, z, y, r)`, `addBox/addCircle` colliders, `roads`, `time` (0-24), `day`, `night` (0-1), `rain`, `setTime`, `setRain`, `festival`, `setFestival(on)`, `mapCanvas`, `stack` (Lantern Stack position), `fogBell` |
| `game.cam` | `yaw`, `pitch`, `dist`, `three` (the PerspectiveCamera) |
| `game.npcs` | `peds`, `dogs`, `groups` (wildlife), `addPed(route, look, name)` |
| `game.economy`, `game.shop` | the seams above |
| `game.vehicles` | `rides`, `cars`, `enter(id)` (a ride id or `'tram'`), `exit()`, `byId(id)`, `reset(id)`, `setSkin(kind, { primary, secondary })`, `transit` = `[train, tram]` (each has `x`, `z`, `speed`, `dir`, `wait`), `train`, `tram` |
| `game.collect` | bones, golden balls, dig spots, carriables; `counts()` |
| `game.ui` | HUD + modal shell (below) |
| `game.audio` | `sfx(name)`: pickup, gold, reward, bark, jump, splash, dig, honk, whistle, bell, pet, ui, door, eat, shutter; `applyVolume()` (honours `settings.muted`) |
| `game.fx` | `burst(kind, x, y, z, n)` particles: dust, splash, dirt, heart, spark, leaf, water |
| `game.modules` | results of the four `init` calls |

### Saved state (`js/save.js`, localStorage key `kc-open-trail-save-v2`)

```js
{ v: 2,
  wallet: { bones, gems },
  owned: {},        // itemId -> true | count      (shop)
  upgrades: {},     // upgradeId -> level           (economy)
  equipped: {},     // slot -> itemId               (shop): bandana, harness, collar, hat, tag, trail, skin:skateboard ...
  stats: { distance, bones, balls, digs, barks, pets, photos, jumps, swims, rides, talks, bells, fetches, days, playTime },
  collected: { balls: [], photos: [], signs: [], zones: [] },
  pos, time, day, settings: { quality, autoQuality, sound, music, muted, invertY, invertX, leftHanded, rain, camDist },
  rides: {},        // rideId -> { x, z, yaw } for skateboards, canoes and vans left away from home (written by vehicles.js on beforeSave)
  flags: {},        // world flags (game.economy.setFlag), e.g. festival: true
  modules: {} }     // free-form per-module data
```

Loading is tolerant: a missing, non-JSON or wrongly-typed save falls back to
defaults field by field (the raw text is kept under `...-corrupt`). `owned`,
`upgrades`, `equipped`, `flags` and `modules` are open maps, so new keys survive.
Every read and write of localStorage is inside try/catch; with storage blocked
the game still runs, it just does not persist. `v1` was the prototype map and
is not migrated.

Out-of-range values are clamped on load (day >= 1, sound / music 0..1, camera
distance, position inside the map, a non-numeric yaw becomes the spawn yaw).
`game.save.reset()` writes a fresh state straight to storage without emitting
`beforeSave` and then refuses further saves, so the reload that follows starts
at the spawn with "Play".

Per-module storage: `const data = game.moduleData('missions', { done: [], active: null })`
returns a live object inside `state.modules` (defaults are filled in for
missing keys). Mutate it; call `game.save.save()` if you want it written now.
`beforeSave` fires just before each write.

## Registry API (also available as `game.api.*`)

```js
game.addMarker({ id, x, z | getPos(), icon, color, label, beacon: true, minimap: true, edge: true }) // -> { id, remove() }
game.addInteractable({ id, x, z | getPos(), r, label | () => string, icon, prio, enabled(), onInteract() })
game.addZone({ id, name, x, z, r } | { id, rect: [x0, z0, x1, z1] }, onEnter, onExit)   // emits enterZone / exitZone with custom: true
game.setObjective({ x, z | getPos(), label, color } | null)   // compass tick, minimap dot, light pillar, distance readout
game.spawnProp(kind, x, z, opts)   // any builder in scenery.js: bench, lamp, signpost {text}, stall {name, col, ry}, tent, crate, log,
                                   // table, fence {x1, z1}, hedge, deck, flag, planter, bin, boulder, haybale, pumpkin {s, deco}, campfire,
                                   // cart {name, col, ry}, noticeboard {title, ry}, stage {ry, col}, fountain {r}, agility, boat, railcar,
                                   // building {w, d, h, col, roof, f, sign, kind}. Returns { mesh, colliders, remove() }
game.addCarriable({ id, kind: 'ball'|'treat'|'stick'|'parcel', label, x, z, mesh?, onUse?, useLabel? })   // -> item with remove(), throwTo(x, z)
game.npcs.addPed({ pts: [[x, z], ...], loop }, look?, name?)   // a walking person; add an interactable with getPos: () => ped to make a giver
```

Icons: `bone gem paw pause map camera jump bolt bark sit dig shake hand gear close ball whistle flag star`
(`icon(name, size)` in `js/util.js`).

### KC stats and cosmetics

```js
game.setModifier('upgrade:legs', { speed: 1.15, stamina: 1.5, jump: 1.2, magnet: 2, carry: 2, swim: 1.3, bones: 1.5 }) // values multiply across sources
game.setModifier('upgrade:legs', null)                 // remove
game.setCosmetic('bandana', 0xd9534f | null)           // colour or off
game.setCosmetic('harness', 0x1f1f22)                  // null restores KC's black harness
game.setCosmetic('collar', 0x3f7fd6)                   // null restores her blue collar
game.setCosmetic('hat', 'cap' | { type: 'cap', color } | null)   // built in: cap, party, ranger, beanie, crown, pumpkin, flower
game.kc.registerHat('myhat', (geo, color) => { /* add shapes to a Geo */ })
game.setCosmetic('tag', 0xf0c040 | false)              // collar tag colour / hidden
game.setCosmetic('trail', 0x7fd4ff | null)             // sparkle trail colour (sprint trail is always on)
game.setSkin('skateboard' | 'canoe' | 'van', { primary: 0x.., secondary: 0x.. })
```

`speed` scales sprint fully and walk/run by its square root; `stamina` scales
the stamina pool; `jump` scales jump height; `magnet` scales bone pickup
radius; `carry` (floored) is how many items fit in her mouth/saddlebag;
`bones` multiplies bones from pickups and dig spots. Cosmetics and modifiers
are **not** persisted by the core: re-apply them from `state.equipped` /
`state.upgrades` in your `init`.

### UI shell (`game.ui`)

```js
const h = game.openModal({ id, title, html | node | render(body, handle), actions: [{ label, primary, danger, onClick, keepOpen }],
                           onClose, wide, dismissable, pause })   // -> { body, close(), refresh(), setTitle() }
game.closeModal(id?)            // modals stack: closing one shows the one underneath
game.toast('text', { icon, kind: 'good'|'warn'|'gold', ms })
game.ui.confirm(title, text, yesLabel, noLabel)   // -> Promise<boolean>
game.ui.addMenuItem({ id, label, icon, order, onSelect })     // entry in the pause menu
game.ui.addHudButton({ id, icon, label, title, onClick })     // button next to map / photo / pause
game.ui.banner(title, sub), game.ui.fade(midpointFn), game.ui.map(), game.ui.pause(), game.ui.photoMode(true)
```

A modal with `pause: true` (the default) stops the simulation while open.
Use the CSS classes in `style.css` (`.btn.go`, `.btn.alt`, `.menu`, `.set`,
`.stats`) so new screens match. The wallet pill reads `state.wallet` and
bumps on every `wallet` event.

## Events emitted by the core

| Event | Payload |
| --- | --- |
| `start` | player pressed Play |
| `tick` | `{ dt, t }` every simulation step (up to 3 per frame) |
| `second` | `{ t }` once per simulated second |
| `pickup` | `{ kind: 'bone'|'goldenBall'|'dig'|'photo'|'sign', id, value, x, z, first?, found?, total? }` |
| `wallet` | `{ currency, amount, delta, reason }` (reasons: pickup, dig, goldenBall, photo, sign, fetch, discover, debug) |
| `grant` | `{ bones, gems, items, source }` after `game.economy.grant` |
| `flag` | `{ key, value }` after `game.economy.setFlag`; `shopTab` `{ id }` |
| `enterZone` / `exitZone` | district: `{ id, name, district: true, first }`; custom: `{ id, name, custom: true, zone }` |
| `discover` | `{ id, name }` first visit to a district |
| `interact` | `{ id, kind, target }` any interactable used |
| `vehicleEnter` / `vehicleExit` | `{ id, kind }` (`skateboard`, `canoe`, `van`, `tram`) |
| `tramStop` | `{ stop, index, riding }` the Heron Line tram reached a stop (`riding`: KC is aboard) |
| `trick` | `{ kind: 'ollie', id }` |
| `npcTalk` | `{ id, name, line, where }` KC used a talk prompt; `npcPet` `{ id, name, x, z }` a person petted KC; `npcWave` `{ id, name }` |
| `fogBell` | `{ x, z }` KC rang the Old Fog Bell; `chime` `{ hour }` the courthouse clock struck (heard within 260 units) |
| `dogPlay` | `{ id, name, x, z }` |
| `scatter` | `{ id, kind: 'bird'|'duck'|'squirrel'|'chicken'|'sheep', count, byBark }` |
| `bark`, `sit`, `shake`, `jump` | `{ x, z }` |
| `digStart`, `dig` | `{ x, z }` (`dig` fires when the dig finishes) |
| `swimStart`, `swimEnd`, `land`, `exhausted`, `respawn`, `teleport` | movement moments |
| `carry` / `drop` | `{ item, id, kind }` (+ `x, z` on drop); `eat` `{ id, kind }`; `throw`, `fetch` `{ id, value }` |
| `honk` | `{ id }` a car, the van, the train (`'train'`) or the tram (`'tram'`) is waiting for someone |
| `timeOfDay` | `{ phase: 'dawn'|'day'|'dusk'|'night', time, day }`; `dayChange` `{ day }`; `weather` `{ rain }` |
| `photoMode` `{ on }`, `photoTaken` `{ x, z, zone }` | |
| `objective`, `modalOpen`, `modalClose`, `toast`, `quality`, `modsChanged`, `cosmeticChanged`, `skinChanged`, `beforeSave`, `saved` | housekeeping |

## World data (`js/data.js`)

The map follows section 3 of `marketing/kc-open-trail/SETTING-BRIEF.md`: a
compressed St. Helens, Oregon, Highway 30, Sauvie Island and a compact Portland
on a 10 x 10 grid (100 units a cell). Coordinates: +x east, +z south, playable
square -500..500, terrain to +-540. Rivers (`RIVERS`: polylines with a
half-width per point), `LAKES`, `ISLANDS`, terrain `BUMPS` / `PADS` / `FLATS` /
`RIDGE`, `ROADS` (road, gravel, trail, walk), `BUILDINGS`, `STALLS`, `CARTS`,
painted `PATCHES` and `FIELDS`, `RIDEABLES`, `TRAFFIC`, `PED_ROUTES` + `CHATTER`,
`DOG_SPOTS`, `CRITTERS`, and the collectibles (`GOLDEN_BALLS`, `DIG_SPOTS`,
`PHOTO_SPOTS`, `SIGNPOSTS`) are plain data.

District ids (`ZONES`, first match wins; `enterZone` / `discover` carry these):
plaza, cvpark, marina, greycliffs, dalton, quarry, nobhill, sand, oldtown,
mccormick, mill, sthelens, scappoose, lighthouse, farm, islandbeach, wildlife,
stjohns (the bridge), tilikum, hawthorne, cathedral, chimney, carts, tabor,
mansion, square, makers, waterfront, linnton, downtown, forestpark, sauvie,
columbia, channel, willamette, stjohnstown (the St. Johns neighbourhood),
eastside, hwy30, farshore, tualatin, bottoms, valley (42 in all).

Other world data: `RAIL` (the railway centre line; `world.rail` is the smoothed
path the track geometry and the train share), `RAIL_CROSSINGS`, `TRAIN`,
`TILIKUM`, `TRAM` (the invented Heron Line: two stops, speed, dwell),
`CROSSWALKS`, `CLEARINGS` (no-tree view corridors at the viewpoints).

Naming rules (from the brief, section 2 and 3): real public places keep their
names (St. Helens, Columbia County Courthouse, Sand Island, St. Johns Bridge,
Pittock Mansion ...). Every private business is an invented stand-in ("The
Riverfront Picture House", "Wapato Patch Farm", "Rain City Books", "Bridgeside
Makers Market", all carts and shops). The plaza centrepiece is the original
Lantern Stack; the rooftop neon is an original heron with "RAIN OR SHINE". No
film names, characters, designs or scenes, no real sculptures or signs, no
transit or railway logos. The autumn event is the "Fog Bell Festival".

## Performance notes

Static scenery is merged into one vertex-coloured mesh per 170-unit chunk (plus
a glow mesh each); a chunk is hidden once it is further away than the fog.
Flora is `InstancedMesh` per 90-unit chunk and kind with the same distance
cut-off, wildlife / bones / shadows / particles / beacons are one draw call
each, people and dogs freeze beyond 170 units. The terrain is one 144 x 144
heightfield (`N = 144` in `world.js`, 41,472 triangles) with a single painted texture; the far volcanoes are one mesh that
rides with the camera. Quality presets live in `main.js` (`QUALITY`):
pixel-ratio cap (1 / 1.5 / 2), fog distance, plant density, shadow map on/off.
If the frame time stays above ~36 ms for 3 s and "lower graphics automatically"
is on, quality steps down, then render resolution.

Memory: the ground texture is painted once at boot at 1024 px when the game
boots on Low, 2048 px on Medium / High (4096 px only on desktop-class GPUs);
its CPU-side canvas is released once it is on the GPU and copied into
`world.mapCanvas` (1024 px on Low, else 2048 px). The sign atlas is 1024 px
when booting on Low, else 2048 px. `Geo.build()` hands its vertex data to the
typed arrays and empties the builder, so no plain-array copies stay alive.
Fine ground markings (road lines, zebra stripes, paving joints, sleepers and
rails) are thin geometry in the scenery chunks, not paint.

The camera boom is shortened by `world.camBlocked(x, z, y)`: tall solid
colliders plus "view volumes" (`world.addView({ x, z, r, bottom, top, shape:
'cone' | 'ball' | 'cyl' } | { box, bottom, top })` -> object with `remove()`),
which mark things KC can walk under but the camera must stay out of: tree
canopies, stall and stage roofs, the cinema marquee, tram shelters.
