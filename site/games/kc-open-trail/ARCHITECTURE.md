# KC: Open Trail: architecture and extension seams

Plain ES modules, no build step. three.js r170 is vendored in `vendor/three/`.
Everything visible is built in code (low-poly geometry + canvas textures) and
all sound is WebAudio synthesis. The only network traffic is same-origin game
files (including `merch.json`, read once at boot, and the product thumbnails in `img/merch/`, read only when a grown-up opens the
real-gear list). The one exception is the Dewclaw worker, which `store.js` (and no other file) calls after a grown-up has passed the gate
and pressed a button: buy, restore. `merch.js` is allowed the same for a future claim endpoint but today calls nothing outside the folder.
Nothing else may leave the origin, and the game never loads anything from another site. As shipped the worker address in
`js/store-config.js` is a placeholder, so the game makes no outside request at all.

## Boot order (`js/main.js`)

`save` -> `input` -> `audio` -> `fx` -> `world` (terrain, `scenery`, `flora`) ->
`camera` -> `api` (registry, wallet, economy and shop seams) -> `hud` (`game.ui`, with `uikit` and `photo`) -> `kc` -> `npc`
(people, dogs, wildlife, followers, standers) -> `vehicles` -> `collect` -> `seams` (`game.cosmetics`, `game.place`,
`game.timedRun`, `game.travel`, `game.followers`) ->
**`economy.init(game)`, `upgrades.init(game)`, `shop.init(game)`, `missions.init(game)`, `store.init(game)`, `merch.init(game)`, `guide.init(game)`**
-> `game.cosmetics.restore()` -> event `modulesReady`.

## Module seams

This section is the contract between the core and the seven feature modules. What the modules themselves offer is in
"The feature modules as built" further down.

### File ownership

| Files | Owner | Rule |
| --- | --- | --- |
| `js/economy.js`, `js/upgrades.js`, `js/shop.js`, `js/missions.js` (+ `js/activities.js`), `js/store.js` (+ `js/store-config.js`), `js/merch.js`, `js/guide.js`, `css/*.css`, `merch.json`, `img/merch/`, `tools/sync-merch.js` | one module each | Each **exports `init(game)`**; `main.js` imports all seven and calls `init` once, in that order, after everything in the boot order above exists. Whatever `init` returns is kept at `game.modules.<name>` (return your public API there). A module that throws in `init` is logged and skipped; the game still boots. |
| every other file in `js/`, `index.html`, `style.css`, `sw.js` | core | **Modules never edit core files** (the integration pass did: it fixed `spawnProp` for `planter` / `boat` / `hydrant`, the 44 px close button in landscape, the tab strip and the banner). If a module needs something the core does not offer, it works with the hooks below or asks for a new one; it does not patch `hud.js`, `kc.js`, `vehicles.js`, `data.js` and so on. |
| new files | the module that needs them | A module may add files (`js/shop-data.js`, `merch.json`, thumbnails). Every new file under `js/`, and anything else the game needs offline, must be added to `SHELL` in `sw.js` **by whoever integrates the modules** (`sw.js` is a core file): list the files you added in your hand-over note. The smoke test fails if `js/`, `css/`, `merch.json` and `SHELL` disagree. The thumbnails in `img/merch/` are deliberately not in `SHELL` (spec 5.5): the service worker keeps each one the first time it is shown. |

Other rules a module must keep:

- Modules talk to each other only through `game.economy`, `game.shop`, the event bus and `game.modules.<name>` (which may not exist yet when your `init` runs: modules boot in the order economy, upgrades, shop, missions, store, merch, guide. Look another module up lazily, or wait for the `modulesReady` event).
- Import helpers from core files if you like (`./util.js`: `THREE`, `Geo`, `icon`, `el`, `clamp`, `rng` ...; `./data.js`: `BUILDINGS`, `STALLS`, `CARTS`, `SIGNPOSTS`, `DOG_SPOTS`, `PHOTO_SPOTS`, `ZONES` ...). Importing is not editing.
- No network. Only `store.js` and `merch.js` may call `fetch`: `store.js` only to the Dewclaw worker and only after a grown-up has passed the gate and pressed a button (buy, restore); `merch.js` only for the same-origin `merch.json`. The smoke test fails on `fetch` / XHR / WebSocket / beacon anywhere else and on any request that leaves the origin.
- Money never buys bones or stats. Real-money spending is off until `game.grownUp.spending` is true. Every purchase and every link that leaves the game goes through `game.ui.gate()` / `game.ui.openExternal()`.
- Touch targets 44 px or more; check your screens at 390 x 844 and 844 x 390. Use the shared pieces in `game.ui` and the classes in `style.css` so the screens look like one game.
- No names, characters or designs from the do-not-copy list in `SETTING-BRIEF.md` (the smoke test scans shipped files for them).

### Index of hooks

| Need | Hook |
| --- | --- |
| Pay out or take bones / gems, own items, world flags | `game.economy.grant / owns / count / use / canAfford / spend / setFlag / getFlag / catalog`, `game.wallet`, `game.rewards` |
| Ask before spending | `game.ui.confirmSpend(opts)` |
| KC's abilities | `game.setModifier(id, mods, { seconds })`, `game.getModifier(key)` |
| Ride ladders | `game.vehicles.setTuning(kind, patch, source)`, `getTuning(kind)` |
| A dog that follows KC | `game.followers.add / dismiss / list / dogs / max` |
| Wearables and ride paint by id | `game.cosmetics.define / equip / unequip / preview / endPreview / equipped / list`, `game.kc.registerHat / registerOutfit` |
| Photo mode extras | `game.photo.unlock / lock / register* / set* / addSticker / state` |
| Put things in the world | `game.place.marker / prop / stand / shelf / counter / npc / pickup / zone / staged / door / beside / stall / cart / sign / remove / removeAll`, `game.spawnProp`, `game.addCarriable` |
| Objectives, timers | `game.setObjective(o)`, `game.timedRun(opts)`, `game.ui.setTimer(text)` |
| Fast travel | `game.travel.add / go / list / blocked`, `game.fastTravel(x, z, yaw, opts)` |
| Screens | `game.openModal`, `game.ui.tabs / item / grid / price / progress / note / heading / confirm`, `game.shop.registerTab`, `game.ui.addMenuItem / addHudButton / addSetting`, `game.toast`, `game.banner` |
| Grown-ups | `game.ui.gate`, `game.grownUp`, `game.ui.openExternal` |
| Saving | `game.moduleData(id, defaults)`, `game.save.save()`, `game.save.keepOnReset(id)` |
| Hearing what happens | `game.on(type, fn)` (events table below) |

### Economy and wallet (`js/api.js`)

```js
game.wallet.get('bones') ; .can('gems', 40) ; .add('bones', 5, 'reason') ; .spend('bones', 120, 'reason') -> boolean
game.economy.grant({ bones: 5, gems: 1, items: ['hat:ranger', { id: 'treat:zoomie', n: 3 }] }, 'mission:paper-round')
        // -> { bones, gems, items } actually granted. Pays the wallet (emits `wallet`), marks items in state.owned, emits `grant`.
game.economy.owns('hat:ranger')            // boolean
game.economy.count('treat:zoomie')         // 0, 1 (plain owned item) or the count
game.economy.use('treat:zoomie', 1)        // -> boolean; takes n away (deletes the entry at 0), emits `itemUsed` { id, n, left }
game.economy.canAfford({ bones: 150 })     // boolean; { bones, gems } both must be covered
game.economy.spend({ bones: 150 }, 'shop') // -> boolean; takes both currencies or neither, emits `spend`
game.economy.catalog                       // [] for the economy module to fill with its item / upgrade table
game.economy.setFlag('festival', true) ; game.economy.getFlag('festival')   // saved in state.flags, emits `flag`
game.rewards   // tunable payouts: { bone: 1, goldenBall: { gems: 1, bones: 10 }, dig: [3, 8], photo: 5, sign: 2, fetch: 2, zone: 3,
               //                    digCooldown: 240 (s), boneRespawn: [100, 140] (s), fetchPaid: 0, fetchWindow: 600 }   (economy.js sets 1800, [3000, 3600], 6, 600)   e.g. Dig Mitts: game.rewards.dig = [4, 9]
```

