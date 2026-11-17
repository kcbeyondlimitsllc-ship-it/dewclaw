#!/usr/bin/env node
/* KC: Open Trail: creates the game's 16 Stripe products and one-time USD prices, once.

   THE OWNER RUNS THIS ON THEIR OWN COMPUTER. It is never run by the website, the worker or a build.
   Node 18 or newer, no packages to install. Plain-English steps: marketing/kc-open-trail/GO-LIVE-STRIPE.md

     node tools/stripe-setup-open-trail.mjs --dry-run            show the plan; with no key it does not touch the internet
     node tools/stripe-setup-open-trail.mjs                      create in TEST mode (a key starting sk_test_ or rk_test_)
     node tools/stripe-setup-open-trail.mjs --write              ...and put the ids into the two settings files
     node tools/stripe-setup-open-trail.mjs --live --write       the same with a LIVE key (sk_live_ or rk_live_)

   The Stripe key
     Read from the environment variable STRIPE_SECRET_KEY, or typed at a hidden prompt when that is not set.
     It is held in memory only: never written to a file, never printed, never put on a command line by this script.
     A restricted key with "Products: Write" and "Prices: Write" and nothing else is enough, and is the safest choice.
     A live key is refused unless --live is given; --live is refused with a test key.

   What it does
     1. Asks Stripe whether a price with lookup_key = the SKU already exists, for each of the 16 SKUs.
        An existing price is reused. If an existing price has a different amount, is not US dollars, is recurring or is
        archived, the script stops before creating anything: the worker would refuse to sell that item (OT_PRICES).
     2. Creates what is missing: one product (id kc_open_trail_<sku>) and one price per SKU, each with
        metadata game=kc-open-trail and sku=<sku>, the price with lookup_key=<sku>.
     3. Prints (a) the STRIPE_PRICE_IDS block for site/games/kc-open-trail/js/store-config.js and
        (b) the merged STRIPE_PRICES line for worker/wrangler.toml, the Dewclaw ids kept exactly as they are.
        With --write it edits those two files itself. Price ids are public values, not secrets.
     Running it again changes nothing in Stripe and prints the same ids.

   Other options
     --hold=sku,sku         create these in Stripe but keep them off sale (left out of both files; see MONETIZATION.md 3.3)
     --worker-url=https://… with --write: also set WORKER_URL in store-config.js (no slash at the end)
     --support-contact=…    with --write: also set SUPPORT_CONTACT (a support email address or an https page)
     --tax-code=txcd_…      the Stripe Tax product code for new products (default txcd_10201000, see TAX_CODE below)
     --store-config=PATH, --wrangler=PATH   edit other copies of the two files (used by the tests)

   Test and live are separate worlds in Stripe: ids made with a test key only work with a test key. A test-mode --write
   goes to the [env.test.vars] block of wrangler.toml (the separate test worker); a live one goes to [vars]. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const GAME = "kc-open-trail";
export const PLACEHOLDER = "OWNER_FILLS_IN";
/* Stripe's own example for an in-app coin bundle uses this code: "Video Games, downloaded, non-subscription, with
   permanent rights" (docs.stripe.com/tax/tax-codes, read 2026-11-17). Whether it is right for used-up gems and for the
   tip is a question for an accountant; pass --tax-code to use another. */
export const TAX_CODE = "txcd_10201000";
/* tax is added on top of the price, never taken out of it: the worker's claim compares Stripe's subtotal with the catalogue price */
const TAX_BEHAVIOR = "exclusive";

const SET = (sku, cents, set) => ({ sku, cents, name: `KC: Open Trail, ${set} set`, description: `The ${set} cosmetic set for KC: Open Trail: hat, bandana, collar, trail, skateboard, canoe and van paint, and a den decoration. Cosmetic only. Yours for good.` });
const GEMS = (n, cents) => ({ sku: `ot_gems_${n}`, cents, name: `KC: Open Trail, ${n.toLocaleString("en-US")} gems`, description: `${n.toLocaleString("en-US")} gems to spend on cosmetics in KC: Open Trail. Used up when spent. Gems never buy bones, stats or boosts.` });
/* The 16 items. Amounts are US cents and must equal OT_PRICES in worker/dewclaw-worker.js and CATALOG in the game's
   js/store.js (MONETIZATION-EXPANSION-SPEC.md section 4.2). The test file checks this table against the worker. */
