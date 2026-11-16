/* The eight Fog Bell Festival activities (SETTING-BRIEF.md, section 4). Plain definitions in the same shape as the
   missions in missions.js, which runs them: { id, name, place, at, giver, story, steps, reward, again, run(c) }.
   They are offered only while the festival flag is on (game.economy.getFlag('festival')). All of it is original:
   the centrepiece is the Lantern Stack, the pumpkins are painted, and nobody here comes from a film. */
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const lerp = (a, b, t) => a + (b - a) * t;
const LAN = [0xffb238, 0xff7a4a, 0xffd86a, 0xf2a0c0, 0x9ad0ff, 0xb8e08a];

/* craft stalls the festival adds beside the Riverwalk (dressing owned by the missions module; the market activity runs between them) */
export const FEST_STALLS = [
  { x: -128, z: -322, ry: Math.PI / 2, name: 'Fern & Felt', col: 0x5f9f4f }, { x: -128, z: -310, ry: Math.PI / 2, name: 'Bell Jar Jams', col: 0xd9534f },
  { x: -128, z: -298, ry: Math.PI / 2, name: 'Tin Whistle Toys', col: 0x3f7fd6 }, { x: -128, z: -286, ry: Math.PI / 2, name: 'River Stone Soap', col: 0x8a4fae },
  { x: -112, z: -316, ry: -Math.PI / 2, name: 'Moss Mittens', col: 0x3f9f7f }, { x: -112, z: -292, ry: -Math.PI / 2, name: 'Candle Corner', col: 0xf0b030 }
];
const stallFront = (s, off = 3.2) => ({ x: s.x + Math.sin(s.ry) * off, z: s.z + Math.cos(s.ry) * off });

/* the hay maze: one character is 1.8 units; # bale, t hidden treat, . open */
const MAZE_MAP = ['####.####', '#t......#', '#.###.#.#', '#...#.#t#', '###.#.###', '#t..#...#', '#.#####.#', '#.......#', '#.###.###', '#.#t#...#', '#.#.###.#', '#...#..t#', '###.#.###', '#...#...#', '#.#####.#', '#...t...#', '####.####'];
const MAZE_AT = { x: -160.4, z: -266.4, s: 1.8 };

