/* Dewclaw server — a Cloudflare Worker with two jobs.

   1. /verify  confirms a Dewclaw Plus purchase with Google Play and
               acknowledges it (Google refunds unacknowledged purchases
               after three days), so Plus switches on in the app.
   2. /ask     answers a DewclawMD question with Claude, for active Plus
               subscribers only, inside a monthly allowance per subscriber
               and a daily cap across everyone. A failed answer is refunded.

   The Anthropic key and the Google service-account key live here as
   secrets and never reach the app. Settings and secrets are listed in
   SETUP.md. Everything is plain fetch + WebCrypto: no dependencies, no
   build step, paste into the Cloudflare dashboard and deploy. */

const DEFAULTS = {
  MODEL: "claude-haiku-5-5",
  MONTHLY_ASKS: 40,            /* answers per subscriber per calendar month */
  DAILY_ASKS_TOTAL: 400,       /* answers per day across every subscriber */
  SEARCH_USES: 2,              /* web searches Claude may run per answer */
  SEARCH_TOOL: "web_search_20260209",
  MAX_TOKENS: 1200,
  SUB_TTL_H: 6                 /* hours a verified subscription is trusted before re-checking with Google */
};

/* DewclawMD's standing instructions, kept word-for-word the same as the
   app's copy (lib/vetmd-prompt) so the on-device guide and the Claude
   answers follow the same rules. */
const ROLE = `You are DewclawMD, the research assistant inside Dewclaw, an app that helps people look after their dogs and cats. You are not a veterinarian and you must never present yourself as one.`;
const RESEARCH_LIVE = `Your job is to give an owner the most useful, accurate answer you can about their animal, grounded in current veterinary knowledge. Research before you answer: use web search to check the question against reputable sources — veterinary school and teaching-hospital sites, the Merck Veterinary Manual, AVMA, AAHA and WSAVA guidance, board-certified specialists, and peer-reviewed work — and prefer those over forums, product pages and general pet blogs. When sources disagree or evidence is thin, say so plainly. Finish your searching before you write anything, so the owner reads one coherent answer rather than a running commentary.`;
const RESEARCH_OFFLINE = `Your job is to give an owner the most useful, accurate answer you can about their animal, grounded in established veterinary knowledge. In this version you cannot search the web, so answer from what you know, and where current guidance matters — a recall, a new vaccine schedule, a local service — say that you have not checked live sources and that their vet can confirm. When evidence is thin or experts disagree, say so plainly.`;
const SAFETY = `Safety comes before everything else, in this order:
1. If what the owner describes could be an emergency — trouble breathing, collapse, a seizure, a swollen or hard belly with retching, straining to urinate (especially a male cat), heavy bleeding, suspected broken bones, heatstroke, sudden paralysis, or a pale, blue or grey tongue or gums — say at the very top that they should go to an emergency vet now, before anything else.
2. If the animal may have eaten something toxic, tell them to call their vet or a poison line immediately, before any other advice: in the US, the ASPCA Animal Poison Control Center on (888) 426-4435 or the Pet Poison Helpline on (855) 764-7661 (both may charge a fee). Never suggest inducing vomiting at home.
3. Never give a dose for any medication, prescription or over-the-counter, human or veterinary. Explain that dosing depends on an exam, and that many human medicines — acetaminophen (paracetamol), ibuprofen, naproxen, and anything containing xylitol, among others — are dangerous or fatal to pets, especially cats.

Do not diagnose. You can explain what a set of signs might point to, what a vet would want to check and why, and how urgent it is. If a pet profile is provided, use it — breed predispositions, age and life stage, weight and body condition often change the answer, and saying how they change it is part of being useful.

Stay on the subject of pets and animal care; if asked about something else, say briefly that you can only help with animals.`;
const FORMAT = `Format: the first line of every answer must be exactly one of these tags and nothing else:
[urgency: emergency]  go to an emergency vet now
[urgency: today]      call your vet today
[urgency: soon]       book a vet visit in the next few days
[urgency: routine]    raise it at the next check-up
[urgency: info]       general information, no health concern
Then open with a one- or two-sentence bottom line. Then the detail, in plain language, using short headings and bullet points where they help. Keep it as short as the question allows.`;
const RULES = [ROLE, RESEARCH_LIVE, SAFETY, FORMAT + " Cite what you found; the app shows your sources underneath your answer."].join("\n\n");
const RULES_OFFLINE = [ROLE, RESEARCH_OFFLINE, SAFETY, FORMAT].join("\n\n");

/* Pocket Pup's one-time products. This table, not the app, decides what a
   purchase is worth. Keep the SKUs the same as the in-app products in Play
   Console (Monetize with Play -> Products -> In-app products). */
