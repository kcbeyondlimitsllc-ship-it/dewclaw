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
    if (path === "/checkout/sessions" && init.method === "POST") { stripe.lastForm = form; stripe.sessions["cs_test_" + (++stripe.n)] = { status: "complete", payment_status: form.mode === "subscription" ? "no_payment_required" : "paid", mode: form.mode, metadata: { sku: form["metadata[sku]"] }, customer: "cus_1", subscription: form.mode === "subscription" ? "sub_1" : null }; return ok({ id: "cs_test_" + stripe.n, url: "https://checkout.stripe.com/c/pay/cs_test_" + stripe.n }); }
    if (path.startsWith("/checkout/sessions/")) { const id = decodeURIComponent(path.split("/")[3]); const ss = stripe.sessions[id]; return ss ? ok({ id, ...ss, ...stripe.override }) : new Response(JSON.stringify({ error: { message: "No such checkout.session" } }), { status: 404 }); }
    if (path.startsWith("/subscriptions/")) { stripe.subChecks++; return ok({ id: "sub_1", status: stripe.subStatus, items: { data: [{ current_period_end: Math.floor(stripe.periodEnd / 1000) }] } }); }
    if (path === "/billing_portal/sessions") { stripe.lastForm = form; return ok({ url: "https://billing.stripe.com/p/session/x" }); }
    if (path.startsWith("/prices/")) { const id = path.split("/")[2]; const P = { price_m: { unit_amount: 299, currency: "usd", recurring: { interval: "month" } }, price_y: { unit_amount: 1199, currency: "usd", recurring: { interval: "year" } }, price_life: { unit_amount: 2999, currency: "usd" }, price_b500: { unit_amount: 99, currency: "usd" } }; return P[id] ? ok(P[id]) : new Response("{}", { status: 404 }); }
  }
  throw new Error("unexpected fetch " + u);
}
const stripe = { calls: 0, n: 0, sessions: {}, override: {}, subStatus: "trialing", periodEnd: Date.now() + 7 * 86400e3, subChecks: 0, lastForm: null, lastAuth: "" };
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
  assert.equal(r.status, 429); assert.match((await r.json()).error, /this month's 3 answers/);
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

console.log(`\n${passed} passed${process.exitCode ? ", with failures" : ""}`);
