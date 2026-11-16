/* KC: Open Trail first steps. Leads a new player, without ever blocking her: first job -> first bones -> the shop -> first upgrade.
   Nothing here pays, charges or locks anything; it only points (the missions module's own "show me the way", one map marker, a few toasts).
   Saved in state.modules.guide { step, told }: 0 new, 1 pointed at the first job, 2 first job done and pointing at the shop, 3 finished. */
const FIRST_JOB = 'bell', FIRST_UPGRADE = 'sniffer', SHOP = 'pets';

export function init(game) {
  const data = game.moduleData('guide', { step: 0, told: 0 }), bus = game.bus;
  if (![0, 1, 2, 3].includes(data.step)) data.step = 0;
  const missions = () => game.modules.missions, eco = () => game.modules.economy;
  const cost = () => { const e = eco(); return e && e.nextCost && e.level && e.level(FIRST_UPGRADE) === 0 ? e.nextCost(FIRST_UPGRADE) : null; };
  const upgradeName = () => { const e = eco(), l = e && e.ladder && e.ladder(FIRST_UPGRADE); return l ? l.name : 'an upgrade'; };
  let mark = null, timer = 0;
  const set = n => { data.step = n; game.save.save(); bus.emit('guide', { step: n }); };
  const later = (ms, fn) => { clearTimeout(timer); timer = setTimeout(fn, ms); };
  function showShop() { if (mark) return; const at = game.place.door(SHOP); if (!at) return; mark = game.place.marker({ id: 'guide:shop', x: at.x, z: at.z, label: "Tailwind Pet Supply: KC's first upgrade", color: '#7fe08f', icon: 'bone', beacon: true, compass: true }); }
  function hideShop() { if (mark) { mark.remove(); mark = null; } }
  function pointAtJob() { const m = missions(); if (!m || !m.showWay || !m.isDone || m.isDone(FIRST_JOB) || (m.active && m.active())) return false; return m.showWay(FIRST_JOB); }
  function toShop() {
    set(2); showShop(); const c = cost();
    later(3600, () => game.toast(c ? `Bones buy upgrades. ${upgradeName()} is ${c} bones at Tailwind Pet Supply on the plaza (green marker). The Shop is in the pause menu too.` : 'Bones buy upgrades at the shops in town. The Shop is in the pause menu too.', { icon: 'bone', ms: 7000 }));
  }
  function finish(say) { const was = data.step; hideShop(); set(3); if (say && was < 3) later(2200, () => game.toast('KC is kitted out. More jobs wait at the blue flags on the map, and Missions in the pause menu lists them all.', { icon: 'flag', ms: 6500 })); }

  bus.on('start', () => {
    /* a save from before the guide existed, already kitted out: nothing to teach */
    if (data.step === 0 && Object.values(game.state.upgrades || {}).some(v => v > 0)) { set(3); return; }
    if (data.step === 0) { const m = missions(); if (m && m.isDone && m.isDone(FIRST_JOB)) toShop(); else later(2600, () => { if (data.step === 0 && pointAtJob()) set(1); }); }
  });
  bus.on('missionComplete', e => { if (data.step < 2 && e && !e.festival) toShop(); });
  for (const type of ['upgrade', 'itemBought', 'purchase']) bus.on(type, () => { if (data.step < 3) finish(data.step === 2); });
  bus.on('wallet', e => { if (data.step !== 2 || data.told || !e || e.currency !== 'bones') return; const c = cost(); if (c && e.amount >= c && e.delta > 0) { data.told = 1; game.toast(`${e.amount} bones: enough for ${upgradeName()}. Tap Paw at the pet supply door, or open Shop from the pause menu.`, { icon: 'bone', kind: 'gold', ms: 6500 }); } });
  if (data.step === 2) { if (eco() && eco().level && eco().level(FIRST_UPGRADE) > 0) set(3); else showShop(); }

  return { step: () => data.step, firstJob: FIRST_JOB, firstUpgrade: FIRST_UPGRADE, shop: SHOP, restart() { hideShop(); data.told = 0; set(0); }, remove() { clearTimeout(timer); hideShop(); } };
}