export const CATALOG = [
  GEMS(80, 99), GEMS(500, 499), GEMS(1200, 999), GEMS(2600, 1999), GEMS(7000, 4999),
  { sku: "ot_starter", cents: 499, name: "KC: Open Trail, First Trail set", description: "400 gems and the First Trail cosmetic set: bandana, tag, Sunbeam trail and skateboard paint. Once per device. Cosmetic only." },
  { sku: "ot_trail_pass", cents: 599, name: "KC: Open Trail, Trail Journal pass", description: "The second column of the Trail Journal: 15 cosmetics and 300 gems, paid out as each step is reached. It never expires." },
  SET("ot_pack_forest", 399, "Whispering Firs"), SET("ot_pack_galaxy", 399, "Night Sky"), SET("ot_pack_roadtrip", 399, "Open Road"), SET("ot_pack_halloween", 399, "Spooky Hollow"),
  { sku: "ot_treat_3", cents: 199, name: "KC: Open Trail, 3 Party Treats", description: "3 Party Treats for KC: Open Trail. Cosmetic fun with no stats. Used up when eaten." },
  { sku: "ot_treat_10", cents: 499, name: "KC: Open Trail, 10 Party Treats", description: "10 Party Treats for KC: Open Trail. Cosmetic fun with no stats. Used up when eaten." },
  { sku: "ot_supporter", cents: 999, name: "KC: Open Trail, Supporter set", description: "600 gems and the Supporter cosmetic set: tag, bandana, gold den trim and photo frame. A thank-you. It gives no boost of any kind." },
  { sku: "ot_everything", cents: 2499, name: "KC: Open Trail, Everything bundle", description: "The four cosmetic sets, the Trail Journal pass and the Supporter set with its 600 gems. Cosmetic only. Yours for good." },
  /* a purchase of a cosmetic tag, not a donation: Stripe restricts tips and fundraising, and it is not a charitable gift */
  { sku: "ot_tip_3", cents: 300, name: "KC: Open Trail, Good Human tag (thank-you)", description: "A thank-you purchase to the maker of KC: Open Trail. You get a \"Good Human\" cosmetic tag the first time. It buys nothing else. It is not a charitable donation." }
];
const SKUS = CATALOG.map(c => c.sku);
const usd = cents => "$" + (cents / 100).toFixed(2);
export const productId = sku => "kc_open_trail_" + sku;

class Stop extends Error { constructor(message, code = 1) { super(message); this.code = code; } }

/* ---------------------------------------------------------------- options */
function parseArgs(argv) {
  const o = { dryRun: false, live: false, write: false, help: false, hold: [], workerUrl: "", support: "", taxCode: TAX_CODE,
              storeConfig: path.join(ROOT, "site/games/kc-open-trail/js/store-config.js"), wrangler: path.join(ROOT, "worker/wrangler.toml") };
  const flags = { "--dry-run": "dryRun", "--live": "live", "--write": "write", "--help": "help", "-h": "help" };
  const values = { "--hold": "hold", "--worker-url": "workerUrl", "--support-contact": "support", "--tax-code": "taxCode", "--store-config": "storeConfig", "--wrangler": "wrangler" };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i], v = null;
    const eq = a.indexOf("=");
    if (a.startsWith("--") && eq > 0) { v = a.slice(eq + 1); a = a.slice(0, eq); }
    if (Object.hasOwn(flags, a) && v === null) { o[flags[a]] = true; continue; }
    if (Object.hasOwn(values, a)) {
      if (v === null) v = argv[++i];
      if (v == null || v === "") throw new Stop(`${a} needs a value.`);
      o[values[a]] = values[a] === "hold" ? v.split(",").map(s => s.trim()).filter(Boolean) : v;
      continue;
    }
    if (/^(sk|rk|pk)_/.test(a)) throw new Stop("Never put a Stripe key on the command line. Set STRIPE_SECRET_KEY instead, or run without it and type the key at the hidden prompt.");
    throw new Stop(`Unknown option ${a}. Run with --help to see the options.`);
  }
  for (const s of o.hold) if (!SKUS.includes(s)) throw new Stop(`--hold: ${s} is not one of the 16 items.`);
  if (!/^txcd_[0-9]{8}$/.test(o.taxCode)) throw new Stop("--tax-code must look like txcd_10201000.");
  if (o.workerUrl) {
    let u; try { u = new URL(o.workerUrl); } catch { throw new Stop("--worker-url is not a web address."); }
    if (u.protocol !== "https:" || u.search || u.hash || u.username || u.password) throw new Stop("--worker-url must be a plain https address.");
    o.workerUrl = u.origin + u.pathname.replace(/\/+$/, "");
  }
  if (o.support) {
    const mail = /^[^\s@'"<>\\]+@[^\s@'"<>\\]+\.[^\s@'"<>\\]+$/.test(o.support);
    let page = false; try { page = new URL(o.support).protocol === "https:" && !/['"<>\\\s]/.test(o.support); } catch { /* not an address */ }
    if (!mail && !page) throw new Stop("--support-contact must be an email address or an https page.");
  }
  if ((o.workerUrl || o.support) && !o.write) throw new Stop("--worker-url and --support-contact only do something together with --write.");
  return o;
}

/* ---------------------------------------------------------------- the key */
function keyKind(key) {
  if (/^pk_/.test(key)) throw new Stop("That is the publishable key (pk_...). This needs a secret or restricted key (sk_... or rk_...).");
  const m = /^(sk|rk)_(test|live)_[A-Za-z0-9]{8,}$/.exec(key);
  if (!m) throw new Stop("STRIPE_SECRET_KEY does not look like a Stripe key. It should start with sk_test_, rk_test_, sk_live_ or rk_live_.");
  return m[2];
}
/* a hidden prompt: nothing typed is shown, and the key goes nowhere but this process's memory */
function askKey(stdin, stderr) {
  return new Promise((resolve, reject) => {
    stderr.write("Paste the Stripe key and press Enter (nothing will show as you type): ");
    let buf = "";
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
    const done = fn => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener("data", onData); stderr.write("\n"); fn(); };
    const onData = chunk => {
      for (const ch of chunk) {
        if (ch === "\u0003") return done(() => reject(new Stop("Stopped. Nothing was created.", 130)));
        if (ch === "\r" || ch === "\n") return done(() => resolve(buf.trim()));
        if (ch === "\u007f" || ch === "\b") buf = buf.slice(0, -1); else if (ch >= " ") buf += ch;
      }
    };
    stdin.on("data", onData);
  });
}

