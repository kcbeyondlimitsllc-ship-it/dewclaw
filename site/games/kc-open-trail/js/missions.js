/* Missions: the 16 story missions (SETTING-BRIEF.md, section 4), the 8 Fog Bell Festival activities (js/activities.js),
   the Missions journal and the daily / weekly trail tasks.

   How a mission is written: a plain definition { id, n, name, place, at: { x, z, yaw }, giver: { name, look }, story, steps,
   reward (first time), again (every later time), run(c) }. run(c) gets a context whose helpers put things in the world under
   the prefix 'ms:<id>:' and listen to the bus; everything is taken away again when the mission ends, however it ends.
   Missions pay bones only, through game.economy.grant. Failing costs nothing: the giver offers another go.
   Nothing here talks to the network. See ARCHITECTURE.md, "Module seams", for every hook used. */
import { THREE, Geo } from './util.js';
import { dogMaterial } from './kc.js';
import { MAZE, SJB } from './data.js';
import { ACTIVITIES, FEST_STALLS } from './activities.js';

const GOLD = '#ffd23c', BLUE = '#7fd4ff', GREEN = '#9fd6a8';
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const lerp = (a, b, t) => a + (b - a) * t;

/* ================= the 16 missions ================= */
const MISSIONS = [
  { id: 'bell', n: 1, name: 'Ring the Old Bell', place: 'Courthouse Plaza', at: { x: -150, z: -243, yaw: 0 }, giver: { name: 'Clockkeeper Odile', look: { shirt: 0x8a6a9a, hat: 'cap' } },
    story: 'The courthouse clock is about to chime the hour, and the Old Fog Bell should answer it. Odile cannot run that fast. KC can.',
    steps: ['Run to the corner of the courthouse', 'Jump, then bark', 'Ring the Old Fog Bell before the chimes stop'], reward: 50, again: 10, timed: true,
    run(c) {
      const { game } = c, bell = game.world.fogBell || { x: -110, z: -220.2 };
      game.audio.sfx('bell');
      c.timed({ label: 'Chimes', seconds: 90, failText: 'The clock finished chiming first. Odile is already winding it up for another go.' });
      c.goal('Run to the corner of the courthouse', { x: -138, z: -228 });
      c.zone('corner', { x: -138, z: -228, r: 5, once: true }, () => {
        c.say('Good running! Now jump.', { icon: 'jump' }); c.goal('Jump!', null, 'jump');
        c.once('jump', () => { c.say('Now one big bark!', { icon: 'bark' }); c.goal('Bark hello to the river', null, 'bark');
          c.once('bark', () => { c.goal('Ring the Old Fog Bell', bell, 'interact'); c.once('fogBell', () => c.win()); }); });
      });
    } },

  { id: 'paper', n: 2, name: 'Plaza Paper Round', place: 'S 1st Street', at: { x: -205, z: -201, yaw: Math.PI }, giver: { name: 'Postmaster Wren', look: { shirt: 0x3f7fd6, hat: 'cap' } },
    story: 'Ten shops on S 1st Street want the morning paper on the mat before they open. Wren has the bundle; KC has the legs.',
    steps: ['Up the west side of S 1st Street, back down the east side', 'Finish with the two shops on the plaza', 'Deliver all ten papers before the shops open'], reward: 90, again: 45, timed: true,
    run(c) {
      const { game } = c, stops = ['records', 'pets', 'tailor', 'bakery', 'picturehouse', 'cafe', 'toys', 'hardware', 'gallery', 'diner'].map(id => { const d = game.place.door(id, 2.2); return { x: d.x, z: d.z, r: 3.2, label: d.building.sign }; });
      c.note('Deliver the morning papers');
      c.timed({ label: 'Paper round', seconds: 100, checkpoints: stops, failText: 'The shops opened before the last paper landed. Wren has a fresh bundle ready.',
        onCheckpoint: i => { c.say('Paper on the mat: ' + stops[i].label, { icon: 'paw', ms: 1600 }); c.puff(stops[i].x, stops[i].z); },
        onFinish: r => (r.ok ? c.win({ time: r.time }) : r.reason === 'time' && c.fail()) });
    } },

  { id: 'patrol', n: 3, name: 'Riverwalk Patrol', place: 'Columbia View Park to Nob Hill', at: { x: -108, z: -204, yaw: -Math.PI / 2 }, giver: { name: 'Ranger Dale', look: { shirt: 0x6f8f4f, hat: 'straw' } },
    story: 'A friendly patrol of the riverfront trail: say hello to the visitors and pick up anything that was dropped on the way to Nob Hill.',
    steps: ['Say hello to five visitors', 'Pick up five bits of litter', 'Finish at the Nob Hill trailhead'], reward: 90, again: 45,
    run(c) {
      const people = [[-100, -190, 'Mabel'], [-114, -161, 'Otis'], [-138, -141, 'Priya'], [-170, -139, 'Lars'], [-200, -147, 'Coral']], litter = [[-106, -178], [-124, -152], [-150, -137], [-184, -141], [-216, -160]], end = { x: -232, z: -177 };
      let hi = 0, lit = 0; const met = people.map(() => false), left = litter.map(([x, z]) => ({ x, z }));
      const next = () => {
        if (hi >= 5 && lit >= 5) return c.goal('Finish at the Nob Hill trailhead', end);
        const todo = [...people.map(([x, z], i) => (met[i] ? null : { x, z, hello: true })), ...left].filter(Boolean), near = c.nearest(todo);
        c.goal(`Hellos ${hi}/5 · Litter ${lit}/5`, near, near.hello ? 'interact' : null);
      };
      people.forEach(([x, z, name], i) => c.npc('v' + i, { x, z, name, prompt: 'Say hello to ' + name, enabled: () => !met[i], onInteract: () => { met[i] = true; hi++; c.say(name + ' says hello back!', { icon: 'hand', kind: 'good' }); next(); } }));
      litter.forEach(([x, z], i) => c.pickup('l' + i, { x, z, kind: 'litter', onCollect: () => { left.splice(left.findIndex(p => p.x === x && p.z === z), 1); lit++; next(); } }));
      c.zone('end', { x: end.x, z: end.z, r: 6 }, () => { if (hi >= 5 && lit >= 5) c.win(); else c.say('Nearly there: a few hellos or bits of litter are still waiting back along the trail.', { kind: 'warn' }); });
      c.poll(1, next); next();
    } },

  { id: 'shuttle', n: 4, name: 'Island Shuttle', place: 'North Marina to Sand Island', at: { x: -110, z: -339, yaw: 0 }, giver: { name: 'Skipper Marlo', look: { shirt: 0x3a4f7a, hat: 'cap' } },
    story: 'A camper on Sand Island left a tent bag on the dock. Take it over on the shuttle boat. After that, Marlo will run the shuttle for KC any time.',
    steps: ['Pick up the tent bag', 'Ride the shuttle boat to Sand Island', 'Carry the bag to the camper'], reward: 100, again: 50,
    run(c) {
      const { game } = c, camper = { x: -44, z: -310 }, onIsland = () => game.kc.pos.x > -70;
      const bag = c.carriable('bag', { kind: 'parcel', label: 'tent bag', x: c.def.at.x + 1.8, z: c.def.at.z + 1.4 });
      const aim = () => { if (!bag.held) c.goal('Pick up the tent bag', { getPos: () => bag }, 'interact'); else if (onIsland()) c.goal('Carry the tent bag to the camper', camper, 'interact'); else c.goal('Ride the shuttle boat to Sand Island', FERRY.marina, 'interact'); };
      c.npc('camper', { ...camper, name: 'Camper Noor', look: { shirt: 0xf08a2a }, prompt: 'Give Noor the tent bag', enabled: () => bag.held, onInteract: () => c.win() });
      c.on('carry', aim); c.on('drop', () => { c.say('Dropped it! No harm done: pick the tent bag back up.', { icon: 'paw' }); aim(); }); c.on('ferry', aim); c.poll(1, aim); aim();
    },
    after(game, data) { if (!data.ferry) { data.ferry = true; game.toast('The shuttle now runs for KC any time: North Marina and Sand Island.', { icon: 'flag', kind: 'good', ms: 5000 }); } } },

  { id: 'castle', n: 5, name: 'Sandcastle Judge', place: 'Sand Island beach', at: { x: -44, z: -238, yaw: 0 }, giver: { name: 'Judge Pearl', look: { shirt: 0xf0cf73, hat: 'cap' } },
    story: 'The sandcastle contest needs a tall one. Dig up sand, fetch the buckets, and watch the castle grow with every trip.',
    steps: ['Dig at the three sand marks', 'Fetch the three buckets', 'See the castle reach six tiers'], reward: 110, again: 55,
    run(c) {
      const spots = [[-50, -246], [-37, -247], [-45, -257]].map(([x, z]) => ({ x, z, dig: true })), buckets = [[-51, -268], [-39, -277], [-47, -290]].map(([x, z]) => ({ x, z })), castle = { x: -39, z: -230 };
      let level = 0, mesh = null;
      const build = () => { if (mesh) mesh.remove(); mesh = c.mesh(g => { const s = 0xe2cf9c, d = 0xcdb57e; g.cyl(0, 0, 0, 1.5, 1.3, 0.25, 10, d, s); for (let i = 0; i < level; i++) { const r = 1.1 - i * 0.15, y = 0.25 + i * 0.5; g.cyl(0, y, 0, r, r * 0.86, 0.5, 9, i % 2 ? d : s, s); } if (level >= 6) { g.cyl(0, 3.25, 0, 0.03, 0.03, 0.9, 4, 0xf4f4ef); g.box(0.22, 3.95, 0, 0.42, 0.26, 0.03, 0xd9534f); } }, castle.x, castle.z); c.puff(castle.x, castle.z); };
      const next = () => { if (level >= 6) return c.after(1.2, () => c.win()); const near = c.nearest([...spots, ...buckets]); c.goal(`Castle tiers ${level}/6`, near, near.dig ? 'dig' : null); };
      const grow = () => { level++; build(); c.say(level >= 6 ? 'Six tiers! Tallest castle on the beach.' : 'The castle grows: ' + level + ' of 6.', { icon: 'dig', kind: 'good', ms: 1800 }); next(); };
      spots.forEach((p, i) => { p.mk = c.marker('s' + i, { x: p.x, z: p.z, label: 'Sand to dig', icon: 'dig', beacon: true }); });
      c.on('dig', e => { const i = spots.findIndex(p => dist(p, e) < 3.4); if (i < 0) return; spots[i].mk.remove(); spots.splice(i, 1); grow(); });
      buckets.slice().forEach((p, i) => c.pickup('b' + i, { x: p.x, z: p.z, kind: 'bucket', onCollect: () => { buckets.splice(buckets.indexOf(p), 1); grow(); } }));
      build(); c.poll(1, () => { if (level < 6) next(); }); next();
    } },

  { id: 'lunch', n: 6, name: 'Lighthouse Lunch', place: 'Sauvie Island to Warrior Rock Light', at: { x: 38, z: 31, yaw: 0 }, giver: { name: 'Cook Tansy', look: { shirt: 0xf4f4ef, hat: 'cap' } },
    story: 'The keeper at Warrior Rock Light forgot lunch again. Carry the pail up Reeder Road and the island trail, all the way to the lighthouse.',
    steps: ['Pick up the lunch pail', 'Carry it north along Reeder Road', 'Give it to the keeper at Warrior Rock Light'], reward: 140, again: 70,
    run(c) {
      const { game } = c, door = game.place.door('keeper', 2.2) || { x: -11.4, z: -70 }, keeper = { x: door.x + 0.6, z: door.z + 2.2 }; let drops = 0;
      const pail = c.carriable('pail', { kind: 'parcel', label: 'lunch pail', x: c.def.at.x + 1.6, z: c.def.at.z + 1.6 });
      const aim = () => (pail.held ? c.goal('Carry the lunch pail to the lighthouse keeper', keeper, 'interact') : c.goal(drops ? 'Pick the lunch pail back up' : 'Pick up the lunch pail', { getPos: () => pail }, 'interact'));
      c.npc('keeper', { ...keeper, name: 'Keeper Ansel', look: { shirt: 0x3a4f7a, hat: 'cap' }, prompt: 'Give Ansel his lunch', enabled: () => pail.held, onInteract: () => { c.say(drops ? 'Ansel grins: "A little shaken, still delicious."' : 'Ansel grins: "Not a crumb out of place!"', { icon: 'hand', kind: 'good', ms: 3200 }); c.win(); } });
      c.on('carry', aim); c.on('drop', e => { if (e.id !== pail.id) return; drops++; c.say('Oops, the pail slipped. The lunch is fine: pick it back up.', { icon: 'paw' }); aim(); }); c.poll(1, aim); aim();
    } },

  { id: 'sniff', n: 7, name: 'Oak Woods Sniff Trail', place: 'Nob Hill Nature Park', at: { x: -231, z: -179, yaw: Math.PI }, giver: { name: 'Walker June', look: { shirt: 0xd98d8d } },
    story: 'June lost a glove somewhere on the Nob Hill loop. She clips on the lead and follows while KC works the scent, one sniff at a time.',
    steps: ['Follow the scent marks around the loop', 'Keep June close (bark and she hurries over)', 'Find the glove'], reward: 100, again: 50,
    run(c) {
      const { game } = c, june = c.giver, trail = [[-246, -166], [-264, -140], [-262, -118], [-246, -108], [-230, -121]].map(([x, z]) => ({ x, z })), glove = { x: -239, z: -137 }; let i = 0, mk = null, told = 0;
      june.follow(true, 2.6);
      const aim = () => { if (mk) mk.remove(); const p = trail[i]; if (!p) return; mk = c.marker('scent', { x: p.x, z: p.z, label: 'Scent', icon: 'paw', beacon: true }); c.goal(`Follow the scent ${i}/${trail.length}`, p); };
      c.on('bark', () => { if (dist(june, game.kc.pos) > 5 && dist(june, game.kc.pos) < 90) { june.x = game.kc.pos.x - 1.6; june.z = game.kc.pos.z - 1.2; c.say('June hurries over.', { icon: 'hand', ms: 1400 }); } });
      c.poll(0.25, () => {
        const p = trail[i]; if (!p) return; if (Math.random() < 0.3) game.fx.burst('spark', p.x, game.place.groundY(p.x, p.z) + 0.6, p.z, 3);
        if (dist(p, game.kc.pos) > 4) { if (c.need === 'bark') c.goal(`Follow the scent ${i}/${trail.length}`, p); return; }
        if (dist(june, game.kc.pos) > 15) { if (c.need !== 'bark') c.goal('June is far behind: bark to call her', p, 'bark'); if (c.t - told > 6) { told = c.t; c.say('The lead is tight. Bark and June will hurry over.', { icon: 'bark' }); } return; }
        i++; game.audio.sfx('pickup'); c.puff(p.x, p.z);
        if (i < trail.length) { c.say('Sniff sniff... the scent goes on.', { icon: 'paw', ms: 1500 }); aim(); }
        else { if (mk) mk.remove(); c.say('The scent is strong here. The glove is close!', { icon: 'paw', kind: 'good' }); c.goal('Find the glove', glove); c.pickup('glove', { ...glove, kind: 'glove', onCollect: () => { june.wave(); c.win(); } }); }
      });
      aim();
    } },

  { id: 'creek', n: 8, name: 'Creek Chase', place: 'McCormick Park', at: { x: -384, z: -118, yaw: 0 }, giver: { name: 'Disc-golfer Hank', look: { shirt: 0xf08a2a, hat: 'cap' } },
    story: 'A gust took five disc-golf discs into Milton Creek and they are bobbing away downstream. Splash after them and bring them back.',
    steps: ['Follow Milton Creek downstream', 'Fetch five discs', 'Bring them back to Hank'], reward: 100, again: 50,
    run(c) {
      const discs = [[-420, -86], [-392, -91], [-362, -82], [-334, -71], [-302, -67]].map(([x, z]) => ({ x, z })), cols = [0x3f9fd6, 0xd9534f, 0xf0c040, 0x5fae5f, 0x8a4fae]; let got = 0;
      const next = () => (discs.length ? c.goal(`Discs ${got}/5`, c.nearest(discs)) : c.goal('Bring the discs back to Hank', c.def.at));
      discs.slice().forEach((p, i) => c.pickup('d' + i, { x: p.x, z: p.z, kind: 'disc', color: cols[i], onCollect: () => { discs.splice(discs.indexOf(p), 1); got++; next(); } }));
      c.zone('back', { x: c.def.at.x, z: c.def.at.z, r: 5 }, () => { if (!discs.length) c.win(); });
      c.poll(1, next); next();
    } },

  { id: 'echo', n: 9, name: 'Quarry Echo', place: 'The Old Quarry', at: { x: -334, z: -406, yaw: 0 }, giver: { name: 'Forewoman Bex', look: { shirt: 0xc9953a, hat: 'cap' } },
    story: 'The quarry foreman is fast asleep and his shift starts now. Three ledges in the quarry send a bark bouncing off every wall.',
    steps: ['Climb to each echo ledge', 'Bark at all three', 'Watch the foreman wake up'], reward: 110, again: 55,
    run(c) {
      const pts = c.def.ledges.map(([x, z]) => ({ x, z })), fm = c.def.foreman; let done = 0;
      const foreman = c.npc('foreman', { ...fm, name: 'Foreman Gus', look: { shirt: 0x6a6e76, hat: 'cap' } });
      const next = () => (pts.length ? c.goal(`Echo ledges ${done}/3: bark from the ledge`, c.nearest(pts), 'bark') : null);
      pts.forEach((p, i) => { p.mk = c.marker('e' + i, { x: p.x, z: p.z, label: 'Echo ledge', icon: 'bark', beacon: true }); });
      c.on('bark', () => { const i = pts.findIndex(p => dist(p, c.game.kc.pos) < 5); if (i < 0) return; const p = pts[i]; p.mk.remove(); pts.splice(i, 1); done++;
        for (const s of [0.45, 0.95]) c.after(s, () => { c.game.audio.sfx('bark'); c.puff(p.x, p.z); });
        c.say(['WOOF... woof... woof...', 'WOOF... woof... The foreman rolls over.', 'WOOF! WOOF! woof... "I am up, I am up!"'][done - 1], { icon: 'bark', ms: 2600 });
        if (!pts.length) { c.goal('The foreman is waking up'); foreman.wave(); c.after(1.6, () => c.win()); } else next(); });
      c.poll(1, next); next();
    }, ledges: [[-342, -438], [-326, -440], [-340, -452]], foreman: { x: -326, z: -420 } },

  { id: 'mill', n: 10, name: 'Mill Whistle', place: 'The Paper Mill', at: { x: -335, z: -28, yaw: -Math.PI / 2 }, giver: { name: 'Shift boss Ines', look: { shirt: 0x8a8f96, hat: 'cap' } },
    story: 'Three paper rolls have to cross the yard from the north bay to the south bay before the whistle blows for lunch.',
    steps: ['Pick up a paper roll at the north bay', 'Carry it to the south bay', 'Move all three before the whistle'], reward: 110, again: 55, timed: true,
    run(c) {
      const { game } = c, A = c.def.bayA, B = c.def.bayB; let moved = 0;
      c.prop('crate', A.x + 1.6, A.z - 1.4, { id: 'ca', solid: false }); c.marker('bayB', { x: B.x, z: B.z, label: 'South bay', icon: 'flag', beacon: true });
      const rolls = [0, 1, 2].map(i => c.carriable('roll' + i, { kind: 'parcel', label: 'paper roll', x: A.x - 1.3 + i * 1.3, z: A.z, mesh: c.rawMesh(g => { g.tf(0, 0.14, 0, 0, 0, Math.PI / 2); g.cyl(0, -0.3, 0, 0.26, 0.26, 0.6, 9, 0xf4f1e8, 0xcdb57e); g.notf(); }) }));
      const aim = () => { const held = rolls.find(r => r.held), free = rolls.filter(r => !r.gone && !r.held); if (held) c.goal(`Rolls ${moved}/3: carry it to the south bay`, B); else if (free.length) c.goal(`Rolls ${moved}/3: pick up a paper roll`, { getPos: () => c.nearest(free) }, 'interact'); };
      c.timed({ label: 'Whistle', seconds: 110, failText: 'The whistle blew with rolls still in the north bay. Ines resets the stack: no harm done.' });
      c.poll(0.1, () => { if (dist(B, game.kc.pos) < 3.6) for (const r of rolls) if (r.held && !r.gone) { r.gone = true; r.remove(); moved++; game.audio.sfx('pickup'); c.puff(B.x, B.z); c.prop('crate', B.x - 1.4 + moved * 1.1, B.z + 1.8, { id: 'cb' + moved, solid: false }); if (moved >= 3) return c.win({ time: game.run ? game.run.time : null }); } aim(); });
      aim();
    }, bayA: { x: -333, z: -46 }, bayB: { x: -333, z: -6 } },

  { id: 'train', n: 11, name: 'Beat the Train', place: 'Highway 30, Scappoose', at: { x: -390, z: -27, yaw: 2.4 }, giver: { name: 'Signal-keeper Olo', look: { shirt: 0xd9534f, hat: 'cap' } },
    story: 'The slow freight is rolling out of the yard. Race it down the safe side path, well clear of the rails, to the Scappoose crossing.',
    steps: ['Stay on the side path, away from the track', 'Run through each flag', 'Reach the crossing before the freight does'], reward: 120, again: 60, timed: true,
    run(c) {
      const { game } = c, path = c.def.path, cps = path.slice(1).map(([x, z], i) => ({ x, z, r: 4.5, label: i === path.length - 2 ? 'Scappoose crossing' : 'Side path flag ' + (i + 1) }));
      let len = 0; for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); const secs = Math.round(len / 4.6);
      /* the freight is a dot on the map that keeps the pace of the clock: it reaches the crossing exactly when time runs out */
      const train = { x: path[0][0] - 5, z: path[0][1] + 5 }; c.marker('freight', { getPos: () => train, label: 'Slow freight', icon: 'flag', color: '#ff9a6a', edge: true });
      game.audio.sfx('honk'); c.note('Race the slow freight to the crossing');
      const run = c.timed({ label: 'Freight', seconds: secs, checkpoints: cps, color: GOLD, failText: 'The freight rumbled over the crossing first. Olo waves it through and offers a rematch.',
        onFinish: r => (r.ok ? c.win({ time: r.time }) : r.reason === 'time' && c.fail()) });
      c.poll(0, () => { let d = (run.time / secs) * len; for (let i = 1; i < path.length; i++) { const s = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); if (d <= s || i === path.length - 1) { const t = Math.min(1, d / s); train.x = lerp(path[i - 1][0], path[i][0], t) - 5; train.z = lerp(path[i - 1][1], path[i][1], t) + 5; break; } d -= s; } });
    }, path: [[-390, -27], [-362, 6], [-331, 43], [-304, 70], [-276, 98], [-251, 123]] },

  { id: 'haul', n: 12, name: 'Pumpkin Haul', place: 'Wapato Patch Farm', at: { x: 92, z: 96, yaw: -Math.PI / 2 }, giver: { name: 'Farmhand Beto', look: { shirt: 0xa8402f, hat: 'cap' } },
    story: 'Six of the best pumpkins are picked and waiting in the field. Hitch up the little cart, load them, and pull it to the farm stand.',
    steps: ['Hitch up the pumpkin cart', 'Load six pumpkins in the field', 'Pull the cart to the Wapato Patch Stand'], reward: 120, again: 60,
    run(c) {
      const { game } = c, kc = game.kc, start = { x: 96, z: 99 }, stand = game.place.stall('Wapato Patch Stand', 4.2) || { x: 48, z: 50 }, spots = c.def.pumpkins.map(([x, z]) => ({ x, z }));
      let hitched = false, load = 0, pile = null; const cart = { x: start.x, z: start.z, yaw: 0 };
      const body = c.mesh(g => { g.box(0, 0.5, 0, 1.1, 0.12, 1.5, 0x9a6a42); for (const s of [-1, 1]) { g.box(s * 0.55, 0.72, 0, 0.08, 0.4, 1.5, 0xb8834f); g.box(0, 0.72, s * 0.75, 1.1, 0.4, 0.08, 0xb8834f); for (const t of [-0.5, 0.5]) g.box(s * 0.64, 0.3, t, 0.1, 0.56, 0.56, 0x3a3a3e); } g.box(0, 0.5, 1.2, 0.08, 0.08, 0.9, 0x6a4a2a); }, cart.x, cart.z);
      const fill = () => { if (pile) pile.remove(); pile = c.mesh(g => { for (let i = 0; i < load; i++) { const a = i * 2.1; g.ball(Math.cos(a) * 0.26, 0.82 + Math.floor(i / 3) * 0.3, Math.sin(a) * 0.4, 0.24, 0.2, 0.24, 0xf08a2a, 7, 4, true); } }, cart.x, cart.z); };
      const next = () => { if (!hitched) return c.goal('Hitch up the pumpkin cart', start, 'interact'); if (spots.length) return c.goal(`Pumpkins ${load}/6`, c.nearest(spots)); c.goal('Pull the cart to the farm stand', stand); };
      c.marker('hitch', { x: start.x, z: start.z, label: 'Pumpkin cart', icon: 'paw', prompt: 'Hitch up the cart', enabled: () => !hitched, onInteract: () => {
        hitched = true; game.audio.sfx('door'); c.say('Hitched! The cart rolls along behind KC.', { icon: 'paw', kind: 'good' });
        spots.slice().forEach((p, i) => c.pickup('p' + i, { x: p.x, z: p.z, kind: 'pumpkin', onCollect: () => { spots.splice(spots.indexOf(p), 1); load++; fill(); next(); } })); next(); } });
      c.poll(0, dt => {
        if (hitched) { const tx = kc.pos.x - Math.sin(kc.yaw) * 2.0, tz = kc.pos.z - Math.cos(kc.yaw) * 2.0, k = Math.min(1, dt * 7); cart.x = lerp(cart.x, tx, k); cart.z = lerp(cart.z, tz, k); cart.yaw = Math.atan2(kc.pos.x - cart.x, kc.pos.z - cart.z); }
        const y = Math.max(game.place.groundY(cart.x, cart.z), 0); for (const m of [body, pile]) if (m) { m.mesh.position.set(cart.x, y, cart.z); m.mesh.rotation.y = cart.yaw; }
        if (hitched && !spots.length && dist(stand, kc.pos) < 4.5) c.win();
      });
      c.poll(1, next); next();
    }, pumpkins: [[84, 90], [70, 84], [76, 108], [98, 114], [112, 98], [104, 84]] },

  { id: 'corn', n: 13, name: 'Lost in the Corn', place: 'Wapato Patch Farm corn maze', at: { x: 5, z: 68, yaw: 0 }, giver: { name: 'Farmer Odette', look: { shirt: 0x5f9f4f, hat: 'straw' } },
    story: 'Three children went into the corn maze and cannot find the way out. They cannot see over the corn, but they can hear a bark.',
    steps: ['Find each child in the maze and bark', 'Lead them back to the way in', 'Bark again if anyone falls behind'], reward: 130, again: 65,
    run(c) {
      const { game } = c, kc = game.kc, cw = (MAZE.x1 - MAZE.x0) / 9, cd = (MAZE.z1 - MAZE.z0) / 9, cell = (cx, cz) => ({ x: MAZE.x0 + (cx + 0.5) * cw, z: MAZE.z0 + (cz + 0.5) * cd });
      const out = { x: MAZE.x0 + 5.5 * cw, z: MAZE.z0 - 4 }, kids = [['Pim', 1, 2, 0xd9534f], ['Tova', 7, 4, 0x3f7fd6], ['Jules', 4, 7, 0xf0c040]].map(([name, cx, cz, shirt], i) => { const p = cell(cx, cz); return { name, st: c.npc('k' + i, { ...p, name, scale: 0.68, look: { shirt } }), found: false, safe: false }; });
      let safe = 0;
      const next = () => { const lost = kids.filter(k => !k.found), with_ = kids.filter(k => k.found && !k.safe); if (with_.length && !lost.length) c.goal(`Children safe ${safe}/3: lead them out of the maze`, out, dist(out, kc.pos) < 6 ? 'bark' : null); else if (lost.length) { const k = c.nearest(lost.map(k => k.st)); c.goal(`Children safe ${safe}/3: find them and bark`, k, dist(k, kc.pos) < 9 ? 'bark' : null); } };
      c.on('bark', () => { for (const k of kids) { if (k.safe) continue;
        if (!k.found && dist(k.st, kc.pos) < 10) { k.found = true; k.st.follow(true, 2.2 + kids.indexOf(k) * 0.9); k.st.wave(); c.say(k.name + ' heard the bark and is following KC!', { icon: 'bark', kind: 'good', ms: 2200 }); }
        else if (k.found && dist(k.st, kc.pos) > 6) { k.st.x = kc.pos.x - 1.2 - kids.indexOf(k) * 0.6; k.st.z = kc.pos.z - 1.0; } } next(); });
      c.poll(0.3, () => { for (const k of kids) if (k.found && !k.safe && dist(out, kc.pos) < 7 && dist(k.st, out) < 8) { k.safe = true; safe++; k.st.follow(false); k.st.walkTo(c.def.at.x + 2 + safe * 1.2, c.def.at.z - 1.5, 2.2); c.say(k.name + ' is out of the corn!', { icon: 'hand', kind: 'good', ms: 1800 }); if (safe >= 3) return c.after(1, () => c.win()); } next(); });
      next();
    } },

  { id: 'flags', n: 14, name: 'Bridge Flags', place: 'St. Johns Bridge and Cathedral Park', at: { x: 197, z: 296, yaw: Math.PI / 2 }, giver: { name: 'Bandleader Imani', look: { shirt: 0x6a7f9f } },
    story: 'The wind took the ribbon flags meant for the park stage and strung them along the bridge walkway. The band cannot start without them.',
    steps: ['Collect ten ribbon flags along the bridge walkway', 'Bring them back to the Cathedral Park stage'], reward: 130, again: 65,
    run(c) {
      const cols = [0xd9534f, 0xf0c040, 0x3f9fd6, 0x5fae5f, 0x8a4fae], flags = Array.from({ length: 10 }, (_, i) => ({ x: SJB.x0 + 9 + i * ((SJB.x1 - SJB.x0 - 18) / 9), z: SJB.z + (i % 2 ? 3.6 : -3.6) })); let got = 0;
      const next = () => (flags.length ? c.goal(`Ribbon flags ${got}/10`, c.nearest(flags)) : c.goal('Bring the flags to the park stage', c.def.at));
      flags.slice().forEach((p, i) => c.pickup('f' + i, { x: p.x, z: p.z, kind: 'flag', color: cols[i % 5], onCollect: () => { flags.splice(flags.indexOf(p), 1); got++; next(); } }));
      c.zone('stage', { x: c.def.at.x, z: c.def.at.z, r: 5.5 }, () => { if (!flags.length) c.win(); });
      c.poll(1, next); next();
    } },

  { id: 'walk', n: 15, name: 'Three-Dog Walk', place: 'Forest Park, Wildwood Trail', at: { x: -160, z: 271, yaw: Math.PI / 2 }, giver: { name: 'Dog-walker Suki', look: { shirt: 0x4f9a94 } },
    story: 'Suki has three dogs and two hands. Lead Waffle, Domino and Fig along the Wildwood Trail. Walk steadily: leads tangle when anyone rushes.',
    steps: ['Lead the three dogs along the Wildwood Trail', 'If the leads tangle, sit to sort them out', 'Hand the dogs over at the far gate'], reward: 140, again: 70,
    canStart(game) { return game.followers.list().length > 1 ? 'Three leads are all KC can manage with two buddies along. Come back with one buddy, or none.' : null; },
    run(c) {
      const { game } = c, kc = game.kc, pts = [[-196, 296], [-232, 300], [-250, 330], [-218, 356], [-240, 388]].map(([x, z]) => ({ x, z })), max0 = game.followers.max; let i = 0, tangled = false, rush = 0, scripted = false;
      game.followers.max = 4; c.track({ remove() { game.followers.max = max0; } });
      for (const [name, coat, belly, ear, s] of [['Waffle', 0xd9a866, 0xf4e6c8, 0xa8703f, 0.8], ['Domino', 0x2a2a2e, 0xf4f4f0, 0x1a1a1e, 1.05], ['Fig', 0x6a4a5a, 0xdcc8d0, 0x4a2a3a, 0.9]]) c.follower({ name, look: { coat, belly, ear, s } });
      c.npc('reed', { x: pts[4].x + 2, z: pts[4].z + 2, name: 'Reed', look: { shirt: 0x4f9a94, hat: 'cap' } });
      const aim = () => (tangled ? c.goal('Leads tangled! Sit down to sort them out', null, 'sit') : c.goal(`Wildwood Trail ${i}/${pts.length}`, pts[i]));
      const tangle = why => { tangled = true; rush = 0; game.audio.sfx('whistle'); c.say(why + ' Sit down and the leads sort themselves out.', { icon: 'sit', kind: 'warn', ms: 3200 }); aim(); };
      c.on('sit', () => { if (!tangled) return; tangled = false; c.say('All untangled. Off we go!', { icon: 'paw', kind: 'good', ms: 1600 }); aim(); });
      c.poll(0, dt => { if (tangled) return; rush = kc.sprinting ? rush + dt : Math.max(0, rush - dt * 0.5); if (rush > 2.5) return tangle('Too fast: the leads are in a knot.');
        if (dist(pts[i], kc.pos) < 4.5) { i++; game.audio.sfx('pickup'); c.puff(kc.pos.x, kc.pos.z); if (i >= pts.length) return c.win(); if (i === 2 && !scripted) { scripted = true; return tangle('Fig stopped to sniff and went round a tree.'); } aim(); } });
      aim();
    } },

  { id: 'carts', n: 16, name: 'Cart Runner', place: 'Portland food cart pod', at: { x: 282, z: 401, yaw: 0 }, giver: { name: 'Pod manager Lucía', look: { shirt: 0xe07a5a } },
    story: 'Four carts, four hot orders, four picnic tables. Get each one there while it is still steaming, and Lucía will count it as the first payment toward a treat cart of KC\'s own.',
    steps: ['Collect a hot order at the cart', 'Deliver it to the right table before it goes cold', 'Do all four'], reward: 160, again: 80,
    run(c) {
      const { game } = c, orders = [['Biscuit Wheel', 'biscuit stack', 2], ['Smoke & Stick', 'smoky skewer', 0], ['Noodle Tail', 'noodle bowl', 2], ['Pup Cup Creamery', 'pup cup', 1]], tables = [[285.4, 414], [285.4, 428], [280.6, 442]]; let i = 0, hot = false;
      const cartAt = n => game.place.cart(n, 3.2);
      const pick = () => { hot = false; const [cart, dish] = orders[i], p = cartAt(cart); c.goal(`Order ${i + 1}/4: collect the ${dish} at ${cart}`, p); };
      const carry = () => { hot = true; const [cart, dish, t] = orders[i], tb = { x: tables[t][0], z: tables[t][1] }; game.audio.sfx('pickup'); c.say(`Hot ${dish}! Table ${t + 1}, quick as you can.`, { icon: 'bolt', ms: 2000 }); c.note(`Order ${i + 1}/4: take the ${dish} to table ${t + 1}`);
        c.timed({ label: 'Hot order', seconds: 24, checkpoints: [{ ...tb, r: 3, label: `Table ${t + 1}` }], onFinish: r => { if (r.ok) { i++; c.say('Delivered, still steaming!', { icon: 'paw', kind: 'good', ms: 1500 }); if (i >= orders.length) return c.win(); pick(); } else if (r.reason === 'time') { c.say(`It went cold. ${cart} is making a fresh one: no charge.`, { icon: 'paw', ms: 3000 }); pick(); } } }); };
      c.poll(0.1, () => { if (!hot && dist(cartAt(orders[i][0]), game.kc.pos) < 3.2) carry(); });
      pick();
    },
    after(game) { if (!game.economy.getFlag('cartRunner')) { game.economy.setFlag('cartRunner', true); const eco = game.modules.economy, free = !!(eco && eco.level && eco.buyLevel && eco.level('biz:cart') < 1 && eco.buyLevel('biz:cart', { free: true }));
      game.toast(free ? 'Lucía hands over the keys: the Biscuit Cart at the food cart pod is yours. Empty its till when you pass by.' : 'Lucía chalks it up: you already run the Biscuit Cart, so she adds a round of thanks.', { icon: 'star', kind: 'gold', ms: 6000 }); } } }
];

