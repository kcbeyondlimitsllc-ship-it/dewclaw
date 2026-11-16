/* Economy: the one data table for everything bones (and, for cosmetics only, gems) can buy, and the rules for buying it.
   Spec: marketing/kc-open-trail/MONETIZATION-EXPANSION-SPEC.md, sections 2 and 3.

   What lives here
     - ECON_SCALE: every bone price is multiplied by it (tune the whole economy in one place after playtest).
     - LADDERS: the 30 upgrade ladders (Trail Buddies is one ladder for each of the ten dogs, Trail Markers one for each
       of the eight signposts, so 46 purchasable tracks in all). Costs and effects are exactly the spec's table.
     - ITEMS: bones cosmetics, festival costumes, the premium singles (gems, or bones at 50 a gem), bakery treats, den decor.
     - game.economy gains: level, maxLevel, ladder, ladders, nextCost, check, buyLevel, setLevel, owed, pay, price, item,
       items, itemPrice, checkItem, buyItem, undo, undoable, usd, totals, daily. grant / owns / count / use / canAfford /
       spend / setFlag / getFlag / catalog keep the core's contract.
   What does not live here: what an upgrade *does* (upgrades.js listens for the `upgrade` event) and the screens (shop.js).

   Rules kept everywhere: money never reaches this file; gems buy cosmetics only; nothing is random; a balance can never go
   below zero (every charge goes through game.wallet.spend, which refuses when short). */
import { DOG_SPOTS, SIGNPOSTS } from './data.js';

export const ECON_SCALE = 1.0;
/* Seconds before a picked-up loose bone comes back (the core's default is 100 to 140). Set at integration after a bot measured income
   against spec 3.1 (about 150 loose bones an hour early on): a player who only takes bones on her path earned about 170 an hour,
   one who steps up to 8 m aside about 450, and one who does nothing but chase bones about 1,480, more than a repeatable job pays.
   A bone now takes most of a game day (12 minutes) to return; a first pass through any place is unchanged. Measured again with
   this value: about 170 (path only), 220 (8 m aside) and 1,070 (nothing but bones, about what repeatable jobs pay). If playtest
   shows bone-chasing still beats jobs, thin the bones in data.js or raise this further. This is not ECON_SCALE: prices and
   mission pay are untouched. */
export const BONE_RESPAWN = [600, 780];
export const BONES_PER_GEM = 50;          /* any gem price can be paid in bones at this rate; never the other way round */
export const GEM_PACK = { gems: 80, usd: 0.99 };   /* the smallest pack: the rate behind every "about $X" label */
export const UNDO_MS = 10 * 60 * 1000;    /* a gem purchase can be undone for ten minutes */
export const MARKER_SIGNS = ['welcome', 'marina', 'mccormick', 'scappoose', 'farm', 'stjohns', 'square', 'tabor'];

const fmt = n => Math.round(n).toLocaleString('en-US');
const dogKey = name => String(name).toLowerCase();

/* ---------- the 30 ladders ----------
   { no (1..30, the spec's row), id, group, name, where, text, costs: [bones per tier], fx: [what each tier does, in words],
     eff: machine-readable effect for upgrades.js, need: { tier, stat, n, text } a free play milestone, payLater }  */
const L = (no, id, group, name, costs, fx, eff, extra = {}) => ({ no, id, group, name, costs, fx, eff, max: costs.length, ...extra });
const pct = (label, v) => v.map(x => `${label} x${x.toFixed(2)}`);
const BIZ_FX = (rate, cap) => [`Open for business: ${rate} bones a minute while you play, the till holds ${cap}`, 'Better Kit: earns half as much again', `Helper Pup: the till holds ${cap * 2}`, 'Painted Sign: earns a quarter more, and a fresh look'];

