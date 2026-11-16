/* Shop: the screens for spending bones (and, on cosmetics only, gems). Six tabs in the shared Shop screen:
     upgrades (10)    KC's abilities, gear, storage, photo mode, bakery treats, today's sniff-outs
     wardrobe (20)    everything KC can wear: try on, get, wear, saved outfits, a 10-minute Undo on gem purchases
     rides (30)       three parts and six paints for each kind of ride
     den (40)         KC's Den (move in first, pay it off on a bar), den storage, decor, Trail Buddies and the Buddy Whistle
     businesses (60)  the three tills
     funds (70)       Town Fund, Lantern Fund, Trail Markers
   plus a prompt at each shop door and market stall that opens the right tab.
   Every spend is two steps (the item, then a confirm screen with the price and the balance afterwards), every label is
   descriptive, nothing is timed, and no real-money price or link appears here: that is the store module's job.
   Prices and rules live in economy.js, effects in upgrades.js. */
const WEAR = ['hat', 'bandana', 'collar', 'tag', 'harness', 'trail', 'outfit'];
const SLOT_NAMES = { hat: 'Hats', bandana: 'Bandanas', collar: 'Collars', tag: 'Collar tags', harness: 'Harnesses', trail: 'Sparkle trails', outfit: 'Outfits and costumes', 'skin:skateboard': 'Skateboard paint', 'skin:canoe': 'Canoe paint', 'skin:van': 'Van paint' };
const RIDES = [['skateboard', 'Skateboards', 'Channel Cyclery'], ['canoe', 'Canoes', 'Knot & Oar Chandlery'], ['van', 'Vans', 'Scappoose Fuel & Treats']];

