# KC: Open Trail: architecture and extension seams

Plain ES modules, no build step. three.js r170 is vendored in `vendor/three/`.
Everything visible is built in code (low-poly geometry + canvas textures) and
all sound is WebAudio synthesis. The only network traffic is same-origin game
files; the store module (when it exists) may call the Dewclaw worker after the
player presses a real-money Buy button, and nothing else may leave the origin.

## Boot order (`js/main.js`)

`save` -> `input` -> `audio` -> `fx` -> `world` (terrain, `scenery`, `flora`) ->
`camera` -> `api` (registry + wallet) -> `hud` (`game.ui`) -> `kc` -> `npc`
(peds, dogs, critters, ranger/mischief) -> `vehicles` -> `collect` ->
**`economy.init(game)`, `missions.init(game)`, `shop.init(game)`, `store.init(game)`**.

Each of the four stub modules exports `init(game)`. Whatever `init` returns is
kept at `game.modules.<name>`. The debug hooks call
`game.modules.missions.start(id)` and `.complete()` if they exist.

## The `game` object

| Field | What it is |
| --- | --- |
| `game.bus`, `game.on(type, fn)`, `game.off`, `game.emit(type, data)` | event bus; `on` returns an unsubscribe function; `'*'` hears everything |
| `game.state` | the saved state object (below). Mutate it, it is saved every 20 s, on pause, on tab hide |
| `game.wallet` | `get(cur)`, `can(cur, n)`, `add(cur, n, reason)`, `spend(cur, n, reason)` -> boolean. `cur` is `'bones'` or `'gems'`. Emits `wallet` |
| `game.rewards` | tunable payouts: `{ bone: 1, goldenBall: { gems: 1, bones: 10 }, dig: [3, 8], photo: 5, sign: 2, fetch: 2, zone: 3 }`. Change values in `economy.init` |
| `game.kc` | KC: `pos` (THREE.Vector3), `yaw`, `speed`, `stamina`, `staminaMax`, `ride`, `carried`, `mods`, `base` (walk/run/sprint/jump/drain/regen/magnet), `teleport(x, z, yaw)`, `doBark/doSit/doDig/doShake()`, `carry(item)`, `drop()`, `isCarrying(kind)` |
| `game.world` | `heightAt(x, z)`, `groundAt(x, z, y)`, `surfaceAt(x, z)` (0 grass, 1 road, 2 trail, 3 sand, 4 water), `zoneAt(x, z)`, `waterDepth`, `blockedAt(x, z, y, r)`, `addBox/addCircle` colliders, `roads`, `time` (0-24), `day`, `night` (0-1), `rain`, `setTime`, `setRain`, `mapCanvas` |
| `game.cam` | `yaw`, `pitch`, `dist`, `three` (the PerspectiveCamera) |
| `game.npcs` | `peds`, `dogs`, `groups` (critters), `ranger`, `addPed(route, look, name)` |
| `game.mischief` | `level` (0-3), `chasing`, `add(n, reason)`, `clear()` |
| `game.vehicles` | `rides`, `cars`, `enter(id)`, `exit()`, `byId(id)`, `reset(id)`, `setSkin(kind, { primary, secondary })` |
| `game.collect` | bones, golden balls, dig spots, carriables; `counts()` |
| `game.ui` | HUD + modal shell (below) |
| `game.audio` | `sfx(name)`: pickup, gold, reward, bark, jump, splash, dig, honk, whistle, pet, caught, ui, door, eat, shutter |
| `game.fx` | `burst(kind, x, y, z, n)` particles: dust, splash, dirt, heart, spark, leaf, water |
| `game.modules` | results of the four `init` calls |

### Saved state (`js/save.js`, localStorage key `kc-open-trail-save-v1`)

```js
{ v: 1,
  wallet: { bones, gems },
  owned: {},        // itemId -> true | count      (shop)
  upgrades: {},     // upgradeId -> level           (economy)
  equipped: {},     // slot -> itemId               (shop): bandana, harness, collar, hat, tag, trail, skin:skateboard ...
  stats: { distance, bones, balls, digs, barks, pets, photos, jumps, swims, rides, caught, escapes, days, playTime },
  collected: { balls: [], photos: [], signs: [], zones: [] },
  pos, time, day, settings: { quality, autoQuality, sound, music, invertY, invertX, leftHanded, rain, halloween },
  modules: {} }     // free-form per-module data
```

