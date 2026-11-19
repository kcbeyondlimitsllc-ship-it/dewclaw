/* Tests for the Dewclaw server, with Google Play and Anthropic faked.
   Run:  node test.js   (Node 18+; no packages needed) */
import { handle } from "./dewclaw-worker.js";
import { generateKeyPairSync } from "node:crypto";
import assert from "node:assert/strict";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" });

/* ---- fakes */
function fakeKV() {
  const m = new Map();
  return { m,
    async get(k, type) { const v = m.get(k); if (v == null) return null; return type === "json" ? JSON.parse(v) : v; },
    async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); } };
}
const google = { state: "SUBSCRIPTION_STATE_ACTIVE", expiry: Date.now() + 20 * 86400e3, ack: "ACKNOWLEDGEMENT_STATE_PENDING", acks: 0, checks: 0, tokenCalls: 0, status: 200 };
const claude = { fail: false, calls: 0, lastBody: null, rejectSearch: false };
const product = { state: 0, ack: 0, acks: 0, checks: 0, status: 200 };
async function fetch(url, init = {}) {
  const u = String(url);
  { const pf = otPlayFake(u, init); if (pf) return pf; }
  if (u.startsWith("https://oauth2.googleapis.com/token")) { google.tokenCalls++; return new Response(JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }), { status: 200 }); }
  if (u.includes("/purchases/subscriptionsv2/tokens/")) {
    google.checks++;
    if (google.status !== 200) return new Response("{}", { status: google.status });
    return new Response(JSON.stringify({ subscriptionState: google.state, acknowledgementState: google.ack,
      lineItems: [{ productId: "dewclaw_plus_monthly", expiryTime: new Date(google.expiry).toISOString() }] }), { status: 200 });
  }
  if (u.includes("/purchases/products/") && u.includes(":acknowledge")) { product.acks++; product.ack = 1; return new Response("{}", { status: 200 }); }
  if (u.includes("/purchases/products/")) { product.checks++; if (product.status !== 200) return new Response("{}", { status: product.status });
    return new Response(JSON.stringify({ purchaseState: product.state, acknowledgementState: product.ack, consumptionState: 0, orderId: "GPA.1" }), { status: 200 }); }
  if (u.includes(":acknowledge")) { google.acks++; google.ack = "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"; return new Response("{}", { status: 200 }); }
  if (u === "https://api.anthropic.com/v1/messages") {
    claude.calls++; claude.lastBody = JSON.parse(init.body);
    if (claude.fail) return new Response(JSON.stringify({ error: { message: "overloaded" } }), { status: 529 });
    if (claude.rejectSearch && claude.lastBody.tools) return new Response(JSON.stringify({ error: { message: "tools: web_search_20260209 is not available" } }), { status: 400 });
    return new Response(JSON.stringify({ content: [
      { type: "text", text: "[urgency: today]\nCall your vet today. " },
      { type: "text", text: "Chocolate contains theobromine.", citations: [{ url: "https://www.merckvetmanual.com/x", title: "Merck" }, { url: "https://www.merckvetmanual.com/x", title: "dup" }] },
      { type: "web_search_tool_result", content: [] }
    ] }), { status: 200 });
  }
  /* ---- Stripe */
  if (u.startsWith("https://api.stripe.com/v1/")) {
    stripe.calls++; stripe.lastAuth = init.headers?.authorization || "";
    const path = u.slice("https://api.stripe.com/v1".length);
    const form = init.body ? Object.fromEntries(new URLSearchParams(init.body)) : {};
    const ok = b => new Response(JSON.stringify(b), { status: 200 });
    if (path === "/checkout/sessions" && init.method === "POST") { stripe.lastForm = form; stripe.sessions["cs_test_" + (++stripe.n)] = { status: "complete", payment_status: form.mode === "subscription" ? "no_payment_required" : "paid", mode: form.mode, metadata: Object.fromEntries(Object.entries(form).filter(([k]) => /^metadata\[\w+\]$/.test(k)).map(([k, v]) => [k.slice(9, -1), v])), amount_subtotal: (otPrice(form["line_items[0][price]"]) || {}).unit_amount, currency: (otPrice(form["line_items[0][price]"]) || {}).currency, customer: "cus_1", subscription: form.mode === "subscription" ? "sub_1" : null }; return ok({ id: "cs_test_" + stripe.n, url: "https://checkout.stripe.com/c/pay/cs_test_" + stripe.n }); }
    if (path.startsWith("/checkout/sessions/")) { const id = decodeURIComponent(path.split("/")[3]); const ss = stripe.sessions[id]; return ss ? ok({ id, ...ss, ...stripe.override }) : new Response(JSON.stringify({ error: { message: "No such checkout.session" } }), { status: 404 }); }
    if (path.startsWith("/subscriptions/")) { stripe.subChecks++; return ok({ id: "sub_1", status: stripe.subStatus, items: { data: [{ current_period_end: Math.floor(stripe.periodEnd / 1000) }] } }); }
    if (path === "/billing_portal/sessions") { stripe.lastForm = form; return ok({ url: "https://billing.stripe.com/p/session/x" }); }
    if (path.startsWith("/prices/")) { const id = path.split("/")[2]; const P = { price_m: { unit_amount: 299, currency: "usd", recurring: { interval: "month" } }, price_y: { unit_amount: 1199, currency: "usd", recurring: { interval: "year" } }, price_life: { unit_amount: 2999, currency: "usd" }, price_b500: { unit_amount: 99, currency: "usd" } }; stripe.priceReads++; return P[id] || otPrice(id) ? ok(P[id] || otPrice(id)) : new Response("{}", { status: 404 }); }
  }
  /* ---- PayPal */
  if (u.startsWith("https://api-m.sandbox.paypal.com") || u.startsWith("https://api-m.paypal.com")) {
    paypalFake.calls++; paypalFake.lastBase = u.startsWith("https://api-m.paypal.com") ? "live" : "sandbox";
    const path = u.replace(/^https:\/\/api-m\.(sandbox\.)?paypal\.com/, "");
    const ok = (b, st = 200) => new Response(JSON.stringify(b), { status: st });
    if (path === "/v1/oauth2/token") { paypalFake.tokenCalls++; paypalFake.lastBasic = init.headers.authorization; return paypalFake.badCreds ? ok({ error: "invalid_client" }, 401) : ok({ access_token: "A21.test", expires_in: 32400 }); }
    if (path === "/v2/checkout/orders" && init.method === "POST") {
      const b = JSON.parse(init.body); paypalFake.lastOrder = b; paypalFake.lastRequestId = init.headers["paypal-request-id"];
      const id = "5O190127TN" + String(++paypalFake.n).padStart(6, "0");
      paypalFake.orders[id] = { id, status: "PAYER_ACTION_REQUIRED", sku: b.purchase_units[0].custom_id, value: b.purchase_units[0].amount.value };
      return ok({ id, status: "PAYER_ACTION_REQUIRED", links: [{ rel: "self", href: "x" }, { rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=" + id }] });
    }
    const m = path.match(/^\/v2\/checkout\/orders\/([A-Z0-9]+)(\/capture)?$/);
    if (m) {
      const o = paypalFake.orders[m[1]];
      if (!o) return ok({ name: "RESOURCE_NOT_FOUND" }, 404);
      const view = () => ({ id: o.id, status: o.status, payer: { payer_id: "PAYERX" }, purchase_units: [{ reference_id: o.sku, custom_id: o.sku, amount: { currency_code: "USD", value: o.paidValue || o.value },
        payments: o.status === "COMPLETED" ? { captures: [{ id: "CAP1", status: o.capStatus || "COMPLETED", amount: { currency_code: o.currency || "USD", value: o.paidValue || o.value } }] } : undefined }] });
      if (m[2]) { paypalFake.captures++; if (o.status === "COMPLETED") return ok({ name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] }, 422);
        if (o.decline) return ok({ name: "UNPROCESSABLE_ENTITY", details: [{ issue: "INSTRUMENT_DECLINED" }] }, 422);
        o.status = "COMPLETED"; return ok(view(), 201); }
      return ok(view());
    }
  }
  throw new Error("unexpected fetch " + u);
}
const paypalFake = { calls: 0, n: 0, tokenCalls: 0, captures: 0, orders: {}, lastOrder: null, lastBase: "", lastBasic: "", badCreds: false };
const ppEnv = (extra = {}) => ({ ...stripeEnv(), PAYPAL_CLIENT_ID: "cid", PAYPAL_SECRET: "sec", ...extra });
const approve = id => { paypalFake.orders[id].status = "APPROVED"; };
/* KC: Open Trail. What the catalogue says each ot_ SKU costs (US cents) and grants: written out here from the spec
   (MONETIZATION-EXPANSION-SPEC.md 4.2), not read from the worker, so a slip in either place fails a test. */
const OT_F = ["hat:moss-beanie", "bandana:fern", "collar:cedar", "trail:firefly", "skin:skateboard:forest", "skin:canoe:forest", "skin:van:forest", "decor:mushroom-lamp"];
const OT_G = ["hat:comet-cap", "bandana:starfield", "collar:nebula", "trail:stardust", "skin:skateboard:galaxy", "skin:canoe:galaxy", "skin:van:galaxy", "decor:moon-lamp"];
const OT_R = ["hat:road-visor", "bandana:route-stripe", "collar:mile-marker", "trail:dust", "skin:skateboard:roadtrip", "skin:canoe:roadtrip", "skin:van:roadtrip", "decor:roadside-sign"];
const OT_H = ["hat:pumpkin-patch", "bandana:candy-corn", "collar:cobweb", "trail:ember", "skin:skateboard:spooky", "skin:canoe:spooky", "skin:van:spooky", "decor:jack-lantern"];
const OT_S = ["tag:supporter", "bandana:supporter", "den:gold-trim", "frame:supporter"];
const OT = {
  ot_gems_80:        { cents: 99,   gems: 80,   items: [], flags: {}, permanent: false },
  ot_gems_500:       { cents: 499,  gems: 500,  items: [], flags: {}, permanent: false },
  ot_gems_1200:      { cents: 999,  gems: 1200, items: [], flags: {}, permanent: false },
  ot_gems_2600:      { cents: 1999, gems: 2600, items: [], flags: {}, permanent: false },
  ot_gems_7000:      { cents: 4999, gems: 7000, items: [], flags: {}, permanent: false },
  ot_starter:        { cents: 499,  gems: 400,  items: ["bandana:first-trail", "tag:first-trail", "trail:sunbeam", "skin:skateboard:first-trail"], flags: { "store:starter": true }, permanent: true },
  ot_trail_pass:     { cents: 599,  gems: 0,    items: ["pass:trail"], flags: { "store:pass": true }, permanent: true },
  ot_pack_forest:    { cents: 399,  gems: 0,    items: OT_F, flags: {}, permanent: true },
  ot_pack_galaxy:    { cents: 399,  gems: 0,    items: OT_G, flags: {}, permanent: true },
  ot_pack_roadtrip:  { cents: 399,  gems: 0,    items: OT_R, flags: {}, permanent: true },
  ot_pack_halloween: { cents: 399,  gems: 0,    items: OT_H, flags: {}, permanent: true },
  ot_treat_3:        { cents: 199,  gems: 0,    items: ["treat:3"], flags: {}, permanent: false },
  ot_treat_10:       { cents: 499,  gems: 0,    items: ["treat:10"], flags: {}, permanent: false },
  ot_supporter:      { cents: 999,  gems: 600,  items: OT_S, flags: { "store:supporter": true }, permanent: true },
  ot_everything:     { cents: 2499, gems: 600,  items: ["pass:trail", ...OT_F, ...OT_G, ...OT_R, ...OT_H, ...OT_S], flags: { "store:pass": true, "store:supporter": true }, permanent: true },
  ot_tip_3:          { cents: 300,  gems: 0,    items: ["tag:good-human"], flags: {}, permanent: false }
};
const OT_SKUS = Object.keys(OT);
/* the fake Stripe's prices for the game: price_ot_<sku>; stripe.otPrices overrides one (a wrong amount, a subscription, another currency) */
function otPrice(id) {
  if (stripe.otPrices[id]) return stripe.otPrices[id];
  const sku = String(id || "").replace(/^price_/, "");
  return OT[sku] ? { unit_amount: OT[sku].cents, currency: "usd", active: true } : null;
}
const GAME = "https://play.example.test";
const otEnv = (extra = {}) => ({ ...stripeEnv(), ALLOWED_ORIGIN: "https://dewclaw-app.netlify.app," + GAME, OT_RETURN_URL: GAME + "/games/kc-open-trail/",
  STRIPE_PRICES: JSON.stringify({ ...JSON.parse(stripeEnv().STRIPE_PRICES), ...Object.fromEntries(OT_SKUS.map(k => [k, "price_" + k])) }), ...extra });
const INSTALL = "inst_AAAAAAAAAAAAAAAAAAAAAAAA", INSTALL2 = "inst_BBBBBBBBBBBBBBBBBBBBBBBB";
const greq = (path, body, method = "POST") => req(path, body, method, { origin: GAME });
const otBuy = async (e, sku, install = INSTALL) => { const r = await handle(greq("/stripe/checkout", { sku, install }), e, deps); const j = await r.json(); return { r, j, id: j.url ? j.url.split("/").pop() : "" }; };
const otClaimReq = async (e, session, install = INSTALL, extra = {}) => { const r = await handle(greq("/stripe/claim", { session, install, ...extra }), e, deps); return { r, j: await r.json() }; };
const claimKeys = e => [...e.DEWCLAW.m.keys()].filter(k => k.startsWith("claim:"));
const stripe = { otPrices: {}, priceReads: 0, calls: 0, n: 0, sessions: {}, override: {}, subStatus: "trialing", periodEnd: Date.now() + 7 * 86400e3, subChecks: 0, lastForm: null, lastAuth: "" };
const stripeEnv = () => ({ ...env(), STRIPE_SECRET_KEY: "sk_test_123", APP_ORIGIN: "https://dewclaw-app.netlify.app/",
  STRIPE_PRICES: JSON.stringify({ dewclaw_plus_monthly: "price_m", dewclaw_plus_yearly: "price_y", dewclaw_plus_lifetime: "price_life", dewclaw_plus_gift_year: "price_gift", pp_bones_500: "price_b500", pp_kc_pack: "price_kc", pp_boost7: "price_boost", pp_revive: "price_revive" }) });
const env = () => ({ DEWCLAW: fakeKV(), PLAY_PACKAGE: "com.kcbeyondlimits.dewclaw", GOOGLE_SA_EMAIL: "svc@test.iam.gserviceaccount.com", GOOGLE_SA_KEY: PEM,
                     ANTHROPIC_API_KEY: "sk-ant-test", ALLOWED_ORIGIN: "https://dewclaw-app.netlify.app", MONTHLY_ASKS: "3", DAILY_ASKS_TOTAL: "4" });
let clock = Date.now();
const deps = { fetch, now: () => clock };
const req = (path, body, method = "POST", headers = {}) => new Request("https://dewclaw.test" + path, { method, headers: { "content-type": "application/json", origin: "https://dewclaw-app.netlify.app", ...headers }, body: body == null ? undefined : JSON.stringify(body) });
const TOKEN = "purchase-token-abcdefghijklmnop";

let passed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log("PASS", name); } catch (e) { console.log("FAIL", name, "—", e.message); process.exitCode = 1; } }

