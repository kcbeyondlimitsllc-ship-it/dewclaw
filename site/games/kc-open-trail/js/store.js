/* Store: the real-money shop for grown-ups, the purchase journal, restore, and the Trail Journal (the 30-step track
   with a free column and a pass column). Spec: marketing/kc-open-trail/MONETIZATION-EXPANSION-SPEC.md, sections 4 and 6.

   The rules this file keeps:
   - Real-money spending is OFF until a grown-up turns it on in Settings (game.grownUp.spending). While it is off the
     Store tab shows one line and nothing else, and no price, pitch or pass column is shown anywhere.
   - A grown-up gate before the store screen opens, again before every purchase, and before restore and the limit screen.
   - Two steps: Buy, then a confirm screen with the dollar price and the exact contents. Nothing is random.
   - Money buys gems, cosmetics and a thank-you. A grant that carries bones is refused, whoever sent it.
   - The dollar price is on every card, on every Buy button and on the confirm screen.
   - A device limit ($50 in any 30 days unless a grown-up changes it) and a journal of every purchase.
   - No timers, no "best value", no "was" prices, no nagging. Nothing here opens by itself.
   - The only network calls in this file go to the Dewclaw worker (js/store-config.js), only after a grown-up has passed
     the gate and pressed a button (pay, finish a payment that was started here, restore). With the placeholder config
     nothing is ever requested and every item says "Coming soon".

   Mock mode is for tests: it exists only when the page is served from localhost / 127.0.0.1 AND was opened with BOTH
   ?debug=1 and ?mock=1. It pretends to be the worker (same answers, same refusals) so the whole path can be run without
   Stripe. On any other host (the live site included) the query words do nothing: the mock code is never called and a
   made-up return link is ignored.

   OWNER DECISION (2026-11-19): KC: Open Trail takes payments through Google Play Billing ONLY. Stripe is not used
   anywhere. So on the WEB (any browser) there is no real-money store at all: no Store tab, no price, no pass column, no
   Settings rows for the limit or restore, no "about $X" next to gem prices, and a Stripe return link (?cs=...) is
   dropped unread. This holds whatever js/store-config.js says (WORKER_URL and STRIPE_PRICE_IDS are ignored on the web).
   The Stripe code below is kept only for the localhost test double (MOCK, ?debug=1&mock=1 on localhost), which the
   store tests use to exercise the gate, the two steps, the limit, the journal and the Trail Key; it can never run on
   the live site, and the worker refuses an ot_ Stripe checkout unless OT_STRIPE is "on" (it is not set).

   Two channels (js/channel.js). Inside the GOOGLE PLAY app (game.channel === 'play') Stripe is never used and never
   mentioned: no Stripe checkout, no Stripe price, no return link is claimed, and nothing points at buying anywhere else.
   There the store is one of two things:
   - PLAY_BILLING 'off' in js/store-config.js (the default): no store at all. No Store tab, no price, no pass column, no
     Settings rows for the limit or restore. The grown-up switch then only opens the real-gear shelf (js/merch.js).
   - PLAY_BILLING 'on': the same 16 items sold through Google Play Billing, by way of the Digital Goods API and the
     Payment Request API that the Android shell provides. Prices are read from Google Play at run time (getDetails) and
     shown as Google gives them; an item Google does not return says "Coming soon" with no price and cannot be bought.
     The purchase token goes to the worker (/ot/play-claim), which checks it with Google, grants once, and consumes or
     acknowledges it. Restore asks Google Play what this account owns (listPurchases). The gate, the two steps, the device
     limit (counted at the US list prices) and the off-by-default switch are the same as on the web.

   Saved data: game.moduleData('store') survives "Start over" (install id, applied purchase sessions, journal, Trail Key,
   permanent SKUs, the limit, pass steps already paid, purchased gems still unspent, the things purchased gems bought). game.moduleData('storeTrail') is
   the free column of the Trail Journal and starts again with a new save.

   Public API (game.modules.store): see the object returned by init at the bottom of this file. */
import * as CONFIG from './store-config.js';
/* read this way so a store-config.js written before PLAY_BILLING existed still loads: a missing value means 'off' */
const { WORKER_URL, SUPPORT_CONTACT } = CONFIG, PLAY_BILLING = CONFIG.PLAY_BILLING === 'on' ? 'on' : 'off';

/* ------------------------------------------------------------------ the catalogue (spec 4.2)
   The worker's OT_GRANTS table is the authority on what a purchase is worth; this copy is what the screens show and what
   mock mode grants. worker/test.js fails if the two ever disagree. Every grant has bones: 0. */
const FOREST = ['hat:moss-beanie', 'bandana:fern', 'collar:cedar', 'trail:firefly', 'skin:skateboard:forest', 'skin:canoe:forest', 'skin:van:forest', 'decor:mushroom-lamp'];
const GALAXY = ['hat:comet-cap', 'bandana:starfield', 'collar:nebula', 'trail:stardust', 'skin:skateboard:galaxy', 'skin:canoe:galaxy', 'skin:van:galaxy', 'decor:moon-lamp'];
const ROADTRIP = ['hat:road-visor', 'bandana:route-stripe', 'collar:mile-marker', 'trail:dust', 'skin:skateboard:roadtrip', 'skin:canoe:roadtrip', 'skin:van:roadtrip', 'decor:roadside-sign'];
const SPOOKY = ['hat:pumpkin-patch', 'bandana:candy-corn', 'collar:cobweb', 'trail:ember', 'skin:skateboard:spooky', 'skin:canoe:spooky', 'skin:van:spooky', 'decor:jack-lantern'];
const SUPPORTER = ['tag:supporter', 'bandana:supporter', 'den:gold-trim', 'frame:supporter'];
const STARTER = ['bandana:first-trail', 'tag:first-trail', 'trail:sunbeam', 'skin:skateboard:first-trail'];
const gemPack = (gems, cents) => ({ sku: 'ot_gems_' + gems, cents, type: 'consumable', group: 'gems', name: gems.toLocaleString('en-US') + ' gems', blurb: 'Gems buy cosmetics only. They can never be turned into bones.', grant: { bones: 0, gems, items: [], flags: {} } });
const setPack = (key, name, items) => ({ sku: 'ot_pack_' + key, cents: 399, type: 'permanent', group: 'sets', name: name + ' set', blurb: 'Eight cosmetic items. Each one can also be earned in the game with gems or bones.', grant: { bones: 0, gems: 0, items, flags: {} } });
export const CATALOG = [
  gemPack(80, 99), gemPack(500, 499), gemPack(1200, 999), gemPack(2600, 1999), gemPack(7000, 4999),
  { sku: 'ot_starter', cents: 499, type: 'once', group: 'sets', name: 'First Trail set', blurb: '400 gems and four First Trail cosmetics. One per device.', grant: { bones: 0, gems: 400, items: STARTER, flags: { 'store:starter': true } } },
  { sku: 'ot_trail_pass', cents: 599, type: 'permanent', group: 'pass', name: 'Trail Journal pass', blurb: 'The second column of the Trail Journal: 15 cosmetics and 300 gems, paid out as KC reaches each step. Steps already reached pay out at once. It never runs out.', grant: { bones: 0, gems: 0, items: ['pass:trail'], flags: { 'store:pass': true } } },
  setPack('forest', 'Whispering Firs', FOREST), setPack('galaxy', 'Night Sky', GALAXY), setPack('roadtrip', 'Open Road', ROADTRIP), setPack('halloween', 'Spooky Hollow', SPOOKY),
  { sku: 'ot_treat_3', cents: 199, type: 'consumable', group: 'treats', name: '3 Party Treats', blurb: 'A town dog walks with KC for ten minutes, with confetti. No stats. Also 80 bones each at the bakery.', grant: { bones: 0, gems: 0, items: ['treat:3'], flags: {} } },
  { sku: 'ot_treat_10', cents: 499, type: 'consumable', group: 'treats', name: '10 Party Treats', blurb: 'A town dog walks with KC for ten minutes, with confetti. No stats. Also 80 bones each at the bakery.', grant: { bones: 0, gems: 0, items: ['treat:10'], flags: {} } },
  { sku: 'ot_supporter', cents: 999, type: 'permanent', group: 'sets', name: 'Supporter set', blurb: '600 gems and four Supporter cosmetics. A thank-you; it gives no boost of any kind.', grant: { bones: 0, gems: 600, items: SUPPORTER, flags: { 'store:supporter': true } } },
  { sku: 'ot_everything', cents: 2499, type: 'permanent', group: 'sets', name: 'Everything bundle', blurb: 'The four sets, the Trail Journal pass and the Supporter set with its 600 gems. Bought one by one these cost $31.94.', grant: { bones: 0, gems: 600, items: ['pass:trail', ...FOREST, ...GALAXY, ...ROADTRIP, ...SPOOKY, ...SUPPORTER], flags: { 'store:pass': true, 'store:supporter': true } } },
  { sku: 'ot_tip_3', cents: 300, type: 'consumable', group: 'tip', name: 'Tip the maker', blurb: 'A thank-you to the person who makes the game. You get a "Good Human" tag the first time. It buys nothing else.', grant: { bones: 0, gems: 0, items: ['tag:good-human'], flags: {} } }
];
const EVERYTHING_PARTS = ['ot_pack_forest', 'ot_pack_galaxy', 'ot_pack_roadtrip', 'ot_pack_halloween', 'ot_trail_pass', 'ot_supporter'];
const GROUPS = [['gems', 'Gems', 'A plain number of gems for a plain price. Not restorable on another device.'], ['sets', 'Cosmetic sets', 'Yours for good on this device, and on another device with your Trail Key.'], ['pass', 'Trail Journal', ''], ['treats', 'Party Treats', 'Used up when eaten. Not restorable.'], ['tip', 'Say thanks', '']];