const PP_GRANTS = {
  pp_bones_500:  { bones: 500,  consumable: true },
  pp_bones_1300: { bones: 1300, consumable: true },
  pp_bones_3600: { bones: 3600, consumable: true },
  pp_bones_8000: { bones: 8000, consumable: true },
  pp_starter:    { bones: 1500, items: ["shell:camo", "hat:ranger", "scene:forest"], consumable: false },
  pp_forever:    { items: ["up:forever"], consumable: false },
  pp_slot2:      { items: ["up:slot2"], consumable: false },
  pp_kc_pack:    { bones: 800, items: ["hat:bandana", "shell:cedar", "scene:mountain", "food:jerky"], consumable: false },
  pp_halloween:  { bones: 500, items: ["hat:witch", "shell:purple", "scene:halloween", "palette:spooky"], consumable: false },
  pp_palettes:   { items: ["palette:amber", "palette:ice", "palette:pocket", "palette:night", "palette:spooky", "palette:huckleberry", "palette:sunset", "palette:fog"], consumable: false },
  pp_boost7:     { items: ["boost:7"], consumable: true },
  pp_revive:     { items: ["revive:1"], consumable: true }
};

/* ------------------------------------------------------------------ utils */
const enc = new TextEncoder();
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlStr = s => b64url(enc.encode(s));
async function sha256(s) {
  const h = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const monthKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 7);
const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
const cfg = env => ({
  MODEL: env.MODEL || DEFAULTS.MODEL,
  MONTHLY_ASKS: num(env.MONTHLY_ASKS, DEFAULTS.MONTHLY_ASKS),
  DAILY_ASKS_TOTAL: num(env.DAILY_ASKS_TOTAL, DEFAULTS.DAILY_ASKS_TOTAL),
  SEARCH_USES: env.SEARCH_USES === "0" ? 0 : num(env.SEARCH_USES, DEFAULTS.SEARCH_USES),
  SEARCH_TOOL: env.SEARCH_TOOL || DEFAULTS.SEARCH_TOOL,
  MAX_TOKENS: num(env.MAX_TOKENS, DEFAULTS.MAX_TOKENS),
  SUB_TTL_H: num(env.SUB_TTL_H, DEFAULTS.SUB_TTL_H),
  SKUS: String(env.PLAY_SKUS || "dewclaw_plus_monthly,dewclaw_plus_yearly").split(",").map(s => s.trim()).filter(Boolean)
});

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function cors(env, req) {
  const allowed = env.ALLOWED_ORIGIN || "*";
  const origin = req.headers.get("origin") || "";
  const ok = allowed === "*" || allowed.split(",").map(s => s.trim()).includes(origin);
  return {
    "access-control-allow-origin": ok ? (allowed === "*" ? "*" : origin) : "null",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "vary": "origin"
  };
}
const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });

/* ----------------------------------------------------------- Google Play */
async function googleToken(env, deps) {
  const cached = await env.DEWCLAW.get("gtoken", "json");
  if (cached && cached.exp > deps.now() + 60e3) return cached.token;
  if (!env.GOOGLE_SA_EMAIL || !env.GOOGLE_SA_KEY) throw new HttpError(503, "The server isn't set up for Google Play yet.");
  const iat = Math.floor(deps.now() / 1000);
  const header = b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64urlStr(JSON.stringify({ iss: env.GOOGLE_SA_EMAIL, scope: "https://www.googleapis.com/auth/androidpublisher",
                                             aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 }));
  const pem = String(env.GOOGLE_SA_KEY).replace(/\\n/g, "\n").replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${header}.${claims}`));
  const assertion = `${header}.${claims}.${b64url(sig)}`;
  const r = await deps.fetch("https://oauth2.googleapis.com/token", { method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${assertion}` });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new HttpError(502, "Google didn't accept the server's credentials. Check GOOGLE_SA_EMAIL and GOOGLE_SA_KEY.");
  await env.DEWCLAW.put("gtoken", JSON.stringify({ token: j.access_token, exp: deps.now() + (num(j.expires_in, 3600) - 120) * 1000 }), { expirationTtl: 3600 });
  return j.access_token;
}