/* ---------------------------------------------------------------- Stripe */
function apiBase(env) {
  const raw = String(env.STRIPE_API_BASE || "").trim();
  if (!raw) return "https://api.stripe.com";
  /* a different address is for the tests' pretend Stripe only, and only on this computer: the key must never be sent anywhere else */
  let u; try { u = new URL(raw); } catch { throw new Stop("STRIPE_API_BASE is not an address."); }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)) throw new Stop("STRIPE_API_BASE may only point at this computer (127.0.0.1). Unset it to use Stripe.");
  return u.origin;
}
function makeStripe(base, key) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  return async function stripe(method, pathname, form) {
    const headers = { authorization: "Bearer " + key };
    let body;
    if (form) {
      body = new URLSearchParams(form).toString();
      headers["content-type"] = "application/x-www-form-urlencoded";
      /* the same request sent twice (a retry, or the script run again within a day) creates one thing, not two */
      headers["idempotency-key"] = "ot-setup-" + crypto.createHash("sha256").update(method + " " + pathname + "\n" + body).digest("hex").slice(0, 40);
    }
    for (let attempt = 1; ; attempt++) {
      let r, j;
      try {
        r = await fetch(base + "/v1" + pathname, { method, headers, body, signal: AbortSignal.timeout(30000) });
        j = await r.json().catch(() => ({}));
      } catch (e) {
        if (attempt < 3) { await sleep(400 * attempt); continue; }
        throw new Stop("Could not reach Stripe (" + (e && e.name === "TimeoutError" ? "it took too long" : "network error") + "). Check the internet connection and run this again: it carries on where it stopped.");
      }
      if ((r.status === 429 || r.status >= 500) && attempt < 3) { await sleep(600 * attempt); continue; }
      return { status: r.status, ok: r.ok, body: j };
    }
  };
}
const stripeSays = res => { const e = res.body && res.body.error; return (e && (e.message || e.code)) || ("HTTP " + res.status); };
function explain(res, doing) {
  if (res.status === 401) return new Stop("Stripe did not accept the key (it may be mistyped, deleted or expired). Nothing was changed by this step.");
  if (res.status === 403) return new Stop(`Stripe refused while ${doing}: ${stripeSays(res)}\nA restricted key needs "Products: Write" and "Prices: Write".`);
  return new Stop(`Stripe refused while ${doing}: ${stripeSays(res)}`);
}

