/* Merch: the in-game shelves for the real KC Beyond Limits products, their in-game twins and the claim screen
   (MONETIZATION-EXPANSION-SPEC.md section 5). The core imports this file and calls init(game) once at boot.

   What a child sees: shelves at the tailor, the pet supply, the coffee shop and the makers market, and a "KC Gear" tab in
   the Shop. Everything on them is an in-game twin priced in BONES. No real-money price is shown on this side.

   What a grown-up sees, one step further and only behind the grown-up gate (and only while the real-money switch in
   Settings is on): the real products, each with the game's own copy of its picture, its title and "from $X, checked on
   <date>". Choosing one shows a plain "You are leaving the game" screen and then opens exactly
   https://kcbeyondlimits.com/product/<id> in a new tab with rel="noopener noreferrer". No iframe, no tracking parameter,
   and the game itself never asks the shop for anything.

   The claim: a grown-up types the order number of a real order and picks what was bought. KC gets the in-game twin and a
   "Real Gear" collar tag, nothing else. It runs on trust: the number is not checked, not sent anywhere and not kept.
   Each twin can be claimed once on a device. A claim never gives bones, gems or anything that changes play.

   Network: this file makes ONE request, for the game's own ./merch.json (same origin, cached by the service worker).
   Pictures are local files in ./img/merch/ and are only requested when a grown-up opens the real-gear list.
   merch.json and the pictures are made by tools/sync-merch.js, which the owner runs; players' browsers never run it. */

const SHOP_HOME = 'https://kcbeyondlimits.com';
const SHOP_NAME = 'KC Beyond Limits';
const DAY = 86400000, STALE_DAYS = 30;
const TAG = 'tag:real-gear';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* The 14 launch twins (spec 5.3). `product` is the real product's id on the shop. Colours follow the real designs
   loosely: a twin is "inspired by" its product, drawn in the game's flat low-poly style, never a copy of the print. */
export const TWINS = [
  { id: 'hat:trucker', product: '34460071', shelf: 'tailor', slot: 'hat', bones: 600, name: 'Adventure trucker cap', text: 'A mesh-back cap with a gold badge.', value: { type: 'merch-trucker', color: 0x26282b }, swatch: 0x26282b, swatch2: 0xd9a23a },
  { id: 'hat:mountain-paw', product: '34460072', shelf: 'tailor', slot: 'hat', bones: 600, name: 'Mountain Paw cap', text: 'A soft black cap for sunny trails.', value: { type: 'cap', color: 0x25272a }, swatch: 0x25272a, swatch2: 0xe8c93a },
  { id: 'hat:flatbill', product: '34460075', shelf: 'tailor', slot: 'hat', bones: 600, name: 'Adventure Club flat bill', text: 'A flat-brimmed cap with a round badge.', value: { type: 'merch-flatbill', color: 0x33373b }, swatch: 0x33373b, swatch2: 0x4f9a6a },
  { id: 'hat:compass-beanie', product: '34460076', shelf: 'tailor', slot: 'hat', bones: 600, name: 'Compass beanie', text: 'A red knit beanie for foggy mornings.', value: { type: 'beanie', color: 0xd0202e }, swatch: 0xd0202e },
  { id: 'hat:pom-beanie', product: '34460077', shelf: 'tailor', slot: 'hat', bones: 600, name: 'Mountain Paw pom-pom beanie', text: 'A black beanie with a big pom-pom.', value: { type: 'merch-pom', color: 0x1f2124 }, swatch: 0x1f2124, swatch2: 0xe8c93a },
  { id: 'bandana:river-logo', product: '34341309', shelf: 'tailor', slot: 'bandana', bones: 400, name: 'River Logo bandana', text: 'Forest green, like the hoodie.', value: 0x1f4a34, swatch: 0x1f4a34 },
  { id: 'collar:river', product: '34395138', shelf: 'pets', slot: 'collar', bones: 400, name: 'River pattern collar', text: 'River teal, like the real collar.', value: 0x2f7f86, swatch: 0x2f7f86 },
  { id: 'tag:moon-compass', product: '34395135', shelf: 'pets', slot: 'tag', bones: 400, name: 'Moon Compass tag', text: 'A night-blue collar tag.', value: 0x24506a, swatch: 0x24506a },
  { id: 'harness:explore', product: '34395136', shelf: 'pets', slot: 'harness', bones: 500, name: 'Explore Further harness', text: 'Sunset cream, for good dogs who go further.', value: 0xf0e2c0, swatch: 0xf0e2c0 },
  { id: 'harness:camp-kc', product: '34399813', shelf: 'pets', slot: 'harness', bones: 500, name: 'Camp KC harness', text: 'Campfire-night green.', value: 0x2f4f3a, swatch: 0x2f4f3a },
  { id: 'decor:river-bed', product: '34395132', shelf: 'pets', slot: 'decor', bones: 800, name: 'River pattern pet bed', text: "A comfy bed for KC's den.", swatch: 0x2f6fb0 },
  { id: 'decor:camp-mug', product: '34399669', shelf: 'cafe', slot: 'decor', bones: 300, name: 'Camp KC mug', text: "A mug on a crate for KC's den.", swatch: 0xf4ead8, swatch2: 0xc8402f },
  { id: 'skin:van:adventure-club', product: '34395112', shelf: 'market', slot: 'skin:van', bones: 500, name: 'Adventure Club van paint', text: 'Forest green and river blue.', value: { primary: 0x2a5d3a, secondary: 0x8ec9e8 }, swatch: 0x2a5d3a, swatch2: 0x8ec9e8 },
  { id: 'skin:skateboard:squatch', product: '34399759', shelf: 'market', slot: 'skin:skateboard', bones: 500, name: 'Squatch Country board paint', text: 'Deep woods green and cream.', value: { primary: 0x1f3a2a, secondary: 0xe8d9a8 }, swatch: 0x1f3a2a, swatch2: 0xe8d9a8 }
];

