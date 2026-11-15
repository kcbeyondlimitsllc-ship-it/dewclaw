/* KC's Learning Trail - learning content.
   Pure data and question generators: no DOM, no network. Runs in the browser and in Node
   (tests/content-check.js). To add content, edit the tables below; see README.md.

   A question looks like:
     { act, kind, prompt: <visual>, say, hint, done, options: [{ vis: <visual>, name }], correct: <index>, meta }
   A <visual> is a small description such as { k: "pic", id: "ball" } that app.js turns into SVG.
   validate(question) re-derives the right answer from `meta` and checks there is exactly one. */
(function (root) {
  "use strict";

  /* ---------- random helpers (rng is any function returning 0..1) ---------- */
  function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function shuffle(rng, arr) { var a = arr.slice(), i, j, t; for (i = a.length - 1; i > 0; i--) { j = Math.floor(rng() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function sample(rng, arr, n) { return shuffle(rng, arr).slice(0, n); }
  function seeded(seed) { var s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function keyOf(v) { return JSON.stringify(v); }

  var ACTIVITIES = ["count", "letters", "colors", "patterns", "memory", "compare"];
  var NUM_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

  /* ---------- names for pictures (used for speech only) ---------- */
  var NAMES = {
    ball: ["ball", "balls"], cone: ["pine cone", "pine cones"], duck: ["duck", "ducks"], treat: ["treat", "treats"],
    mushroom: ["mushroom", "mushrooms"], acorn: ["acorn", "acorns"], pine: ["tree", "trees"], frog: ["frog", "frogs"],
    starfish: ["sea star", "sea stars"], crab: ["crab", "crabs"], salmon: ["fish", "fish"], owl: ["owl", "owls"], orca: ["orca", "orcas"],
    heron: ["heron", "herons"], bear: ["bear", "bears"], fox: ["fox", "foxes"], elk: ["elk", "elk"], slug: ["slug", "slugs"], squirrel: ["squirrel", "squirrels"]
  };
  function nm(id, n) { var e = NAMES[id]; return e ? e[n === 1 ? 0 : 1] : id; }

  /* ---------- 1. counting ---------- */
  var COUNT_THINGS = ["ball", "cone", "duck"];

  /* ---------- 2. letters ----------
     One picture per letter. `starts` lists every first letter a child could reasonably say for that
     picture (its real one first). A picture is never offered as a wrong choice for any letter in its
     `starts`, nor for a letter that sounds the same (CLASH), so there is always exactly one right answer.
     `say` is the letter name spelled so a speech engine reads it properly; `snd` is its sound when a
     speech engine can say it reliably (left out otherwise - the word carries the sound instead). */
  var LETTERS = {
    a: { word: "apple", vis: { k: "emo", ch: "🍎" }, starts: ["a"], say: "ay" },
    b: { word: "ball", vis: { k: "pic", id: "ball" }, starts: ["b"], say: "bee", snd: "buh" },
    c: { word: "car", vis: { k: "emo", ch: "🚗" }, starts: ["c", "k"], say: "see", snd: "kuh" },
    d: { word: "donut", vis: { k: "emo", ch: "🍩" }, starts: ["d"], say: "dee", snd: "duh" },
    e: { word: "egg", vis: { k: "emo", ch: "🥚" }, starts: ["e"], say: "ee" },
    f: { word: "fish", vis: { k: "emo", ch: "🐟" }, starts: ["f"], say: "eff" },
    g: { word: "grapes", vis: { k: "emo", ch: "🍇" }, starts: ["g"], say: "jee", snd: "guh" },
    h: { word: "house", vis: { k: "emo", ch: "🏠" }, starts: ["h"], say: "aitch", snd: "huh" },
    i: { word: "ice cream", vis: { k: "emo", ch: "🍦" }, starts: ["i"], say: "eye" },
    j: { word: "jam", vis: { k: "pic", id: "jar" }, starts: ["j"], say: "jay", snd: "juh" },
    k: { word: "key", vis: { k: "emo", ch: "🔑" }, starts: ["k", "c"], say: "kay", snd: "kuh" },
    l: { word: "lemon", vis: { k: "emo", ch: "🍋" }, starts: ["l"], say: "el" },
    m: { word: "moon", vis: { k: "emo", ch: "🌙" }, starts: ["m"], say: "em" },
    n: { word: "nose", vis: { k: "emo", ch: "👃" }, starts: ["n"], say: "en" },
    o: { word: "octopus", vis: { k: "emo", ch: "🐙" }, starts: ["o"], say: "oh" },
    p: { word: "pizza", vis: { k: "emo", ch: "🍕" }, starts: ["p"], say: "pee", snd: "puh" },
    q: { word: "queen", vis: { k: "emo", ch: "👸" }, starts: ["q", "p", "k", "c", "g", "l"], say: "cue", snd: "kwuh" },
    r: { word: "rainbow", vis: { k: "emo", ch: "🌈" }, starts: ["r"], say: "ar" },
    s: { word: "sun", vis: { k: "emo", ch: "🌞" }, starts: ["s"], say: "ess" },
    t: { word: "turtle", vis: { k: "emo", ch: "🐢" }, starts: ["t"], say: "tee", snd: "tuh" },
    u: { word: "umbrella", vis: { k: "emo", ch: "☔" }, starts: ["u", "r"], say: "you" },
    v: { word: "volcano", vis: { k: "emo", ch: "🌋" }, starts: ["v", "m"], say: "vee" },
    w: { word: "watermelon", vis: { k: "emo", ch: "🍉" }, starts: ["w", "m"], say: "double you", snd: "wuh" },
    x: { word: "x-ray", vis: { k: "pic", id: "xray" }, starts: ["x", "e", "h", "b"], say: "ex" },   /* "x-ray" begins with the letter's own name (a xylophone begins with a Z sound); a child might also call the picture a hand or bones */
    y: { word: "yo-yo", vis: { k: "pic", id: "yoyo" }, starts: ["y"], say: "why", snd: "yuh" },
    z: { word: "zebra", vis: { k: "emo", ch: "🦓" }, starts: ["z", "x", "h"], say: "zee" }
  };
  var ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");
  /* letters whose sounds a young child cannot tell apart: never shown against each other */
  var CLASH = { c: ["k", "q"], k: ["c", "q"], q: ["k", "c"], x: ["z", "s"], z: ["x", "s"], s: ["z", "x", "c"] };
  /* pairs that are fair but tricky (look or sound close): kept out of level 1 only */
  var TRICKY = { b: ["p", "d"], p: ["b", "q"], d: ["b", "t"], t: ["d"], f: ["v"], v: ["f"], m: ["n"], n: ["m"], g: ["k", "c", "j"], j: ["g"], e: ["i", "a"], i: ["e"], a: ["e"], o: ["u"], u: ["o"] };
  /* A letter's NAME can begin with another letter's sound ("em" begins like egg, "double you" like donut).
     When the answer is the key letter, pictures starting with any letter listed here are never offered as
     wrong choices, so a child going by the sound of the spoken letter name is not led astray. */
  var NAME_SOUND = { f: ["e"], l: ["e"], m: ["e"], n: ["e"], s: ["e"], x: ["e"], r: ["a"], h: ["a"], u: ["y"], y: ["w"], w: ["d"], g: ["j"], j: ["g"], c: ["s"], q: ["k", "c"] };
  function clashes(a, b) { return a === b || (CLASH[a] || []).indexOf(b) >= 0 || (CLASH[b] || []).indexOf(a) >= 0; }
  /* may the picture for letter `d` be shown as a wrong choice when the answer is letter `L`? */
  function pictureIsFairDistractor(L, d) {
    var st = LETTERS[d].starts, i;
    for (i = 0; i < st.length; i++) if (clashes(L, st[i]) || (NAME_SOUND[L] || []).indexOf(st[i]) >= 0) return false;
    return true;
  }
  /* may letter `d` be shown as a wrong choice for the picture of letter `L`? */
  function letterIsFairDistractor(L, d) {
    var st = LETTERS[L].starts, i;
    for (i = 0; i < st.length; i++) if (clashes(d, st[i])) return false;
    return true;
  }

  /* ---------- 3. colours and shapes ---------- */
  var COLOR_NAMES = ["red", "blue", "yellow", "green", "purple"];
  var SHAPE_NAMES = ["circle", "square", "triangle", "star", "heart"];
  /* ---------- 4. patterns ---------- */
  var PATTERN_THINGS = ["ball", "cone", "duck", "mushroom", "acorn", "pine", "frog", "starfish", "crab", "salmon"];
  var PATTERN_UNITS = { 1: ["AB"], 2: ["AAB", "ABB", "AB"], 3: ["ABC", "AAB", "ABB", "ABC"] };
  /* ---------- 5. memory ---------- */
  var MEMORY_ANIMALS = ["salmon", "owl", "frog", "orca", "heron", "bear", "fox", "crab", "elk", "slug", "duck", "squirrel"];
  var MEMORY_BOARDS = { 1: [[2, 2], [3, 2]], 2: [[3, 2], [4, 2]], 3: [[4, 3]] };   /* [columns, rows] in landscape */
  /* ---------- 6. comparing ---------- */
  var COMPARE_THINGS = ["ball", "cone", "duck", "mushroom", "acorn", "pine", "frog", "salmon"];

  /* ================= generators ================= */
  function qCount(rng, level, avoid) {
    var lo = level === 3 ? 4 : 1, hi = level === 1 ? 5 : 10, n, id = pick(rng, COUNT_THINGS), nOpt = level === 3 ? 4 : 3, opts, c, guard = 0;
    do { n = ri(rng, lo, hi); } while (avoid && avoid.indexOf(n) >= 0 && ++guard < 40);
    opts = [n];
    while (opts.length < nOpt) {
      c = level === 1 ? ri(rng, 1, 5) : level === 2 ? n + ri(rng, -2, 2) : n + ri(rng, -3, 3);
      if (c >= 1 && c <= 10 && opts.indexOf(c) < 0) opts.push(c);
    }
    opts = shuffle(rng, opts);
    return {
      act: "count", kind: "count", tag: n,
      prompt: { k: "group", item: { k: "pic", id: id }, n: n, jitter: level === 3 ? ri(rng, 1, 9999) : 0 },
      say: "How many " + nm(id, 2) + "? Count them, then tap the number.",
      hint: "Let's count. Tap each " + nm(id, 1) + " to count it.",
      done: NUM_WORDS[n] + "! " + NUM_WORDS[n] + " " + nm(id, n) + ".",
      options: opts.map(function (v) { return { vis: { k: "num", n: v }, name: NUM_WORDS[v] }; }),
      correct: opts.indexOf(n), meta: { type: "count", n: n }
    };
  }
  function qGive(rng, level, avoid) {
    var n, guard = 0, tray;
    do { n = level === 3 ? ri(rng, 3, 10) : ri(rng, 1, 5); } while (avoid && avoid.indexOf(n) >= 0 && ++guard < 40);
    tray = Math.min(10, n + ri(rng, 2, 3));
    return {
      act: "count", kind: "give", tag: "g" + n, target: n, tray: Math.max(tray, n),
      prompt: { k: "num", n: n },
      say: "Give KC " + NUM_WORDS[n] + " " + nm("treat", n) + ". Tap the treats, then tap the green button.",
      hint: "KC wants " + NUM_WORDS[n] + ". Count the treats in her bowl.",
      done: NUM_WORDS[n] + " " + nm("treat", n) + ". Yum!",
      options: [], correct: -1, meta: { type: "give", n: n }
    };
  }
  function listWords(w) { return w.slice(0, -1).join(", ") + ", or " + w[w.length - 1] + "?"; }
  function qLetter(rng, level, L, reverse) {
    var e = LETTERS[L], nOpt = level === 3 ? 4 : 3, pool, ds, opts, nameL = e.say;
    if (reverse) {
      pool = ALPHABET.filter(function (d) { return letterIsFairDistractor(L, d); });
      ds = sample(rng, pool, nOpt - 1);
      opts = shuffle(rng, [L].concat(ds));
      return {
        act: "letters", kind: "pic2letter", tag: L, prompt: e.vis,
        say: "This is " + e.word + ". Which letter does " + e.word + " start with?",
        hint: e.word + " starts with " + nameL + ".",
        done: "Yes! " + e.word + " starts with " + nameL + ".",
        options: opts.map(function (d) { return { vis: { k: "letter", L: d }, name: LETTERS[d].say }; }),
        correct: opts.indexOf(L), meta: { type: "pic2letter", L: L }
      };
    }
    pool = ALPHABET.filter(function (d) {
      if (!pictureIsFairDistractor(L, d)) return false;
      if (level === 1 && ((TRICKY[L] || []).indexOf(d) >= 0 || (TRICKY[d] || []).indexOf(L) >= 0)) return false;
      return true;
    });
    ds = sample(rng, pool, nOpt - 1);
    opts = shuffle(rng, [L].concat(ds));
    return {
      act: "letters", kind: "letter2pic", tag: L, prompt: { k: "letter", L: L },
      /* from level 2 the pictures are named aloud in the order shown, so the task is hearing the first sound */
      say: level === 1
        ? "This is the letter " + nameL + ". " + nameL + " is for " + e.word + ". Tap the " + e.word + "."
        : "This is the letter " + nameL + "." + (e.snd ? " " + nameL + " says " + e.snd + "." : "") + " Which one starts with " + nameL + "? " + listWords(opts.map(function (d) { return LETTERS[d].word; })),
      hint: nameL + " is for " + e.word + ".",
      done: "Yes! " + nameL + " is for " + e.word + ".",
      options: opts.map(function (d) { return { vis: LETTERS[d].vis, name: LETTERS[d].word, letter: d }; }),
      correct: opts.indexOf(L), meta: { type: "letter2pic", L: L }
    };
  }
  function qColor(rng, level, kind) {
    var color = pick(rng, COLOR_NAMES), shape = pick(rng, SHAPE_NAMES), opts, items, i, oc, os, bins, nOpt;
    function sh(c, s) { return { k: "shape", shape: s, color: c }; }
    function others(arr, x, n) { return sample(rng, arr.filter(function (v) { return v !== x; }), n); }
    if (kind === "color") {            /* same shape, different colours */
      items = [color].concat(others(COLOR_NAMES, color, 2)).map(function (c) { return sh(c, shape); });
      return finish({ k: "blob", color: color }, "Tap the " + color + " one.", "Look for " + color + ".", "Yes! That one is " + color + ".", { color: color });
    }
    if (kind === "shape") {            /* same colour, different shapes */
      items = [shape].concat(others(SHAPE_NAMES, shape, 2)).map(function (s) { return sh(color, s); });
      return finish({ k: "outline", shape: shape }, "Tap the " + shape + ".", "Look for the " + shape + ".", "Yes! That is a " + shape + ".", { shape: shape });
    }
    if (kind === "both") {             /* the red triangle among near misses */
      nOpt = level === 3 ? 6 : 4;
      oc = others(COLOR_NAMES, color, 2); os = others(SHAPE_NAMES, shape, 2);
      items = [sh(color, shape), sh(color, os[0]), sh(oc[0], shape), sh(oc[0], os[0])];
      if (nOpt === 6) items.push(sh(color, os[1]), sh(oc[1], shape));
      return finish(sh(color, shape), "Tap the " + color + " " + shape + ".", "Find one that is " + color + " and a " + shape + ".", "Yes! The " + color + " " + shape + ".", { color: color, shape: shape });
    }
    /* sorting: one thing, two or three baskets */
    nOpt = level === 3 ? 3 : 2;
    if (kind === "sortColor") {
      bins = [color].concat(others(COLOR_NAMES, color, nOpt - 1));
      items = bins.map(function (c) { return { k: "bin", label: { k: "blob", color: c } }; });
      return finish(sh(color, shape), "Sort by color. Which basket does it go in?", "It is " + color + ". Find the " + color + " basket.", "Yes! " + color + " goes with " + color + ".", { binColor: color });
    }
    bins = [shape].concat(others(SHAPE_NAMES, shape, nOpt - 1));
    items = bins.map(function (s) { return { k: "bin", label: { k: "outline", shape: s } }; });
    return finish(sh(color, shape), "Sort by shape. Which basket does it go in?", "It is a " + shape + ". Find the " + shape + " basket.", "Yes! A " + shape + " goes with the " + shape + "s.", { binShape: shape });

    function finish(prompt, say, hint, done, want) {
      var right = items[0];
      opts = shuffle(rng, items);
      for (i = 0; i < opts.length; i++) if (opts[i] === right) break;
      return {
        act: "colors", kind: kind, tag: kind + color + shape, prompt: prompt, say: say, hint: hint, done: done,
        options: opts.map(function (v) { var s = v.k === "bin" ? v.label : v; return { vis: v, name: (s.color ? s.color + " " : "") + (s.shape || "") }; }),
        correct: i, meta: { type: "match", want: want }
      };
    }
  }
  function qPattern(rng, level) {
    var unit = pick(rng, PATTERN_UNITS[level]), kinds = unit.indexOf("C") >= 0 ? 3 : 2;
    var things = sample(rng, PATTERN_THINGS, kinds + 1), map = { A: things[0], B: things[1], C: things[2] };
    /* always show the repeating unit at least twice in full, and never more than six pictures */
    var len = unit.length === 2 ? 4 + ri(rng, 0, 1) : 6, seq = [], i, next, optIds, opts;
    for (i = 0; i < len; i++) seq.push(map[unit[i % unit.length]]);
    next = map[unit[len % unit.length]];
    optIds = things.slice(0, kinds);
    if (optIds.length < 3) optIds.push(things[kinds]);       /* one extra picture that is not in the pattern */
    opts = shuffle(rng, optIds);
    return {
      act: "patterns", kind: "pattern", tag: unit + seq.join(""), unit: unit,
      prompt: { k: "seq", items: seq.map(function (id) { return { k: "pic", id: id }; }) },
      say: "What comes next?",
      hint: "Say it out loud. " + seq.map(function (id) { return nm(id, 1); }).join(", ") + ".",
      done: "Yes! " + nm(next, 1) + " comes next.",
      options: opts.map(function (id) { return { vis: { k: "pic", id: id }, name: nm(id, 1) }; }),
      correct: opts.indexOf(next), meta: { type: "pattern", seq: seq }
    };
  }
  function qCompare(rng, level, kind) {
    var id = pick(rng, COMPARE_THINGS), item = { k: "pic", id: id }, big = rng() < 0.5, n, scales, counts, opts, vals, target, i, a, b, word, guard = 0;
    if (kind === "size") {
      n = level === 1 ? 2 : 3;
      scales = level === 1 ? [1, 0.5] : level === 2 ? [1, 0.68, 0.42] : [1, 0.78, 0.58];
      vals = shuffle(rng, scales);
      target = big ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
      word = n === 2 ? (big ? "bigger" : "smaller") : (big ? "biggest" : "smallest");
      return {
        act: "compare", kind: "size", tag: "s" + id + word, prompt: { k: "cmp", what: big ? "bigger" : "smaller" },
        say: n === 2 ? "Which " + nm(id, 1) + " is " + word + "?" : "Which " + nm(id, 1) + " is the " + word + "?",
        hint: big ? "Big means it takes up lots of room." : "Small means tiny, like a little bug.",
        done: "Yes! That one is " + (n === 2 ? word : "the " + word) + ".",
        options: vals.map(function (s) { var sorted = vals.slice().sort(function (x, y) { return y - x; }), r = sorted.indexOf(s); return { vis: { k: "sized", item: item, scale: s }, name: (r === 0 ? "big " : r === vals.length - 1 ? "small " : "medium ") + nm(id, 1) }; }),
        correct: vals.indexOf(target), meta: { type: "size", want: big ? "max" : "min" }
      };
    }
    if (level <= 2) {                 /* two groups, clearly different */
      do { a = ri(rng, 1, 8); b = ri(rng, 1, 8); } while (Math.abs(a - b) < 3);
      counts = [a, b];
    } else if (rng() < 0.5) {         /* two groups, close */
      a = ri(rng, 2, 9); b = a + pick(rng, [-1, 1, 2, -2]);
      if (b < 1) b = a + 1; if (b > 10) b = a - 1;
      counts = [a, b];
    } else {                          /* three groups, all different */
      do { counts = [ri(rng, 1, 10), ri(rng, 1, 10), ri(rng, 1, 10)]; }
      while ((counts[0] === counts[1] || counts[0] === counts[2] || counts[1] === counts[2]) && ++guard < 200);
    }
    n = counts.length;
    target = big ? Math.max.apply(null, counts) : Math.min.apply(null, counts);
    word = n === 2 ? (big ? "more" : "fewer") : (big ? "the most" : "the fewest");
    return {
      act: "compare", kind: "qty", tag: "q" + counts.join("-") + word, prompt: { k: "cmp", what: big ? "more" : "fewer" },
      say: "Which group has " + word + " " + nm(id, 2) + "?",
      hint: "Count each group. " + (big ? "More means a bigger number." : "Fewer means a smaller number."),
      done: "Yes! " + NUM_WORDS[target] + " is " + word + ".",
      options: counts.map(function (c) { return { vis: { k: "group", item: item, n: c, jitter: 0 }, name: NUM_WORDS[c] }; }),
      correct: counts.indexOf(target), meta: { type: "qty", want: big ? "max" : "min" }
    };
  }
  function qMemory(rng, cols, rows) {
    var pairs = cols * rows / 2, ids = sample(rng, MEMORY_ANIMALS, pairs);
    return { act: "memory", kind: "memory", cols: cols, rows: rows, pairs: pairs, cards: shuffle(rng, ids.concat(ids)),
             say: "Find the two that match.", hint: "Remember where each animal is hiding.", done: "You found them all!", options: [], correct: -1, meta: { type: "memory" } };
  }

  /* A round: five questions (or one or two memory boards). `opts.letters` lets the app deal letters
     from a saved deck so that all 26 turn up over time. */
  function makeRound(act, level, rng, opts) {
    rng = rng || Math.random; opts = opts || {}; level = Math.max(1, Math.min(3, level | 0 || 1));
    var qs = [], used = [], i, q, plan, letters, guard;
    function add(make) {
      guard = 0;
      do { q = make(); } while (used.indexOf(q.tag) >= 0 && ++guard < 30);
      used.push(q.tag); qs.push(q);
    }
    if (act === "count") {
      plan = level === 1 ? "ccccc" : "cccgg";
      var seenC = [], seenG = [];
      for (i = 0; i < 5; i++) {
        if (plan[i] === "c") { q = qCount(rng, level, seenC); seenC.push(q.meta.n); } else { q = qGive(rng, level, seenG); seenG.push(q.meta.n); }
        qs.push(q);
      }
    } else if (act === "letters") {
      letters = (opts.letters && opts.letters.length >= 5) ? opts.letters.slice(0, 5) : sample(rng, ALPHABET, 5);
      for (i = 0; i < 5; i++) qs.push(qLetter(rng, level, letters[i], level === 3 && i % 2 === 1));
    } else if (act === "colors") {
      plan = level === 1 ? shuffle(rng, ["color", "color", "shape", "shape", pick(rng, ["color", "shape"])])
           : level === 2 ? ["both", "both", "sortColor", "both", "sortShape"]
           : ["both", "sortColor", "both", "sortShape", pick(rng, ["sortColor", "sortShape"])];
      plan.forEach(function (k) { add(function () { return qColor(rng, level, k); }); });
    } else if (act === "patterns") {
      for (i = 0; i < 5; i++) add(function () { return qPattern(rng, level); });
    } else if (act === "compare") {
      plan = level === 1 ? ["size", "size", "size", "size", "size"] : level === 2 ? ["size", "qty", "size", "qty", "qty"] : ["qty", "size", "qty", "qty", "qty"];
      plan.forEach(function (k) { add(function () { return qCompare(rng, level, k); }); });
    } else if (act === "memory") {
      MEMORY_BOARDS[level].forEach(function (b) { qs.push(qMemory(rng, b[0], b[1])); });
    } else throw new Error("unknown activity " + act);
    return qs;
  }

  /* ================= validation (used by tests/content-check.js and by ?debug=1) ================= */
  function validate(q) {
    var errs = [], keys, i, right = [], o, m = q.meta || {}, vals, best;
    function bad(s) { errs.push(q.act + "/" + q.kind + ": " + s); }
    if (!q.say || !q.hint) bad("missing spoken prompt or hint");
    if (q.kind === "memory") {
      var cnt = {};
      q.cards.forEach(function (c) { cnt[c] = (cnt[c] || 0) + 1; if (MEMORY_ANIMALS.indexOf(c) < 0) bad("unknown animal " + c); });
      if (q.cards.length !== q.cols * q.rows) bad("card count does not fill the board");
      Object.keys(cnt).forEach(function (c) { if (cnt[c] !== 2) bad(c + " appears " + cnt[c] + " times"); });
      if (Object.keys(cnt).length !== q.pairs) bad("wrong number of pairs");
      return errs;
    }
    if (q.kind === "give") {
      if (!(q.target >= 1 && q.target <= 10)) bad("target out of range");
      if (q.tray < q.target || q.tray > 10) bad("tray must hold between target and 10 treats");
      if (q.prompt.n !== q.target) bad("numeral shown does not match target");
      return errs;
    }
    if (!q.options || q.options.length < 2) { bad("needs at least two options"); return errs; }
    keys = q.options.map(function (op) { return keyOf(op.vis); });
    for (i = 0; i < keys.length; i++) if (keys.indexOf(keys[i]) !== i) bad("duplicate option " + keys[i]);
    for (i = 0; i < q.options.length; i++) {
      o = q.options[i].vis;
      if (m.type === "count") { if (o.n === q.prompt.n) right.push(i); }
      else if (m.type === "letter2pic") {
        if (LETTERS[q.options[i].letter].starts.some(function (s) { return clashes(m.L, s); })) right.push(i);
        else if (LETTERS[q.options[i].letter].starts.some(function (s) { return (NAME_SOUND[m.L] || []).indexOf(s) >= 0; })) bad("wrong choice '" + q.options[i].name + "' starts with the sound of the letter name " + LETTERS[m.L].say);
      }
      else if (m.type === "pic2letter") { if (LETTERS[m.L].starts.some(function (s) { return clashes(o.L, s); })) right.push(i); }
      else if (m.type === "match") {
        if (m.want.binColor) { if (o.label.color === m.want.binColor) right.push(i); }
        else if (m.want.binShape) { if (o.label.shape === m.want.binShape) right.push(i); }
        else if ((!m.want.color || o.color === m.want.color) && (!m.want.shape || o.shape === m.want.shape)) right.push(i);
      }
    }
    if (m.type === "count") {
      if (q.prompt.n < 1 || q.prompt.n > 10) bad("count out of 1..10");
      q.options.forEach(function (op) { if (op.vis.n < 1 || op.vis.n > 10) bad("numeral out of 1..10"); });
    }
    if (m.type === "match" && (m.want.binColor || m.want.binShape)) {
      if (m.want.binColor && q.prompt.color !== m.want.binColor) bad("item colour does not match its basket");
      if (m.want.binShape && q.prompt.shape !== m.want.binShape) bad("item shape does not match its basket");
    }
    if (m.type === "pattern") {
      /* smallest repeating unit of what is shown; it must be shown at least twice in full */
      var s = m.seq, p, ok, nextId;
      for (p = 1; p <= s.length; p++) { ok = true; for (i = p; i < s.length; i++) if (s[i] !== s[i - p]) { ok = false; break; } if (ok) break; }
      if (p * 2 > s.length) bad("pattern unit is not shown twice: " + s.join(","));
      if (p < 2) bad("pattern has only one kind of thing");
      if (s.length > 6) bad("pattern too long to show");
      nextId = s[s.length - p];
      q.options.forEach(function (op, j) { if (op.vis.id === nextId) right.push(j); });
    }
    if (m.type === "size" || m.type === "qty") {
      vals = q.options.map(function (op) { return m.type === "size" ? op.vis.scale : op.vis.n; });
      best = m.want === "max" ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
      vals.forEach(function (v, j) { if (v === best) right.push(j); });
      if (m.type === "qty") vals.forEach(function (v) { if (v < 1 || v > 10) bad("group size out of 1..10"); });
      if (m.type === "size") { var sv = vals.slice().sort(function (x, y) { return x - y; }); for (i = 1; i < sv.length; i++) if (sv[i] - sv[i - 1] < 0.15) bad("sizes too close to tell apart"); }
    }
    if (right.length !== 1) bad("expected exactly one right option, found " + right.length + " in " + keys.join(" | "));
    else if (right[0] !== q.correct) bad("marked answer " + q.correct + " but the right one is " + right[0]);
    return errs;
  }

  var api = { ACTIVITIES: ACTIVITIES, NUM_WORDS: NUM_WORDS, NAMES: NAMES, LETTERS: LETTERS, ALPHABET: ALPHABET, CLASH: CLASH, TRICKY: TRICKY, NAME_SOUND: NAME_SOUND,
              COLOR_NAMES: COLOR_NAMES, SHAPE_NAMES: SHAPE_NAMES, PATTERN_THINGS: PATTERN_THINGS, PATTERN_UNITS: PATTERN_UNITS,
              MEMORY_ANIMALS: MEMORY_ANIMALS, MEMORY_BOARDS: MEMORY_BOARDS, COMPARE_THINGS: COMPARE_THINGS, COUNT_THINGS: COUNT_THINGS,
              makeRound: makeRound, validate: validate, seeded: seeded, shuffle: shuffle, keyOf: keyOf, nm: nm };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KCContent = api;
})(typeof window !== "undefined" ? window : globalThis);