`grant` never checks a price and `spend` never grants: a purchase is `if (await game.ui.confirmSpend({...})) game.economy.grant({ items: [id] }, 'shop')`.
A module may wrap or replace `game.economy.grant` (keep the signature and keep paying through `game.wallet`).

Flags the core reacts to: `festival` (true switches on the Fog Bell Festival dressing layer and pulls the fog in; also a
checkbox in Settings) and `coached` (set by the HUD once a touch player has moved and looked).

Edge cases the seams guarantee (so modules need not re-check):

- `wallet.add(cur, n)` ignores an unknown currency and a non-finite or zero `n`, rounds, and never lets a balance go below 0.
  `wallet.spend(cur, n)` returns `false` for a non-finite or negative `n` or when the balance is short; `spend(cur, 0)` is `true`.
- `grant(what)` treats `null` / a non-object as `{}`. `items` may be one id, one `{ id, n }` or an array of either; entries with a
  missing id or `n < 1` are skipped. An owned count is always `true` or a positive integer.
- `spawnProp(...).remove()`, `addCarriable(...).remove()` and every `game.place.*` handle's `remove()` take everything with them
  (meshes, GPU geometry, colliders, camera view volumes, prompts, map dots) and are safe to call twice.

### KC's abilities: modifiers (`js/kc.js`)

```js
game.setModifier('upgrade:legs', { speed: 1.15 })                       // id = the source; calling again with the same id replaces it
game.setModifier('upgrade:lungs', { stamina: 1.45 })
game.setModifier('treat:zoomie', { speed: 1.15 }, { seconds: 180 })     // timed: goes by itself and emits `modExpired` { id }
game.setModifier('upgrade:legs', null)                                  // remove
game.getModifier('speed')        // the combined value now (1.15 x 1.15 = 1.3225)
game.getModifier()               // { speed, stamina, jump, magnet, sniff, carry, swim, bones, carryAdd }
game.kc.modifierLeft('treat:zoomie')   // seconds left (Infinity for a permanent source, 0 when gone)
```

| Key | Effect | Combines |
| --- | --- | --- |
| `speed` | sprint fully, walk / run by its square root | multiplies |
| `stamina` | stamina pool (`kc.staminaMax = 100 x stamina`) | multiplies |
| `jump` | jump height (the take-off speed is scaled by the square root) | multiplies |
| `swim` | swim speed | multiplies |
| `magnet` | pickup radius for loose bones (above 1.05 bones also drift to her from further away) | multiplies |
| `sniff` | sniff radius: how far away loose bones start drifting towards her | multiplies |
| `bones` | bones from loose-bone pickups and dig spots only (not missions, tills or grants) | multiplies |
| `carry` | carry slots (floored) | multiplies |
| `carryAdd` | extra carry slots | adds |

`kc.capacity()` = `floor(carry) + floor(carryAdd)` + the ride's `carry` tuning while she is aboard. Unknown keys are ignored.
Modifiers are **not** saved by the core: re-apply them from your own saved levels in `init`. Emits `modsChanged`.

### Rides: tuning (`js/vehicles.js`)

```js
game.vehicles.setTuning('skateboard', { max: 1.16 }, 'upgrade:wheels')   // kind: 'skateboard' | 'canoe' | 'van'; applies to every ride of that kind
game.vehicles.setTuning('skateboard', { turn: 1.2 }, 'upgrade:trucks')   // each source id is kept apart, like modifiers
game.vehicles.setTuning('van', { offroad: 2 / 3 }, 'upgrade:tyres')
game.vehicles.setTuning('canoe', { keep: 1, carry: 1 }, 'upgrade:drybox')
game.vehicles.setTuning('van', null, 'upgrade:tyres')                    // remove that source
game.vehicles.getTuning('van')   // -> { max, acc, turn, pop, offroad, keep, carry, topSpeed, turnRate, base: { max, acc, turn } }
```

| Key | Meaning | Combines | Limits |
| --- | --- | --- | --- |
| `max` | top speed multiplier (base: skateboard 13, canoe 7.5, van 19) | multiplies | 0.5 to 1.6 |
| `acc` | acceleration multiplier | multiplies | 0.5 to 2 |
| `turn` | turn rate multiplier | multiplies | 0.5 to 2 |
| `pop` | ollie height multiplier (skateboard) | multiplies | 0.5 to 1.6 |
| `offroad` | 0 to 1: how much of the off-road slowdown is taken away. Van: gravel and paving 0.70 -> 1, grass and sand 0.32 -> 1. Skateboard: rough ground 0.62 -> 1. The spec's van tiers 0.80 / 0.90 / 1.00 are `1/3`, `2/3`, `1`. | largest wins | 0 to 1 |
| `keep` | how many carried things stay in her mouth when she hops on (default 0; the van and the tram always keep everything) | adds | 0 to 8 |
| `carry` | extra carry slots while she is aboard (Dry Box, Roof Rack) | adds | 0 to 8 |

Emits `tuningChanged` { kind, tuning }. Not saved by the core: re-apply in `init`. Pop Deck's bones per ollie need no hook: listen for `trick` (it carries the board's `speed`; Pop Deck pays only on the move).
Paint: `game.setSkin('van', { primary, secondary })` directly, or by id through `game.cosmetics` (slot `skin:van`).

### Followers: Trail Buddies, Buddy Whistle, party treat, dog-walking jobs (`js/npc.js`)

```js
const buddy = game.followers.add({ dog: 'dog-biscuit' })            // borrow a town dog (id or name: Biscuit, Pepper, Cliff, Sandy, Clover, Mochi, Bruno, Juniper, Tabor, Rosie)
const pup = game.followers.add({ name: 'Pip', look: { coat: 0x333333, belly: 0xf4ead8, ear: 0x222222, s: 0.8 }, seconds: 600, onLeave: reason => {} })   // a new dog
// -> { id, name, dog, left(), dismiss() }, or null when the dog is unknown or the party is full
game.followers.dismiss('dog-biscuit')    // one (follower id, dog id or name); no argument = everyone. -> how many left
game.followers.list()                     // handles of the dogs with her now
game.followers.dogs()                     // the town dogs: [{ id, name, x, z, home: { x, z }, following }]
game.followers.max = 2                    // party size (default 2, at most 4): Buddy Whistle tier 3
```

A follower trots behind KC, sprints to keep up, sits when she sits, barks back, swims, runs beside a ride and catches up out of
sight after a teleport or a fast ride. A timed follower leaves by itself (`reason: 'timeout'`); a borrowed dog trots home, a
spawned one is removed. Events: `followerJoin` { id, name, dog, count }, `followerLeave` { id, name, dog, reason, count }.
Followers are not saved: call them again in `init` if your design keeps them across sessions.

### Cosmetics by id (`game.cosmetics`, `js/seams.js`)

```js
game.cosmetics.define([
  { id: 'hat:ranger', slot: 'hat', name: 'Ranger hat', value: { type: 'ranger', color: 0x6f8f4f } },
  { id: 'bandana:red', slot: 'bandana', name: 'Red bandana', value: 0xd9534f, free: true },
  { id: 'costume:ghost', slot: 'outfit', name: 'Ghost sheet', value: 'sheet' },
  { id: 'skin:van:adventure-club', slot: 'skin:van', name: 'Adventure Club', value: { primary: 0x2f6f5f, secondary: 0xf4ead8 } }
]);
game.cosmetics.equip('hat:ranger')        // -> boolean. Needs game.economy.owns(id) or free: true (or { force: true }). Saves state.equipped[slot] = id, emits `equip`
game.cosmetics.unequip('hat')             // back to bare / KC's own colours / the stock ride paint. Emits `unequip`
game.cosmetics.preview('hat:ranger')      // try-on: shown, not saved, ownership not needed
game.cosmetics.endPreview()               // also happens when the last screen closes and on equip / unequip
game.cosmetics.equipped('hat')            // 'hat:ranger' | null ; equipped() -> the whole slot map
game.cosmetics.list('hat') ; .get(id) ; .canWear(id) ; .slots
```