/* names for the contents lists, so this file needs no other module to describe what is in a pack */
const NAMES = {
  'hat:moss-beanie': 'Moss beanie', 'bandana:fern': 'Fern bandana', 'collar:cedar': 'Cedar collar', 'trail:firefly': 'Firefly trail', 'skin:skateboard:forest': 'Whispering Firs skateboard paint', 'skin:canoe:forest': 'Whispering Firs canoe paint', 'skin:van:forest': 'Whispering Firs van paint', 'decor:mushroom-lamp': 'Mushroom lamp for the den',
  'hat:comet-cap': 'Comet cap', 'bandana:starfield': 'Starfield bandana', 'collar:nebula': 'Nebula collar', 'trail:stardust': 'Stardust trail', 'skin:skateboard:galaxy': 'Night Sky skateboard paint', 'skin:canoe:galaxy': 'Night Sky canoe paint', 'skin:van:galaxy': 'Night Sky van paint', 'decor:moon-lamp': 'Moon lamp for the den',
  'hat:road-visor': 'Road visor', 'bandana:route-stripe': 'Route-stripe bandana', 'collar:mile-marker': 'Mile-marker collar', 'trail:dust': 'Dust trail', 'skin:skateboard:roadtrip': 'Open Road skateboard paint', 'skin:canoe:roadtrip': 'Open Road canoe paint', 'skin:van:roadtrip': 'Open Road van paint', 'decor:roadside-sign': 'Roadside sign for the den',
  'hat:pumpkin-patch': 'Pumpkin-patch hat', 'bandana:candy-corn': 'Candy-corn bandana', 'collar:cobweb': 'Cobweb collar', 'trail:ember': 'Ember trail', 'skin:skateboard:spooky': 'Spooky Hollow skateboard paint', 'skin:canoe:spooky': 'Spooky Hollow canoe paint', 'skin:van:spooky': 'Spooky Hollow van paint', 'decor:jack-lantern': 'Carved porch pumpkin for the den',
  'tag:supporter': 'Supporter tag', 'bandana:supporter': 'Supporter bandana', 'den:gold-trim': 'Gold trim for the den', 'frame:supporter': 'Supporter photo frame',
  'bandana:first-trail': 'First Trail bandana', 'tag:first-trail': 'First Trail tag', 'trail:sunbeam': 'Sunbeam sparkle trail', 'skin:skateboard:first-trail': 'First Trail skateboard paint',
  'pass:trail': 'Trail Journal pass (the second column: 15 cosmetics and 300 gems as steps are reached)', 'tag:good-human': '"Good Human" tag (the first time only)', 'treat:3': '3 Party Treats', 'treat:10': '10 Party Treats'
};

/* ------------------------------------------------------------------ the Trail Journal (spec 4.3)
   Thirty lifetime steps. Free column: bones on every step and one gem, 30 gems in all. Pass column: a cosmetic on odd
   steps and 20 gems on even steps, 15 cosmetics and 300 gems in all. Nothing resets and nothing expires. */
export const PASS_ITEMS = [
  { id: 'bandana:trailblazer', slot: 'bandana', name: 'Trailblazer bandana', value: 0xe2725b }, { id: 'tag:compass', slot: 'tag', name: 'Compass tag', value: 0xd8b24a },
  { id: 'collar:switchback', slot: 'collar', name: 'Switchback collar', value: 0x3f8f7f }, { id: 'trail:daybreak', slot: 'trail', name: 'Daybreak trail', value: 0xffc8a0 },
  { id: 'harness:ridgeline', slot: 'harness', name: 'Ridgeline harness', value: 0x5f7fbf }, { id: 'hat:trailblazer', slot: 'hat', name: 'Trailblazer cap', value: { type: 'cap', color: 0xe2725b } },
  { id: 'skin:skateboard:trailblazer', slot: 'skin:skateboard', name: 'Trailblazer board paint', value: { primary: 0xe2725b, secondary: 0x2a3f3a } }, { id: 'bandana:lookout', slot: 'bandana', name: 'Lookout bandana', value: 0x4a6fa5 },
  { id: 'tag:summit', slot: 'tag', name: 'Summit tag', value: 0xe8eef2 }, { id: 'collar:campfire', slot: 'collar', name: 'Campfire collar', value: 0xd9632a },
  { id: 'skin:canoe:trailblazer', slot: 'skin:canoe', name: 'Trailblazer canoe paint', value: { primary: 0x3f8f7f, secondary: 0xe2725b } }, { id: 'hat:wayfinder', slot: 'hat', name: 'Wayfinder hat', value: { type: 'ranger', color: 0x8a6f4a } },
  { id: 'trail:northern-lights', slot: 'trail', name: 'Northern lights trail', value: 0x8fffd0 }, { id: 'skin:van:trailblazer', slot: 'skin:van', name: 'Trailblazer van paint', value: { primary: 0x4a6fa5, secondary: 0xf4ead8 } },
  { id: 'hat:trails-end', slot: 'hat', name: "Trail's End flower crown", value: { type: 'flower', color: 0xffd27a } }
];
const TRACK = {
  zones: [[3, 8, 15, 25, 38], n => `Find ${n} places`], balls: [[3, 8, 15, 25, 36], n => `Find ${n} golden balls`], photos: [[1, 5, 12, 25, 50], n => (n === 1 ? 'Take a photo' : `Take ${n} photos`)],
  digs: [[5, 20, 50, 100, 200], n => `Dig ${n} times`], distance: [[1000, 5000, 15000, 40000, 100000], n => `Travel ${n.toLocaleString('en-US')} paces`], missions: [[1, 3, 6, 10, 15], n => (n === 1 ? 'Finish a mission' : `Finish ${n} different missions`)]
};
const FREE_BONES = [15, 30, 60, 100, 200], PASS_GEMS = 20;
export const STEPS = (() => { const out = []; for (let t = 0; t < 5; t++) for (const kind of Object.keys(TRACK)) { const n = out.length + 1, need = TRACK[kind][0][t];
  out.push({ n, kind, need, text: TRACK[kind][1](need), free: { bones: FREE_BONES[t], gems: 1 }, pass: n % 2 ? { item: PASS_ITEMS[(n - 1) / 2].id, name: PASS_ITEMS[(n - 1) / 2].name } : { gems: PASS_GEMS } }); } return out; })();

