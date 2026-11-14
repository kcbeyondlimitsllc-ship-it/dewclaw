/* Shared by the studio apps: talks to the studio server and remembers the
   buyer's unlock code in this browser. */
(function () {
  "use strict";
  const cfg = self.STUDIO_CONFIG || {};
  const cloud = String(cfg.cloud || "").replace(/\/+$/, "");
  const KEY = "kcb.code";
  const get = () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
  const set = c => { try { c ? localStorage.setItem(KEY, c) : localStorage.removeItem(KEY); } catch (e) {} };
  async function api(path, body) {
    let r;
    try { r = await fetch(cloud + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) }); }
    catch (e) { throw new Error("Couldn't reach the server. Check your connection and try again."); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const err = new Error(j.error || "Something went wrong. Try again."); err.status = r.status; throw err; }
    return j;
  }
  self.Studio = {
    on: !!cloud,
    price: k => (cfg.prices && cfg.prices[k]) || "",
    code: get,
    api,
    /* sends the buyer to Stripe; they come back with ?paid=... */
    async buy(product) { const j = await api("/checkout", { product, code: get() || undefined }); location.href = j.url; },
    /* what this browser's code unlocks: { plus, credits }, or null with no code */
    async license() {
      if (!cloud || !get()) return null;
      try { return await api("/license", { code: get() }); }
      catch (e) { if (e.status === 404) set(""); return null; }
    },
    async useCode(code) { const j = await api("/license", { code }); set(code.trim().toUpperCase()); return j; },
    /* call on page load: finishes a purchase when the buyer returns from Stripe */
    async finishPurchase() {
      const q = new URLSearchParams(location.search), s = q.get("paid");
      if (!cloud || !s) return null;
      history.replaceState(null, "", location.pathname);
      const j = await api("/claim", { session: s });
      if (j.code) set(j.code);
      return j;
    }
  };
})();