| Slot | `value` | Built in |
| --- | --- | --- |
| `bandana`, `harness`, `collar`, `trail` | a colour `0xrrggbb` | harness is black and collar blue when nothing is equipped; `trail` is a sparkle trail |
| `tag` | a colour, or `false` to hide the tag | gold |
| `hat` | `'cap'` or `{ type: 'cap', color }` | `cap`, `party`, `ranger`, `beanie`, `crown`, `pumpkin`, `flower` |
| `outfit` | `'cape'` or `{ type: 'cape', color }` | `cape`, `wings`, `vest`, `sheet`, `pumpkinsuit`, `scarecrow`, `saddlebags`, `scarf`, `lanternvest` |
| `skin:skateboard`, `skin:canoe`, `skin:van` | `{ primary, secondary }` | orange / blue, red / cream, teal / cream |

New shapes: `game.kc.registerHat('trucker', (geo, color = 0x2f6f5f) => { geo.ball(0, 0, 0, 0.17, 0.11, 0.18, color, 7, 4); geo.box(0, -0.02, 0.2, 0.2, 0.02, 0.16, color); })`
(hat space: origin on top of her head, +z forward) and `game.kc.registerOutfit('raincoat', (geo, color) => { ... })` (body space:
torso centre about `0, 0.53, 0`, nose towards +z, body about 0.4 wide and 0.9 long). `geo` is a `Geo` from `util.js` (`box`, `cyl`, `ball`, `tri`, `quad`).

**Saving is done for you**: `state.equipped` is saved, and a definition that arrives after the save was loaded is put on at
once if the save says KC is wearing it, so define your items in `init` and do nothing else. The raw calls
`game.setCosmetic(slot, value)` and `game.setSkin(kind, skin)` still exist; they do not save.

### Photo mode: frames, filters, stickers, zoom, poses (`game.photo`, `js/photo.js`)

Presets exist but start **locked**. The Trail Camera ladder unlocks what the player owns, in `init`, from its saved level:

```js
game.photo.unlock('frame', ['postcard', 'polaroid', 'trail', 'film', 'lanterns', 'leaves'])   // or unlock('frame') for all
game.photo.unlock('filter') ; game.photo.unlock('zoom')            // filters: warm, cool, sepia, mono, dusk
game.photo.unlock('sticker') ; game.photo.unlock('pose')           // stickers: paw, bone, heart, star, ball, leaf, woof ; poses: sit, bark, beg, play
game.photo.lock('sticker', 'woof')
game.photo.registerFrame('den', { name: 'Den wall', inset: [4, 4], draw(ctx, w, h, { place, day }) { /* 2D canvas, w x h pixels */ } })
game.photo.registerFilter('rain', { name: 'Rainy day', css: 'saturate(.8) brightness(.95)', tint: ['#6f8fb0', 0.15, 'soft-light'] })
game.photo.registerSticker('camp-kc', { name: 'Camp KC', draw(ctx, size) { /* centred on 0,0 in a size x size box */ } })
game.photo.setFrame('postcard' | null) ; .setFilter(id | null) ; .setZoom(1..3) ; .setPose('sit' | null)
game.photo.addSticker('paw', { x: 0.3, y: 0.4, size: 0.17 })   // -> index or -1 (x, y are 0..1 of the screen, at most 12) ; .removeSticker(i?) ; .clearStickers()
game.photo.available('frame')   // [{ id, name }] the player can pick now ; .all('frame') adds { locked } ; available('zoom') -> boolean
game.photo.state()              // { frame, filter, stickers: [ids], zoom, pose }
```

In photo mode a tools row appears above Snap / Done with one button per unlocked kind (Frame, Colour, Zoom, Pose, Stickers); the
player cycles through them, adds stickers from a tray and drags them. The saved PNG gets the same filter, frame and stickers, and
`photoTaken` carries `{ x, z, zone, frame, filter, stickers, zoom, pose }`. `game.ui.lastPhotoCanvas` is the last saved picture
(for a photo wall: copy it at once, it is replaced by the next snap; the core does not store photos). Registered items are unlocked;
give them `enabled: () => boolean` to hide them. Nothing here is saved by the core.

### Putting things in the world (`game.place`, `js/seams.js`)

Coordinates: +x east, +z south, yaw 0 faces south (+z), `Math.PI / 2` faces east. Every `place.*` call returns a handle with
`id` and `remove()`; give ids a prefix per feature (`'m3:giver'`) and clear a whole feature with `game.place.removeAll('m3:')`.

```js
/* where things are -> { x, z, yaw } on open ground, yaw = KC facing the thing; null if unknown */
game.place.door('bakery')              // 2.6 units outside the door of a BUILDINGS id (tailor, pets, toys, cafe, bikes, chandlery, fuel, cityhall ...)
game.place.beside('pets', 1)           // beside that door, along the shop front (side -1 / 1); also returns ry for a shelf that faces the street
game.place.stall('Tag & Stamp')        // 3.6 units in front of a STALLS entry ; game.place.cart('Biscuit Wheel') ; game.place.sign('welcome')
game.place.clear(x, z, r)              // dry, inside the map and not blocked?
game.place.groundY(x, z)

/* a dot on the minimap and map, an optional light pillar / compass pin / prompt */
game.place.marker({ id: 'm3:glove', x, z, label: 'Lost glove', color: '#ffd23c', icon: 'paw', beacon: true, compass: true,
                    prompt: 'Sniff the glove', r: 2.6, enabled: () => true, onInteract: () => {} })

/* a prop with a prompt on the open ground in front of it */
game.place.stand({ id: 'shop:treats', kind: 'stall', x, z, ry: 0, name: 'Trail Treats', col: 0xd9534f, prompt: 'Look at the treats', onInteract: openTab, marker: true })
game.place.shelf({ id: 'merch:mugs', ...game.place.beside('cafe', 1), name: 'Mugs', prompt: 'Look at the mug shelf', onInteract: () => game.shop.open('merch') })
game.place.counter({ id: 'shop:tailor', ...game.place.door('tailor'), prompt: 'Visit the tailor', onInteract: () => game.shop.open('wardrobe'), marker: { label: 'Tailor' } })   // prompt only, at an existing shop or stall
game.place.prop('bench', x, z, { id: 'fund:bench', ry: 1.2 })        // = game.spawnProp, but tracked by id

/* a person who stands there, turns to KC and waves */
const giver = game.place.npc({ id: 'm1:giver', x, z, yaw: 0, name: 'Postmaster Wren', look: { shirt: 0x3f7fd6, hat: 'cap' }, prompt: 'Talk to Wren', onInteract: npc => startMission(), marker: { label: 'Paper round' } })
giver.walkTo(x, z, 1.6, npc => {}) ; giver.follow(true, 2.4) ; giver.follow(false) ; giver.wave() ; giver.remove()   // lost children that follow a bark: follow(true) on `bark`

/* trigger zones */
game.place.zone({ id: 'm9:echo1', x, z, r: 6, once: true }, zone => {}, zone => {})     // onEnter, onExit ; or { rect: [x0, z0, x1, z1] }

/* floating things KC collects by touching them: flag, disc, lantern, litter, star, parcel, paper, bucket, glove, pumpkin, treat */
game.place.pickup({ id: 'm14:flag3', kind: 'flag', color: 0xd9534f, x, z, onCollect: () => count++, marker: true })   // emits `collect` { id, kind, x, z }

/* a world object that changes look by level: KC's den, a business, the Lantern Fund, the Town Fund */
const den = game.place.staged({ id: 'den', x: -150, z: -172, ry: 0, level: savedLevel, stages: [
  { kind: 'tent', col: 0xd9534f },                                                               // level 0: Pup Tent
  [{ kind: 'building', style: 'shed', w: 5, d: 4, h: 3, col: 0x9a6a42, roof: 'gable', f: 's' }, { kind: 'bench', dx: 4, dz: 1 }],   // level 1: parts, dx / dz in the object's own space
  (x, z, ry, level) => game.spawnProp('campfire', x + 3, z + 3)                                  // or build it yourself: return thing(s) with remove()
] })
den.setLevel(2) ; den.level ; den.remove()        // emits `stageChanged` { id, level } with a puff of sparks ; setLevel(n, true) is silent
game.place.staged({ id: 'fund', x, z, additive: true, level: -1, stages: [...] })   // additive: every stage up to the level stays (bench, then fountain, then lanterns) ; -1 = nothing yet
```