/* ------------------------------------------------------------------ small helpers */
const PLACEHOLDER = 'OWNER_FILLS_IN';
const money = cents => '$' + (cents / 100).toFixed(2);
const PLAY_METHOD = 'https://play.google.com/billing';
const SESSION_RE = /^cs_[A-Za-z0-9_]{4,200}$/, ITEM_RE = /^[a-z]+(:[a-z0-9-]+){1,2}$/, FLAG_RE = /^store:[a-z-]{1,24}$/, KEY_RE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const normKey = k => String(k || '').toUpperCase().replace(/[^A-Z2-9]/g, '').replace(/^(.{4})(.{4})$/, '$1-$2');
const DAY = 86400e3, WINDOW = 30 * DAY, CAPS = [1000, 2500, 5000, 10000], DEFAULT_CAP = 5000;
async function digest(s) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ot-session:' + s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32); }
  catch (e) { let a = 0x811c9dc5, c = 0x1b873593; for (let i = 0; i < s.length; i++) { a = Math.imul(a ^ s.charCodeAt(i), 16777619); c = Math.imul(c ^ s.charCodeAt(i), 0x85ebca6b) + i; } return 'f' + (a >>> 0).toString(16).padStart(8, '0') + (c >>> 0).toString(16).padStart(8, '0') + s.length.toString(16); }
}
function randomId(bytes = 24) { const a = new Uint8Array(bytes); crypto.getRandomValues(a); return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
/* is this what a purchase may contain? Bones never; gems a whole number no bigger than the largest pack; plain item ids; store: flags only */
export function grantProblem(g) {
  if (!g || typeof g !== 'object') return 'no grant';
  if (g.bones != null && g.bones !== 0) return 'bones';
  if (g.gems != null && !(Number.isInteger(g.gems) && g.gems >= 0 && g.gems <= 7000)) return 'gems';
  if (g.items != null && !(Array.isArray(g.items) && g.items.length <= 60 && g.items.every(i => typeof i === 'string' && ITEM_RE.test(i) && !/^(bones?|gems?|up|upgrade|boost)\b/.test(i)))) return 'items';
  if (g.flags != null && !(typeof g.flags === 'object' && !Array.isArray(g.flags) && Object.keys(g.flags).every(k => FLAG_RE.test(k) && typeof g.flags[k] === 'boolean'))) return 'flags';
  return '';
}

export function init(game) {
  const ui = game.ui, eco = game.economy, bus = game.bus, state = game.state, el = ui.el, esc = ui.esc;
  if (typeof document !== 'undefined' && !document.querySelector('link[data-kc-store]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/store.css'; l.setAttribute('data-kc-store', '1'); document.head.appendChild(l); }
  const bySku = new Map(CATALOG.map(c => [c.sku, c]));
  const query = new URLSearchParams(location.search);
  const DEBUG = game.debug === true && query.get('debug') === '1';
  /* the pretend store exists on a developer's own machine only: on any other host the two query words do nothing */
  const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const MOCK = DEBUG && LOCAL && query.get('mock') === '1';

  /* ---------- saved data ---------- */
  const S = game.moduleData('store', { install: '', applied: [], journal: [], key: '', perm: [], cap: DEFAULT_CAP, pending: null, gemBank: 0, gemItems: {}, passPaid: [], unsettled: [] });
  game.save.keepOnReset('store');
  for (const k of ['applied', 'journal', 'perm', 'passPaid', 'unsettled']) if (!Array.isArray(S[k])) S[k] = [];
  S.unsettled = S.unsettled.filter(r => typeof r === 'string' && r.length <= 40).slice(-40);
  if (typeof S.install !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(S.install)) S.install = '';
  if (typeof S.key !== 'string' || !KEY_RE.test(S.key)) S.key = '';
  if (!CAPS.includes(S.cap)) S.cap = DEFAULT_CAP;
  if (!Number.isFinite(S.gemBank) || S.gemBank < 0) S.gemBank = 0;
  /* a checkout that was started: kept 2 days, or 35 once the payment page's session id is known (a paid one must stay claimable) */
  if (!S.pending || typeof S.pending !== 'object' || !bySku.has(S.pending.sku) || (S.pending.session != null && !SESSION_RE.test(String(S.pending.session))) || !(Date.now() - S.pending.t < (S.pending.session ? 35 : 2) * DAY)) S.pending = null;
  S.journal = S.journal.filter(j => j && typeof j === 'object' && Number.isFinite(j.t)).slice(-200);
  /* purchased gems still unspent can never be more than the gems this device's journal shows were bought (plus the pass's 300) */
  { const bought = S.journal.reduce((n, j) => n + (j.kind === 'buy' && bySku.has(j.sku) ? bySku.get(j.sku).grant.gems || 0 : 0), 0) + 300; if (S.gemBank > bought) S.gemBank = bought; }
  /* gemItems: things bought with purchased gems -> how many of those gems went into each (never more than its gem price) */
  if (!S.gemItems || typeof S.gemItems !== 'object' || Array.isArray(S.gemItems)) S.gemItems = {};
  for (const id of Object.keys(S.gemItems)) { const it = eco.item && eco.item(id), n = Math.floor(Number(S.gemItems[id])); if (!it || !(it.gems > 0) || !(n > 0)) delete S.gemItems[id]; else S.gemItems[id] = Math.min(n, it.gems); }
  S.perm = S.perm.filter(k => bySku.has(k) && bySku.get(k).type !== 'consumable'); S.passPaid = S.passPaid.filter(n => Number.isInteger(n) && n >= 1 && n <= STEPS.length);
  const J = game.moduleData('storeTrail', { free: [], missions: [] });
  for (const k of ['free', 'missions']) if (!Array.isArray(J[k])) J[k] = [];
  const save = () => game.save.save();

  /* ---------- is anything on sale? ---------- */
  const workerBase = (() => { try { if (!WORKER_URL || WORKER_URL === PLACEHOLDER) return ''; const u = new URL(WORKER_URL);
    if (u.protocol === 'https:' || (DEBUG && u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))) return u.origin + u.pathname.replace(/\/+$/, ''); } catch (e) { /* not an address */ } return ''; })();
  const LIVE = !!workerBase;
  /* ---------- the Google Play app ----------
     PLAY: this is the Play app. PLAY_ON: it has a store (Google Play Billing switched on by the owner, or the test double).
     dg is Google's Digital Goods service once it has answered; playPrices holds what Google says each item costs. */
  const PLAY = game.channel === 'play';
  const PLAY_ON = PLAY && (MOCK ? query.get('billing') !== 'off' : LIVE && PLAY_BILLING === 'on');
  /* is there a real-money store in this build at all? The Play app: only with Google Play Billing switched on. The web: never
     (owner decision, no Stripe), except the localhost test double. */
  const STORE = PLAY ? PLAY_ON : MOCK;
  let dg = null, dgAt = 0; const playPrices = new Map();
  const playMoney = p => { try { const v = Number(p.value); if (!Number.isFinite(v) || v < 0 || !/^[A-Z]{3}$/.test(String(p.currency))) return ''; return new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency }).format(v); } catch (e) { return ''; } };
  /* asks Google Play which of the 16 items exist and what they cost. Called only after the grown-up gate. Tried again later if it failed. */
  async function playInit() {
    if (!PLAY_ON || dg || Date.now() - dgAt < 8000) return !!dg; dgAt = Date.now();
    try {
      if (typeof window.getDigitalGoodsService !== 'function' || typeof window.PaymentRequest !== 'function') return false;
      const svc = await window.getDigitalGoodsService(PLAY_METHOD), list = await svc.getDetails(CATALOG.map(c => c.sku));
      playPrices.clear();
      for (const d of Array.isArray(list) ? list : []) { const t = d && bySku.has(d.itemId) ? playMoney(d.price || {}) : ''; if (t) playPrices.set(d.itemId, t); }
      dg = svc;
    } catch (e) { dg = null; }
    return !!dg;
  }
  const sellable = sku => STORE && bySku.has(sku) && (PLAY ? PLAY_ON && !!dg && playPrices.has(sku) : MOCK);
  /* the price a person is shown: on the web the catalogue's dollars, in the Play app only what Google Play said ('' when it said nothing) */
  const priceOf = c => (PLAY ? playPrices.get(c.sku) || '' : money(c.cents));
  const support = () => (typeof SUPPORT_CONTACT === 'string' && SUPPORT_CONTACT && SUPPORT_CONTACT !== PLACEHOLDER ? SUPPORT_CONTACT : '');

  /* ---------- what is owned ---------- */
  const ownsSku = sku => { const c = bySku.get(sku); if (!c || c.type === 'consumable') return false;
    if (S.perm.includes(sku)) return true; if (S.perm.includes('ot_everything') && EVERYTHING_PARTS.includes(sku)) return true;
    return c.type === 'permanent' && sku !== 'ot_everything' && sku !== 'ot_supporter' && c.grant.items.every(i => eco.owns(i)); };
  /* spec 4.4 (8): an owned permanent item is not offered again; the bundle goes once two or more of its parts are owned */
  const hidden = sku => ownsSku(sku) || (sku === 'ot_everything' && EVERYTHING_PARTS.filter(ownsSku).length >= 2);
  /* a purchase dated in the future (the device clock was changed) still counts: only one older than 30 days drops out */
  const spent30 = (now = Date.now()) => S.journal.reduce((n, j) => n + (j.kind === 'buy' && now - j.t < WINDOW ? j.cents || 0 : 0), 0);
  const room = () => Math.max(0, S.cap - spent30());

  /* ---------- the photo frame that comes with the Supporter set ---------- */
  let frameOn = false;
  const perks = () => {
    if (!frameOn && eco.owns('frame:supporter') && game.photo && game.photo.registerFrame) { frameOn = true;
      game.photo.registerFrame('supporter', { name: 'Supporter', inset: [6, 6], draw(ctx, w, h) { const t = Math.max(8, Math.round(Math.min(w, h) * 0.035)); ctx.save(); ctx.lineWidth = t; ctx.strokeStyle = '#2f6f5f'; ctx.strokeRect(t / 2, t / 2, w - t, h - t); ctx.lineWidth = Math.max(2, t / 4); ctx.strokeStyle = '#f0c040'; ctx.strokeRect(t * 1.3, t * 1.3, w - t * 2.6, h - t * 2.6); ctx.restore(); } }); }
  };

  /* ---------- gems that were paid for: never lost to "Start over" ----------
     gemBank is how many purchased gems are still unspent, counting free gems as spent first. It falls as the balance falls,
     and when purchased gems go into an item that item is written down in gemItems with how many went in. If the purchase
     is undone, or the prop is put away for its gems, exactly those gems go back into the bank. So a new save gets back
     what was paid for: unspent purchased gems, and the things purchased gems bought. */
  let dropped = 0;
  const bank = n => { S.gemBank = Math.max(0, Math.round(S.gemBank + n)); };
  const clampBank = () => { const have = game.wallet.get('gems'); if (S.gemBank > have) { dropped += S.gemBank - have; S.gemBank = have; } };
  bus.on('itemBought', e => { const d = e && e.currency === 'gems' && e.cost > 0 && e.item && e.item.cat !== 'treat' ? Math.min(dropped, e.cost) : 0; dropped = 0; if (d > 0) { S.gemItems[e.id] = Math.min((S.gemItems[e.id] || 0) + d, e.cost); save(); } });
  const giveBack = (id, gems) => { const d = Math.min(S.gemItems[id] || 0, gems > 0 ? gems : 0); delete S.gemItems[id]; if (d > 0) { bank(d); clampBank(); dropped = 0; } save(); };
  bus.on('itemUndone', e => { if (e && e.id in S.gemItems) giveBack(e.id, e.gems); });
  bus.on('decor', e => { if (e && e.on === false && e.id in S.gemItems && e.refund && e.refund.gems > 0) giveBack(e.id, e.refund.gems); });

  /* ---------- putting a grant into the save: only through game.economy.grant ---------- */
  function applyGrant(sku, grant, source) {
    const c = bySku.get(sku), items = [];
    for (const id of grant.items || []) { const m = /^treat:(\d{1,2})$/.exec(id); if (m) { const n = Math.min(10, Math.max(1, +m[1])); items.push({ id: 'treat:party', n }); } else if (!eco.owns(id)) items.push(id); }
    const gems = grant.gems || 0, got = eco.grant({ gems, items }, source);
    if (gems > 0) bank(gems);
    for (const k of Object.keys(grant.flags || {})) eco.setFlag(k, grant.flags[k]);
    if (c && c.type !== 'consumable' && !S.perm.includes(sku)) S.perm.push(sku);
    perks(); trailCheck(true);
    return got;
  }
  const lines = (c, restore) => { const out = []; if (c.grant.gems && !restore) out.push(c.grant.gems.toLocaleString('en-US') + ' gems'); for (const i of c.grant.items) out.push(NAMES[i] || i); return out; };

  /* ---------- the Trail Journal ---------- */
  bus.on('missionComplete', e => { if (e && typeof e.id === 'string' && !J.missions.includes(e.id) && J.missions.length < 200) J.missions.push(e.id); });
  const missionsDone = () => { let n = J.missions.length; try { const d = state.modules.missions && state.modules.missions.done; if (d && typeof d === 'object') n = Math.max(n, Object.keys(d).filter(k => d[k]).length); } catch (e) { /* another module's data: optional */ } return n; };
  const have = kind => Math.floor(kind === 'zones' ? state.collected.zones.length : kind === 'balls' ? state.collected.balls.length : kind === 'missions' ? missionsDone() : Number(state.stats[kind]) || 0);
  const hasPass = () => eco.owns('pass:trail');
  const aboutUsd = gems => (typeof eco.usd === 'function' ? eco.usd(gems) : '$' + (Math.ceil(gems * 99 / 80 - 1e-9) / 100).toFixed(2));
  /* pays every step that has been reached and not paid; with the pass, the second column too (all at once if bought late) */
  function trailCheck(quiet) {
    let bones = 0, gems = 0, passGems = 0; const items = [], pass = hasPass();
    for (const s of STEPS) { if (have(s.kind) < s.need) continue;
      if (!J.free.includes(s.n)) { J.free.push(s.n); bones += s.free.bones; gems += s.free.gems; }
      if (pass && !S.passPaid.includes(s.n)) { S.passPaid.push(s.n); if (s.pass.item) items.push(s.pass.item); else passGems += s.pass.gems; } }
    if (!bones && !gems && !passGems && !items.length) return null;
    eco.grant({ bones, gems }, 'journal'); if (passGems || items.length) { eco.grant({ gems: passGems, items }, 'journal:pass'); bank(passGems); }
    if (!quiet || bones || gems) game.toast('Trail Journal: ' + [bones ? bones + ' bones' : '', gems + passGems ? (gems + passGems) + (gems + passGems === 1 ? ' gem' : ' gems') : '', items.length ? (items.length === 1 ? PASS_ITEMS.find(p => p.id === items[0]).name : items.length + ' cosmetics') : ''].filter(Boolean).join(', '), { icon: 'star', kind: 'gold', ms: 3600 });
    save(); bus.emit('journalStep', { bones, gems: gems + passGems, items }); return { bones, gems: gems + passGems, items };
  }
  let tick = 0; bus.on('second', () => { if (++tick % 2 === 0) { clampBank(); dropped = 0; trailCheck(false); } });
  bus.on('wallet', clampBank); bus.on('spend', clampBank);

  function journalTab(pane) {
    const pass = hasPass(), showPass = pass || (STORE && game.grownUp.spending && (PLAY ? sellable('ot_trail_pass') : true)), done = STEPS.filter(s => have(s.kind) >= s.need).length;
    pane.appendChild(ui.heading('Trail Journal', 'Thirty steps for things KC does anyway. Nothing resets and nothing runs out.'));
    pane.appendChild(ui.progress(done, STEPS.length, `${done} of ${STEPS.length} steps reached`));
    const list = el('div', { class: 'tj' + (showPass ? ' two' : '') });
    const head = el('div', { class: 'tj-row tj-head' }, `<i></i><span>Step</span><span>Free</span>${showPass ? `<span>Pass${pass ? '' : ' (not owned)'}</span>` : ''}`); list.appendChild(head);
    for (const s of STEPS) { const now = Math.min(have(s.kind), s.need), reached = now >= s.need;
      const row = el('div', { class: 'tj-row' + (reached ? ' done' : ''), 'data-step': s.n });
      row.appendChild(el('i', { class: 'tj-n' }, String(s.n)));
      const goal = el('div', { class: 'tj-goal' }); const b = el('b'); b.textContent = s.text; goal.appendChild(b); const sm = el('small'); sm.textContent = reached ? 'Reached' : `${now.toLocaleString('en-US')} of ${s.need.toLocaleString('en-US')}`; goal.appendChild(sm); row.appendChild(goal);
      row.appendChild(el('div', { class: 'tj-free' + (J.free.includes(s.n) ? ' paid' : '') }, ui.price(s.free) + (J.free.includes(s.n) ? '<em>Earned</em>' : '')));
      if (showPass) { const paid = S.passPaid.includes(s.n), d = el('div', { class: 'tj-pass' + (paid ? ' paid' : '') + (pass ? '' : ' off') });
        d.innerHTML = '<i class="tj-lab">Pass</i>' + (s.pass.item ? `<span class="tj-it">${ui.icon('star', 16)}<b>${esc(s.pass.name)}</b></span>` : ui.price({ gems: s.pass.gems }) + (game.showUsd === false ? '' : `<small>about ${esc(aboutUsd(s.pass.gems))}</small>`)) + (paid ? '<em>Added</em>' : ''); row.appendChild(d); }
      list.appendChild(row); }
    pane.appendChild(list);
    if (showPass && !pass) pane.appendChild(ui.note(`The Pass column is the Trail Journal pass: ${priceOf(bySku.get('ot_trail_pass'))} of real money in the grown-ups' Store. It holds cosmetics and gems only, pays every step already reached, and never runs out.`));
    pane.appendChild(ui.note('Free column: bones and one gem on every step. The steps are paid the moment KC reaches them.'));
  }

  /* ------------------------------------------------------------------ talking to the worker (or the test double) */
  /* The pretend worker. Reached only when MOCK is true (both ?debug=1 and ?mock=1). It answers like worker/dewclaw-worker.js. */
  const MOCK_KV = 'kc-open-trail-store-mock';
  const mockRead = () => { try { return JSON.parse(localStorage.getItem(MOCK_KV) || '{}') || {}; } catch (e) { return {}; } };
  const mockWrite = kv => localStorage.setItem(MOCK_KV, JSON.stringify(kv));
  function mockWorker(path, body) {
    if (!MOCK) throw new Error('Mock mode is off.');
    const kv = mockRead(), fail = (status, error) => ({ status, body: { error } }); kv.sessions = kv.sessions || {}; kv.claims = kv.claims || {}; kv.keys = kv.keys || {};
    /* one-shot faults a test can ask for: 'offline' (any call), 'unpaid' / 'amount' (the next checkout), 'tamper-bones' (the next claim) */
    const isClaim = path === '/stripe/claim' || path === '/ot/play-claim', want = kv.next || '', next = want && (want === 'offline' || isClaim === (want === 'tamper-bones')) ? want : ''; if (next) { delete kv.next; mockWrite(kv); }
    if (next === 'offline') throw new TypeError('Failed to reach the server (pretend).');
    if (path === '/stripe/checkout') { const c = bySku.get(body.sku);
      if (!c) return fail(400, "That isn't something Dewclaw sells on the web.");
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(String(body.install || ''))) return fail(400, "The game didn't send its install id.");
      const id = 'cs_mock_' + randomId(12).replace(/[^A-Za-z0-9]/g, 'x'); kv.sessions[id] = { sku: c.sku, install: body.install, paid: next !== 'unpaid', amount: next === 'amount' ? 1 : c.cents }; mockWrite(kv);
      const u = new URL(location.href); u.searchParams.set('debug', '1'); u.searchParams.set('mock', '1'); u.searchParams.delete('cancelled'); u.searchParams.set('cs', id); return { status: 200, body: { url: u.href, session: id } }; }
    if (path === '/stripe/claim') { const id = String(body.session || ''); if (!SESSION_RE.test(id)) return fail(400, 'A checkout session is required.');
      const seen = kv.claims[id];
      if (seen) { if (seen.install !== body.install) return fail(403, 'That purchase was made on a different device. Use the Trail Key to restore it.'); const { install: _i, ...pub } = seen; return { status: 200, body: { ...pub, already: true } }; }
      const s = kv.sessions[id]; if (!s) return fail(402, 'That payment was not found.'); if (!s.paid) return fail(402, "That payment hasn't gone through yet.");
      if (s.install !== body.install) return fail(403, 'That purchase was made on a different device. Use the Trail Key to restore it.');
      const c = bySku.get(s.sku); if (s.amount !== c.cents) return fail(409, "That payment doesn't match the price of the item, so nothing was granted. Please contact support.");
      const out = { kind: 'grant', sku: c.sku, grant: JSON.parse(JSON.stringify(c.grant)), consumable: c.type === 'consumable', once: c.type === 'once', amount: c.cents, currency: 'USD', at: Date.now(), install: s.install };
      if (next === 'tamper-bones') out.grant.bones = 5000;
      if (c.type !== 'consumable') { let key = normKey(body.key); if (!kv.keys[key]) { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; key = ''; for (const x of crypto.getRandomValues(new Uint8Array(8))) key += A[x % A.length]; key = key.slice(0, 4) + '-' + key.slice(4); kv.keys[key] = []; } if (!kv.keys[key].includes(c.sku)) kv.keys[key].push(c.sku); out.key = key; }
      kv.claims[id] = out; mockWrite(kv); const { install: _i, ...pub } = out; return { status: 200, body: { ...pub, already: false } }; }
    /* the pretend Google Play check. A pretend token says what it is: mockplay.<sku>.<any letters>[.pending | .refunded | .otherapp] */
    if (path === '/ot/play-claim') { kv.play = kv.play || {}; const c = bySku.get(body.sku), token = String(body.token || '');
      if (!c) return fail(400, "That isn't something the game sells.");
      if (token.length < 10 || token.length > 4000 || /\s/.test(token)) return fail(400, 'A purchase token is required.');
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(String(body.install || ''))) return fail(400, "The game didn't send its install id.");
      const m = /^mockplay\.(ot_[a-z0-9_]+)\.[A-Za-z0-9]+(?:\.(pending|refunded|otherapp))?$/.exec(token), seen = kv.play[token];
      const bad = !m || m[2] === 'otherapp' ? "Google Play doesn't know that purchase." : m[2] === 'pending' ? 'That purchase is still pending with Google Play. It will be added once the payment goes through.' : m[2] === 'refunded' ? 'That purchase was cancelled or refunded.' : '';
      if (seen) { if (seen.sku !== c.sku) return fail(409, 'That purchase is for a different item, so nothing was granted.');
        const { install: _i, ...pub } = seen; if (seen.install === body.install) return { status: 200, body: { ...pub, already: true } };
        if (c.type === 'consumable') return fail(403, 'That purchase has already been used on another device.'); if (bad) return fail(402, bad);
        return { status: 200, body: { ...pub, grant: { ...pub.grant, gems: 0 }, restored: true, already: true } }; }
      if (bad) return fail(402, bad); if (m[1] !== c.sku) return fail(409, 'That purchase is for a different item, so nothing was granted.');
      const out = { kind: 'grant', sku: c.sku, grant: JSON.parse(JSON.stringify(c.grant)), consumable: c.type === 'consumable', once: c.type === 'once', channel: 'play', at: Date.now(), settled: true, install: body.install };
      if (next === 'tamper-bones') out.grant.bones = 5000;
      if (c.type !== 'consumable') { let key = normKey(body.key); if (!kv.keys[key]) { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; key = ''; for (const x of crypto.getRandomValues(new Uint8Array(8))) key += A[x % A.length]; key = key.slice(0, 4) + '-' + key.slice(4); kv.keys[key] = []; } if (!kv.keys[key].includes(c.sku)) kv.keys[key].push(c.sku); out.key = key; }
      kv.play[token] = out; mockWrite(kv); const { install: _i, ...pub } = out; return { status: 200, body: { ...pub, already: false } }; }
    if (path === '/ot/restore') { const key = normKey(body.key); if (key.length !== 9) return fail(400, 'Enter the 8-character Trail Key.'); const skus = kv.keys[key]; if (!skus) return fail(404, "That Trail Key isn't on record. Check it and try again.");
      return { status: 200, body: { kind: 'restore', key, skus, grants: skus.map(k => ({ sku: k, grant: { ...JSON.parse(JSON.stringify(bySku.get(k).grant)), gems: 0 }, once: bySku.get(k).type === 'once' })) } }; }
    return fail(404, 'Not found.');
  }
  /* the one place a request leaves the game. Callers have already been through the gate and a button press. */
  async function call(path, body) {
    let status, data;
    if (MOCK) { const r = mockWorker(path, body); status = r.status; data = r.body; }
    else { if (!LIVE || !STORE) throw new Error('The store is not open yet.');   /* the web has no store: never a request from it */
      let r; try { r = await fetch(workerBase + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' }); }
      catch (e) { throw new Error('The payment server could not be reached. Check the connection and try again.'); }
      status = r.status; data = await r.json().catch(() => ({})); }
    if (status < 200 || status >= 300) { const err = new Error((data && typeof data.error === 'string' && data.error.slice(0, 200)) || 'The payment server said no.'); err.status = status; throw err; }
    return data || {};
  }

  /* ------------------------------------------------------------------ buying */
  let busy = false, notes = [];
  const tell = fn => { if (ui.started) fn(); else notes.push(fn); };
  bus.on('start', () => { const q = notes; notes = []; for (const fn of q) setTimeout(fn, 400); });
  const record = e => { S.journal.push({ t: Date.now(), ...e, ...(MOCK ? { test: true } : {}) }); S.journal = S.journal.slice(-200); };

  /* step 2 of 2: the price and the exact contents, then the payment page */
  function confirmBuy(c) {
    ui.openModal({ id: 'store-confirm', title: 'Buy this?', className: 'store store-confirm', render: bd => {
      const top = el('div', { class: 'st-top' }); const n = el('b'); n.textContent = c.name; top.appendChild(n); const p = el('span', { class: 'st-price' }); p.textContent = priceOf(c); top.appendChild(p); bd.appendChild(top);
      const what = el('p', { class: 'st-sub' }); what.textContent = PLAY ? `${priceOf(c)}, paid once through Google Play. This is real money. Google Play shows the final price, with any tax, before you pay.` : `${money(c.cents)} in US dollars, paid once by card. This is real money. Sales tax may be added on the payment page where it applies.`; bd.appendChild(what);
      bd.appendChild(el('h3', { class: 'sech' }, 'You get exactly'));
      const ulist = el('ul', { class: 'st-list' }); for (const t of lines(c)) { const li = el('li'); li.textContent = t; ulist.appendChild(li); } bd.appendChild(ulist);
      bd.appendChild(ui.note(c.type === 'consumable' ? (c.group === 'tip' ? 'A tip buys nothing else and cannot be restored on another device.' : 'This is used up as it is spent and cannot be restored on another device.' + (PLAY ? '' : ' Unused gems are refunded on request within 14 days.'))
        : (PLAY ? 'Yours for good, and kept with the Google account that pays. ' : 'Yours for good. ') + 'After paying you get a Trail Key: type it on another device to get these items there too' + (c.grant.gems ? ' (the gems are not restored).' : '.')));
      bd.appendChild(ui.note(`Device limit: ${money(spent30())} of ${money(S.cap)} spent in the last 30 days on this device${PLAY ? ', counted at the US list prices' : ''}. This is a limit in the game, not a limit at your bank.`));
      if (MOCK) bd.appendChild(ui.note('TEST MODE: this is a pretend payment. No card is asked for and no money moves.', 'warn'));
    }, actions: [{ label: 'Not now' }, { label: `Pay ${priceOf(c)}`, primary: true, onClick: () => { if (PLAY) payPlay(c); else pay(c); } }] });
  }
  /* step 1 of 2: checks, then the gate, then the confirm screen */
  async function buy(sku) {
    const c = bySku.get(sku); if (!c || !STORE) return false;
    if (!game.grownUp.spending) { game.toast('Ask a grown-up to turn on the shop.', { icon: 'hand' }); return false; }
    if (!sellable(sku)) { game.toast('Coming soon. This cannot be bought yet.', { icon: 'hand' }); return false; }
    if (hidden(sku)) { game.toast('You already have this.', { icon: 'star' }); return false; }
    if (c.cents > room()) { game.toast(`That would go over this device's limit of ${money(S.cap)} in 30 days.`, { kind: 'warn', icon: 'hand', ms: 4200 }); return false; }
    if (!PLAY && S.pending && S.pending.session) { game.toast('An earlier payment has not been added yet. Finish it or forget it first, at the top of the Store.', { kind: 'warn', icon: 'hand', ms: 5000 }); return false; }
    if (!(await ui.gate({ reason: `This buys "${c.name}" for ${priceOf(c)} of real money.` }))) return false;
    if (!game.grownUp.spending || !sellable(sku)) return false;
    confirmBuy(c); return true;
  }
  async function pay(c) {
    if (PLAY || !STORE) return;                              /* the Play app never opens a Stripe page; the web has no store (no Stripe) */
    if (busy) return; if (!game.grownUp.spending || !sellable(c.sku) || c.cents > room()) return; busy = true;
    try {
      if (!S.install) S.install = randomId(24);
      S.pending = { sku: c.sku, t: Date.now() }; save();
      const res = await call('/stripe/checkout', { sku: c.sku, install: S.install });
      let u; try { u = new URL(res.url); } catch (e) { throw new Error('The payment page did not open.'); }
      const okHost = MOCK ? u.origin === location.origin : (u.protocol === 'https:' && u.hostname === 'checkout.stripe.com');
      if (!okHost) throw new Error('The payment page did not open.');
      /* the session id is written down before leaving, so a payment whose return link lands in another browser or app can still be finished from here */
      if (typeof res.session === 'string' && SESSION_RE.test(res.session)) S.pending.session = res.session;
      bus.emit('storeCheckout', { sku: c.sku, cents: c.cents }); save();
      location.assign(u.href);
    } catch (e) { S.pending = null; save(); busy = false; game.toast(e.message || 'That did not work. Nothing was charged.', { kind: 'warn', ms: 5000 }); }
  }

  /* ---------- Google Play Billing (the Play app only) ----------
     payPlay: Google's own purchase sheet (Payment Request), then the token goes to the worker to be checked and granted.
     claimPlay: one token -> the worker -> the grant. Answers 'added', 'restored', 'already', 'pending' or 'failed'.
     playSync: asks Google Play what this account holds and claims whatever is not in this game yet: a purchase whose answer
     was lost, a permanent item bought on another device, a used-up item Google still has to be told about. */
  async function claimPlay(sku, token, o = {}) {
    const c = bySku.get(sku); if (!PLAY_ON || !c || typeof token !== 'string' || token.length < 10 || token.length > 4000) return 'failed';
    const ref = await digest('play:' + token), had = S.applied.includes(ref);
    try {
      const res = await call('/ot/play-claim', { sku, token, install: S.install, ...(S.key ? { key: S.key } : {}) });
      const bad = res && res.kind === 'grant' && res.sku === sku ? grantProblem(res.grant) : 'kind';
      if (bad) { bus.emit('storeRefused', { reason: bad }); if (o.loud) tell(() => game.toast('The server sent something that is not a store item, so nothing was added. Please contact support.', { kind: 'warn', ms: 6000 })); return 'failed'; }
      /* Google has not taken the acknowledge yet: remembered, so the next look at Google Play asks the worker again */
      S.unsettled = S.unsettled.filter(r => r !== ref); if (res.settled === false) S.unsettled.push(ref);
      /* a used-up item is also consumed on the device, so Google Play lets it be bought again straight away */
      if (c.type === 'consumable' && dg && typeof dg.consume === 'function') { try { await dg.consume(token); } catch (e) { /* the worker has already consumed it */ } }
      if (had) { save(); return 'already'; }
      S.applied.push(ref); S.applied = S.applied.slice(-400);
      const restored = res.restored === true, was = S.perm.includes(sku);
      const got = applyGrant(sku, restored ? { ...res.grant, gems: 0 } : res.grant, restored ? 'store:restore' : 'store:' + sku);
      if (typeof res.key === 'string' && KEY_RE.test(res.key)) S.key = res.key;
      if (restored) { record({ kind: 'restore', skus: was ? [] : [sku], via: 'play' }); bus.emit('storeRestore', { skus: was ? [] : [sku] }); }
      else { record({ kind: 'buy', sku, cents: c.cents, price: priceOf(c).slice(0, 24), via: 'play', ref: ref.slice(0, 10) }); bus.emit('storePurchase', { sku, cents: c.cents, gems: got.gems, items: got.items }); if (o.loud) tell(() => thanks(c, res, got)); }
      save(); return restored ? 'restored' : 'added';
    } catch (e) {
      if (o.loud) tell(() => game.toast((e.message || 'That purchase could not be added yet.') + (e.status === 402 || !e.status || e.status >= 500 ? ' If it was paid, open Store, Restore purchases, and it will be added.' : ''), { kind: 'warn', ms: 8000 }));
      return e.status === 402 ? 'pending' : 'failed';
    }
  }
  async function payPlay(c) {
    if (!PLAY_ON || busy) return false; if (!game.grownUp.spending || !sellable(c.sku) || hidden(c.sku) || c.cents > room()) return false; busy = true;
    let resp = null, out = 'failed';
    try {
      if (!S.install) { S.install = randomId(24); save(); }
      /* Google Play shows the real total itself; the Payment Request API wants a total, and Google ignores it */
      const req = new window.PaymentRequest([{ supportedMethods: PLAY_METHOD, data: { sku: c.sku } }], { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } });
      bus.emit('storeCheckout', { sku: c.sku, cents: c.cents });
      try { resp = await req.show(); } catch (e) { game.toast('Payment cancelled. Nothing was charged.', { icon: 'hand', ms: 4200 }); return false; }
      const d = (resp && resp.details) || {}, token = typeof d.purchaseToken === 'string' ? d.purchaseToken : typeof d.token === 'string' ? d.token : '';
      if (!token) { game.toast('Google Play did not send a purchase, so nothing was added.', { kind: 'warn', ms: 6000 }); return false; }
      out = await claimPlay(c.sku, token, { loud: true });
      return out === 'added';
    } finally {
      if (resp && typeof resp.complete === 'function') { try { await resp.complete(out === 'added' || out === 'already' ? 'success' : 'fail'); } catch (e) { /* the sheet is already closed */ } }
      busy = false; if (ui.current && ui.current.id === 'store') ui.current.handle.refresh();
    }
  }
  async function playSync(loud) {
    if (!PLAY_ON || busy) return null; if (!(await playInit())) return null; busy = true; const added = [];
    try {
      const list = await dg.listPurchases();
      for (const p of (Array.isArray(list) ? list : []).slice(0, 40)) { const c = p && bySku.get(p.itemId), token = p && p.purchaseToken; if (!c || typeof token !== 'string') continue;
        const ref = await digest('play:' + token);
        /* a permanent item that is already here and settled needs nothing; a used-up item still on Google's list has not been consumed yet */
        if (S.applied.includes(ref) && c.type !== 'consumable' && !S.unsettled.includes(ref)) continue;
        if (!S.install) { S.install = randomId(24); save(); }
        const r = await claimPlay(c.sku, token, {}); if (r === 'added' || r === 'restored') added.push(c.sku); }
    } catch (e) { return null; } finally { busy = false; }
    if (added.length) { game.toast('Added from Google Play: ' + added.map(k => bySku.get(k).name).join(', '), { icon: 'star', kind: 'good', ms: 5000 }); if (ui.current && ui.current.id === 'store') ui.current.handle.refresh(); }
    else if (loud) game.toast('Everything bought with this Google account is already here.', { icon: 'star' });
    return added;
  }

  /* ---------- coming back from the payment page ---------- */
  function thanks(c, res, got) {
    ui.openModal({ id: 'store-thanks', title: 'Thank you', className: 'store', render: bd => {
      const p = el('p'); p.textContent = `"${c.name}" has been added to this game.`; bd.appendChild(p);
      const ulist = el('ul', { class: 'st-list' }); for (const t of lines(c)) { const li = el('li'); li.textContent = t; ulist.appendChild(li); } bd.appendChild(ulist);
      if (res.key) { const k = el('div', { class: 'st-key' }); k.innerHTML = '<small>Your Trail Key</small><b></b>'; k.lastChild.textContent = res.key; bd.appendChild(k);
        bd.appendChild(ui.note('Write the Trail Key down. On another phone or computer a grown-up types it in Store, Restore purchases, to get the permanent items there. Gems and treats are not restored.')); }
      bd.appendChild(ui.note(MOCK ? 'TEST MODE: this was a pretend payment. No money moved.' : PLAY ? 'The receipt comes from Google Play, to the Google account that paid. The game does not see that account.' : 'The receipt from Stripe went to the email address typed on the payment page. The game does not see that address.', MOCK ? 'warn' : ''));
    }, actions: [{ label: 'Back to the game', primary: true }] });
  }
  let lastStatus = 0;
  async function claim(session) {
    if (busy) return false; busy = true; lastStatus = 0;
    try {
      const ref = await digest(session);
      if (S.applied.includes(ref)) { S.pending = null; save(); tell(() => game.toast('That purchase was already added.', { icon: 'star' })); return false; }
      const res = await call('/stripe/claim', { session, install: S.install, ...(S.key ? { key: S.key } : {}) }); lastStatus = 200;
      /* the server says this session was claimed before: it is added only when it is the checkout this device wrote down and has not applied (the first answer was lost on the way) */
      if (res && res.already === true && !(S.pending && S.pending.session === session)) { S.pending = null; save(); tell(() => game.toast('That purchase was already added.', { icon: 'star' })); return false; }
      const c = res && res.kind === 'grant' ? bySku.get(res.sku) : null, bad = c ? grantProblem(res.grant) : 'kind';
      if (bad) { S.pending = null; save(); bus.emit('storeRefused', { reason: bad }); tell(() => game.toast('The server sent something that is not a store item, so nothing was added. Please contact support.', { kind: 'warn', ms: 6000 })); return false; }
      S.applied.push(ref); S.applied = S.applied.slice(-400);
      const got = applyGrant(c.sku, res.grant, 'store:' + c.sku);
      if (typeof res.key === 'string' && KEY_RE.test(res.key)) S.key = res.key;
      record({ kind: 'buy', sku: c.sku, cents: c.cents, ref: ref.slice(0, 10) }); S.pending = null; save();
      bus.emit('storePurchase', { sku: c.sku, cents: c.cents, gems: got.gems, items: got.items });
      tell(() => thanks(c, res, got)); return true;
    } catch (e) {
      lastStatus = e.status || 0;
      /* a payment that could not be confirmed yet is kept, so the store can offer "Finish adding your purchase" */
      if (S.pending && (!e.status || e.status === 402 || e.status >= 500)) { S.pending.session = session; save(); } else { S.pending = null; save(); }
      tell(() => game.toast(e.message || 'That purchase could not be added yet.', { kind: 'warn', ms: 6000 })); return false;
    } finally { busy = false; }
  }
  function onReturn() {
    const cs = query.get('cs'), cancelled = query.get('cancelled');
    if (cs == null && cancelled == null) return;
    try { const u = new URL(location.href); u.searchParams.delete('cs'); u.searchParams.delete('cancelled'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) { /* the address bar stays as it is */ }
    if (PLAY || !STORE) return;                              /* the Play app never claims a Stripe payment; the web has no store (no Stripe) */
    if (cancelled != null && cs == null) { if (S.pending) { S.pending = null; save(); tell(() => game.toast('Payment cancelled. Nothing was charged.', { icon: 'hand', ms: 4200 })); } return; }
    if (!SESSION_RE.test(cs)) return;
    if (cs.startsWith('cs_mock_') && !MOCK) return;          /* a pretend session means nothing outside the test mode */
    if (!MOCK && !LIVE) return;                              /* the store is not open: nothing is asked of anyone */
    if (!S.pending || !S.install) { tell(() => game.toast('That payment was started in a different browser or app, so it cannot be added here. Open the game where Pay was pressed, then Store, Finish adding it.', { kind: 'warn', ms: 9000 })); return; }
    claim(cs);
  }

  /* ---------- restore: Trail Key -> the permanent items again ---------- */
  async function restoreKey(key) {
    key = normKey(key); if (!KEY_RE.test(key)) throw new Error('Enter the 8-character Trail Key.');
    const res = await call('/ot/restore', { key });
    if (!res || res.kind !== 'restore' || !Array.isArray(res.grants)) throw new Error('The server did not send a restore.');
    const added = [];
    for (const g of res.grants.slice(0, 20)) { const c = g && bySku.get(g.sku); if (!c || c.type === 'consumable' || grantProblem(g.grant)) continue;
      const was = S.perm.includes(c.sku); applyGrant(c.sku, { ...g.grant, gems: 0 }, 'store:restore'); if (!was) added.push(c.sku); }
    S.key = key; record({ kind: 'restore', skus: added }); save(); bus.emit('storeRestore', { skus: added }); if (ui.current && ui.current.id === 'store') ui.current.handle.refresh();
    return added;
  }
  async function restoreScreen() {
    if (!STORE) return false;
    if (!game.grownUp.spending) { game.toast('Ask a grown-up to turn on the shop.', { icon: 'hand' }); return false; }
    if (!(await ui.gate({ reason: 'Restore purchases is for the grown-up who paid.' }))) return false;
    if (PLAY) await playInit();
    let input = null, msg = null, working = false;
    const h = ui.openModal({ id: 'store-restore', title: 'Restore purchases', className: 'store', render: bd => {
      if (PLAY) { const g = el('p'); g.textContent = dg ? 'Things bought with this Google account come back from Google Play. Permanent items come back; gems, treats and tips that were used up do not.' : 'Google Play could not be reached just now, so it cannot be asked what was bought. Try again in a minute.'; bd.appendChild(g);
        if (dg) { const gb = el('button', { type: 'button', class: 'btn go st-open', 'data-act': 'restore-play' }); gb.textContent = 'Restore from Google Play'; gb.addEventListener('click', async () => { if (working) return; working = true; msg.textContent = 'Asking Google Play...'; const r = await playSync(false); working = false; if (!msg.isConnected) return; msg.textContent = r == null ? 'That did not work. Try again in a minute.' : r.length ? 'Restored: ' + r.map(k => bySku.get(k).name).join(', ') : 'Everything bought with this Google account is already here.'; }); bd.appendChild(gb); }
        bd.appendChild(el('h3', { class: 'sech' }, 'Have a Trail Key?')); }
      const p = el('p'); p.textContent = PLAY ? 'A Trail Key is the 8-character code given with a permanent item. Type it to get those items here too.' : 'Type the Trail Key you were given after your first permanent purchase. Permanent items come back; gems, treats and tips do not.'; bd.appendChild(p);
      input = el('input', { type: 'text', class: 'st-input', maxlength: '9', placeholder: 'ABCD-2345', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Trail Key', inputmode: 'text' }); if (S.key) input.value = S.key; bd.appendChild(input);
      msg = el('p', { class: 'st-msg', role: 'status' }); bd.appendChild(msg);
      if (!MOCK && !LIVE) bd.appendChild(ui.note('The store is not open yet, so there is nothing to restore.', 'warn'));
      if (MOCK) bd.appendChild(ui.note('TEST MODE: restores come from the pretend server in this browser.', 'warn'));
    }, actions: [{ label: 'Go back' }, { label: PLAY ? 'Use the Trail Key' : 'Restore', primary: true, keepOpen: true, onClick: async () => {
      if (working || !input) return; if (!MOCK && !LIVE) { msg.textContent = 'The store is not open yet.'; return; } working = true; msg.textContent = 'Checking...';
      try { const added = await restoreKey(input.value); h.close(); game.toast(added.length ? `Restored: ${added.map(k => bySku.get(k).name).join(', ')}` : 'Everything on that Trail Key is already here.', { icon: 'star', kind: 'good', ms: 5000 }); }
      catch (e) { if (msg && msg.isConnected) msg.textContent = e.message || 'That did not work.'; } finally { working = false; } } }] });
    return true;
  }

  /* ---------- the device limit ---------- */
  async function setCap(cents) { if (!STORE || !CAPS.includes(cents)) return false; if (!(await ui.gate({ reason: 'Changing the real-money limit for this device.' }))) return false; S.cap = cents; save(); bus.emit('storeCap', { cents }); return true; }
  async function capScreen() {
    if (!STORE) return false;
    if (!(await ui.gate({ reason: 'Changing the real-money limit for this device.' }))) return false;
    ui.openModal({ id: 'store-cap', title: 'Device limit', className: 'store', render: bd => {
      const p = el('p'); p.textContent = `The most this device may spend in the store in any 30 days${PLAY ? ', counted at the US list prices' : ''}. Spent in the last 30 days: ${money(spent30())}.`; bd.appendChild(p);
      const row = el('div', { class: 'st-caps' });
      for (const c of CAPS) { const b = el('button', { type: 'button', class: 'btn ' + (c === S.cap ? 'go' : 'alt'), 'data-cap': c }); b.textContent = money(c).replace('.00', ''); b.setAttribute('aria-pressed', c === S.cap ? 'true' : 'false');
        b.addEventListener('click', () => { S.cap = c; save(); bus.emit('storeCap', { cents: c }); ui.closeModal('store-cap'); if (ui.current && ui.current.id === 'store') ui.current.handle.refresh(); game.toast(`Limit set to ${money(c)} in 30 days.`, { icon: 'gear' }); }); row.appendChild(b); }
      bd.appendChild(row);
      bd.appendChild(ui.note('This limit lives in the game save on this device. It is not a limit at your bank or card. To stop all purchases, turn off "Real-money shop" in Settings.' + (PLAY ? ' Google Play has its own purchase approvals and password setting as well.' : '')));
    }, actions: [{ label: 'Done', primary: true }] });
    return true;
  }

  /* ------------------------------------------------------------------ the store screen */
  function storeBody(bd) {
    if (MOCK) bd.appendChild(ui.note('TEST MODE (debug): payments here are pretend. No card is asked for and no money moves.', 'warn'));
    else if (!PLAY && !LIVE) bd.appendChild(ui.note('The store is not open yet. The prices are shown so you can see what is planned; nothing can be bought.', 'warn'));
    if (PLAY && !dg) bd.appendChild(ui.note('The store could not reach Google Play just now, so nothing can be bought. Close the store and open it again in a minute.', 'warn'));
    const intro = el('p', { class: 'st-sub' }); intro.textContent = 'For grown-ups. Everything here costs real money and is a cosmetic, gems or a thank-you. Bones, and everything that changes how KC plays, are never sold: they are earned by playing.'; bd.appendChild(intro);
    const lim = el('div', { class: 'st-limit' }); const lt = el('span'); lt.textContent = `Spent on this device in the last 30 days: ${money(spent30())} of ${money(S.cap)}${PLAY ? ', counted at the US list prices' : ''}. A limit in the game, not at your bank.`; lim.appendChild(lt);
    const lb = el('button', { type: 'button', class: 'btn alt', 'data-act': 'cap' }); lb.textContent = 'Change limit'; lb.addEventListener('click', () => capScreen()); lim.appendChild(lb); bd.appendChild(lim);
    if (!PLAY && S.pending && S.pending.session) { const fin = el('div', { class: 'st-limit' }); const t = el('span'); t.textContent = `A payment for "${bySku.get(S.pending.sku).name}" was started here and has not been added. If it was paid, finish adding it.`; fin.appendChild(t);
      const b = el('button', { type: 'button', class: 'btn go', 'data-act': 'finish' }); b.textContent = 'Finish adding it'; b.addEventListener('click', async () => { const s = S.pending && S.pending.session; if (s) { const ok = await claim(s);
        if (!ok && lastStatus === 402 && S.pending && await ui.confirm('Not paid yet', 'The payment server says no money was taken for this. Forget it? (If a payment is still going through, keep it and try again later.)', 'Forget it', 'Keep it')) { S.pending = null; save(); }
        if (ui.current && ui.current.id === 'store') ui.current.handle.refresh(); } }); fin.appendChild(b);
      const fb = el('button', { type: 'button', class: 'btn alt', 'data-act': 'forget' }); fb.textContent = 'Nothing was paid'; fb.addEventListener('click', async () => { if (await ui.confirm('Forget this payment?', 'Only do this if no money was taken. If a payment was made, go back and press "Finish adding it".', 'Forget it', 'Go back')) { S.pending = null; save(); if (ui.current && ui.current.id === 'store') ui.current.handle.refresh(); } }); fin.appendChild(fb); bd.appendChild(fin); }
    const owned = [];
    for (const [gid, title, sub] of GROUPS) { const cards = [];
      for (const c of CATALOG.filter(x => x.group === gid)) { if (hidden(c.sku)) { if (ownsSku(c.sku)) owned.push(c.name); continue; }
        const can = sellable(c.sku), over = c.cents > room();
        cards.push(ui.item({ id: c.sku, title: c.name, text: PLAY ? c.blurb.replace(/ Bought one by one these cost \$[\d.]+\./, '') : c.blurb /* Google shows local prices: no fixed dollar sum beside them */, icon: gid === 'gems' ? 'gem' : gid === 'treats' ? 'paw' : gid === 'tip' ? 'hand' : 'star', priceLabel: priceOf(c), tag: c.type === 'consumable' ? '' : c.type === 'once' ? 'One per device' : 'Yours for good',
          locked: can && over ? 'Over this device\'s 30-day limit' : '', button: can ? { label: `Buy ${priceOf(c)}`, onClick: () => buy(c.sku) } : { label: 'Coming soon', disabled: true, primary: false } })); }
      if (!cards.length) continue; bd.appendChild(ui.heading(title, sub)); bd.appendChild(ui.grid(cards)); }
    if (owned.length) bd.appendChild(ui.note('Already yours on this device: ' + owned.join(', ') + '.', 'good'));

    bd.appendChild(ui.heading('Purchase journal', 'Every purchase and restore made on this device.'));
    const buys = S.journal.slice().reverse();
    if (!buys.length) bd.appendChild(ui.note('Nothing has been bought on this device.'));
    else { const jl = el('ul', { class: 'st-journal' }); for (const j of buys.slice(0, 50)) { const li = el('li'), d = new Date(j.t), when = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      const a = el('span'); a.textContent = j.kind === 'restore' ? (j.via === 'play' ? 'Restored from Google Play' : 'Restored with a Trail Key') + (j.skus && j.skus.length ? ': ' + j.skus.map(k => (bySku.get(k) || { name: k }).name).join(', ') : '') : (bySku.get(j.sku) || { name: j.sku }).name + (j.test ? ' (test, no money)' : '');
      const b2 = el('b'); b2.textContent = j.kind === 'restore' ? '' : typeof j.price === 'string' && j.price ? j.price : money(j.cents || 0); const t = el('time'); t.textContent = when; li.appendChild(t); li.appendChild(a); li.appendChild(b2); jl.appendChild(li); } bd.appendChild(jl); }
    const keyRow = el('div', { class: 'st-limit' }); const kt = el('span'); kt.textContent = S.key ? `Trail Key for this device: ${S.key}. It brings permanent items to another device.` : 'A Trail Key is given with the first permanent purchase. It brings permanent items to another device.'; keyRow.appendChild(kt);
    const rb = el('button', { type: 'button', class: 'btn alt', 'data-act': 'restore' }); rb.textContent = 'Restore purchases'; rb.addEventListener('click', () => restoreScreen()); keyRow.appendChild(rb); bd.appendChild(keyRow);

    bd.appendChild(ui.heading('Good to know'));
    const sup = support();
    for (const t of PLAY ? [
      'Refunds: purchases here are made through Google Play, and refunds follow Google Play\'s refund rules. ' + (sup ? 'For help, ask at ' + sup + '.' : 'The contact for help will be listed here before the store opens.'),
      'A save is never locked over a refund or a payment dispute.',
      'Payments are taken by Google Play. The game never sees a card number, a name or an email address.',
      'Privacy: the game has no accounts, no adverts and no tracking. When a grown-up pays or restores, the game sends the item chosen, the purchase token Google Play gave for it, a random install number made on this device, and the Trail Key if there is one. Nothing else is sent, and nothing is sent at any other time.',
      'Nothing here is random: every item lists exactly what it contains. Gems are play tokens for cosmetics, not money: they cannot be cashed out or turned into bones.'
    ] : [
      'Refunds: unused gems are refunded on request within 14 days of purchase. ' + (sup ? 'Ask at ' + sup + '.' : 'The contact for refunds will be listed here before the store opens.'),
      'A save is never locked over a refund or a payment dispute.',
      'Payments are taken by Stripe on its own page. The game never sees a card number, a name or an email address.',
      'Privacy: the game has no accounts, no adverts and no tracking. When a grown-up pays or restores, the game sends the item chosen, a random install number made on this device, and the Trail Key if there is one. Nothing else is sent, and nothing is sent at any other time.',
      'Nothing here is random: every item lists exactly what it contains. Every gem price in the game shows about what it costs in dollars at the smallest pack\'s rate (80 gems for $0.99).'
    ]) { const p = el('p', { class: 'st-fine' }); p.textContent = t; bd.appendChild(p); }
  }
  async function open() {
    if (!STORE) return false;
    if (!game.grownUp.spending) { game.toast('Ask a grown-up to turn on the shop.', { icon: 'hand' }); return false; }
    if (!(await ui.gate({ reason: 'The store sells things for real money. It is for grown-ups.' }))) return false;
    if (!game.grownUp.spending) return false;
    if (PLAY) await playInit();                              /* Google Play is asked for its prices only now, after the gate */
    ui.openModal({ id: 'store', title: 'Store', wide: true, wallet: true, className: 'store', render: storeBody, actions: [{ label: 'Close', primary: true }] });
    bus.emit('storeOpen', {});
    if (PLAY && dg) playSync(false);                         /* anything this Google account holds that is not in the game yet */
    return true;
  }
  function storeTab(pane) {
    if (!game.grownUp.spending) { const p = el('p', { class: 'st-ask' }); p.textContent = 'Ask a grown-up to turn on the shop.'; pane.appendChild(p); return; }
    pane.appendChild(ui.heading('Store', 'For grown-ups. Real money.'));
    const p = el('p', { class: 'st-sub' }); p.textContent = 'Cosmetics, gems and a thank-you for the maker. Bones and everything that changes how KC plays stay free. A grown-up answers a question to open it, and every price is shown in dollars.'; pane.appendChild(p);
    const b = el('button', { type: 'button', class: 'btn go st-open', 'data-act': 'open-store' }); b.textContent = 'Open the store (grown-ups)'; b.addEventListener('click', () => open()); pane.appendChild(b);
    if (MOCK) pane.appendChild(ui.note('TEST MODE (debug): payments are pretend.', 'warn'));
  }

  /* ------------------------------------------------------------------ boot */
  game.cosmetics.define(PASS_ITEMS.filter(p => !game.cosmetics.get(p.id)));
  /* the Settings switch belongs to a build that sells something. A Play app with no store has none, unless the owner has
     also turned the real-gear shelf on for the Play app (PLAY_REAL_GEAR): js/merch.js then shows the switch, worded for what it does. */
  if (STORE) game.grownUp.showSwitch = true;
  else { game.grownUp.storeOff = true; game.grownUp.switchLabel = 'Real KC gear shelf (grown-ups only)'; }
  /* "about $X" next to gem prices only where gems can be bought for dollars: the localhost test double. The web sells nothing
     and the Play app shows Google's local prices in its store, so neither shows a dollar hint. */
  game.showUsd = STORE && !PLAY;
  /* "Start over" keeps this module's record, so what was paid for comes back: permanent items, pass rewards, unspent purchased gems */
  { const back = []; for (const sku of S.perm) { const c = bySku.get(sku); for (const i of c.grant.items) if (!/^treat:/.test(i) && !eco.owns(i) && !back.includes(i)) back.push(i); for (const k of Object.keys(c.grant.flags)) if (eco.getFlag(k) !== c.grant.flags[k]) eco.setFlag(k, c.grant.flags[k]); }
    for (const n of S.passPaid) { const it = STEPS[n - 1].pass.item; if (it && !eco.owns(it) && !back.includes(it)) back.push(it); }
    for (const id of Object.keys(S.gemItems)) if (!eco.owns(id) && !back.includes(id)) back.push(id);
    const gems = Math.max(0, S.gemBank - game.wallet.get('gems'));
    if (back.length || gems) eco.grant({ gems, items: back }, 'store:kept'); }
  /* "Start over": say what is kept, and put the grown-up gate first when real money has been spent on this device */
  if (Array.isArray(ui.resetNotes)) ui.resetNotes.push(() => (S.perm.length || S.gemBank > 0 || Object.keys(S.gemItems).length || S.journal.some(j => j.kind === 'buy' || j.kind === 'restore')
    ? { gate: true, text: 'Kept: everything bought in the Store, the purchased gems not yet spent, and the things bought with purchased gems.' } : null));
  perks();
  game.shop.registerTab({ id: 'journal', title: 'Trail Journal', icon: 'flag', order: 80, render: journalTab });
  if (STORE) {
    game.shop.registerTab({ id: 'store', title: 'Store', icon: 'gem', order: 100, render: storeTab });
    ui.addSetting({ id: 'store-limit', label: 'Real-money limit for this device (grown-ups)', type: 'button', button: 'Change', order: 91, onClick: () => capScreen() });
    ui.addSetting({ id: 'store-restore', label: 'Restore purchases (grown-ups)', type: 'button', button: 'Restore', order: 92, onClick: () => restoreScreen() });
  }
  bus.on('spending', () => { if (ui.current && ui.current.id === 'shop') ui.current.handle.refresh(); });
  onReturn();

  const api = {
    catalog: CATALOG, steps: STEPS, passItems: PASS_ITEMS,
    live: LIVE, mock: MOCK,
    /* channel: 'play' | 'web'. hasStore: false in a Play app with Google Play Billing switched off. playReady: Google Play has answered with prices. */
    channel: PLAY ? 'play' : 'web', hasStore: STORE, playBilling: PLAY_ON, get playReady() { return !!dg; }, restorePlay: () => playSync(true),
    sku: id => bySku.get(id) || null, price: id => (bySku.has(id) ? priceOf(bySku.get(id)) : ''), contents: id => (bySku.has(id) ? lines(bySku.get(id)) : []),
    sellable, owns: ownsSku, hidden,
    open, buy, restore: restoreScreen, limitScreen: capScreen, setLimit: setCap,
    get limit() { return S.cap; }, spent30, room,
    journal: () => S.journal.map(j => ({ ...j })), get key() { return S.key; }, get pending() { return S.pending ? { ...S.pending } : null; },
    /* the one grown-up gate for anything to do with money or leaving the game (merch uses it too) */
    gate: reason => ui.gate(typeof reason === 'string' ? { reason } : reason || {}),
    trail: { steps: STEPS, have, check: () => trailCheck(true), hasPass, freePaid: () => J.free.slice(), passPaid: () => S.passPaid.slice() }
  };
  /* test hooks: only with ?debug=1 AND ?mock=1 */
  if (MOCK) api.debug = {
    /* the whole purchase without the page reload: pretend checkout, pretend payment, claim, grant, journal */
    async buy(sku) { const c = bySku.get(sku); if (!c) return false; if (!S.install) S.install = randomId(24); S.pending = { sku, t: Date.now() }; const r = await call('/stripe/checkout', { sku, install: S.install }); return claim(new URL(r.url).searchParams.get('cs')); },
    claim, restoreKey, pay: sku => pay(bySku.get(sku)), playInit, payPlay: sku => payPlay(bySku.get(sku)), claimPlay, playSync, next(mode) { const kv = mockRead(); kv.next = mode; mockWrite(kv); }, kv: mockRead, wipeServer() { localStorage.removeItem(MOCK_KV); },
    data: () => JSON.parse(JSON.stringify(S)), trail: () => JSON.parse(JSON.stringify(J)), backdate(days) { for (const j of S.journal) j.t -= days * DAY; save(); }
  };
  return api;
}
