# KC's Learning Trail

An original early-learning game for children aged 3 to 6, starring KC, the real dog behind KC Beyond Limits.
KC walks a Pacific Northwest trail with six stops. Each stop is a short round, and every finished round earns
a sticker for the sticker book.

| Stop | Skill | Level 1 | Level 2 | Level 3 |
|---|---|---|---|---|
| 1 | Counting | count 1 to 5, three numerals | count 1 to 10, plus "give KC n treats" (1 to 5) | scattered groups 4 to 10, four numerals, give 3 to 10 treats |
| 2 | Letters | letter to picture, easy wrong choices, the word is spoken | letter to picture: name, sound, and the picture words read out in order | four choices, and picture to letter |
| 3 | Colours and shapes | tap the red one / tap the triangle | tap the red triangle (4), sort into 2 baskets | 6 choices, sort into 3 baskets |
| 4 | Patterns | AB | AAB, ABB, AB | ABC, AAB, ABB |
| 5 | Memory match | 2x2 then 3x2 | 3x2 then 4x2 | 4x3 |
| 6 | Comparing | bigger / smaller of two | biggest / smallest of three, more / fewer (clear gap) | most / fewest of two or three close groups |

It is built to ship as a **paid, made-for-kids Android app**: the `www/` folder is bundled inside the app and
loaded from local storage. It also runs from any static file server.

## Run it locally

```
cd kids/kc-learning-trail/www
python3 -m http.server 8852
# open http://localhost:8852/
```

There is no build step. Opening `www/index.html` straight from disk works too.

Add `?debug=1` for the test hooks (`window.__kc`, see below) and `?debug=1&fast=1` to shorten the pauses.

## Files

```
www/index.html            page skeleton (four screens and the parental gate)
www/app.css               all styling, portrait / landscape / tablet, reduced motion
www/art.js                every picture, drawn in code as inline SVG (KC, stickers, shapes, icons)
www/content.js            the learning content: tables + question generators + validate()
www/app.js                screens, input, sound (Web Audio), voice (speechSynthesis), saving
www/manifest.webmanifest  name, colours, icons
www/icons/                icon-192.png, icon-512.png, maskable-512.png (made by tools/make-icons.js)
tools/make-icons.js       renders the icons from KC's face with Playwright
tests/content-check.js    generates thousands of questions and checks each has exactly one right answer
tests/e2e.js              Playwright run-through of the whole app at phone and tablet sizes
```

## How the content is structured

Everything a child is asked comes from `www/content.js`. It has no DOM code, so it also runs in Node.

`makeRound(activity, level, rng, opts)` returns the questions for one round (five questions, or one or two
memory boards). A question is plain data:

```js
{ act: "letters", kind: "letter2pic",
  prompt:  { k: "letter", L: "b" },                 // what the big card shows
  say:  "This is the letter bee. ...",              // spoken instruction
  hint: "bee is for ball.",                         // spoken after a wrong tap
  done: "Yes! bee is for ball.",                    // spoken after the right tap
  options: [ { vis: { k: "emo", ch: "🍎" }, name: "apple", letter: "a" }, ... ],
  correct: 1,
  meta: { type: "letter2pic", L: "b" } }            // what validate() needs to re-derive the answer
```

A *visual* (`prompt`, `options[i].vis`) is a small description that `app.js` turns into SVG:
`pic` (a drawing from `art.js`), `emo` (an emoji), `num`, `letter`, `shape`, `blob` (a paint splash),
`outline`, `group` (n things in a grid), `sized`, `bin` (a sorting basket), `seq` (a pattern) and `cmp`.

To add or change content:

- **A letter's picture**: edit its row in `LETTERS`. `starts` must list *every* first letter a child might
  say for that picture (for example the queen is `["q","p","k","c","g","l"]` because a child may say princess,
  king, crown, girl or lady). A picture is never offered as a wrong choice for any letter in its `starts`, or
  for a letter that sounds the same (`CLASH`: c/k/q, s/x/z). `TRICKY` pairs (b/d/p, m/n ...) are kept out of level 1.
  `NAME_SOUND` lists letters whose spoken *name* begins with another letter's sound ("em" like egg, "double you"
  like donut, "why" like watermelon); those pictures are never wrong choices for that letter. X uses "x-ray",
  which really begins with the letter's name (a xylophone begins with a Z sound).
  The Letters deck (saved) loses a round's five letters only when the round is finished; an abandoned round
  moves them to the back, so all 26 always come round.
- **Things to count, compare, or make patterns from**: add the id to `COUNT_THINGS`, `COMPARE_THINGS` or
  `PATTERN_THINGS`, add its spoken name to `NAMES`, and draw it in `art.js` as `P.<id>` (a 100 x 100 SVG fragment).