/* Asks Google about one purchase token. Returns { active, until, sku, state }. */
async function playCheck(env, deps, sku, token) {
  const c = cfg(env);
  if (!c.SKUS.includes(sku)) throw new HttpError(400, "That isn't a Dewclaw Plus plan.");
  if (!env.PLAY_PACKAGE) throw new HttpError(503, "PLAY_PACKAGE isn't set on the server.");
  const bearer = await googleToken(env, deps);
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.PLAY_PACKAGE)}/purchases`;
  const r = await deps.fetch(`${base}/subscriptionsv2/tokens/${encodeURIComponent(token)}`, { headers: { authorization: `Bearer ${bearer}` } });
  if (r.status === 404 || r.status === 400) return { active: false, until: 0, sku, state: "unknown" };
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, "Google Play couldn't confirm the purchase yet. Tap Restore in a minute.");
  const items = Array.isArray(j.lineItems) ? j.lineItems : [];
  const mine = items.find(i => c.SKUS.includes(i.productId)) || items[0];
  const until = items.reduce((m, i) => Math.max(m, Date.parse(i.expiryTime || "") || 0), 0);
  const state = String(j.subscriptionState || "");
  const live = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"].includes(state);
  const active = live && until > deps.now();
  /* acknowledge once, or Google refunds the purchase after three days */
  if (active && j.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING") {
    const ackSku = mine?.productId || sku;
    await deps.fetch(`${base}/subscriptions/${encodeURIComponent(ackSku)}/tokens/${encodeURIComponent(token)}:acknowledge`,
      { method: "POST", headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" }, body: "{}" }).catch(() => {});
  }
  return { active, until, sku: mine?.productId || sku, state };
}

/* The subscription as the server last saw it; re-checked with Google when
   it is older than SUB_TTL_H hours or when its period has ended. */
async function subscription(env, deps, sku, token, force) {
  if (isWebToken(token)) return webCheck(env, deps, token, force);
  const key = "sub:" + await sha256(token);
  const c = cfg(env), now = deps.now();
  let s = force ? null : await env.DEWCLAW.get(key, "json");
  const stale = !s || (now - (s.checked || 0)) > c.SUB_TTL_H * 36e5 || (s.active && s.until <= now);
  if (stale) {
    const fresh = await playCheck(env, deps, sku, token);
    s = { ...fresh, checked: now };
    await env.DEWCLAW.put(key, JSON.stringify(s), { expirationTtl: 60 * 86400 });
  }
  return { ...s, key };
}

/* ---------------------------------------------------------------- Stripe
   Web buyers (anyone using Dewclaw in a browser rather than the Play app)
   pay through Stripe Checkout. The app never sees a card: it asks this
   server for a Checkout link, Stripe takes the payment, and the buyer comes
   back with a session id that /stripe/claim turns into a signed Dewclaw
   token. /verify and /ask accept that token exactly like a Play token.

   Secrets: STRIPE_SECRET_KEY, STRIPE_PRICES (JSON: sku -> Stripe price id),
   APP_ORIGIN (where the app lives, for the return links), optional
   TOKEN_SECRET and STRIPE_TRIAL_DAYS (default 7, monthly plan only). */
const WEB_PRODUCTS = {
  dewclaw_plus_monthly:   { mode: "subscription", trial: true },
  dewclaw_plus_yearly:    { mode: "subscription" },
  dewclaw_plus_lifetime:  { mode: "payment", plus: "lifetime" },
  dewclaw_plus_gift_year: { mode: "payment", plus: "gift", days: 365 }
};
const RETURN_PATHS = ["/plus", "/pocket", "/geopet"];
const FAR = Date.UTC(2200, 0, 1);
const stripeKey = env => String(env.STRIPE_SECRET_KEY || "");
const stripeOn = env => !!(stripeKey(env) && env.STRIPE_PRICES);
const stripePrices = env => { try { return JSON.parse(env.STRIPE_PRICES || "{}") || {}; } catch { return {}; } };
async function stripe(env, deps, method, path, form) {
  if (!stripeKey(env)) throw new HttpError(503, "The server isn't set up for web payments yet.");
  const init = { method, headers: { authorization: `Bearer ${stripeKey(env)}` } };
  if (form) { init.headers["content-type"] = "application/x-www-form-urlencoded"; init.body = new URLSearchParams(form).toString(); }
  const r = await deps.fetch("https://api.stripe.com/v1" + path, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(r.status === 404 ? 402 : 502, j?.error?.message ? `Stripe: ${j.error.message}` : "Stripe didn't answer.");
  return j;
}
async function hmacKey(env) {
  const secret = String(env.TOKEN_SECRET || stripeKey(env));
  if (!secret) throw new HttpError(503, "The server has no signing secret yet.");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function signToken(env, payload) {
  const body = b64urlStr(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(body));
  return "w1." + body + "." + b64url(sig);
}
const isWebToken = t => typeof t === "string" && t.startsWith("w1.");
async function readToken(env, token) {
  const [, body, sig] = String(token).split(".");
  if (!body || !sig) return null;
  const raw = Uint8Array.from(atob(sig.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(env), raw, enc.encode(body)).catch(() => false);
  if (!ok) return null;
  try { return JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/"))); } catch { return null; }
}
/* a short code the buyer can type on another phone (or give away): 8 letters, no 0/O/1/I */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  const s = [...b].map(x => CODE_ALPHABET[x % 32]).join("");
  return s.slice(0, 4) + "-" + s.slice(4);
}
const normCode = c => String(c || "").toUpperCase().replace(/[^A-Z2-9]/g, "").replace(/^(.{4})(.{4})$/, "$1-$2");
async function saveCode(env, token, sku) {
  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    if (!(await env.DEWCLAW.get("code:" + code))) { await env.DEWCLAW.put("code:" + code, JSON.stringify({ token, sku }), { expirationTtl: 400 * 86400 }); return code; }
  }
  throw new HttpError(500, "Couldn't make a code.");
}
const periodEnd = sub => Number(sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end) || 0) * 1000;
/* what a web token is worth right now; subscriptions are re-read from Stripe like Play ones */
async function webCheck(env, deps, token, force) {
  const p = await readToken(env, token);
  if (!p) throw new HttpError(402, "That Plus token isn't valid.");
  const c = cfg(env), now = deps.now(), key = "sub:" + await sha256(token);
  if (p.k === "s") {
    let s = force ? null : await env.DEWCLAW.get(key, "json");
    const stale = !s || (now - (s.checked || 0)) > c.SUB_TTL_H * 36e5 || (s.active && s.until <= now);
    if (stale) {
      const sub = await stripe(env, deps, "GET", `/subscriptions/${encodeURIComponent(p.s)}`);
      const active = ["active", "trialing", "past_due"].includes(sub.status);
      s = { active, until: active ? periodEnd(sub) + (sub.status === "past_due" ? 3 * 86400e3 : 0) : 0, sku: p.sku, checked: now, web: true, customer: p.c };
      await env.DEWCLAW.put(key, JSON.stringify(s), { expirationTtl: 60 * 86400 });
    }
    return { ...s, key };
  }
  /* lifetime and gift tokens live in KV; a gift starts its year the first time it is checked */
  const rec = await env.DEWCLAW.get("web:" + await sha256(token), "json");
  if (!rec) throw new HttpError(402, "That Plus token isn't on record.");
  if (!rec.until && rec.days) { rec.until = now + rec.days * 86400e3; await env.DEWCLAW.put("web:" + await sha256(token), JSON.stringify(rec)); }
  return { active: rec.until > now, until: rec.until, sku: p.sku, checked: now, web: true, customer: p.c, key };
}
async function handleStripeCheckout(env, deps, req) {
  if (!stripeOn(env)) throw new HttpError(503, "Web payments aren't switched on yet. Plus is sold in the Dewclaw app on Google Play.");
  const { sku, back } = await readJson(req);
  const price = stripePrices(env)[sku];
  const w = WEB_PRODUCTS[sku], g = PP_GRANTS[sku];
  if (!price || !(w || g)) throw new HttpError(400, "That isn't something Dewclaw sells on the web.");
  const origin = String(env.APP_ORIGIN || "").replace(/\/+$/, "");
  if (!origin) throw new HttpError(503, "APP_ORIGIN isn't set on the server.");
  const path = RETURN_PATHS.includes(back) ? back : "/plus";
  const form = {
    mode: w ? w.mode : "payment",
    "line_items[0][price]": price, "line_items[0][quantity]": "1",
    success_url: `${origin}/?cs={CHECKOUT_SESSION_ID}#${path}`,
    cancel_url: `${origin}/#${path}`,
    "metadata[sku]": sku, allow_promotion_codes: "true"
  };
  if (w && w.mode === "subscription") form["subscription_data[metadata][sku]"] = sku;
  if (w && w.trial) { const d = num(env.STRIPE_TRIAL_DAYS, 7); if (d) form["subscription_data[trial_period_days]"] = String(d); }
  /* Sales tax. STRIPE_TAX unset or "off": no tax handling (fine while you have
     no tax registrations). "auto": Stripe Tax calculates tax where you are
     registered and monitors thresholds everywhere else; needs Tax settings
     (origin address, default tax code) completed in the Stripe Dashboard.
     "managed": Stripe Managed Payments, Stripe is the merchant of record and
     files the tax; 3.5% on top of processing, digital products only. */
  const tax = String(env.STRIPE_TAX || "off").toLowerCase();
  if (tax === "auto") {
    form["automatic_tax[enabled]"] = "true";
    form.billing_address_collection = "auto";
    if (form.mode === "payment") form.customer_creation = "always";
  } else if (tax === "managed") {
    form["managed_payments[enabled]"] = "true";
  } else if (form.mode === "payment") {
    form.customer_creation = "always";   /* so a lifetime buyer has a customer record for receipts and support */
  }
  const s = await stripe(env, deps, "POST", "/checkout/sessions", form);
  if (!s.url) throw new HttpError(502, "Stripe didn't return a checkout link.");
  return { url: s.url };
}
/* turns a finished Checkout session into what was bought; idempotent per session */
async function handleStripeClaim(env, deps, req) {
  const { session } = await readJson(req);
  if (typeof session !== "string" || !/^cs_[A-Za-z0-9_]{4,200}$/.test(session)) throw new HttpError(400, "A checkout session is required.");
  const key = "claim:" + await sha256(session);
  const seen = await env.DEWCLAW.get(key, "json");
  if (seen) return { ...seen, already: true };
  const s = await stripe(env, deps, "GET", `/checkout/sessions/${encodeURIComponent(session)}`);
  if (s.status !== "complete") throw new HttpError(402, s.status === "expired" ? "That checkout expired. Start again." : "That payment hasn't finished yet.");
  if (!(s.payment_status === "paid" || s.payment_status === "no_payment_required")) throw new HttpError(402, "That payment hasn't gone through yet.");
  const sku = s.metadata && s.metadata.sku, w = WEB_PRODUCTS[sku], g = PP_GRANTS[sku];
  const customer = typeof s.customer === "string" ? s.customer : (s.customer && s.customer.id) || "";
  let out;
  if (w && w.mode === "subscription") {
    const subId = typeof s.subscription === "string" ? s.subscription : (s.subscription && s.subscription.id) || "";
    if (!subId) throw new HttpError(502, "Stripe didn't return the subscription.");
    const token = await signToken(env, { k: "s", c: customer, s: subId, sku, t: deps.now() });
    const st = await webCheck(env, deps, token, true);
    out = { kind: "plus", sku, token, active: st.active, until: st.until, code: await saveCode(env, token, sku) };
  } else out = await oneTimeGrant(env, deps, sku, session, customer);
  await env.DEWCLAW.put(key, JSON.stringify(out), { expirationTtl: 400 * 86400 });
  return { ...out, already: false };
}
/* what a paid one-time purchase is worth, whichever processor took the money:
   Plus for life, a gift year (as a code), or a Pocket Pup grant */