export const ACTIVITIES = [
  { id: 'stack', n: 1, name: 'Lantern Stack Lighting', place: 'Courthouse Plaza', at: { x: -177, z: -243, yaw: 0.6 }, giver: { name: 'Lamplighter Fen', look: { shirt: 0x3a2f4a, hat: 'cap' } },
    story: 'At dusk the lights go up the Lantern Stack on a long rope, and it takes more than one dog to pull it. Call the others, then heave.',
    steps: ['Bark to call the other dogs to the rope', 'Pull the rope six times', 'Watch the lights climb the Stack'], reward: 70, again: 50,
    run(c) {
      const { game } = c, st = game.world.stack || { x: -170, z: -250 }, rope = { x: st.x - 4.4, z: st.z + 3.4 }; let pulls = 0, cool = 0, called = false;
      if (game.world.time > 5.5 && game.world.time < 17.8) game.world.setTime(18.2);
      c.goal('Bark to call the other dogs to the rope', rope, 'bark');
      c.mesh(g => { g.cyl(0, 0, 0, 0.06, 0.06, 1.3, 5, 0x6a4a2a); g.cyl(0, 1.3, 0, 0.16, 0.16, 0.1, 7, 0xc9a67a); }, rope.x, rope.z);
      c.once('bark', () => { called = true;
        for (const [name, coat, belly, ear, s] of [['Soot', 0x3a3a3e, 0xdadada, 0x222226, 0.95], ['Marigold', 0xd9a04a, 0xf4e6c8, 0xa8703f, 0.85]]) c.follower({ name, look: { coat, belly, ear, s }, seconds: 240 });
        c.say('Soot and Marigold come running. Everybody on the rope!', { icon: 'bark', kind: 'good', ms: 2600 }); c.goal('Pull the rope 0/6', rope, 'interact'); });
      c.marker('rope', { x: rope.x, z: rope.z, label: 'Lantern rope', icon: 'paw', color: '#ffb238', prompt: 'Pull the rope', r: 3, prio: 4, enabled: () => called && cool <= 0 && pulls < 6, onInteract: () => {
        pulls++; cool = 0.45; game.audio.sfx('whistle'); const a = pulls * 1.05, y = Math.max(game.place.groundY(st.x, st.z), 0) + 1.6 + pulls * 0.95;
        c.mesh(g => { g.cyl(0, 0, 0, 0.2, 0.24, 0.46, 7, LAN[pulls % LAN.length], 0x2a2c30); g.cyl(0, 0.46, 0, 0.09, 0.03, 0.1, 5, 0x2a2c30); }, st.x + Math.cos(a) * 3.0, st.z + Math.sin(a) * 3.0, y);
        game.fx.burst('spark', st.x + Math.cos(a) * 3.0, y + 0.3, st.z + Math.sin(a) * 3.0, 10);
        if (pulls >= 6) { c.goal('The lights are up!'); game.audio.sfx('bell'); c.say('The Lantern Stack is lit. The whole plaza cheers!', { icon: 'star', kind: 'gold', ms: 3200 }); c.after(1.4, () => c.win()); } else c.goal(`Pull the rope ${pulls}/6`, rope, 'interact'); } });
      c.poll(0, dt => { if (cool > 0) cool -= dt; });
    } },

  { id: 'parade', n: 2, name: 'Costume Parade', place: 'Columbia View Park stage', at: { x: -160, z: -156, yaw: Math.PI / 2 }, giver: { name: 'MC Rosalind', look: { shirt: 0xd98d8d, hat: 'straw' } },
    story: 'Every dog gets a turn on the runway in front of the park stage. Wear whatever you like, hit the three marks, and let the crowd decide.',
    steps: ['Walk to each mark on the runway', 'Sit at the first, bark at the second, shake at the third', 'Hear how the crowd votes'], reward: 70, again: 50, score: 'paws',
    run(c) {
      const { game } = c, marks = [[-156, -158, 'sit', 'Sit and pose'], [-150, -161, 'bark', 'Give the crowd a bark'], [-144, -158, 'shake', 'Finish with a big shake']]; let i = 0, at = false;
      [[-158, -167, 'Dot'], [-153, -168, 'Arlo'], [-147, -168, 'Tess'], [-142, -167, 'Cal']].forEach(([x, z, name], k) => c.npc('fan' + k, { x, z, yaw: Math.PI, name }));
      const aim = () => { const m = marks[i], p = { x: m[0], z: m[1] }; if (at) c.goal(`Mark ${i + 1}/3: ${m[3]}`, p, m[2]); else c.goal(`Walk to mark ${i + 1} of 3`, p); };
      marks.forEach((m, k) => c.mesh(g => { g.cyl(0, 0.02, 0, 0.7, 0.7, 0.04, 12, LAN[k], 0xf4f4ef); }, m[0], m[1]));
      const hit = type => { const m = marks[i]; if (!m || m[2] !== type || dist({ x: m[0], z: m[1] }, game.kc.pos) > 3) return; c.puff(m[0], m[1]); game.audio.sfx('pickup'); for (const s of game.npcs.standers) if (s.id.startsWith(c.pre + 'fan')) s.wave(); i++; at = false;
        if (i < marks.length) return aim();
        const worn = ['hat', 'outfit', 'bandana', 'collar', 'trail'].filter(s => game.cosmetics.equipped(s)).length, paws = Math.min(5, 3 + worn);
        c.goal('The crowd is voting'); c.say(`The crowd holds up ${paws} paws out of 5${worn ? '. They love the outfit!' : '. Plain and proud!'}`, { icon: 'star', kind: 'gold', ms: 3600 }); c.after(1.6, () => c.win({ score: paws })); };
      for (const t of ['sit', 'bark', 'shake']) c.on(t, () => hit(t));
      c.poll(0.2, () => { const m = marks[i]; if (!m) return; const near = dist({ x: m[0], z: m[1] }, game.kc.pos) < 2.6; if (near !== at) { at = near; aim(); } });
      aim();
    } },

  { id: 'haymaze', n: 3, name: 'Hay Maze', place: 'Courthouse Plaza', at: { x: -150.2, z: -269.2, yaw: 0 }, giver: { name: 'Maze-minder Tully', look: { shirt: 0xc9953a, hat: 'straw' } },
    story: 'A maze of hay bales fills the east side of the plaza, with six treats tucked into the dead ends. The stop-watch runs, but only for bragging.',
    steps: ['Go in at the north gap', 'Sniff out the hidden treats (3 bones each)', 'Come out at the south gap'], reward: 60, again: 45,
    run(c) {
      const { game } = c, M = MAZE_AT, cell = (col, row) => ({ x: M.x + col * M.s, z: M.z + row * M.s }), cols = [], treats = [], rows = MAZE_MAP.length, y0 = game.place.groundY(M.x + 7, M.z + 14); let found = 0, inside = false;
      c.mesh(g => { MAZE_MAP.forEach((line, r) => [...line].forEach((ch, k) => { if (ch !== '#') return; const p = cell(k, r); g.box(p.x, 0.45, p.z, 1.74, 0.9, 1.74, (k + r) % 2 ? 0xe0c050 : 0xd6b844, 0xecd070); })); }, 0, 0, y0);
      MAZE_MAP.forEach((line, r) => [...line].forEach((ch, k) => { const p = cell(k, r); if (ch === '#') cols.push(game.world.addBox(p.x - 0.86, p.z - 0.86, p.x + 0.86, p.z + 0.86, y0 + 0.9)); else if (ch === 't') treats.push(p); }));
      c.track({ remove() { for (const b of cols) b.remove(); } });
      const gateIn = cell(4, 0), gateOut = cell(4, rows - 1), exit = { x: gateOut.x, z: gateOut.z + 2.4 };
      const next = () => c.goal(`Hay maze: treats ${found}/${treats.length + found}`, inside ? exit : gateIn);
      treats.slice().forEach((p, i) => c.pickup('t' + i, { x: p.x, z: p.z, kind: 'treat', marker: null, r: 1.1, onCollect: () => { treats.splice(treats.indexOf(p), 1); found++; c.bonus = found * 3; c.say('A hidden treat! ' + found + ' found.', { icon: 'paw', kind: 'good', ms: 1400 }); next(); } }));
      const run = c.timed({ label: 'Hay maze' });
      c.zone('in', { x: gateIn.x, z: gateIn.z + 1.8, r: 2.2, once: true }, () => { inside = true; next(); });
      c.zone('out', { x: exit.x, z: exit.z, r: 2.4 }, () => { if (!inside) return c.say('The way in is the gap at the north end, by Tully.', { icon: 'flag' }); const t = run.time; run.finish(true); c.say(`Out in ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')} with ${found} treat${found === 1 ? '' : 's'}.`, { icon: 'star', kind: 'good', ms: 3000 }); c.win({ time: t }); });
      next();
    } },

  { id: 'bowling', n: 4, name: 'Pumpkin Bowling', place: 'Columbia View Park lawn', at: { x: -142, z: -174, yaw: Math.PI / 2 }, giver: { name: 'Pin-setter Moss', look: { shirt: 0xf08a2a, hat: 'cap' } },
    story: 'Ten gourds stand at the end of a grass lane. Nose a little pumpkin and send it rolling: three goes, and every gourd down is a cheer.',
    steps: ['Walk into the pumpkin to nose it down the lane', 'Knock over as many gourds as you can', 'Three rolls'], reward: 60, again: 45, score: 'gourds',
    run(c) {
      const { game } = c, kc = game.kc, start = { x: -137, z: -171 }, head = { x: -121, z: -171 }, pins = [], ball = { x: start.x, z: start.z, vx: 0, vz: 0, rolling: false, t: 0, spin: 0 }; let rolls = 0, down = 0, wait = 0;
      for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) { const p = { x: head.x + r * 0.62, z: head.z + (k - r / 2) * 0.66, up: true }; p.m = c.mesh(g => { g.cyl(0, 0, 0, 0.17, 0.11, 0.42, 7, [0xe0a030, 0x9aae4a, 0xf0d070][(r + k) % 3]); g.ball(0, 0.5, 0, 0.11, 0.12, 0.11, 0xd9953a, 6, 4); }, p.x, p.z); pins.push(p); }
      const bm = c.mesh(g => { g.ball(0, 0.3, 0, 0.3, 0.26, 0.3, 0xf08a2a, 8, 5, true); g.cyl(0, 0.52, 0, 0.04, 0.03, 0.1, 4, 0x4f7f3f); }, ball.x, ball.z);
      for (const s of [-1.3, 1.3]) for (let i = 0; i < 5; i++) c.mesh(g => g.box(0, 0.06, 0, 0.5, 0.12, 0.14, 0xf4f4ef), lerp(start.x - 2, head.x + 2.4, i / 4), start.z + s);
      const aim = () => c.goal(`Pumpkin bowling: roll ${Math.min(3, rolls + 1)}/3 · gourds down ${down}/10`, ball.rolling ? null : { getPos: () => ball }, ball.rolling ? null : 'nudge');
      c.drive = () => ({ x: ball.x - 2.2, z: ball.z, yaw: Math.PI / 2, steps: 26 });
      /* a gourd the pumpkin hits falls and takes the ones right behind it along; those do not pass it on, so one roll rarely clears the patch */
      const knock = (p, dx, dz, depth = 0) => { if (!p.up) return; p.up = false; down++; p.m.mesh.rotation.z = -Math.PI / 2 * (dz >= 0 ? 1 : -1) * 0.9; p.m.mesh.rotation.x = 0.4; p.m.mesh.position.y += 0.12; game.audio.sfx('jump'); if (depth >= 1) return; for (const q of pins) { const d = dist(p, q); if (q.up && d < 0.8 && ((q.x - p.x) * dx + (q.z - p.z) * dz) / d > 0.75) knock(q, dx, dz, depth + 1); } };
      c.poll(0, dt => {
        if (wait > 0) { wait -= dt; if (wait <= 0) { rolls++; if (rolls >= 3 || down >= 10) { c.say(down >= 10 ? 'Every gourd down! A perfect patch.' : down >= 6 ? `${down} gourds down. Lovely rolling!` : `${down} gourds down. They wobbled, they really did.`, { icon: 'star', kind: 'gold', ms: 3200 }); return c.win({ score: down }); } ball.x = start.x; ball.z = start.z; ball.rolling = false; aim(); } }
        else if (!ball.rolling) { const d = dist(ball, kc.pos); if (d < 0.95 && d > 0.01) { const sp = Math.max(6, Math.min(13, kc.speed * 1.5)); ball.vx = ((ball.x - kc.pos.x) / d) * sp; ball.vz = ((ball.z - kc.pos.z) / d) * sp; ball.rolling = true; ball.t = 0; game.audio.sfx('pickup'); aim(); } }
        else { ball.t += dt; ball.x += ball.vx * dt; ball.z += ball.vz * dt; const k = Math.max(0, 1 - 0.28 * dt); ball.vx *= k; ball.vz *= k; const sp = Math.hypot(ball.vx, ball.vz); ball.spin += sp * dt * 3;
          for (const p of pins) if (p.up && dist(p, ball) < 0.5) { knock(p, ball.vx / (sp || 1), ball.vz / (sp || 1)); ball.vx *= 0.93; ball.vz *= 0.93; }
          if (sp < 0.7 || ball.t > 6 || ball.x > head.x + 5 || Math.abs(ball.z - start.z) > 5 || ball.x < start.x - 6) { ball.rolling = true; ball.vx = ball.vz = 0; wait = 0.8; } }
        bm.mesh.position.set(ball.x, Math.max(game.place.groundY(ball.x, ball.z), 0), ball.z); bm.mesh.rotation.z = -ball.spin;
      });
      aim();
    } },

  { id: 'windows', n: 5, name: 'Scarecrow and Window Contest', place: 'S 1st Street', at: { x: -206, z: -250, yaw: Math.PI / 2 }, giver: { name: 'Tailor Mirabel', look: { shirt: 0x8a6a9a, hat: 'straw' } },
    story: 'Five shops on S 1st Street are one decoration short of a finished display. Mirabel has a box of them: carry one to each shop.',
    steps: ['Take a decoration from Mirabel\'s box', 'Carry it to a shop that is waiting', 'Finish all five displays'], reward: 80, again: 55,
    run(c) {
      const { game } = c, kc = game.kc, shops = ['pets', 'bakery', 'hardware', 'toys', 'icecream'].map(id => ({ id, ...game.place.door(id, 2.4) })), things = ['scarecrow hat', 'painted pumpkin', 'lantern string', 'corn bundle', 'ribbon wreath'], box = { x: c.def.at.x + 2, z: c.def.at.z + 2 }; let done = 0, cur = null, n = 0;
      game.place.removeAll('fest:win:'); c.prop('crate', box.x + 1.2, box.z, { id: 'box', solid: false });
      const give = () => { if (n >= 5) return; cur = c.carriable('deco' + n, { kind: 'parcel', label: things[n], x: box.x, z: box.z }); n++; };
      const aim = () => { if (!cur) return; if (cur.held) { const s = c.nearest(shops); c.goal(`Displays ${done}/5: take the ${cur.label} to ${s.building.sign}`, s); } else c.goal(`Displays ${done}/5: pick up the ${cur.label}`, { getPos: () => cur }, 'interact'); };
      shops.forEach(s => { s.mk = c.marker('w-' + s.id, { x: s.x, z: s.z, label: 'Needs a decoration', icon: 'star' }); });
      c.poll(0.15, () => { if (cur && cur.held) { const s = shops.find(p => dist(p, kc.pos) < 3.2); if (s) { const b = game.place.beside(s.id, 1, 1.0, 3.0); cur.remove(); cur = null; s.mk.remove(); shops.splice(shops.indexOf(s), 1); done++;
        game.place.prop(done % 2 ? 'pumpkin' : 'haybale', b.x, b.z, { id: 'fest:win:' + s.id, s: 1.3, deco: true, solid: false }); c.puff(b.x, b.z); game.audio.sfx('pickup'); c.say(s.building.sign + ' has a finished display!', { icon: 'star', kind: 'good', ms: 2000 });
        if (done >= 5) return c.after(0.8, () => c.win()); give(); } } aim(); });
      give(); aim();
    } },

  { id: 'market', n: 6, name: 'Market Stall Helper', place: 'Festival market, the Riverwalk', at: { x: -120, z: -328, yaw: Math.PI }, giver: { name: 'Market steward Ottoline', look: { shirt: 0x4f9a94, hat: 'cap' } },
    story: 'The craft stalls are busy and nobody can leave their table. Run the change and the parcels between them before the queue grows.',
    steps: ['Collect from the stall with the flag', 'Run it to the next stall', 'Four errands in all'], reward: 80, again: 55, timed: true,
    run(c) {
      const S = FEST_STALLS, f = i => ({ ...stallFront(S[i]), name: S[i].name }), trips = [[0, 5, 'change'], [3, 4, 'a parcel'], [1, 2, 'change'], [5, 0, 'a parcel']], cps = [];
      for (const [a, b, what] of trips) { cps.push({ ...f(a), r: 3, label: `Collect ${what} at ${S[a].name}` }, { ...f(b), r: 3, label: `Take ${what} to ${S[b].name}` }); }
      c.note('Run change and parcels between the stalls');
      c.timed({ label: 'Market', seconds: 150, checkpoints: cps, failText: 'The queue got a bit long that time. Ottoline says the stallholders would love another pair of paws.',
        onCheckpoint: i => c.say(i % 2 ? 'Thank you, KC!' : 'Got it. Off you go!', { icon: 'paw', ms: 1300 }), onFinish: r => (r.ok ? c.win({ time: r.time }) : r.reason === 'time' && c.fail()) });
    } },

  { id: 'cruise', n: 7, name: 'Lantern River Cruise', place: 'Courthouse Dock, around Sand Island', at: { x: -103, z: -206, yaw: -Math.PI / 2 }, giver: { name: 'Boatman Ilya', look: { shirt: 0x3a4f7a, hat: 'cap' } },
    story: 'Ten paper lanterns are floating around Sand Island. Take a canoe from the dock (or swim, if you are that sort of dog) and spot them all.',
    steps: ['Hop in the canoe at Courthouse Dock', 'Find ten floating lanterns around Sand Island', 'Paddle back to the dock'], reward: 90, again: 65,
    run(c) {
      const lanterns = c.def.lanterns.map(([x, z]) => ({ x, z })); let got = 0;
      const next = () => (lanterns.length ? c.goal(`Floating lanterns ${got}/10`, c.nearest(lanterns)) : c.goal('Paddle back to Courthouse Dock', c.def.at));
      lanterns.slice().forEach((p, i) => c.pickup('l' + i, { x: p.x, z: p.z, kind: 'lantern', color: LAN[i % LAN.length], r: 3.2, lift: 0.5, onCollect: () => { lanterns.splice(lanterns.indexOf(p), 1); got++; next(); } }));
      c.zone('dock', { x: c.def.at.x, z: c.def.at.z, r: 7 }, () => { if (!lanterns.length) c.win(); });
      c.say('The canoe is tied up at the dock. Lanterns glow on the map.', { icon: 'map', ms: 3200 }); c.poll(1, next); next();
    }, lanterns: [[-80, -232], [-82, -276], [-80, -318], [-78, -360], [-46, -400], [-14, -362], [-10, -318], [-12, -272], [-14, -230], [-46, -196]] },

  { id: 'trolley', n: 8, name: 'Trolley Tour Guide', place: 'Old town trolley, four stops', at: { x: -142, z: -262, yaw: -Math.PI / 2 }, giver: { name: 'Conductor Bram', look: { shirt: 0xa8402f, hat: 'cap' } },
    story: 'The festival trolley tours the real landmarks of St. Helens, and the guide only remembers the history when a dog barks at the right moment.',
    steps: ['Bark at each landmark to start the story', 'Hop back on the trolley for the next stop', 'Four stops: courthouse, fog bell, quarry, lighthouse view'], reward: 90, again: 65,
    run(c) {
      const { game } = c, kc = game.kc, stops = c.def.stops; let i = 0, told = false, car = null;
      const park = () => { const s = stops[i]; if (car) car.remove(); car = c.mesh(g => { g.box(0, 1.25, 0, 1.9, 1.5, 4.2, 0xa8402f, 0xe8d9a8); g.box(0, 2.1, 0, 2.1, 0.14, 4.6, 0xe8d9a8); g.box(0, 1.5, 0, 1.94, 0.6, 3.4, 0xf4ead8); for (const sx of [-0.9, 0.9]) for (const sz of [-1.4, 1.4]) g.box(sx, 0.28, sz, 0.16, 0.56, 0.56, 0x2a2c30); g.box(0, 0.45, 0, 1.7, 0.14, 4.0, 0x3a2f2a); }, s.car[0], s.car[1]); car.mesh.rotation.y = s.car[2] || 0;
        if (c.giver) { c.giver.x = s.car[0] + 2.2; c.giver.z = s.car[1] + 1.6; } };
      const aim = () => { const s = stops[i]; if (!told) c.goal(`Stop ${i + 1}/4: bark at ${s.name}`, s, dist(s, kc.pos) < 9 ? 'bark' : null); else c.goal(`Stop ${i + 1}/4 done: hop back on the trolley`, { x: s.car[0] + 1.8, z: s.car[1] }, 'interact'); };
      c.on('bark', () => { const s = stops[i]; if (told || dist(s, kc.pos) > 9) return; told = true; game.audio.sfx('bell'); c.say(`${c.def.giver.name}: "${s.line}"`, { icon: 'bark', ms: 7000 });
        if (i >= stops.length - 1) { c.goal('End of the line'); return c.after(2.2, () => c.win()); } aim(); });
      c.marker('ride', { getPos: () => ({ x: stops[i].car[0] + 1.8, z: stops[i].car[1] }), label: 'Festival trolley', icon: 'flag', color: '#ff9a6a', prompt: 'Ride to the next stop', r: 3.4, prio: 4, enabled: () => told && i < stops.length - 1 && !game.ui.fading, onInteract: () => {
        game.audio.sfx('honk'); game.ui.fade(() => { if (c.ended) return; i++; told = false; park(); const s = stops[i]; kc.teleport(s.car[0] + 1.8, s.car[1] + 0.4, s.yaw); game.cam.yaw = s.yaw; game.cam.snap(); game.toast('Ding ding! Next stop: ' + s.name + '.', { icon: 'flag' }); aim(); }); } });
      park(); c.poll(0.5, aim); aim();
    },
    stops: [
      { x: -138, z: -256, car: [-142, -266, 0], yaw: -Math.PI / 2, name: 'the Columbia County Courthouse', line: 'Built in 1906 from basalt cut just up the road. The clock tower came a few years later and the town has been on time ever since.' },
      { x: -110, z: -219, car: [-116, -212, Math.PI / 2], yaw: -Math.PI / 2, name: 'the Old Fog Bell', line: 'Rung by hand in thick river fog so the boats could find the channel. The little lighthouse beside it is a half-size copy of Warrior Rock Light.' },
      { x: -328, z: -404, car: [-336, -396, 0], yaw: 0, name: 'the Old Quarry', line: 'A century ago, stone from these ledges paved streets up and down the river. Mind your paws on the benches.' },
      { x: -124, z: -152, car: [-130, -146, 0.6], yaw: -Math.PI / 2, name: 'the lighthouse view', line: 'Look down the river: Warrior Rock Light, the smallest lighthouse in Oregon, stands at the tip of Sauvie Island. That is the end of the tour. Mind the step!' }
    ] }
];