function buildLadders() {
  const out = [
    L(1, 'legs', 'abilities', 'Trail Legs', [120, 350, 900, 2200], pct('Sprint speed', [1.05, 1.10, 1.15, 1.20]), { type: 'mod', key: 'speed', v: [1.05, 1.10, 1.15, 1.20] }, { text: 'KC runs faster.', icon: 'bolt', need: { tier: 4, stat: 'distance', n: 5000, text: 'Travel 5,000 paces first' } }),
    L(2, 'lungs', 'abilities', 'Big Lungs', [100, 300, 800, 2000], pct('Stamina', [1.15, 1.30, 1.45, 1.60]), { type: 'mod', key: 'stamina', v: [1.15, 1.30, 1.45, 1.60] }, { text: 'KC can sprint for longer.', icon: 'bark', need: { tier: 4, stat: 'barks', n: 50, text: 'Bark 50 times first' } }),
    L(3, 'paws', 'abilities', 'Spring Paws', [150, 450, 1200], pct('Jump height', [1.07, 1.14, 1.20]), { type: 'mod', key: 'jump', v: [1.07, 1.14, 1.20] }, { text: 'KC jumps higher.', icon: 'jump', need: { tier: 3, stat: 'jumps', n: 200, text: 'Jump 200 times first' } }),
    L(4, 'sniffer', 'abilities', 'Super Sniffer', [80, 250, 700, 1800], pct('Pickup reach', [1.25, 1.5, 1.75, 2.0]), { type: 'mod', key: 'magnet', v: [1.25, 1.5, 1.75, 2.0] }, { text: 'Bones come to KC from further away.', icon: 'paw', need: { tier: 4, stat: 'bones', n: 200, text: 'Sniff up 200 loose bones first' } }),
    L(5, 'paddle', 'abilities', 'Otter Paddle', [150, 450, 1200], pct('Swim speed', [1.10, 1.20, 1.30]), { type: 'mod', key: 'swim', v: [1.10, 1.20, 1.30] }, { text: 'KC swims faster.', icon: 'shake', need: { tier: 3, stat: 'swims', n: 10, text: 'Go for 10 swims first' } }),
    L(6, 'nose', 'abilities', 'Lucky Nose', [400, 1200, 3000, 7000], pct('Bones from pickups and digs', [1.10, 1.20, 1.30, 1.40]), { type: 'mod', key: 'bones', v: [1.10, 1.20, 1.30, 1.40] }, { text: 'More bones from loose bones and dig spots. It does not change jobs or tills.', icon: 'bone', need: { tier: 4, stat: 'digs', n: 25, text: 'Dig 25 times first' } }),
    L(7, 'mitts', 'gear', 'Dig Mitts', [250, 700, 1800], ['A dig pays 4 to 9 bones', 'A dig pays 5 to 11 bones', 'A dig pays 6 to 13 bones'], { type: 'reward', key: 'dig', v: [[4, 9], [5, 11], [6, 13]] }, { text: 'Dig spots pay more (3 to 8 without them).', icon: 'dig', where: 'Tailwind Pet Supply' }),
    L(8, 'ball', 'gear', 'Fetch Ball', [200, 600, 1500], ['A fetch pays 3 bones', 'A fetch pays 4 bones', 'A fetch pays 6 bones'], { type: 'reward', key: 'fetch', v: [3, 4, 6] }, { text: 'Playing fetch pays more (2 without it).', icon: 'ball', where: 'Driftwood Toys' }),
    L(9, 'saddlebags', 'storage', 'Saddlebags', [300, 900, 2400], ['Carry 2 things', 'Carry 3 things', 'Carry 4 things'], { type: 'mod', key: 'carry', v: [2, 3, 4] }, { text: 'KC carries more at once.', icon: 'paw', where: 'Tailwind Pet Supply' }),
    L(10, 'pouch', 'storage', 'Treat Pouch', [200, 600, 1500], ['Hold 2 bakery treats', 'Hold 4 bakery treats', 'Hold 6 bakery treats'], { type: 'pouch', v: [2, 4, 6], base: 1 }, { text: 'Room for more bakery treats (1 without it).', icon: 'bone', where: 'Flour & Paw Bakery' }),
    L(11, 'camera', 'camera', 'Trail Camera', [250, 700, 1800], ['6 photo frames', '5 colour filters and zoom', 'Stickers, 4 KC poses and a photo wall in the den'], { type: 'camera' }, { text: 'More to do in photo mode.', icon: 'camera' }),
    L(12, 'wheels', 'rides', 'Smooth Wheels', [200, 500, 1200], ['Top speed +8%', 'Top speed +16%', 'Top speed +24%'], { type: 'tune', kind: 'skateboard', key: 'max', v: [1.08, 1.16, 1.24] }, { ride: 'skateboard', text: 'Every skateboard rolls faster.', where: 'Channel Cyclery' }),
    L(13, 'trucks', 'rides', 'Carving Trucks', [200, 500, 1200], ['Turning +10%', 'Turning +20%', 'Turning +30%'], { type: 'tune', kind: 'skateboard', key: 'turn', v: [1.1, 1.2, 1.3] }, { ride: 'skateboard', text: 'Every skateboard turns tighter.', where: 'Channel Cyclery' }),
    L(14, 'popdeck', 'rides', 'Pop Deck', [200, 500, 1200], ['Each ollie pays 1 bone', 'Each ollie pays 2 bones', 'Each ollie pays 3 bones'], { type: 'trick', v: [1, 2, 3], every: 5 }, { ride: 'skateboard', text: 'Ollies pay bones (one payout every 5 seconds).', where: 'Channel Cyclery' }),
    L(15, 'cedar', 'rides', 'Cedar Paddle', [250, 600, 1500], ['Top speed +8%', 'Top speed +16%', 'Top speed +24%'], { type: 'tune', kind: 'canoe', key: 'max', v: [1.08, 1.16, 1.24] }, { ride: 'canoe', text: 'Every canoe paddles faster.', where: 'Knot & Oar Chandlery' }),
    L(16, 'keel', 'rides', 'Steady Keel', [250, 600, 1500], ['Turning +10%', 'Turning +20%', 'Turning +30%'], { type: 'tune', kind: 'canoe', key: 'turn', v: [1.1, 1.2, 1.3] }, { ride: 'canoe', text: 'Every canoe turns tighter.', where: 'Knot & Oar Chandlery' }),
    L(17, 'drybox', 'rides', 'Dry Box', [250, 600, 1500], ['Carry 1 more in a canoe', 'Carry 2 more in a canoe', 'Carry 3 more in a canoe'], { type: 'tune', kind: 'canoe', key: 'carry', v: [1, 2, 3] }, { ride: 'canoe', text: 'Room for more while KC is aboard a canoe.', where: 'Knot & Oar Chandlery' }),
    L(18, 'engine', 'rides', 'Tuned Engine', [300, 800, 2000], ['Top speed +5%', 'Top speed +10%', 'Top speed +15%'], { type: 'tune', kind: 'van', key: 'max', v: [1.05, 1.10, 1.15] }, { ride: 'van', text: 'Every van drives a little faster. It stays polite around people.', where: 'Scappoose Fuel & Treats' }),
    L(19, 'tyres', 'rides', 'Trail Tyres', [300, 800, 2000], ['Less slowing off the road', 'Much less slowing off the road', 'No slowing off the road'], { type: 'tune', kind: 'van', key: 'offroad', v: [1 / 3, 2 / 3, 1] }, { ride: 'van', text: 'Vans slow down less on gravel, grass and sand.', where: 'Scappoose Fuel & Treats' }),
    L(20, 'rack', 'rides', 'Roof Rack', [300, 800, 2000], ['Carry 1 more in a van', 'Carry 2 more in a van', 'Carry 3 more in a van'], { type: 'tune', kind: 'van', key: 'carry', v: [1, 2, 3] }, { ride: 'van', text: 'Room for more while KC is aboard a van.', where: 'Scappoose Fuel & Treats' }),
    L(21, 'den', 'home', "KC's Den", [0, 400, 1200, 3000, 7000, 15000], ['Pup Tent: a wardrobe and 4 decor spots', 'Doghouse: 8 decor spots, and a nap to pick the time of day', 'Garden Shed: 12 decor spots, and fast travel home from the map', 'Trail Cabin: 18 decor spots, and a bone bowl (25 bones once a day)', 'River Cottage: 26 decor spots, and a planning board', 'Bluff Lodge: 36 decor spots, a trophy wall, and ride paint is free forever'],
      { type: 'den', slots: [4, 8, 12, 18, 26, 36], stages: ['Pup Tent', 'Doghouse', 'Garden Shed', 'Trail Cabin', 'River Cottage', 'Bluff Lodge'] }, { payLater: true, text: 'A home by Columbia View Park. Move in first, pay it off when you can: no rush, no extra cost.', icon: 'star' }),
    L(22, 'denstore', 'storage', 'Den Storage', [500, 1000, 2000, 4000], [1, 2, 3, 4].map(n => `${n * 6} more decor spots and ${n} more saved outfit${n > 1 ? 's' : ''}`), { type: 'denstore', slots: 6, outfits: 1 }, { text: 'More room at the den.', icon: 'star', req: g => (g.economy.level('den') >= 1 ? null : 'Move into the Pup Tent first') })
  ];
  for (const d of DOG_SPOTS) { const k = dogKey(d.name); out.push(L(23, 'buddy:' + k, 'companions', d.name, [40, 120, 300], [`${d.name} greets KC`, `${d.name} shows a favourite dig spot on the map`, `${d.name} can be called as a buddy`], { type: 'buddy', dog: k, name: d.name }, { text: 'A gift from Tailwind Pet Supply.', icon: 'paw', where: 'Tailwind Pet Supply', req: g => (g.economy.met(k) ? null : `Play with ${d.name} first`) })); }
  out.push(L(24, 'whistle', 'companions', 'Buddy Whistle', [500, 1500, 4000], ['Call one three-heart buddy to walk with KC for 10 minutes', 'The buddy stays until sent home', 'Two buddies at once'], { type: 'whistle' }, { text: 'Calls a Trail Buddy to walk with KC.', icon: 'whistle', where: 'Tailwind Pet Supply', req: (g, lv) => (lv > 1 || g.economy.ladders('companions').some(l => l.eff.type === 'buddy' && g.economy.level(l.id) >= 3) ? null : 'Give one buddy three hearts first') }));
  out.push(L(25, 'biz:cart', 'businesses', 'Biscuit Cart', [800, 400, 640, 960], BIZ_FX(2, 60), { type: 'biz', rate: 2, cap: 60 }, { text: 'KC\'s own treat cart at the Food Cart Pod.', icon: 'bone', where: 'Food Cart Pod' }));
  out.push(L(26, 'biz:canoes', 'businesses', 'Canoe Hire', [2500, 1250, 2000, 3000], BIZ_FX(3, 90), { type: 'biz', rate: 3, cap: 90 }, { text: 'Canoes for hire at the North Marina.', icon: 'flag', where: 'North Marina' }));
  out.push(L(27, 'biz:pumpkins', 'businesses', 'Pumpkin Stand', [6000, 3000, 4800, 7200], BIZ_FX(6, 180), { type: 'biz', rate: 6, cap: 180 }, { text: 'A pumpkin stand at Wapato Patch Farm.', icon: 'star', where: 'Wapato Patch Farm' }));
  out.push(L(28, 'lantern', 'festival', 'Lantern Fund', [300, 800, 2000, 5000, 12000], ['First ring of lanterns; the ghost-sheet costume at the tailor', 'Second ring; the scarecrow outfit', 'Third ring; the bat wings', 'Fourth ring; the lantern vest', 'The top lantern stays lit all year; the pumpkin suit; a brass plaque on the plaza'], { type: 'lantern' }, { text: 'Light the autumn festival, one ring at a time. Gifts are welcome all year.', icon: 'star', where: 'Courthouse Plaza' }));
  for (const id of MARKER_SIGNS) { const s = SIGNPOSTS.find(x => x.id === id); if (!s) continue; const nm = s.title || s.name || id; out.push(L(29, 'marker:' + id, 'town', nm, [1500], [`Fast travel to ${nm} from the map`], { type: 'marker', sign: id, name: nm }, { text: 'A Trail Marker: fast travel to this signpost.', icon: 'flag', req: g => (g.state.collected.signs.includes(id) ? null : 'Read this signpost first') })); }
  out.push(L(30, 'town', 'town', 'Town Fund', [500, 2000, 5000, 12000, 25000], ['A bench on the plaza', 'A dog drinking fountain', 'Lanterns along the riverwalk', 'A lookout telescope on Nob Hill', 'The Golden Hydrant: collect every till from the den'], { type: 'town' }, { text: 'Chip in at St. Helens City Hall and watch the town grow.', icon: 'star', where: 'St. Helens City Hall' }));
  return out;
}
export const LADDERS = buildLadders();
export const GROUPS = [['abilities', "KC's abilities"], ['gear', 'Gear'], ['storage', 'Storage'], ['camera', 'Photo mode'], ['rides', 'Rides'], ['home', 'Home'], ['companions', 'Trail Buddies'], ['businesses', 'Businesses'], ['festival', 'Festival'], ['town', 'Town']];