/* is this existing price the one-time US-dollar price the catalogue says? The same test the worker applies (otPriceCheck). */
function priceProblem(item, p, live) {
  const bad = [];
  if (Number(p.unit_amount) !== item.cents) bad.push(`its amount is ${Number.isFinite(Number(p.unit_amount)) ? usd(Number(p.unit_amount)) : "not a fixed amount"}, the catalogue says ${usd(item.cents)}`);
  if (String(p.currency || "").toLowerCase() !== "usd") bad.push(`its currency is ${String(p.currency || "?").toUpperCase()}, not USD`);
  if (p.recurring || (p.type && p.type !== "one_time")) bad.push("it is a recurring price, not one-time");
  if (p.active === false) bad.push("it is archived");
  if (typeof p.livemode === "boolean" && p.livemode !== live) bad.push(`it is a ${p.livemode ? "live" : "test"} price but the key is a ${live ? "live" : "test"} key`);
  return bad;
}

async function survey(stripe, live) {
  const rows = [], problems = [];
  for (const item of CATALOG) {
    const res = await stripe("GET", "/prices?" + new URLSearchParams({ "lookup_keys[]": item.sku, limit: "10" }));
    if (!res.ok) throw explain(res, "looking for " + item.sku);
    const found = (Array.isArray(res.body.data) ? res.body.data : []).filter(p => p && p.lookup_key === item.sku);
    const row = { item, priceId: "", product: "new", price: "new" };
    if (found.length) {
      const p = found[0], bad = priceProblem(item, p, live);
      if (typeof p.id !== "string" || !/^price_[A-Za-z0-9]{6,}$/.test(p.id)) bad.push("Stripe returned an id that does not look like a price id");
      if (bad.length) problems.push(`${item.sku}: a price with this lookup key already exists (${p.id}) but ${bad.join("; ")}.`);
      row.priceId = p.id; row.price = "exists"; row.product = "exists";
    } else {
      const pr = await stripe("GET", "/products/" + encodeURIComponent(productId(item.sku)));
      if (pr.ok && pr.body && pr.body.id === productId(item.sku) && !pr.body.deleted) {
        row.product = "exists";
        if (pr.body.active === false) problems.push(`${item.sku}: the product ${productId(item.sku)} exists but is archived. Unarchive it in the Stripe Dashboard, then run this again.`);
      } else if (pr.status !== 404 && !pr.ok) throw explain(pr, "looking for the product of " + item.sku);
    }
    rows.push(row);
  }
  return { rows, problems };
}

async function create(stripe, rows, taxCode, live, out) {
  for (const row of rows) {
    const { item } = row;
    if (row.price === "exists") continue;
    if (row.product === "new") {
      const res = await stripe("POST", "/products", { id: productId(item.sku), name: item.name, description: item.description, tax_code: taxCode, "metadata[game]": GAME, "metadata[sku]": item.sku });
      if (!res.ok) throw explain(res, "creating the product for " + item.sku);
      row.product = "created";
    }
    const res = await stripe("POST", "/prices", { product: productId(item.sku), currency: "usd", unit_amount: String(item.cents), lookup_key: item.sku, tax_behavior: TAX_BEHAVIOR, nickname: item.sku, "metadata[game]": GAME, "metadata[sku]": item.sku });
    if (!res.ok) throw explain(res, "creating the price for " + item.sku);
    const p = res.body, bad = priceProblem(item, p, live);
    if (typeof p.id !== "string" || !/^price_[A-Za-z0-9]{6,}$/.test(p.id)) bad.push("Stripe returned an id that does not look like a price id");
    if (bad.length) throw new Stop(`${item.sku}: Stripe created ${p.id || "a price"} but ${bad.join("; ")}. Nothing was written to the settings files.`);
    row.priceId = p.id; row.price = "created";
    out(`  created  ${item.sku.padEnd(18)} ${usd(item.cents).padStart(6)}  ${p.id}`);
  }
}