Loading is tolerant: a missing, non-JSON or wrongly-typed save falls back to
defaults field by field (the raw text is kept under `...-corrupt`). `owned`,
`upgrades`, `equipped` and `modules` are open maps, so new keys survive.

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
game.spawnProp(kind, x, z, opts)   // any builder in scenery.js: bench, lamp, signpost {text}, stall {name, col}, tent, crate, log,
                                   // table, fence {x1, z1}, hedge, deck, flag, planter, bin, boulder, haybale, pumpkin, campfire,
                                   // building {w, d, h, col, roof, f, sign, kind}. Returns { mesh, colliders, remove() }
game.addCarriable({ id, kind: 'ball'|'sausage'|'stick'|'parcel', label, x, z, mesh?, onUse?, useLabel? })   // -> item with remove(), throwTo(x, z)
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
| `wallet` | `{ currency, amount, delta, reason }` (reasons: pickup, dig, goldenBall, photo, sign, fetch, discover, caught, debug) |
| `enterZone` / `exitZone` | district: `{ id, name, district: true, first }`; custom: `{ id, name, custom: true, zone }` |
| `discover` | `{ id, name }` first visit to a district |
| `interact` | `{ id, kind, target }` any interactable used |
| `vehicleEnter` / `vehicleExit` | `{ id, kind }` (`skateboard`, `canoe`, `van`) |
| `trick` | `{ kind: 'ollie', id }` |
| `npcPet` | `{ id, name, x, z }` a person petted KC; `npcWave` `{ id, name }` |
| `dogPlay` | `{ id, name, x, z }` |
| `scatter` | `{ id, kind: 'bird'|'duck'|'squirrel'|'chicken'|'sheep', count, byBark }` |
| `bark`, `sit`, `shake`, `jump` | `{ x, z }` |
| `digStart`, `dig` | `{ x, z }` (`dig` fires when the dig finishes) |
| `swimStart`, `swimEnd`, `land`, `exhausted`, `respawn`, `teleport` | movement moments |
| `carry` / `drop` | `{ item, id, kind }` (+ `x, z` on drop); `eat` `{ id, kind }`; `throw`, `fetch` `{ id, value }`; `confiscated` |
| `mischief` | `{ level, reason }`; `chaseStart`, `chaseEnd`, `escaped`, `caught` `{ level, fine }` |
| `honk` | `{ id }` a car or the van is waiting for someone |
| `timeOfDay` | `{ phase: 'dawn'|'day'|'dusk'|'night', time, day }`; `dayChange` `{ day }`; `weather` `{ rain }` |
| `photoMode` `{ on }`, `photoTaken` `{ x, z, zone }` | |
| `objective`, `modalOpen`, `modalClose`, `toast`, `quality`, `modsChanged`, `cosmeticChanged`, `skinChanged`, `beforeSave`, `saved` | housekeeping |

## World data (`js/data.js`)

Districts, roads and trails, buildings, stalls, rideables, traffic routes,
pedestrian routes, dog spots, critter groups and all collectibles are plain
data. Coordinates: +x east, +z south, playable square -300..300.
`ZONES` (ids: camp, lookout, park, beach, lake, farm, town, mountain,
riverside, forest, meadows, valley), `SIGNPOSTS`, `PHOTO_SPOTS`, `GOLDEN_BALLS`,
`DIG_SPOTS`, `RANGER_POST`, `SPAWN`.

## Mischief (original to this game)

`game.mischief.add(n)` raises a 0-3 paw-print meter and Ranger Juniper jogs
after KC with a leash. KC can outrun her at a sprint, lose her for a while, or
swim. Caught: `min(bones, 5 x level)` bones, carried items handed back, KC
resets to the ranger station. Core sources: nabbing a sausage (`carry` of kind
`sausage`), digging in the park flower beds.

## Performance notes

Static scenery is merged into at most 16 chunk meshes (plus a glow mesh each),
flora is `InstancedMesh` per chunk and kind, critters / bones / shadows /
particles / beacons are one draw call each. Quality presets live in `main.js`
(`QUALITY`): pixel-ratio cap, fog distance, plant density, shadow map on/off.
If the frame time stays above ~36 ms for 3 s and "lower graphics
automatically" is on, quality steps down, then render resolution.