/* ---------- things with a price that are not ladders ---------- */
const col = (slot, price, where, list) => list.map(([key, name, value]) => ({ id: slot + ':' + key, cat: 'cosmetic', slot, name, value, bones: price, where }));
const paint = (kind, where, noun) => [['sunrise', 'Sunrise', 0xf08a2a, 0xfff1c9], ['fern', 'Fern', 0x4f8f4f, 0xe8f0c8], ['river', 'River', 0x2f6fb0, 0xcfe6f5], ['berry', 'Berry', 0xa8437a, 0xf5d5e6], ['slate', 'Slate', 0x3a4046, 0xb9c2c9], ['butter', 'Butter', 0xf0d060, 0x7a5a2a]]
  .map(([key, name, primary, secondary]) => ({ id: `skin:${kind}:${key}`, cat: 'cosmetic', slot: 'skin:' + kind, name: `${name} ${noun}`, value: { primary, secondary }, bones: 200, where, paint: true }));
const premium = (id, slot, name, value, gems) => ({ id, cat: 'cosmetic', slot, name, value, gems, where: 'Stitch & Sit Costume Tailor', premium: true });
const set = (key, label, hat, c) => [
  premium('hat:' + hat[0], 'hat', hat[1], { type: hat[2], color: c[0] }, 120), premium('bandana:' + c[3], 'bandana', c[4], c[1], 80), premium('collar:' + c[5], 'collar', c[6], c[2], 80), premium('trail:' + c[7], 'trail', c[8], c[9], 120),
  premium(`skin:skateboard:${key}`, 'skin:skateboard', label + ' board', { primary: c[0], secondary: c[1] }, 80), premium(`skin:canoe:${key}`, 'skin:canoe', label + ' canoe', { primary: c[0], secondary: c[1] }, 80), premium(`skin:van:${key}`, 'skin:van', label + ' van', { primary: c[0], secondary: c[1] }, 80)];
