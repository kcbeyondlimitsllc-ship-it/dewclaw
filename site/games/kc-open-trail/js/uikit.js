/* Shared screen pieces for the modules (economy, upgrades, shop, missions, store, merch), so six screens
   built by different hands look and behave like one game. Everything hangs off game.ui (see ARCHITECTURE.md,
   "Module seams"):
     ui.tabs(host, tabs, opts)        scrolling tab strip + pane
     ui.item(opts) / ui.grid(items)   an item card (swatch or icon, name, text, price, one button) and a grid of them
     ui.price({ bones, gems })        price chips as an HTML string
     ui.progress(value, max, label)   a progress bar element
     ui.note(text, kind)              a small boxed note
     ui.gate(opts)                    the grown-up gate -> Promise<boolean>
     ui.confirmSpend(opts)            item + price + balance afterwards -> Promise<boolean> (spends on yes)
     ui.openExternal(opts)            gate, then a "you are leaving the game" screen, then the link in a new tab
     ui.addSetting(row)               an extra row in Settings
   and game.grownUp: { gate, spending, setSpending(on), showSwitch }. */
import { icon, el } from './util.js';

export function createUiKit(game, ui, env) {
  const { bus, state } = game, { body, moreCue, sfx } = env;
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  ui.esc = esc; ui.el = el; ui.icon = icon;
  const hex = c => (typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c);

  /* ---------- tabs ----------
     ui.tabs(host, [{ id, title, icon?, badge? (value or () => value), render(pane) }], { current, onChange(id, byUser), errorText })
       -> { strip, pane, current, select(id), redraw() }
     The strip scrolls sideways (44 px buttons, the open tab is scrolled into view) and stays pinned while the pane scrolls. */
  ui.tabs = (host, tabs, o = {}) => {
    const strip = el('div', { class: 'tabstrip', role: 'tablist' }), pane = el('div', { class: 'tabpane', role: 'tabpanel' });
    let cur = tabs.find(t => t.id === o.current) || tabs[0];
    const edges = () => { strip.classList.toggle('more-l', strip.scrollLeft > 6); strip.classList.toggle('more-r', strip.scrollWidth - strip.clientWidth - strip.scrollLeft > 6); };
    const draw = () => { pane.innerHTML = ''; if (!cur) return; try { cur.render && cur.render(pane); } catch (e) { console.error('[tab ' + cur.id + ']', e); pane.textContent = o.errorText || 'This page is being tidied up.'; } moreCue(); setTimeout(moreCue, 60); };
    const mark = () => { for (const b of strip.children) { const on = cur && b.dataset.tab === cur.id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); if (on) { const want = b.offsetLeft - (strip.clientWidth - b.offsetWidth) / 2; strip.scrollTo({ left: Math.max(0, want), behavior: 'instant' }); } } edges(); };
    const pick = (t, byUser) => { if (!t) return; cur = t; mark(); if (byUser) body.scrollTop = 0; draw(); if (o.onChange) o.onChange(t.id, !!byUser); };
    for (const t of tabs) {
      const b = el('button', { type: 'button', role: 'tab', 'data-tab': t.id }, (t.icon ? icon(t.icon, 18) : '') + '<span></span>'); b.lastChild.textContent = t.title || t.id;
      const badge = typeof t.badge === 'function' ? t.badge() : t.badge; if (badge) b.appendChild(el('i', { class: 'badge' }, esc(badge)));
      b.addEventListener('click', () => { sfx(); pick(t, true); }); strip.appendChild(b);
    }
    strip.addEventListener('scroll', edges, { passive: true });
    host.appendChild(strip); host.appendChild(pane); mark(); draw(); requestAnimationFrame(mark);
    return { strip, pane, get current() { return cur && cur.id; }, select: id => pick(tabs.find(t => t.id === id), false), redraw: draw };
  };

  /* ---------- small pieces ---------- */
  /* ui.price({ bones: 120 }) / ({ gems: 40 }) / ({ gems: 40, bones: 2000 }) -> HTML string; a number alone means bones */
  ui.price = p => { if (typeof p === 'number') p = { bones: p }; if (!p) return ''; const out = [];
    if (p.bones > 0) out.push(`<span class="pc bones">${icon('bone', 16)}<b>${Math.round(p.bones)}</b></span>`); if (p.gems > 0) out.push(`<span class="pc gems">${icon('gem', 16)}<b>${Math.round(p.gems)}</b></span>`);
    return out.join(p.either ? '<i class="or">or</i>' : '') || '<span class="pc free"><b>Free</b></span>'; };
  ui.progress = (value, max, label) => { const f = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0, e = el('div', { class: 'prog', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': value }, `<div class="bar"><i style="width:${(f * 100).toFixed(1)}%"></i></div><span></span>`); e.lastChild.textContent = label ?? `${Math.round(value)} / ${Math.round(max)}`; return e; };
  ui.note = (text, kind = '') => { const e = el('p', { class: 'note ' + kind }); e.textContent = text; return e; };
  /* ui.item({ id, title, text, swatch (colour) | icon | node, price ({ bones, gems } | number) | priceLabel, tag ('Owned', 'Wearing', 'Tier 2 of 4' ...),
       button: { label, onClick, disabled, primary }, onPreview, locked (string: why) }) -> element */
  ui.item = o => {
    const card = el('div', { class: 'item' + (o.locked ? ' locked' : '') + (o.on ? ' on' : ''), 'data-item': o.id || '' });
    const art = el('div', { class: 'art' }); if (o.node) art.appendChild(o.node); else if (o.swatch != null) { art.classList.add('sw'); art.style.background = hex(o.swatch); if (o.swatch2 != null) art.style.background = `linear-gradient(135deg, ${hex(o.swatch)} 50%, ${hex(o.swatch2)} 50%)`; } else art.innerHTML = icon(o.icon || 'star', 26);
    if (o.onPreview) { art.setAttribute('role', 'button'); art.tabIndex = 0; art.setAttribute('aria-label', 'Try on ' + (o.title || '')); art.addEventListener('click', () => { sfx(); o.onPreview(o); }); }
    const mid = el('div', { class: 'mid' }), h = el('b'); h.textContent = o.title || ''; mid.appendChild(h);
    if (o.tag) { const t = el('em', { class: 'tag2' }); t.textContent = o.tag; mid.appendChild(t); }
    if (o.text) { const t = el('span'); t.textContent = o.text; mid.appendChild(t); }
    if (o.locked) { const t = el('span', { class: 'why' }); t.textContent = o.locked; mid.appendChild(t); }
    card.appendChild(art); card.appendChild(mid);
    const side = el('div', { class: 'side' });
    if (o.price != null || o.priceLabel) side.appendChild(el('div', { class: 'prices' }, o.priceLabel ? `<span class="pc"><b>${esc(o.priceLabel)}</b></span>` : ui.price(o.price)));
    if (o.button) { const b = el('button', { type: 'button', class: 'btn ' + (o.button.primary === false ? 'alt' : 'go') }); b.textContent = o.button.label || 'Get'; b.disabled = !!o.button.disabled || !!o.locked; b.addEventListener('click', () => { sfx(); o.button.onClick && o.button.onClick(o, card); }); side.appendChild(b); }
    if (side.children.length) card.appendChild(side);
    return card;
  };
  /* ui.grid([item options or elements]) -> a responsive grid of cards */
  ui.grid = (items = []) => { const g = el('div', { class: 'items' }); for (const it of items) g.appendChild(it instanceof Element ? it : ui.item(it)); return g; };
  /* ui.heading('Hats', 'Stitch & Sit Costume Tailor') -> a section heading with an optional sub-line */
  ui.heading = (text, sub) => { const h = el('h3', { class: 'sech' }); h.textContent = text; if (sub) { const s2 = el('small'); s2.textContent = sub; h.appendChild(s2); } return h; };

  /* ---------- the grown-up gate ----------
     ui.gate({ reason }) -> Promise<boolean>. A times-table question a grown-up answers on an on-screen number pad
     (no device keyboard pops up). Nothing about the answer is stored or sent. Three wrong tries close the gate: for
     30 seconds the first time, 2 minutes the second, 10 minutes after that. The closing time and the count are kept with the
     settings in the save, so a page reload does not open the gate again; a pass sets the count back. A deterrent, not proof of age. */
  const SHUT = [30000, 120000, 600000];
  const gs = () => { const g = state.settings.gate, ok = g && typeof g === 'object' && Number.isFinite(g.until) && Number.isInteger(g.n) && g.n >= 0; return ok ? { until: Math.min(g.until, Date.now() + SHUT[2]), n: g.n } : { until: 0, n: 0 }; };   /* reads only: a save without a lock-out stays as it was */
  ui.gate = (o = {}) => new Promise(res => {
    if (Date.now() < gs().until) { ui.toast('Ask a grown-up to help, then try again in a moment.', { icon: 'hand' }); bus.emit('gate', { ok: false, reason: o.reason || '' }); return res(false); }
    let a = 0, b = 0, typed = '', tries = 0, done = false, out = null, msg = null;
    const ask = () => { a = 6 + Math.floor(Math.random() * 7); b = 6 + Math.floor(Math.random() * 4); typed = ''; };
    const finish = ok => { if (done) return; done = true; removeEventListener('keydown', onKey, true); bus.emit('gate', { ok, reason: o.reason || '' }); res(ok); };
    const paint = () => { if (out) out.textContent = typed || ' '; };
    const check = h => { if (!typed) return; if (+typed === a * b) { if (state.settings.gate) { state.settings.gate = null; game.save.save(); } finish(true); h.close(); return; } tries++; if (tries >= 3) { const g = gs(); state.settings.gate = { until: Date.now() + SHUT[Math.min(g.n, SHUT.length - 1)], n: g.n + 1 }; game.save.save(); finish(false); h.close(); ui.toast('That was not it. Ask a grown-up to help.', { icon: 'hand' }); return; } ask(); if (msg) msg.textContent = 'Not quite. Try this one.'; h.refresh(); };
    let handle = null;
    const onKey = e => { if (!ui.current || ui.current.id !== 'gate') return; if (/^[0-9]$/.test(e.key)) { if (typed.length < 4) typed += e.key; paint(); e.preventDefault(); } else if (e.key === 'Backspace') { typed = typed.slice(0, -1); paint(); e.preventDefault(); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); check(handle); } };
    ask(); addEventListener('keydown', onKey, true);
    handle = ui.openModal({ id: 'gate', title: 'Grown-ups only', className: 'gate', render: bd => {
      const p1 = el('p'); p1.textContent = o.reason || 'This part is for grown-ups.'; bd.appendChild(p1);
      const p2 = el('p', { class: 'gateq' }); p2.innerHTML = `Please ask a grown-up to answer: <b>what is ${a} × ${b}?</b>`; bd.appendChild(p2);
      msg = el('p', { class: 'gatemsg', role: 'status' }); msg.textContent = tries ? 'Not quite. Try this one.' : ''; bd.appendChild(msg);
      out = el('div', { class: 'gateout', 'aria-live': 'polite', 'aria-label': 'Your answer' }); bd.appendChild(out); paint();
      const pad = el('div', { class: 'keypad' });
      for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok']) { const q = el('button', { type: 'button', class: 'btn ' + (k === 'ok' ? 'go' : 'alt'), 'data-key': k, 'aria-label': k === 'del' ? 'Delete' : k === 'ok' ? 'Check the answer' : k }); q.textContent = k === 'del' ? '⌫' : k === 'ok' ? 'OK' : k;
        q.addEventListener('click', () => { sfx(); if (k === 'del') typed = typed.slice(0, -1); else if (k === 'ok') return check(handle); else if (typed.length < 4) typed += k; paint(); }); pad.appendChild(q); }
      bd.appendChild(pad);
    }, actions: [{ label: 'Go back' }], onClose: () => finish(false) });
  });

  /* game.grownUp: the one place that knows whether real-money spending is switched on for this device.
     Off by default (state.settings.spending); turning it on needs the gate, turning it off does not. The Settings
     row appears once a store module sets game.grownUp.showSwitch = true. */
  game.grownUp = {
    showSwitch: false,
    storeOff: false, switchLabel: '',
    gate: reason => ui.gate(typeof reason === 'string' ? { reason } : reason || {}),
    get spending() { return !!state.settings.spending; },
    async setSpending(on) {
      on = !!on; if (on === !!state.settings.spending) return true;
      /* storeOff: this build sells nothing itself (the Play app while Google Play Billing is not switched on); the switch then only opens the real-gear shelf */
      const off = !!game.grownUp.storeOff;
      if (on && !(await ui.gate({ reason: off ? 'Turning this on lets a grown-up look at the real KC gear, which is sold on a separate shop website. Nothing is sold inside the game.' : 'Turning on the real-money shop lets this device buy things with real money. Bones and everything that changes how KC plays stay free.' }))) return false;
      state.settings.spending = on; game.save.save(); bus.emit('spending', { on }); ui.toast(off ? (on ? 'The grown-ups\' real gear shelf is on for this device.' : 'The grown-ups\' real gear shelf is off.') : on ? 'Real-money shop is on for this device.' : 'Real-money shop is off.', { icon: 'gear' }); return true;
    }
  };

  /* ---------- spending bones or gems: two steps, the price and the balance afterwards always on screen ----------
     ui.confirmSpend({ name, text, price: { bones, gems }, title, yes, icon, swatch, source }) -> Promise<boolean>
     true = the player said yes and the wallet was charged (emits `purchase` { name, id, price, source }). Nothing is granted here: grant after it resolves. */
  ui.confirmSpend = (o = {}) => new Promise(res => {
    const price = typeof o.price === 'number' ? { bones: o.price } : (o.price || {}), w = state.wallet, short = [];
    for (const c of ['bones', 'gems']) if (price[c] > 0 && w[c] < price[c]) short.push(`${Math.ceil(price[c] - w[c])} more ${c}`);
    let done = false; const fin = v => { if (!done) { done = true; res(v); } };
    const after = { bones: w.bones - (price.bones > 0 ? Math.round(price.bones) : 0), gems: w.gems - (price.gems > 0 ? Math.round(price.gems) : 0) };
    ui.openModal({ id: 'spend', title: short.length ? 'Not enough yet' : (o.title || 'Get this?'), wallet: true, className: 'spend', render: bd => {
      bd.appendChild(ui.item({ title: o.name || 'This', text: o.text, swatch: o.swatch, icon: o.icon, node: o.node, price }));
      if (short.length) bd.appendChild(ui.note(`KC needs ${short.join(' and ')}. Bones come from sniffing around, digging and helping out.`, 'warn'));
      if (price.gems > 0 && game.economy.usd && game.showUsd !== false) bd.appendChild(ui.note(`${Math.round(price.gems)} gems is about ${game.economy.usd(Math.round(price.gems))} if the gems were bought.`, 'usd'));
      if (!short.length) { const chip = (c, n) => `<span class="pc ${c}">${icon(c === 'bones' ? 'bone' : 'gem', 16)}<b>${Math.max(0, n)}</b></span>`, p = el('p', { class: 'after' }); p.innerHTML = 'Afterwards KC will have ' + chip('bones', after.bones) + (w.gems || price.gems ? ' ' + chip('gems', after.gems) : ''); bd.appendChild(p); }
    }, actions: short.length ? [{ label: 'OK', primary: true }] : [{ label: o.no || 'Not now' }, { label: o.yes || 'Yes, get it', primary: true, onClick: () => {
      if (done) return;   /* one charge for one screen, however many click events arrive */
      if (!game.economy.spend(price, o.source || 'shop')) { ui.toast('Not enough yet.', { kind: 'warn' }); return fin(false); }
      game.audio.sfx('reward'); bus.emit('purchase', { name: o.name, id: o.id, price: { bones: Math.round(price.bones) || 0, gems: Math.round(price.gems) || 0 }, source: o.source || 'shop' }); fin(true); } }],
    onClose: () => fin(false) });
  });

  /* ---------- links that leave the game ----------
     ui.openExternal({ url, name, note }) -> Promise<boolean>. https only. Gate first, then a plain "you are leaving" screen that shows
     where the link goes; the page opens in a new tab with rel="noopener noreferrer". The game itself requests nothing from that site. */
  ui.openExternal = async (o = {}) => {
    let u; try { u = new URL(o.url); } catch (e) { return false; } if (u.protocol !== 'https:') return false;
    if (!(await ui.gate({ reason: o.reason || 'This opens a website outside the game.' }))) return false;
    return new Promise(res => { let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      ui.openModal({ id: 'leaving', title: 'Leaving the game', render: bd => {
        const p = el('p'); p.textContent = `You are leaving KC: Open Trail for ${o.name || u.hostname}, a separate website.`; bd.appendChild(p);
        const h = el('p', { class: 'note' }); h.textContent = u.hostname + (o.note ? '. ' + o.note : ''); bd.appendChild(h);
      }, actions: [{ label: 'Stay in the game' }, { label: 'Open the website', primary: true, onClick: () => { const a = el('a', { href: u.href, target: '_blank', rel: 'noopener noreferrer' }); document.body.appendChild(a); a.click(); a.remove(); bus.emit('external', { host: u.hostname }); fin(true); } }], onClose: () => fin(false) }); });
  };

  /* ---------- extra Settings rows ----------
     ui.addSetting({ id, label, type: 'check' | 'button', get(), set(value) (may be async; return false to refuse), button, onClick, order }) -> remove() */
  ui.settingRows = [];
  ui.addSetting = row => { const i = ui.settingRows.findIndex(r => r.id === row.id); if (i >= 0) ui.settingRows.splice(i, 1); ui.settingRows.push(row); return () => { const k = ui.settingRows.indexOf(row); if (k >= 0) ui.settingRows.splice(k, 1); }; };
}