/* the shuttle boat between North Marina and Sand Island (free for good once Island Shuttle is done) */
const FERRY = { marina: { x: -103, z: -349, yaw: Math.PI / 2, name: 'North Marina' }, island: { x: -57, z: -338, yaw: -Math.PI / 2, name: 'Sand Island' } };

/* ================= weekly trail tasks (and the daily sniff-outs, shown here) =================
   The three daily sniff-outs and their 2 gems belong to js/economy.js (spec 3.4): this module only shows them, so they are
   never paid twice and missions stay bones-only. The weekly trail tasks are made here, on the device, from the date; nothing
   is sent anywhere. There is no streak, so missing a day or a week loses nothing. */
const TASKS = {
  bones: { ev: 'boneCollected', w: [80, 120], text: n => `Sniff up ${n} loose bones` },
  dig: { ev: 'pickup', ok: e => e.kind === 'dig', w: [6, 8], text: n => `Dig up ${n} buried surprises` },
  talk: { ev: 'talk', w: [10, 14], text: n => `Say hello to ${n} people` },
  dog: { ev: 'dogPlay', w: [4, 5], text: n => `Play with town dogs ${n} times` },
  swim: { ev: 'swimStart', w: [4, 6], text: n => `Go for ${n} swims` },
  ride: { ev: 'vehicleEnter', w: [6, 8], text: n => `Take ${n} rides (board, canoe, van or tram)` },
  photo: { ev: 'photoTaken', w: [4, 5], text: n => `Take ${n} photos` },
  fetch: { ev: 'fetch', w: [8, 10], text: n => `Fetch the ball ${n} times` },
  job: { ev: 'missionComplete', w: [5, 7], text: n => `Finish ${n} missions or jobs` },
  explore: { ev: 'enterZone', ok: (e, t) => { if (!e.district || (t.seen || (t.seen = [])).includes(e.id)) return false; t.seen.push(e.id); return true; }, w: [8, 12], text: n => `Pass through ${n} different districts` }
};
const WEEKLY_PAY = { bones: 50, bonus: 50 };
export const JOB_WINDOW = 40 * 60, JOB_EXTRA = 0.1;   /* seconds of play between full pays for one job; what one extra run in between pays */
function seeded(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } let a = h >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const two = n => String(n).padStart(2, '0');
const weekKey = d => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()); t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7)); const y = t.getFullYear(), w1 = new Date(y, 0, 4); return `${y}-W${two(1 + Math.round(((t - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7))}`; };
function makeTasks(key) { const r = seeded('kc-trail-' + key), pool = Object.keys(TASKS), out = []; while (out.length < 3 && pool.length) { const type = pool.splice(Math.floor(r() * pool.length), 1)[0], [lo, hi] = TASKS[type].w; out.push({ type, n: lo + Math.floor(r() * (hi - lo + 1)), have: 0, done: false }); } return { key, tasks: out, paid: false }; }