const decor = (key, name, bones, kind, opts = {}) => ({ id: 'decor:' + key, cat: 'decor', name, bones, kind, opts, where: "KC's Den" });

export const ITEMS = [
  ...col('bandana', 40, 'Bandana Bay', [['red', 'Fog Bell Red', 0xd9534f], ['river', 'River Blue', 0x3f7fd6], ['green', 'Fern Green', 0x4f9a4f], ['sun', 'Sunflower', 0xf0c040], ['plum', 'Plum', 0x7a4f9a], ['tangerine', 'Tangerine', 0xf08a2a], ['sky', 'Morning Sky', 0x8fd0f0], ['rose', 'Rose', 0xe890b0], ['charcoal', 'Charcoal', 0x3a3c40], ['cream', 'Cream', 0xf4ead8], ['teal', 'Marina Teal', 0x2f8f88], ['navy', 'Plymouth Navy', 0x2a3f6f]]),
  ...col('collar', 60, 'Knotty Collars', [['red', 'Red collar', 0xd9534f], ['green', 'Green collar', 0x4f9a4f], ['gold', 'Gold collar', 0xe0b040], ['purple', 'Purple collar', 0x7a4f9a], ['orange', 'Orange collar', 0xf08a2a], ['pink', 'Pink collar', 0xe890b0], ['basalt', 'Basalt collar', 0x55585e], ['white', 'White collar', 0xf4f4ef]]),
  ...col('tag', 80, 'Tag & Stamp', [['silver', 'Silver tag', 0xcfd6dc], ['copper', 'Copper tag', 0xc97a4a], ['mint', 'Mint tag', 0x8fe0c0], ['ruby', 'Ruby tag', 0xd9435f], ['sky', 'Sky tag', 0x6fb8f0], ['clock', 'Clock-face tag', 0xf4f1e8]]),
  ...col('harness', 100, 'Tailwind Pet Supply', [['red', 'Red harness', 0xc9483a], ['blue', 'Blue harness', 0x2f6fb0], ['green', 'Green harness', 0x3f7f4f], ['orange', 'Orange harness', 0xe07a2a], ['purple', 'Purple harness', 0x6a4f9a], ['yellow', 'Rain-slicker harness', 0xf0d040]]),
  ...[['cap', 'Ball cap', 'cap', 0x3f7fd6, 150], ['party', 'Party hat', 'party', 0xe8566a, 150], ['beanie', 'Wool beanie', 'beanie', 0x4f9a94, 200], ['flower', 'Flower crown', 'flower', 0xf0a0c0, 250], ['ranger', 'Ranger hat', 'ranger', 0x6f8f4f, 300], ['pumpkin', 'Pumpkin cap', 'pumpkin', 0xf08a2a, 400], ['crown', 'Golden crown', 'crown', 0xf0c040, 2000]]
    .map(([key, name, type, color, bones]) => ({ id: 'hat:' + key, cat: 'cosmetic', slot: 'hat', name, value: { type, color }, bones, where: 'Stitch & Sit Costume Tailor' })),
  ...col('trail', 300, 'Driftwood Toys', [['gold', 'Gold sparkles', 0xffd23c], ['blue', 'River sparkles', 0x7fd4ff], ['pink', 'Blossom sparkles', 0xff9ac8], ['green', 'Moss sparkles', 0x8fe08f], ['white', 'Frost sparkles', 0xffffff], ['orange', 'Lantern sparkles', 0xffa040]]),
  ...paint('skateboard', 'Channel Cyclery', 'board'), ...paint('canoe', 'Knot & Oar Chandlery', 'canoe'), ...paint('van', 'Scappoose Fuel & Treats', 'van'),
  ...[['sheet', 'Ghost-sheet costume', 'sheet', 0xf4f4ef, 300], ['scarecrow', 'Scarecrow outfit', 'scarecrow', 0xc9a04a, 450], ['wings', 'Friendly bat wings', 'wings', 0x4a3a5a, 600], ['lanternvest', 'Lantern vest', 'lanternvest', 0xffb238, 750], ['pumpkinsuit', 'Pumpkin suit', 'pumpkinsuit', 0xf08a2a, 900]]
    .map(([key, name, type, color, bones], i) => ({ id: 'costume:' + key, cat: 'cosmetic', slot: 'outfit', name, value: { type, color }, bones, where: 'Stitch & Sit Costume Tailor', festival: i + 1, req: g => (g.economy.level('lantern') > i ? null : `Lantern Fund ring ${i + 1} unlocks this`) })),
  /* the four sets, sold singly for gems or for bones at 50 a gem (a pack in the grown-ups' store is a shortcut, never the only way) */
  ...set('forest', 'Whispering Firs', ['moss-beanie', 'Moss beanie', 'beanie'], [0x4f7f4f, 0x8fbf6f, 0x7a5a3a, 'fern', 'Fern bandana', 'cedar', 'Cedar collar', 'firefly', 'Firefly trail', 0xd8ff7a]),
  ...set('galaxy', 'Night Sky', ['comet-cap', 'Comet cap', 'cap'], [0x2a2f6f, 0x7f6fd0, 0x9a6fd6, 'starfield', 'Starfield bandana', 'nebula', 'Nebula collar', 'stardust', 'Stardust trail', 0xc8b8ff]),
  ...set('roadtrip', 'Open Road', ['road-visor', 'Road visor', 'cap'], [0xd9834f, 0xf4ead8, 0x3a4046, 'route-stripe', 'Route-stripe bandana', 'mile-marker', 'Mile-marker collar', 'dust', 'Dust trail', 0xe0c8a0]),
  ...set('spooky', 'Spooky Hollow', ['pumpkin-patch', 'Pumpkin-patch hat', 'pumpkin'], [0xf08a2a, 0x5a3f7a, 0x2a2c30, 'candy-corn', 'Candy-corn bandana', 'cobweb', 'Cobweb collar', 'ember', 'Ember trail', 0xff7a3a]),
  ...[['mushroom-lamp', 'Mushroom lamp', 'lamp'], ['moon-lamp', 'Moon lamp', 'lamp'], ['roadside-sign', 'Roadside sign', 'signpost', { text: 'KC WAS HERE' }], ['jack-lantern', 'Carved porch pumpkin', 'pumpkin', { deco: true }]]
    .map(([key, name, kind, opts]) => ({ id: 'decor:' + key, cat: 'decor', name, gems: 80, kind, opts: opts || {}, where: "KC's Den", premium: true })),
  /* den props that only arrive by grant (the merch twins: sold on the merch shelves, not here). Listed so an owned one can be put out by the den. */
  { id: 'decor:river-bed', cat: 'decor', name: 'River pattern pet bed', kind: 'bed', opts: { col: 0x2f6fb0 }, where: "KC's Den", premium: true, grantOnly: true },
  { id: 'decor:camp-mug', cat: 'decor', name: 'Camp KC mug', kind: 'mug', opts: { col: 0xf4ead8 }, where: "KC's Den", premium: true, grantOnly: true },
  /* bakery treats: used up; nothing here is sold for money by this module */
  { id: 'treat:zoomie', cat: 'treat', name: 'Zoomie Biscuit', bones: 60, text: 'Speed x1.15 for 3 minutes', where: 'Flour & Paw Bakery', eff: { mod: { speed: 1.15 }, seconds: 180 } },
  { id: 'treat:jerky', cat: 'treat', name: 'Lucky Jerky', bones: 120, text: 'Bones x1.5 from pickups and digs for 5 minutes', where: 'Flour & Paw Bakery', eff: { mod: { bones: 1.5 }, seconds: 300 } },
  { id: 'treat:party', cat: 'treat', name: 'Party Treat', bones: 80, text: 'A town dog walks with KC for 10 minutes. Confetti. No stats.', where: 'Flour & Paw Bakery', eff: { party: true, seconds: 600 } },
  /* den decor: 30 props, 40 to 600 bones, 6,000 in all, every bone back when a prop is put away */
  decor('planter', 'Flower planter', 40, 'planter'), decor('log', 'Sitting log', 40, 'log'), decor('crate', 'Toy crate', 40, 'crate'), decor('boulder', 'Mossy boulder', 60, 'boulder'), decor('haybale', 'Hay bale', 60, 'haybale'),
  decor('pumpkin', 'Porch pumpkin', 60, 'pumpkin'), decor('bin', 'Tidy bin', 80, 'bin'), decor('hedge', 'Clipped hedge', 80, 'hedge', { len: 3 }), decor('flag', 'Trail flag', 80, 'flag', { col: 0xd9534f }), decor('mailbox', 'Mailbox', 100, 'mailbox', { col: 0x3f7fd6 }),
  decor('bench', 'Garden bench', 100, 'bench'), decor('lamp', 'Path lamp', 120, 'lamp'), decor('herbs', 'Herb planter', 120, 'planter', { cols: [0x4f9a4f, 0x8fbf6f, 0x4f9a4f, 0xb9d98f, 0x4f9a4f] }), decor('bigpumpkin', 'Big pumpkin', 120, 'pumpkin', { s: 1.6 }), decor('table', 'Picnic table', 150, 'table'),
  decor('hydrant', 'Red hydrant', 150, 'hydrant'), decor('umbrella', 'Sun umbrella', 180, 'umbrella', { col: 0xf0c040 }), decor('namesign', 'Name sign', 180, 'signpost', { text: "KC'S DEN" }), decor('campfire', 'Campfire ring', 200, 'campfire'), decor('lantern', 'Lantern post', 200, 'lamp'),
  decor('riverbench', 'Riverside bench', 220, 'bench', { len: 2.6 }), decor('board', 'Photo board', 250, 'noticeboard', { title: 'KC' }), decor('haystack', 'Hay stack', 280, 'haybale', { stack: 3 }), decor('agility', 'Agility set', 320, 'agility'), decor('cart', 'Lemonade cart', 320, 'cart', { name: 'Lemonade', col: 0xf0d060 }),
  decor('tent', 'Guest tent', 350, 'tent', { col: 0x4f9a94 }), decor('stall', 'Garden stall', 450, 'stall', { name: 'KC\'s Garden', col: 0x7fbf6f }), decor('boat', 'Old rowboat', 500, 'boat', { col: 0x4fae8f }), decor('fountain', 'Splash fountain', 550, 'fountain', { r: 1.6 }), decor('stage', 'Little stage', 600, 'stage', { col: 0xd9534f })
];
/* cosmetics other modules grant (money-only sets, the merch tag): defined here so a granted one can be worn; never sold in this file */
export const GRANT_ONLY = [
  { id: 'bandana:first-trail', slot: 'bandana', name: 'First Trail bandana', value: 0xffb238 }, { id: 'tag:first-trail', slot: 'tag', name: 'First Trail tag', value: 0xffe27a }, { id: 'trail:sunbeam', slot: 'trail', name: 'Sunbeam trail', value: 0xfff0a0 },
  { id: 'skin:skateboard:first-trail', slot: 'skin:skateboard', name: 'First Trail board', value: { primary: 0xffb238, secondary: 0x12261e } }, { id: 'tag:supporter', slot: 'tag', name: 'Supporter tag', value: 0x7fe08f }, { id: 'bandana:supporter', slot: 'bandana', name: 'Supporter bandana', value: 0x2f6f5f },
  { id: 'tag:good-human', slot: 'tag', name: 'Good Human tag', value: 0xff9ac8 }, { id: 'tag:real-gear', slot: 'tag', name: 'Real Gear tag', value: 0x4fd0c0 }
];