export function init(game) {
  const ui = game.ui, eco = game.economy, { el, esc, icon } = ui, up = () => game.modules.upgrades || null;
  const data = game.moduleData('shop', { outfits: [] }); if (!Array.isArray(data.outfits)) data.outfits = [];
  data.outfits = data.outfits.filter(o => o && typeof o === 'object' && o.look && typeof o.look === 'object').slice(0, 8);
  if (!document.getElementById('eco-css')) document.head.appendChild(el('link', { id: 'eco-css', rel: 'stylesheet', href: 'css/economy.css' }));
  const fmt = n => Math.round(n).toLocaleString('en-US'), hex = c => '#' + (c >>> 0).toString(16).padStart(6, '0');
  let focus = null;
  const open = (tab, section) => { focus = section || null; game.shop.open(tab); };
  const sec = (pane, key, title, sub) => { const h = ui.heading(title, sub); h.dataset.sec = key; pane.appendChild(h); if (focus === key) { focus = null; setTimeout(() => h.scrollIntoView({ block: 'start' }), 30); } return h; };
  const done = (text, kind = 'good') => { game.toast(text, { icon: 'star', kind }); game.shop.refresh(); };
  const btn = (label, onClick, o = {}) => { const b = el('button', { type: 'button', class: 'btn ' + (o.alt ? 'alt' : 'go') }); b.textContent = label; b.disabled = !!o.disabled; if (o.act) b.dataset.act = o.act; b.addEventListener('click', () => { game.audio.sfx('ui'); onClick(); }); return b; };

  /* ---------- a ladder card: name, level pips, what it does now, what the next tier does, the cost, and why not if not ---------- */
  async function buyLadder(l) {
    const c = eco.check(l.id); if (!c.ok) return; const n = eco.level(l.id) + 1, name = l.max > 1 ? `${l.name}: tier ${n} of ${l.max}` : l.name;
    if (l.payLater) { if (c.cost > 0 && !(await ui.confirm(`Move into the ${l.eff.stages[n - 1]}?`, `It costs ${fmt(c.cost)} bones. KC moves in now and pays it off on a bar, a little at a time or all at once. There is no rush and it never costs more.`, 'Move in', 'Not now'))) return; if (eco.buyLevel(l.id)) done(`${l.eff.stages[n - 1]}: ${l.fx[n - 1]}`); return; }
    if (!(await ui.confirmSpend({ id: l.id, name, text: l.fx[n - 1], price: { bones: c.cost }, icon: l.icon || 'star', source: 'upgrade:' + l.id, yes: 'Yes, upgrade' }))) return;
    if (eco.buyLevel(l.id, { paid: true })) done(`${l.name}: ${l.fx[n - 1]}`); else { game.wallet.add('bones', c.cost, 'refund'); game.shop.refresh(); }
  }
  function ladCard(l, o = {}) {
    const n = eco.level(l.id), c = eco.check(l.id), max = n >= l.max, card = el('div', { class: 'item eco-lad' + (max ? ' max' : '') + (c.reason === 'bones' ? ' short' : '') + (c.reason === 'locked' ? ' locked' : ''), 'data-ladder': l.id });
    const art = el('div', { class: 'art' }, icon(l.icon || (l.ride ? 'gear' : 'star'), 26)); card.appendChild(art);
    const mid = el('div', { class: 'mid' }), h = el('b'); h.textContent = o.title || l.name; mid.appendChild(h);
    const pips = el('div', { class: 'eco-pips', role: 'img', 'aria-label': `Level ${n} of ${l.max}` }); for (let i = 0; i < l.max; i++) pips.appendChild(el('i', { class: i < n ? 'on' : '' })); mid.appendChild(pips);
    const line = (cls, text) => { const s = el('span', { class: cls }); s.textContent = text; mid.appendChild(s); };
    if (!n && l.text) line('eco-about', l.text); if (n) line('eco-now', 'Now: ' + l.fx[n - 1]); if (!max) line('eco-next', (n ? 'Next: ' : 'First: ') + l.fx[n]);
    if (max) line('eco-done', 'Fully upgraded'); else if (!c.ok && c.reason !== 'owed') line('why', c.text);
    card.appendChild(mid);
    if (!max && !o.noBuy) { const side = el('div', { class: 'side' }); side.appendChild(el('div', { class: 'prices' }, ui.price({ bones: c.cost })));
      side.appendChild(btn(c.reason === 'bones' ? 'Not enough bones' : c.reason === 'locked' ? 'Locked' : o.verb || (n ? 'Upgrade' : 'Get'), () => buyLadder(l), { disabled: !c.ok, act: 'buy' })); card.appendChild(side); }
    return card;
  }
  const ladGrid = (pane, list, o) => { const g = el('div', { class: 'items eco-lads' }); for (const l of list) g.appendChild(ladCard(l, o)); pane.appendChild(g); return g; };

  /* ---------- an item card: cosmetics, treats, decor ---------- */
  const swatch = it => { const v = it.value; if (v == null) return {}; if (typeof v === 'number') return { swatch: v }; if (typeof v === 'object' && v.primary != null) return { swatch: v.primary, swatch2: v.secondary }; if (typeof v === 'object' && v.color != null) return { swatch: v.color }; return {}; };
  const peek = () => { const m = document.getElementById('modal'); if (!m) return; m.classList.add('eco-peek'); clearTimeout(peek.t); const off = () => { m.classList.remove('eco-peek'); m.removeEventListener('pointerdown', off, true); }; peek.t = setTimeout(off, 2600); setTimeout(() => m.addEventListener('pointerdown', off, true), 50); };
  async function pickCurrency(it, p) {
    if (!p.either) return 'bones';
    return new Promise(res => { let out = null; ui.openModal({ id: 'eco-pay', title: 'Pay with bones or gems?', wallet: true, render: b => { b.appendChild(ui.item({ title: it.name, text: 'Gems are never needed: every gem price can be paid in bones instead.', ...swatch(it), price: p })); },
      actions: [{ label: `${fmt(p.bones)} bones`, primary: true, onClick: () => { out = 'bones'; } }, { label: `${fmt(p.gems)} gems`, onClick: () => { out = 'gems'; } }], onClose: () => res(out) }); });
  }
  async function buyItem(it, after) {
    const p = eco.itemPrice(it.id), cur = await pickCurrency(it, p); if (!cur) return false; const c = eco.checkItem(it.id, cur);
    if (!c.ok && c.reason !== 'bones' && c.reason !== 'gems') { game.toast(c.text, { kind: 'warn' }); return false; }
    const cost = p[cur] || 0;
    if (cost > 0 && !(await ui.confirmSpend({ id: it.id, name: it.name, text: it.text || (it.cat === 'decor' ? 'Den decor. Every bone comes back if KC puts it away.' : cur === 'gems' ? 'A cosmetic. It can be undone for 10 minutes.' : 'A cosmetic: it changes how KC looks, not how she plays.'), price: { [cur]: cost }, ...swatch(it), source: 'shop:' + it.id }))) return false;
    if (!eco.buyItem(it.id, cur, { paid: cost > 0 })) { if (cost > 0) game.wallet.add(cur, cost, 'refund'); game.shop.refresh(); return false; }
    if (after) after(); return true;
  }
  function wearCard(d, it) {
    const owned = eco.owns(d.id) || !!d.free, on = game.cosmetics.equipped(d.slot) === d.id, p = it ? eco.itemPrice(it.id) : null, lock = it && !owned && it.req ? it.req(game) : null, und = eco.undoable(d.id);
    const text = it && it.gems && !owned ? `${fmt(it.gems)} gems is about ${eco.usd(it.gems)} if the gems were bought` : it && !owned ? it.where : '';
    const card = ui.item({ id: d.id, title: d.name, text, ...swatch(d), price: owned ? undefined : p, tag: on ? 'Wearing' : owned ? 'Owned' : '', on, locked: lock || undefined, onPreview: () => { game.cosmetics.preview(d.id); peek(); },
      button: owned ? { label: on ? 'Take off' : 'Wear', primary: !on, onClick: () => { if (on) game.cosmetics.unequip(d.slot); else game.cosmetics.equip(d.id); game.shop.refresh(); } } : it ? { label: 'Get', onClick: () => buyItem(it, () => { game.cosmetics.equip(d.id); done(`${d.name} is KC's now.`); }) } : undefined });
    if (und) { const b = btn(`Undo (${und.gems} gems back)`, async () => { if (await ui.confirm('Undo this?', `${d.name} goes back on the shelf and ${und.gems} gems come back.`, 'Undo', 'Keep it')) { eco.undo(d.id); done('Undone: the gems are back.'); } }, { alt: true, act: 'undo' }); card.querySelector('.side').appendChild(b); }
    return card;
  }
  const wearGrid = (pane, defs) => { const g = el('div', { class: 'items' }); for (const d of defs) g.appendChild(wearCard(d, eco.item(d.id))); pane.appendChild(g); };
  const forSale = slot => game.cosmetics.list(slot).filter(d => { const it = eco.item(d.id); return eco.owns(d.id) || d.free || (it && !it.premium); });

  /* ================= Upgrades ================= */
  function upgradesTab(pane) {
    const d = eco.daily(), box = el('div', { class: 'note eco-daily' + (d.paid ? ' good' : '') });
    box.innerHTML = `<b>Today's sniff-outs</b> ${d.paid ? 'All done. Come back any day you like: nothing is lost by missing one.' : `Do all three for ${d.gems} gems.`}<ul>${d.goals.map(g => `<li class="${g.done ? 'ok' : ''}">${esc(g.text)} <i>${fmt(g.have)} / ${fmt(g.need)}</i></li>`).join('')}</ul>`; pane.appendChild(box);
    sec(pane, 'abilities', "KC's abilities", 'Bones only. The last tier of each also asks for a bit of play.'); ladGrid(pane, eco.ladders('abilities'));
    sec(pane, 'gear', 'Gear', 'Tailwind Pet Supply and Driftwood Toys'); ladGrid(pane, eco.ladders('gear'));
    sec(pane, 'storage', 'Storage'); ladGrid(pane, eco.ladders('storage').filter(l => l.id !== 'denstore'));
    sec(pane, 'camera', 'Photo mode'); ladGrid(pane, eco.ladders('camera'));
    sec(pane, 'treats', 'Bakery treats', `Flour & Paw Bakery. The pouch holds ${eco.treatsHeld()} of ${eco.treatCap()}.`);
    const g = el('div', { class: 'items' });
    for (const it of eco.items('treat')) { const n = eco.count(it.id), c = eco.checkItem(it.id), card = ui.item({ id: it.id, title: it.name, text: it.text, icon: 'bone', price: eco.itemPrice(it.id), tag: n ? `In the pouch: ${n}` : '', button: { label: c.reason === 'bones' ? 'Not enough bones' : c.reason === 'full' ? 'Pouch full' : 'Get', disabled: !c.ok, onClick: () => buyItem(it, () => done(`${it.name} is in the pouch.`)) } });
      if (!c.ok) { const w = el('span', { class: 'why' }); w.textContent = c.text; card.querySelector('.mid').appendChild(w); }
      if (n) card.querySelector('.side').appendChild(btn('Eat one', () => { const r = up() && up().useTreat(it.id); if (r === true) { ui.closeAll(); } else game.toast(r || 'Not now.', { kind: 'warn' }); }, { alt: true, act: 'eat' })); g.appendChild(card); }
    pane.appendChild(g); pane.appendChild(ui.note('Bones cannot be bought with money. Everything on this page is earned by playing.'));
  }

  /* ================= Wardrobe ================= */
  function wardrobeTab(pane) {
    const U = up(), slots = U ? U.outfitSlots() : 0;
    sec(pane, 'outfits', 'Saved outfits', slots ? `${data.outfits.length} of ${slots} saved` : 'KC keeps outfits at her den. Pitch the Pup Tent first.');
    if (slots) { const row = el('div', { class: 'eco-row' });
      data.outfits.slice(0, slots).forEach((o, i) => { row.appendChild(btn(`Wear outfit ${i + 1}`, () => { for (const s of WEAR) { const id = o.look[s]; if (id && game.cosmetics.canWear(id)) game.cosmetics.equip(id, { save: false }); else game.cosmetics.unequip(s, { save: false }); } game.save.save(); done(`Outfit ${i + 1} is on.`); }, { act: 'outfit-wear' })); row.appendChild(btn('Forget it', () => { data.outfits.splice(i, 1); game.shop.refresh(); }, { alt: true })); });
      if (data.outfits.length < slots) row.appendChild(btn('Save what KC is wearing', () => { const look = {}; for (const s of WEAR) { const id = game.cosmetics.equipped(s); if (id) look[s] = id; } data.outfits.push({ look }); game.save.save(); done('Outfit saved.'); }, { alt: true, act: 'outfit-save' }));
      pane.appendChild(row); }
    pane.appendChild(ui.note('Tap a picture to try something on before you get it. Clothes change how KC looks, never how she plays.'));
    for (const s of WEAR) { const list = forSale(s); if (!list.length) continue; const first = eco.item(list[0].id); sec(pane, s, SLOT_NAMES[s], first ? first.where : ''); wearGrid(pane, list); }
    const prem = eco.items(i => i.premium && i.cat === 'cosmetic' && !eco.owns(i.id)).map(i => game.cosmetics.get(i.id)).filter(Boolean);
    if (prem.length) { sec(pane, 'premium', 'Special sets', 'Whispering Firs, Night Sky, Open Road and Spooky Hollow, piece by piece. Gems or bones: your choice.'); wearGrid(pane, prem); pane.appendChild(ui.note(`Gems come free from golden balls, new places and the daily sniff-outs. A grown-up can also buy them. Any gem price can be paid in bones instead, at ${eco.BONES_PER_GEM} bones a gem.`)); }
  }

  /* ================= Rides ================= */
  function ridesTab(pane) {
    const free = eco.level('den') >= 6;
    for (const [kind, title, where] of RIDES) { sec(pane, kind, title, `${where}. Parts fit every ${kind} at once.`); ladGrid(pane, eco.ladders('rides').filter(l => l.ride === kind));
      const h = ui.heading(SLOT_NAMES['skin:' + kind], free ? 'Free forever at the Bluff Lodge' : ''); h.classList.add('eco-sub'); pane.appendChild(h); wearGrid(pane, forSale('skin:' + kind)); }
  }

  /* ================= Den and Buddies ================= */
  async function payDen(n) { n = Math.floor(Math.min(n, eco.owed('den'), game.wallet.get('bones'))); if (!(n > 0)) return; if (await ui.confirmSpend({ id: 'den', name: 'Den payment', text: `${fmt(eco.owed('den') - n)} bones left to pay after this.`, price: { bones: n }, icon: 'star', source: 'upgrade:den', yes: 'Yes, pay' })) { eco.pay('den', n, { paid: true }); done(eco.owed('den') ? 'Paid. Thank you!' : 'All paid off. The den is KC\'s own.'); } }
  function denTab(pane) {
    const U = up(), l = eco.ladder('den'), n = eco.level('den'), owed = eco.owed('den'), bones = game.wallet.get('bones');
    sec(pane, 'den', "KC's Den", n ? `${l.eff.stages[n - 1]}, by Columbia View Park` : 'A spot by Columbia View Park');
    pane.appendChild(ladCard(l, { title: n ? l.eff.stages[n - 1] : "KC's Den", verb: n ? 'Move up' : 'Pitch the tent' }));
    if (owed > 0) { const cost = eco.price(l.costs[n - 1]); pane.appendChild(ui.progress(cost - owed, cost, `${fmt(cost - owed)} of ${fmt(cost)} bones paid`)); const row = el('div', { class: 'eco-row' });
      const some = Math.min(owed, 100); row.appendChild(btn(`Pay ${fmt(some)}`, () => payDen(some), { disabled: bones < 1, act: 'pay-some' })); row.appendChild(btn(bones >= owed ? `Pay it off (${fmt(owed)})` : `Pay all I can (${fmt(Math.min(bones, owed))})`, () => payDen(owed), { disabled: bones < 1, alt: true, act: 'pay-all' })); pane.appendChild(row);
      pane.appendChild(ui.note(bones < 1 ? 'No bones to spare right now. That is fine: there is no rush and it never costs more.' : 'No rush, no extra cost. The next den opens when this one is paid off.')); }
    if (n && U) { const row = el('div', { class: 'eco-row' });
      if (n >= 2) for (const [name, hour] of U.napTimes) row.appendChild(btn(`Nap until ${name.toLowerCase()}`, () => U.nap(hour), { alt: true, act: 'nap' }));
      if (n >= 4) row.appendChild(btn(U.bowlReady() ? 'Bone bowl: 25 bones' : 'Bone bowl: come back tomorrow', () => { const got = U.bowl(); if (got) done(`${got} bones from the bowl.`); }, { disabled: !U.bowlReady(), act: 'bowl' }));
      if (n >= 5) row.appendChild(btn('Planning board', () => { U.planning(); const m = game.modules.missions; if (m && typeof m.open === 'function') m.open('board'); else game.toast('The planning board is up. New jobs get pinned here.', { icon: 'flag' }); }, { alt: true, act: 'board' }));
      if (U.remote()) { const t = U.biz.reduce((s, id) => s + Math.floor(U.till(id)), 0); row.appendChild(btn(`Golden Hydrant: collect every till (${t})`, () => { const got = U.collectAll(); if (got) done(`${got} bones from the tills.`); }, { disabled: t < 1, act: 'collect-all' })); }
      if (row.children.length) pane.appendChild(row);
      if (n >= 3) pane.appendChild(ui.note('Fast travel home: open the map and tap "KC\'s Den".'));
      const wall = U.wall(); if (eco.level('camera') >= 3) { const h = ui.heading('Photo wall', wall ? 'Your latest photo' : 'Take a photo and it hangs here'); h.classList.add('eco-sub'); pane.appendChild(h); if (wall) { const im = el('img', { class: 'eco-wall', alt: 'KC\'s latest photo', src: wall }); pane.appendChild(im); } }
      if (n >= 6) { const h = ui.heading('Trophy wall'); h.classList.add('eco-sub'); pane.appendChild(h); pane.appendChild(el('div', { class: 'stats eco-trophies' }, U.trophies().map(([k, v]) => `<span>${esc(k)} <b>${fmt(v)}</b></span>`).join(''))); } }
    sec(pane, 'denstore', 'Den storage'); ladGrid(pane, [eco.ladder('denstore')]);
    if (n && U) { const used = U.decorPlaced().length, slots = U.denSlots(); sec(pane, 'decor', 'Decor', `${used} of ${slots} spots used. Putting a prop away gives every bone back.`);
      const g = el('div', { class: 'items' });
      for (const it of [...eco.items(i => i.cat === 'decor' && !i.premium), ...eco.items(i => i.cat === 'decor' && i.premium)]) { const on = U.decorOn(it.id), owned = eco.owns(it.id); if (it.grantOnly && !owned) continue;
        const p = eco.itemPrice(it.id) || {}, c = owned ? { ok: true } : eco.checkItem(it.id), fullUp = used >= slots;
        const place1 = () => { const r = U.placeDecor(it.id); if (r === true) done(`${it.name} is out by the den.`); else { game.toast(r, { kind: 'warn' }); game.shop.refresh(); } };
        g.appendChild(ui.item({ id: it.id, title: it.name, icon: 'star', text: it.gems && !owned ? `${fmt(it.gems)} gems is about ${eco.usd(it.gems)} if the gems were bought` : '', price: owned ? undefined : p, tag: on ? 'Out by the den' : owned ? 'In storage' : '', on,
          locked: !owned && !on && fullUp ? 'No free decor spot' : undefined, button: on ? { label: 'Put away', primary: false, onClick: () => { const back = U.removeDecor(it.id); done(back && (back.bones || back.gems) ? `Put away: ${back.bones ? fmt(back.bones) + ' bones' : back.gems + ' gems'} back.` : 'Put away.'); } }
            : owned ? { label: 'Put out', disabled: fullUp, onClick: place1 } : { label: c.reason === 'bones' && !p.either ? 'Not enough bones' : 'Get', disabled: fullUp || (!c.ok && !p.either), onClick: () => buyItem(it, place1) } })); }
      pane.appendChild(g); }
    sec(pane, 'buddies', 'Trail Buddies', 'Gifts from Tailwind Pet Supply. Play with a dog first, then make friends.');
    ladGrid(pane, [eco.ladder('whistle')]);
    const g2 = el('div', { class: 'items eco-lads' }), whistle = eco.level('whistle'), out = U ? U.called() : [];
    for (const b of eco.ladders('companions').filter(x => x.eff.type === 'buddy')) { const card = ladCard(b, { verb: 'Give a gift' }); card.classList.add('eco-buddy'); const hearts = eco.level(b.id);
      if (U && hearts >= 3 && whistle) { const side = card.querySelector('.side') || card.appendChild(el('div', { class: 'side' })), here = out.includes(b.eff.dog);
        side.appendChild(btn(here ? 'Send home' : 'Call', () => { if (here) { U.sendHome(b.eff.dog); game.shop.refresh(); } else { const r = U.callBuddy(b.eff.dog); if (r === true) ui.closeAll(); else game.toast(r, { kind: 'warn' }); } }, { alt: here, act: here ? 'home' : 'call' })); }
      g2.appendChild(card); }
    pane.appendChild(g2);
  }

  /* ================= Businesses ================= */
  function bizTab(pane) {
    const U = up(); sec(pane, 'businesses', 'Businesses', 'A till fills while you play and stops when it is full. No upkeep, nothing to lose.');
    for (const l of eco.ladders('businesses')) { const n = eco.level(l.id); pane.appendChild(ladCard(l, { verb: n ? 'Upgrade' : 'Open it' }));
      if (n && U) { const have = Math.floor(U.till(l.id)), cap = U.cap(l.id), here = U.near(l.id) || U.remote(), row = el('div', { class: 'eco-row eco-till', 'data-till': l.id });
        row.appendChild(ui.progress(have, cap, `Till ${fmt(have)} / ${fmt(cap)}  ·  ${U.rate(l.id).toFixed(2).replace(/\.?0+$/, '')} bones a minute`));
        row.appendChild(btn(here ? `Collect ${fmt(have)}` : 'Visit it to collect', () => { const got = U.collect(l.id); if (got) done(`${got} bones from the ${U.bizName(l.id)}.`); }, { disabled: !here || have < 1, act: 'collect' })); pane.appendChild(row); } }
    pane.appendChild(ui.note(U && U.remote() ? 'The Golden Hydrant lets KC collect every till from the den.' : 'Empty a till at the business itself. The Town Fund\'s last gift lets KC collect them all from the den.'));
  }

  /* ================= Town: funds and trail markers ================= */
  function fundsTab(pane) {
    sec(pane, 'town', 'Town Fund', 'St. Helens City Hall'); ladGrid(pane, [eco.ladder('town')], { verb: 'Chip in' });
    sec(pane, 'lantern', 'Lantern Fund', 'Courthouse Plaza. Gifts are welcome all year: nothing is missed by waiting.'); ladGrid(pane, [eco.ladder('lantern')], { verb: 'Chip in' });
    sec(pane, 'markers', 'Trail Markers', 'Read a signpost, then make it a fast-travel point on the map.'); ladGrid(pane, eco.ladders('town').filter(l => l.eff.type === 'marker'), { verb: 'Set marker' });
  }

  const offs = [
    game.shop.registerTab({ id: 'upgrades', title: 'Upgrades', icon: 'bolt', order: 10, render: upgradesTab }),
    game.shop.registerTab({ id: 'wardrobe', title: 'Wardrobe', icon: 'star', order: 20, render: wardrobeTab }),
    game.shop.registerTab({ id: 'rides', title: 'Rides', icon: 'gear', order: 30, render: ridesTab }),
    game.shop.registerTab({ id: 'den', title: 'Den & Buddies', icon: 'paw', order: 40, render: denTab }),
    game.shop.registerTab({ id: 'businesses', title: 'Businesses', icon: 'bone', order: 60, badge: () => { const U = up(); return U && U.biz.some(id => U.cap(id) > 0 && U.till(id) >= U.cap(id)) ? '!' : 0; }, render: bizTab }),
    game.shop.registerTab({ id: 'funds', title: 'Town', icon: 'flag', order: 70, render: fundsTab })
  ];

  /* ---------- the shops in the world: a prompt at each door and stall (shops have no interiors) ---------- */
  const P = game.place, spot = id => [P.door(id, 2.6), P.door(id, 3.8), P.beside(id, 1, 2.6, 2.6), P.beside(id, -1, 2.6, 2.6), P.door(id, 5.2)].filter(Boolean).find(q => P.clear(q.x, q.z, 0.6)) || P.door(id);   /* the first clear spot at the shop front */
  const door = (id, at, prompt, label, tab, section) => { if (!at) return; game.place.counter({ id: 'eco:shop:' + id, x: at.x, z: at.z, r: 3, prompt, icon: 'bone', onInteract: () => open(tab, section), marker: { label, color: '#7fe08f', icon: 'bone' } }); };
  door('tailor', spot('tailor'), 'Visit the costume tailor', 'Stitch & Sit Costume Tailor', 'wardrobe', 'hat');
  door('pets', spot('pets'), 'Visit the pet supply', 'Tailwind Pet Supply', 'den', 'buddies');
  door('bakery', spot('bakery'), 'Visit the bakery', 'Flour & Paw Bakery', 'upgrades', 'treats');
  door('toys', spot('toys'), 'Visit the toy shop', 'Driftwood Toys', 'wardrobe', 'trail');
  door('bikes', spot('bikes'), 'Visit the cyclery', 'Channel Cyclery', 'rides', 'skateboard');
  door('chandlery', spot('chandlery'), 'Visit the chandlery', 'Knot & Oar Chandlery', 'rides', 'canoe');
  door('fuel', spot('fuel'), 'Visit Fuel & Treats', 'Scappoose Fuel & Treats', 'rides', 'van');
  door('bandanas', P.stall('Bandana Bay'), 'Look at the bandanas', 'Bandana Bay', 'wardrobe', 'bandana');
  door('collars', P.stall('Knotty Collars'), 'Look at the collars', 'Knotty Collars', 'wardrobe', 'collar');
  door('tags', P.stall('Tag & Stamp'), 'Look at the tags', 'Tag & Stamp', 'wardrobe', 'tag');

  game.on('upgradePaid', () => game.shop.refresh());
  return { open, tabs: ['upgrades', 'wardrobe', 'rides', 'den', 'businesses', 'funds'], outfits: () => data.outfits, buyLadder, remove: () => { for (const off of offs) off(); game.place.removeAll('eco:shop:'); } };
}