`planter` takes `{ w, d }`, `boat` `{ ry, col }` and `hydrant` `{ col }`. `kind` is any `game.spawnProp` kind: `bench`, `lamp`, `signpost` {text}, `stall` {name, col, ry}, `shelf` {name, col, items: [colours], ry}, `tent` {col, ry},
`crate`, `log`, `table`, `fence` {x1, z1}, `hedge`, `deck`, `flag`, `planter`, `bin`, `boulder`, `haybale`, `pumpkin` {s, deco}, `campfire`, `cart` {name, col, ry},
`noticeboard` {title, ry}, `stage` {ry, col}, `fountain` {r}, `agility`, `boat`, `railcar`, `hydrant`, `mailbox`, `umbrella`, `marker`, `building` {w, d, h, col, roof, f, sign, kind}
(inside `staged` parts write a building's kind as `style`). Shops have no interiors: a "shop" is a prompt at its door (`counter`) or a `shelf` / `stand` outside it.

Things KC carries in her mouth: `game.addCarriable({ id, kind: 'ball' | 'treat' | 'stick' | 'parcel', label, x, z, mesh?, onUse?, useLabel? })`
-> item with `remove()`, `throwTo(x, z)`; events `carry`, `drop`, `fetch`.
Raw registry calls (also at `game.api.*`): `game.addMarker(o)`, `game.addInteractable(o)`, `game.addZone(o, onEnter, onExit)`, `game.spawnProp(kind, x, z, opts)`,
`game.npcs.addPed({ pts: [[x, z], ...], loop }, look?, name?)` (a walking person), `game.npcs.addStander(o)`.

### Objectives and timed runs

```js
game.setObjective({ x, z, label: 'Fogline Coffee', color: '#ffd23c' })     // compass pin, minimap and map dot, light pillar, distance on the HUD ; getPos: () => thing also works
game.setObjective({ label: 'Bark at the echo points', progress: '1/3' })   // text only: no pin, shows the progress instead of a distance
game.setObjective(null)

const run = game.timedRun({ id: 'm2', label: 'Paper round', seconds: 95,          // leave seconds out for a stop-watch that counts up
  checkpoints: [{ x, z, r: 3, label: 'Flour & Paw Bakery' }, { x, z }],           // reached in order; the next one is the objective
  onCheckpoint: (i, run) => {}, onFinish: ({ ok, time, left, reason }) => {} })   // reason: done | time | cancelled | replaced
run.finish(true) ; run.cancel() ; run.addTime(10) ; run.time ; run.left ; run.index ; game.run   // game.run = the run in progress or null
game.ui.setTimer('Till: 60 / 60')      // the same HUD chip for your own readout ; setTimer(null) hides it
```

One run at a time. The last checkpoint finishes the run; the clock running out fails it; with no checkpoints the module calls
`run.finish(true)`. Events `runStart`, `runCheckpoint` { id, index, total }, `runEnd` { id, ok, time, left, reason }. Timers are for
play (a race, a delivery); never put a countdown on an offer or a price.

### Fast travel

```js
const off = game.travel.add({ id: 'den', name: "KC's Den", x: -150, z: -168, yaw: 0, enabled: () => denLevel >= 2 })   // a blue diamond and a button on the world map
game.travel.go('den') ; game.travel.list() ; game.travel.remove('den')
game.fastTravel(x, z, yaw, { name: 'Scappoose', id: 'sign:scappoose' })   // -> boolean: fade, KC steps off any ride, moves, followers come too. Emits `fastTravel`
game.travel.blocked = 'Finish the delivery first'                          // hold travel during a mission ; null frees it
```

Other world controls a den or a mission may want: `game.world.setTime(hours)` (a nap), `game.world.setRain(0..1)`,
`game.ui.fade(midpointFn)`, `game.kc.teleport(x, z, yaw)` (no fade), `game.kc.frozen = true` (holds her still during a scene).

### Screens (`game.ui`, `js/hud.js` + `js/uikit.js`)

```js
const h = game.openModal({ id, title, html | node | render(body, handle), actions: [{ label, primary, danger, onClick, keepOpen }],
                           onClose, wide, wallet: true, className, dismissable, pause })   // -> { id, body, close(), refresh(), setTitle() }
game.closeModal(id?)             // screens stack: closing one shows the one underneath ; game.ui.closeAll()
game.toast('text', { icon, kind: 'good' | 'warn' | 'gold', ms }) ; game.banner('Mission complete', 'Paper round')   // the banner steps down below the toasts if the two would overlap
await game.ui.confirm(title, text, yesLabel, noLabel)            // -> boolean
game.ui.addMenuItem({ id, label, icon, order, onSelect })        // an entry in the pause menu (Missions, Den ...)
game.ui.addHudButton({ id, icon, label, title, onClick })        // a button next to map / photo / pause: use sparingly, the phone HUD is full
game.ui.addSetting({ id, label, type: 'check', get: () => on, set: async v => {} })   // or type: 'button', button: 'Restore', onClick
```

`wallet: true` shows the bones and gems balance in the header (live). `refresh()` redraws and keeps the scroll position. A modal with
`pause: true` (the default) stops the simulation while it is open. `Esc`, the close button and a tap outside close a dismissable modal.

**The Shop screen** hosts every module's tab: a strip of 44 px tabs that scrolls sideways and stays pinned while the body scrolls.

```js
const off = game.shop.registerTab({ id: 'wardrobe', title: 'Wardrobe', icon: 'star', order: 20, badge: () => newItems || 0,
  render(pane, game, handle) { pane.appendChild(game.ui.heading('Hats', 'Stitch & Sit Costume Tailor')); pane.appendChild(game.ui.grid(cards)); } })
game.shop.open('wardrobe')   // opens the Shop on that tab (from a world prompt) ; open() reopens the last tab
game.shop.refresh()          // redraw after a purchase (keeps tab and scroll place) ; game.shop.current ; game.shop.tabs
```

`order` sorts the tabs (lower = further left; as built: upgrades 10, wardrobe 20, rides 30, den 40 (with buddies), businesses 60, funds 70,
journal 80, KC Gear 90, store 100). The strip jumps to the open tab without animation, so the chosen tab is always in view on a phone. Registering a tab with an existing id replaces it. A "Shop" entry appears in the pause menu once a tab exists.
Emits `shopTab` { id } on register and `shopTabOpen` { id } when a tab is shown.

Shared pieces, so the tabs look alike:

```js
game.ui.item({ id, title: 'Ranger hat', text: 'A wide brim for sunny trails', swatch: 0x6f8f4f /* or icon: 'star', or node */, swatch2,
               price: { bones: 150 } /* or { gems: 40 }, { gems: 40, bones: 2000, either: true }, or priceLabel: '$2.99' */, tag: 'Owned',
               locked: 'Needs 200 jumps', on: true, onPreview: () => game.cosmetics.preview(id), button: { label: 'Get', onClick, disabled, primary } })   // -> element
game.ui.grid([itemOptions | element, ...]) ; game.ui.heading('Hats', 'sub-line') ; game.ui.price({ bones: 150 }) // HTML string
game.ui.progress(120, 400, '120 of 400 bones') ; game.ui.note('Bones cannot be bought with money.', 'warn' | 'good' | '')
game.ui.tabs(host, [{ id, title, icon, badge, render(pane) }], { current, onChange })   // the same tab strip inside your own screen -> { select(id), redraw(), current }
game.ui.esc(text) ; game.ui.el(tag, attrs, html) ; game.ui.icon(name, size)
```

Icons: `bone gem paw pause map camera jump bolt bark sit dig shake hand gear close ball whistle flag star`.
CSS classes: `.btn.go`, `.btn.alt`, `.btn.danger`, `.chip`, `.menu`, `.set`, `.stats`, `.items`, `.item`, `.pc`, `.note`, `.prog`, `.sech`.

**Spending bones or gems** (spec 3.5: two steps, price and balance afterwards on screen):

```js
if (await game.ui.confirmSpend({ id, name: 'Ranger hat', text: 'A wide brim for sunny trails', price: { bones: 150 }, swatch: 0x6f8f4f, source: 'shop:tailor' })) {
  game.economy.grant({ items: [id] }, 'shop:tailor'); game.cosmetics.equip(id); game.shop.refresh();
}
```

It resolves `true` only after the wallet was charged (emits `purchase` { id, name, price, source }); when the player is short it says by how much and resolves `false`.

### Grown-ups: the gate, the spending switch, links that leave the game

```js
if (await game.ui.gate({ reason: 'This opens the real-money shop.' })) { ... }   // -> boolean
game.grownUp.spending                 // boolean, false by default (state.settings.spending, kept through "Start over")
await game.grownUp.setSpending(true)  // gate, then on ; setSpending(false) needs no gate. Emits `spending` { on }
game.grownUp.showSwitch = true        // store.init sets this: Settings then shows "Real-money shop (grown-ups only)"
game.grownUp.storeOff, .switchLabel   // set by store.init in a Play app with no store: the switch then only opens the real-gear shelf, and says so
await game.ui.openExternal({ url: 'https://kcbeyondlimits.com/product/34460072', name: 'the KC Beyond Limits shop', note: 'Printed to order; shipping is added at checkout.' })
```

- The gate asks a times-table question (6 to 12 times 6 to 9) answered on an on-screen number pad, so no device keyboard opens.
  Nothing about the answer is stored or sent. Three wrong tries close it: 30 seconds, then 2 minutes, then 10 (the closing time is kept in `state.settings.gate`, so a reload does not reopen it; a pass clears it). Emits `gate` { ok }.
  It is a deterrent for a child, not proof of age.
- While `game.grownUp.spending` is false the store shows only "Ask a grown-up to turn on the shop". Use the gate again before every real-money
  screen, the merch claim and restore, as the spec says.
- `openExternal` accepts `https:` only, runs the gate, shows "You are leaving KC: Open Trail for <name>, a separate website" with the host
  name and your note, and opens the page in a new tab with `rel="noopener noreferrer"`. The game requests nothing from that site. Never build
  an `<a target="_blank">` yourself.

### Channels: the Google Play app and the open web (`js/channel.js`)

The same files run in two places, and the store behaves differently in each. `main.js` calls `detectChannel(window)` once at boot
and puts the answer in `game.channel`:

| `game.channel` | Where | Real-money store |
| --- | --- | --- |
| `'web'` | any browser, and the web app added to a home screen | none (owner decision 2026-11-19: no Stripe for this game). No Store tab, no price, no dollar hints; only the localhost test double (`?debug=1&mock=1`) still runs the old Stripe path for the tests |
| `'play'` | the Android app from Google Play (a Trusted Web Activity) | never Stripe. `PLAY_BILLING = 'off'` in `js/store-config.js` (the default): no store at all. `'on'`: Google Play Billing |

Why: Google Play's payments policy requires Google Play Billing for digital goods sold inside a Play app and forbids leading
people to another way to pay (links, buttons, wording). The US programmes that allow an outside payment page need enrolment,
native Android code that the Trusted Web Activity shell does not have, and still carry Google's fee, so they are not used.
Physical goods are outside that rule. Even so the real-gear shelf (`merch.js`) is shown only on the web (behind the switch,
the gate and the "You are leaving the game" screen); in the Play app it is off unless the owner sets `PLAY_REAL_GEAR = 'on'`
(Google Play's Families policy on commercial content shown to children).

How the Play app is recognised (first match wins; details and the reasoning are at the top of `js/channel.js`):

1. the address carries `?src=play`. **The Android shell's start URL must be `/games/kc-open-trail/?src=play`.**
2. `document.referrer` starts with `android-app://` and the page is not in a browser tab (`display-mode` is not `browser`).
3. `sessionStorage['kc-open-trail-channel'] === 'play'`: the same tab after a reload ("Start over", a lost GL context).
4. `localStorage['kc-open-trail-channel'] === 'play'` and the page is not in a browser tab: a later launch of the installed app.
   A Chrome tab on the same phone shares storage with the app and is still the web.

What follows `game.channel === 'play'`:

- `game.showUsd` is `false` (in every shipped build now, the web included, since the web sells nothing): the "about $X" hints beside gem prices (`shop.js`, `uikit.js`, the Trail Journal) are not drawn,
  because the only real price a Play app may show is the one Google Play gives.
- `store.js` never calls `/stripe/checkout` or `/stripe/claim`, drops a `?cs=` return link without asking anyone, and shows no
  dollar price from its own catalogue. The worker also refuses `/stripe/checkout` for an `ot_` SKU when the body says
  `channel: 'play'` (a second lock; the worker cannot tell the app from a browser by itself).
- With `PLAY_BILLING` off: no Store tab, no pass column or pass price in the Trail Journal, no limit / restore rows in Settings,
  `game.grownUp.storeOff = true`, and Settings has no grown-ups switch at all (unless the owner sets `PLAY_REAL_GEAR = 'on'`,
  when it reads "Real KC gear shelf (grown-ups only)"). On the web `storeOff` is also true and the switch reads the same,
  because the web has no store but does have the real-gear shelf.
- With `PLAY_BILLING` on: see `game.modules.store` below.

Settings has a "Privacy policy" row in both channels: a plain link to `/kc-open-trail/privacy.html` on the same origin (so it
stays inside the app with no address bar). In a browser tab it opens beside the game; in the app it takes the game's place and
Back returns. It is the only link in the game that needs no gate, and it is not an outside website.

For the Android shell (the recipe is in `android/`): start URL as above, the game's own package name, and that package's
upload-key and Play app-signing SHA-256 fingerprints in `site/.well-known/assetlinks.json`. Without the second fingerprint the
app shows a browser address bar. `manifest.webmanifest` has `name`, `short_name`, `start_url` and `scope` `./`, `display`
`fullscreen`, `orientation` `any`, both colours, and 192 / 512 / maskable-512 PNG icons. The service worker serves the shell
offline whatever the query string, so `?src=play` starts without a network.

### Saving (`js/save.js`)

```js
const data = game.moduleData('upgrades', { levels: {}, den: 0 })   // a live object inside state.modules.upgrades; missing keys are filled from the defaults
data.levels.legs = 2; game.save.save();                            // saved anyway every 20 s, on pause, on every modal open and when the tab hides
game.save.keepOnReset('store')                                     // this module's data survives "Start over" (install id, applied purchase sessions, Trail Key)
game.on('beforeSave', state => { /* last chance to write into your module data */ })
```

One namespace per module, named after the module (`economy`, `upgrades`, `shop`, `missions`, `store`, `merch`, `guide`; the store also keeps `storeTrail`, the Trail Journal's free column, which resets with the save); JSON only. Shared maps the
core saves for everyone: `state.owned` (through `grant` / `use`), `state.equipped` (through `game.cosmetics`), `state.flags` (through `setFlag`),
`state.upgrades` (free for the upgrades module: id -> level). "Start over" clears everything except `state.settings` and the namespaces passed to
`keepOnReset`; a store that sold a permanent item should re-grant it in `init` from its own kept record.

Debug hooks (only with `?debug=1`, on `window.__ot`): `state()`, `start()`,
`teleport(x, z, yaw)`, `give({ bones, gems, items })`, `grant(what, source)`,
`setFlag(key, value)`, `festival(on)`, `setTime(h)`, `setRain(0..1)`,
`setQuality(q)`, `setCam(yaw, pitch, dist)`, `step(n, dt)`, `info()`,
`frameStats()` / `resetFrameStats()`, `press(action)`, `hold(keyCode, down)`,
`enter(rideId)`, `exit()`, `rides()`, `transit()` (train and tram), `districts()`, `zoneAt(x, z)`,
`surfaceAt(x, z)`, `heightAt(x, z)`, `save()`, `startMission(id)` and
`completeMission()` (these two call `game.modules.missions.start / .complete`
when the missions module provides them), `emit(type, data)`, `events` (recent
bus events), `follow(opts)` / `unfollow(id)` / `followers()`, `tune(kind, patch, source)` / `tuning(kind)`,
`mod(id, mods, opts)`, `travel(x, z, yaw, opts)`, `modules()` and `game`. `state()` also reports `run`, `followers`,
`equipped` and `spending`.

## The feature modules as built

Seven modules boot after the core, in this order: `economy`, `upgrades`, `shop`, `missions`, `store`, `merch`, `guide`.
Each file's header comment is the full reference; this is the map.

| Module | Files | What it owns | Saved in |
| --- | --- | --- | --- |
| `economy` | `js/economy.js`, `css/economy.css` | The price table: 30 ladders (46 tracks), every bones and gem item, `ECON_SCALE`, free gems (one per new district, three daily sniff-outs worth 2 gems), the 10-minute Undo on gem purchases. Extends `game.economy`. | `state.upgrades` (id -> level), `modules.economy { owed, met, daily, undo }` |
| `upgrades` | `js/upgrades.js` | What the ladders do in the world: modifiers, ride tuning, KC's Den (six stages, pay-later bar, nap, bowl, decor with full refund, gold trim), Trail Buddies and the Whistle, the three businesses and their tills, the Lantern Fund, the Town Fund, Trail Markers. | `modules.upgrades { tills, decor, paid, bowl, called, wall, planning }` |
| `shop` | `js/shop.js` | Six Shop tabs (`upgrades`, `wardrobe`, `rides`, `den`, `businesses`, `funds`) and the ten door / stall prompts `eco:shop:*`. | `modules.shop { outfits }` |
| `missions` | `js/missions.js`, `js/activities.js`, `css/missions.css` | 16 story missions, 8 Fog Bell Festival activities (only while the `festival` flag is on), the journal (pause menu: Missions), three weekly trail tasks, the Sand Island ferry. Bones only. | `modules.missions { done, best, paidAt, extra, clock, bones, runs, weekly, way, ferry }` |
| `store` | `js/store.js`, `js/store-config.js`, `css/store.css` | The real-money catalogue (16 SKUs), the device limit, the purchase journal, restore by Trail Key, and the Trail Journal (30 steps: free column and pass column). Tabs `journal` and `store`. | `modules.store` (kept through "Start over"), `modules.storeTrail` (resets with the save) |
| `merch` | `js/merch.js`, `css/merch.css`, `merch.json`, `img/merch/*.jpg`, `tools/sync-merch.js` | The KC shelves in the world, the 14 bones twins, the 54 real products behind the gate, the leaving screen, the honour-basis claim. Tab `merch` ("KC Gear"). | `modules.merch { claimed }` (kept through "Start over") |
| `guide` | `js/guide.js` | First steps for a new player: points at the first job, then at Tailwind Pet Supply for the first upgrade, then steps aside. Pays and charges nothing. | `modules.guide { step, told }` |

### How they fit together

- **One wallet.** Every payout and every charge goes through `game.economy.grant` / `spend` (`js/api.js`). Mission pay uses sources
  `mission:<id>`, `activity:<id>`, `weekly`; tills `till:<id>`; the store `store:<sku>`, `store:restore`, `store:kept`, `journal`, `journal:pass`;
  merch `merch:<shelf>`, `merch:claim`, `merch:claimed`. The store refuses any grant that carries bones.
- **One item table.** Every id the worker's `OT_GRANTS` can grant is defined by `economy.js` (wearables and den props), except four that
  other modules handle: `pass:trail` and `frame:supporter` (`store.js`), the treat bundles `treat:3` / `treat:10` (granted by `store.js` as
  `{ id: 'treat:party', n }`), and `den:gold-trim` (`upgrades.js` draws a gold arch at the den while it is owned). Merch twins are defined by
  `merch.js` with `game.cosmetics.define` (`decor:river-bed` and `decor:camp-mug` by `economy.js`). The smoke test fails if a grant, a
  Trail Journal reward or a twin names an id nobody defines.
- **Daily sniff-outs have one owner:** `economy.js` makes and pays them; the missions journal only shows `economy.daily()`.
- **The Trail Journal's free column has one owner:** `store.js` (auto-paid as steps are reached, bones and 30 gems in all).
- **The last story mission (Cart Runner) hands over the Biscuit Cart:** `missions.js` calls `economy.buyLevel('biz:cart', { free: true })` the
  first time it is won. Before that the cart can simply be bought for its 800 bones.
- **The den's planning board** (River Cottage) calls `missions.open('board')`, the mission list under another title.
- **Loose bones come back slowly:** `economy.js` sets `game.rewards.boneRespawn` to `BONE_RESPAWN` (3,000 to 3,600 s; the core's own default
  is 100 to 140) so that sweeping the map over and over does not out-earn the jobs. Dig spots rest 30 minutes (`DIG_COOLDOWN`) and fetch pays for the first 6 fetches in any 10 minutes of play (`FETCH_PAID`, `FETCH_WINDOW`). The comment beside the constant has the measurements.
- **Prices scale together:** `economy.ECON_SCALE` (1.0) multiplies every bones price (`economy.price(n)`); `merch.js` uses it for the twins. It is the price knob only: mission pay, weekly task pay, tills, digs and loose bones do not move with it (spec 3.3).
- **Tills earn only while the game is played** (the `second` event). Nothing accrues while the game is closed; the spec asks for exactly that.
- **Shop tabs, left to right:** upgrades 10, wardrobe 20, rides 30, den 40, businesses 60, funds ("Town") 70, journal 80, merch ("KC Gear") 90, store 100.
- **Prefixes of placed ids:** `eco:` (den, businesses, funds, shop doors), `msg:` / `ms:` / `fest:` / `ferry:` (missions), `merch:` (shelves), `guide:` (the one first-steps marker).

### `game.economy`, extended by `economy.js` (also `game.modules.economy`)

```js
E.ECON_SCALE ; E.BONES_PER_GEM (50) ; E.price(bones)                    // scaled whole bones
E.level(id) ; E.maxLevel(id) ; E.ladder(id) ; E.ladders(group?) ; E.nextCost(id)   // null at the top
E.check(id)                         // { ok, cost, reason: 'unknown' | 'max' | 'owed' | 'locked' | 'bones', text, short }
E.buyLevel(id, { paid, free })      // charges the bones itself; paid: confirmSpend already charged; free: a reward. Emits `upgrade` { id, level, cost, ladder, how }
E.setLevel(id, n, { force })        // never charges (rewards, tests)
E.owed(id) ; E.pay(id, n)           // the den's pay-later bar. Emits `upgradePaid`
E.item(id) ; E.items(filter) ; E.itemPrice(id) ; E.checkItem(id, 'bones' | 'gems') ; E.buyItem(id, currency, { paid })   // emits `itemBought`
E.undoable(id) ; E.undo(id) ; E.usd(gems) ; E.daily() ; E.totals()
```

Ladder ids: `legs lungs paws sniffer paddle nose mitts ball saddlebags pouch camera wheels trucks popdeck cedar keel drybox engine tyres rack
den denstore buddy:<dog> whistle biz:cart biz:canoes biz:pumpkins lantern marker:<sign> town`.

### `game.modules.upgrades`

`sites`, `home`, `biz`, `rate(id)` (bones a minute), `cap(id)`, `till(id)`, `collect(id)`, `collectAll()`, `maxIncome()` (19.25), `nap(hour)`,
`bowl()`, `denSlots()`, `placeDecor(id)` / `removeDecor(id)`, `dogs`, `hearts(dog)`, `callBuddy(dog)` / `sendHome(dog)`, `useTreat(id)`,
`goldTrim()`. Events: `till`, `decor`, `nap`, `buddy`, `buddyGreet`, `treatUsed`, `planningBoard`, `photoWall`.

### `game.modules.missions`

`list()`, `get(id)`, `start(id, { force })`, `retry(id)`, `leave()`, `active()`, `isDone(id)`, `count(id)`, `stats()`, `open(tab)` with tab
`missions | festival | tasks | board`, `showWay(id)`, `ferry(to)`, `tasks()`, `complete()` / `fail()` (debug). Events: `missionStart`,
`missionComplete` { id, name, first, bones, festival, count }, `missionFail`, `missionLeave`, `ferry`, `taskDone`, `tasksAllDone`.
A running mission sets `game.travel.blocked`. First-time pay totals 1,800 bones (the tutorial 50); a replay pays its job rate in full once
in every 40 minutes of play (`JOB_WINDOW`, counted on the module's own clock: a nap or a new game day changes nothing), one extra run in between pays a tenth and any more pay 1 bone. Mission ids: `bell paper patrol shuttle castle lunch sniff creek echo mill train haul corn flags walk carts`.

### `game.modules.store`

`catalog` (16 SKUs), `sku(id)`, `price(id)`, `contents(id)`, `sellable(id)`, `owns(id)`, `open()`, `buy(sku)`, `restore()`, `limitScreen()`,
`setLimit(cents)`, `gate(reason)`, `limit`, `spent30()`, `room()`, `journal()`, `key`, `steps`, `passItems`, `trail`. Events: `storeOpen`,
`storeCheckout`, `storePurchase`, `storeRefused`, `storeRestore`, `storeCap`, `journalStep`. Flags: `store:starter`, `store:pass`, `store:supporter`.

- As shipped `js/store-config.js` holds placeholders, so every item says "Coming soon", nothing can be bought and the game makes no request.
  The owner's steps are in `marketing/kc-open-trail/MONETIZATION.md`.
- While `game.grownUp.spending` is false the Store tab shows only "Ask a grown-up to turn on the shop." The gate is asked to open the store,
  again on every Buy, and before restore and the limit screen.
- Mock mode (a pretend payment page, for tests) exists only on `localhost` / `127.0.0.1` and only with both `?debug=1` and `?mock=1`; on the live site the words do nothing.
- `/stripe/checkout` answers `{ url, session }`; the game writes the session id into `pending` before leaving, so a payment whose return link opens in another browser or app can be finished from the Store ("Finish adding it") in the browser that started it.
- "Start over" (`ui.resetNotes`, an array of `() => ({ text, gate }) | null`): the store says what is kept and, once real money has been spent on the device, puts the grown-up gate first. Kept: Store purchases, purchased gems not yet spent, and the things purchased gems bought (`modules.store.gemItems`).
- `merch.js` never turns the real-money switch on: with it off, the KC Gear tab only offers a button that opens Settings.
- Channel fields: `channel` (`'web'` / `'play'`), `hasStore` (false in a Play app with `PLAY_BILLING` off: then `open`, `buy`,
  `restore`, `limitScreen` and `setLimit` all answer false and no tab or Settings row is registered), `playBilling`,
  `playReady` (Google Play has answered with prices), `restorePlay()`. In the Play app `price(id)` is Google Play's price
  string, or `''` when Google has not returned that item.
- **Google Play Billing** (`PLAY_BILLING = 'on'`, Play channel only). Item ids in Play Console must equal the 16 `ot_` SKUs:
  consumable (consumed after each purchase) for `ot_gems_*`, `ot_treat_*` and `ot_tip_3`; non-consumable for `ot_starter`,
  `ot_trail_pass`, the four `ot_pack_*`, `ot_supporter` and `ot_everything`. Do not enable multi-quantity on any of them.
  - After the gate that opens the store, `getDigitalGoodsService('https://play.google.com/billing')` then `getDetails(all 16)`.
    A card shows the price Google returned (`Intl.NumberFormat` in the price's own currency). An item Google did not return,
    or every item when the Digital Goods API or `PaymentRequest` is missing, says "Coming soon", shows no price and cannot
    be bought.
  - Buy: the same checks, gate and confirm screen as the web, then `new PaymentRequest([{ supportedMethods, data: { sku } }])`.
    `response.details.purchaseToken` goes to the worker: `POST /ot/play-claim { sku, token, install, key? }`. The grant in the
    answer goes through `grantProblem` and `game.economy.grant` exactly as a Stripe grant does. A consumable is then also
    consumed on the device (`service.consume`) so it can be bought again at once.
  - The worker (`handleOtPlayClaim`) asks `purchases.products.get` for `OT_PLAY_PACKAGE` (the game's package; Dewclaw's
    `PLAY_PACKAGE` is untouched), refuses anything that is not purchased (`purchaseState` 0), not that SKU, or a consumable
    already consumed, writes one record per token (`otplay:<hash>` in KV), then calls `:consume` or `:acknowledge`. A replay
    answers `already: true` with the same grant. A permanent item claimed from another install is checked with Google again
    and comes back with `gems: 0` and `restored: true`; a consumable claimed from another install is refused.
  - Restore and repair: `listPurchases()` when the store opens and from "Restore from Google Play". Every token not yet in this
    save is claimed, so a purchase whose answer was lost, or a permanent item bought on another device, is added then. The
    purchase token is never saved; only a hash of it is kept (`applied`), on the device and in the worker.
  - The device limit counts each purchase at its US list price (`cents`), whatever currency Google charged; the journal line
    shows Google's price. Trail Keys are issued for permanent Play purchases too and work as on the web.
  - Not built: a Voided Purchases check. A refund made in Play Console after a claim does not take the item back.
- The worker side is `worker/dewclaw-worker.js` (`OT_GRANTS`, `OT_PRICES`, `/stripe/checkout`, `/stripe/claim`, `/ot/restore`, `/ot/prices`, `/ot/play-claim`);
  `worker/test.js` holds the game's `CATALOG` and the worker's table together.

### `game.modules.merch`

`twins`, `shelves`, `products()`, `product(id)`, `url(id)` (always `https://kcbeyondlimits.com/product/<digits>`, built in code), `priceLine(p)`,
`open(shelf)`, `buyTwin(id)`, `openReal(shelf)`, `openProduct(id)`, `openClaim(twin)`, `claimed()`, `winterOpen(date)`, `syncWinter()`.
Modal ids `merch-real`, `merch-leaving`, `merch-claim`. Events: `merchClaim`, `external`.

- The children's side is bones only: no dollar price, no product picture, no link. The real products need the spending switch and the gate.
- `merch.js` has one `fetch`: the same-origin `merch.json` at boot. The claim is local and on trust (the worker has no `/ot/merch-claim` yet).
- Run `node tools/sync-merch.js --live --accept` before every release and around every shop sale; `--check` verifies the file and the pictures.

### `game.modules.guide`

`step()` (0 new, 1 pointed at the first job, 2 pointing at the shop, 3 finished), `restart()`. Emits `guide` { step }. It uses
`missions.showWay('bell')`, one marker `guide:shop` at the pet supply door and three toasts; any purchase ends it.

## The `game` object

| Field | What it is |
| --- | --- |
| `game.bus`, `game.on(type, fn)`, `game.off`, `game.emit(type, data)` | event bus; `on` returns an unsubscribe function; `'*'` hears everything |
| `game.state` | the saved state object (below). Mutate it, it is saved every 20 s, on pause, on tab hide |
| `game.wallet` | `get(cur)`, `can(cur, n)`, `add(cur, n, reason)`, `spend(cur, n, reason)` -> boolean. `cur` is `'bones'` or `'gems'`. Emits `wallet` |
| `game.rewards` | tunable payouts: `{ bone: 1, goldenBall: { gems: 1, bones: 10 }, dig: [3, 8], photo: 5, sign: 2, fetch: 2, zone: 3 }`. Change values in `economy.init` |
| `game.kc` | KC: `pos` (THREE.Vector3), `yaw`, `speed`, `stamina`, `staminaMax`, `ride`, `carried`, `mods`, `base` (walk/run/sprint/jump/drain/regen/magnet), `frozen`, `teleport(x, z, yaw)`, `doBark/doSit/doDig/doShake()`, `carry(item)`, `drop()`, `isCarrying(kind)`, `capacity()`, `setModifier / getModifier / modifierLeft`, `setCosmetic`, `registerHat / registerOutfit`, `pose(name)` |
| `game.world` | `heightAt(x, z)`, `groundAt(x, z, y)`, `surfaceAt(x, z)` (0 grass, 1 road, 2 trail / gravel, 3 sand, 4 water, 5 paving), `zoneAt(x, z)`, `waterDepth`, `riverSd(x, z, id?)` (signed distance to a river bank), `roadDist(id, x, z)`, `blockedAt(x, z, y, r)`, `addBox/addCircle` colliders, `roads`, `time` (0-24), `day`, `night` (0-1), `rain`, `setTime`, `setRain`, `festival`, `setFestival(on)`, `mapCanvas`, `stack` (Lantern Stack position), `fogBell` |
| `game.cam` | `yaw`, `pitch`, `dist`, `three` (the PerspectiveCamera) |
| `game.npcs` | `peds`, `dogs`, `groups` (wildlife), `standers`, `followers`, `addPed(route, look, name)`, `addStander(o)`, `addFollower(o)`, `removeFollower(id)` |
| `game.economy`, `game.shop` | the seams above |
| `game.cosmetics`, `game.place`, `game.travel`, `game.followers`, `game.photo`, `game.grownUp`, `game.timedRun`, `game.fastTravel`, `game.run` | the module seams above (`js/seams.js`, `js/photo.js`, `js/uikit.js`) |
| `game.vehicles` | `rides`, `cars`, `enter(id)` (a ride id or `'tram'`), `exit()`, `byId(id)`, `reset(id)`, `setSkin(kind, { primary, secondary })`, `setTuning(kind, patch, source)`, `getTuning(kind)`, `transit` = `[train, tram]` (each has `x`, `z`, `speed`, `dir`, `wait`), `train`, `tram` |
| `game.collect` | bones, golden balls, dig spots, carriables; `counts()` |
| `game.ui` | HUD + modal shell (below) |
| `game.audio` | `sfx(name)`: pickup, gold, reward, bark, jump, splash, dig, honk, whistle, bell, pet, ui, door, eat, shutter; `applyVolume()` (honours `settings.muted`) |
| `game.fx` | `burst(kind, x, y, z, n)` particles: dust, splash, dirt, heart, spark, leaf, water |
| `game.channel`, `game.showUsd` | `'web'` or `'play'` (`js/channel.js`); whether "about $X" hints may be drawn (false in the Play app) |
| `game.modules` | results of the seven `init` calls: `economy`, `upgrades`, `shop`, `missions`, `store`, `merch`, `guide` |

### Saved state (`js/save.js`, localStorage key `kc-open-trail-save-v2`)

```js
{ v: 2,
  wallet: { bones, gems },
  owned: {},        // itemId -> true | count      (shop)
  upgrades: {},     // upgradeId -> level           (economy)
  equipped: {},     // slot -> itemId               (game.cosmetics): bandana, harness, collar, hat, tag, trail, outfit, skin:skateboard, skin:canoe, skin:van
  stats: { distance, bones, balls, digs, barks, pets, photos, jumps, swims, rides, talks, bells, fetches, days, playTime },
  collected: { balls: [], photos: [], signs: [], zones: [] },
  pos, time, day, settings: { quality, autoQuality, sound, music, muted, invertY, invertX, leftHanded, rain, camDist, spending },   // spending: real-money shop switch, false until a grown-up turns it on
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
`game.save.reset()` writes a fresh state (keeping `settings` and the module namespaces passed to
`game.save.keepOnReset(id)`) straight to storage without emitting
`beforeSave` and then refuses further saves, so the reload that follows starts
at the spawn with "Play".

Per-module storage: `const data = game.moduleData('missions', { done: [], active: null })`
returns a live object inside `state.modules` (defaults are filled in for
missing keys). Mutate it; call `game.save.save()` if you want it written now.
`beforeSave` fires just before each write.

## Registry API, KC stats, cosmetics and the UI shell

All of these are documented with signatures and examples in **Module seams** above: the registry
(`game.addMarker`, `addInteractable`, `addZone`, `setObjective`, `spawnProp`, `addCarriable`, also at `game.api.*`), modifiers,
cosmetics, ride tuning and the screens in `game.ui`. Two details that live only here:

- An interactable is `{ id, x, z | getPos(), r, label | () => string, icon, prio, enabled(), onInteract() }`. The nearest enabled one
  within its `r` wins; `prio` breaks ties (rides 5, carriables 3, people 2, dig spots 1). While KC is on a ride the prompt is "Hop off".
- A marker is `{ id, x, z | getPos(), icon, color, label, beacon, minimap, edge, compass }`: `beacon` adds a light pillar within 170 units
  (eight at most), `edge` keeps the dot pinned to the rim of the minimap when it is out of view, `compass` adds a pin on the compass.

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
| `trick` | `{ kind: 'ollie', id, speed }` |
| `npcTalk` | `{ id, name, line, where }` KC used a talk prompt; `npcPet` `{ id, name, x, z }` a person petted KC; `npcWave` `{ id, name }` |
| `fogBell` | `{ x, z }` KC rang the Old Fog Bell; `chime` `{ hour }` the courthouse clock struck (heard within 260 units) |
| `dogPlay` | `{ id, name, x, z }` |
| `scatter` | `{ id, kind: 'bird'|'duck'|'squirrel'|'chicken'|'sheep', count, byBark }` |
| `bark`, `sit`, `shake`, `jump` | `{ x, z }` |
| `digStart`, `dig` | `{ x, z }` (`dig` fires when the dig finishes) |
| `swimStart`, `swimEnd`, `land`, `exhausted`, `respawn`, `teleport` | movement moments (`swimEnd` also fires when a teleport lifts her out of the water) |
| `carry` / `drop` | `{ item, id, kind }` (+ `x, z` on drop); `eat` `{ id, kind }`; `throw`, `fetch` `{ id, value }` |
| `honk` | `{ id }` a car, the van, the train (`'train'`) or the tram (`'tram'`) is waiting for someone |
| `timeOfDay` | `{ phase: 'dawn'|'day'|'dusk'|'night', time, day }`; `dayChange` `{ day }`; `weather` `{ rain }` |
| `photoMode` `{ on }`, `photoTaken` `{ x, z, zone, frame, filter, stickers, zoom, pose }` | |
| `boneCollected` | the `pickup` payload, for loose bones only (`kind: 'bone'`) |
| `swim` / `ride` | `{ on, x, z }` / `{ on, id, kind }`: one event for both ends of `swimStart` / `swimEnd` and `vehicleEnter` / `vehicleExit` |
| `talk` | `{ id, name }` KC talked to someone: a townsperson (`npcTalk`) or a person placed with `game.place.npc` |
| `dayNight` | `{ night, phase, time, day }` when night falls (`night: true`) and when dawn breaks (`night: false`) |
| `collect` | `{ id, kind, x, z }` a `game.place.pickup` was collected |
| `followerJoin` / `followerLeave` | `{ id, name, dog, count }` (+ `reason`: `dismissed` or `timeout`) |
| `modsChanged`, `modExpired` | the combined modifiers / `{ id }` a timed modifier ran out |
| `tuningChanged` | `{ kind, tuning }` |
| `equip` / `unequip` / `preview` | `{ slot, id }` / `{ slot }` / `{ slot, id | null }` (`cosmeticChanged`, `skinChanged` are the low-level versions) |
| `runStart`, `runCheckpoint`, `runEnd` | `{ id, seconds, checkpoints }`, `{ id, index, total }`, `{ id, ok, time, left, reason }` |
| `fastTravel` | `{ id, name, x, z, from: { x, z } }` |
| `stageChanged` | `{ id, level }` a `game.place.staged` object changed level |
| `purchase`, `spend`, `itemUsed` | `{ id, name, price, source }` after `confirmSpend` charged; `{ bones, gems, reason }`; `{ id, n, left }` |
| `gate`, `spending`, `external` | `{ ok, reason }`; `{ on }`; `{ host }` a leaving link was opened |
| `photoStyle`, `pose` | `game.photo.state()` after a frame / filter / sticker change; `{ name }` |
| `shopTab`, `shopTabOpen` | `{ id }` a tab was registered / shown |
| `modulesReady` | `{ names }` once, after all seven `init` calls |
| module events | `upgrade`, `upgradePaid`, `itemBought`, `itemUndone`, `buddyMet`, `till`, `decor`, `nap`, `buddy`, `treatUsed` (economy / upgrades); `missionStart`, `missionComplete`, `missionFail`, `missionLeave`, `ferry`, `taskDone`, `tasksAllDone` (missions); `storeOpen`, `storeCheckout`, `storePurchase`, `storeRefused`, `storeRestore`, `storeCap`, `journalStep` (store); `merchClaim` (merch); `guide` (guide). See "The feature modules as built". |
| `objective`, `modalOpen`, `modalClose`, `toast`, `quality`, `cosmeticChanged`, `skinChanged`, `beforeSave`, `saved` | housekeeping |

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