/* ---------------------------------------------------------------- the two settings files */
export function storeConfigBlock(ids) {
  const lines = CATALOG.map((c, i) => {
    const v = `'${ids[c.sku] || PLACEHOLDER}'` + (i < CATALOG.length - 1 ? "," : "");
    return `  ${c.sku}: ${v}`.padEnd(58) + ` /* ${usd(c.cents).padEnd(6)} */`;
  });
  return "export const STRIPE_PRICE_IDS = {\n" + lines.join("\n") + "\n};";
}
function editStoreConfig(text, ids, o) {
  const m = /export const STRIPE_PRICE_IDS = \{[\s\S]*?\n\};/.exec(text);
  if (!m) throw new Stop("Could not find the STRIPE_PRICE_IDS block in store-config.js. Nothing was written; paste block (a) by hand.");
  for (const sku of SKUS) if (!new RegExp(`\\b${sku}:`).test(m[0])) throw new Stop(`store-config.js has no line for ${sku}. Nothing was written; paste block (a) by hand.`);
  let next = text.slice(0, m.index) + storeConfigBlock(ids) + text.slice(m.index + m[0].length);
  const setConst = (name, value) => {
    const re = new RegExp(`(export const ${name} = )'[^'\\n]*';`);
    if (!re.test(next)) throw new Stop(`Could not find ${name} in store-config.js. Nothing was written.`);
    next = next.replace(re, (_, lead) => `${lead}'${value}';`);
  };
  if (o.workerUrl) setConst("WORKER_URL", o.workerUrl);
  if (o.support) setConst("SUPPORT_CONTACT", o.support);
  return next;
}
/* finds the STRIPE_PRICES line inside one [table] of wrangler.toml; the value is a JSON object written as a TOML string */
function findPricesLine(text, table) {
  const lines = text.split("\n");
  let current = "";
  for (let i = 0; i < lines.length; i++) {
    const head = /^\s*\[\[?\s*([^\]\s]+)\s*\]\]?\s*(#.*)?$/.exec(lines[i]);
    if (head) { current = head[1]; continue; }
    if (current !== table) continue;
    const m = /^STRIPE_PRICES\s*=\s*("(?:[^"\\]|\\.)*")\s*$/.exec(lines[i]);
    if (m) { let obj; try { obj = JSON.parse(JSON.parse(m[1])); } catch { obj = null; } return { lines, index: i, value: obj }; }
  }
  return { lines, index: -1, value: null };
}
export function mergePrices(existing, ids) {
  const merged = {};
  for (const [k, v] of Object.entries(existing || {})) if (!SKUS.includes(k)) merged[k] = v;     /* Dewclaw Plus, Pocket Pup: untouched */
  for (const sku of SKUS) if (ids[sku]) merged[sku] = ids[sku];
  return merged;
}
const tomlLine = obj => "STRIPE_PRICES = " + JSON.stringify(JSON.stringify(obj));
function writeFile(file, text) { const tmp = file + ".tmp-" + process.pid; fs.writeFileSync(tmp, text); fs.renameSync(tmp, file); }

/* ---------------------------------------------------------------- the run */
const HELP = fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^#!.*\n/, "").replace(/^\/\* ?/, "").replace(/^ {3}/gm, "");

