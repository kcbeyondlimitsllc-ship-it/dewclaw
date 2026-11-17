/* Content check: node tests/content-check.js
   Generates many questions for every activity and level and checks each one has exactly one right
   answer, no duplicate choices, countable groups and a single valid pattern continuation. */
"use strict";
const path = require("path");
const C = require(path.join(__dirname, "..", "www", "content.js"));
const A = require(path.join(__dirname, "..", "www", "art.js"));
let fail = 0, total = 0;
const seen = {}, perAct = {};
function err(m) { fail++; if (fail <= 30) console.log("FAIL " + m); }

/* static tables */
if (C.ALPHABET.length !== 26) err("alphabet is not 26 letters");
const visKeys = {};
C.ALPHABET.forEach(L => {
  const e = C.LETTERS[L];
  if (!e) return err("no entry for letter " + L);
  if (e.starts[0] !== L) err(L + ": starts[] must begin with the letter itself");
  if (e.word[0] !== L) err(L + ": word '" + e.word + "' does not start with " + L);
  const k = JSON.stringify(e.vis); if (visKeys[k]) err(L + " shares a picture with " + visKeys[k]); visKeys[k] = L;
  if (e.vis.k === "pic" && !A.P[e.vis.id]) err(L + ": picture '" + e.vis.id + "' is not drawn in art.js");
});
[].concat(C.COUNT_THINGS, C.PATTERN_THINGS, C.MEMORY_ANIMALS, C.COMPARE_THINGS, ["treat", "bowl", "paw", "basket"]).forEach(id => { if (!A.P[id]) err("picture '" + id + "' is not drawn in art.js"); if (!C.NAMES[id] && ["bowl", "paw", "basket"].indexOf(id) < 0) err("picture '" + id + "' has no spoken name"); });
if (A.STICKERS.length < 24) err("fewer than 24 stickers");
if (new Set(A.STICKERS.map(s => s[0])).size !== A.STICKERS.length) err("duplicate sticker ids");
A.STICKERS.forEach(s => { if (!A.P[s[0]]) err("sticker '" + s[0] + "' is not drawn"); });
C.COLOR_NAMES.forEach(c => { if (!A.COLORS[c]) err("colour " + c + " has no paint"); });
C.SHAPE_NAMES.forEach(s => { if (!A.SHAPES[s]) err("shape " + s + " is not drawn"); });

/* generated questions */
const ROUNDS = 140;                      /* per level: 140 rounds x 5 questions x 3 levels = 2100 per activity */
C.ACTIVITIES.forEach(act => {
  perAct[act] = 0; const letterSeen = new Set(), kinds = {};
  for (let level = 1; level <= 3; level++) {
    const rng = C.seeded(1000 * level + act.length * 77 + act.charCodeAt(0));
    for (let r = 0; r < ROUNDS; r++) {
      const opts = act === "letters" ? { letters: C.shuffle(rng, C.ALPHABET).slice(0, 5) } : {};
      const qs = C.makeRound(act, level, rng, opts);
      if (act !== "memory" && qs.length !== 5) err(act + " L" + level + ": round has " + qs.length + " questions");
      qs.forEach(q => {
        total++; perAct[act]++; kinds[q.kind] = (kinds[q.kind] || 0) + 1;
        C.validate(q).forEach(e => err("L" + level + " " + e));
        if (q.options.length) {
          const keys = q.options.map(o => C.keyOf(o.vis));
          if (new Set(keys).size !== keys.length) err(act + ": duplicate options");
          if (!(q.correct >= 0 && q.correct < q.options.length)) err(act + ": correct index out of range");
        }
        if (act === "letters") letterSeen.add(q.meta.L);
        if (q.prompt && q.prompt.k === "group" && (q.prompt.n < 1 || q.prompt.n > 10)) err(act + ": group of " + q.prompt.n);
      });
    }
  }
  if (act === "letters" && letterSeen.size !== 26) err("letters: only " + letterSeen.size + " letters were ever asked");
  seen[act] = kinds;
});
/* every letter must have enough fair wrong pictures and wrong letters to fill four choices */
C.ALPHABET.forEach(L => {
  const rng = C.seeded(L.charCodeAt(0));
  for (let i = 0; i < 40; i++) [1, 2, 3].forEach(level => {
    const q = C.makeRound("letters", level, rng, { letters: [L, L, L, L, L] });
    q.forEach(x => { total++; perAct.letters++; if (x.options.some(o => !o.vis)) err("letter " + L + ": ran out of fair choices"); C.validate(x).forEach(e => err(L + " " + e)); });
  });
});
C.ACTIVITIES.forEach(a => { console.log(a.padEnd(9) + String(perAct[a]).padStart(6) + " questions  " + JSON.stringify(seen[a])); if (perAct[a] < 300) err(a + ": fewer than 300 questions generated"); });
console.log(total + " questions checked, " + fail + " failures");
process.exit(fail ? 1 : 0);