- **Memory animals**: `MEMORY_ANIMALS`; board sizes per level are in `MEMORY_BOARDS`.
- **Colours and shapes**: `COLOR_NAMES` / `SHAPE_NAMES` here, paint values and outlines in `art.js`
  (`COLORS`, `SHAPES`). Colours differ in lightness as well as hue and every shape has a dark outline.
- **Pattern types per level**: `PATTERN_UNITS`. The repeating unit is always shown at least twice in full.
- **A new sticker**: draw `P.<id>` in `art.js` and add `["<id>", "spoken name"]` to `STICKERS` (27 today).
- **A new kind of question**: write a generator next to the others, give it a `meta.type`, and teach
  `validate()` how to work out the right answer independently.

After any content change run:

```
node tests/content-check.js
```

It generates over 26,000 questions (at least 700 per activity) and fails if any question has zero or several
right answers, duplicate choices, a group outside 1 to 10, or a pattern with more than one continuation.

## How it plays

- No reading needed: every prompt is a big picture, numeral or letter. A pointing paw shows what to do the first
  time each kind of question appears, and the orange speech button repeats the instruction.
- Voice uses the device's own text-to-speech with an English voice at a slightly slow rate. In a browser that
  is `speechSynthesis`. Inside the Android app, where a WebView usually has no `speechSynthesis` voices, the
  shell in `android/` offers the phone's own TextToSpeech as `window.KCNative` (`canSpeak()`, `speak(text, rate,
  pitch)`, `stopSpeaking()`), and the game uses it whenever `canSpeak()` is true. With neither, the app stays
  silent and relies on the pictures.
- The Android Back button calls `window.KCBack()`: it closes the grown-ups question or returns to the trail map
  and answers `true`; on the map it answers `false` and the app closes.
- Taps are handled per finger when it lifts (pointer events) on the map and in activities, so a thumb resting
  on the glass or a finger that slides a little does not stop a tap from counting.
- When the app goes to the background the round pauses (timers held, voice stopped); on return it carries on
  and says the current instruction again.
- Never punishing: a wrong tap wobbles, fades that choice and gives a hint; after two misses the right answer
  glows and the paw points to it. No timers, lives or scores.
- Adaptive: a round with at most one slip moves that activity up a level; a round where two questions needed the
  highlight (or five slips in total) moves it down. Memory uses the number of mismatches instead.
- Sound is synthesized with Web Audio (effects and a quiet looping melody). Nothing plays before the first touch.
  The music-note button mutes everything.
- Grown-ups' corner: press and hold the lock button for three seconds, then answer a times-table question.
  It shows level and rounds per skill, switches for voice, effects and melody, reset, and the privacy note.
- Keyboard: Tab / Enter on any button; `1`-`6` pick a stop or an answer, `R` repeats, `M` mutes, `Esc` goes back.

## Privacy facts

- **Zero network requests.** No CDN scripts, web fonts, analytics, remote images or service calls. The Playwright
  test fails if the page requests anything other than its own local files.
- **No ads, no in-app purchases, no accounts, no social features, no user-generated content.**
- **No links** to websites, stores, social media or other apps anywhere, including behind the parental gate.
- **No data collection.** The only thing stored is the child's levels, stickers and sound settings, in
  `localStorage` on the device under the key `kcLearningTrail.v1`. Reset progress (grown-ups' corner) or
  uninstalling erases it. If storage is unavailable the game still works; it just starts fresh each time.
- No camera, microphone, location, contacts or any other device permission is used.
- Spoken instructions are produced by the device's built-in text-to-speech. Note for the store listing: some
  devices' speech engines are themselves online services; the app does not control that. Turning "Spoken
  instructions" off in the grown-ups' corner stops all use of it.

## Tests

```
node tests/content-check.js                          # content correctness, no browser needed
cd www && python3 -m http.server 8852 &              # then:
node tests/e2e.js http://localhost:8852 [shots-dir]  # needs Playwright with Chromium
```

Debug hooks (only with `?debug=1`): `__kc.state()`, `__kc.question()`, `__kc.validate()`, `__kc.answer()`,
`__kc.wrong()`, `__kc.start(activity, level)`, `__kc.home()`, `__kc.save()`, `__kc.gateAnswer()`, `__kc.hide(true|false)` (pretend the tab is hidden), `__kc.spoken`.
In debug mode the right choice also carries `data-correct="1"`, memory cards carry `data-animal`, and the bowl
carries `data-target`.

## Originality

All characters, art, sounds, music and layouts here are original to this project and drawn or synthesized in code.