export async function main(argv, env, io) {
  let key = "";
  const clean = s => (key ? String(s).split(key).join("[key hidden]") : String(s));
  const out = s => io.stdout.write(clean(s) + "\n"), err = s => io.stderr.write(clean(s) + "\n");
  try {
    const o = parseArgs(argv);
    if (o.help) { out(HELP.trim()); return 0; }
    const base = apiBase(env);
    key = String(env.STRIPE_SECRET_KEY || "").trim();

    if (!key && o.dryRun) {
      out("DRY RUN with no key: nothing is sent anywhere. This is what a real run would look for and, if missing, create:\n");
      for (const c of CATALOG) out(`  ${c.sku.padEnd(18)} ${usd(c.cents).padStart(6)}  ${c.name}`);
      out(`\n16 products and 16 one-time USD prices, tax code ${o.taxCode}, lookup_key = the SKU, metadata game=${GAME}.`);
      out("Set STRIPE_SECRET_KEY to a test key and run --dry-run again to see what already exists in Stripe.");
      return 0;
    }
    if (!key) {
      if (!io.stdin || !io.stdin.isTTY) throw new Stop("No Stripe key. Set the environment variable STRIPE_SECRET_KEY, or run this in a terminal and type the key at the hidden prompt.\nNever put the key in a file in this folder or on the command line.");
      key = await askKey(io.stdin, io.stderr);
      if (!key) throw new Stop("No key was typed. Nothing was created.");
    }
    const mode = keyKind(key), live = mode === "live";
    if (live && !o.live) throw new Stop("This is a LIVE Stripe key, and --live was not given. Nothing was sent to Stripe.\nTest first with a test key. When you mean to create the real products, run again with --live.");
    if (!live && o.live) throw new Stop("--live was given but this is a TEST key. Nothing was sent to Stripe.\nUse a live key (sk_live_ or rk_live_) with --live, or drop --live to work in test mode.");

    /* read the two files before talking to Stripe, so a missing file is found out first */
    const table = live ? "vars" : "env.test.vars";
    let cfgText = null, tomlText = null;
    try { cfgText = fs.readFileSync(o.storeConfig, "utf8"); } catch { if (o.write) throw new Stop("Cannot read " + o.storeConfig); }
    try { tomlText = fs.readFileSync(o.wrangler, "utf8"); } catch { if (o.write) throw new Stop("Cannot read " + o.wrangler); }
    const toml = tomlText == null ? { index: -1, value: null } : findPricesLine(tomlText, table);
    if (o.write && (toml.index < 0 || !toml.value || typeof toml.value !== "object" || Array.isArray(toml.value)))
      throw new Stop(`Cannot find a readable STRIPE_PRICES line under [${table}] in ${o.wrangler}. Nothing was sent to Stripe and nothing was written.`);

    out(`${live ? "LIVE" : "TEST"} mode${o.dryRun ? ", DRY RUN (looking only, creating nothing)" : ""}. Asking Stripe what already exists...`);
    const stripe = makeStripe(base, key);
    const { rows, problems } = await survey(stripe, live);
    if (problems.length) {
      err("\nSTOPPED. Nothing was created and no file was changed.\n");
      for (const p of problems) err("  - " + p);
      err("\nA Stripe price can never be edited to a new amount. In the Stripe Dashboard: open that price, remove its lookup key (or archive the price), then run this again and a correct one is made.\nThe worker refuses to sell an item whose price is not exactly the catalogue amount in US dollars, one-time.");
      return 2;
    }
    const missing = rows.filter(r => r.price === "new");
    for (const r of rows.filter(r => r.price === "exists")) out(`  exists   ${r.item.sku.padEnd(18)} ${usd(r.item.cents).padStart(6)}  ${r.priceId}`);
    if (o.dryRun) {
      for (const r of missing) out(`  missing  ${r.item.sku.padEnd(18)} ${usd(r.item.cents).padStart(6)}  would create ${r.product === "new" ? "the product and " : ""}the price`);
      out(`\nDry run: ${rows.length - missing.length} already in Stripe, ${missing.length} would be created. Nothing was created and no file was changed.`);
      return 0;
    }
    await create(stripe, rows, o.taxCode, live, out);
    out(missing.length ? `\n${missing.length} created, ${rows.length - missing.length} already there.` : "\nAll 16 were already in Stripe. Nothing was created.");

    const ids = {};
    for (const r of rows) if (!o.hold.includes(r.item.sku)) ids[r.item.sku] = r.priceId;
    if (o.hold.length) out(`Held back (in Stripe, but left off sale in both files): ${o.hold.join(", ")}`);
    const merged = mergePrices(toml.value, ids);

    out(`\n(a) For site/games/kc-open-trail/js/store-config.js, replace the STRIPE_PRICE_IDS block with this (${mode} ids):\n`);
    out(storeConfigBlock(ids));
    out(`\n(b) For worker/wrangler.toml, the STRIPE_PRICES line under [${table}] becomes this one line (${mode} ids${live ? ", Dewclaw ids kept" : ""}):\n`);
    out(tomlLine(merged));
    if (toml.index < 0 && tomlText != null) out(`\n    Note: there is no STRIPE_PRICES line under [${table}] in wrangler.toml yet, so the line above holds the game's ids only.`);

    if (o.write) {
      const nextCfg = editStoreConfig(cfgText, ids, o);
      toml.lines[toml.index] = tomlLine(merged);
      const nextToml = toml.lines.join("\n");
      writeFile(o.storeConfig, nextCfg); writeFile(o.wrangler, nextToml);
      out(`\nWrote ${path.relative(process.cwd(), o.storeConfig) || o.storeConfig}`);
      out(`Wrote ${path.relative(process.cwd(), o.wrangler) || o.wrangler}  ([${table}] only)`);
    } else out("\nNothing was written to any file. Paste the two blocks by hand, or run again with --write.");
    out(live
      ? "\nThese are LIVE ids. Next: deploy the worker, publish the site, then open <worker address>/ot/prices and check every item you sell says \"ok\": true."
      : "\nThese are TEST ids: they only work with a test key on the test worker, and no real money can move. Before the real launch, run this again with the live key and --live --write so the game holds live ids.");
    return 0;
  } catch (e) {
    if (e instanceof Stop) { err(e.message); return e.code; }
    err("Unexpected error: " + (e && e.message ? e.message : String(e)));
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2), process.env, { stdout: process.stdout, stderr: process.stderr, stdin: process.stdin }).then(code => { process.exitCode = code; });
}