const DAILY_POOL = [['bones', 20, 'Sniff up 20 loose bones'], ['digs', 3, 'Dig 3 times'], ['jumps', 25, 'Jump 25 times'], ['barks', 10, 'Bark 10 times'], ['distance', 1500, 'Travel 1,500 paces'], ['swims', 2, 'Go for 2 swims'], ['rides', 2, 'Hop on 2 rides'], ['photos', 1, 'Take a photo']];
export const DAILY_GEMS = 2;

export function init(game) {
  if (game.rewards) game.rewards.boneRespawn = BONE_RESPAWN.slice();
  const { state, bus, wallet } = game, eco = game.economy;
  const byId = new Map(LADDERS.map(l => [l.id, l])), items = new Map(ITEMS.map(i => [i.id, i]));
  const price = n => Math.max(0, Math.round((Number(n) || 0) * ECON_SCALE));

  /* ---- saved data, repaired field by field (a damaged save must never break the shop or hand out levels) ---- */
  const data = game.moduleData('economy', { owed: {}, met: {}, daily: { date: '', base: {}, paid: false }, undo: [] });
  const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!obj(data.owed)) data.owed = {}; if (!obj(data.met)) data.met = {}; if (!obj(data.daily)) data.daily = { date: '', base: {}, paid: false }; if (!obj(data.daily.base)) data.daily.base = {}; if (!Array.isArray(data.undo)) data.undo = [];
  if (!obj(state.upgrades)) state.upgrades = {};
  for (const l of LADDERS) { const v = state.upgrades[l.id]; if (v === undefined) continue; const n = Math.floor(Number(v)); if (!Number.isFinite(n) || n <= 0) delete state.upgrades[l.id]; else state.upgrades[l.id] = Math.min(l.max, n); }
  for (const k of Object.keys(data.owed)) { const l = byId.get(k), v = Math.floor(Number(data.owed[k])), lv = l ? state.upgrades[k] || 0 : 0; if (!l || !l.payLater || !(v > 0) || lv < 1) delete data.owed[k]; else data.owed[k] = Math.min(v, price(l.costs[lv - 1])); }
  data.undo = data.undo.filter(u => obj(u) && typeof u.id === 'string' && u.gems > 0 && Number.isFinite(u.t)).slice(-20);
  for (const c of ['bones', 'gems']) { const v = Math.floor(Number(state.wallet[c])); state.wallet[c] = Number.isFinite(v) && v > 0 ? v : 0; }

  /* ---- ladders ---- */
  const level = id => { const l = byId.get(id); if (!l) return 0; const v = state.upgrades[id]; return Number.isInteger(v) && v > 0 ? Math.min(v, l.max) : 0; };
  const owed = id => { const v = data.owed[id]; return v > 0 ? v : 0; };
  const nextCost = id => { const l = byId.get(id), lv = level(id); return l && lv < l.max ? price(l.costs[lv]) : null; };
  /* check(id) -> { ok, cost, reason: 'unknown' | 'max' | 'owed' | 'locked' | 'bones', text, short } : why the next tier can or cannot be bought now */
  const check = id => {
    const l = byId.get(id); if (!l) return { ok: false, reason: 'unknown', text: 'Not for sale' };
    const lv = level(id); if (lv >= l.max) return { ok: false, reason: 'max', text: 'Fully upgraded' };
    const cost = price(l.costs[lv]);
    if (l.payLater && owed(id) > 0) return { ok: false, reason: 'owed', cost, text: `Finish paying for this one first (${fmt(owed(id))} bones to go)` };
    const why = (l.req && l.req(game, lv + 1)) || (l.need && l.need.tier === lv + 1 && !((state.stats[l.need.stat] || 0) >= l.need.n) ? `${l.need.text} (${fmt(Math.floor(state.stats[l.need.stat] || 0))} of ${fmt(l.need.n)})` : null);
    if (why) return { ok: false, reason: 'locked', cost, text: why };
    if (!l.payLater && !wallet.can('bones', cost)) { const short = cost - wallet.get('bones'); return { ok: false, reason: 'bones', cost, short, text: `Not enough bones: ${fmt(short)} more to go` }; }
    return { ok: true, cost };
  };
  const bump = (l, lv, cost, how) => { state.upgrades[l.id] = lv; bus.emit('upgrade', { id: l.id, level: lv, cost, ladder: l, how }); game.save.save(); };
  /* buyLevel(id, { paid, free }) -> boolean. Charges the bones itself unless the caller already did (paid: true, after ui.confirmSpend)
     or the tier is a reward (free: true, e.g. a mission paying the Biscuit Cart's entry). A pay-later ladder (the den) is delivered at once
     and its price becomes a bar to fill with pay(id, n): no interest, no deadline, and the next stage waits until the bar is full. */
  const buyLevel = (id, o = {}) => {
    const l = byId.get(id), c = check(id), given = !!(o.paid || o.free);
    if (!l || !(c.ok || (given && c.reason === 'bones'))) return false;
    const lv = level(id) + 1;
    if (l.payLater && !given) { if (c.cost > 0) data.owed[id] = c.cost; bump(l, lv, c.cost, 'later'); return true; }
    if (!given && !wallet.spend('bones', c.cost, 'upgrade:' + id)) return false;
    if (!given) bus.emit('spend', { bones: c.cost, gems: 0, reason: 'upgrade:' + id });
    bump(l, lv, o.free ? 0 : c.cost, o.free ? 'free' : 'bought'); return true;
  };
  /* pay(id, n, { paid }) -> bones actually paid toward a pay-later bar (never more than is owed, never more than KC has; paid: true = ui.confirmSpend already charged exactly n) */
  const pay = (id, n = Infinity, o = {}) => {
    const due = owed(id); if (!(due > 0)) return 0; const want = Number(n); if (Number.isNaN(want) || want <= 0) return 0;
    const amt = Math.floor(Math.min(want, due, o.paid ? Infinity : wallet.get('bones'))); if (!(amt > 0)) return 0;
    if (!o.paid) { if (!wallet.spend('bones', amt, 'upgrade:' + id)) return 0; bus.emit('spend', { bones: amt, gems: 0, reason: 'upgrade:' + id }); }
    data.owed[id] = due - amt; if (data.owed[id] <= 0) delete data.owed[id];
    bus.emit('upgradePaid', { id, amount: amt, owed: owed(id) }); game.save.save(); return amt;
  };
  /* setLevel(id, n): for rewards and tests; never charges, never lowers a level unless { force: true } */
  const setLevel = (id, n, o = {}) => { const l = byId.get(id); if (!l) return 0; n = Math.max(0, Math.min(l.max, Math.floor(Number(n)) || 0)); const cur = level(id); if (n === cur || (n < cur && !o.force)) return cur; if (n === 0) delete state.upgrades[id]; else state.upgrades[id] = n; if (n < cur) delete data.owed[id]; bus.emit('upgrade', { id, level: n, cost: 0, ladder: l, how: 'set' }); return n; };

  /* ---- items ---- */
  const usd = gems => '$' + (Math.ceil(gems * GEM_PACK.usd / GEM_PACK.gems * 100 - 1e-9) / 100).toFixed(2);
  /* itemPrice(id) -> { bones, gems } : both when either will do (a gem item always has a bones price too) */
  const itemPrice = id => {
    const it = items.get(id); if (!it || it.grantOnly) return null;
    if (it.gems) return { gems: it.gems, bones: price(it.gems * BONES_PER_GEM), either: true };
    if (it.paint && level('den') >= 6) return { bones: 0 };
    return { bones: price(it.bones) };
  };
  const treatCap = () => { const l = byId.get('pouch'), lv = level('pouch'); return lv ? l.eff.v[lv - 1] : l.eff.base; };
  const treatsHeld = () => ITEMS.filter(i => i.cat === 'treat').reduce((n, i) => n + eco.count(i.id), 0);
  const checkItem = (id, cur = 'bones') => {
    const it = items.get(id); if (!it || it.grantOnly) return { ok: false, reason: 'unknown', text: 'Not for sale' };
    if (it.cat !== 'treat' && eco.owns(id)) return { ok: false, reason: 'owned', text: 'Already yours' };
    const why = it.req && it.req(game); if (why) return { ok: false, reason: 'locked', text: why };
    if (it.cat === 'treat' && treatsHeld() >= treatCap()) return { ok: false, reason: 'full', text: `The treat pouch is full (${treatCap()}). Eat one, or get a bigger pouch.` };
    const p = itemPrice(id), c = cur === 'gems' ? 'gems' : 'bones'; if (c === 'gems' && !p.gems) return { ok: false, reason: 'currency', text: 'This is sold for bones' };
    const cost = p[c] || 0; if (!wallet.can(c, cost)) { const short = cost - wallet.get(c); return { ok: false, reason: c, cost, short, text: `Not enough ${c}: ${fmt(short)} more to go` }; }
    return { ok: true, cost, currency: c };
  };
  /* buyItem(id, 'bones' | 'gems', { paid }) -> boolean : charge (unless ui.confirmSpend already did), then grant. A gem purchase can be undone for ten minutes. */
  const buyItem = (id, cur = 'bones', o = {}) => {
    const c = checkItem(id, cur); if (!(c.ok || (o.paid && (c.reason === 'bones' || c.reason === 'gems')))) return false;
    const it = items.get(id), p = itemPrice(id); if (!p) return false; const currency = cur === 'gems' ? 'gems' : 'bones', cost = p[currency] || 0;
    if (!o.paid) { if (!wallet.spend(currency, cost, 'shop:' + id)) return false; bus.emit('spend', { bones: currency === 'bones' ? cost : 0, gems: currency === 'gems' ? cost : 0, reason: 'shop:' + id }); }
    if (it.cat === 'treat') { if (state.owned[id] === true) state.owned[id] = 1; eco.grant({ items: [{ id, n: 1 }] }, 'shop'); } else eco.grant({ items: [id] }, 'shop');   /* treats stack: the core counts an item only once it is a number */
    if (currency === 'gems' && cost > 0 && it.cat !== 'treat') { data.undo.push({ id, gems: cost, t: Date.now() }); data.undo = data.undo.slice(-20); }
    bus.emit('itemBought', { id, currency, cost, item: it }); game.save.save(); return true;
  };
  const undoable = id => { const now = Date.now(); data.undo = data.undo.filter(u => now - u.t < UNDO_MS && now >= u.t - 60000); const u = data.undo.find(x => x.id === id); return u && eco.owns(id) ? { gems: u.gems, left: Math.max(0, UNDO_MS - (now - u.t)) } : null; };
  /* undo(id) -> boolean : give a gem purchase back within ten minutes; the gems return, the item goes */
  const undo = id => { const u = undoable(id); if (!u) return false; const it = items.get(id); if (it && it.slot && state.equipped[it.slot] === id) game.cosmetics.unequip(it.slot); delete state.owned[id]; data.undo = data.undo.filter(x => x.id !== id); wallet.add('gems', u.gems, 'undo:' + id); bus.emit('itemUndone', { id, gems: u.gems }); game.save.save(); return true; };

  /* ---- free gems: one for the first visit to each district (spec 3.4); golden balls are paid by the core ---- */
  bus.on('discover', e => { eco.grant({ gems: 1 }, 'discover:' + (e && e.id)); });
  bus.on('dogPlay', e => { if (e && e.name) { const k = dogKey(e.name); if (!data.met[k]) { data.met[k] = true; bus.emit('buddyMet', { dog: k, name: e.name }); } } });

  /* ---- three daily sniff-outs, made on the device from the date: 2 gems when all three are done. No streak, nothing lost by missing a day. ---- */
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const pick3 = date => { let h = 2166136261; for (const ch of date) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; const pool = DAILY_POOL.slice(), out = []; for (let i = 0; i < 3; i++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; out.push(pool.splice(h % pool.length, 1)[0]); } return out; };
  const daily = () => {
    const date = today(); if (data.daily.date !== date) { data.daily = { date, base: {}, paid: false }; for (const [stat] of DAILY_POOL) data.daily.base[stat] = Number(state.stats[stat]) || 0; }
    const goals = pick3(date).map(([stat, need, text]) => { const have = Math.max(0, Math.min(need, Math.floor((Number(state.stats[stat]) || 0) - (Number(data.daily.base[stat]) || 0)))); return { stat, text, need, have, done: have >= need }; });
    return { date, goals, done: goals.every(g => g.done), paid: !!data.daily.paid, gems: DAILY_GEMS };
  };
  let dailyT = 0;
  bus.on('second', () => { if (++dailyT % 3) return; const d = daily(); if (d.done && !d.paid) { data.daily.paid = true; eco.grant({ gems: DAILY_GEMS }, 'daily'); game.toast(`Today's sniff-outs are done: ${DAILY_GEMS} gems`, { icon: 'gem', kind: 'gold' }); } });

  /* ---- the catalogue (spec section 8: id, category, tier, bones, gems or null, requires, effect) ---- */
  eco.catalog.length = 0;
  for (const l of LADDERS) l.costs.forEach((c, i) => eco.catalog.push({ id: l.id, category: 'upgrade', group: l.group, ladder: l.no, name: l.name, tier: i + 1, bones: price(c), gems: null, requires: i ? `${l.id} tier ${i}` : null, effect: l.fx[i] }));
  for (const it of ITEMS) if (!it.grantOnly) eco.catalog.push({ id: it.id, category: it.cat, group: it.slot || it.cat, name: it.name, tier: null, bones: price(it.gems ? it.gems * BONES_PER_GEM : it.bones), gems: it.gems || null, requires: it.festival ? `lantern tier ${it.festival}` : null, effect: it.text || (it.cat === 'decor' ? 'Den decor' : 'Cosmetic') });

  /* ---- wearables by id: defined once here, so anything owned can be put on and the save's outfit comes back at boot ---- */
  game.cosmetics.define(ITEMS.filter(i => i.cat === 'cosmetic').map(i => ({ id: i.id, slot: i.slot, name: i.name, value: i.value })));
  for (const g of GRANT_ONLY) if (!game.cosmetics.get(g.id)) game.cosmetics.define(g);

  const totals = () => { const ladders = LADDERS.reduce((s, l) => s + l.costs.reduce((a, c) => a + price(c), 0), 0), sum = f => ITEMS.filter(f).reduce((s, i) => s + price(i.bones || 0), 0);
    return { ladders, cosmetics: sum(i => i.cat === 'cosmetic' && !i.premium), decor: sum(i => i.cat === 'decor' && !i.premium), tracks: LADDERS.length, rows: new Set(LADDERS.map(l => l.no)).size }; };

  Object.assign(eco, {
    ECON_SCALE, BONES_PER_GEM, price, level, maxLevel: id => (byId.get(id) ? byId.get(id).max : 0), ladder: id => byId.get(id) || null, ladders: group => (group ? LADDERS.filter(l => l.group === group) : LADDERS.slice()), groups: GROUPS,
    nextCost, check, buyLevel, setLevel, owed, pay, met: k => !!data.met[dogKey(k)],
    item: id => items.get(id) || null, items: f => (typeof f === 'function' ? ITEMS.filter(f) : f ? ITEMS.filter(i => i.cat === f || i.slot === f) : ITEMS.slice()), itemPrice, checkItem, buyItem, undo, undoable, usd, treatCap, treatsHeld, totals, daily
  });
  return eco;
}