/* The shelves (spec 5.1): where each one stands in the world and which real products sit on it. */
export const SHELVES = [
  { id: 'tailor', title: 'Hats and clothes', where: 'Stitch & Sit Costume Tailor', sign: 'KC Hats', prompt: 'Look at the KC hat shelf', col: 0x6a4f8a, items: [0x26282b, 0xd0202e, 0x1f4a34, 0x33373b, 0xe8c93a, 0xf4ead8] },
  { id: 'pets', title: 'Dog gear', where: 'Tailwind Pet Supply', sign: 'KC Dog Gear', prompt: 'Look at the KC dog gear shelf', col: 0x2f7f86, items: [0x2f7f86, 0xf0e2c0, 0x2f4f3a, 0x24506a, 0x2f6fb0, 0xe8c93a] },
  { id: 'cafe', title: 'Mugs', where: 'Fogline Coffee', sign: 'KC Mugs', prompt: 'Look at the KC mug shelf', col: 0x7a4f2f, items: [0xf4ead8, 0xc8402f, 0xf4ead8, 0x2f4f3a, 0xf4ead8, 0xe8c93a] },
  { id: 'market', title: 'Stickers, bags and small things', where: 'Bridgeside Makers Market', sign: 'KC Stickers', prompt: 'Look at the KC sticker shelf', col: 0x3f9f7f, items: [0x2a5d3a, 0x8ec9e8, 0x1f3a2a, 0xe8d9a8, 0xd9a23a, 0xf4ead8] },
  { id: 'winter', title: 'Winter shelf', where: 'Bridgeside Makers Market', sign: 'Winter Shelf', prompt: 'Look at the winter shelf', col: 0xb03a3a, seasonal: true }
];

const validId = id => /^\d{5,12}$/.test(String(id));
/* the only address a product card can open: built here from the id, never taken from a file, so nothing can ride along on it */
export const productUrl = id => (validId(id) ? `${SHOP_HOME}/product/${id}` : null);
/* the winter shelf is out from 1 November to 5 January by the device's date. Real dates; no countdown is ever shown. */
export const winterOpen = (d = new Date()) => { const m = d.getMonth() + 1, day = d.getDate(); return m === 11 || m === 12 || (m === 1 && day <= 5); };
const niceDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? `${+m[3]} ${MONTHS[+m[2] - 1] || ''} ${m[1]}` : ''; };
/* "from $X, checked on <date>". An old check drops the number (spec 5.5); a "was" price is never shown. */
export function priceLine(p, now = Date.now()) {
  const n = Number(p && p.price), t = Date.parse(((p && p.checkedOn) || '') + 'T00:00:00Z');
  if (!(n > 0) || !Number.isFinite(t) || now - t > STALE_DAYS * DAY) return "See today's price on the shop page";
  return `from $${n.toFixed(2)}, checked on ${niceDate(p.checkedOn)}${p.onSale ? ' (a sale price when checked)' : ''}; today's price is on the shop page`;
}
/* an order number: 5 to 40 characters, letters, digits, spaces and # . _ - only, with at least four digits. The real
   format is not known yet (the owner is to send a sample confirmation), so this only stops an empty or silly entry. */