async function oneTimeGrant(env, deps, sku, ref, customer) {
  const w = WEB_PRODUCTS[sku], g = PP_GRANTS[sku];
  if (w && w.plus === "lifetime") {
    const token = await signToken(env, { k: "l", c: customer, s: ref, sku, t: deps.now() });
    await env.DEWCLAW.put("web:" + await sha256(token), JSON.stringify({ until: FAR, sku }));
    return { kind: "plus", sku, token, active: true, until: FAR, code: await saveCode(env, token, sku) };
  }
  if (w && w.plus === "gift") {
    const token = await signToken(env, { k: "g", c: customer, s: ref, sku, t: deps.now() });
    await env.DEWCLAW.put("web:" + await sha256(token), JSON.stringify({ until: 0, days: w.days, sku }));
    return { kind: "gift", sku, days: w.days, code: await saveCode(env, token, sku) };
  }
  if (g) return { kind: "grant", sku, grant: { bones: g.bones || 0, items: g.items || [] }, consumable: g.consumable };
  throw new HttpError(400, "That checkout isn't for a Dewclaw product.");
}

/* ---------------------------------------------------------------- PayPal
   One-time purchases only (bone and item packs, Plus for life, a gift year);
   Plus subscriptions stay on Stripe. The buyer approves on PayPal, comes back
   with ?pp=1&token=<order id>, and /paypal/claim captures the order, checks the
   amount against this server's own price list, then grants exactly like Stripe.

   Secrets: PAYPAL_CLIENT_ID, PAYPAL_SECRET. PAYPAL_ENV = "live" for real money
   (anything else is the PayPal sandbox). Optional PAYPAL_PRICES (JSON: sku ->
   "0.99") overrides the price list below. */