await test("health reports what is configured", async () => {
  const r = await handle(req("/health", null, "GET"), env(), deps); const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.ok, true); assert.equal(j.play, true); assert.equal(j.claude, true); assert.equal(j.monthlyAsks, 3);
});
await test("CORS preflight answers for the app's origin only", async () => {
  const r = await handle(req("/ask", null, "OPTIONS"), env(), deps);
  assert.equal(r.status, 204); assert.equal(r.headers.get("access-control-allow-origin"), "https://dewclaw-app.netlify.app");
  const bad = await handle(req("/ask", null, "OPTIONS", { origin: "https://evil.example" }), env(), deps);
  assert.equal(bad.headers.get("access-control-allow-origin"), "null");
});
await test("verify: an active purchase is confirmed and acknowledged", async () => {
  const e = env(); google.acks = 0; google.ack = "ACKNOWLEDGEMENT_STATE_PENDING";
  const r = await handle(req("/verify", { sku: "dewclaw_plus_monthly", token: TOKEN }), e, deps); const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.active, true); assert.equal(j.sku, "dewclaw_plus_monthly"); assert.ok(j.until > clock);
  assert.equal(google.acks, 1);
});
await test("verify: an expired purchase is refused", async () => {
  google.state = "SUBSCRIPTION_STATE_EXPIRED"; google.expiry = clock - 1000;
  const r = await handle(req("/verify", { sku: "dewclaw_plus_monthly", token: TOKEN }), env(), deps); const j = await r.json();
  assert.equal(j.active, false);
  google.state = "SUBSCRIPTION_STATE_ACTIVE"; google.expiry = clock + 20 * 86400e3;
});
await test("verify: a cancelled plan stays on until its period ends", async () => {
  google.state = "SUBSCRIPTION_STATE_CANCELED";
  const j = await (await handle(req("/verify", { sku: "dewclaw_plus_monthly", token: TOKEN }), env(), deps)).json();
  assert.equal(j.active, true);
  google.state = "SUBSCRIPTION_STATE_ACTIVE";
});
await test("verify: an unknown token is simply inactive, not an error", async () => {
  google.status = 404;
  const r = await handle(req("/verify", { sku: "dewclaw_plus_monthly", token: TOKEN }), env(), deps);
  assert.equal(r.status, 200); assert.equal((await r.json()).active, false);
  google.status = 200;
});
await test("verify: a plan that isn't Dewclaw Plus is rejected", async () => {
  const r = await handle(req("/verify", { sku: "someone_elses_sku", token: TOKEN }), env(), deps);
  assert.equal(r.status, 400);
});
await test("ask: no subscription -> 402 and Claude is never called", async () => {
  claude.calls = 0;
  const r = await handle(req("/ask", { question: "Is grass bad?", token: "", sku: "" }), env(), deps);
  assert.equal(r.status, 402); assert.equal(claude.calls, 0);
});
await test("ask: a subscriber gets an answer, sources and the remaining count", async () => {
  const e = env(); claude.calls = 0;
  const r = await handle(req("/ask", { question: "My dog ate chocolate", token: TOKEN, sku: "dewclaw_plus_monthly", pet: "Dog, Labrador, 4y, 71 lb" }), e, deps);
  const j = await r.json();
  assert.equal(r.status, 200); assert.match(j.text, /^\[urgency: today\]/); assert.equal(j.remaining, 2);
  assert.equal(j.sources.length, 1, "duplicate citation collapsed");
  assert.equal(claude.lastBody.model, "claude-haiku-5-5");
  assert.equal(claude.lastBody.tools[0].max_uses, 2);
  assert.match(claude.lastBody.messages[0].content, /Pet profile:\nDog, Labrador/);
  assert.equal(claude.lastBody.system[0].cache_control.type, "ephemeral");
});
await test("ask: the subscription check is cached, then re-checked after the TTL", async () => {
  const e = env(); google.checks = 0;
  await handle(req("/ask", { question: "q1", token: TOKEN, sku: "dewclaw_plus_monthly" }), e, deps);
  await handle(req("/ask", { question: "q2", token: TOKEN, sku: "dewclaw_plus_monthly" }), e, deps);
  assert.equal(google.checks, 1, "one Google check for two questions");
  clock += 7 * 3600e3;
  await handle(req("/ask", { question: "q3", token: TOKEN, sku: "dewclaw_plus_monthly" }), e, deps);
  assert.equal(google.checks, 2, "re-checked after six hours");
});
await test("ask: the monthly allowance stops at the cap", async () => {
  const e = env();
  for (let i = 0; i < 3; i++) assert.equal((await handle(req("/ask", { question: "q" + i, token: TOKEN, sku: "dewclaw_plus_monthly" }), e, deps)).status, 200);
  const r = await handle(req("/ask", { question: "q4", token: TOKEN, sku: "dewclaw_plus_monthly" }), e, deps);
  assert.equal(r.status, 429); assert.match((await r.json()).error, /this month's 3 written answers/);
});
await test("ask: the daily cap across everyone holds", async () => {
  const e = env();
  const other = "another-purchase-token-xyzxyzxyz";
  for (let i = 0; i < 3; i++) await handle(req("/ask", { question: "q" + i, token: TOKEN, sku: "dewclaw_plus_monthly" }), e, deps);
  assert.equal((await handle(req("/ask", { question: "q", token: other, sku: "dewclaw_plus_monthly" }), e, deps)).status, 200);
  const r = await handle(req("/ask", { question: "q", token: other, sku: "dewclaw_plus_monthly" }), e, deps);
  assert.equal(r.status, 429); assert.match((await r.json()).error, /today/);
});
await test("ask: a failed Claude call is refunded", async () => {
  const e = env(); claude.fail = true;
  const r = await handle(req("/ask", { question: "q", token: TOKEN, sku: "dewclaw_plus_monthly" }), e, deps);
  assert.equal(r.status, 503);
  claude.fail = false;
  const j = await (await handle(req("/ask", { question: "q", token: TOKEN, sku: "dewclaw_plus_monthly" }), e, deps)).json();
  assert.equal(j.remaining, 2, "the failed question didn't count");
});
await test("ask: falls back to no search if the account can't use the tool", async () => {
  const e = env(); claude.rejectSearch = true; claude.calls = 0;
  const r = await handle(req("/ask", { question: "q", token: TOKEN, sku: "dewclaw_plus_monthly" }), e, deps);
  assert.equal(r.status, 200); assert.equal(claude.calls, 2); assert.equal(claude.lastBody.tools, undefined);
  claude.rejectSearch = false;
});
await test("ask: refuses an expired subscriber", async () => {
  google.state = "SUBSCRIPTION_STATE_EXPIRED"; google.expiry = clock - 1000;
  const r = await handle(req("/ask", { question: "q", token: TOKEN, sku: "dewclaw_plus_monthly" }), env(), deps);
  assert.equal(r.status, 402);
  google.state = "SUBSCRIPTION_STATE_ACTIVE"; google.expiry = clock + 20 * 86400e3;
});
await test("bad input: long question, bad JSON, unknown route", async () => {
  assert.equal((await handle(req("/ask", { question: "x".repeat(1600), token: TOKEN, sku: "dewclaw_plus_monthly" }), env(), deps)).status, 400);
  const r = await handle(new Request("https://dewclaw.test/ask", { method: "POST", body: "{nope" }), env(), deps);
  assert.equal(r.status, 400);
  assert.equal((await handle(req("/nope", {}), env(), deps)).status, 404);
});
await test("no Google credentials -> a clear 503, not a crash", async () => {
  const e = env(); delete e.GOOGLE_SA_KEY;
  const r = await handle(req("/verify", { sku: "dewclaw_plus_monthly", token: TOKEN }), e, deps);
  assert.equal(r.status, 503); assert.match((await r.json()).error, /Google Play/);
});

await test("redeem: a bone pack is confirmed and grants bones, once", async () => {
  const e = env(); product.state = 0; product.checks = 0;
  const j = await (await handle(req("/redeem", { sku: "pp_bones_1300", token: "bones-token-abcdefghij" }), e, deps)).json();
  assert.equal(j.grant.bones, 1300); assert.equal(j.consumable, true); assert.equal(j.already, false);
  const again = await (await handle(req("/redeem", { sku: "pp_bones_1300", token: "bones-token-abcdefghij" }), e, deps)).json();
  assert.equal(again.already, true); assert.equal(product.checks, 1, "Google asked once");
});
await test("redeem: a one-time product is acknowledged", async () => {
  const e = env(); product.ack = 0; product.acks = 0;
  const j = await (await handle(req("/redeem", { sku: "pp_starter", token: "starter-token-abcdefghij" }), e, deps)).json();
  assert.deepEqual(j.grant.items, ["shell:camo", "hat:ranger", "scene:forest"]); assert.equal(j.grant.bones, 1500); assert.equal(product.acks, 1);
});
await test("redeem: pending, refunded, unknown and made-up products are refused", async () => {
  const e = env();
  product.state = 2; assert.equal((await handle(req("/redeem", { sku: "pp_forever", token: "pending-token-abcdefgh" }), e, deps)).status, 402);
  product.state = 1; assert.equal((await handle(req("/redeem", { sku: "pp_forever", token: "refund-token-abcdefghi" }), e, deps)).status, 402);
  product.state = 0; product.status = 404; assert.equal((await handle(req("/redeem", { sku: "pp_forever", token: "unknown-token-abcdefgh" }), e, deps)).status, 402);
  product.status = 200;
  assert.equal((await handle(req("/redeem", { sku: "pp_bones_999999", token: "fake-token-abcdefghijk" }), e, deps)).status, 400);
});


/* ---- Stripe on the web */
await test("stripe: checkout makes a Stripe session for a known web product and sends the buyer there", async () => {
  const r = await handle(req("/stripe/checkout", { sku: "dewclaw_plus_monthly", back: "/plus" }), stripeEnv(), deps); const j = await r.json();
  assert.equal(r.status, 200); assert.match(j.url, /^https:\/\/checkout\.stripe\.com\//);
  assert.equal(stripe.lastForm.mode, "subscription"); assert.equal(stripe.lastForm["line_items[0][price]"], "price_m");
  assert.equal(stripe.lastForm["subscription_data[trial_period_days]"], "7");
  assert.equal(stripe.lastForm.success_url, "https://dewclaw-app.netlify.app/?cs={CHECKOUT_SESSION_ID}#/plus");
  assert.equal(stripe.lastAuth, "Bearer sk_test_123");
  const bad = await handle(req("/stripe/checkout", { sku: "dewclaw_gold", back: "/plus" }), stripeEnv(), deps); assert.equal(bad.status, 400);
  const off = await handle(req("/stripe/checkout", { sku: "dewclaw_plus_monthly" }), env(), deps); assert.equal(off.status, 503);
});
await test("stripe: the yearly plan has no trial; a bone pack is a one-time payment", async () => {
  await handle(req("/stripe/checkout", { sku: "dewclaw_plus_yearly", back: "/plus" }), stripeEnv(), deps);
  assert.equal(stripe.lastForm["subscription_data[trial_period_days]"], undefined);
  await handle(req("/stripe/checkout", { sku: "pp_bones_500", back: "/pocket" }), stripeEnv(), deps);
  assert.equal(stripe.lastForm.mode, "payment"); assert.equal(stripe.lastForm.success_url, "https://dewclaw-app.netlify.app/?cs={CHECKOUT_SESSION_ID}#/pocket");
});
let webToken = "", webCode = "";
await test("stripe: claiming a finished subscription checkout gives a signed token, Plus on, and a restore code", async () => {
  const e = stripeEnv(); stripe.subChecks = 0;
  const c = await (await handle(req("/stripe/checkout", { sku: "dewclaw_plus_monthly", back: "/plus" }), e, deps)).json();
  const id = c.url.split("/").pop();
  const r = await handle(req("/stripe/claim", { session: id }), e, deps); const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.kind, "plus"); assert.equal(j.active, true); assert.ok(j.token.startsWith("w1.")); assert.match(j.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.ok(j.until > clock && j.until <= clock + 7 * 86400e3 + 1000);
  webToken = j.token; webCode = j.code;
  /* claiming again returns the same thing and never re-signs */
  const again = await (await handle(req("/stripe/claim", { session: id }), e, deps)).json();
  assert.equal(again.token, webToken); assert.equal(again.already, true);
  /* the token verifies and unlocks DewclawMD like a Play token */
  const v = await (await handle(req("/verify", { sku: "dewclaw_plus_monthly", token: webToken }), e, deps)).json();
  assert.equal(v.active, true); assert.equal(v.web, true);
  const a = await handle(req("/ask", { sku: "dewclaw_plus_monthly", token: webToken, question: "Is chocolate bad?" }), e, deps);
  assert.equal(a.status, 200);
  /* the code restores the same token on another phone */
  const rs = await (await handle(req("/stripe/restore", { code: webCode.toLowerCase().replace("-", " ") }), e, deps)).json();
  assert.equal(rs.token, webToken); assert.equal(rs.active, true);
  const nope = await handle(req("/stripe/restore", { code: "ZZZZ-ZZZZ" }), e, deps); assert.equal(nope.status, 404);
});
await test("stripe: a forged or tampered token is refused", async () => {
  const e = stripeEnv();
  const forged = webToken.slice(0, -2) + "xx";
  const r = await handle(req("/verify", { sku: "dewclaw_plus_monthly", token: forged }), e, deps); assert.equal(r.status, 402);
  const other = { ...e, TOKEN_SECRET: "another-secret" };
  const r2 = await handle(req("/verify", { sku: "dewclaw_plus_monthly", token: webToken }), other, deps); assert.equal(r2.status, 402);
});
await test("stripe: a cancelled subscription turns Plus off at the next check", async () => {
  const e = stripeEnv();
  stripe.subStatus = "canceled";
  const v = await (await handle(req("/verify", { sku: "dewclaw_plus_monthly", token: webToken }), e, deps)).json();
  assert.equal(v.active, false);
  const a = await handle(req("/ask", { sku: "dewclaw_plus_monthly", token: webToken, question: "Hi?" }), e, deps); assert.equal(a.status, 402);
  stripe.subStatus = "trialing";
});
await test("stripe: an unfinished or unknown checkout grants nothing", async () => {
  const e = stripeEnv();
  const c = await (await handle(req("/stripe/checkout", { sku: "dewclaw_plus_yearly", back: "/plus" }), e, deps)).json();
  const id = c.url.split("/").pop(); stripe.override = { status: "open", payment_status: "unpaid" };
  const r = await handle(req("/stripe/claim", { session: id }), e, deps); assert.equal(r.status, 402);
  stripe.override = {};
  const r2 = await handle(req("/stripe/claim", { session: "cs_test_nope123" }), e, deps); assert.equal(r2.status, 402);
  const r3 = await handle(req("/stripe/claim", { session: "../x" }), e, deps); assert.equal(r3.status, 400);
});
await test("stripe: lifetime is Plus forever; a gift year starts when the code is first used", async () => {
  const e = stripeEnv();
  let c = await (await handle(req("/stripe/checkout", { sku: "dewclaw_plus_lifetime", back: "/plus" }), e, deps)).json();
  let j = await (await handle(req("/stripe/claim", { session: c.url.split("/").pop() }), e, deps)).json();
  assert.equal(j.kind, "plus"); assert.equal(j.active, true); assert.ok(j.until > clock + 100 * 365 * 86400e3);
  const v = await (await handle(req("/verify", { sku: "dewclaw_plus_lifetime", token: j.token }), e, deps)).json(); assert.equal(v.active, true);
  c = await (await handle(req("/stripe/checkout", { sku: "dewclaw_plus_gift_year", back: "/plus" }), e, deps)).json();
  j = await (await handle(req("/stripe/claim", { session: c.url.split("/").pop() }), e, deps)).json();
  assert.equal(j.kind, "gift"); assert.equal(j.token, undefined); assert.ok(j.code);
  clock += 30 * 86400e3;   /* the buyer gives the code a month later */
  const rs = await (await handle(req("/stripe/restore", { code: j.code }), e, deps)).json();
  assert.equal(rs.active, true); assert.ok(Math.abs(rs.until - (clock + 365 * 86400e3)) < 1000);
  clock -= 30 * 86400e3;
});
await test("stripe: a bone pack bought on the web is granted once", async () => {
  const e = stripeEnv();
  const c = await (await handle(req("/stripe/checkout", { sku: "pp_bones_500", back: "/pocket" }), e, deps)).json();
  const id = c.url.split("/").pop();
  const j = await (await handle(req("/stripe/claim", { session: id }), e, deps)).json();
  assert.equal(j.kind, "grant"); assert.equal(j.grant.bones, 500); assert.equal(j.consumable, true); assert.equal(j.already, false);
  const k = await (await handle(req("/stripe/claim", { session: id }), e, deps)).json(); assert.equal(k.already, true);
});
await test("stripe: KC's pack grants bones plus four items, once", async () => {
  const e = stripeEnv();
  const c = await (await handle(req("/stripe/checkout", { sku: "pp_kc_pack", back: "/pocket" }), e, deps)).json();
  assert.equal(stripe.lastForm.mode, "payment");
  const j = await (await handle(req("/stripe/claim", { session: c.url.split("/").pop() }), e, deps)).json();
  assert.equal(j.kind, "grant"); assert.equal(j.grant.bones, 800); assert.equal(j.consumable, false);
  assert.deepEqual(j.grant.items, ["hat:bandana", "shell:cedar", "scene:mountain", "food:jerky"]);
});
await test("stripe: boosts and revives are consumable grants with no bones", async () => {
  const e = stripeEnv();
  for (const [sku, item] of [["pp_boost7", "boost:7"], ["pp_revive", "revive:1"]]) {
    const c = await (await handle(req("/stripe/checkout", { sku, back: "/pocket" }), e, deps)).json();
    const j = await (await handle(req("/stripe/claim", { session: c.url.split("/").pop() }), e, deps)).json();
    assert.equal(j.kind, "grant"); assert.equal(j.consumable, true); assert.deepEqual(j.grant.items, [item]); assert.ok(!j.grant.bones);
  }
});
await test("stripe: a product with no price configured is refused", async () => {
  const r = await handle(req("/stripe/checkout", { sku: "pp_palettes", back: "/pocket" }), stripeEnv(), deps);
  assert.ok(r.status >= 400 && r.status < 500, String(r.status));
});
await test("stripe: the customer portal opens for a web subscription only", async () => {
  const e = stripeEnv();
  const r = await handle(req("/stripe/portal", { token: webToken }), e, deps); const j = await r.json();
  assert.equal(r.status, 200); assert.match(j.url, /billing\.stripe\.com/); assert.equal(stripe.lastForm.customer, "cus_1");
  const bad = await handle(req("/stripe/portal", { token: TOKEN }), e, deps); assert.equal(bad.status, 400);
});
await test("stripe: the price list comes from Stripe and is cached", async () => {
  const e = stripeEnv(); stripe.calls = 0;
  const j = await (await handle(req("/stripe/prices", null, "GET"), e, deps)).json();
  assert.equal(j.on, true); const m = j.prices.find(p => p.sku === "dewclaw_plus_monthly");
  assert.deepEqual(m, { sku: "dewclaw_plus_monthly", amount: 2.99, currency: "USD", interval: "month", trialDays: 7 });
  assert.ok(j.prices.find(p => p.sku === "pp_bones_500").interval === null);
  assert.equal(j.prices.find(p => p.sku === "dewclaw_plus_gift_year"), undefined, "an unknown price id is left out, not invented");
  const n = stripe.calls; await handle(req("/stripe/prices", null, "GET"), e, deps); assert.equal(stripe.calls, n);
  const off = await (await handle(req("/stripe/prices", null, "GET"), env(), deps)).json(); assert.equal(off.on, false);
});
await test("health says whether Stripe is on", async () => {
  assert.equal((await (await handle(req("/health", null, "GET"), stripeEnv(), deps)).json()).stripe, true);
  assert.equal((await (await handle(req("/health", null, "GET"), env(), deps)).json()).stripe, false);
});


/* ---- Stripe Tax */
await test("tax: off by default; one-time purchases still create a customer record", async () => {
  await handle(req("/stripe/checkout", { sku: "dewclaw_plus_monthly", back: "/plus" }), stripeEnv(), deps);
  assert.equal(stripe.lastForm["automatic_tax[enabled]"], undefined); assert.equal(stripe.lastForm["managed_payments[enabled]"], undefined);
  assert.equal(stripe.lastForm.customer_creation, undefined, "subscriptions always make a customer; the parameter isn't allowed there");
  await handle(req("/stripe/checkout", { sku: "dewclaw_plus_lifetime", back: "/plus" }), stripeEnv(), deps);
  assert.equal(stripe.lastForm.customer_creation, "always");
  assert.equal((await (await handle(req("/health", null, "GET"), stripeEnv(), deps)).json()).tax, "off");
});
await test("tax: STRIPE_TAX=auto turns on Stripe Tax and address collection", async () => {
  const e = { ...stripeEnv(), STRIPE_TAX: "auto" };
  await handle(req("/stripe/checkout", { sku: "dewclaw_plus_monthly", back: "/plus" }), e, deps);
  assert.equal(stripe.lastForm["automatic_tax[enabled]"], "true"); assert.equal(stripe.lastForm.billing_address_collection, "auto");
  assert.equal(stripe.lastForm["subscription_data[trial_period_days]"], "7", "the trial still applies");
  await handle(req("/stripe/checkout", { sku: "pp_bones_500", back: "/pocket" }), e, deps);
  assert.equal(stripe.lastForm["automatic_tax[enabled]"], "true"); assert.equal(stripe.lastForm.customer_creation, "always");
  assert.equal((await (await handle(req("/health", null, "GET"), e, deps)).json()).tax, "auto");
});
await test("tax: STRIPE_TAX=managed uses Managed Payments and sends no automatic_tax", async () => {
  const e = { ...stripeEnv(), STRIPE_TAX: "managed" };
  await handle(req("/stripe/checkout", { sku: "dewclaw_plus_yearly", back: "/plus" }), e, deps);
  assert.equal(stripe.lastForm["managed_payments[enabled]"], "true");
  assert.equal(stripe.lastForm["automatic_tax[enabled]"], undefined); assert.equal(stripe.lastForm.billing_address_collection, undefined);
  /* buying and claiming still work end to end */
  const c = await (await handle(req("/stripe/checkout", { sku: "dewclaw_plus_monthly", back: "/plus" }), e, deps)).json();
  const j = await (await handle(req("/stripe/claim", { session: c.url.split("/").pop() }), e, deps)).json();
  assert.equal(j.kind, "plus"); assert.equal(j.active, true);
});

await test("paypal: checkout makes an order at this server's price and sends the buyer to PayPal", async () => {
  const e = ppEnv();
  const r = await handle(req("/paypal/checkout", { sku: "pp_kc_pack", back: "/pocket" }), e, deps); const j = await r.json();
  assert.equal(r.status, 200); assert.match(j.url, /sandbox\.paypal\.com\/checkoutnow\?token=/);
  const pu = paypalFake.lastOrder.purchase_units[0];
  assert.equal(pu.amount.value, "3.99"); assert.equal(pu.amount.currency_code, "USD"); assert.equal(pu.custom_id, "pp_kc_pack");
  assert.equal(paypalFake.lastOrder.intent, "CAPTURE");
  assert.equal(paypalFake.lastOrder.payment_source.paypal.experience_context.return_url, "https://dewclaw-app.netlify.app/?pp=1#/pocket");
  assert.equal(paypalFake.lastBase, "sandbox"); assert.equal(paypalFake.lastBasic, "Basic " + btoa("cid:sec"));
  assert.ok(paypalFake.lastRequestId.startsWith("dc-"));
});
await test("paypal: subscriptions, unknown products and a server without PayPal are refused", async () => {
  assert.equal((await handle(req("/paypal/checkout", { sku: "dewclaw_plus_monthly" }), ppEnv(), deps)).status, 400);
  assert.equal((await handle(req("/paypal/checkout", { sku: "pp_free_money" }), ppEnv(), deps)).status, 400);
  assert.equal((await handle(req("/paypal/checkout", { sku: "pp_bones_500" }), stripeEnv(), deps)).status, 503);
});
await test("paypal: an approved order is captured and granted once", async () => {
  const e = ppEnv();
  const { url } = await (await handle(req("/paypal/checkout", { sku: "pp_bones_500", back: "/pocket" }), e, deps)).json();
  const id = url.split("token=")[1]; approve(id);
  const n = paypalFake.captures;
  const j = await (await handle(req("/paypal/claim", { order: id }), e, deps)).json();
  assert.equal(j.kind, "grant"); assert.equal(j.grant.bones, 500); assert.equal(j.already, false); assert.equal(j.via, "paypal");
  assert.equal(paypalFake.captures, n + 1);
  const k = await (await handle(req("/paypal/claim", { order: id }), e, deps)).json();
  assert.equal(k.already, true); assert.equal(paypalFake.captures, n + 1, "no second capture");
});
await test("paypal: an order the buyer never approved grants nothing and isn't captured", async () => {
  const e = ppEnv();
  const { url } = await (await handle(req("/paypal/checkout", { sku: "pp_bones_500" }), e, deps)).json();
  const id = url.split("token=")[1]; const n = paypalFake.captures;
  const r = await handle(req("/paypal/claim", { order: id }), e, deps);
  assert.equal(r.status, 402); assert.equal(paypalFake.captures, n);
  assert.equal((await handle(req("/paypal/claim", { order: "NOSUCHORDER1" }), e, deps)).status, 402);
  assert.equal((await handle(req("/paypal/claim", { order: "bad id!" }), e, deps)).status, 400);
});
await test("paypal: a declined card, a pending capture and a short payment are refused", async () => {
  const e = ppEnv();
  let id = (await (await handle(req("/paypal/checkout", { sku: "pp_bones_500" }), e, deps)).json()).url.split("token=")[1];
  approve(id); paypalFake.orders[id].decline = true;
  let r = await handle(req("/paypal/claim", { order: id }), e, deps); assert.equal(r.status, 402); assert.match((await r.json()).error, /declined/);
  id = (await (await handle(req("/paypal/checkout", { sku: "pp_bones_500" }), e, deps)).json()).url.split("token=")[1];
  approve(id); paypalFake.orders[id].capStatus = "PENDING";
  r = await handle(req("/paypal/claim", { order: id }), e, deps); assert.equal(r.status, 402); assert.match((await r.json()).error, /processing/);
  id = (await (await handle(req("/paypal/checkout", { sku: "pp_bones_8000" }), e, deps)).json()).url.split("token=")[1];
  approve(id); paypalFake.orders[id].paidValue = "0.99";
  r = await handle(req("/paypal/claim", { order: id }), e, deps); assert.equal(r.status, 402); assert.match((await r.json()).error, /match/);
});
await test("paypal: an order already captured (a retry after a timeout) still grants", async () => {
  const e = ppEnv();
  const id = (await (await handle(req("/paypal/checkout", { sku: "pp_revive" }), e, deps)).json()).url.split("token=")[1];
  paypalFake.orders[id].status = "COMPLETED";
  const j = await (await handle(req("/paypal/claim", { order: id }), e, deps)).json();
  assert.equal(j.kind, "grant"); assert.deepEqual(j.grant.items, ["revive:1"]);
});
await test("paypal: lifetime Plus bought with PayPal gives a working token and a restore code", async () => {
  const e = ppEnv();
  const id = (await (await handle(req("/paypal/checkout", { sku: "dewclaw_plus_lifetime", back: "/plus" }), e, deps)).json()).url.split("token=")[1];
  assert.equal(paypalFake.lastOrder.purchase_units[0].amount.value, "29.99");
  approve(id);
  const j = await (await handle(req("/paypal/claim", { order: id }), e, deps)).json();
  assert.equal(j.kind, "plus"); assert.equal(j.active, true); assert.match(j.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const v = await (await handle(req("/verify", { sku: j.sku, token: j.token }), e, deps)).json(); assert.equal(v.active, true);
  const rs = await (await handle(req("/stripe/restore", { code: j.code }), e, deps)).json(); assert.equal(rs.active, true);
});
await test("paypal: PAYPAL_ENV=live talks to the live API; health and the price list report PayPal", async () => {
  const e = ppEnv({ PAYPAL_ENV: "live" });
  await handle(req("/paypal/checkout", { sku: "pp_bones_500" }), e, deps); assert.equal(paypalFake.lastBase, "live");
  const h = await (await handle(req("/health", null, "GET"), e, deps)).json(); assert.equal(h.paypal, "live");
  const h2 = await (await handle(req("/health", null, "GET"), stripeEnv(), deps)).json(); assert.equal(h2.paypal, false);
  const p = await (await handle(req("/stripe/prices", null, "GET"), e, deps)).json();
  assert.ok(p.paypal.includes("pp_bones_500") && p.paypal.includes("dewclaw_plus_lifetime")); assert.ok(!p.paypal.includes("dewclaw_plus_monthly"));
});
await test("paypal: bad credentials give a clear error", async () => {
  paypalFake.badCreds = true;
  const r = await handle(req("/paypal/checkout", { sku: "pp_bones_500" }), ppEnv({ PAYPAL_CLIENT_ID: "other" }), deps);
  paypalFake.badCreds = false;
  assert.equal(r.status, 502); assert.match((await r.json()).error, /credentials/);
});

/* ---- Workers AI (no Anthropic key) */
const aiFake = { calls: [], fail: {}, reply: null };
const AI = { async run(model, input) {
  aiFake.calls.push({ model, input });
  if (aiFake.fail[model]) throw new Error(aiFake.fail[model]);
  return aiFake.reply ? aiFake.reply(model) : { choices: [{ message: { content: "<think>checking</think>[urgency: today]\nCall your vet today. Chocolate is toxic to dogs." } }] };
} };
const aiEnv = (x = {}) => { const e = env(); delete e.ANTHROPIC_API_KEY; return { ...e, AI, ...x }; };
const askBody = { token: "gp-token-ai-123456", sku: "dewclaw_plus_monthly", question: "My dog ate chocolate", pet: "Dog, Labrador" };
await test("workers ai: answers with Gemma when there is no Anthropic key, reasoning stripped", async () => {
  aiFake.calls = []; aiFake.fail = {}; aiFake.reply = null; const c0 = claude.calls;
  const e = aiEnv();
  const r = await handle(req("/ask", askBody), e, deps); const j = await r.json();
  assert.equal(r.status, 200, JSON.stringify(j));
  assert.match(j.text, /^\[urgency: today\]/); assert.ok(!/think/.test(j.text));
  assert.equal(aiFake.calls[0].model, "@cf/google/gemma-4-26b-a4b-it");
  assert.match(aiFake.calls[0].input.messages[0].content, /DewclawMD/);
  assert.match(aiFake.calls[0].input.messages[1].content, /Pet profile:\nDog, Labrador/);
  assert.equal(claude.calls, c0);
});
await test("workers ai: falls back to the small model, and a plain 'response' shape works", async () => {
  aiFake.calls = []; aiFake.fail = { "@cf/google/gemma-4-26b-a4b-it": "boom" };
  aiFake.reply = () => ({ response: "[urgency: info]\nDogs sleep a lot." });
  const j = await (await handle(req("/ask", { ...askBody, token: "gp-token-ai-223456" }), aiEnv(), deps)).json();
  assert.equal(aiFake.calls.length, 2); assert.equal(aiFake.calls[1].model, "@cf/meta/llama-3.2-3b-instruct");
  assert.match(j.text, /^\[urgency: info\]/);
});
await test("workers ai: both models failing refunds the allowance and says so plainly", async () => {
  aiFake.calls = []; aiFake.reply = null;
  aiFake.fail = { "@cf/google/gemma-4-26b-a4b-it": "4006: you have used up your daily free allocation of 10,000 neurons", "@cf/meta/llama-3.2-3b-instruct": "4006: daily free allocation" };
  const e = aiEnv();
  const r = await handle(req("/ask", { ...askBody, token: "gp-token-ai-323456" }), e, deps);
  assert.equal(r.status, 503); assert.match((await r.json()).error, /free answers/);
  const used = [...e.DEWCLAW.m.entries()].filter(([k]) => k.startsWith("quota:")).map(([, v]) => v);
  assert.ok(used.every(v => v === "0"), JSON.stringify(used));
  aiFake.fail = {};
});
await test("workers ai: health reports the free model; no AI at all is a clear 503", async () => {
  const h = await (await handle(req("/health", null, "GET"), aiEnv(), deps)).json();
  assert.equal(h.ai, "workers-ai"); assert.equal(h.model, "@cf/google/gemma-4-26b-a4b-it");
  const e = env(); delete e.ANTHROPIC_API_KEY;
  const r = await handle(req("/ask", { ...askBody, token: "gp-token-ai-423456" }), e, deps);
  assert.equal(r.status, 503); assert.match((await r.json()).error, /isn't connected/);
});
await test("workers ai: the daily cap is lower than Claude's so the free allowance holds", async () => {
  aiFake.fail = {}; aiFake.reply = null;
  const e = aiEnv({ DAILY_ASKS_TOTAL: "400", AI_DAILY_ASKS: "1", MONTHLY_ASKS: "40" });
  assert.equal((await handle(req("/ask", { ...askBody, token: "gp-token-ai-523456" }), e, deps)).status, 200);
  const r = await handle(req("/ask", { ...askBody, token: "gp-token-ai-623456" }), e, deps);
  assert.equal(r.status, 429);
});

/* ------------------------------------------------------------------ KC: Open Trail store */
await test("open trail: every one of the 16 SKUs can be checked out and grants exactly what the catalogue says, with no bones", async () => {
  assert.equal(OT_SKUS.length, 16);
  for (const sku of OT_SKUS) {
    const e = otEnv(), want = OT[sku];
    const { r, j, id } = await otBuy(e, sku);
    assert.equal(r.status, 200, sku + " checkout: " + JSON.stringify(j)); assert.match(j.url, /^https:\/\/checkout\.stripe\.com\//);
    assert.equal(stripe.lastForm.mode, "payment"); assert.equal(stripe.lastForm["line_items[0][price]"], "price_" + sku); assert.equal(stripe.lastForm["line_items[0][quantity]"], "1");
    assert.equal(stripe.lastForm.success_url, GAME + "/games/kc-open-trail/?cs={CHECKOUT_SESSION_ID}"); assert.equal(stripe.lastForm.cancel_url, GAME + "/games/kc-open-trail/?cancelled=1");
    assert.equal(stripe.lastForm["metadata[sku]"], sku); assert.equal(stripe.lastForm["metadata[game]"], "kc-open-trail");
    assert.ok(stripe.lastForm["metadata[install]"] && stripe.lastForm["metadata[install]"] !== INSTALL && !JSON.stringify(stripe.lastForm).includes(INSTALL), "only a hash of the install id goes to Stripe");
    assert.equal(stripe.lastForm.allow_promotion_codes, undefined, "no promotion codes on game items");
    const c = await otClaimReq(e, id);
    assert.equal(c.r.status, 200, sku + " claim: " + JSON.stringify(c.j));
    assert.equal(c.j.kind, "grant"); assert.equal(c.j.sku, sku); assert.equal(c.j.already, false);
    assert.deepEqual(c.j.grant, { bones: 0, gems: want.gems, items: want.items, flags: want.flags }, sku + " grant");
    assert.equal(c.j.grant.bones, 0); assert.equal(c.j.amount, want.cents); assert.equal(c.j.currency, "USD");
    assert.equal(c.j.consumable, !want.permanent); assert.equal(c.j.install, undefined, "the install hash is not sent back");
    if (want.permanent) assert.match(c.j.key, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/, sku + " gives a Trail Key"); else assert.equal(c.j.key, undefined, sku + " gives no Trail Key");
    assert.equal(c.r.headers.get("access-control-allow-origin"), GAME);
  }
});
await test("open trail: the game's own copy of the catalogue (js/store.js) matches the worker for every SKU and price", async () => {
  const { CATALOG } = await import("../site/games/kc-open-trail/js/store.js");
  assert.deepEqual(CATALOG.map(c => c.sku).sort(), [...OT_SKUS].sort());
  for (const c of CATALOG) {
    const e = otEnv(), { id } = await otBuy(e, c.sku), { j } = await otClaimReq(e, id);
    assert.deepEqual(j.grant, c.grant, c.sku + ": game and worker grant the same"); assert.equal(j.amount, c.cents, c.sku + ": same price");
    assert.equal(j.consumable, c.type === "consumable"); assert.equal(!!j.once, c.type === "once");
  }
});
await test("open trail: replaying a claim never grants twice", async () => {
  for (const sku of ["ot_gems_7000", "ot_treat_10", "ot_pack_forest", "ot_everything"]) {
    const e = otEnv(), { id } = await otBuy(e, sku);
    const first = (await otClaimReq(e, id)).j; assert.equal(first.already, false);
    const callsBefore = stripe.calls, kvBefore = e.DEWCLAW.m.size;
    for (let i = 0; i < 3; i++) { const again = await otClaimReq(e, id); assert.equal(again.r.status, 200); assert.equal(again.j.already, true, sku + ": a repeat says already"); assert.deepEqual(again.j.grant, first.grant); assert.equal(again.j.key, first.key); }
    assert.equal(stripe.calls, callsBefore, "a repeat doesn't go back to Stripe"); assert.equal(e.DEWCLAW.m.size, kvBefore, "a repeat writes nothing");
    assert.equal(claimKeys(e).length, 1, "one claim record per checkout");
    /* two claims racing in: one record, and at most one answer without `already` once the first has landed */
    const e2 = otEnv(), b = await otBuy(e2, sku); await otClaimReq(e2, b.id);
    const [x, y] = await Promise.all([otClaimReq(e2, b.id), otClaimReq(e2, b.id)]); assert.equal(x.j.already, true); assert.equal(y.j.already, true);
  }
});
await test("open trail: an unknown SKU is refused at checkout and at claim", async () => {
  const e = otEnv();
  for (const sku of ["ot_gems_99999", "ot_bones_500", "ot_", "__proto__", "constructor", "toString", "", null, 7, { sku: "ot_gems_80" }]) {
    const before = stripe.n, r = await handle(greq("/stripe/checkout", { sku, install: INSTALL }), e, deps);
    assert.equal(r.status, 400, "checkout " + JSON.stringify(sku)); assert.equal(stripe.n, before, "no Stripe session was made");
  }
  /* a paid session whose metadata names a SKU the worker doesn't know (someone else's product, or a made-up one) grants nothing */
  for (const sku of ["ot_gems_99999", "ot_bones_500", "__proto__", "hasOwnProperty"]) {
    const { id } = await otBuy(e, "ot_gems_80"); stripe.sessions[id].metadata.sku = sku;
    const c = await otClaimReq(e, id); assert.equal(c.r.status, 400, "claim " + sku); assert.equal(c.j.grant, undefined);
  }
  assert.equal(claimKeys(e).length, 0, "nothing was recorded");
});
await test("open trail: a Stripe price of the wrong amount, currency or kind is never sold", async () => {
  for (const bad of [{ unit_amount: 99, currency: "usd" }, { unit_amount: 4999, currency: "eur" }, { unit_amount: 4999, currency: "usd", recurring: { interval: "month" } }, { unit_amount: 4999, currency: "usd", active: false }, { unit_amount: 0, currency: "usd" }]) {
    const e = otEnv(); stripe.otPrices = { price_ot_gems_7000: bad };
    const before = stripe.n, { r } = await otBuy(e, "ot_gems_7000");
    assert.equal(r.status, 503, JSON.stringify(bad)); assert.equal(stripe.n, before, "no checkout was started");
    stripe.otPrices = {};
  }
  /* a SKU with no price id at all is simply not on sale */
  const e = otEnv({ STRIPE_PRICES: JSON.stringify({ ot_gems_80: "price_ot_gems_80" }) });
  assert.equal((await otBuy(e, "ot_gems_500")).r.status, 400); assert.equal((await otBuy(e, "ot_gems_80")).r.status, 200);
});
await test("open trail: a payment whose amount, currency or SKU was tampered with grants nothing", async () => {
  /* paid 99 cents, but the session now claims to be the 7,000-gem pack */
  let e = otEnv(), b = await otBuy(e, "ot_gems_80"); stripe.sessions[b.id].metadata.sku = "ot_gems_7000";
  let c = await otClaimReq(e, b.id); assert.equal(c.r.status, 409); assert.equal(c.j.grant, undefined); assert.equal(claimKeys(e).length, 0);
  /* the right SKU with the wrong amount (a 100% promotion code, an edited price, a different quantity) */
  for (const over of [{ amount_subtotal: 1 }, { amount_subtotal: 0 }, { amount_subtotal: 9998 }, { amount_subtotal: 4998 }, { amount_subtotal: "4999abc" }, { amount_subtotal: null }, { currency: "eur" }, { currency: "jpy" }]) {
    e = otEnv(); b = await otBuy(e, "ot_gems_7000"); stripe.override = over;
    c = await otClaimReq(e, b.id); assert.equal(c.r.status, 409, JSON.stringify(over)); assert.equal(c.j.grant, undefined); assert.equal(claimKeys(e).length, 0);
    stripe.override = {};
    /* the same session with the real figures still grants, once: a refused attempt burns nothing */
    c = await otClaimReq(e, b.id); assert.equal(c.r.status, 200); assert.equal(c.j.grant.gems, 7000);
  }
  /* a subscription-mode or unpaid session is not a game purchase */
  e = otEnv(); b = await otBuy(e, "ot_supporter");
  stripe.override = { mode: "subscription" }; assert.equal((await otClaimReq(e, b.id)).r.status, 400);
  stripe.override = { payment_status: "unpaid" }; assert.equal((await otClaimReq(e, b.id)).r.status, 402);
  stripe.override = { payment_status: "no_payment_required" }; assert.equal((await otClaimReq(e, b.id)).r.status, 402);
  stripe.override = { status: "open" }; assert.equal((await otClaimReq(e, b.id)).r.status, 402);
  stripe.override = { status: "expired" }; assert.equal((await otClaimReq(e, b.id)).r.status, 402);
  stripe.override = {}; assert.equal(claimKeys(e).length, 0);
  /* whatever the game sends besides the session and its install id is ignored: the worker's table decides */
  e = otEnv(); b = await otBuy(e, "ot_gems_80");
  c = await otClaimReq(e, b.id, INSTALL, { sku: "ot_gems_7000", gems: 99999, bones: 5000, amount: 4999, grant: { gems: 99999, bones: 5000 }, items: ["up:forever"] });
  assert.equal(c.r.status, 200); assert.deepEqual(c.j.grant, { bones: 0, gems: 80, items: [], flags: {} }); assert.equal(c.j.sku, "ot_gems_80");
  /* and extra fields at checkout cannot change the price that is charged */
  const r = await handle(greq("/stripe/checkout", { sku: "ot_gems_7000", install: INSTALL, price: "price_ot_gems_80", amount: 1, quantity: 100 }), otEnv(), deps);
  assert.equal(r.status, 200); assert.equal(stripe.lastForm["line_items[0][price]"], "price_ot_gems_7000"); assert.equal(stripe.lastForm["line_items[0][quantity]"], "1");
});
await test("open trail: a session id that is made up, malformed or unknown to Stripe grants nothing", async () => {
  const e = otEnv();
  for (const session of ["cs_mock_abcdefgh", "cs_test_doesnotexist"]) assert.equal((await otClaimReq(e, session)).r.status, 402, session);
  for (const session of ["", "../x", "cs_", "price_ot_gems_80", null, 12, "cs_test_1; drop"]) assert.equal((await otClaimReq(e, session)).r.status, 400, String(session));
  assert.equal(claimKeys(e).length, 0);
});
await test("open trail: a purchase belongs to the device that started it; a copied return link grants nothing elsewhere", async () => {
  const e = otEnv();
  for (const bad of [undefined, "", "short", "has spaces in it!!!!", 12345678901234567890, "x".repeat(65)]) assert.equal((await handle(greq("/stripe/checkout", { sku: "ot_pack_galaxy", install: bad }), e, deps)).status, 400, "checkout needs an install id: " + bad);
  const { id } = await otBuy(e, "ot_pack_galaxy", INSTALL);
  /* before the real device has claimed */
  for (const who of [INSTALL2, null, ""]) { const c = await otClaimReq(e, id, who); assert.equal(c.r.status, 403); assert.equal(c.j.grant, undefined); }
  assert.equal(claimKeys(e).length, 0);
  const mine = await otClaimReq(e, id, INSTALL); assert.equal(mine.r.status, 200); assert.equal(mine.j.already, false);
  /* and after */
  for (const who of [INSTALL2, null]) { const c = await otClaimReq(e, id, who); assert.equal(c.r.status, 403); assert.equal(c.j.grant, undefined); assert.equal(c.j.key, undefined, "the Trail Key isn't leaked either"); }
  assert.equal((await otClaimReq(e, id, INSTALL)).j.already, true);
});
await test("open trail: the Trail Key restores permanent items on another device, never gems, treats or tips", async () => {
  const e = otEnv();
  const a = (await otClaimReq(e, (await otBuy(e, "ot_supporter")).id)).j; assert.match(a.key, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  /* consumables in between change nothing */
  for (const sku of ["ot_gems_500", "ot_treat_3", "ot_tip_3"]) assert.equal((await otClaimReq(e, (await otBuy(e, sku)).id, INSTALL, { key: a.key })).j.key, undefined);
  /* a later permanent purchase that sends the key is added to the same key; one that doesn't gets a new key */
  const b = (await otClaimReq(e, (await otBuy(e, "ot_pack_forest")).id, INSTALL, { key: a.key })).j; assert.equal(b.key, a.key);
  const s = (await otClaimReq(e, (await otBuy(e, "ot_starter")).id, INSTALL, { key: a.key.toLowerCase().replace("-", " ") })).j; assert.equal(s.key, a.key); assert.equal(s.once, true);
  const other = (await otClaimReq(e, (await otBuy(e, "ot_pack_galaxy")).id, INSTALL)).j; assert.notEqual(other.key, a.key);
  const r = await handle(greq("/ot/restore", { key: a.key.toLowerCase() }), e, deps), j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.kind, "restore"); assert.equal(j.key, a.key); assert.deepEqual(j.skus, ["ot_supporter", "ot_pack_forest", "ot_starter"]);
  assert.deepEqual(j.grants.map(g => g.sku), j.skus);
  for (const g of j.grants) { assert.equal(g.grant.gems, 0, g.sku + ": gems are not restored"); assert.equal(g.grant.bones, 0); assert.deepEqual(g.grant.items, OT[g.sku].items); assert.deepEqual(g.grant.flags, OT[g.sku].flags); }
  /* restoring twice is the same answer: items are owned or not, so there is nothing to double */
  assert.deepEqual(await (await handle(greq("/ot/restore", { key: a.key }), e, deps)).json(), j);
  assert.equal((await handle(greq("/ot/restore", { key: "ZZZZ-ZZZZ" }), e, deps)).status, 404);
  assert.equal((await handle(greq("/ot/restore", { key: "nope" }), e, deps)).status, 400);
  assert.equal((await handle(greq("/ot/restore", {}), e, deps)).status, 400);
  /* a Dewclaw Plus restore code is not a Trail Key, and a Trail Key is not a Plus code */
  assert.equal((await handle(req("/stripe/restore", { code: a.key }), e, deps)).status, 404);
});
await test("open trail: guessing Trail Keys is limited per address per day", async () => {
  const e = otEnv(); let last = 0;
  for (let i = 0; i < 21; i++) last = (await handle(req("/ot/restore", { key: "AAAA-AAA" + "23456789ABCDEFGHJKLMN"[i] }, "POST", { origin: GAME, "cf-connecting-ip": "203.0.113.9" }), e, deps)).status;
  assert.equal(last, 429);
  assert.equal((await handle(req("/ot/restore", { key: "AAAA-AAA2" }, "POST", { origin: GAME, "cf-connecting-ip": "203.0.113.10" }), e, deps)).status, 404, "another address is not blocked");
  assert.ok(![...e.DEWCLAW.m.keys()].some(k => k.includes("203.0.113")), "the address itself is not stored");
});
await test("open trail: claiming one paid session several times at once grants once and makes one Trail Key", async () => {
  const e = otEnv(); const { id } = await otBuy(e, "ot_supporter");
  const all = await Promise.all([1, 2, 3, 4, 5].map(() => otClaimReq(e, id)));
  assert.deepEqual(all.map(c => c.r.status), [200, 200, 200, 200, 200]);
  assert.equal(all.filter(c => c.j.already === false).length, 1, "exactly one first claim");
  assert.equal(new Set(all.map(c => c.j.key)).size, 1, "one key");
  assert.equal([...e.DEWCLAW.m.keys()].filter(k => k.startsWith("otkey:")).length, 1, "one Trail Key record");
  const g = await otBuy(e, "ot_gems_7000"), gems = await Promise.all([1, 2, 3].map(() => otClaimReq(e, g.id)));
  assert.equal(gems.filter(c => c.j.already === false).length, 1);
});
await test("open trail: parallel Trail Key guesses are counted one by one", async () => {
  const e = otEnv();
  const st = (await Promise.all(Array.from({ length: 40 }, (_, i) => handle(req("/ot/restore", { key: "BBBB-BB" + "23456789"[i % 8] + "23456789"[(i >> 3) % 8] }, "POST", { origin: GAME, "cf-connecting-ip": "203.0.113.77" }), e, deps)))).map(r => r.status);
  assert.equal(st.filter(s => s === 429).length, 20); assert.equal(st.filter(s => s === 404).length, 20);
});
await test("open trail: checkout pins US dollars and hands back the session id for the game to keep", async () => {
  const e = otEnv(); const { j, id } = await otBuy(e, "ot_pack_forest");
  assert.equal(j.session, id); assert.equal(stripe.lastForm["adaptive_pricing[enabled]"], "false"); assert.equal(stripe.lastForm.allow_promotion_codes, undefined);
});
await test("open trail: /ot/prices tells the owner which SKUs are set up; the Stripe key is never in an answer", async () => {
  const e = otEnv({ STRIPE_PRICES: JSON.stringify({ ...Object.fromEntries(OT_SKUS.map(k => [k, "price_" + k])), ot_tip_3: undefined }) }); stripe.otPrices = { price_ot_gems_500: { unit_amount: 500, currency: "usd" } };
  const r = await handle(greq("/ot/prices", null, "GET"), e, deps), j = await r.json(), text = JSON.stringify(j); stripe.otPrices = {};
  assert.equal(r.status, 200); assert.equal(j.on, true); assert.equal(j.returnUrl, GAME + "/games/kc-open-trail/"); assert.equal(j.skus.length, 16);
  const row = k => j.skus.find(x => x.sku === k);
  assert.deepEqual(row("ot_gems_80"), { sku: "ot_gems_80", expected: 0.99, configured: true, amount: 0.99, ok: true });
  assert.equal(row("ot_gems_500").ok, false); assert.equal(row("ot_gems_500").amount, 5); assert.equal(row("ot_tip_3").configured, false); assert.equal(row("ot_tip_3").ok, false);
  assert.ok(!text.includes("sk_test_123")); assert.ok(!text.includes("price_ot"));
  const off = await (await handle(greq("/ot/prices", null, "GET"), env(), deps)).json(); assert.equal(off.on, false); assert.ok(off.skus.every(x => !x.ok));
});
await test("open trail: the return address must be https, and a server without Stripe sells nothing", async () => {
  assert.equal((await otBuy(otEnv({ OT_RETURN_URL: "http://play.example.test/games/kc-open-trail/" }), "ot_gems_80")).r.status, 503);
  assert.equal((await otBuy(otEnv({ OT_RETURN_URL: "javascript:alert(1)" }), "ot_gems_80")).r.status, 503);
  const dflt = otEnv({ OT_RETURN_URL: "" }); await otBuy(dflt, "ot_gems_80"); assert.equal(stripe.lastForm.success_url, "https://dewclaw-app.netlify.app/games/kc-open-trail/?cs={CHECKOUT_SESSION_ID}");
  assert.equal((await handle(greq("/stripe/checkout", { sku: "ot_gems_80", install: INSTALL }), { ...env(), ALLOWED_ORIGIN: GAME }, deps)).status, 503);
  /* a site that isn't on the list gets no CORS permission */
  const evil = await handle(req("/stripe/checkout", { sku: "ot_gems_80", install: INSTALL }, "POST", { origin: "https://evil.example" }), otEnv(), deps);
  assert.equal(evil.headers.get("access-control-allow-origin"), "null");
});
await test("open trail: adding the game left Dewclaw Plus and Pocket Pup purchases exactly as they were", async () => {
  const e = otEnv();
  let c = await (await handle(req("/stripe/checkout", { sku: "pp_bones_500", back: "/pocket" }), e, deps)).json();
  assert.equal(stripe.lastForm.success_url, "https://dewclaw-app.netlify.app/?cs={CHECKOUT_SESSION_ID}#/pocket"); assert.equal(stripe.lastForm.allow_promotion_codes, "true"); assert.equal(stripe.lastForm["metadata[install]"], undefined);
  let j = await (await handle(req("/stripe/claim", { session: c.url.split("/").pop() }), e, deps)).json();
  assert.deepEqual(j.grant, { bones: 500, items: [] }); assert.equal(j.already, false); assert.equal(j.key, undefined);
  c = await (await handle(req("/stripe/checkout", { sku: "dewclaw_plus_lifetime", back: "/plus" }), e, deps)).json();
  j = await (await handle(req("/stripe/claim", { session: c.url.split("/").pop() }), e, deps)).json();
  assert.equal(j.kind, "plus"); assert.equal(j.active, true); assert.match(j.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  /* a Plus code is not accepted as a Trail Key */
  assert.equal((await handle(greq("/ot/restore", { key: j.code }), e, deps)).status, 404);
});

/* ------------------------------------------------------------------ KC: Open Trail on Google Play (/ot/play-claim) */
/* the pretend Play Developer API for the game's own package. play.purchases[token] = { sku, state, ack, consumed }.
   Like the real purchases.products.get it answers for the token even when the product in the address is a different one,
   and says which product the purchase is really for; play.strict makes it answer 404 for a mismatch instead. */
const OT_PKG = "com.example.opentrail";
const play = { purchases: {}, gets: 0, acks: 0, consumes: 0, failSettle: 0, strict: false, status: 200, noProductId: false };
function otPlayFake(u, init) {
  const m = u.match(/\/androidpublisher\/v3\/applications\/([^/]+)\/purchases\/products\/([^/]+)\/tokens\/([^/:]+)(:acknowledge|:consume)?$/);
  if (!m || !decodeURIComponent(m[1]).startsWith("com.example.")) return null;
  const pkg = decodeURIComponent(m[1]), sku = decodeURIComponent(m[2]), token = decodeURIComponent(m[3]), p = play.purchases[token];
  assert.equal((init.headers || {}).authorization, "Bearer ya29.test", "the Play API is called with the service account's token");
  if (!p || pkg !== OT_PKG || (play.strict && p.sku !== sku)) return new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 });
  if (m[4]) { if (play.failSettle > 0) { play.failSettle--; return new Response("{}", { status: 500 }); } if (m[4] === ":consume") { play.consumes++; p.consumed = 1; } else { play.acks++; p.ack = 1; } return new Response("{}", { status: 200 }); }
  play.gets++; if (play.status !== 200) return new Response("{}", { status: play.status });
  return new Response(JSON.stringify({ kind: "androidpublisher#productPurchase", purchaseState: p.state, consumptionState: p.consumed, acknowledgementState: p.ack, orderId: "GPA.3300-0000-0000-00001", purchaseType: 0, ...(play.noProductId ? {} : { productId: p.sku }), quantity: 1, regionCode: "US" }), { status: 200 });
}
let playN = 0;
const playBuy = (sku, over = {}) => { const token = "play-token-" + (++playN) + "." + "A".repeat(40); play.purchases[token] = { sku, state: 0, ack: 0, consumed: 0, ...over }; return token; };
const playEnv = (extra = {}) => ({ ...env(), ALLOWED_ORIGIN: "https://dewclaw-app.netlify.app," + GAME, OT_PLAY_PACKAGE: OT_PKG, ...extra });
const playClaim = async (e, sku, token, install = INSTALL, extra = {}) => { const r = await handle(greq("/ot/play-claim", { sku, token, install, ...extra }), e, deps); return { r, j: await r.json() }; };
const playKeys = e => [...e.DEWCLAW.m.keys()].filter(k => k.startsWith("otplay:"));

await test("open trail play: a valid token for each of the 16 SKUs grants exactly the catalogue contents, then is consumed or acknowledged", async () => {
  for (const sku of OT_SKUS) {
    const e = playEnv(), want = OT[sku], token = playBuy(sku), before = { a: play.acks, c: play.consumes };
    const { r, j } = await playClaim(e, sku, token);
    assert.equal(r.status, 200, sku + ": " + JSON.stringify(j));
    assert.equal(j.kind, "grant"); assert.equal(j.sku, sku); assert.equal(j.already, false); assert.equal(j.channel, "play"); assert.equal(j.settled, true);
    assert.deepEqual(j.grant, { bones: 0, gems: want.gems, items: want.items, flags: want.flags }, sku + " grant");
    assert.equal(j.consumable, !want.permanent); assert.equal(j.install, undefined); assert.equal(j.order, undefined);
    if (want.permanent) { assert.match(j.key, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/); assert.equal(play.acks, before.a + 1, sku + " is acknowledged"); assert.equal(play.consumes, before.c, sku + " is not consumed"); assert.equal(play.purchases[token].ack, 1); }
    else { assert.equal(j.key, undefined); assert.equal(play.consumes, before.c + 1, sku + " is consumed"); assert.equal(play.acks, before.a, sku + " is not acknowledged"); assert.equal(play.purchases[token].consumed, 1); }
    assert.equal(playKeys(e).length, 1); assert.ok(!JSON.stringify([...e.DEWCLAW.m.entries()]).includes(token), "the purchase token itself is not kept, only its hash");
    assert.equal(r.headers.get("access-control-allow-origin"), GAME);
  }
});
await test("open trail play: replaying a token never grants twice", async () => {
  for (const sku of ["ot_gems_7000", "ot_treat_10", "ot_tip_3", "ot_pack_forest", "ot_everything"]) {
    const e = playEnv(), token = playBuy(sku), first = (await playClaim(e, sku, token)).j, gets = play.gets, settles = play.acks + play.consumes;
    for (let i = 0; i < 3; i++) { const again = (await playClaim(e, sku, token)).j; assert.equal(again.already, true, sku); assert.deepEqual(again.grant, first.grant); assert.equal(again.key, first.key); }
    assert.equal(play.gets, gets, "a settled replay does not ask Google again"); assert.equal(play.acks + play.consumes, settles); assert.equal(playKeys(e).length, 1);
    /* a burst of the same token at once: one record, one first answer */
    const e2 = playEnv(), t2 = playBuy(sku), all = await Promise.all(Array.from({ length: 8 }, () => playClaim(e2, sku, t2)));
    assert.equal(all.filter(x => x.j.already === false).length, 1, sku + ": exactly one first grant in a burst"); assert.equal(playKeys(e2).length, 1);
  }
});
await test("open trail play: a used-up item belongs to the device that claimed it; a permanent one comes back on another device without its gems", async () => {
  const e = playEnv();
  const gems = playBuy("ot_gems_500"); assert.equal((await playClaim(e, "ot_gems_500", gems)).r.status, 200);
  const other = await playClaim(e, "ot_gems_500", gems, INSTALL2); assert.equal(other.r.status, 403); assert.equal(other.j.grant, undefined);
  const sup = playBuy("ot_supporter"), first = (await playClaim(e, "ot_supporter", sup)).j; assert.equal(first.grant.gems, 600);
  const back = await playClaim(e, "ot_supporter", sup, INSTALL2);
  assert.equal(back.r.status, 200); assert.equal(back.j.restored, true); assert.equal(back.j.already, true); assert.equal(back.j.grant.gems, 0); assert.deepEqual(back.j.grant.items, OT.ot_supporter.items); assert.equal(back.j.key, first.key);
  /* ... and the Trail Key from a Play purchase restores the permanent item anywhere, with no gems */
  const viaKey = await (await handle(greq("/ot/restore", { key: first.key }), e, deps)).json(); assert.deepEqual(viaKey.skus, ["ot_supporter"]); assert.equal(viaKey.grants[0].grant.gems, 0);
});
await test("open trail play: a token from another package is refused, and so is a package the game did not ask for", async () => {
  const token = playBuy("ot_gems_80");
  let c = await playClaim(playEnv({ OT_PLAY_PACKAGE: "com.example.someotherapp" }), "ot_gems_80", token); assert.equal(c.r.status, 402); assert.equal(c.j.grant, undefined);
  c = await playClaim(playEnv(), "ot_gems_80", token, INSTALL, { package: "com.kcbeyondlimits.dewclaw" }); assert.equal(c.r.status, 400);
  /* the Dewclaw package is never used for the game, even though PLAY_PACKAGE is set */
  for (const bad of [undefined, "", "not a package", "../x", "com.example.opentrail/../../x"]) { const e = playEnv({ OT_PLAY_PACKAGE: bad }); c = await playClaim(e, "ot_gems_80", token); assert.equal(c.r.status, 503, String(bad)); assert.equal(playKeys(e).length, 0); }
  assert.equal(play.purchases[token].consumed, 0, "nothing was consumed along the way");
  c = await playClaim(playEnv(), "ot_gems_80", token, INSTALL, { package: OT_PKG }); assert.equal(c.r.status, 200);
});
await test("open trail play: a token bought for one SKU cannot be claimed as another", async () => {
  for (const strict of [false, true]) {
    play.strict = strict; const e = playEnv(), token = playBuy("ot_gems_80");
    const c = await playClaim(e, "ot_gems_7000", token); assert.equal(c.r.status, strict ? 402 : 409, "strict " + strict); assert.equal(c.j.grant, undefined); assert.equal(playKeys(e).length, 0);
    assert.equal(play.purchases[token].consumed, 0);
    /* claimed honestly, then tried again as the big pack */
    assert.equal((await playClaim(e, "ot_gems_80", token)).j.grant.gems, 80);
    const again = await playClaim(e, "ot_gems_7000", token); assert.equal(again.r.status, 409); assert.equal(again.j.grant, undefined);
  }
  play.strict = false;
  for (const sku of ["ot_gems_99999", "ot_bones_500", "pp_bones_500", "dewclaw_plus_monthly", "__proto__", "constructor", "", null, 7]) assert.equal((await playClaim(playEnv(), sku, playBuy("ot_gems_80"))).r.status, 400, String(sku));
});
await test("open trail play: pending, cancelled and refunded purchases grant nothing", async () => {
  for (const [state, what] of [[2, "pending"], [1, "cancelled or refunded"], [5, "unknown"], [undefined, "missing"]]) {
    const e = playEnv(), token = playBuy("ot_pack_galaxy", { state });
    const c = await playClaim(e, "ot_pack_galaxy", token); assert.equal(c.r.status, 402, what); assert.equal(c.j.grant, undefined); assert.equal(playKeys(e).length, 0); assert.equal(play.purchases[token].ack, 0, what + " is not acknowledged");
  }
  /* a pending payment that then goes through is granted */
  const e = playEnv(), token = playBuy("ot_gems_80", { state: 2 }); assert.equal((await playClaim(e, "ot_gems_80", token)).r.status, 402); play.purchases[token].state = 0; assert.equal((await playClaim(e, "ot_gems_80", token)).j.grant.gems, 80);
  /* refunded after it was claimed: another device asking for it (restore) gets nothing */
  const sup = playBuy("ot_supporter"); assert.equal((await playClaim(e, "ot_supporter", sup)).r.status, 200); play.purchases[sup].state = 1;
  const back = await playClaim(e, "ot_supporter", sup, INSTALL2); assert.equal(back.r.status, 402); assert.equal(back.j.grant, undefined);
  /* a token Google has never heard of, and Google being down */
  assert.equal((await playClaim(e, "ot_gems_80", "made-up-token-0123456789")).r.status, 402);
  play.status = 500; const down = await playClaim(e, "ot_gems_80", playBuy("ot_gems_80")); play.status = 200; assert.equal(down.r.status, 502); assert.equal(down.j.grant, undefined);
  /* a used-up item Google says was already consumed, with no record here */
  const spent = await playClaim(playEnv(), "ot_gems_500", playBuy("ot_gems_500", { consumed: 1 })); assert.equal(spent.r.status, 409); assert.equal(spent.j.grant, undefined);
});
await test("open trail play: if Google does not take the acknowledge, the grant stands once and the next claim finishes the job", async () => {
  const e = playEnv(), token = playBuy("ot_trail_pass"); play.failSettle = 2;
  const first = (await playClaim(e, "ot_trail_pass", token)).j; assert.equal(first.already, false); assert.equal(first.settled, false); assert.equal(play.purchases[token].ack, 0);
  const again = (await playClaim(e, "ot_trail_pass", token)).j; assert.equal(again.already, true); assert.equal(again.settled, true); assert.equal(play.purchases[token].ack, 1); assert.equal(playKeys(e).length, 1);
});
await test("open trail play: bad requests are refused before Google is asked; the body cannot change the grant", async () => {
  const e = playEnv(), gets = play.gets;
  for (const token of ["", "short", null, 12, "has spaces in the token 0123456789", "x".repeat(4001)]) assert.equal((await playClaim(e, "ot_gems_80", token)).r.status, 400, String(token).slice(0, 20));
  for (const install of [null, "", "short", "x".repeat(65)]) assert.equal((await playClaim(e, "ot_gems_80", playBuy("ot_gems_80"), install)).r.status, 400);
  assert.equal(play.gets, gets);
  const c = await playClaim(e, "ot_gems_80", playBuy("ot_gems_80"), INSTALL, { gems: 99999, bones: 5000, grant: { gems: 99999, bones: 5000 }, items: ["up:forever"], consumable: false });
  assert.deepEqual(c.j.grant, { bones: 0, gems: 80, items: [], flags: {} }); assert.equal(c.j.consumable, true);
  assert.equal((await handle(greq("/ot/play-claim", null, "GET"), e, deps)).status, 404);
  /* without the service account the route says so and grants nothing */
  const bare = playEnv({ GOOGLE_SA_EMAIL: "", GOOGLE_SA_KEY: "" }); const r = await playClaim(bare, "ot_gems_80", playBuy("ot_gems_80")); assert.equal(r.r.status, 503); assert.equal(playKeys(bare).length, 0);
});
await test("open trail play: a Google answer that does not name the product grants nothing (a cheap token cannot become the bundle); health reports the game's Play setup", async () => {
  { const e = playEnv(); play.noProductId = true;
    const c = await playClaim(e, "ot_gems_80", playBuy("ot_gems_80")); assert.equal(c.r.status, 502); assert.equal(c.j.grant, undefined);
    /* the attack: a $0.99 token claimed as the $24.99 bundle and as the 7,000 gem pack */
    const cheap = playBuy("ot_gems_80");
    for (const sku of ["ot_everything", "ot_gems_7000"]) { const up = await playClaim(e, sku, cheap); assert.equal(up.r.status, 502, sku); assert.equal(up.j.grant, undefined); }
    assert.equal(playKeys(e).length, 0, "nothing was written down"); play.noProductId = false;
    /* once Google names it, the same token is good for its own item only */
    assert.equal((await playClaim(e, "ot_everything", cheap)).r.status, 409); assert.equal((await playClaim(e, "ot_gems_80", cheap)).j.grant.gems, 80); }
  assert.equal((await (await handle(req("/health", null, "GET"), playEnv(), deps)).json()).otPlay, true);
  const h = await (await handle(req("/health", null, "GET"), env(), deps)).json(); assert.equal(h.otPlay, false); assert.equal(h.play, true);
});
await test("open trail play: Dewclaw's own Play routes still use PLAY_PACKAGE, and the Play channel cannot open a Stripe checkout", async () => {
  const e = { ...otEnv(), OT_PLAY_PACKAGE: OT_PKG };
  product.state = 0; product.ack = 0; const checks = product.checks, gets = play.gets;
  const j = await (await handle(req("/redeem", { sku: "pp_bones_500", token: TOKEN + "-ot-play" }), e, deps)).json();
  assert.deepEqual(j.grant, { bones: 500, items: [] }); assert.equal(product.checks, checks + 1, "Pocket Pup went to the Dewclaw package"); assert.equal(play.gets, gets);
  const before = stripe.n, r = await handle(greq("/stripe/checkout", { sku: "ot_gems_80", install: INSTALL, channel: "play" }), e, deps);
  assert.equal(r.status, 403); assert.equal(stripe.n, before, "no Stripe session is made for the Play channel");
  assert.equal((await handle(greq("/stripe/checkout", { sku: "ot_gems_80", install: INSTALL, channel: "web" }), e, deps)).status, 200);
});

console.log(`\n${passed} passed${process.exitCode ? ", with failures" : ""}`);
