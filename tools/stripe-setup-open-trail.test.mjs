/* Tests for tools/stripe-setup-open-trail.mjs against a pretend Stripe on this computer. No real Stripe call is made,
   and the keys below are made up.

     node --test tools/stripe-setup-open-trail.test.mjs      (Node 18+, no packages) */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CATALOG, TAX_CODE, productId, mergePrices, storeConfigBlock } from "./stripe-setup-open-trail.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "..");
const SCRIPT = path.join(HERE, "stripe-setup-open-trail.mjs");
const TEST_KEY = "sk_test_" + "Mock0123456789abcdefTESTONLY", LIVE_KEY = "rk_live_" + "Mock0123456789abcdefLIVEONLY";

/* ---- a pretend Stripe: products and prices in memory, the routes the script uses, every request written down ---- */
async function mockStripe() {
  const state = { products: new Map(), prices: [], requests: [], seq: 0, keys: new Set(), idem: new Map() };
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", c => { body += c; });
    req.on("end", () => {
      const url = new URL(req.url, "http://x"), form = Object.fromEntries(new URLSearchParams(body));
      const auth = String(req.headers.authorization || "");
      state.requests.push({ method: req.method, path: url.pathname, query: url.search, form, auth, idem: req.headers["idempotency-key"] || "" });
      const send = (status, obj) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
      const key = auth.replace(/^Bearer /, "");
      if (!state.keys.has(key)) return send(401, { error: { message: "Invalid API Key provided: " + key } });
      const live = key.includes("_live_");
      if (req.method === "POST" && req.headers["idempotency-key"] && state.idem.has(req.headers["idempotency-key"])) return send(200, state.idem.get(req.headers["idempotency-key"]));
      const remember = obj => { if (req.headers["idempotency-key"]) state.idem.set(req.headers["idempotency-key"], obj); return obj; };
      if (req.method === "GET" && url.pathname === "/v1/prices") {
        const keys = url.searchParams.getAll("lookup_keys[]");
        return send(200, { object: "list", data: state.prices.filter(p => p.livemode === live && keys.includes(p.lookup_key)) });
      }
      let m = /^\/v1\/products\/([^/]+)$/.exec(url.pathname);
      if (req.method === "GET" && m) {
        const p = state.products.get((live ? "live:" : "test:") + decodeURIComponent(m[1]));
        return p ? send(200, p) : send(404, { error: { code: "resource_missing", message: "No such product" } });
      }
      if (req.method === "POST" && url.pathname === "/v1/products") {
        const id = (live ? "live:" : "test:") + form.id;
        if (state.products.has(id)) return send(400, { error: { code: "resource_already_exists", message: "Product already exists." } });
        const p = { id: form.id, object: "product", active: true, livemode: live, name: form.name, description: form.description, tax_code: form.tax_code, metadata: { game: form["metadata[game]"], sku: form["metadata[sku]"] } };
        state.products.set(id, p); return send(200, remember(p));
      }
      if (req.method === "POST" && url.pathname === "/v1/prices") {
        if (!state.products.has((live ? "live:" : "test:") + form.product)) return send(400, { error: { message: "No such product: " + form.product } });
        const p = { id: "price_1Mock" + (live ? "Live" : "Test") + String(++state.seq).padStart(4, "0"), object: "price", active: true, livemode: live, currency: form.currency, unit_amount: Number(form.unit_amount),
                    type: "one_time", recurring: null, lookup_key: form.lookup_key, product: form.product, tax_behavior: form.tax_behavior, metadata: { game: form["metadata[game]"], sku: form["metadata[sku]"] } };
        state.prices.push(p); return send(200, remember(p));
      }
      send(404, { error: { message: "mock: no such route " + req.method + " " + url.pathname } });
    });
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  state.keys.add(TEST_KEY); state.keys.add(LIVE_KEY);
  return { state, base: "http://127.0.0.1:" + server.address().port, close: () => new Promise(r => server.close(r)),
           posts: () => state.requests.filter(r => r.method === "POST"), reset: () => { state.requests.length = 0; } };
}
/* runs the real script as its own process, the way the owner does; the key travels only in the environment */
function run(args, env = {}) {
  return new Promise(resolve => {
    const clean = { ...process.env }; delete clean.STRIPE_SECRET_KEY; delete clean.STRIPE_API_BASE;
    const child = spawn(process.execPath, [SCRIPT, ...args], { env: { ...clean, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", d => { stdout += d; }); child.stderr.on("data", d => { stderr += d; });
    child.on("close", code => resolve({ code, stdout, stderr, all: stdout + stderr }));
  });
}
/* copies of the two real settings files, so --write is tried on what the owner really has */
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ot-stripe-"));
  const storeConfig = path.join(dir, "store-config.js"), wrangler = path.join(dir, "wrangler.toml");
  fs.copyFileSync(path.join(ROOT, "site/games/kc-open-trail/js/store-config.js"), storeConfig);
  fs.copyFileSync(path.join(ROOT, "worker/wrangler.toml"), wrangler);
  return { dir, storeConfig, wrangler, args: ["--store-config=" + storeConfig, "--wrangler=" + wrangler], rm: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
const tomlPrices = (file, table) => {
  let cur = "";
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const h = /^\[\[?([^\]]+)\]\]?/.exec(line); if (h) { cur = h[1]; continue; }
    const m = cur === table && /^STRIPE_PRICES\s*=\s*(".*")\s*$/.exec(line); if (m) return JSON.parse(JSON.parse(m[1]));
  }
  return null;
};
const loadConfig = async file => { const copy = file.replace(/\.js$/, "-" + Date.now() + Math.random().toString(36).slice(2) + ".mjs"); fs.copyFileSync(file, copy); return import(copy); };

/* ---------------------------------------------------------------- the catalogue itself */
test("the catalogue matches the worker's OT_PRICES and the game's store-config.js", () => {
  const worker = fs.readFileSync(path.join(ROOT, "worker/dewclaw-worker.js"), "utf8");
  const block = /const OT_PRICES = \{([\s\S]*?)\};/.exec(worker);
  assert.ok(block, "OT_PRICES found in the worker");
  const want = Object.fromEntries([...block[1].matchAll(/(ot_[a-z0-9_]+):\s*(\d+)/g)].map(m => [m[1], Number(m[2])]));
  assert.equal(Object.keys(want).length, 16);
  assert.deepEqual(Object.fromEntries(CATALOG.map(c => [c.sku, c.cents])), want);
  const cfg = fs.readFileSync(path.join(ROOT, "site/games/kc-open-trail/js/store-config.js"), "utf8");
  const keys = [...(/STRIPE_PRICE_IDS = \{([\s\S]*?)\n\};/.exec(cfg) || ["", ""])[1].matchAll(/^\s*(ot_[a-z0-9_]+):/gm)].map(m => m[1]);
  assert.deepEqual(keys, CATALOG.map(c => c.sku), "same 16 SKUs, same order, as store-config.js");
  for (const c of CATALOG) { assert.ok(c.name.startsWith("KC: Open Trail, ")); assert.ok(c.description.length > 20 && c.description.length < 400); assert.ok(!/donat(e|ion)/i.test(c.name)); }
  assert.match(TAX_CODE, /^txcd_\d{8}$/);
});

test("mergePrices keeps every Dewclaw id and replaces only ot_ ids", () => {
  const out = mergePrices({ dewclaw_plus_monthly: "price_A", pp_revive: "price_B", ot_gems_80: "price_OLD", ot_tip_3: "price_OLDTIP" }, { ot_gems_80: "price_NEW" });
  assert.deepEqual(out, { dewclaw_plus_monthly: "price_A", pp_revive: "price_B", ot_gems_80: "price_NEW" });
  assert.match(storeConfigBlock({ ot_gems_80: "price_NEW" }), /ot_gems_80: 'price_NEW',\s+\/\* \$0\.99/);
  assert.match(storeConfigBlock({}), /ot_tip_3: 'OWNER_FILLS_IN'\s+\/\* \$3\.00/);
});

/* ---------------------------------------------------------------- guards that must hold before anything is sent */
test("guards: no key, live key without --live, --live with a test key, publishable key, key on the command line, foreign API address", async () => {
  const mock = await mockStripe();
  try {
    let r = await run(["--dry-run"]);
    assert.equal(r.code, 0); assert.match(r.stdout, /DRY RUN with no key/); assert.match(r.stdout, /ot_everything\s+\$24\.99/);

    r = await run([], { STRIPE_API_BASE: mock.base });
    assert.notEqual(r.code, 0); assert.match(r.stderr, /No Stripe key/);

    r = await run([], { STRIPE_API_BASE: mock.base, STRIPE_SECRET_KEY: LIVE_KEY });
    assert.notEqual(r.code, 0); assert.match(r.stderr, /LIVE Stripe key, and --live was not given/);
    r = await run(["--dry-run"], { STRIPE_API_BASE: mock.base, STRIPE_SECRET_KEY: LIVE_KEY });
    assert.notEqual(r.code, 0, "a live key is refused even for a dry run without --live");

    r = await run(["--live"], { STRIPE_API_BASE: mock.base, STRIPE_SECRET_KEY: TEST_KEY });
    assert.notEqual(r.code, 0); assert.match(r.stderr, /--live was given but this is a TEST key/);

    r = await run([], { STRIPE_API_BASE: mock.base, STRIPE_SECRET_KEY: "pk_test_abcdefghijklmnop" });
    assert.notEqual(r.code, 0); assert.match(r.stderr, /publishable key/);
    r = await run([], { STRIPE_API_BASE: mock.base, STRIPE_SECRET_KEY: "hunter2" });
    assert.notEqual(r.code, 0); assert.match(r.stderr, /does not look like a Stripe key/); assert.ok(!r.all.includes("hunter2"));

    r = await run([TEST_KEY], { STRIPE_API_BASE: mock.base });
    assert.notEqual(r.code, 0); assert.match(r.stderr, /Never put a Stripe key on the command line/); assert.ok(!r.all.includes(TEST_KEY));

    r = await run([], { STRIPE_API_BASE: "https://stripe.example.com", STRIPE_SECRET_KEY: TEST_KEY });
    assert.notEqual(r.code, 0); assert.match(r.stderr, /may only point at this computer/);

    r = await run(["--hold=ot_nope"], { STRIPE_API_BASE: mock.base, STRIPE_SECRET_KEY: TEST_KEY });
    assert.notEqual(r.code, 0); assert.match(r.stderr, /not one of the 16 items/);
    r = await run(["--worker-url=http://plain.example.com", "--write"], { STRIPE_API_BASE: mock.base, STRIPE_SECRET_KEY: TEST_KEY });
    assert.notEqual(r.code, 0); assert.match(r.stderr, /plain https address/);

    assert.equal(mock.state.requests.length, 0, "none of the refused runs sent anything at all");
  } finally { await mock.close(); }
});

/* ---------------------------------------------------------------- create, run again, dry run */
test("test mode: dry run creates nothing; a run creates 16 products and prices; a second run creates nothing and gives the same ids", async () => {
  const mock = await mockStripe(), box = sandbox();
  const env = { STRIPE_API_BASE: mock.base, STRIPE_SECRET_KEY: TEST_KEY };
  try {
    let r = await run(["--dry-run", ...box.args], env);
    assert.equal(r.code, 0, r.all); assert.match(r.stdout, /0 already in Stripe, 16 would be created/);
    assert.equal(mock.posts().length, 0, "a dry run only reads");
    assert.ok(mock.state.requests.length > 0 && mock.state.requests.every(q => q.method === "GET"));

    mock.reset();
    r = await run([...box.args], env);
    assert.equal(r.code, 0, r.all); assert.match(r.stdout, /16 created, 0 already there/);
    assert.ok(!r.all.includes(TEST_KEY), "the key is never printed");
    assert.equal(mock.state.products.size, 16); assert.equal(mock.state.prices.length, 16);
    assert.ok(mock.state.requests.every(q => q.auth === "Bearer " + TEST_KEY));
    assert.ok(mock.posts().every(q => /^ot-setup-[0-9a-f]{40}$/.test(q.idem)), "every create carries an idempotency key");
    for (const c of CATALOG) {
      const prod = mock.state.products.get("test:" + productId(c.sku)), price = mock.state.prices.find(p => p.lookup_key === c.sku);
      assert.ok(prod && price, c.sku);
      assert.equal(prod.name, c.name); assert.equal(prod.description, c.description); assert.equal(prod.tax_code, TAX_CODE);
      assert.deepEqual(prod.metadata, { game: "kc-open-trail", sku: c.sku });
      assert.equal(price.unit_amount, c.cents); assert.equal(price.currency, "usd"); assert.equal(price.product, productId(c.sku));
      assert.equal(price.tax_behavior, "exclusive"); assert.deepEqual(price.metadata, { game: "kc-open-trail", sku: c.sku });
      assert.ok(r.stdout.includes(`${c.sku}: '${price.id}'`), "block (a) lists " + c.sku);
    }
    const priceForms = mock.posts().filter(q => q.path === "/v1/prices").map(q => q.form);
    assert.ok(priceForms.every(f => !("recurring[interval]" in f) && !("product_data[name]" in f)), "one-time prices on the script's own products");
    assert.match(r.stdout, /\(b\) For worker\/wrangler\.toml, the STRIPE_PRICES line under \[env\.test\.vars\]/);
    assert.match(r.stdout, /Nothing was written to any file/);
    assert.equal(fs.readFileSync(box.storeConfig, "utf8"), fs.readFileSync(path.join(ROOT, "site/games/kc-open-trail/js/store-config.js"), "utf8"), "without --write no file changes");
    const firstIds = mock.state.prices.map(p => p.id).join();

    mock.reset();
    r = await run([...box.args], env);
    assert.equal(r.code, 0, r.all); assert.match(r.stdout, /All 16 were already in Stripe\. Nothing was created/);
    assert.equal(mock.posts().length, 0, "the second run sends no create at all");
    assert.equal(mock.state.prices.map(p => p.id).join(), firstIds);
    for (const p of mock.state.prices) assert.ok(r.stdout.includes(`${p.lookup_key}: '${p.id}'`));

    /* a half-finished earlier run: a product exists with no price yet. Only the price is made. */
    mock.state.prices = mock.state.prices.filter(p => p.lookup_key !== "ot_tip_3"); mock.reset();
    r = await run([...box.args], env);
    assert.equal(r.code, 0, r.all); assert.match(r.stdout, /1 created, 15 already there/);
    assert.deepEqual(mock.posts().map(q => q.path), ["/v1/prices"]);

    /* test and live are separate: the live side of the pretend Stripe is still empty */
    mock.reset();
    r = await run(["--live", "--dry-run", ...box.args], { ...env, STRIPE_SECRET_KEY: LIVE_KEY });
    assert.equal(r.code, 0, r.all); assert.match(r.stdout, /LIVE mode, DRY RUN/); assert.match(r.stdout, /16 would be created/);
    assert.equal(mock.posts().length, 0);
  } finally { await mock.close(); box.rm(); }
});

/* ---------------------------------------------------------------- an existing price that is wrong */
test("an existing price with a different amount stops the run before anything is created or written", async () => {
  const mock = await mockStripe(), box = sandbox();
  const env = { STRIPE_API_BASE: mock.base, STRIPE_SECRET_KEY: TEST_KEY };
  const before = { cfg: fs.readFileSync(box.storeConfig, "utf8"), toml: fs.readFileSync(box.wrangler, "utf8") };
  try {
    mock.state.prices.push({ id: "price_1MockWrongAmount", object: "price", active: true, livemode: false, currency: "usd", unit_amount: 1099, type: "one_time", recurring: null, lookup_key: "ot_gems_1200" });
    let r = await run(["--write", ...box.args], env);
    assert.equal(r.code, 2, r.all);
    assert.match(r.stderr, /STOPPED\. Nothing was created and no file was changed/);
    assert.match(r.stderr, /ot_gems_1200: a price with this lookup key already exists \(price_1MockWrongAmount\) but its amount is \$10\.99, the catalogue says \$9\.99/);
    assert.equal(mock.posts().length, 0); assert.equal(mock.state.products.size, 0);
    assert.equal(fs.readFileSync(box.storeConfig, "utf8"), before.cfg); assert.equal(fs.readFileSync(box.wrangler, "utf8"), before.toml);

    /* the other ways a price can be wrong for the worker: currency, recurring, archived */
    mock.state.prices.length = 0;
    mock.state.prices.push({ id: "price_1MockEuro0001", active: true, livemode: false, currency: "eur", unit_amount: 99, type: "one_time", recurring: null, lookup_key: "ot_gems_80" },
                           { id: "price_1MockMonthly1", active: true, livemode: false, currency: "usd", unit_amount: 599, type: "recurring", recurring: { interval: "month" }, lookup_key: "ot_trail_pass" },
                           { id: "price_1MockArchived", active: false, livemode: false, currency: "usd", unit_amount: 300, type: "one_time", recurring: null, lookup_key: "ot_tip_3" });
    r = await run([...box.args], env);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /ot_gems_80: .*currency is EUR/); assert.match(r.stderr, /ot_trail_pass: .*recurring price/); assert.match(r.stderr, /ot_tip_3: .*archived/);
    assert.equal(mock.posts().length, 0);

    /* a key Stripe does not know: said plainly, and the key itself is not repeated even though the pretend Stripe echoes it */
    const bad = "sk_test_" + "NotAKeyStripeKnows123";
    r = await run([...box.args], { ...env, STRIPE_SECRET_KEY: bad });
    assert.notEqual(r.code, 0); assert.match(r.stderr, /did not accept the key/); assert.ok(!r.all.includes(bad));
  } finally { await mock.close(); box.rm(); }
});

/* ---------------------------------------------------------------- --write */
test("--write in test mode fills store-config.js and only the [env.test.vars] block of wrangler.toml", async () => {
  const mock = await mockStripe(), box = sandbox();
  const env = { STRIPE_API_BASE: mock.base, STRIPE_SECRET_KEY: TEST_KEY };
  try {
    const liveBefore = tomlPrices(box.wrangler, "vars");
    const r = await run(["--write", "--hold=ot_treat_3,ot_tip_3", "--worker-url=https://dewclaw-ot-test.example.workers.dev/", "--support-contact=help@example.com", ...box.args], env);
    assert.equal(r.code, 0, r.all); assert.match(r.stdout, /Wrote /); assert.match(r.stdout, /These are TEST ids/);
    const cfg = await loadConfig(box.storeConfig);
    assert.equal(cfg.WORKER_URL, "https://dewclaw-ot-test.example.workers.dev", "the slash at the end is dropped");
    assert.equal(cfg.SUPPORT_CONTACT, "help@example.com");
    assert.equal(cfg.PLAY_BILLING, "off", "the rest of the file is untouched");
    assert.equal(Object.keys(cfg.STRIPE_PRICE_IDS).length, 16);
    for (const c of CATALOG) {
      const held = ["ot_treat_3", "ot_tip_3"].includes(c.sku), id = mock.state.prices.find(p => p.lookup_key === c.sku).id;
      assert.equal(cfg.STRIPE_PRICE_IDS[c.sku], held ? "OWNER_FILLS_IN" : id, c.sku);
    }
    const text = fs.readFileSync(box.storeConfig, "utf8");
    assert.ok(text.includes("THE OWNER FILLS THESE IN") && text.includes("PLAY_BILLING"), "comments kept");
    assert.ok(!text.includes(TEST_KEY) && !fs.readFileSync(box.wrangler, "utf8").includes(TEST_KEY), "the key is in neither file");
    assert.deepEqual(tomlPrices(box.wrangler, "vars"), liveBefore, "the live [vars] line is not touched by a test run");
    const t = tomlPrices(box.wrangler, "env.test.vars");
    assert.equal(Object.keys(t).length, 14); assert.ok(!("ot_tip_3" in t)); assert.equal(t.ot_gems_80, cfg.STRIPE_PRICE_IDS.ot_gems_80);
    assert.deepEqual(fs.readdirSync(box.dir).filter(f => f.includes(".tmp-")), [], "no temporary file left behind");
  } finally { await mock.close(); box.rm(); }
});

test("--live --write merges the 16 live ids into [vars] next to the existing Dewclaw ids, and a later run is stable", async () => {
  const mock = await mockStripe(), box = sandbox();
  const env = { STRIPE_API_BASE: mock.base, STRIPE_SECRET_KEY: LIVE_KEY };
  try {
    const dewclaw = JSON.parse(fs.readFileSync(path.join(ROOT, "worker/stripe-prices.live.json"), "utf8"));
    const before = tomlPrices(box.wrangler, "vars"), testBefore = tomlPrices(box.wrangler, "env.test.vars");
    for (const [k, v] of Object.entries(dewclaw)) assert.equal(before[k], v, "the real wrangler.toml still holds Dewclaw's " + k);
    let r = await run(["--live", "--write", ...box.args], env);
    assert.equal(r.code, 0, r.all); assert.match(r.stdout, /LIVE mode/); assert.match(r.stdout, /These are LIVE ids/); assert.ok(!r.all.includes(LIVE_KEY));
    const after = tomlPrices(box.wrangler, "vars");
    for (const [k, v] of Object.entries(before)) if (!k.startsWith("ot_")) assert.equal(after[k], v, "kept " + k);
    assert.equal(Object.keys(after).length, Object.keys(before).filter(k => !k.startsWith("ot_")).length + 16);
    for (const c of CATALOG) { const p = mock.state.prices.find(x => x.lookup_key === c.sku); assert.equal(p.livemode, true); assert.equal(after[c.sku], p.id); }
    assert.deepEqual(tomlPrices(box.wrangler, "env.test.vars"), testBefore, "the test block is not touched by a live run");
    /* everything else in wrangler.toml is byte-for-byte the same */
    const strip = s => s.split("\n").filter(l => !l.startsWith("STRIPE_PRICES")).join("\n");
    assert.equal(strip(fs.readFileSync(box.wrangler, "utf8")), strip(fs.readFileSync(path.join(ROOT, "worker/wrangler.toml"), "utf8")));
    const cfg = await loadConfig(box.storeConfig);
    for (const c of CATALOG) assert.equal(cfg.STRIPE_PRICE_IDS[c.sku], after[c.sku]);
    assert.equal(cfg.WORKER_URL, (await import(path.join(ROOT, "site/games/kc-open-trail/js/store-config.js"))).WORKER_URL, "WORKER_URL is left alone unless --worker-url is given");

    const snap = { cfg: fs.readFileSync(box.storeConfig, "utf8"), toml: fs.readFileSync(box.wrangler, "utf8") };
    mock.reset();
    r = await run(["--live", "--write", ...box.args], env);
    assert.equal(r.code, 0, r.all); assert.equal(mock.posts().length, 0);
    assert.equal(fs.readFileSync(box.storeConfig, "utf8"), snap.cfg); assert.equal(fs.readFileSync(box.wrangler, "utf8"), snap.toml);
  } finally { await mock.close(); box.rm(); }
});

test("--write refuses, before talking to Stripe, when wrangler.toml has no STRIPE_PRICES line in the right block", async () => {
  const mock = await mockStripe(), box = sandbox();
  try {
    fs.writeFileSync(box.wrangler, fs.readFileSync(box.wrangler, "utf8").split("\n").filter(l => l !== 'STRIPE_PRICES = "{}"').join("\n"));
    const r = await run(["--write", ...box.args], { STRIPE_API_BASE: mock.base, STRIPE_SECRET_KEY: TEST_KEY });
    assert.notEqual(r.code, 0); assert.match(r.stderr, /Cannot find a readable STRIPE_PRICES line under \[env\.test\.vars\]/);
    assert.equal(mock.state.requests.length, 0);
  } finally { await mock.close(); box.rm(); }
});