const PAYPAL_PRICES = {
  pp_bones_500: "0.99", pp_bones_1300: "1.99", pp_bones_3600: "4.99", pp_bones_8000: "9.99",
  pp_starter: "2.99", pp_forever: "1.99", pp_slot2: "2.99", pp_kc_pack: "3.99", pp_halloween: "2.99",
  pp_palettes: "1.99", pp_boost7: "1.99", pp_revive: "0.99",
  dewclaw_plus_lifetime: "29.99", dewclaw_plus_gift_year: "11.99"
};
const PAYPAL_NAMES = { dewclaw_plus_lifetime: "Dewclaw Plus for life", dewclaw_plus_gift_year: "A year of Dewclaw Plus (gift)" };
const paypalOn = env => !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_SECRET);
const paypalLive = env => String(env.PAYPAL_ENV || "").toLowerCase() === "live";
const paypalBase = env => paypalLive(env) ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const paypalPrices = env => { let o = {}; try { o = JSON.parse(env.PAYPAL_PRICES || "{}") || {}; } catch {} return { ...PAYPAL_PRICES, ...o }; };
const paypalSkus = env => paypalOn(env) ? Object.keys(paypalPrices(env)).filter(k => PP_GRANTS[k] || (WEB_PRODUCTS[k] && WEB_PRODUCTS[k].mode === "payment")) : [];
async function paypalToken(env, deps) {
  const ck = "pptoken:" + (paypalLive(env) ? "live" : "sandbox");
  const cached = await env.DEWCLAW.get(ck, "json");
  if (cached && cached.exp > deps.now() + 60e3) return cached.token;
  const r = await deps.fetch(paypalBase(env) + "/v1/oauth2/token", { method: "POST",
    headers: { authorization: "Basic " + btoa(env.PAYPAL_CLIENT_ID + ":" + env.PAYPAL_SECRET), "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new HttpError(502, "PayPal didn't accept the server's credentials. Check PAYPAL_CLIENT_ID, PAYPAL_SECRET and PAYPAL_ENV.");
  await env.DEWCLAW.put(ck, JSON.stringify({ token: j.access_token, exp: deps.now() + (num(j.expires_in, 3600) - 120) * 1000 }), { expirationTtl: 3600 });
  return j.access_token;
}
async function paypal(env, deps, method, path, body, requestId) {
  if (!paypalOn(env)) throw new HttpError(503, "PayPal isn't switched on yet.");
  const headers = { authorization: "Bearer " + await paypalToken(env, deps), "content-type": "application/json", prefer: "return=representation" };
  if (requestId) headers["paypal-request-id"] = requestId;
  const r = await deps.fetch(paypalBase(env) + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}
async function handlePaypalCheckout(env, deps, req) {
  if (!paypalOn(env)) throw new HttpError(503, "PayPal isn't switched on yet.");
  const { sku, back } = await readJson(req);
  const value = paypalPrices(env)[sku];
  if (!value || !paypalSkus(env).includes(sku)) throw new HttpError(400, "That can't be bought with PayPal. Plus subscriptions are paid by card.");
  const origin = String(env.APP_ORIGIN || "").replace(/\/+$/, "");
  if (!origin) throw new HttpError(503, "APP_ORIGIN isn't set on the server.");
  const path = RETURN_PATHS.includes(back) ? back : "/plus";
  const name = PAYPAL_NAMES[sku] || "Pocket Pup: " + sku.replace(/^pp_/, "").replace(/_/g, " ");
  const r = await paypal(env, deps, "POST", "/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [{ reference_id: sku, custom_id: sku, description: name.slice(0, 127), amount: { currency_code: "USD", value } }],
    payment_source: { paypal: { experience_context: { brand_name: "Dewclaw", user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING",
      return_url: `${origin}/?pp=1#${path}`, cancel_url: `${origin}/#${path}` } } }
  }, "dc-" + crypto.randomUUID());
  if (!r.ok) throw new HttpError(502, r.j?.message ? `PayPal: ${r.j.message}` : "PayPal didn't answer.");
  const link = (r.j.links || []).find(l => l.rel === "payer-action" || l.rel === "approve");
  if (!link) throw new HttpError(502, "PayPal didn't return a checkout link.");
  return { url: link.href, order: r.j.id };
}
async function handlePaypalClaim(env, deps, req) {
  const { order } = await readJson(req);
  if (typeof order !== "string" || !/^[A-Z0-9]{8,40}$/.test(order)) throw new HttpError(400, "A PayPal order is required.");
  const key = "claim:pp:" + await sha256(order);
  const seen = await env.DEWCLAW.get(key, "json");
  if (seen) return { ...seen, already: true };
  let o = await paypal(env, deps, "GET", `/v2/checkout/orders/${encodeURIComponent(order)}`);
  if (o.status === 404) throw new HttpError(402, "PayPal doesn't know that order.");
  if (!o.ok) throw new HttpError(502, "PayPal couldn't confirm the payment yet. Try again in a minute.");
  if (o.j.status === "APPROVED") {
    const c = await paypal(env, deps, "POST", `/v2/checkout/orders/${encodeURIComponent(order)}/capture`, {}, "cap-" + order);
    const issue = c.j?.details?.[0]?.issue;
    if (c.ok) o = c;
    else if (issue === "ORDER_ALREADY_CAPTURED") o = await paypal(env, deps, "GET", `/v2/checkout/orders/${encodeURIComponent(order)}`);
    else throw new HttpError(402, issue === "INSTRUMENT_DECLINED" ? "PayPal declined that payment method. Try another one in PayPal, or pay by card." : "PayPal couldn't take the payment. Try again, or pay by card.");
  }
  if (o.j.status !== "COMPLETED") throw new HttpError(402, o.j.status === "PAYER_ACTION_REQUIRED" || o.j.status === "CREATED" ? "That PayPal payment hasn't been approved yet." : "That PayPal payment didn't go through.");
  const pu = (o.j.purchase_units || [])[0] || {};
  const cap = ((pu.payments || {}).captures || [])[0] || {};
  if (cap.status === "PENDING") throw new HttpError(402, "PayPal is still processing that payment. Come back to this page once PayPal emails you that it cleared.");
  if (cap.status !== "COMPLETED") throw new HttpError(402, "That PayPal payment didn't go through.");
  const sku = pu.custom_id || cap.custom_id || pu.reference_id;
  const want = paypalPrices(env)[sku];
  const amt = cap.amount || pu.amount || {};
  if (!want || amt.currency_code !== "USD" || Math.round(Number(amt.value) * 100) < Math.round(Number(want) * 100)) throw new HttpError(402, "That PayPal payment doesn't match a Dewclaw product.");
  const customer = "pp:" + ((o.j.payer || {}).payer_id || "");
  const out = { ...(await oneTimeGrant(env, deps, sku, "pp:" + order, customer)), via: "paypal" };
  await env.DEWCLAW.put(key, JSON.stringify(out), { expirationTtl: 400 * 86400 });
  return { ...out, already: false };
}
async function handleStripeRestore(env, deps, req) {
  const { code } = await readJson(req);
  const c = normCode(code);
  if (c.length !== 9) throw new HttpError(400, "Enter the 8-character Plus code.");
  const rec = await env.DEWCLAW.get("code:" + c, "json");
  if (!rec) throw new HttpError(404, "That code isn't on record. Check it and try again.");
  const st = await webCheck(env, deps, rec.token, false);
  return { token: rec.token, sku: rec.sku, active: st.active, until: st.until };
}
async function handleStripePortal(env, deps, req) {
  const { token } = await readJson(req);
  const p = isWebToken(token) ? await readToken(env, token) : null;
  if (!p || p.k !== "s") throw new HttpError(400, "Only a web subscription can be managed here.");
  const origin = String(env.APP_ORIGIN || "").replace(/\/+$/, "");
  const s = await stripe(env, deps, "POST", "/billing_portal/sessions", { customer: p.c, return_url: `${origin}/#/plus` });
  return { url: s.url };
}
/* the web price list the app shows; read from Stripe once an hour */
async function handleStripePrices(env, deps) {
  if (!stripeOn(env)) return { on: false, prices: [], paypal: paypalSkus(env) };
  const cached = await env.DEWCLAW.get("prices", "json");
  if (cached && cached.at > deps.now() - 36e5) return { on: true, prices: cached.prices, paypal: paypalSkus(env) };
  const prices = [];
  for (const [sku, id] of Object.entries(stripePrices(env))) {
    if (!(WEB_PRODUCTS[sku] || PP_GRANTS[sku])) continue;
    try {
      const p = await stripe(env, deps, "GET", `/prices/${encodeURIComponent(id)}`);
      prices.push({ sku, amount: Number(p.unit_amount) / 100, currency: String(p.currency || "usd").toUpperCase(),
                    interval: p.recurring ? p.recurring.interval : null, trialDays: WEB_PRODUCTS[sku] && WEB_PRODUCTS[sku].trial ? num(env.STRIPE_TRIAL_DAYS, 7) : 0 });
    } catch {}
  }
  if (prices.length) await env.DEWCLAW.put("prices", JSON.stringify({ at: deps.now(), prices }), { expirationTtl: 86400 });
  return { on: true, prices, paypal: paypalSkus(env) };
}

/* ------------------------------------------------------------- Anthropic */
function extract(content) {
  const parts = [], sources = [], seen = new Set();
  for (const b of content || []) {
    if (b.type === "text") {
      parts.push(b.text || "");
      for (const c of b.citations || []) if (c.url && !seen.has(c.url)) { seen.add(c.url); sources.push({ title: c.title || c.url, url: c.url }); }
    }
  }
  return { text: parts.join("").trim(), sources };
}

async function askClaude(env, deps, question, pet) {
  const c = cfg(env);
  if (!env.ANTHROPIC_API_KEY) throw new HttpError(503, "The server has no Anthropic key yet.");
  const user = (pet ? `Pet profile:\n${pet}\n\n` : "") + `Owner's question: ${question}`;
  const body = {
    model: c.MODEL, max_tokens: c.MAX_TOKENS,
    system: [{ type: "text", text: c.SEARCH_USES ? RULES : RULES_OFFLINE, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }]
  };
  if (c.SEARCH_USES) body.tools = [{ type: c.SEARCH_TOOL, name: "web_search", max_uses: c.SEARCH_USES }];
  const call = async b => deps.fetch("https://api.anthropic.com/v1/messages", { method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(b) });
  let r = await call(body);
  /* if this account can't use the search tool, answer without it rather than fail */
  if (r.status === 400 && body.tools) {
    const err = await r.text().catch(() => "");
    if (/web_search|tool/i.test(err)) { delete body.tools; body.system[0].text = RULES_OFFLINE; r = await call(body); }
    else throw new HttpError(502, "Claude rejected the request.");
  }
  if (r.status === 429 || r.status === 529) throw new HttpError(503, "DewclawMD is busy right now. Try again in a minute.");
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, j?.error?.message ? `Claude: ${j.error.message}` : "Claude didn't answer.");
  const out = extract(j.content);
  if (!out.text) throw new HttpError(502, "Claude returned an empty answer.");
  return out;
}

/* ----------------------------------------------------------------- routes */
async function readJson(req, limit = 20000) {
  const raw = await req.text();
  if (raw.length > limit) throw new HttpError(413, "That request is too large.");
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new HttpError(400, "The request wasn't valid JSON."); }
}

async function handleVerify(env, deps, req) {
  const { sku, token } = await readJson(req);
  if (typeof token !== "string" || token.length < 10 || token.length > 4000 || typeof sku !== "string") throw new HttpError(400, "A purchase token and plan are required.");
  const s = await subscription(env, deps, sku, token, true);
  if (s.web) return { active: s.active, until: s.until, sku: s.sku, web: true };
  return { active: s.active, until: s.until, sku: s.sku };
}

/* Confirms a Pocket Pup purchase with Google and says what it grants.
   Idempotent per purchase token: a second call returns the same grant with
   `already: true`, so a retry or a restore can never double the bones. */
async function handleRedeem(env, deps, req) {
  const { sku, token } = await readJson(req);
  const g = PP_GRANTS[sku];
  if (!g) throw new HttpError(400, "That isn't a Pocket Pup product.");
  if (typeof token !== "string" || token.length < 10 || token.length > 4000) throw new HttpError(400, "A purchase token is required.");
  if (!env.PLAY_PACKAGE) throw new HttpError(503, "PLAY_PACKAGE isn't set on the server.");
  const key = "redeem:" + await sha256(token);
  const grant = { bones: g.bones || 0, items: g.items || [] };
  const seen = await env.DEWCLAW.get(key, "json");
  if (seen) return { ok: true, sku, grant, consumable: g.consumable, already: true };
  const bearer = await googleToken(env, deps);
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.PLAY_PACKAGE)}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}`;
  const r = await deps.fetch(base, { headers: { authorization: `Bearer ${bearer}` } });
  if (r.status === 404 || r.status === 400) throw new HttpError(402, "Google Play doesn't know that purchase.");
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, "Google Play couldn't confirm the purchase yet. Tap Restore purchases in a minute.");
  if (j.purchaseState === 2) throw new HttpError(402, "That purchase is still pending with Google Play.");
  if (j.purchaseState !== 0) throw new HttpError(402, "That purchase was cancelled or refunded.");
  await env.DEWCLAW.put(key, JSON.stringify({ sku, at: deps.now(), order: j.orderId || "" }), { expirationTtl: 400 * 86400 });
  /* one-time products must be acknowledged within three days or Google refunds them;
     consumables are acknowledged by the app's consume call */
  if (!g.consumable && j.acknowledgementState === 0) {
    await deps.fetch(base + ":acknowledge", { method: "POST", headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" }, body: "{}" }).catch(() => {});
  }
  return { ok: true, sku, grant, consumable: g.consumable, already: false };
}

async function handleAsk(env, deps, req) {
  const c = cfg(env);
  const { token, sku, question, pet } = await readJson(req);
  if (typeof question !== "string" || !question.trim()) throw new HttpError(400, "Ask a question first.");
  if (question.length > 1500) throw new HttpError(400, "Keep the question under 1,500 characters.");
  if (typeof token !== "string" || token.length < 10 || token.length > 4000 || typeof sku !== "string") throw new HttpError(402, "Dewclaw Plus is needed for answers from Claude. Open Plus to subscribe or restore a purchase.");
  const s = await subscription(env, deps, sku, token, false);
  if (!s.active) throw new HttpError(402, s.web ? "Your Plus subscription isn't active. Open Plus to renew it." : "Plus isn't active on this Google account. Open Plus and tap Restore purchase.");

  const dKey = "daily:" + dayKey(deps.now()), mKey = `quota:${s.key.slice(4)}:${monthKey(deps.now())}`;
  const daily = Number(await env.DEWCLAW.get(dKey)) || 0;
  if (daily >= c.DAILY_ASKS_TOTAL) throw new HttpError(429, "DewclawMD has answered everything it can today. The built-in guide still works; Claude answers return tomorrow.");
  const used = Number(await env.DEWCLAW.get(mKey)) || 0;
  if (used >= c.MONTHLY_ASKS) throw new HttpError(429, `You've used this month's ${c.MONTHLY_ASKS} answers from Claude. Your allowance resets on the 1st; the built-in guide still works.`);

  await env.DEWCLAW.put(mKey, String(used + 1), { expirationTtl: 40 * 86400 });
  await env.DEWCLAW.put(dKey, String(daily + 1), { expirationTtl: 2 * 86400 });
  try {
    const out = await askClaude(env, deps, question.trim(), typeof pet === "string" ? pet.slice(0, 6000) : "");
    return { text: out.text, sources: out.sources, remaining: Math.max(0, c.MONTHLY_ASKS - used - 1) };
  } catch (e) {
    /* a failed answer doesn't count against anyone */
    await env.DEWCLAW.put(mKey, String(used), { expirationTtl: 40 * 86400 });
    await env.DEWCLAW.put(dKey, String(daily), { expirationTtl: 2 * 86400 });
    throw e;
  }
}

export async function handle(req, env, deps = { fetch: globalThis.fetch.bind(globalThis), now: Date.now }) {
  const h = cors(env, req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  const url = new URL(req.url), path = url.pathname.replace(/\/+$/, "") || "/";
  try {
    if (req.method === "GET" && (path === "/" || path === "/health")) {
      const c = cfg(env);
      return json({ ok: true, model: c.MODEL, play: !!(env.GOOGLE_SA_EMAIL && env.GOOGLE_SA_KEY && env.PLAY_PACKAGE), claude: !!env.ANTHROPIC_API_KEY,
                    stripe: stripeOn(env), tax: ["auto", "managed"].includes(String(env.STRIPE_TAX || "").toLowerCase()) ? String(env.STRIPE_TAX).toLowerCase() : "off", paypal: paypalOn(env) ? (paypalLive(env) ? "live" : "sandbox") : false, monthlyAsks: c.MONTHLY_ASKS, dailyAsksTotal: c.DAILY_ASKS_TOTAL }, 200, h);
    }
    if (req.method === "GET" && path === "/stripe/prices") return json(await handleStripePrices(env, deps), 200, { ...h, "cache-control": "public, max-age=300" });
    if (req.method !== "POST") throw new HttpError(404, "Not found.");
    if (path === "/verify") return json(await handleVerify(env, deps, req), 200, h);
    if (path === "/ask") return json(await handleAsk(env, deps, req), 200, h);
    if (path === "/redeem") return json(await handleRedeem(env, deps, req), 200, h);
    if (path === "/stripe/checkout") return json(await handleStripeCheckout(env, deps, req), 200, h);
    if (path === "/stripe/claim") return json(await handleStripeClaim(env, deps, req), 200, h);
    if (path === "/stripe/restore") return json(await handleStripeRestore(env, deps, req), 200, h);
    if (path === "/stripe/portal") return json(await handleStripePortal(env, deps, req), 200, h);
    if (path === "/paypal/checkout") return json(await handlePaypalCheckout(env, deps, req), 200, h);
    if (path === "/paypal/claim") return json(await handlePaypalClaim(env, deps, req), 200, h);
    throw new HttpError(404, "Not found.");
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    return json({ error: status === 500 ? "Something went wrong on the Dewclaw server." : e.message }, status, h);
  }
}

export default { fetch: (req, env) => handle(req, env) };