export const looksLikeOrder = s => { const t = String(s || '').trim(); return t.length >= 5 && t.length <= 40 && /^[A-Za-z0-9#._ -]+$/.test(t) && (t.match(/\d/g) || []).length >= 4; };

export function init(game) {
  const ui = game.ui, el = ui.el, P = game.place, C = game.cosmetics, eco = game.economy;
  const DEBUG = /[?&]debug=1(&|$)/.test(location.search);
  const asset = rel => new URL('../' + rel, import.meta.url).href;

  /* this module's stylesheet */
  if (!document.getElementById('merch-css')) { const l = el('link', { id: 'merch-css', rel: 'stylesheet', href: asset('css/merch.css') }); document.head.appendChild(l); }

  /* saved: which twins were claimed from a real order (twin id -> date). Never the order number. Kept through "Start over". */
  const D = game.moduleData('merch', { claimed: {} });
  if (!D.claimed || typeof D.claimed !== 'object' || Array.isArray(D.claimed)) D.claimed = {};
  game.save.keepOnReset('merch');

  const twinById = new Map(TWINS.map(t => [t.id, t])), twinByProduct = new Map(TWINS.map(t => [t.product, t])), shelfById = new Map(SHELVES.map(s => [s.id, s]));
  const price = n => { const e = game.modules && game.modules.economy; return e && typeof e.price === 'function' ? e.price(n) : n; };   /* follows the economy's ECON_SCALE */
  const isDecor = t => t.slot === 'decor';
  const den = () => (game.modules && game.modules.upgrades) || null;

  /* ---------- the twins as wearables ---------- */
  game.kc.registerHat('merch-trucker', (g, c = 0x26282b) => { g.ball(0, 0, -0.02, 0.17, 0.115, 0.165, 0x3a3d42, 7, 4); g.ball(0, 0.005, 0.045, 0.165, 0.118, 0.13, c, 7, 4); g.box(0, -0.02, 0.21, 0.21, 0.02, 0.17, c); g.box(0, 0.045, 0.172, 0.085, 0.07, 0.012, 0xd9a23a); g.box(0, 0.045, 0.179, 0.05, 0.04, 0.008, 0x2a5d3a); });
  game.kc.registerHat('merch-flatbill', (g, c = 0x33373b) => { g.cyl(0, -0.03, 0, 0.165, 0.15, 0.13, 8, c); g.box(0, -0.025, 0.2, 0.25, 0.018, 0.2, c, 0x26282b); g.box(0, 0.035, 0.158, 0.08, 0.07, 0.012, 0xf4ead8); g.box(0, 0.035, 0.165, 0.045, 0.04, 0.008, 0x4f9a6a); });
  game.kc.registerHat('merch-pom', (g, c = 0x1f2124) => { g.ball(0, 0.01, 0, 0.175, 0.15, 0.18, c, 7, 4); g.cyl(0, -0.03, 0, 0.185, 0.185, 0.065, 8, 0x2d3035); g.ball(0, 0.19, 0, 0.075, 0.075, 0.075, c, 6, 4); g.box(0, 0, 0.184, 0.06, 0.05, 0.01, 0xe8c93a); });
  for (const t of TWINS) if (!isDecor(t)) C.define({ id: t.id, slot: t.slot, name: t.name, value: t.value });
  /* the tag only a claim gives, and the two den props: the economy module lists them; these are fall-backs if it does not */
  if (!C.get(TAG)) C.define({ id: TAG, slot: 'tag', name: 'Real Gear tag', value: 0x4fd0c0 });

  /* a claim is a permanent gift: after "Start over" the claimed twins and the tag come back from this module's own record */
  { const back = Object.keys(D.claimed).filter(id => twinById.has(id) && !eco.owns(id)); if (back.length || (Object.keys(D.claimed).length && !eco.owns(TAG))) eco.grant({ items: [...back, ...(eco.owns(TAG) ? [] : [TAG])] }, 'merch:claimed'); }

  /* ---------- merch.json: the real products (the game's own copy) ---------- */
  let DATA = null, loadError = null;
  const clean = raw => {
    if (!raw || !Array.isArray(raw.products)) throw new Error('merch.json has no products');
    const products = [];
    for (const p of raw.products) { if (!p || !validId(p.id) || !shelfById.has(p.shelf)) continue; const tw = twinByProduct.get(String(p.id));
      products.push({ id: String(p.id), title: String(p.title || 'KC gear').slice(0, 90), shelf: p.shelf, price: p.price, checkedOn: p.checkedOn, onSale: !!p.onSale, featured: !!p.featured, retired: !!p.retired,
        url: productUrl(p.id), twin: tw ? tw.id : null, img: typeof p.img === 'string' && /^img\/merch\/\d+\.jpg$/.test(p.img) ? p.img : null }); }
    return { checkedOn: raw.checkedOn || null, notice: typeof raw.notice === 'string' && raw.notice.trim() ? raw.notice.trim().slice(0, 160) : null,
      tracking: raw.shop && ['none', 'on'].includes(raw.shop.tracking) ? raw.shop.tracking : 'unknown', products };
  };
  const ready = fetch(asset('merch.json')).then(r => { if (!r.ok) throw new Error('merch.json: ' + r.status); return r.json(); }).then(j => { DATA = clean(j); loadError = null; return true; })
    .catch(e => { loadError = e; console.warn('[merch] the real-gear list could not be loaded; the twins still work.', e && e.message); return false; });
  const products = () => (DATA ? DATA.products : []);
  const product = id => products().find(p => p.id === String(id)) || null;
  const retired = t => { const p = product(t.product); return !!(p && p.retired); };

  /* ---------- buying and wearing a twin (bones only) ---------- */
  const say = (text, kind = 'good') => game.toast(text, { icon: 'paw', kind });
  async function buyTwin(id) {
    const t = twinById.get(id); if (!t) return false; if (eco.owns(id)) return true;
    const okd = await ui.confirmSpend({ id, name: t.name, text: isDecor(t) ? "A prop for KC's den. It changes how the den looks, not how KC plays." : 'A cosmetic: it changes how KC looks, not how she plays.', price: { bones: price(t.bones) }, swatch: t.swatch, source: 'merch:' + t.shelf });
    if (!okd) return false;
    eco.grant({ items: [id] }, 'merch:' + t.shelf);
    if (isDecor(t)) { const U = den(), r = U && U.placeDecor ? U.placeDecor(id) : null; say(r === true ? `${t.name}: out by KC's den.` : `${t.name} is in the den's storage.`); }
    else { C.equip(id); say(worn(t)); }
    game.shop.refresh(); return true;
  }
  const isPaint = t => String(t.slot).startsWith('skin:'), worn = t => (isPaint(t) ? `The ${t.name} is on.` : `KC is wearing the ${t.name}.`);
  function wear(t, on) { if (on) { if (C.equip(t.id)) say(worn(t)); } else C.unequip(t.slot); game.shop.refresh(); }
  function denToggle(t) { const U = den(); if (!U || !U.placeDecor) { say("Put it out from the Den tab.", ''); return; }
    if (U.decorOn && U.decorOn(t.id)) { U.removeDecor(t.id); say('Put away.', ''); } else { const r = U.placeDecor(t.id); if (r === true) say(`${t.name}: out by KC's den.`); else say(typeof r === 'string' ? r : 'There is no room at the den yet.', 'warn'); } game.shop.refresh(); }

  function twinCard(t) {
    const owned = eco.owns(t.id), claimed = !!D.claimed[t.id], o = { id: t.id, title: t.name, text: t.text, swatch: t.swatch, swatch2: t.swatch2 };
    if (isDecor(t)) { const U = den(), on = !!(U && U.decorOn && U.decorOn(t.id));
      if (owned) { o.tag = on ? 'Out by the den' : claimed ? 'Yours (real gear)' : 'In den storage'; o.on = on; o.button = { label: on ? 'Put away' : 'Put out', primary: false, onClick: () => denToggle(t) }; }
      else { o.price = { bones: price(t.bones) }; o.button = { label: 'Get', onClick: () => buyTwin(t.id) }; }
    } else { const on = C.equipped(t.slot) === t.id; o.onPreview = () => { C.preview(t.id); const S = game.modules.shop; if (S && S.peek) S.peek(); };
      if (owned) { const paint = isPaint(t); o.tag = on ? (paint ? 'Painted on' : 'Wearing') : claimed ? 'Yours (real gear)' : 'Owned'; o.on = on; o.button = { label: on ? (paint ? 'Back to plain' : 'Take off') : paint ? 'Use this paint' : 'Wear', primary: !on, onClick: () => wear(t, !on) }; }
      else { o.price = { bones: price(t.bones) }; o.button = { label: 'Get', onClick: () => buyTwin(t.id) }; } }
    return ui.item(o);
  }

  /* ---------- the grown-up side ----------
     `unlocked` is true only while the real-gear list is open after a passed gate; closing the list locks it again. */
  let unlocked = false, focusShelf = null;
  const SPEND_OFF = 'The real-money shop is off on this device. A grown-up can turn it on in Settings.';
  const bigBtn = (label, onClick, cls = 'alt') => { const b = el('button', { type: 'button', class: 'btn ' + cls + ' mbig' }); b.textContent = label; b.addEventListener('click', () => { game.audio.sfx('ui'); onClick(); }); return b; };

  /* one gate for the real-gear side. With the real-money switch off nothing here opens and nothing here turns it on: a grown-up
     does that in Settings (spec 4.4, 1), so "having a look" can never leave the device able to spend. */
  async function pass(reason) {
    if (unlocked) return true;
    if (!game.grownUp.spending) { say(SPEND_OFF, 'warn'); return false; }
    return ui.gate({ reason });
  }
  const toSettings = () => { if (typeof ui.settings === 'function') ui.settings(); else say(SPEND_OFF, 'warn'); };

  function thumb(p, size) {
    const box = el('div', { class: 'mthumb' }), fallback = () => { box.classList.add('none'); box.innerHTML = ui.icon('paw', 28); };
    if (!p || !p.img) { fallback(); return box; }
    const im = el('img', { alt: '', loading: 'lazy', decoding: 'async', width: size || 96, height: size || 96, draggable: 'false' }); im.addEventListener('error', fallback, { once: true }); im.src = asset(p.img); box.appendChild(im); return box;
  }
  function realCard(p) {
    const tw = p.twin && twinById.get(p.twin), card = el('div', { class: 'mreal', 'data-product': p.id }), mid = el('div', { class: 'mid' });
    const h = el('b'); h.textContent = p.title; mid.appendChild(h);
    const pr = el('span', { class: 'mprice' }); pr.textContent = priceLine(p); mid.appendChild(pr);
    const sm = el('span', { class: 'msmall' }); sm.textContent = 'Printed to order. Shipping is added at checkout. No returns.'; mid.appendChild(sm);
    if (tw) { const s2 = el('span', { class: 'mtwin' }); s2.textContent = `In-game twin: ${tw.name} (${price(tw.bones)} bones, or free with a claim)`; mid.appendChild(s2); }
    const b = el('button', { type: 'button', class: 'btn go', 'aria-label': `See ${p.title} on the ${SHOP_NAME} shop, a separate website` }); b.textContent = 'See it on the shop'; b.addEventListener('click', () => { game.audio.sfx('ui'); openProduct(p.id); });
    card.appendChild(thumb(p, 96)); card.appendChild(mid); card.appendChild(b); return card;
  }

  /* the real-gear list: only ever drawn after pass() */
  function showReal(shelf) {
    unlocked = true;
    ui.openModal({ id: 'merch-real', title: 'Real KC gear', wide: true, className: 'merch', onClose: () => { unlocked = false; }, render: bd => {
      bd.appendChild(ui.note(`These are real things from the ${SHOP_NAME} shop, a separate website. They cost real money, are printed to order and are posted to you. Nothing here is needed to play, and money never buys bones.`));
      if (!DATA) { bd.appendChild(ui.note('The list of real gear could not be loaded just now. The shop itself is at kcbeyondlimits.com.', 'warn')); bd.appendChild(bigBtn('Go to the shop home page', () => leave(null), 'go')); return; }
      if (DATA.notice) bd.appendChild(ui.note(DATA.notice));
      const live = DATA.products.filter(p => !p.retired), group = (title, sub, list, key) => { if (!list.length) return; const h = ui.heading(title, sub); h.dataset.shelf = key; bd.appendChild(h); const g = el('div', { class: 'mreals' }); for (const p of list) g.appendChild(realCard(p)); bd.appendChild(g); };
      const order = SHELVES.slice().sort((a, b) => (a.id === shelf ? -1 : b.id === shelf ? 1 : 0));
      if (!shelf) group('On the front of the shelves', 'Eight things, each with an in-game twin', live.filter(p => p.featured), 'featured');
      for (const s of order) group(s.title, s.where + (s.seasonal ? ' (out from 1 November to 5 January)' : ''), live.filter(p => p.shelf === s.id && (shelf || !p.featured)), s.id);
      bd.appendChild(ui.heading('Bought something?', 'The in-game twin is free with a real order'));
      bd.appendChild(bigBtn('Claim a twin from a real order', () => openClaim()));
    }, actions: [{ label: 'Back to the game shop', primary: true }] });
  }
  async function openReal(shelf) {
    if (!(await pass(`This shows real things that cost real money, sold by the ${SHOP_NAME} shop, a separate website.`))) return false;
    await ready; showReal(shelfById.has(shelf) ? shelf : null); return true;
  }

  /* "You are leaving the game": the last step before the new tab. id null = the shop's home page. */
  function leave(id) {
    const p = id ? product(id) : null, href = id ? productUrl(id) : SHOP_HOME + '/'; if (!href || (id && (!p || p.retired))) return Promise.resolve(false);
    const go = (url, fin) => { const a = el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }); a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove(); game.emit('external', { host: new URL(url).hostname, product: url === href ? id || null : null }); fin(true); };
    return new Promise(res => { let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      ui.openModal({ id: 'merch-leaving', title: 'You are leaving the game', className: 'merch', render: bd => {
        const lead = el('p', { class: 'mlead' }); lead.textContent = `You are leaving the game for the ${SHOP_NAME} shop, a separate website.`; bd.appendChild(lead);
        if (p) { const row = el('div', { class: 'mgo' }); row.appendChild(thumb(p, 72)); const m = el('div', { class: 'mid' }), b = el('b'); b.textContent = p.title; m.appendChild(b); const s = el('span'); s.textContent = priceLine(p); m.appendChild(s); row.appendChild(m); bd.appendChild(row); }
        const where = el('p', { class: 'note murl' }); where.textContent = 'It opens in a new tab: ' + href.replace(/^https:\/\//, ''); bd.appendChild(where);
        const ul = el('ul', { class: 'mlist' }); for (const line of ['Printed to order. Shipping is added at checkout. No returns.',
          DATA && DATA.tracking === 'none' ? 'The shop says it does not use tracking.' : DATA && DATA.tracking === 'on' ? 'The shop uses tracking and cookies of its own (analytics and adverts).' : 'The shop is a separate website with its own cookies and privacy rules; it may use tracking.',
          'The game sends the shop nothing about you or your game, and it cannot tell whether you buy anything.']) { const li = el('li'); li.textContent = line; ul.appendChild(li); } bd.appendChild(ul);
      }, actions: [{ label: 'Stay in the game' }, ...(p ? [{ label: 'Shop home page', onClick: () => go(SHOP_HOME + '/', fin) }] : []), { label: p ? 'Open the product page' : 'Open the shop', primary: true, onClick: () => go(href, fin) }], onClose: () => fin(false) }); });
  }
  /* a product page, from a card or from code: never without the switch, the gate and the leaving screen */
  async function openProduct(id) {
    await ready; const p = product(id); if (!p || p.retired) return false;
    if (!game.grownUp.spending && !unlocked) { say(SPEND_OFF, 'warn'); return false; }
    if (!unlocked && !(await ui.gate({ reason: `This opens the ${SHOP_NAME} shop, a separate website where things cost real money.` }))) return false;
    return leave(p.id);
  }

  /* ---------- the claim: honour basis, cosmetic only, once per twin ---------- */
  function claim(order, twinId) {
    const t = twinById.get(twinId); if (!t) return { ok: false, reason: 'Pick what was bought.' };
    if (!looksLikeOrder(order)) return { ok: false, reason: 'That does not look like an order number. It is in the order confirmation email.' };
    if (D.claimed[t.id]) return { ok: false, reason: `The ${t.name} was already claimed on this device.` };
    const had = eco.owns(t.id), hadTag = eco.owns(TAG);
    D.claimed[t.id] = new Date().toISOString().slice(0, 10);   /* the date only: the order number is not kept or sent */
    const got = eco.grant({ items: [...(had ? [] : [t.id]), ...(hadTag ? [] : [TAG])] }, 'merch:claim');
    game.save.save(); game.emit('merchClaim', { twin: t.id, tag: !hadTag }); game.shop.refresh();
    return { ok: true, twin: t.id, had, tag: !hadTag, items: got && got.items };
  }
  function showClaim(preset) {
    let order = '', pick = preset && twinById.has(preset) && !D.claimed[preset] ? preset : '', msg = '';
    const h = ui.openModal({ id: 'merch-claim', title: 'Claim a twin', className: 'merch', render: bd => {
      const p1 = el('p'); p1.textContent = `Bought real KC gear from the ${SHOP_NAME} shop? KC can have the in-game twin for free, plus a "Real Gear" collar tag.`; bd.appendChild(p1);
      bd.appendChild(ui.note('This works on trust. The game cannot check an order number, does not send it anywhere and does not keep it. A claim gives the twin and the tag only: never bones, gems or anything that changes how KC plays. Each twin can be claimed once on this device.'));
      const left = TWINS.filter(t => !D.claimed[t.id]);
      if (!left.length) { bd.appendChild(ui.note('Every twin has been claimed on this device. Thank you!', 'good')); return; }
      const f = el('div', { class: 'mform' });
      const l1 = el('label', { for: 'merchOrder' }); l1.textContent = 'Order number (from the confirmation email)'; f.appendChild(l1);
      const inp = el('input', { id: 'merchOrder', type: 'text', inputmode: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '40', enterkeyhint: 'done' }); inp.value = order; inp.addEventListener('input', () => { order = inp.value; }); f.appendChild(inp);
      const l2 = el('label', { for: 'merchWhat' }); l2.textContent = 'What was bought'; f.appendChild(l2);
      const sel = el('select', { id: 'merchWhat' }), o0 = el('option', { value: '' }); o0.textContent = 'Pick one'; sel.appendChild(o0);
      for (const t of left) { const pr = product(t.product), o = el('option', { value: t.id }); o.textContent = `${pr ? pr.title : t.name} (twin: ${t.name})`; sel.appendChild(o); }
      sel.value = pick; sel.addEventListener('change', () => { pick = sel.value; }); f.appendChild(sel);
      const m = el('p', { class: 'mmsg', role: 'status' }); m.textContent = msg; f.appendChild(m);
      bd.appendChild(f);
      const s = el('p', { class: 'msmall' }); s.textContent = 'Only these products have a twin so far. If something goes wrong with a claim, the shop page says how to reach the owner.'; bd.appendChild(s);
    }, actions: [{ label: 'Not now' }, { label: 'Claim the twin', primary: true, keepOpen: true, onClick: () => {
      const r = claim(order, pick); if (!r.ok) { msg = r.reason; h.refresh(); return; }
      const t = twinById.get(r.twin); h.close(); if (!isDecor(t)) C.equip(t.id);
      game.banner('Thank you!', r.had ? `KC already had the ${t.name}. The Real Gear tag is hers now.` : `${t.name}${r.tag ? ' and the Real Gear tag' : ''}`); game.audio.sfx('reward'); ui.current && ui.current.handle && ui.current.handle.refresh(); } }] });
    return h;
  }
  async function openClaim(preset) {
    if (!unlocked && !(await ui.gate({ reason: 'Claiming a twin is for the grown-up who placed a real order.' }))) return false;
    await ready; showClaim(preset); return true;
  }

  /* ---------- the Shop tab ---------- */
  function renderTab(pane) {
    pane.classList.add('merch');
    pane.appendChild(ui.heading('KC gear twins', 'In-game versions of real KC gear. Bones only: tap a picture to try one on.'));
    const live = TWINS.filter(t => !retired(t)), gone = TWINS.filter(t => retired(t));
    let focusEl = null;
    for (const s of SHELVES) { const list = live.filter(t => t.shelf === s.id), winter = s.seasonal; if (winter ? !winterOpen() : !list.length) continue;
      const h = ui.heading(s.title, s.where); h.dataset.shelf = s.id; pane.appendChild(h); if (s.id === focusShelf) focusEl = h;
      if (list.length) pane.appendChild(ui.grid(list.map(twinCard)));
      if (winter) { pane.appendChild(ui.note('The winter shelf holds real ornaments and gift things. They are real-world items, so they are on the grown-ups side.')); pane.appendChild(game.grownUp.spending ? bigBtn('Grown-ups: see the winter shelf', () => openReal('winter')) : ui.note('Ask a grown-up to turn on the shop. ' + SPEND_OFF)); } }
    if (gone.length) { pane.appendChild(ui.heading('Retired designs', 'Still here for bones, at the same price')); pane.appendChild(ui.grid(gone.map(twinCard))); }
    pane.appendChild(ui.note('Twins are inspired by the real designs and drawn in the game\'s own style. They belong to this save and cannot be traded.'));

    const gh = ui.heading('For grown-ups', `Real KC gear from the ${SHOP_NAME} shop, a separate website`); gh.dataset.shelf = 'grownups'; pane.appendChild(gh);
    const box = el('div', { class: 'mgrown' });
    if (game.grownUp.spending) { box.appendChild(ui.note('The real things cost real money and are bought on the shop\'s own website, not in the game. A grown-up question comes first.')); box.appendChild(bigBtn('Grown-ups: see the real gear', () => openReal(focusShelf))); }
    else { box.appendChild(ui.note('Ask a grown-up to turn on the shop. ' + SPEND_OFF)); box.appendChild(bigBtn('Grown-ups: open Settings', toSettings)); }
    box.appendChild(bigBtn('Grown-ups: claim a twin from a real order', () => openClaim()));
    pane.appendChild(box);
    if (focusEl) { const f = focusEl; requestAnimationFrame(() => { try { f.scrollIntoView({ block: 'start' }); } catch (e) { /* ignore */ } }); }
  }
  const offTab = game.shop.registerTab({ id: 'merch', title: 'KC Gear', icon: 'paw', order: 90, render: pane => renderTab(pane) });
  function open(shelf) { focusShelf = shelfById.has(shelf) ? shelf : null; game.shop.open('merch'); }
  const offs = [offTab, game.on('modalClose', e => { if (e && e.id === 'shop') focusShelf = null; }), game.on('spending', () => { if (game.shop.current === 'merch') game.shop.refresh(); }), game.on('decor', () => { if (game.shop.current === 'merch') game.shop.refresh(); })];

  /* ---------- the shelves in the world ---------- */
  const places = {};
  const free = (c, r = 1.1) => c && P.clear(c.x, c.z, r) && P.clear(c.x + Math.sin(c.ry || 0) * 1.6, c.z + Math.cos(c.ry || 0) * 1.6, 0.6);
  const firstFree = list => { const c = list.filter(Boolean); return c.find(q => free(q)) || c[0] || null; };
  function shelfAt(s, at, n = '') {
    if (!at) return; const id = 'merch:shelf:' + s.id + n;
    P.shelf({ id, x: at.x, z: at.z, ry: at.ry || 0, name: s.sign, col: s.col, opts: { items: s.items }, prompt: s.prompt, icon: 'paw', onInteract: () => open(s.id), marker: n ? false : { label: 'KC gear: ' + s.title.toLowerCase(), color: '#4fd0c0', icon: 'paw' } });
    (places[s.id] = places[s.id] || []).push({ id, x: at.x, z: at.z, ry: at.ry || 0 });
  }
  function build() {
    for (const k of ['tailor', 'pets', 'cafe']) shelfAt(shelfById.get(k), firstFree([P.beside(k, 1, 1.4, 5.2), P.beside(k, -1, 1.4, 5.2), P.beside(k, 1, 1.4, 7.4), P.beside(k, -1, 1.4, 7.4)]));
    /* the makers market: a shelf beside each of the two stalls, on the stall line and facing the same way */
    const beside = (name, n) => { const st = P.stall(name, 0); if (!st) return; const s = st.stall, ry = s.ry || 0, ax = Math.cos(ry), az = -Math.sin(ry); shelfAt(shelfById.get('market'), firstFree([6, -6, 4.6, -4.6].map(d => ({ x: s.x + ax * d, z: s.z + az * d, ry }))), n); };
    beside('Tag & Stamp', ''); beside('Clay Paws', ':2');
    syncWinter();
  }
  /* the winter stall is only out in season (by the device's date) */
  function syncWinter() {
    const s = shelfById.get('winter'), id = 'merch:shelf:winter', have = !!P.get(id), want = winterOpen();
    if (want && !have) { const st = P.stall('Wool & Whistle', 0) || P.stall('Clay Paws', 0); if (!st) return; const b = st.stall, ry = b.ry || 0, ax = Math.cos(ry), az = -Math.sin(ry);
      const at = firstFree([-12, 60, -24, 72].map(d => ({ x: b.x + ax * d, z: b.z + az * d, ry }))); if (!at) return;
      P.stand({ id, kind: 'stall', x: at.x, z: at.z, ry: at.ry, name: s.sign, col: s.col, prompt: s.prompt, icon: 'paw', onInteract: () => open('winter'), marker: { label: 'KC gear: winter shelf', color: '#4fd0c0', icon: 'paw' } });
      places.winter = [{ id, x: at.x, z: at.z, ry: at.ry }]; }
    else if (!want && have) { P.remove(id); delete places.winter; }
  }
  try { build(); } catch (e) { console.error('[merch] shelves', e); }
  offs.push(game.on('shopTabOpen', e => { if (e && e.id === 'merch') { try { syncWinter(); } catch (err) { /* ignore */ } } }));

  if (!game.grownUp.showSwitch) game.grownUp.showSwitch = true;   /* the store module sets this too: the Settings row for the real-money switch */

  const api = {
    twins: TWINS, shelves: SHELVES, shopHome: SHOP_HOME, ready,
    products: () => products().map(p => ({ ...p })), product: id => { const p = product(id); return p ? { ...p } : null; },
    twin: id => twinById.get(id) || null, twinFor: productId => twinByProduct.get(String(productId)) || null,
    url: productUrl, priceLine, winterOpen, looksLikeOrder,
    get loaded() { return !!DATA; }, get loadError() { return loadError ? String(loadError.message || loadError) : null; }, get notice() { return DATA ? DATA.notice : null; }, get checkedOn() { return DATA ? DATA.checkedOn : null; },
    open,                 /* open(shelfId?): the KC Gear tab (twins for bones), scrolled to a shelf */
    buyTwin,              /* buyTwin(twinId) -> Promise<boolean>: the two-step bones purchase, then it is put on */
    openReal,             /* openReal(shelfId?) -> Promise<boolean>: grown-up gate, then the real products */
    openProduct,          /* openProduct(productId) -> Promise<boolean>: gate, "You are leaving the game", then the product page in a new tab */
    openClaim,            /* openClaim(twinId?) -> Promise<boolean>: gate, then the claim screen */
    claimed: () => ({ ...D.claimed }), isClaimed: id => !!D.claimed[id],
    places: () => JSON.parse(JSON.stringify(places)), syncWinter,
    remove() { for (const off of offs) { try { off(); } catch (e) { /* ignore */ } } P.removeAll('merch:'); }
  };
  if (DEBUG) api.debug = { claim, get unlocked() { return unlocked; }, data: () => JSON.parse(JSON.stringify(D)) };
  return api;
}
