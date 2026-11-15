/* KC's Learning Trail - the app. Plain JavaScript, no build step, no network requests.
   art.js draws the pictures, content.js makes the questions, this file runs the screens. */
(function () {
  "use strict";
  var A = window.KCArt, C = window.KCContent;
  var $ = function (id) { return document.getElementById(id); };
  var QS = (function () { try { return new URLSearchParams(location.search); } catch (e) { return { get: function () { return null; } }; } })();
  var DEBUG = QS.get("debug") === "1", SPEED = QS.get("fast") === "1" ? 0.06 : 1;
  var RM = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var VERSION = "1.0.0", SAVE_KEY = "kcLearningTrail.v1";

  /* ---------- saved progress (never leaves the device) ---------- */
  function fresh() {
    return { v: 1, lv: { count: 1, letters: 1, colors: 1, patterns: 1, memory: 1, compare: 1 },
             rounds: { count: 0, letters: 0, colors: 0, patterns: 0, memory: 0, compare: 0 },
             stickers: {}, deck: [], demo: {}, last: "count", set: { muted: false, voice: true, sfx: true, music: true } };
  }
  var store = {
    load: function () {
      /* every field is checked on its own, so a damaged or foreign value can never stop the game from starting */
      var s = fresh(), raw, o, k;
      function obj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
      try {
        raw = window.localStorage.getItem(SAVE_KEY); o = raw ? JSON.parse(raw) : null;
        if (obj(o) && o.v === 1) {
          C.ACTIVITIES.forEach(function (a) {
            if (obj(o.lv)) s.lv[a] = Math.max(1, Math.min(3, o.lv[a] | 0 || 1));
            if (obj(o.rounds)) s.rounds[a] = Math.max(0, o.rounds[a] | 0);
          });
          if (obj(o.stickers)) A.STICKERS.forEach(function (st) { var n = o.stickers[st[0]] | 0; if (n > 0) s.stickers[st[0]] = n; });
          if (obj(o.demo)) for (k in o.demo) if (o.demo[k]) s.demo[k] = 1;
          if (obj(o.set)) for (k in s.set) if (typeof o.set[k] === "boolean") s.set[k] = o.set[k];
          if (Array.isArray(o.deck)) o.deck.forEach(function (l) { if (typeof l === "string" && C.LETTERS[l] && s.deck.indexOf(l) < 0) s.deck.push(l); });
          if (C.ACTIVITIES.indexOf(o.last) >= 0) s.last = o.last;
        }
      } catch (e) { s = fresh(); }
      return s;
    },
    save: function () { try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} },
    clear: function () { try { window.localStorage.removeItem(SAVE_KEY); } catch (e) {} }
  };
  var S = store.load();

  /* ---------- timers: cancelled when a screen is left, and held while the app is in the background ---------- */
  var timers = [], paused = false;
  function arm(t) { t.at = Date.now(); t.id = setTimeout(function () { var i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); t.fn(); }, t.left); }
  function later(fn, ms, exact) { var t = { fn: fn, left: Math.max(0, exact ? ms : ms * SPEED), at: 0, id: 0 }; timers.push(t); if (!paused) arm(t); return t; }
  function clearTimers() { while (timers.length) clearTimeout(timers.pop().id); }
  function pauseTimers() { var i, t; if (paused) return; paused = true; for (i = 0; i < timers.length; i++) { t = timers[i]; clearTimeout(t.id); t.left = Math.max(0, t.left - (Date.now() - t.at)); } }
  function resumeTimers() { if (!paused) return; paused = false; timers.slice().forEach(arm); }

  /* ---------- sound: everything is synthesized, nothing plays before the first touch ---------- */
  var AC = null, sfxGain = null, musGain = null, musTimer = 0, musNext = 0, musIdx = 0;
  var MELODY = [72, 0, 76, 79, 81, 0, 79, 76, 74, 0, 76, 72, 69, 0, 72, 0, 67, 0, 69, 72, 74, 0, 76, 74, 72, 0, 69, 67, 72, 0, 0, 0];
  var BASS = [48, 45, 41, 43, 48, 45, 43, 48];
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function audible() { return !!AC && !S.set.muted && !document.hidden; }
  function unlock() {
    if (!AC) {
      try {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        AC = new Ctx(); sfxGain = AC.createGain(); musGain = AC.createGain();
        sfxGain.connect(AC.destination); musGain.connect(AC.destination);
        applyVolumes();
        musTimer = setInterval(musicTick, 240);
      } catch (e) { AC = null; return; }
    }
    if ((AC.state === "suspended" || AC.state === "interrupted") && !document.hidden) { try { var pr = AC.resume(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} }
  }
  function applyVolumes() {
    if (!AC) return;
    sfxGain.gain.value = (!S.set.muted && S.set.sfx) ? 1 : 0;
    musGain.gain.value = (!S.set.muted && S.set.music) ? 1 : 0;
  }
  function tone(dest, f, at, dur, type, vol) {
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(dest); o.start(at); o.stop(at + dur + 0.03);
  }
  var SFX = {
    tap: [[660, 0, 0.07]], flip: [[520, 0, 0.08]], pop: [[784, 0, 0.09]],
    good: [[523, 0, 0.14], [659, 0.09, 0.14], [784, 0.18, 0.14], [1047, 0.27, 0.3]],
    oops: [[330, 0, 0.16], [294, 0.14, 0.24]],
    match: [[659, 0, 0.12], [880, 0.1, 0.25]],
    sticker: [[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.14], [659, 0.36, 0.14], [784, 0.48, 0.14], [1047, 0.6, 0.5]]
  };
  function sfx(name, step) {
    if (!audible() || !S.set.sfx) return;
    try {
      var n = SFX[name], t = AC.currentTime + 0.01, i, mul = step ? Math.pow(2, Math.min(step, 12) / 12) : 1;
      for (i = 0; i < n.length; i++) tone(sfxGain, n[i][0] * mul, t + n[i][1], n[i][2], name === "oops" ? "sine" : "triangle", name === "oops" ? 0.12 : 0.17);
    } catch (e) {}
  }
  function musicTick() {          /* a soft looping tune, scheduled a little ahead of time */
    if (!audible() || !S.set.music || AC.state !== "running") { musNext = 0; return; }
    var beat = 0.36, now = AC.currentTime, m;
    if (!musNext || musNext < now) musNext = now + 0.05;
    try {
      while (musNext < now + 0.6) {
        m = MELODY[musIdx % MELODY.length];
        if (m) tone(musGain, hz(m), musNext, beat * 1.6, "sine", 0.035);
        if (musIdx % 4 === 0) tone(musGain, hz(BASS[(musIdx / 4) % BASS.length]), musNext, beat * 3.6, "triangle", 0.03);
        musIdx++; musNext += beat;
      }
    } catch (e) {}
  }

  /* ---------- voice: used when the device has it, silently skipped when it does not ---------- */
  var synth = null, voice = null, voicesSeen = false, spoken = [];
  try { if ("speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function") synth = window.speechSynthesis; } catch (e) { synth = null; }
  function pickVoice() {
    if (!synth) return;
    var vs = [], best = null, score = -1, i, v, sc;
    try { vs = synth.getVoices() || []; } catch (e) {}
    voicesSeen = vs.length > 0;
    for (i = 0; i < vs.length; i++) {
      v = vs[i]; if (!/^en([-_]|$)/i.test(v.lang || "")) continue;
      sc = 1 + (/^en[-_]US/i.test(v.lang) ? 3 : /^en[-_]GB/i.test(v.lang) ? 2 : 0) + (v.localService ? 2 : 0) + (v.default ? 1 : 0);
      if (sc > score) { score = sc; best = v; }
    }
    voice = best;
  }
  if (synth) { pickVoice(); try { synth.addEventListener("voiceschanged", pickVoice); } catch (e) {} }
  /* Inside the Android app the shell offers the phone's own text-to-speech as window.KCNative
     (canSpeak / speak / stopSpeaking), because a WebView usually has no speechSynthesis voices.
     It is preferred whenever it says it is ready; it starts up a moment after the page, so ask each time. */
  var native = null;
  try { if (window.KCNative && typeof window.KCNative.speak === "function" && typeof window.KCNative.canSpeak === "function") native = window.KCNative; } catch (e) { native = null; }
  function nativeReady() { try { return !!native && native.canSpeak() === true; } catch (e) { return false; } }
  function hasVoice() { return !!synth || nativeReady(); }
  function voiceWanted() { return S.set.voice && !S.set.muted && !document.hidden && gestureSeen; }
  function voiceReady() { return voiceWanted() && (nativeReady() || (!!synth && (voice || !voicesSeen))); }
  function hush() {
    if (native) { try { native.stopSpeaking(); } catch (e) {} }
    if (synth) { try { synth.cancel(); } catch (e) {} }
    talking(false);
  }
  function talking(on) { var b = $("sayBtn"); if (b) b.classList.toggle("talking", !!on); }
  /* speak(text, then): `then` is always called, when speech ends or after a pause if there is no voice */
  function speak(text, then, minMs) {
    var done = false, finish = function () { if (done) return; done = true; talking(false); if (then) then(); };
    if (DEBUG) { spoken.push(text); if (spoken.length > 200) spoken.shift(); }
    if (!voiceReady()) { if (then) later(finish, minMs || 0); return; }
    if (nativeReady()) {                        /* the shell cannot tell us when it has finished, so time it by length */
      try { native.speak(String(text).slice(0, 400), 0.85, 1.1); talking(true); } catch (e) {}
      later(finish, Math.max(minMs || 0, 700 + text.length * 75));
      return;
    }
    try {
      synth.cancel();
      var u = new window.SpeechSynthesisUtterance(text);
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = "en-US";
      u.rate = 0.85; u.pitch = 1.1; u.volume = 1;
      var t0 = Date.now(), end = function () { later(finish, Math.max(0, (minMs || 0) * SPEED - (Date.now() - t0)), true); };   /* through later(): held while hidden, dropped when the screen changes */
      u.onend = end; u.onerror = end;
      talking(true);
      synth.speak(u);
      if (then) later(finish, Math.max(minMs || 0, 1200 + text.length * 90));   /* never get stuck waiting for a voice */
    } catch (e) { if (then) later(finish, minMs || 0); }
  }
  var PRAISE = ["Great job!", "Woof! You did it!", "Hooray!", "Pawsome!", "Nice one!", "Way to go!", "You got it!"];

  /* ---------- small icons ---------- */
  var ink = A.INK, st = 'fill="none" stroke="' + ink + '" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"';
  var ICON = {
    home: A.svg('<path d="M12 52 L50 16 L88 52" ' + st + '/><path d="M24 46 V86 H76 V46" fill="#ffd9a8" stroke="' + ink + '" stroke-width="8" stroke-linejoin="round"/><rect x="42" y="60" width="16" height="26" fill="' + ink + '"/>'),
    back: A.svg('<path d="M58 18 L26 50 L58 82" ' + st + ' stroke-width="12"/>'),
    again: A.svg('<path d="M78 50 A28 28 0 1 1 64 26" ' + st + ' stroke-width="11"/><path d="M56 6 L76 28 L48 36Z" fill="' + ink + '"/>'),
    book: A.svg('<path d="M50 24 Q30 12 10 20 V80 Q30 72 50 84 Q70 72 90 80 V20 Q70 12 50 24Z" fill="#ffd9a8" stroke="' + ink + '" stroke-width="7" stroke-linejoin="round"/><path d="M50 24 V84" ' + st + ' stroke-width="6"/><polygon points="30,34 33.5,43 43,43.6 35.6,49.6 38,59 30,53.8 22,59 24.4,49.6 17,43.6 26.5,43" fill="#f26a1b"/><circle cx="70" cy="48" r="9" fill="#3f7fd6"/>'),
    note: A.svg('<path d="M38 72 V22 L78 14 V62" ' + st + '/><ellipse cx="28" cy="74" rx="13" ry="10" fill="' + ink + '"/><ellipse cx="68" cy="64" rx="13" ry="10" fill="' + ink + '"/>'),
    noteOff: A.svg('<g opacity=".4"><path d="M38 72 V22 L78 14 V62" ' + st + '/><ellipse cx="28" cy="74" rx="13" ry="10" fill="' + ink + '"/><ellipse cx="68" cy="64" rx="13" ry="10" fill="' + ink + '"/></g><path d="M14 14 L86 86" fill="none" stroke="#d7263d" stroke-width="11" stroke-linecap="round"/>'),
    say: A.svg('<path d="M12 40 H30 L54 18 V82 L30 60 H12Z" fill="#fff" stroke="' + ink + '" stroke-width="7" stroke-linejoin="round"/><path d="M66 36 Q76 50 66 64 M78 24 Q96 50 78 76" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>'),
    check: A.svg('<path d="M16 54 L40 78 L86 24" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>'),
    lock: A.svg('<path d="M30 46 V32 Q30 12 50 12 Q70 12 70 32 V46" ' + st + '/><rect x="18" y="44" width="64" height="46" rx="10" fill="' + ink + '"/><circle cx="50" cy="66" r="7" fill="#fff"/>'),
    q: A.svg('<rect x="8" y="8" width="84" height="84" rx="16" fill="#fff" stroke="' + ink + '" stroke-width="5" stroke-dasharray="10 9"/><text x="50" y="54" font-size="62" text-anchor="middle" dominant-baseline="central">?</text>')
  };
  function nest(full, x, y, w, h) { return '<svg x="' + x + '" y="' + y + '" width="' + w + '" height="' + (h || w) + '">' + full + "</svg>"; }
  var STOP_ICON = {
    count: A.svg('<text x="50" y="30" font-size="44" text-anchor="middle" dominant-baseline="central" style="fill:#1553b7">1 2 3</text>' + nest(A.pic("ball"), 4, 56, 30) + nest(A.pic("ball"), 35, 56, 30) + nest(A.pic("ball"), 66, 56, 30)),
    letters: A.svg('<text x="50" y="52" font-size="70" text-anchor="middle" dominant-baseline="central" style="fill:#1553b7">Aa</text>'),
    colors: A.svg(nest(A.shape("triangle", "red"), 4, 4, 50) + nest(A.shape("circle", "blue"), 48, 22, 48) + nest(A.shape("square", "yellow"), 12, 54, 42)),
    patterns: A.svg(nest(A.pic("ball"), 2, 6, 44) + nest(A.pic("cone"), 54, 6, 44) + nest(A.pic("ball"), 2, 54, 44) + nest(ICON.q, 54, 54, 44)),
    memory: A.svg('<g transform="rotate(-10 30 50)"><rect x="6" y="18" width="46" height="62" rx="9" fill="#2f9e8f" stroke="' + ink + '" stroke-width="4"/>' + nest(A.pic("paw"), 15, 35, 28) + '</g><g transform="rotate(8 70 52)"><rect x="46" y="20" width="48" height="64" rx="9" fill="#fffaf0" stroke="' + ink + '" stroke-width="4"/>' + nest(A.pic("owl"), 50, 32, 40) + "</g>"),
    compare: A.svg(nest(A.pic("pine"), 0, 4, 64, 92) + nest(A.pic("pine"), 62, 58, 34, 38))
  };
  var ACT_NAMES = { count: "Counting", letters: "Letters", colors: "Colors and shapes", patterns: "Patterns", memory: "Memory match", compare: "Bigger, smaller, more, fewer" };

  /* ---------- turning a <visual> from content.js into SVG ---------- */
  function V(v, mode) {
    switch (v.k) {
      case "pic": return A.pic(v.id);
      case "emo": return A.emoji(v.ch);
      case "num": return A.text(String(v.n), 84, v.n >= 10 ? 120 : 100);
      case "letter": return A.text(v.L.toUpperCase() + " " + v.L, 74, 170);
      case "shape": return A.shape(v.shape, v.color);
      case "blob": return A.blob(v.color);
      case "outline": return A.shape(v.shape, null);
      case "sized": return A.svg(nest(V(v.item), (100 - 100 * v.scale) / 2, 98 - 100 * v.scale, 100 * v.scale));
      case "bin": return A.svg(A.P.basket + '<circle cx="50" cy="64" r="28" fill="#fff" stroke="' + ink + '" stroke-width="3"/>' + nest(V(v.label), 29, 43, 42));
      case "group": return groupSvg(v, mode);
      case "seq": return seqSvg(v);
      case "cmp": return cmpSvg(v.what);
    }
    return "";
  }
  /* Things to count sit one per cell of a grid, so they can never overlap. */
  function groupSvg(v, mode) {
    var n = v.n, frame = mode === "frame" || mode === "tall", cols = mode === "tall" ? 2 : frame ? 5 : (n <= 5 ? n : Math.ceil(n / 2)), rows = mode === "tall" ? 5 : frame ? 2 : Math.ceil(n / cols);
    var rng = v.jitter ? C.seeded(v.jitter) : null, item = V(v.item), s = "", i, c, r, inRow, off, size, x, y, rot;
    for (i = 0; i < n; i++) {
      r = Math.floor(i / cols); c = i % cols;
      inRow = Math.min(cols, n - r * cols); off = frame ? 0 : (cols - inRow) * 50;
      size = rng ? 78 : frame ? 92 : 86;
      x = c * 100 + off + (100 - size) / 2 + (rng ? (rng() - 0.5) * 16 : 0);
      y = r * 100 + (100 - size) / 2 + (rng ? (rng() - 0.5) * 16 : 0);
      rot = rng ? Math.round((rng() - 0.5) * 30) : 0;
      s += '<g class="cnt" data-i="' + i + '"><rect x="' + (c * 100 + off) + '" y="' + r * 100 + '" width="100" height="100" fill="transparent"/>' +
           '<g class="it" transform="rotate(' + rot + " " + (x + size / 2).toFixed(1) + " " + (y + size / 2).toFixed(1) + ')">' + nest(item, x.toFixed(1), y.toFixed(1), size) + "</g>" +
           (mode === "count" ? '<g class="mark"><circle cx="' + (c * 100 + off + 50) + '" cy="' + (r * 100 + 50) + '" r="27" fill="#1553b7" stroke="#fff" stroke-width="5"/><text x="' + (c * 100 + off + 50) + '" y="' + (r * 100 + 52) + '" font-size="36" text-anchor="middle" dominant-baseline="central" style="fill:#fff"></text></g>' : "") + "</g>";
    }
    return A.svg(s, "pic grp", "0 0 " + cols * 100 + " " + rows * 100);
  }
  function seqSvg(v) {
    var s = "", i, n = v.items.length;
    for (i = 0; i < n; i++) s += nest(V(v.items[i]), i * 100 + 7, 7, 86);
    s += nest(ICON.q, n * 100 + 5, 5, 90);
    return A.svg(s, "pic seq", "0 0 " + (n + 1) * 100 + " 100");
  }
  /* picture sign for "find the bigger / smaller / more / fewer one": the wanted kind is ringed, the other is faded */
  function cmpSvg(what) {
    var ring = function (x) { return '<rect x="' + x + '" y="6" width="92" height="88" rx="20" fill="#fff3d6" stroke="#f26a1b" stroke-width="6"/>'; };
    var dots = function (x, n, op) { var s = '<g opacity="' + op + '">', i; for (i = 0; i < n; i++) s += '<circle cx="' + (x + 24 + (i % 3) * 22) + '" cy="' + (n <= 3 ? 50 : 38 + Math.floor(i / 3) * 24) + '" r="9" fill="' + ink + '"/>'; return s + "</g>"; };
    var ball = function (x, w, op) { return '<g opacity="' + op + '">' + nest(A.pic("ball"), x + (92 - w) / 2, 50 - w / 2, w) + "</g>"; };
    var s = ring(104);
    if (what === "bigger") s += ball(4, 30, 0.4) + ball(104, 76, 1);
    else if (what === "smaller") s += ball(4, 76, 0.4) + ball(104, 30, 1);
    else if (what === "more") s += dots(4, 2, 0.4) + dots(104, 6, 1);
    else s += dots(4, 6, 0.4) + dots(104, 2, 1);
    return A.svg(s, "pic cmp", "0 0 200 100");
  }

  /* ---------- screens ---------- */
  var screen = "home", gestureSeen = false;
  var SCREENS = ["home", "play", "book", "grown"];
  function show(name) {
    clearTimers(); hush(); hidePaw();
    if (name !== "play") leaveRound();
    delete $("home").dataset.busy; $("mapkc").classList.remove("walk");
    SCREENS.forEach(function (id) { $(id).hidden = id !== name; });
    if (!$("gate").hidden) gateClose();
    screen = name;
    if (name === "home") layoutHome();
  }
  /* the reward covers the round: take what is underneath out of reach of keyboard and screen readers */
  function setReward(on) {
    $("reward").hidden = !on;
    $("play").querySelector(".bar").inert = on; $("stage").inert = on;
    if (on) { try { $("rAgain").focus({ preventScroll: true }); } catch (e) {} }
  }
  function setMuteIcons() {
    var bs = document.querySelectorAll(".muteBtn"), i;
    for (i = 0; i < bs.length; i++) { bs[i].innerHTML = S.set.muted ? ICON.noteOff : ICON.note; bs[i].setAttribute("aria-pressed", S.set.muted ? "true" : "false"); }
    applyVolumes();
  }

  /* ---------- trail map ---------- */
  var stopPos = [], stopSize = 90;
  function buildHome() {
    var h = "";
    C.ACTIVITIES.forEach(function (a, i) {
      h += '<button class="stop" data-act="' + a + '" aria-label="' + ACT_NAMES[a] + '">' + STOP_ICON[a] + '<span class="pips"><i></i><i></i><i></i></span></button>';
    });
    $("stops").innerHTML = h;
    $("mapkc").innerHTML = A.kc();
    $("bookBtn").innerHTML = ICON.book;
    $("gateBtn").querySelector(".gateIcon").innerHTML = ICON.lock;
  }
  function layoutHome() {
    var el = $("home"), W = el.clientWidth, H = el.clientHeight, bar = el.querySelector(".bar").offsetHeight, land = W > H, i, x, y, top, bottom, left, right, hy, btns = $("stops").children, pips, j;
    if (!W || !H) return;
    stopPos = [];
    if (!land) {
      stopSize = Math.max(72, Math.min(W * 0.25, H * 0.13, 150));
      hy = bar + H * 0.1; top = bar + H * 0.12 + stopSize * 0.6; bottom = H - 16 - stopSize * 0.8;
      for (i = 0; i < 6; i++) stopPos.push([W * (i % 2 ? 0.7 : 0.3), bottom - i * (bottom - top) / 5]);
    } else {
      stopSize = Math.max(72, Math.min(H * 0.24, W * 0.12, 160));
      hy = bar + H * 0.06; left = 16 + stopSize * 1.15; right = W - 16 - stopSize * 0.65;
      top = hy + stopSize * 0.66; bottom = H - 16 - stopSize * 0.72;
      for (i = 0; i < 6; i++) stopPos.push([left + i * (right - left) / 5, i % 2 ? top : bottom]);
    }
    el.style.setProperty("--stop", stopSize + "px");
    for (i = 0; i < 6; i++) {
      btns[i].style.left = stopPos[i][0] + "px"; btns[i].style.top = stopPos[i][1] + "px";
      btns[i].classList.toggle("here", C.ACTIVITIES[i] === S.last);
      pips = btns[i].querySelectorAll(".pips i");
      for (j = 0; j < 3; j++) pips[j].classList.toggle("on", j < S.lv[C.ACTIVITIES[i]]);
    }
    $("scene").innerHTML = sceneSvg(W, H, hy);
    placeKc(C.ACTIVITIES.indexOf(S.last), false);
  }
  function placeKc(i, animate) {
    var k = $("mapkc"), p = stopPos[i] || stopPos[0], x;
    if (!p) return;
    x = p[0] - stopSize * 0.8;
    if (x - stopSize * 0.62 < 8) x = p[0] + stopSize * 0.8;        /* her tail reaches past her box: keep it on the screen */
    k.style.transition = animate && !RM.matches ? "" : "none";
    k.style.left = x + "px"; k.style.top = (p[1] + stopSize * 0.62) + "px";
    k.classList.toggle("walk", !!animate && !RM.matches);
  }
  function sceneSvg(W, H, hy) {
    var rng = C.seeded(7), m = Math.min(W, H), land = W > H, s = "", i, x, y, h, d = "", pts, ok, j, tries, sz, px = (W * 0.36), ph = m * 0.3;
    s += '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fc3f7"/><stop offset="1" stop-color="#d9f1ff"/></linearGradient>' +
         '<linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9bdc74"/><stop offset="1" stop-color="#58b35a"/></linearGradient></defs>';
    s += '<rect width="' + W + '" height="' + (hy + 4) + '" fill="url(#sky)"/>';
    var sunR = Math.min(m * 0.055, 44), sunY = Math.max(hy - ph * 0.72, sunR * 1.4 + 10), sunX = land ? W * 0.7 : W * 0.82;      /* always whole, and clear of the corner button on wide screens */
    s += '<circle cx="' + sunX + '" cy="' + sunY + '" r="' + sunR + '" fill="#ffd23c"/><circle cx="' + sunX + '" cy="' + sunY + '" r="' + sunR * 1.36 + '" fill="#ffd23c" opacity=".3"/>';
    /* far ridge */
    d = "M0 " + hy; for (x = 0; x <= W + 60; x += 60) d += " L" + x + " " + (hy - ph * (0.22 + rng() * 0.3)).toFixed(0); d += " L" + W + " " + hy + "Z";
    s += '<path d="' + d + '" fill="#a9bfd6"/>';
    /* the big snowy peak */
    s += '<path d="M' + (px - ph * 1.1) + " " + hy + " L" + px + " " + (hy - ph) + " L" + (px + ph * 1.15) + " " + hy + 'Z" fill="#7d8fa8"/>';
    s += '<path d="M' + px + " " + (hy - ph) + " L" + (px - ph * 0.37) + " " + (hy - ph * 0.66) + " L" + (px - ph * 0.2) + " " + (hy - ph * 0.72) + " L" + (px - ph * 0.08) + " " + (hy - ph * 0.56) + " L" + (px + ph * 0.1) + " " + (hy - ph * 0.72) + " L" + (px + ph * 0.24) + " " + (hy - ph * 0.6) + " L" + (px + ph * 0.38) + " " + (hy - ph * 0.67) + 'Z" fill="#fff"/>';
    /* tree line */
    for (x = -10; x < W + 20; x += 22 + rng() * 10) { h = 26 + rng() * 26; s += '<path d="M' + x.toFixed(0) + " " + (hy + 6) + " l" + (h * 0.32).toFixed(0) + " " + (-h).toFixed(0) + " l" + (h * 0.32).toFixed(0) + " " + h.toFixed(0) + 'Z" fill="' + (rng() < 0.5 ? "#1f6b41" : "#2a7d4d") + '"/>'; }
    s += '<rect y="' + hy + '" width="' + W + '" height="' + (H - hy) + '" fill="url(#grass)"/>';
    /* river */
    var rw = m * 0.11, g = H - hy;
    d = "M" + (W * 0.98 + rw) + " " + (hy + g * 0.02) + " C" + (W * 0.55) + " " + (hy + g * 0.1) + " " + (W * 0.95) + " " + (hy + g * 0.42) + " " + (W * 0.5) + " " + (hy + g * 0.5) +
        " S" + (W * 0.3) + " " + (hy + g * 0.9) + " " + (-rw) + " " + (hy + g * 0.96);
    s += '<path d="' + d + '" fill="none" stroke="#3f9bd6" stroke-width="' + (rw + 8) + '" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="#62bdf3" stroke-width="' + rw + '" stroke-linecap="round"/>' +
         '<path d="' + d + '" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-dasharray="14 30" stroke-linecap="round"/>';
    /* the trail through all six stops */
    pts = stopPos;
    if (pts.length) {
      d = "M" + pts[0][0] + " " + pts[0][1];
      for (i = 0; i < pts.length - 1; i++) {
        var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        d += " C" + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(0) + " " + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(0) + " " + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(0) + " " + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(0) + " " + p2[0].toFixed(0) + " " + p2[1].toFixed(0);
      }
      s += '<path d="' + d + '" fill="none" stroke="#b98c4f" stroke-width="' + (stopSize * 0.36 + 8) + '" stroke-linecap="round" stroke-linejoin="round"/><path d="' + d + '" fill="none" stroke="#ecd3a0" stroke-width="' + stopSize * 0.36 + '" stroke-linecap="round" stroke-linejoin="round"/>' +
           '<path d="' + d + '" fill="none" stroke="#c9a56a" stroke-width="4" stroke-dasharray="2 18" stroke-linecap="round"/>';
    }
    /* trees, mushrooms and ferns scattered on the grass, kept clear of the stops */
    /* ...and never standing on the trail, in the river, or where KC waits beside a stop */
    var deco = ["pine", "pine", "pine", "mushroom", "fern", "pine"], count = Math.round(W * H / 26000), id, cy, river = [], keep,
        r0 = [W * 0.98 + rw, hy + g * 0.02], r1 = [W * 0.55, hy + g * 0.1], r2 = [W * 0.95, hy + g * 0.42], r3 = [W * 0.5, hy + g * 0.5],
        r4 = [2 * r3[0] - r2[0], 2 * r3[1] - r2[1]], r5 = [W * 0.3, hy + g * 0.9], r6 = [-rw, hy + g * 0.96];
    function bez(a, b, c, e, t) { var v = 1 - t; return [v * v * v * a[0] + 3 * v * v * t * b[0] + 3 * v * t * t * c[0] + t * t * t * e[0], v * v * v * a[1] + 3 * v * v * t * b[1] + 3 * v * t * t * c[1] + t * t * t * e[1]]; }
    for (i = 0; i <= 24; i++) { river.push(bez(r0, r1, r2, r3, i / 24)); river.push(bez(r3, r4, r5, r6, i / 24)); }
    function segDist(x, y, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)) : 0; return Math.sqrt(Math.pow(x - a[0] - t * dx, 2) + Math.pow(y - a[1] - t * dy, 2)); }
    for (i = 0; i < count; i++) {
      id = deco[i % deco.length]; sz = id === "pine" ? m * (0.1 + rng() * 0.06) : m * 0.06;
      tries = 0;
      do {
        x = rng() * W; y = hy + 20 + rng() * (H - hy - 30); cy = y - sz * 0.45; ok = true;
        for (j = 0; ok && j < pts.length; j++) if (Math.abs(x - pts[j][0]) < stopSize * 1.35 + sz * 0.5 && cy > pts[j][1] - stopSize * 0.8 - sz * 0.5 && cy < pts[j][1] + stopSize * 0.9 + sz * 0.5) ok = false;
        keep = stopSize * 0.22 + sz * 0.5;
        for (j = 0; ok && j < pts.length - 1; j++) if (segDist(x, cy, pts[j], pts[j + 1]) < keep + stopSize * 0.1) ok = false;
        for (j = 0; ok && j < river.length; j++) if (Math.abs(x - river[j][0]) < rw * 0.6 + sz * 0.45 && Math.abs(cy - river[j][1]) < rw * 0.6 + sz * 0.45) ok = false;
      } while (!ok && ++tries < 40);
      if (!ok) continue;
      s += nest(A.pic(id), (x - sz / 2).toFixed(0), (y - sz).toFixed(0), sz.toFixed(0));
    }
    return '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true">' + s + "</svg>";
  }

  /* ---------- playing a round ---------- */
  var cur = null;
  function startActivity(act, forceLevel) {
    var level = forceLevel || S.lv[act], opts = {};
    leaveRound();
    if (act === "letters") {                    /* deal from a saved deck so all 26 letters come round */
      if (S.deck.length < 5) S.deck = S.deck.concat(C.shuffle(Math.random, C.ALPHABET.filter(function (l) { return S.deck.indexOf(l) < 0; })));
      opts.letters = S.deck.slice(0, 5);        /* they leave the deck only when the round is finished */
    }
    cur = { act: act, level: level, qs: C.makeRound(act, level, Math.random, opts), i: 0, wrong: 0, hard: 0, miss: 0, locked: false, done: 0, total: 0, flips: [], streak: 0, counted: 0, placed: 0 };
    cur.total = act === "memory" ? cur.qs.reduce(function (n, q) { return n + q.pairs; }, 0) : cur.qs.length;
    cur.letters = opts.letters || null;
    S.last = act; store.save();
    show("play");
    setReward(false);
    $("kc").innerHTML = A.kc();
    renderDots(); renderQ();
  }
  /* a Letters round that is left unfinished puts its letters at the back of the deck: none is skipped */
  function leaveRound() {
    if (!cur || !cur.letters || cur.finished) return;
    var ls = cur.letters; cur.letters = null;
    S.deck = S.deck.filter(function (l) { return ls.indexOf(l) < 0; }).concat(ls); store.save();
  }
  function renderDots() {
    var h = "", i;
    for (i = 0; i < cur.total; i++) h += '<i class="' + (i < cur.done ? "done" : i === cur.done ? "now" : "") + '"></i>';
    $("dots").innerHTML = h; $("dots").classList.toggle("many", cur.total > 5);
  }
  function mood(m) {
    var k = $("kc").firstChild; if (!k) return;
    k.classList.remove("happy", "oops");
    if (m) { void k.getBoundingClientRect(); k.classList.add(m); }
  }
  function Q() { return cur && cur.qs[cur.i]; }
  function renderQ() {
    var q = Q(), p = $("prompt"), o = $("options"), h = "", i, land = innerWidth > innerHeight;
    cur.miss = 0; cur.locked = false; cur.counted = 0; cur.placed = 0; cur.flips = []; cur.streak = 0; cur.guide = false; cur.tall = false;
    $("sr").textContent = q.say;                 /* the instruction as text, for screen readers */
    hidePaw(); mood(null);
    $("stage").className = q.kind === "memory" ? "wide" : q.kind === "pattern" ? "long" : "";
    p.className = "card" + (q.kind === "give" ? " give" : "") + ((q.prompt && q.prompt.k === "cmp") ? " small" : "") + (q.kind === "pattern" ? " seq" : "");
    $("doneBtn").hidden = q.kind !== "give";
    if (q.kind === "memory") {
      p.innerHTML = "";
      var cols = land ? q.cols : Math.min(q.cols, q.rows), rows = q.cards.length / cols;
      if (!land && q.cols * q.rows === 6) { cols = 2; rows = 3; }
      if (!land && q.cols * q.rows === 8) { cols = 2; rows = 4; }
      if (!land && q.cols * q.rows === 12) { cols = 3; rows = 4; }
      for (i = 0; i < q.cards.length; i++) h += '<button class="mcard" data-i="' + i + '"' + (DEBUG ? ' data-animal="' + q.cards[i] + '"' : "") + ' aria-label="Card ' + (i + 1) + '"><span class="face back">' + A.pic("paw") + '</span><span class="face front">' + A.pic(q.cards[i]) + "</span></button>";
      o.innerHTML = h; o.dataset.cols = cols;
    } else if (q.kind === "give") {
      p.innerHTML = V(q.prompt) + '<button id="bowl" aria-label="KC\'s bowl. Tap to take a treat back."' + (DEBUG ? ' data-target="' + q.target + '"' : "") + ">" + bowlSvg(0) + "</button>";
      for (i = 0; i < q.tray; i++) h += '<button class="treat" data-i="' + i + '" aria-label="Treat">' + A.pic("treat") + "</button>";
      o.innerHTML = h; o.dataset.cols = "";
    } else {
      p.innerHTML = V(q.prompt, q.kind === "count" ? "count" : "");
      for (i = 0; i < q.options.length; i++) {
        h += '<button class="opt' + (q.options[i].vis.k === "num" ? " num" : q.kind === "qty" ? " grp" : "") + '" data-i="' + i + '"' + (DEBUG && i === q.correct ? ' data-correct="1"' : "") + ' aria-label="' + (q.options[i].name || "choice " + (i + 1)) + '">' + V(q.options[i].vis, q.kind === "qty" ? "frame" : "") + "</button>";
      }
      o.innerHTML = h; o.dataset.cols = "";
    }
    fit();
    sayQuestion(true);
  }
  function bowlSvg(n) {
    var s = '<g opacity=".3">' + nest(A.pic("bowl"), 150, 10, 200, 180) + "</g>", i;
    for (i = 0; i < n; i++) s += nest(A.pic("treat"), (i % 5) * 100 + 8, Math.floor(i / 5) * 100 + 8, 84);
    return A.svg(s, "pic", "0 0 500 200");
  }
  /* choose the grid that makes the choices as big as the space allows */
  function fit() {
    var q = Q(), o = $("options"); if (!q || screen !== "play") return;
    if (q.kind === "give") fitGive();
    var n = o.children.length, W, H, gap = q.kind === "give" ? 8 : 12, max = q.kind === "give" ? 130 : 230, best = 0, bc = 1, c, r, w, h, lo, hi, side, cell, bw = 0, bh = 0, tall, t, i;
    o.style.setProperty("--ow", "0px"); o.style.setProperty("--oh", "0px");      /* collapse first so old sizes cannot stretch the box */
    o.style.gap = gap + "px";
    o.style.paddingLeft = o.style.paddingRight = "0px"; W = o.clientWidth - 1; H = o.clientHeight - 1;        /* 1 px spare for fractional widths */
    if (!n || !W || !H) return;
    lo = 1; hi = n;
    if (o.dataset.cols) lo = hi = +o.dataset.cols;
    if (q.kind === "qty") {
      /* groups to compare: each is a ten-frame, five-by-two or two-by-five, whichever lets the things
         inside be drawn biggest (three groups on a phone need the upright one to stay countable) */
      for (t = 0; t < 2; t++) for (c = 1; c <= n; c++) {
        r = Math.ceil(n / c);
        w = Math.min((W - gap * (c - 1)) / c, (t ? 2 : 5) * 74 + 12); h = Math.min((H - gap * (r - 1)) / r, (t ? 5 : 2) * 74 + 18);   /* 12 and 18: the card's border and padding */
        cell = Math.min((w - 12) / (t ? 2 : 5), (h - 18) / (t ? 5 : 2));
        if (cell > best + 0.5) { best = cell; bc = c; bw = w; bh = h; tall = !!t; }
      }
      if (tall !== cur.tall || !o.children[0].firstChild) { cur.tall = tall; for (i = 0; i < n; i++) o.children[i].innerHTML = V(q.options[i].vis, tall ? "tall" : "frame"); }
      bw = Math.floor(bw); bh = Math.floor(bh);
    } else {
      for (c = lo; c <= hi; c++) {
        r = Math.ceil(n / c);
        w = Math.min((W - gap * (c - 1)) / c, (H - gap * (r - 1)) / r);
        if (w > best + 0.5) { best = w; bc = c; }
      }
      bw = bh = Math.floor(Math.min(best, max));
    }
    o.style.setProperty("--ow", bw + "px"); o.style.setProperty("--oh", bh + "px");
    side = Math.max(0, Math.floor((W - (bc * bw + gap * (bc - 1))) / 2) - 1);      /* side padding forces the chosen number of columns */
    o.style.paddingLeft = o.style.paddingRight = side + "px";
  }
  /* "give KC n treats": the numeral always gets a guaranteed share of the card, beside the bowl when the
     card is wide and short, above it otherwise */
  function fitGive() {
    var p = $("prompt"), num = p.firstChild, W, H, side, px;
    if (!num || !$("bowl")) return;
    p.classList.remove("side"); num.style.flex = "";
    W = p.clientWidth - 16; H = p.clientHeight - 16;
    if (W <= 0 || H <= 0) return;
    side = H * 0.4 < 60 || Math.min(W * 0.66, 2.5 * H) > Math.min(W, 2.5 * H * 0.58);
    p.classList.toggle("side", side);
    px = side ? Math.max(64, Math.min(W * 0.3, H * 1.1)) : Math.max(60, H * 0.4);
    num.style.flex = "0 0 " + Math.floor(px) + "px";
  }
  function sayQuestion(first) {
    var q = Q(); if (!q) return;
    speak(q.say);
    if (first && !S.demo[q.act + "." + q.kind]) later(function () { firstDemo(q); }, 700);
  }
  /* remembered only once the paw has really been shown (timers are held while the app is in the background) */
  function firstDemo(q) {
    var key = q.act + "." + q.kind;
    if (Q() !== q || cur.locked || S.demo[key] || document.hidden) return;
    S.demo[key] = 1; store.save();
    demo(q);
  }
  /* the pointing paw shows what to do the first time, so the game makes sense with no voice at all */
  function demo(q) {
    if (Q() !== q || cur.locked) return;
    var from = $("prompt"), to;
    if (q.kind === "memory") { from = $("kc"); to = $("options").children[0]; }
    else if (q.kind === "give") { from = $("options").children[0]; to = $("bowl"); }
    else to = $("options").children[q.correct];
    pawTo(to, from, 2600);
  }
  var pawTimer = 0;
  function hidePaw() { var p = $("paw"); clearTimeout(pawTimer); p.classList.remove("point"); p.style.opacity = ""; if (p.getAnimations) p.getAnimations().forEach(function (a) { a.cancel(); }); }
  function pawTo(to, from, ms) {
    var p = $("paw"), host = $("play").getBoundingClientRect(), b, a, tx, ty, anim;
    if (!to) return;
    hidePaw();
    if (!p.firstChild) p.innerHTML = A.pic("paw");
    b = to.getBoundingClientRect(); tx = b.left - host.left + b.width * 0.62 - 20; ty = b.top - host.top + b.height * 0.66 - 6;
    p.style.left = tx + "px"; p.style.top = ty + "px";
    if (from && !RM.matches && p.animate) {
      a = from.getBoundingClientRect();
      try {
        anim = p.animate([{ transform: "translate(" + (a.left + a.width / 2 - b.left - b.width / 2) + "px," + (a.top + a.height / 2 - b.top - b.height / 2) + "px)", opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: "translate(0,0)", opacity: 1 }], { duration: 1100 * Math.max(SPEED, 0.2), easing: "ease-in-out" });
        anim.onfinish = function () { p.classList.add("point"); };
      } catch (e) { p.classList.add("point"); }
    } else p.classList.add("point");
    pawTimer = setTimeout(hidePaw, ms || 2600);
  }

  function choose(i) {
    var q = Q(), el = $("options").children[i];
    if (!q || cur.locked || !el || el.disabled) return;
    hidePaw();
    if (i === q.correct) return right(el);
    cur.miss++; cur.wrong++;
    sfx("oops"); mood("oops");
    el.classList.remove("wobble"); void el.offsetWidth; el.classList.add("wobble", "tried"); el.disabled = true;
    var name = q.options[i].name, lead = "Let's try again. ";
    if (q.act === "count") lead = "That says " + name + ". ";
    else if (q.kind === "letter2pic") lead = "That is " + name + ". ";
    else if (q.kind === "pic2letter") lead = "That is the letter " + name + ". ";
    else if (q.kind === "qty") lead = "That group has " + name + ". ";
    if (cur.miss === 2) cur.hard++;             /* counted once per question, here, however often the hint is replayed */
    if (cur.miss >= 2) reveal(q);
    speak(lead + q.hint);
  }
  /* after two misses the right answer glows and the paw points at it */
  function reveal(q) {
    var el = $("options").children[q.correct];
    if (el) { el.classList.add("glow"); pawTo(el, null, 6000); }
  }
  function right(el) {
    var q = Q();
    cur.locked = true; cur.done++;
    var kids = $("options").children, i;
    for (i = 0; i < kids.length; i++) if (kids[i] !== el) kids[i].classList.add("fade");
    if (el) { el.classList.remove("glow"); el.classList.add("right"); }
    sfx("good"); mood("happy"); renderDots();
    speak(PRAISE[Math.floor(Math.random() * PRAISE.length)] + " " + q.done, nextAfter(q), 1500);
  }
  function nextAfter(q) { return function () { if (Q() === q) next(); }; }   /* ignore a voice that finishes after the child has moved on */
  function next() {
    if (!cur || screen !== "play") return;
    cur.i++;
    if (cur.i >= cur.qs.length) finishRound(); else renderQ();
  }

  /* counting helper: tap each thing to count it out loud */
  function countTap(g) {
    var q = Q(); if (!q || q.kind !== "count" || cur.locked || g.classList.contains("on")) return;
    cur.counted++; g.classList.add("on");
    var t = g.querySelector(".mark text"); if (t) t.textContent = cur.counted;
    sfx("pop", cur.counted); speak(C.NUM_WORDS[cur.counted]);
  }

  /* give KC treats: tap treats into the bowl, tap the bowl to take one back, then the green button */
  function treatTap(el) {
    var q = Q(); if (!q || q.kind !== "give" || cur.locked || el.classList.contains("gone")) return;
    hidePaw();
    el.classList.add("gone"); el.classList.remove("glow"); cur.placed++;
    $("bowl").innerHTML = bowlSvg(cur.placed);
    sfx("pop", cur.placed); speak(C.NUM_WORDS[cur.placed]);
  }
  function bowlTap() {
    var q = Q(), kids, i; if (!q || q.kind !== "give" || cur.locked || !cur.placed) return;
    kids = $("options").children;
    for (i = kids.length - 1; i >= 0; i--) if (kids[i].classList.contains("gone")) { kids[i].classList.remove("gone"); break; }
    cur.placed--; $("bowl").innerHTML = bowlSvg(cur.placed);
    sfx("tap"); speak(cur.placed ? C.NUM_WORDS[cur.placed] : "None");
  }
  function giveDone() {
    var q = Q(), kids, i, n; if (!q || q.kind !== "give" || cur.locked) return;
    hidePaw();
    if (cur.placed === q.target) { $("bowl").classList.remove("glow"); return right(null); }
    cur.miss++; cur.wrong++; sfx("oops"); mood("oops");
    var b = $("bowl"); b.classList.remove("wobble"); void b.offsetWidth; b.classList.add("wobble");
    var lead = cur.placed ? "That is " + C.NUM_WORDS[cur.placed] + ". " : "The bowl is empty. ";
    if (cur.miss >= 2) {                         /* show exactly which treats to tap */
      if (cur.miss === 2) cur.hard++;
      kids = $("options").children;
      for (i = 0; i < kids.length; i++) kids[i].classList.remove("gone", "glow");
      cur.placed = 0; b.innerHTML = bowlSvg(0);
      for (i = 0; i < q.target; i++) kids[i].classList.add("glow");
      pawTo(kids[0], null, 5000);
      speak(lead + "Let's do it together. Tap the glowing treats.");
    } else speak(lead + q.hint + (cur.placed < q.target ? " She needs more." : " That is too many. Tap the bowl to take one back."));
  }

  /* memory match */
  function cardTap(el) {
    var q = Q(), i = +el.dataset.i, a, b, kids = $("options").children, j;
    if (!q || q.kind !== "memory" || cur.locked || el.classList.contains("up")) return;
    hidePaw();
    for (j = 0; j < kids.length; j++) kids[j].classList.remove("glow");
    el.classList.add("up"); sfx("flip"); cur.flips.push(i);
    if (cur.flips.length === 1) {
      speak(C.nm(q.cards[i], 1));
      if (cur.streak >= 2) for (j = 0; j < kids.length; j++) if (j !== i && q.cards[j] === q.cards[i]) kids[j].classList.add("glow");   /* a helping hint after two misses in a row */
      return;
    }
    a = cur.flips[0]; b = cur.flips[1]; cur.flips = [];
    if (q.cards[a] === q.cards[b]) {
      kids[a].classList.add("matched"); kids[b].classList.add("matched"); kids[a].disabled = kids[b].disabled = true;
      cur.done++; cur.streak = 0; sfx("match"); mood("happy"); renderDots();
      if ($("options").querySelectorAll(".matched").length === q.cards.length) { cur.locked = true; speak(PRAISE[Math.floor(Math.random() * PRAISE.length)] + " " + q.done, nextAfter(q), 1500); }
      else speak("Two " + C.nm(q.cards[a], 2) + "!");
    } else {
      cur.wrong++; cur.streak++; cur.locked = true;
      speak(C.nm(q.cards[b], 1));
      later(function () { kids[a].classList.remove("up"); kids[b].classList.remove("up"); cur.locked = false; }, 1100);
    }
  }

  /* ---------- end of a round: level change and a sticker ---------- */
  function finishRound() {
    var act = cur.act, lv = S.lv[act], clean, hard, ids, missing, got;
    if (act === "memory") { clean = cur.wrong <= cur.total; hard = cur.wrong > cur.total * 3; }
    else { clean = cur.wrong <= 1; hard = cur.hard >= 2 || cur.wrong >= 5; }
    if (clean && lv < 3) lv++; else if (hard && lv > 1) lv--;
    cur.newLevel = lv; S.lv[act] = lv; S.rounds[act]++; cur.finished = true;
    if (cur.letters) { var used = cur.letters; S.deck = S.deck.filter(function (l) { return used.indexOf(l) < 0; }); }
    ids = A.STICKERS.map(function (s) { return s[0]; });
    missing = ids.filter(function (id) { return !S.stickers[id]; });
    got = missing.length ? missing[Math.floor(Math.random() * missing.length)] : ids[Math.floor(Math.random() * ids.length)];
    S.stickers[got] = (S.stickers[got] || 0) + 1; cur.sticker = got;
    store.save();
    showReward(got, lv);
  }
  function stickerName(id) { var i; for (i = 0; i < A.STICKERS.length; i++) if (A.STICKERS[i][0] === id) return A.STICKERS[i][1]; return id; }
  function showReward(id, lv) {
    var h = "", i, cols = ["#d7263d", "#1553b7", "#ffd21f", "#27b376", "#c58af0", "#f26a1b"];
    hidePaw();
    $("rewardSticker").innerHTML = A.pic(id); $("rewardSticker").dataset.sticker = id;
    $("rewardKc").innerHTML = A.kc(); $("rewardKc").firstChild.classList.add("happy");
    $("rHome").innerHTML = ICON.home; $("rAgain").innerHTML = ICON.again; $("rBook").innerHTML = ICON.book;
    for (i = 0; i < 3; i++) h += '<i class="' + (i < lv ? "on" : "") + '"></i>';
    $("rewardLevel").innerHTML = h; h = "";
    if (!RM.matches) for (i = 0; i < 26; i++) h += '<i style="left:' + (i * 3.9 + 1).toFixed(1) + "%;background:" + cols[i % 6] + ";animation-delay:-" + ((i * 0.37) % 3).toFixed(2) + "s;animation-duration:" + (2.6 + (i % 5) * 0.35).toFixed(2) + "s;" + (i % 3 === 0 ? "border-radius:50%;height:12px" : "") + '"></i>';
    $("confetti").innerHTML = h;
    setReward(true);
    sfx("sticker");
    speak("You did it! You earned a " + stickerName(id) + " sticker!");
  }

  /* ---------- sticker book ---------- */
  function showBook(newId) {
    var h = "", n = 0;
    A.STICKERS.forEach(function (s) {
      var have = S.stickers[s[0]] > 0; if (have) n++;
      h += have ? '<button class="slot got' + (s[0] === newId ? " new" : "") + '" data-sticker="' + s[0] + '" aria-label="' + s[1] + ' sticker">' + A.pic(s[0]) + "</button>"
                : '<div class="slot empty" aria-label="Not found yet">' + A.pic("paw") + "</div>";
    });
    show("book");
    $("bookBack").innerHTML = ICON.home;
    $("bookGrid").innerHTML = h;
    $("bookCount").textContent = n + " / " + A.STICKERS.length;
  }

  /* ---------- grown-ups corner, behind a two-step gate ---------- */
  var gate = { a: 0, b: 0, typed: "", holdTimer: 0, closeTimer: 0, keyDown: false, armed: false };
  function gateHoldStart(e) {
    if (e && e.preventDefault) e.preventDefault();
    gateHoldEnd();
    gate.keyDown = !!(e && e.type === "keydown");
    $("gateBtn").classList.add("holding");
    gate.holdTimer = setTimeout(function () { gateHoldEnd(); gateAsk(); }, 3000);
  }
  function gateHoldEnd() { clearTimeout(gate.holdTimer); gate.holdTimer = 0; $("gateBtn").classList.remove("holding"); }
  function gateAsk() {
    var h = "", i;
    gate.a = 6 + Math.floor(Math.random() * 4); gate.b = 6 + Math.floor(Math.random() * 4); gate.typed = "";
    $("gateQ").textContent = "What is " + gate.a + " × " + gate.b + "?";
    for (i = 1; i <= 9; i++) h += '<button data-k="' + i + '">' + i + "</button>";
    h += '<button data-k="del" aria-label="Delete">⌫</button><button data-k="0">0</button><button data-k="ok" class="ok">OK</button>';
    $("gatePad").innerHTML = h; $("gateOut").textContent = "";
    $("gate").hidden = false; gate.armed = false;
    SCREENS.forEach(function (id) { $(id).inert = true; });           /* nothing behind the question can be reached */
    try { $("gate").querySelector(".gateCard").focus({ preventScroll: true }); } catch (e) {}
    clearTimeout(gate.closeTimer); gate.closeTimer = setTimeout(gateClose, 30000);
  }
  function gateClose() {
    var was = !$("gate").hidden;
    clearTimeout(gate.closeTimer); $("gate").hidden = true; gate.typed = "";
    SCREENS.forEach(function (id) { $(id).inert = false; });
    if (was && screen === "home") { try { $("gateBtn").focus({ preventScroll: true }); } catch (e) {} }
  }
  function gateKey(k) {
    if (k === "del") gate.typed = gate.typed.slice(0, -1);
    else if (k === "ok") {
      if (gate.typed === String(gate.a * gate.b)) { gateClose(); showGrown(); }
      else { $("gateOut").textContent = "Not quite"; gate.typed = ""; clearTimeout(gate.closeTimer); gate.closeTimer = setTimeout(gateClose, 900); }
      return;
    } else if (gate.typed.length < 3) gate.typed += k;
    $("gateOut").textContent = gate.typed;
  }
  function sw(key, label, sub) { return '<button class="sw" role="switch" data-set="' + key + '" aria-checked="' + (key === "muted" ? !S.set.muted : !!S.set[key]) + '"><span>' + label + (sub ? '<small style="display:block;font-weight:400;color:#6a5a4d">' + sub + "</small>" : "") + '</span><span class="knob"></span></button>'; }
  function showGrown(confirming) {
    var h = "", n = 0;
    A.STICKERS.forEach(function (s) { if (S.stickers[s[0]]) n++; });
    h += "<h3>Progress</h3><div class=\"prog\">";
    C.ACTIVITIES.forEach(function (a) {
      h += '<div class="row">' + STOP_ICON[a] + "<div>" + ACT_NAMES[a] + "<small>" + S.rounds[a] + (S.rounds[a] === 1 ? " round" : " rounds") + ' finished</small></div><div class="lv">Level ' + S.lv[a] + " of 3</div></div>";
    });
    h += '</div><p>Stickers collected: <b>' + n + " of " + A.STICKERS.length + "</b>. Each activity moves up a level after a round with at most one slip, and back down after a round that was a struggle. Nothing is ever taken away from your child.</p>";
    h += "<h3>Sound</h3>" + sw("muted", "All sound", "Same as the music-note button your child can tap") + sw("voice", "Spoken instructions", hasVoice() ? "Uses this device's own text-to-speech" : "This device has no text-to-speech, so the app shows picture hints instead") + sw("sfx", "Sound effects") + sw("music", "Background melody");
    h += "<h3>Start again</h3>";
    h += confirming ? '<div class="resetRow"><b>Erase all levels and stickers?</b><button class="txtBtn danger" id="resetYes">Yes, erase</button><button class="txtBtn" id="resetNo">Keep them</button></div>'
                    : '<div class="resetRow"><button class="txtBtn danger" id="resetAsk">Reset progress</button></div>';
    h += '<h3>Privacy</h3><div class="note"><p><b>Nothing leaves this device.</b> KC\'s Learning Trail has no ads, no accounts, no in-app purchases, no analytics or tracking, no social features and no links to websites, stores or other apps.</p>' +
         "<p>It never connects to the internet. The only thing it stores is your child's levels, stickers and the sound settings above, saved on this device so they are still here next time. Reset progress, or uninstalling the app, erases them.</p>" +
         "<p>If spoken instructions are on, the words are read aloud by your device's own built-in voice.</p></div>";
    h += '<h3>About</h3><p>KC\'s Learning Trail, version ' + VERSION + ". Six short activities for ages 3 to 6: counting to ten, letters and first sounds, colors and shapes, patterns, memory and comparing. Starring KC, a real dog who loves the Pacific Northwest.</p>";
    show("grown");
    $("grownBack").innerHTML = ICON.back;
    $("grownBody").innerHTML = h;
  }

  /* ---------- input ---------- */
  function onFirstGesture() { gestureSeen = true; unlock(); }
  /* a touch only counts as a "user gesture" for audio when the finger lifts, so listen at both ends */
  ["pointerdown", "pointerup", "touchend", "click", "keydown"].forEach(function (ev) { document.addEventListener(ev, onFirstGesture, true); });
  document.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  document.addEventListener("dragstart", function (e) { e.preventDefault(); });

  /* what a tap (or Enter on a focused button) on element `t` does */
  function act(t) {
    var el;
    if (!t || !t.closest || !$("gate").hidden) return;
    if ((el = t.closest(".muteBtn"))) { S.set.muted = !S.set.muted; store.save(); setMuteIcons(); if (S.set.muted) hush(); else sfx("tap"); return; }
    if (screen === "home") {
      if ((el = t.closest(".stop"))) {
        var act = el.dataset.act, i = C.ACTIVITIES.indexOf(act);
        if ($("home").dataset.busy) return;
        $("home").dataset.busy = "1"; sfx("tap"); placeKc(i, true);
        later(function () { startActivity(act); }, RM.matches ? 60 : 760);     /* through later(): leaving the map cancels it */
        return;
      }
      if (t.closest("#bookBtn") && !$("home").dataset.busy) { sfx("tap"); showBook(); }
      return;
    }
    if (screen === "play") {
      if (t.closest("#homeBtn") || t.closest("#rHome")) { sfx("tap"); show("home"); return; }
      if (t.closest("#rAgain")) { sfx("tap"); startActivity(cur.act); return; }
      if (t.closest("#rBook")) { sfx("tap"); showBook(cur.sticker); return; }
      if (t.closest("#rewardSticker")) { sfx("pop"); speak(stickerName(cur.sticker)); return; }
      if (!$("reward").hidden) return;
      if (t.closest("#sayBtn")) { sfx("tap"); var q = Q(); if (q) speak(cur.miss ? q.say + " " + q.hint : q.say); if (q && cur.miss >= 2) reveal(q); else if (q && !cur.locked) demo(q); return; }
      if (t.closest("#doneBtn")) return giveDone();
      if (t.closest("#bowl")) return bowlTap();
      if ((el = t.closest(".opt"))) return choose(+el.dataset.i);
      if ((el = t.closest(".treat"))) return treatTap(el);
      if ((el = t.closest(".mcard"))) return cardTap(el);
      if ((el = t.closest(".cnt"))) return countTap(el);
      return;
    }
    if (screen === "book") {
      if (t.closest("#bookBack")) { sfx("tap"); show("home"); return; }
      if ((el = t.closest(".slot.got"))) { el.classList.remove("boing", "new"); void el.offsetWidth; el.classList.add("boing"); sfx("pop"); speak(stickerName(el.dataset.sticker)); }
      return;
    }
    if (screen === "grown") {
      if (t.closest("#grownBack")) { show("home"); return; }
      if ((el = t.closest(".sw"))) {
        var k = el.dataset.set; S.set[k] = !S.set[k]; store.save(); setMuteIcons(); if (!voiceReady()) hush();
        el.setAttribute("aria-checked", String(k === "muted" ? !S.set.muted : S.set[k])); return;
      }
      if (t.closest("#resetAsk")) return showGrown(true);
      if (t.closest("#resetNo")) return showGrown(false);
      if (t.closest("#resetYes")) { var keep = S.set; store.clear(); S = fresh(); S.set = keep; store.save(); setMuteIcons(); showGrown(false); }
    }
  }
  /* On the map and in an activity every finger is handled on its own, when it lifts: a thumb resting on the
     glass, or a finger that slides a little, must not stop a tap from counting. A tap counts when the finger
     comes up over the same button it went down on. The click event is kept for the keyboard, for the scrolling
     screens (sticker book, grown-ups) and for browsers without pointer events. */
  var HAS_PE = "PointerEvent" in window, downs = {}, eatClicksUntil = 0, ateTouch = false;
  function tapTarget(t) { return t && t.closest ? t.closest("button, .cnt") : null; }
  function perFinger() { return HAS_PE && (screen === "home" || screen === "play") && $("gate").hidden; }
  document.addEventListener("pointerdown", function (e) {
    ateTouch = false;
    if (e.target === $("gate")) gate.armed = true;                       /* a press that began on the backdrop after it appeared */
    if (!perFinger() || (e.pointerType === "mouse" && e.button !== 0)) { delete downs[e.pointerId]; return; }
    downs[e.pointerId] = tapTarget(e.target);
  });
  document.addEventListener("pointerup", function (e) {
    var from = downs[e.pointerId], to;
    delete downs[e.pointerId];
    if (!from || !perFinger()) return;
    to = tapTarget(document.elementFromPoint(e.clientX, e.clientY));
    if (to !== from || from.disabled) return;
    if (e.pointerType === "touch") ateTouch = true; else eatClicksUntil = Date.now() + 80;   /* a mouse or pen click follows at once */
    act(from);
  });
  document.addEventListener("pointercancel", function (e) { delete downs[e.pointerId]; });
  /* the tap was already handled when the finger lifted: stop the browser turning it into a click as well,
     which could land on whatever button the new screen has put under the finger */
  document.addEventListener("touchend", function (e) { if (ateTouch && e.cancelable) e.preventDefault(); ateTouch = false; }, { passive: false });
  document.addEventListener("click", function (e) {
    if (e.detail !== 0 && Date.now() < eatClicksUntil) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  document.addEventListener("click", function (e) {
    if (e.detail !== 0 && perFinger()) return;                           /* real taps there are handled above */
    act(e.target);
  });
  /* the gate: press and hold for three seconds, then answer a times-table question */
  (function () {
    var b = $("gateBtn");
    b.addEventListener("pointerdown", gateHoldStart);
    /* no click is made from this long press, so lifting the finger cannot press something in the question box */
    b.addEventListener("touchstart", function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { b.addEventListener(ev, gateHoldEnd); });
    /* a captured touch never fires pointerleave, so watch where the finger actually is */
    b.addEventListener("pointermove", function (e) {
      if (!gate.holdTimer || gate.keyDown) return;
      var el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || !b.contains(el)) gateHoldEnd();
    });
    b.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && !e.repeat) gateHoldStart(e); });
    b.addEventListener("keyup", gateHoldEnd);
    b.addEventListener("blur", gateHoldEnd);
    $("gatePad").addEventListener("click", function (e) { var k = e.target.closest && e.target.closest("button"); if (k) gateKey(k.dataset.k); });
    $("gateCancel").addEventListener("click", gateClose);
    /* tapping outside the box closes it, but only a tap that began there after the box appeared:
       the finger that was holding the button is still down when it opens and must not dismiss it */
    $("gate").addEventListener("click", function (e) { if (e.target === $("gate") && gate.armed) gateClose(); });
    document.addEventListener("keyup", function () { gate.keyDown = false; });
  })();
  /* keyboard: Tab and Enter work on every button; these are shortcuts on top */
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!$("gate").hidden) {
      if (e.repeat || (gate.keyDown && (e.key === "Enter" || e.key === " "))) { e.preventDefault(); return; }   /* the key that was held to open the gate is not an answer */
      if (/^[0-9]$/.test(e.key)) gateKey(e.key); else if (e.key === "Backspace") gateKey("del"); else if (e.key === "Enter") { e.preventDefault(); gateKey("ok"); } else if (e.key === "Escape") gateClose(); return; }
    if (e.key === "m" || e.key === "M") { var mb = document.querySelector(".screen:not([hidden]) .muteBtn"); if (mb) mb.click(); return; }
    if (e.key === "Escape") { if (screen !== "home" || $("home").dataset.busy) show("home"); return; }
    if (screen === "home" && /^[1-6]$/.test(e.key)) { $("stops").children[+e.key - 1].click(); return; }
    if (screen === "play" && $("reward").hidden) {
      var kids = $("options").children, n = /^[1-9]$/.test(e.key) ? +e.key : e.key === "0" ? 10 : 0;
      if (n && kids[n - 1]) kids[n - 1].click();
      else if (e.key === "r" || e.key === "R") $("sayBtn").click();
      else if (e.key === "Enter" && !$("doneBtn").hidden && document.activeElement === document.body) $("doneBtn").click();
      else if (e.key === "Backspace" && $("bowl")) $("bowl").click();
    } else if (screen === "play" && e.key === "Enter" && document.activeElement === document.body) $("rAgain").click();
  });

  /* ---------- resize, rotation, tab hidden ---------- */
  var rz = 0;
  function onResize() { cancelAnimationFrame(rz); rz = requestAnimationFrame(function () { hidePaw(); if (screen === "home") layoutHome(); else if (screen === "play" && cur && Q()) { if (Q().kind === "memory") relayoutMemory(); fit(); } }); }
  function relayoutMemory() { var q = Q(), land = innerWidth > innerHeight, n = q.cards.length; $("options").dataset.cols = land ? q.cols : (n === 4 ? 2 : n === 12 ? 3 : 2); }
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { pauseTimers(); hush(); gateHoldEnd(); downs = {}; if (AC && AC.state === "running") { try { AC.suspend(); } catch (e) {} } }
    else {
      if (AC && gestureSeen) { try { var pr = AC.resume(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} }
      resumeTimers();                            /* the round carries on from where it was */
      if (screen === "play" && cur && Q() && $("reward").hidden && !cur.locked && $("gate").hidden) sayQuestion(true);   /* say the instruction that was cut off */
    }
  });
  /* the Android shell calls this for the Back button: true means "handled, stay in the app" */
  window.KCBack = function () {
    if (!$("gate").hidden) { gateClose(); return true; }
    if (screen !== "home") { show("home"); return true; }
    return false;
  };
  window.addEventListener("pagehide", hush);

  /* ---------- start ---------- */
  buildHome();
  $("homeBtn").innerHTML = ICON.home; $("sayBtn").innerHTML = ICON.say; $("doneBtn").innerHTML = ICON.check;
  setMuteIcons();
  show("home");

  /* ---------- test hooks, only with ?debug=1 ---------- */
  if (DEBUG) {
    window.__kc = {
      version: VERSION, spoken: spoken,
      save: function () { return JSON.parse(JSON.stringify(S)); },
      state: function () { var q = Q(); return { screen: screen, reward: screen === "play" && !$("reward").hidden, gate: !$("gate").hidden, act: cur && cur.act, level: cur && cur.level, index: cur && cur.i, of: cur && cur.qs.length, done: cur && cur.done, total: cur && cur.total, kind: q && q.kind, locked: cur && cur.locked, miss: cur && cur.miss, wrong: cur && cur.wrong, placed: cur && cur.placed, sticker: cur && cur.sticker, audio: AC ? AC.state : "none", voice: hasVoice(), hard: cur && cur.hard, paused: paused, deck: S.deck.length }; },
      hide: function (on) { Object.defineProperty(document, "hidden", { configurable: true, get: function () { return !!on; } }); document.dispatchEvent(new Event("visibilitychange")); },
      question: function () { return Q() ? JSON.parse(JSON.stringify(Q())) : null; },
      validate: function () { return Q() ? C.validate(Q()) : []; },
      start: function (act, level) { startActivity(act, level); },
      /* answer the current question correctly through the same code paths a tap uses */
      answer: function () {
        var q = Q(), kids = $("options").children, i, j;
        if (!q || cur.locked || !$("reward").hidden) return false;
        if (q.kind === "memory") {
          for (i = 0; i < kids.length; i++) if (!kids[i].classList.contains("matched")) {
            if (cur.flips.length === 1) i = cur.flips[0]; else cardTap(kids[i]);
            for (j = 0; j < kids.length; j++) if (j !== i && q.cards[j] === q.cards[i]) { cardTap(kids[j]); return true; }
          }
          return false;
        }
        if (q.kind === "give") {
          while (cur.placed > q.target) bowlTap();
          for (i = 0; i < kids.length && cur.placed < q.target; i++) if (!kids[i].classList.contains("gone")) treatTap(kids[i]);
          giveDone(); return true;
        }
        choose(q.correct); return true;
      },
      wrong: function () { var q = Q(), kids = $("options").children, i; if (!q || cur.locked) return false; if (q.kind === "give") { giveDone(); return true; } for (i = 0; i < kids.length; i++) if (i !== q.correct && !kids[i].disabled) { choose(i); return true; } return false; },
      gateAnswer: function () { return gate.a * gate.b; },
      home: function () { show("home"); }
    };
  }
})();
