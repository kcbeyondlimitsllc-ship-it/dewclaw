/* Builds Dewclaw's guide pages: one per breed, the hubs, the calculators,
   the body-condition chart, the method page, sitemap.xml and robots.txt.

     node tools/build-pages.mjs            (Node 18+, no packages)

   Every number on these pages comes out of the app's own care engine, cut
   straight from site/index.html, so a page can never disagree with the
   chart the app draws for the same pet. Run it again after the breed data
   or the engine changes, and commit what it writes under site/.

   ORIGIN is the address the site is served from. Change it here (or pass
   DEWCLAW_ORIGIN=https://…) when Dewclaw moves to its own domain. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "site");
const ORIGIN = (process.env.DEWCLAW_ORIGIN || "https://dewclaw-app.netlify.app").replace(/\/+$/, "");
/* The day the breed data and the page wording were last gone over by a
   person. Change it only when they really have been: it is printed on
   every page as "Last reviewed". */
const REVIEWED = "2026-11-10";
const REVIEWED_TEXT = new Date(REVIEWED + "T12:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const WHO = "KC Beyond Limits LLC";

/* ---- the engine, cut from the app ------------------------------------ */
const html = fs.readFileSync(path.join(SITE, "index.html"), "utf8");
const END = "else self.PetLifeEngine = PetLifeEngine;\n})();";
const end = html.indexOf(END) + END.length;
const start = html.lastIndexOf("\n<script>\n", end) + 10;
if (end < END.length || start < 10) throw new Error("could not find the care engine in site/index.html");
const block = html.slice(start, end);
/* engine.js for the page calculators: only the modules the engine needs */
const WANT = /else self\.(PetLifeTiers|PetLifeBreedsExtra|PetLifeBreeds|PetLifeEngine) = /;
const mods = block.split(/\n(?=\(function ?\(\) ?\{\n)/).filter(m => WANT.test(m));
if (mods.length !== 4) throw new Error("expected 4 engine modules, found " + mods.length);
const engineJs = "/* Dewclaw's care engine, cut from index.html by tools/build-pages.mjs. Do not edit: edit index.html and rebuild. */\n" + mods.join("\n") + "\n";
const self = {};
vm.runInContext(engineJs, vm.createContext({ self, console }));
const E = self.PetLifeEngine, B = self.PetLifeBreeds;

/* ---- small helpers --------------------------------------------------- */
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const bold = s => (/\*\*(.+?)\*\*/.exec(s || "") || [, ""])[1];
const slugify = s => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const lb = kg => kg * 2.2046226;
const num = n => Number(n).toLocaleString("en-US");
const range = (a, b) => a === b ? `${a}` : `${a}–${b}`;
const SIZE = { toy: "Toy", small: "Small", medium: "Medium", large: "Large", giant: "Giant", cat: "Cat" };

function chartFor(species, breed, o = {}) {
  const I = { species, breed, ageY: 4, ageM: 0, unit: "lb", sex: "m", fixed: "1", bcs: 5, activity: "normal", kcalCup: 360, ...o };
  const c = E.buildChart(I, { tier: "beyond" });
  const sec = id => c.sections.find(s => s.id === id);
  const row = (s, k) => (s?.rows || []).find(r => r.k === k);
  const n = sec("nutrition");
  return { c, sec, row,
    kcal: Number(c.vitals[2].v), kcalNote: c.vitals[2].note, stage: c.vitals[0].v,
    cups: bold(row(n, "Portion")?.v).replace(" cups", ""),
    meals: bold(row(n, "Meals")?.v), treat: bold(row(n, "Treat budget")?.v).replace(" kcal", ""),
    water: c.vitals[3].v };
}

/* ---- the breed list --------------------------------------------------- */
function breedsOf(species) {
  const db = species === "dog" ? B.DOGS : B.CATS, dir = species === "dog" ? "dogs" : "cats";
  return Object.entries(db).map(([key, b]) => {
    const mix = key.startsWith("mix-");
    /* "Mixed breed — toy (under 10 lb)" reads better as a page name the other way round */
    const name = mix ? `${SIZE[b.size]} Mixed-Breed Dog` : b.n.replace(/^(.+) \((.+)\)$/, (_, a, q) => /^(Standard|Miniature|Toy|English|American|Pembroke|Cardigan|Smooth|Rough|Wire|Long|Short|Giant)/.test(q) ? `${q} ${a}` : `${a} (${q})`);
    const lo = Math.round(lb(b.kg[0])), hi = Math.round(lb(b.kg[1]));
    return { key, b, species, dir, mix, name, label: b.n, slug: mix ? `mixed-breed-${b.size}` : slugify(name),
             lo, hi, mid: Math.round((lo + hi) / 2 * (hi < 20 ? 2 : 1)) / (hi < 20 ? 2 : 1) };
  });
}
const DOGS = breedsOf("dog"), CATS = breedsOf("cat"), ALL = [...DOGS, ...CATS];
{ const seen = new Set(); for (const p of ALL) { const k = p.dir + "/" + p.slug; if (seen.has(k)) throw new Error("duplicate slug " + k); seen.add(k); } }
const urlOf = p => `/${p.dir}/${p.slug}/`;

/* ---- page chrome ------------------------------------------------------ */
function page({ url, title, desc, h1, crumbs, body, ld = [], calc = false }) {
  const canon = ORIGIN + url;
  const bc = { "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c[0], item: ORIGIN + c[1] })) };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<meta name="theme-color" content="#1F4A33">
<link rel="icon" href="/icons/icon-192.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Dewclaw">
<meta property="og:title" content="${esc(title.replace(/ \| Dewclaw$/, ""))}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${ORIGIN}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@600;700&family=Figtree:wght@400..700&display=swap">
<link rel="stylesheet" href="/guide.css">
${[bc, ...ld].map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body>
<header class="top"><div class="wrap topbar">
  <a class="brand" href="/"><img src="/icons/icon-192.png" alt="" width="30" height="30">Dewclaw</a>
  <nav class="topnav" aria-label="Guides"><a href="/dogs/">Dog breeds</a><a href="/cats/">Cat breeds</a><a href="/dog-calorie-calculator/">Calorie calculator</a></nav>
  <a class="btn sm" href="/index.html?utm_source=guide&amp;utm_medium=header#/app">Open the app</a>
</div></header>
<main class="wrap">
<nav class="crumbs" aria-label="Breadcrumb">${crumbs.map((c, i) => i < crumbs.length - 1 ? `<a href="${c[1]}">${esc(c[0])}</a> › ` : esc(c[0])).join("")}</nav>
<h1>${esc(h1)}</h1>
${body}
</main>
<footer class="foot"><div class="wrap">
  <p><a href="/dogs/">Dog breeds</a><a href="/cats/">Cat breeds</a><a href="/dog-calorie-calculator/">Dog calorie calculator</a><a href="/cat-calorie-calculator/">Cat calorie calculator</a><a href="/body-condition-score/">Body condition chart</a><a href="/how-we-calculate/">How we calculate</a><a href="/for-shelters/">For shelters</a></p>
  <p><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="https://www.kcbeyondlimits.com">KC Beyond Limits</a></p>
  <p>Dewclaw is made by ${WHO} in Oregon. It is not a veterinarian.</p>
</div></footer>
${calc ? '<script src="/engine.js" defer></script>\n<script src="/guide.js" defer></script>' : ""}
</body>
</html>
`;
}

const DISCLAIMER = `<p class="disclaimer"><b>Dewclaw is not a veterinarian.</b> These figures are computed from published general-population formulas and breed tendencies. They are a starting point for a conversation with your vet, not a diagnosis or a treatment plan. Health conditions, medication, pregnancy and nursing all change them. If something seems wrong with your pet, call your veterinarian or an emergency clinic.</p>`;

const article = (p, title, desc) => ({ "@context": "https://schema.org", "@type": "Article", headline: title,
  description: desc, datePublished: REVIEWED, dateModified: REVIEWED, image: ORIGIN + "/og.png",
  author: { "@type": "Organization", name: WHO, url: "https://www.kcbeyondlimits.com" },
  publisher: { "@type": "Organization", name: "Dewclaw", url: ORIGIN + "/" }, mainEntityOfPage: ORIGIN + p });

function calcCard({ species, breed, weight, picker, heading }) {
  const acts = (species === "dog" ? B.DOG_ACT : B.CAT_ACT).map(([v, l]) => `<option value="${v}"${v === "normal" ? " selected" : ""}>${esc(l)}</option>`).join("");
  const dog = species === "dog";
  return `<section class="card calc" aria-labelledby="calcH">
<h2 id="calcH">${esc(heading)}</h2>
<form id="calc" data-species="${species}" data-breed="${breed}">
  ${picker ? `<div class="full"><label for="cBreed">Breed</label><select id="cBreed"></select></div>` : ""}
  <div><label for="cWeight">Healthy weight</label><div class="pair"><input id="cWeight" type="number" inputmode="decimal" min="0.5" max="300" step="0.5" value="${weight}"><select id="cUnit" aria-label="Unit"><option value="lb">lb</option><option value="kg">kg</option></select></div></div>
  <div><label for="cAge">Age in years</label><input id="cAge" type="number" inputmode="decimal" min="0" max="30" step="0.25" value="4"></div>
  <div><label for="cFixed">${dog ? "Spayed or neutered" : "Spayed or neutered"}</label><select id="cFixed"><option value="1">Yes</option><option value="0">No</option></select></div>
  <div><label for="cAct">${dog ? "Activity" : "Lifestyle"}</label><select id="cAct">${acts}</select></div>
  <div class="full"><label for="cKcal">Calories per cup of your food (it is printed on the bag)</label><input id="cKcal" type="number" inputmode="numeric" min="100" max="900" step="5" value="360"></div>
</form>
<div class="out" aria-live="polite">
  <div><span>Calories a day</span><b id="oKcal">–</b><small id="oKcalNote"></small></div>
  <div><span>Cups a day</span><b id="oCups">–</b><small id="oMeals"></small></div>
  <div><span>Treat budget</span><b id="oTreat">–</b><small>kcal, taken out of meals</small></div>
  <div><span>${dog ? "Exercise" : "Play"}</span><b id="oMove">–</b><small>${dog ? "minutes a day" : "a day"} · <span id="oStage" style="display:inline"></span></small></div>
</div>
<p class="note">Enter the weight your ${dog ? "dog" : "cat"} should be, not the weight they are, if they are carrying extra. For a growing ${dog ? "puppy" : "kitten"}, enter today's weight and age.</p>
<div class="go"><a class="btn" id="cGo" data-base="/" href="/index.html?species=${species}&amp;breed=${breed}&amp;w=${weight}&amp;unit=lb&amp;utm_source=guide&amp;utm_medium=calc#/app">Build the full care plan, free</a><span class="note">No account. Works offline.</span></div>
</section>`;
}

const rowsList = rows => `<dl class="rows">${rows.map(r => `<div><dt>${esc(r.k)}</dt><dd>${rich(r.v)}${r.hint ? `<small>${esc(r.hint)}</small>` : ""}</dd></div>`).join("")}</dl>`;

/* ---- a breed page ------------------------------------------------------ */
function breedPage(p) {
  const { b, species, name } = p, dog = species === "dog";
  const animal = dog ? "dog" : "cat", young = dog ? "puppy" : "kitten";
  const A = chartFor(species, p.key, { weight: p.mid });
  const plural = A.sec("watchlist").title.replace(/^What (.+) are prone to$/, "$1");
  const Name = p.mix ? "A " + name.toLowerCase() : "A " + name;       /* sentence openers */
  const the = p.mix ? "a " + name.toLowerCase() : "a " + name;
  const kgTxt = `${range(b.kg[0], b.kg[1])} kg`;
  const wTxt = `${range(p.lo, p.hi)} lb`;
  const tl = A.c.timeline, stage = k => tl.stages.find(s => s.key === k);
  const yr = v => v < 1 ? `${Math.round(v * 12)} months` : `${+v.toFixed(1)} ${v === 1 ? "year" : "years"}`;
  const en = B.ENERGY[b.e], coat = B.COAT[b.coat];
  const act0 = A.sec("activity").rows[0];
  /* dogs: "60–90 minutes"; cats: "2–3 sessions of 15–20 minutes" */
  const move = dog ? bold(act0.v) : act0.v.replace(/\*\*/g, "");
  const moveShort = dog ? bold(act0.v).replace(" minutes", " min") : bold(act0.v);
  const moveSmall = dog ? `${en.label} energy` : act0.v.replace(/^.*\*\* /, "") + " each";

  /* feeding by weight, across the healthy range */
  const step = p.hi - p.lo, half = p.hi < 20;
  const weights = [...new Set([0, .25, .5, .75, 1].map(t => { const w = p.lo + step * t; return half ? Math.round(w * 2) / 2 : Math.round(w); }))];
  const feed = weights.map(w => ({ w, ...chartFor(species, p.key, { weight: w }) }));
  const intact = chartFor(species, p.key, { weight: p.mid, fixed: "0" });
  const active = chartFor(species, p.key, { weight: p.mid, activity: "active" });
  const low = chartFor(species, p.key, { weight: p.mid, activity: "low" });
  const seniorAge = Math.ceil(stage("senior").from + 0.5);
  const senior = chartFor(species, p.key, { weight: p.mid, ageY: seniorAge });
  const acts = Object.fromEntries((dog ? B.DOG_ACT : B.CAT_ACT));
  const situations = [
    [`Spayed or neutered adult, ${acts.normal.toLowerCase()}`, A],
    ["Intact adult", intact],
    [acts.low, low],
    [acts.active, active],
    [`Senior (age ${seniorAge})`, senior]
  ];

  const title = [`${name} Weight, Feeding Chart & Lifespan | Dewclaw`, `${name} Weight & Feeding Chart | Dewclaw`, `${name} Feeding Chart | Dewclaw`].find(t => t.length <= 62) || `${name} | Dewclaw`;
  const desc = `A healthy adult ${p.mix ? name.toLowerCase() : name} weighs ${wTxt}, lives ${range(b.yrs[0], b.yrs[1])} years and needs about ${num(A.kcal)} kcal a day at ${p.mid} lb. Feeding chart, exercise, top health risks and a free calculator.`;
  const url = urlOf(p);

  const watch = A.sec("watchlist").items;
  const groom = A.sec("grooming").rows;
  const act = A.sec("activity").rows;
  const sameSize = (dog ? DOGS : CATS).filter(q => q !== p && !q.mix && q.b.size === b.size)
    .sort((x, y) => Math.abs(x.mid - p.mid) - Math.abs(y.mid - p.mid)).slice(0, 6);

  const faq = [
    [`How much should ${the} weigh?`, `A healthy adult ${p.mix ? name.toLowerCase() : name} usually weighs ${wTxt} (${kgTxt}). The number matters less than body condition: you should feel the ribs without pressing and see a waist from above.`],
    [`How much should I feed ${the}?`, `A spayed or neutered adult at ${p.mid} lb needs about ${num(A.kcal)} kcal a day, which is roughly ${A.cups} cups of a 360 kcal-per-cup food split into ${A.meals} meals. Check the calories per cup on your own bag, because foods range from under 300 to over 450.`],
    [`How long do ${plural} live?`, `Typically ${range(b.yrs[0], b.yrs[1])} years. They count as senior from about age ${+stage("senior").from.toFixed(1)}, when twice-yearly vet visits start to pay off.`],
    [dog ? `How much exercise does ${the} need?` : `How much play does ${the} need?`, `About ${move} a day for a healthy adult. ${act[0]?.hint || ""}`.trim()],
    [`What health problems are ${plural} prone to?`, `The ones to know about are ${watch.map(w => w.name.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " and $1")}. A predisposition is not a diagnosis, but it tells you what to screen for and what to mention to your vet.`]
  ];

  const body = `
<p class="lede">${Name === "A " + name && /^[AEIOU]/.test(name) ? "An " + name : Name} is healthy at <b>${wTxt}</b> (${kgTxt}) as an adult and typically lives <b>${range(b.yrs[0], b.yrs[1])} years</b>. At ${p.mid} lb, a spayed or neutered adult needs about <b>${num(A.kcal)} kcal a day</b>, roughly ${A.cups} cups of a typical dry food, and <b>${move}</b> of ${dog ? "exercise" : "play"}.</p>
<p class="meta">Last reviewed ${REVIEWED_TEXT} · Computed from breed data by Dewclaw's care engine · <a href="/how-we-calculate/">How we calculate</a></p>

<dl class="facts">
  <div><dt>Healthy adult weight</dt><dd>${wTxt}<small>${kgTxt}</small></dd></div>
  <div><dt>Typical lifespan</dt><dd>${range(b.yrs[0], b.yrs[1])} years</dd></div>
  <div><dt>Calories a day</dt><dd>${num(feed[0].kcal)}–${num(feed[feed.length - 1].kcal)}<small>kcal, neutered adult</small></dd></div>
  <div><dt>${dog ? "Exercise" : "Play"} a day</dt><dd>${moveShort}<small>${esc(moveSmall)}</small></dd></div>
  <div><dt>${dog ? "Size" : "Coat"}</dt><dd>${dog ? SIZE[b.size] : esc(coat.shed.split(",")[0])}<small>${dog ? esc(coat.shed) : ""}</small></dd></div>
  <div><dt>Senior from</dt><dd>Age ${+stage("senior").from.toFixed(1)}<small>${young} until ${yr(stage("adult").from)}</small></dd></div>
</dl>

${calcCard({ species, breed: p.key, weight: p.mid, heading: `Your ${p.mix ? animal : name}'s numbers` })}

<h2 id="weight">Healthy ${p.mix ? "" : name + " "}weight</h2>
<p>The healthy adult range is <b>${wTxt}</b> (${kgTxt}). ${p.mix ? "Mixed-breed dogs vary a lot, so treat the range as a guide" : "Individual frames differ, so treat the range as a guide"} and judge by body condition instead of the scale alone.</p>
<p>${esc(B.BCS_DESC[5])} That is a body condition score of 5 on the 9-point scale vets use. <a href="/body-condition-score/">See all nine scores</a> and find where your ${animal} sits.</p>
<p>A ${young} of this ${p.mix ? "size" : "breed"} is still growing until about <b>${yr(stage("adult").from)}</b>. Until then, weigh weekly and follow the trend with your vet instead of aiming at an adult number.</p>

<h2 id="feeding">${p.mix ? "Feeding chart" : name + " feeding chart"} by weight</h2>
<p>Daily calories for a spayed or neutered adult with ${acts.normal.toLowerCase()}, across the healthy weight range. Cups assume a food with 360 kcal per cup.</p>
<div class="tablewrap"><table>
<thead><tr><th>Healthy weight</th><th>Calories a day</th><th>Cups a day</th><th>Treats</th></tr></thead>
<tbody>
${feed.map(f => `<tr><td>${f.w} lb</td><td><b>${num(f.kcal)}</b> kcal</td><td>${f.cups}</td><td>${f.treat} kcal</td></tr>`).join("\n")}
</tbody>
</table></div>
<p class="meta">Resting energy (70 × kg<sup>0.75</sup>) times a life-stage factor. Feed for the weight your ${animal} should be. Treats come out of the daily total, not on top of it.</p>

<h3>The same ${animal} in different situations</h3>
<p>What changes the number most is neuter status, activity and age. All rows are for a ${p.mid} lb ${p.mix ? animal : name}.</p>
<div class="tablewrap"><table>
<thead><tr><th>Situation</th><th>Calories a day</th><th>Cups a day</th></tr></thead>
<tbody>
${situations.map(([k, s]) => `<tr><td>${esc(k)}</td><td><b>${num(s.kcal)}</b> kcal</td><td>${s.cups}</td></tr>`).join("\n")}
</tbody>
</table></div>
<p>${A.meals} meals a day suits an adult. ${esc(A.row(A.sec("nutrition"), "Meals")?.hint || "")} ${esc(A.row(A.sec("nutrition"), "Portion")?.hint || "")}</p>

<h2 id="exercise">${dog ? "Exercise" : "Play and enrichment"}</h2>
${rowsList(act)}

<h2 id="lifespan">Lifespan and life stages</h2>
<p>${plural} typically live <b>${range(b.yrs[0], b.yrs[1])} years</b>. Care changes with each stage:</p>
<div class="tablewrap"><table>
<thead><tr><th>Stage</th><th>Age</th></tr></thead>
<tbody>
${tl.stages.map(s => `<tr><td>${esc(s.label)}</td><td>${s.from === 0 ? "Birth" : yr(s.from)} to ${yr(s.to)}</td></tr>`).join("\n")}
</tbody>
</table></div>

<h2 id="health">${esc(A.sec("watchlist").title)}</h2>
<p>A predisposition is not a diagnosis. Most ${plural} never develop most of these. Knowing the list tells you what to screen for and what to raise with your vet.</p>
<ul class="watch">
${watch.map(w => `<li><b>${esc(w.name)}</b><span class="tag${w.screenable ? " screen" : ""}">${w.screenable ? "Screening available" : "Watch for signs"}</span><p>${esc(w.note)}</p></li>`).join("\n")}
</ul>

<h2 id="grooming">Coat and grooming</h2>
${rowsList(groom)}

<section class="card urgent"><h2>Go to a vet now if you see this</h2>
<ul>${A.sec("urgent").items.filter(t => dog ? !/litter box|lilies/i.test(t) || /poison/i.test(t) : !/bloat/i.test(t)).slice(0, 6).map(t => `<li>${esc(t)}</li>`).join("")}</ul>
<p>Dewclaw's free <a href="/index.html?utm_source=guide&amp;utm_medium=firstaid#/care/firstaid">first-aid cards</a> cover the first minutes and work with no signal.</p></section>

<section class="cta"><h2>Get the plan for your ${p.mix ? animal : name}, not the average one</h2>
<p>Dewclaw builds a care plan from your ${animal}'s own age, weight and body condition. It is free, needs no account and works offline.</p>
<ul><li>Feeding amounts for your food's calories per cup</li><li>A daily ${dog ? "walk" : "play"} target and ${dog ? "walk and potty" : "care"} tracking</li><li>Vaccine and checkup reminders</li><li>First-aid cards, a lost-pet poster and a sitter sheet</li></ul>
<a class="btn" href="/index.html?species=${species}&amp;breed=${p.key}&amp;w=${p.mid}&amp;unit=lb&amp;utm_source=guide&amp;utm_medium=cta#/app">Build your ${p.mix ? animal : name}'s chart</a></section>

<h2 id="faq">Common questions</h2>
${faq.map(([q, a]) => `<h3>${esc(q)}</h3>\n<p>${esc(a)}</p>`).join("\n")}

<h2>Similar ${dog ? "breeds" : "cats"}</h2>
<ul class="grid">
${sameSize.map(q => `<li><a href="${urlOf(q)}">${esc(q.name)}<small>${range(q.lo, q.hi)} lb · ${range(q.b.yrs[0], q.b.yrs[1])} yrs</small></a></li>`).join("\n")}
</ul>
<p><a href="/${p.dir}/">All ${dog ? "dog" : "cat"} breeds</a></p>

<h2>Sources and method</h2>
<div class="sources">
<p>These figures are computed, not written by hand, from Dewclaw's breed data. <a href="/how-we-calculate/">How we calculate</a> has the formulas and every factor.</p>
<ul>
<li>Energy needs: resting energy requirement, 70 × (kg)<sup>0.75</sup>, times a life-stage factor, as in the <a href="https://wsava.org/global-guidelines/global-nutrition-guidelines/" rel="noopener">WSAVA Global Nutrition Guidelines</a>.</li>
<li>Body condition: the WSAVA 9-point body condition score.</li>
<li>Life stages: AAHA canine and AAHA/AAFP feline life stage guidelines.</li>
<li>Weight range and lifespan: breed standard ranges and published breed lifespans.</li>
</ul></div>
${DISCLAIMER}`;
  return { url, html: page({ url, title, desc, h1: `${name}: healthy weight, feeding chart and care`, calc: true,
    crumbs: [["Dewclaw", "/"], [dog ? "Dog breeds" : "Cat breeds", `/${p.dir}/`], [name, url]], body, ld: [article(url, title, desc)] }) };
}

/* ---- hubs ------------------------------------------------------------- */
function hub(species) {
  const dog = species === "dog", list = dog ? DOGS : CATS, dir = dog ? "dogs" : "cats", url = `/${dir}/`;
  const title = dog ? `Dog Breed Weight, Feeding & Lifespan Guides (${list.length} Breeds) | Dewclaw` : `Cat Breed Weight, Feeding & Lifespan Guides (${list.length} Breeds) | Dewclaw`;
  const desc = `Healthy weight, daily calories, ${dog ? "exercise" : "play"}, lifespan and health risks for ${list.length} ${dog ? "dog" : "cat"} breeds, each with a free calculator.`;
  const item = q => `<li><a href="${urlOf(q)}">${esc(q.name)}<small>${range(q.lo, q.hi)} lb · ${range(q.b.yrs[0], q.b.yrs[1])} yrs</small></a></li>`;
  const groups = dog
    ? ["toy", "small", "medium", "large", "giant"].map(s => [`${SIZE[s]} breeds`, list.filter(q => q.b.size === s && !q.mix).sort((a, b) => a.name.localeCompare(b.name))])
    : [["All cat breeds", [...list].sort((a, b) => a.name.localeCompare(b.name))]];
  const body = `
<p class="lede">Pick a breed for its healthy weight range, a feeding chart by weight, daily ${dog ? "exercise" : "play"}, lifespan and the health problems to watch for. Every page has a calculator you can set to your own ${dog ? "dog" : "cat"}.</p>
<p class="meta">Last reviewed ${REVIEWED_TEXT} · <a href="/how-we-calculate/">How we calculate</a></p>
${dog ? `<h2>Mixed breeds</h2><p>Not sure of the breed? Go by adult size.</p><ul class="grid">${list.filter(q => q.mix).map(item).join("")}</ul>` : ""}
${groups.map(([h, qs]) => `<h2>${esc(h)}</h2>\n<ul class="grid">\n${qs.map(item).join("\n")}\n</ul>`).join("\n")}
<section class="cta"><h2>Or skip the reading</h2><p>Tell Dewclaw your ${dog ? "dog" : "cat"}'s breed, age and weight and it builds the whole care plan. Free, no account, works offline.</p><a class="btn" href="/index.html?utm_source=guide&amp;utm_medium=hub#/app">Open Dewclaw</a></section>
${DISCLAIMER}`;
  return { url, html: page({ url, title, desc, h1: dog ? "Dog breed guides" : "Cat breed guides", crumbs: [["Dewclaw", "/"], [dog ? "Dog breeds" : "Cat breeds", url]], body }) };
}

/* ---- calculators ------------------------------------------------------ */
function calculator(species) {
  const dog = species === "dog", animal = dog ? "dog" : "cat";
  const url = `/${animal}-calorie-calculator/`, breed = dog ? "mix-medium" : "dsh", w = dog ? 40 : 10;
  const title = dog ? "Dog Calorie Calculator: Calories and Cups a Day by Breed | Dewclaw" : "Cat Calorie Calculator: Calories and Cups a Day by Breed | Dewclaw";
  const desc = `How many calories your ${animal} needs a day, and how many cups that is of your food. Free calculator by breed, weight, age, neuter status and activity, with the formula shown.`;
  const kg = [2, 5, 10, 20, 30, 40, 50].filter(k => dog || k <= 10);
  const table = (dog ? [5, 10, 20, 30, 40, 50, 60, 70, 80, 100] : [6, 8, 10, 12, 14, 16, 18]).map(x => ({ x, ...chartFor(species, breed, { weight: x }), int: chartFor(species, breed, { weight: x, fixed: "0" }) }));
  const app = { "@context": "https://schema.org", "@type": "WebApplication", name: dog ? "Dewclaw dog calorie calculator" : "Dewclaw cat calorie calculator",
    url: ORIGIN + url, applicationCategory: "HealthApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } };
  const body = `
<p class="lede">Enter your ${animal}'s healthy weight, age and lifestyle to get daily calories, cups of your own food, a treat budget and ${dog ? "an exercise" : "a play"} target. It is the same engine that builds a full chart in the Dewclaw app.</p>
<p class="meta">Last reviewed ${REVIEWED_TEXT} · <a href="/how-we-calculate/">How we calculate</a></p>
${calcCard({ species, breed, weight: w, picker: true, heading: dog ? "Dog calorie calculator" : "Cat calorie calculator" })}

<h2>How many calories does a ${animal} need?</h2>
<p>Start from the resting energy requirement, <b>RER = 70 × (weight in kg)<sup>0.75</sup></b>, then multiply by a factor for life stage: about ${dog ? "1.6 for a neutered adult dog and 1.8 for an intact one" : "1.2 for a neutered adult cat and 1.4 for an intact one"}, more for a growing ${dog ? "puppy" : "kitten"}, less for weight loss. Breed energy and activity move it from there.</p>
<div class="tablewrap"><table>
<thead><tr><th>Healthy weight</th><th>Neutered adult</th><th>Intact adult</th><th>Cups a day (neutered)</th></tr></thead>
<tbody>
${table.map(t => `<tr><td>${t.x} lb (${(t.x / 2.2046).toFixed(1)} kg)</td><td><b>${num(t.kcal)}</b> kcal</td><td>${num(t.int.kcal)} kcal</td><td>${t.cups}</td></tr>`).join("\n")}
</tbody>
</table></div>
<p class="meta">${dog ? "A medium mixed-breed adult dog with regular daily walks" : "A domestic shorthair adult, indoor with daily play"}. Cups assume 360 kcal per cup. Pick your breed in the calculator for its own figures.</p>

<h2>Getting the portion right</h2>
<dl class="rows">
<div><dt>Feed the target weight</dt><dd>Calculate from the weight your ${animal} should be. Feeding an overweight ${animal} for its current weight keeps it overweight.</dd></div>
<div><dt>Read the bag</dt><dd>Calories per cup range from under 300 to over 450 between foods. The figure is on the label as kcal/cup or kcal/kg.</dd></div>
<div><dt>Weigh, do not scoop</dt><dd>Cup measures run 20–30% off. A kitchen scale and the kcal/kg figure are more accurate.</dd></div>
<div><dt>Count the treats</dt><dd>Keep treats to 10% of the day and take them out of the meal total.</dd></div>
<div><dt>Re-check monthly</dt><dd>A calculator gives a starting point. Adjust by <a href="/body-condition-score/">body condition score</a>, about 10% at a time.</dd></div>
</dl>

<h2>By breed</h2>
<p>Each breed has its own page with a feeding chart across its healthy weight range.</p>
<ul class="grid">
${(dog ? ["labrador", "goldenret", "gsd", "frenchie", "husky", "chihuahua", "dachshund", "beagle", "aussie", "rottweiler", "yorkie", "boxer"] : ["mainecoon", "ragdoll", "siamese", "bengal", "persian", "britishsh"])
    .map(k => (dog ? DOGS : CATS).find(q => q.key === k)).filter(Boolean).map(q => `<li><a href="${urlOf(q)}">${esc(q.name)}<small>${range(q.lo, q.hi)} lb</small></a></li>`).join("\n")}
</ul>
<p><a href="/${dog ? "dogs" : "cats"}/">All ${dog ? DOGS.length + " dog" : CATS.length + " cat"} breeds</a> · <a href="/${dog ? "cat" : "dog"}-calorie-calculator/">${dog ? "Cat" : "Dog"} calorie calculator</a></p>
${DISCLAIMER}`;
  return { url, html: page({ url, title, desc, h1: dog ? "Dog calorie calculator" : "Cat calorie calculator", calc: true,
    crumbs: [["Dewclaw", "/"], [dog ? "Dog calorie calculator" : "Cat calorie calculator", url]], body, ld: [app] }) };
}

/* ---- body condition score --------------------------------------------- */
function bcsPage() {
  const url = "/body-condition-score/";
  const title = "Body Condition Score Chart for Dogs and Cats (1–9) | Dewclaw";
  const desc = "Is your dog or cat overweight? The 9-point body condition score vets use, in plain words: what each score looks and feels like, and what to do about it.";
  const band = n => n <= 3 ? "Too thin" : n <= 5 ? "Ideal" : n <= 7 ? "Overweight" : "Obese";
  const body = `
<p class="lede">A scale tells you what your pet weighs. Body condition tells you whether that weight is right for their frame. Vets score it from 1 to 9, and <b>4 to 5 is ideal</b>. You can do it at home with your hands in about a minute.</p>
<p class="meta">Last reviewed ${REVIEWED_TEXT} · Based on the WSAVA 9-point body condition score</p>
<h2>How to check</h2>
<dl class="rows">
<div><dt>Ribs</dt><dd>Run your fingers along the ribcage with light pressure. You should feel each rib under a thin cover, like the back of your hand.</dd></div>
<div><dt>Waist</dt><dd>Look from above. There should be a clear narrowing behind the ribs.</dd></div>
<div><dt>Tuck</dt><dd>Look from the side. The belly should rise from the chest toward the hind legs.</dd></div>
</dl>
<h2>The nine scores</h2>
<div class="tablewrap"><table>
<thead><tr><th>Score</th><th>Band</th><th>What you see and feel</th></tr></thead>
<tbody>
${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<tr><td><b>${n}</b></td><td>${band(n)}</td><td>${esc(B.BCS_DESC[n])}</td></tr>`).join("\n")}
</tbody>
</table></div>
<h2>What to do with the score</h2>
<dl class="rows">
<div><dt>1 to 3</dt><dd>See your vet before changing food. Unexplained thinness needs a cause, not just more calories.</dd></div>
<div><dt>4 to 5</dt><dd>Hold the current portion, weigh monthly and re-score when the seasons or the food change.</dd></div>
<div><dt>6 to 7</dt><dd>Each point over 5 is roughly 10% over ideal weight. Feed for the target weight, cut treats to 10% of the day and re-score monthly.</dd></div>
<div><dt>8 to 9</dt><dd>Ask your vet for a weight-loss plan. Cutting food hard on your own is risky, especially for cats, who can develop liver disease if they stop eating.</dd></div>
</dl>
<section class="cta"><h2>Turn the score into a feeding plan</h2><p>Dewclaw takes the body condition score with your pet's breed, age and weight and works out the target weight and the calories to get there. Free, no account.</p><a class="btn" href="/index.html?utm_source=guide&amp;utm_medium=bcs#/app">Open Dewclaw</a></section>
<p style="margin-top:28px"><a href="/dog-calorie-calculator/">Dog calorie calculator</a> · <a href="/cat-calorie-calculator/">Cat calorie calculator</a> · <a href="/dogs/">Dog breeds</a> · <a href="/cats/">Cat breeds</a></p>
${DISCLAIMER}`;
  return { url, html: page({ url, title, desc, h1: "Body condition score chart for dogs and cats", crumbs: [["Dewclaw", "/"], ["Body condition score", url]], body, ld: [article(url, title, desc)] }) };
}

/* ---- how we calculate -------------------------------------------------- */
function methodPage() {
  const url = "/how-we-calculate/";
  const title = "How Dewclaw Calculates a Care Plan | Dewclaw";
  const desc = "The formulas, factors and sources behind every number in Dewclaw and its breed guides, who is responsible for them, and what they cannot tell you.";
  const body = `
<p class="lede">Every number in Dewclaw and on its breed guide pages is computed by one care engine from a table of breed data. Nothing is written by hand per breed, and nothing is generated by an AI model. This page says exactly how.</p>
<p class="meta">Last reviewed ${REVIEWED_TEXT} · Responsible: ${WHO}, Oregon · <a href="https://www.kcbeyondlimits.com">kcbeyondlimits.com</a></p>

<h2>Daily calories</h2>
<dl class="rows">
<div><dt>Resting energy</dt><dd><b>RER = 70 × (ideal weight in kg)<sup>0.75</sup></b><small>The standard allometric formula in the WSAVA Global Nutrition Guidelines.</small></dd></div>
<div><dt>Ideal weight</dt><dd>From the body condition score: each point above or below 5 is treated as about 10% over or under ideal weight.</dd></div>
<div><dt>Life-stage factor</dt><dd>RER is multiplied by a factor for neuter status and age: higher for growing animals and intact adults, lower for neutered adults, seniors and weight loss.</dd></div>
<div><dt>Breed energy and activity</dt><dd>The result is adjusted for the breed's energy level (${Object.values(B.ENERGY).map(e => `${e.label.toLowerCase()} ×${e.adj}`).join(", ")}) and the activity you choose (${Object.entries(B.ACT_ADJ).map(([k, v]) => `${k} ×${v}`).join(", ")}).</dd></div>
<div><dt>Cups</dt><dd>Calories divided by the calories per cup of your food. Guide pages assume 360 kcal per cup; the calculators let you enter your own.</dd></div>
<div><dt>Treats</dt><dd>10% of daily calories, subtracted from meals.</dd></div>
</dl>

<h2>Weight, life stage and lifespan</h2>
<dl class="rows">
<div><dt>Healthy weight range</dt><dd>The adult range from the breed standard, stored in kilograms and shown in pounds.</dd></div>
<div><dt>Life stages</dt><dd>Follow the AAHA canine and AAHA/AAFP feline life stage guidelines, scaled by size: growth ends at ${Object.entries(B.GROWTH_END).map(([k, v]) => `${v < 1 ? Math.round(v * 12) + " months" : v + " yr"} (${k})`).join(", ")}; senior care starts at ${Object.entries(B.SENIOR_AT).map(([k, v]) => `${v} (${k})`).join(", ")}.</dd></div>
<div><dt>Lifespan</dt><dd>The typical published range for the breed. An individual animal can fall outside it.</dd></div>
</dl>

<h2>Exercise, grooming and health watchlist</h2>
<dl class="rows">
<div><dt>Exercise</dt><dd>Minutes a day by breed energy level: ${Object.values(B.ENERGY).map(e => `${e.label.toLowerCase()} ${e.mins[0]}–${e.mins[1]}`).join(", ")}. Reduced for puppies, seniors and overweight animals.</dd></div>
<div><dt>Grooming</dt><dd>Brushing and bathing cadence by coat type.</dd></div>
<div><dt>Health watchlist</dt><dd>Up to five conditions each breed is known to be predisposed to, with a plain note on what to watch or screen for. A predisposition is not a diagnosis, and the list is not complete.</dd></div>
</dl>

<h2>What this cannot tell you</h2>
<p>These are general-population figures. They do not know your pet's medical history, medication, pregnancy, or the food you actually feed. No veterinarian has reviewed an individual plan. Use the numbers to start a conversation with your own vet, and re-check them against your pet's body condition every month.</p>

<h2>Sources</h2>
<div class="sources"><ul>
<li><a href="https://wsava.org/global-guidelines/global-nutrition-guidelines/" rel="noopener">WSAVA Global Nutrition Guidelines</a>, including the 9-point body condition score.</li>
<li>AAHA Canine Life Stage Guidelines and AAHA/AAFP Feline Life Stage Guidelines.</li>
<li>Breed standards for adult weight ranges.</li>
<li><a href="https://www.aspca.org/pet-care/animal-poison-control" rel="noopener">ASPCA Animal Poison Control</a> for the poison guidance in the app's first-aid cards.</li>
</ul></div>
<p>Found a number that looks wrong? Tell us through <a href="https://www.kcbeyondlimits.com">kcbeyondlimits.com</a> and we will check it against the source.</p>
${DISCLAIMER}`;
  return { url, html: page({ url, title, desc, h1: "How Dewclaw calculates a care plan", crumbs: [["Dewclaw", "/"], ["How we calculate", url]], body, ld: [article(url, title, desc)] }) };
}

/* ---- for shelters and rescues ------------------------------------------ */
function shelterPage() {
  const url = "/for-shelters/";
  const title = "Dewclaw for Shelters and Rescues: A Free Care Plan for Every Adopter";
  const desc = "Give every adopter a care plan for their new dog or cat: feeding amounts, a vaccine schedule, first-aid cards and a sitter sheet. Free, no account, nothing to install or manage.";
  const body = `
<p class="lede">The first weeks after adoption are when new owners have the most questions and the least idea who to ask. Dewclaw gives each adopter a care plan for the animal they just took home. It costs your organization nothing and there is nothing for you to run.</p>
<h2>What an adopter gets</h2>
<dl class="rows">
<div><dt>A feeding plan</dt><dd>Daily calories and cups for their pet's breed, age and weight, with a treat budget.</dd></div>
<div><dt>A vaccine and checkup schedule</dt><dd>What is due and when, with reminders on their phone.</dd></div>
<div><dt>First-aid cards</dt><dd>The first minutes of common emergencies and the poison-control numbers. They work with no signal.</dd></div>
<div><dt>A lost-pet poster and a sitter sheet</dt><dd>Ready to print or share in a minute.</dd></div>
<div><dt>Breed guides</dt><dd>Healthy weight, exercise and the health problems to watch for, for <a href="/dogs/">${DOGS.length} dog</a> and <a href="/cats/">${CATS.length} cat</a> breeds, including mixed breeds by size.</dd></div>
</dl>
<h2>Why it suits an adoption packet</h2>
<dl class="rows">
<div><dt>Free for the adopter</dt><dd>Everything above is free. There is an optional paid tier called Plus; nobody needs it to use the care plan, first aid or reminders.</dd></div>
<div><dt>No account and no data collection</dt><dd>Adopters do not sign up. Their pet's details stay on their own phone. Dewclaw shows no ads. See the <a href="/privacy.html">privacy policy</a>.</dd></div>
<div><dt>Nothing to install</dt><dd>It opens in the phone's browser from a link or a QR code and can be added to the home screen.</dd></div>
<div><dt>Not a substitute for a vet</dt><dd>Every screen says so, and the plan points adopters to a veterinarian for anything medical.</dd></div>
</dl>
<h2>How to use it</h2>
<dl class="rows">
<div><dt>Simplest</dt><dd>Put this link in your adoption email or packet: <b>${ORIGIN.replace("https://", "")}</b></dd></div>
<div><dt>Better</dt><dd>Link straight to the animal's breed so the chart opens filled in. Every <a href="/dogs/">breed page</a> has a "Build the chart" button; copy that link.</dd></div>
<div><dt>A printed card with a QR code</dt><dd>A printable card is available on request. Write to us through <a href="https://www.kcbeyondlimits.com">kcbeyondlimits.com</a>.</dd></div>
</dl>
<section class="cta"><h2>See what adopters see</h2><p>Open a sample chart. It takes about a minute to make one for a real animal.</p><a class="btn" href="/index.html?utm_source=shelter&amp;utm_medium=page#/app">Open Dewclaw</a></section>
<p class="meta" style="margin-top:24px">Dewclaw is made by ${WHO}, a dog-adventure brand in Oregon.</p>
${DISCLAIMER}`;
  return { url, html: page({ url, title, desc, h1: "A free care plan for every adopter", crumbs: [["Dewclaw", "/"], ["For shelters and rescues", url]], body }) };
}

/* ---- write ------------------------------------------------------------ */
for (const d of ["dogs", "cats", "dog-calorie-calculator", "cat-calorie-calculator", "body-condition-score", "how-we-calculate", "for-shelters"])
  fs.rmSync(path.join(SITE, d), { recursive: true, force: true });

const pages = [hub("dog"), hub("cat"), calculator("dog"), calculator("cat"), bcsPage(), methodPage(), shelterPage(), ...ALL.map(breedPage)];
for (const p of pages) {
  const dir = path.join(SITE, p.url);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), p.html);
}
fs.writeFileSync(path.join(SITE, "engine.js"), engineJs);
fs.writeFileSync(path.join(SITE, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  ["/", ...pages.map(p => p.url)].map(u => `<url><loc>${ORIGIN}${u}</loc><lastmod>${REVIEWED}</lastmod></url>`).join("\n") + "\n</urlset>\n");
fs.writeFileSync(path.join(SITE, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
console.log(`${pages.length} pages, engine.js ${(engineJs.length / 1024).toFixed(0)} KB, origin ${ORIGIN}`);