export function init(game) {
  const { bus, kc, world, scene } = game, ui = game.ui, place = game.place;
  if (typeof document !== 'undefined' && !document.querySelector('link[data-kc-missions]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/missions.css'; l.setAttribute('data-kc-missions', '1'); document.head.appendChild(l); }
  const data = game.moduleData('missions', { done: {}, best: {}, paidAt: {}, extra: {}, clock: 0, bones: 0, runs: 0, weekly: null, way: null, ferry: false });
  delete data.paidDay; /* older saves: full pay used to follow the game day */
  delete data.daily; /* older saves: the daily sniff-outs moved to the economy module */
  for (const k of ['done', 'best']) if (!data[k] || typeof data[k] !== 'object') data[k] = {};
  const defs = [...MISSIONS, ...ACTIVITIES.map(a => ({ ...a, fest: true }))], byId = new Map(defs.map(d => [d.id, d])), givers = new Map();
  let active = null, now = () => new Date();
  const festOn = () => !!game.economy.getFlag('festival');
  const available = d => !d.fest || festOn();
  /* Mission pay is income, so ECON_SCALE (the price knob, spec 3.3) does not touch it: raising prices must not raise pay with them.
     What the next finish pays: the first-time reward once, then the job rate. A job pays in full once in every JOB_WINDOW
     seconds of play (counted on this module's own clock, so a nap or the device clock cannot bring it round sooner); in
     between, one extra run pays a tenth and any more pay a single bone. Measured before this rule: one 20-second job
     replayed back to back paid about 4,700 bones an hour. */
  if (!Number.isFinite(data.clock) || data.clock < 0) data.clock = 0;
  for (const k of ['paidAt', 'extra']) if (!data[k] || typeof data[k] !== 'object') data[k] = {};
  for (const k of Object.keys(data.paidAt)) if (!(Number.isFinite(data.paidAt[k]) && data.paidAt[k] <= data.clock)) delete data.paidAt[k];
  bus.on('tick', e => { if (e && e.dt > 0 && e.dt < 1) data.clock += e.dt; });
  const fullPay = d => !(d.id in data.paidAt) || data.clock - data.paidAt[d.id] >= JOB_WINDOW;
  const pay = d => { if (!data.done[d.id]) return Math.round(d.reward); if (fullPay(d)) return Math.max(1, Math.round(d.again)); return (data.extra[d.id] || 0) < 1 ? Math.max(1, Math.round(d.again * JOB_EXTRA)) : 1; };

  /* ---------- the mission context ---------- */
  function makeCtx(def) {
    const pre = 'ms:' + def.id + ':', offs = [], extras = [], timers = [], polls = []; let seq = 0;
    const own = o => { extras.push(o); return o; };
    const rawMesh = build => { const g = new Geo(); build(g); return new THREE.Mesh(g.build(), dogMaterial()); };
    const c = {
      game, def, pre, giver: givers.get(def.id) || null, t: 0, ended: false, step: def.steps[0], need: null, bonus: 0,
      on(type, fn) { const off = bus.on(type, e => { if (!c.ended) fn(e); }); offs.push(off); return off; },
      once(type, fn) { const off = c.on(type, e => { off(); fn(e); }); return off; },
      after(s, fn) { timers.push({ at: c.t + s, fn }); },
      poll(every, fn) { polls.push({ every, left: 0, fn }); },
      track: own,
      npc: (k, o) => place.npc({ ...o, id: pre + k }),
      pickup: (k, o) => place.pickup({ marker: { color: GOLD }, ...o, id: pre + k }),
      zone: (k, o, enter, exit) => place.zone({ ...o, id: pre + k }, enter, exit),
      marker: (k, o) => place.marker({ color: GOLD, ...o, id: pre + k }),
      prop: (kind, x, z, o = {}) => place.prop(kind, x, z, { ...o, id: pre + (o.id || 'p' + seq++) }),
      carriable: (k, o) => own(game.addCarriable({ ...o, id: pre + k })),
      rawMesh,
      /* a mesh of the mission's own, standing on the ground at x, z -> { mesh, remove() } */
      mesh(build, x, z, y) { const mesh = rawMesh(build); mesh.position.set(x, y ?? Math.max(place.groundY(x, z), 0), z); scene.add(mesh); let gone = false; return own({ mesh, remove() { if (gone) return; gone = true; scene.remove(mesh); mesh.geometry.dispose(); } }); },
      follower(o) { const h = game.followers.add(o); if (h) own({ remove: () => h.dismiss() }); return h; },
      mod(mods) { game.setModifier(pre + 'mod', mods); own({ remove: () => game.setModifier(pre + 'mod', null) }); },
      nearest(list) { let best = null, bd = 1e9; for (const p of list) { const d = dist(p, kc.pos); if (d < bd) { bd = d; best = p; } } return best; },
      puff(x, z, n = 10) { game.fx.burst('spark', x, Math.max(place.groundY(x, z), 0) + 1, z, n); },
      say(text, o = {}) { game.toast(text, { icon: 'paw', ...o }); },
      note(text) { c.step = text; },
      /* the step the player is on: journal text, HUD objective (with a pin when `at` is given) and what the step needs her to do */
      goal(label, at, need = null) { c.step = label; c.need = need; if (at && typeof at === 'object') { if (c.at === at && c.label === label) return; game.setObjective(at.getPos ? { getPos: at.getPos, label, color: GOLD } : { x: at.x, z: at.z, label, color: GOLD }); } else if (c.label !== label || c.at) game.setObjective({ label, progress: '' }); c.at = at || null; c.label = label; },
      timed(o) { return game.timedRun({ ...o, id: pre + 'run', onFinish: r => { if (c.ended) return; if (o.onFinish) o.onFinish(r); else if (!r.ok && r.reason === 'time') c.fail(o.failText); } }); },
      win(o) { finish(c, true, o || {}); },
      fail(text) { finish(c, false, { text }); },
      tick(dt) { c.t += dt; for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= c.t) { const t = timers.splice(i, 1)[0]; try { t.fn(); } catch (e) { console.error(e); } if (c.ended) return; }
        for (const p of polls) { p.left -= dt; if (p.left <= 0) { p.left = p.every; try { p.fn(dt); } catch (e) { console.error(e); } if (c.ended) return; } } },
      cleanup() { c.ended = true; for (const f of offs) f(); if (game.run && game.run.id === pre + 'run') game.run.cancel(); for (const x of extras.splice(0).reverse()) { try { x.remove(); } catch (e) { console.error(e); } } place.removeAll(pre); game.setObjective(null); ui.setTimer(null); }
    };
    return c;
  }

  /* ---------- givers: a person at the start of every mission, with a dot on the map ---------- */
  function mark(d) { game.addMarker({ id: 'msg:' + d.id, x: d.at.x, z: d.at.z, icon: 'flag', color: d.fest ? '#ff9a6a' : data.done[d.id] ? GREEN : GOLD, label: d.name, edge: false }); }
  function placeGiver(d) {
    if (givers.has(d.id)) return;
    const st = place.npc({ id: 'msg:' + d.id, x: d.at.x, z: d.at.z, yaw: d.at.yaw || 0, name: d.giver.name, look: d.giver.look, prompt: 'Talk to ' + d.giver.name, enabled: () => !active && !ui.fading, onInteract: () => offer(d) });
    givers.set(d.id, st); mark(d);
  }
  function dropGiver(d) { const st = givers.get(d.id); if (!st) return; st.remove(); givers.delete(d.id); game.api.removeMarker('msg:' + d.id); }
  function homeGiver(d) { const st = givers.get(d.id); if (!st) return; st.follow(false); st.target = null; st.x = d.at.x; st.z = d.at.z; st.yaw = st.yaw0 = d.at.yaw || 0; }
  function syncGivers() { for (const d of defs) if (available(d)) placeGiver(d); else { if (active && active.def === d) leave(true); dropGiver(d); } syncFestival(); }
  /* festival dressing this module owns: the craft stalls of the market */
  function syncFestival() { if (festOn()) { FEST_STALLS.forEach((s, i) => { if (!place.get('fest:stall:' + i)) place.stand({ id: 'fest:stall:' + i, kind: 'stall', x: s.x, z: s.z, ry: s.ry, name: s.name, col: s.col }); }); } else { place.removeAll('fest:'); } }

  /* ---------- start, finish, leave ---------- */
  const esc = ui.esc, el = ui.el;
  function card(d, extra = '') {
    const n = data.done[d.id] || 0, best = data.best[d.id];
    return `<p class="ms-where">${esc(d.fest ? 'Fog Bell Festival' : 'Mission ' + d.n + ' of 16')} · ${esc(d.place)}</p><p>${esc(d.story)}</p><ol class="ms-steps">${d.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` +
      `<p class="ms-pay">${n ? 'This run pays' : 'Reward'} ${ui.price({ bones: pay(d) + 0 })}${d.timed ? '<span class="ms-chip">Against the clock</span>' : ''}</p>` +
      (n ? `<p class="ms-small">Done ${n} time${n === 1 ? '' : 's'}${best ? ' · best ' + fmtBest(d, best) : ''}. A job pays in full once in every 40 minutes of play, and only a little for extra runs in between.</p>` : `<p class="ms-small">${d.timed ? 'If the clock wins, nothing is lost. You can go again straight away.' : 'No clock. Take all the time you like.'}</p>`) + extra;
  }
  const fmtBest = (d, v) => (d.score ? v + ' ' + d.score : Math.floor(v / 60) + ':' + two(Math.floor(v % 60)));
  function offer(d) {
    const why = d.canStart && d.canStart(game);
    game.openModal({ id: 'mission-offer', title: d.name, className: 'ms-offer', html: card(d, why ? `<p class="note warn">${esc(why)}</p>` : ''),
      actions: why ? [{ label: 'Okay' }] : [{ label: data.done[d.id] ? 'Play again' : "Let's go!", primary: true, onClick: () => start(d.id) }, { label: 'Later' }] });
  }
  function start(id, o = {}) {
    const d = byId.get(id); if (!d || !available(d)) return false;
    if (active) { if (!o.force) { game.toast(`Finish or set aside "${active.def.name}" first (Missions, in the pause menu).`, { icon: 'flag', kind: 'warn' }); return false; } leave(true); }
    const why = d.canStart && d.canStart(game); if (why) { game.toast(why, { icon: 'flag', kind: 'warn', ms: 4500 }); return false; }
    placeGiver(d); if (data.way) { data.way = null; }
    const c = makeCtx(d); active = c; c.prevBlocked = game.travel.blocked; game.travel.blocked = `Finish or set aside "${d.name}" first.`;
    game.setObjective(null);
    try { d.run(c); } catch (e) { console.error('[mission ' + id + ']', e); c.cleanup(); active = null; game.travel.blocked = c.prevBlocked || null; game.toast('That mission is being tidied up. Try another one.', { kind: 'warn' }); return false; }
    if (!c.ended) { game.banner(d.name, d.fest ? 'Festival activity' : 'Mission ' + d.n); bus.emit('missionStart', { id, name: d.name, festival: !!d.fest }); }
    return true;
  }
  function close(c) { c.cleanup(); if (active === c) active = null; game.travel.blocked = c.prevBlocked || null; homeGiver(c.def); }
  function finish(c, ok, o) {
    if (c.ended) return; const d = c.def; close(c);
    if (!ok) {
      bus.emit('missionFail', { id: d.id, name: d.name }); game.audio.sfx('ui');
      game.openModal({ id: 'mission-retry', title: 'So close!', className: 'ms-offer', html: `<p>${esc(o.text || d.failText || 'That one got away. Nothing is lost.')}</p><p class="ms-small">Nothing was taken away. Have another go now, or come back whenever you like.</p>`,
        actions: [{ label: 'Try again', primary: true, onClick: () => retry(d.id) }, { label: 'Later' }] });
      return;
    }
    const first = !data.done[d.id], bones = pay(d) + (first || fullPay(d) ? Math.max(0, Math.round(c.bonus || 0)) : 0), got = game.economy.grant({ bones }, (d.fest ? 'activity:' : 'mission:') + d.id);
    if (first || fullPay(d)) { data.paidAt[d.id] = data.clock; data.extra[d.id] = 0; } else data.extra[d.id] = (data.extra[d.id] || 0) + 1;
    data.done[d.id] = (data.done[d.id] || 0) + 1; data.bones += got.bones; data.runs++;
    const v = d.score ? o.score : o.time; if (Number.isFinite(v) && (data.best[d.id] == null || (d.score ? v > data.best[d.id] : v < data.best[d.id]))) data.best[d.id] = +(+v).toFixed(1);
    mark(d); game.audio.sfx('reward'); game.fx.burst('spark', kc.pos.x, kc.pos.y + 1.2, kc.pos.z, 22);
    game.banner(d.fest ? 'Well played!' : 'Mission complete', d.name); game.toast(`+${got.bones} bones: ${d.name}`, { icon: 'bone', kind: 'gold', ms: 3600 });
    if (d.after) try { d.after(game, data); } catch (e) { console.error(e); }
    bus.emit('missionComplete', { id: d.id, name: d.name, first, bones: got.bones, festival: !!d.fest, count: data.done[d.id] }); game.save.save();
  }
  function retry(id) { const d = byId.get(id); if (!d) return false; if (dist(d.at, kc.pos) < 12) return start(id); ui.fade(() => { kc.teleport(d.at.x + 1.6, d.at.z + 1.6, d.at.yaw); game.cam.yaw = d.at.yaw || 0; game.cam.snap(); start(id); }); return true; }
  function leave(quiet) { if (!active) return false; const d = active.def; close(active); bus.emit('missionLeave', { id: d.id }); if (!quiet) game.toast(`"${d.name}" set aside. ${d.giver.name} will be waiting.`, { icon: 'flag' }); return true; }
  bus.on('tick', e => { if (active) active.tick(e.dt); });

  /* ---------- "show me the way" ---------- */
  function showWay(id) { const d = byId.get(id); if (!d || !available(d)) return false; if (active) { reAim(); return true; } data.way = id; game.setObjective({ x: d.at.x, z: d.at.z, label: 'To ' + d.giver.name + ': ' + d.name, color: BLUE }); game.toast('The way to ' + d.name + ' is on the compass and the map.', { icon: 'map' }); return true; }
  function reAim() { if (!active) return; const c = active; if (game.run && game.run.total) return; const at = c.at, label = c.label; c.at = undefined; c.label = undefined; if (label) c.goal(label, at, c.need); }
  bus.on('second', () => { if (!data.way || active) return; const d = byId.get(data.way); if (!d || !available(d) || dist(d.at, kc.pos) < 2.6) { data.way = null; if (!active) game.setObjective(null); } else if (!game.api.objective) game.setObjective({ x: d.at.x, z: d.at.z, label: 'To ' + d.giver.name + ': ' + d.name, color: BLUE }); });

  /* ---------- the shuttle boat ---------- */
  const ferryOk = to => data.ferry || (active && active.def.id === 'shuttle' && (to === 'marina' || kc.carried.some(i => i.id === 'ms:shuttle:bag')));
  /* after a crossing KC stands on the return marker: it stays quiet until she has walked off it, so a habit tap does not send her straight back */
  let landed = null; bus.on('tick', () => { if (landed && dist(FERRY[landed], kc.pos) > 5) landed = null; });
  function ferry(to) { const p = FERRY[to]; if (!p || ui.fading) return false; game.audio.sfx('splash'); ui.fade(() => { kc.teleport(p.x, p.z, p.yaw); game.cam.yaw = p.yaw; game.cam.snap(); for (const f of game.npcs.followers) { f.x = kc.pos.x - 1.2; f.z = kc.pos.z - 1.2; } game.toast('The shuttle puts in at ' + p.name + '.', { icon: 'flag' }); landed = to; bus.emit('ferry', { to }); }); return true; }
  for (const [from, to] of [['marina', 'island'], ['island', 'marina']]) place.marker({ id: 'ferry:' + from, x: FERRY[from].x, z: FERRY[from].z, label: 'Shuttle boat', icon: 'flag', color: BLUE, prompt: 'Ride the shuttle to ' + FERRY[to].name, r: 3, prio: 4, enabled: () => ferryOk(to) && !kc.ride && landed !== from, onInteract: () => ferry(to) });

  /* ---------- trail tasks ---------- */
  function ensureTasks() { const wk = weekKey(now()); if (data.weekly && data.weekly.key === wk && Array.isArray(data.weekly.tasks)) return false; data.weekly = makeTasks(wk); return true; }
  const taskText = t => { const T = TASKS[t.type]; return T ? T.text(t.n, t) : 'A trail task'; };
  /* the daily sniff-outs live in the economy module: { date, goals: [{ text, need, have, done }], done, paid, gems } or null */
  const sniffOuts = () => { const e = game.modules.economy; try { const d = e && typeof e.daily === 'function' ? e.daily() : null; return d && Array.isArray(d.goals) ? d : null; } catch (err) { return null; } };
  function bump(type, e) {
    const set = data.weekly; if (!set) return;
    for (const t of set.tasks) { const T = TASKS[t.type]; if (!T || T.ev !== type || t.done || (T.ok && !T.ok(e, t))) continue; t.have = Math.min(t.n, t.have + 1); if (t.have < t.n) continue; t.done = true;
      const got = game.economy.grant({ bones: WEEKLY_PAY.bones }, 'weekly');
      game.toast(`Trail task done: ${taskText(t)}  +${got.bones} bones`, { icon: 'paw', kind: 'good', ms: 3600 }); game.audio.sfx('reward'); bus.emit('taskDone', { span: 'weekly', type: t.type, bones: got.bones }); }
    if (!set.paid && set.tasks.length && set.tasks.every(t => t.done)) { set.paid = true; const got = game.economy.grant({ bones: WEEKLY_PAY.bonus }, 'weekly:all');
      game.toast(`All three trail tasks done this week!  +${got.bones} bones`, { icon: 'bone', kind: 'gold', ms: 4200 }); bus.emit('tasksAllDone', { span: 'weekly', ...got }); }
  }
  ensureTasks(); let taskT = 0; bus.on('second', () => { if (++taskT >= 30) { taskT = 0; ensureTasks(); } });
  for (const type of new Set(Object.values(TASKS).map(t => t.ev))) bus.on(type, e => bump(type, e || {}));

  /* ---------- the Missions screen ---------- */
  let tab = 'missions';
  function row(d) {
    const n = data.done[d.id] || 0, on = active && active.def === d;
    const it = ui.item({ id: 'ms-' + d.id, title: (d.fest ? '' : d.n + '. ') + d.name, icon: on ? 'bolt' : n ? 'star' : 'flag', tag: on ? 'Now' : n ? 'Done ×' + n : 'New', on,
      text: on ? active.step : d.place + '. ' + d.story, price: { bones: pay(d) }, button: { label: on ? 'Show the next step' : 'Show me the way', primary: on || !n, onClick: () => { showWay(d.id); game.closeModal('missions'); } } });
    if (on) { const b = el('button', { type: 'button', class: 'btn alt ms-aside' }); b.textContent = 'Set aside'; b.addEventListener('click', () => { leave(); redraw(); }); it.querySelector('.side').appendChild(b); }
    return it;
  }
  function paneMissions(p, fest) {
    const list = defs.filter(d => !!d.fest === fest), todo = list.filter(d => !data.done[d.id]), done = list.filter(d => data.done[d.id]);
    if (fest && !festOn()) { p.appendChild(ui.note('The Fog Bell Festival is not on at the moment. When the lanterns go up on the plaza, eight festival activities open here. Nothing is missed while it is away.')); return; }
    if (active && !!active.def.fest === fest) { p.appendChild(ui.heading('Now playing', active.def.giver.name + ' is counting on KC')); p.appendChild(ui.grid([row(active.def)])); }
    if (todo.filter(d => !active || active.def !== d).length) { p.appendChild(ui.heading(fest ? 'Festival activities' : 'To do', fest ? 'On the plaza and around old town' : 'Find the giver on the map, or let the compass show the way')); p.appendChild(ui.grid(todo.filter(d => !active || active.def !== d).map(row))); }
    if (done.filter(d => !active || active.def !== d).length) { p.appendChild(ui.heading('Done: play again as a job', `${done.length} of ${list.length} finished`)); p.appendChild(ui.grid(done.filter(d => !active || active.def !== d).map(row))); }
    p.appendChild(ui.note('Missions pay bones, and bones only ever come from playing. A job pays in full once in every 40 minutes of play and only a little for extra runs in between.'));
  }
  function paneTasks(p) {
    ensureTasks();
    const block = (rows, head, sub, each, note, good) => { p.appendChild(ui.heading(head, sub)); const box = el('div', { class: 'ms-tasks' });
      for (const t of rows) { const r = el('div', { class: 'ms-task' + (t.done ? ' done' : '') }); const b = el('b'); b.textContent = t.text; r.appendChild(b); r.appendChild(ui.progress(t.have, t.n, t.done ? 'Done' : `${t.have} of ${t.n}`)); if (each) r.appendChild(el('span', { class: 'ms-taskpay' }, each)); box.appendChild(r); }
      p.appendChild(box); p.appendChild(ui.note(note, good ? 'good' : '')); };
    const so = sniffOuts(), w = data.weekly;
    if (so) block(so.goals.map(g => ({ text: g.text, have: g.have, n: g.need, done: g.done })), "Today's sniff-outs", 'Three little things to do, new each day', '', so.paid ? `All three done: ${so.gems} gems are in the pouch. Three new ones tomorrow.` : `Do all three for ${so.gems} gems. New ones come tomorrow either way.`, so.paid);
    block(w.tasks.map(t => ({ text: taskText(t), have: t.have, n: t.n, done: t.done })), "This week's trail tasks", 'Three bigger ones, new each Monday', ui.price({ bones: WEEKLY_PAY.bones }), w.paid ? 'All three done. The bonus bones are in the pouch. Three new ones on Monday.' : `Do all three for ${WEEKLY_PAY.bonus} bones more. Skip a week whenever you like.`, w.paid);
    p.appendChild(ui.note('Trail tasks never pile up and there is no streak to keep. Miss a day or a week and nothing is lost.'));
  }
  let handle = null; const redraw = () => { if (handle && ui.current && ui.current.id === 'missions') handle.refresh(); };
  function open(which) {
    const board = which === 'board'; if (board) tab = 'missions'; else if (which) tab = which;
    handle = game.openModal({ id: 'missions', title: board ? 'Planning board' : 'Missions', wide: true, wallet: true, className: 'ms-journal', render(body) {
      const st = stats(), tabs = [{ id: 'missions', title: 'Missions', icon: 'flag', badge: () => (st.total - st.done) || '', render: p => paneMissions(p, false) }];
      if (festOn()) tabs.push({ id: 'festival', title: 'Festival', icon: 'star', badge: () => defs.filter(d => d.fest && !data.done[d.id]).length || '', render: p => paneMissions(p, true) });
      tabs.push({ id: 'tasks', title: 'Trail tasks', icon: 'paw', badge: () => { const so = sniffOuts(); return (data.weekly.tasks.filter(t => !t.done).length + (so ? so.goals.filter(g => !g.done).length : 0)) || ''; }, render: paneTasks });
      ui.tabs(body, tabs, { current: tabs.some(t => t.id === tab) ? tab : 'missions', onChange: id => { tab = id; } });
    } });
    return handle;
  }
  ui.addMenuItem({ id: 'missions', label: 'Missions', icon: 'flag', order: 20, onSelect: () => open() });

  /* ---------- boot ---------- */
  function stats() { const story = defs.filter(d => !d.fest); return { total: story.length, done: story.filter(d => data.done[d.id]).length, festivalTotal: defs.length - story.length, festivalDone: defs.filter(d => d.fest && data.done[d.id]).length, runs: data.runs, bones: data.bones }; }
  syncGivers(); bus.on('flag', e => { if (e.key === 'festival') { syncGivers(); redraw(); } });
  if (data.way && byId.has(data.way)) { const d = byId.get(data.way); if (available(d)) game.setObjective({ x: d.at.x, z: d.at.z, label: 'To ' + d.giver.name + ': ' + d.name, color: BLUE }); else data.way = null; }

  return {
    /* every mission and activity: [{ id, n, name, place, festival, timed, x, z, giver, reward, again, pays, done, best, available, active }] */
    list: () => defs.map(d => ({ id: d.id, n: d.n, name: d.name, place: d.place, festival: !!d.fest, timed: !!d.timed, x: d.at.x, z: d.at.z, giver: d.giver.name, reward: d.reward, again: d.again, pays: pay(d), done: data.done[d.id] || 0, best: data.best[d.id] ?? null, available: available(d), active: !!active && active.def === d })),
    get: id => { const d = byId.get(id); return d ? { ...d } : null; },
    start, retry, leave, open, showWay, ferry, stats,
    /* the mission in progress: { id, name, step, need, target: { x, z } | null } or null */
    active() { if (!active) return null; const o = game.api.objective, p = o && (o.getPos ? o.getPos() : o); return { id: active.def.id, name: active.def.name, step: active.step, need: active.need, target: p && Number.isFinite(p.x) ? { x: p.x, z: p.z } : null, time: active.t, drive: active.drive ? active.drive() : null }; },
    isDone: id => !!data.done[id], count: id => data.done[id] || 0,
    /* debug only (window.__ot.completeMission): finish the mission in progress as a win */
    complete() { if (!active) return false; active.win(); return true; },
    fail(text) { if (!active) return false; active.fail(text); return true; },
    /* daily: the economy module's sniff-outs (or null); weekly: { key, paid, tasks: [{ type, n, have, done, text }] } */
    tasks: () => { ensureTasks(); return { daily: sniffOuts(), weekly: { ...data.weekly, tasks: data.weekly.tasks.map(t => ({ ...t, text: taskText(t) })) } }; },
    /* tests: pretend it is another week */
    _setClock(fn) { now = fn || (() => new Date()); ensureTasks(); },
    FERRY, data
  };
}
