# KC: Open Trail store: what the owner has to do

**Nothing is live.** No Stripe product exists for this game, the store settings in the game are placeholders, and the worker changes have not been deployed. In the game as it stands today every store item says "Coming soon", no payment can be started, and the game sends nothing to any server. Nothing in this folder turns that on by itself. Each step below is something only the owner can do.

Written 2026-11-16. The design this follows is `MONETIZATION-EXPANSION-SPEC.md`, sections 4 and 6.

---

## 1. What has been built

| Piece | Where | State |
|---|---|---|
| Store screen, purchase journal, restore, device limit, Trail Journal | `site/games/kc-open-trail/js/store.js`, `css/store.css` | Built and tested with a pretend payment server. Not connected to Stripe. |
| Store settings (worker address, price ids, support contact) | `site/games/kc-open-trail/js/store-config.js` | Placeholders (`OWNER_FILLS_IN`). You fill these in. |
| Server side: the 16 items, what each grants, price checks, Trail Key | `worker/dewclaw-worker.js` | Written and tested with Stripe faked. **Not deployed.** |
| Tests | `worker/test.js`, `site/games/kc-open-trail/tests/store.test.js` | Pass on the build machine. No real Stripe call has ever been made. |

How the store behaves, in short:

- The real-money shop is **off** on every device until a grown-up turns it on in Settings, by answering a times-table question. While it is off the Store tab shows one line, "Ask a grown-up to turn on the shop", and no price or sales text appears anywhere in the game.
- The times-table question is asked again to open the store, again before each purchase, and before restore or changing the limit. It is a deterrent for a child. It is not proof of age and must never be described as parental verification.
- Buying takes two steps: Buy, then a screen showing the dollar price and the exact contents, then Stripe's own payment page.
- The dollar price is on every card, every Buy button and the confirm screen.
- A device limit of $50 in any 30 days (a grown-up can pick $10, $25, $50 or $100). The screen says it is a limit in the game, not at the bank.
- A purchase journal lists every purchase and restore made on that device.
- Money buys gems, cosmetics and a thank-you. It never buys bones, stats or boosts. If the server ever sent a grant containing bones, the game refuses the whole grant.
- Nothing is random, nothing has a timer, and there is no "best value" or "was" price.

---

## 2. The 16 items, and what you keep

Stripe's standard US online card fee is 2.9% + $0.30 per payment (stripe.com/pricing, read 2026-11-16). Check the current rate before you rely on these figures. International cards cost about 1.5% more and currency conversion about 1% more. Sales tax and the Stripe Tax fee (0.5% where it applies) are **not** included.

| Item id (SKU) | Price | Kind | What the buyer gets | Stripe fee | You keep | Share kept |
|---|---|---|---|---|---|---|
| `ot_gems_80` | $0.99 | used up | 80 gems | $0.33 | $0.66 | 67% |
| `ot_gems_500` | $4.99 | used up | 500 gems | $0.44 | $4.55 | 91% |
| `ot_gems_1200` | $9.99 | used up | 1,200 gems | $0.59 | $9.40 | 94% |
| `ot_gems_2600` | $19.99 | used up | 2,600 gems | $0.88 | $19.11 | 96% |
| `ot_gems_7000` | $49.99 | used up | 7,000 gems | $1.75 | $48.24 | 96% |
| `ot_starter` | $4.99 | once per device | 400 gems and the First Trail set: bandana, tag, Sunbeam trail, skateboard paint | $0.44 | $4.55 | 91% |
| `ot_trail_pass` | $5.99 | permanent | The second column of the Trail Journal: 15 cosmetics and 300 gems, paid out as steps are reached. Never expires. | $0.47 | $5.52 | 92% |
| `ot_pack_forest` | $3.99 | permanent | Whispering Firs set, 8 listed items | $0.42 | $3.57 | 89% |
| `ot_pack_galaxy` | $3.99 | permanent | Night Sky set, 8 listed items | $0.42 | $3.57 | 89% |
| `ot_pack_roadtrip` | $3.99 | permanent | Open Road set, 8 listed items | $0.42 | $3.57 | 89% |
| `ot_pack_halloween` | $3.99 | permanent, sold all year | Spooky Hollow set, 8 listed items | $0.42 | $3.57 | 89% |
| `ot_treat_3` | $1.99 | used up | 3 Party Treats (cosmetic, no stats) | $0.36 | $1.63 | 82% |
| `ot_treat_10` | $4.99 | used up | 10 Party Treats | $0.44 | $4.55 | 91% |
| `ot_supporter` | $9.99 | permanent | 600 gems and the Supporter set: tag, bandana, gold den trim, photo frame. No boost. | $0.59 | $9.40 | 94% |
| `ot_everything` | $24.99 | permanent | The four sets, the Trail Journal pass and the Supporter set with its 600 gems | $1.02 | $23.97 | 96% |
| `ot_tip_3` | $3.00 | repeatable | A "Good Human" tag the first time. Nothing else. | $0.39 | $2.61 | 87% |

On the $0.99 pack a third of the money goes to Stripe. Decide whether to keep it as an exact top-up or leave it unpriced (see step 3.3). If you drop it, tell the developer: every "about $X" label in the game is worked out from that pack's rate.

The worker refuses to sell or grant an item whose Stripe price is not exactly the amount above, in US dollars, one-time. So the prices in this table are fixed in three places that must agree: this table, `OT_PRICES` in the worker, and `CATALOG` in `js/store.js`. Changing a price means changing all three and re-running the tests.

---

## 3. Steps, in order

### 3.1 Create the 16 products in Stripe (test mode first)

1. Sign in to the Stripe Dashboard. Switch to **test mode** (the toggle at the top). Do everything in test mode first.
2. For each row in the table: Product catalogue, Add product.
   - Name: something a buyer will recognise on a receipt, for example "KC: Open Trail, 500 gems".
   - Price: the exact amount in the table, **USD**, **one-off** (not recurring).
   - Tax code, if you use Stripe Tax: a digital-goods code. Ask your accountant which one fits in-game items.
3. Open each product's price and copy its id. It starts with `price_`. You will have 16 of them.
4. Keep a private note of which id belongs to which SKU. Test-mode ids and live-mode ids are different: you will do this twice.

### 3.2 Put the ids in two places

**The worker** (it decides what is charged). In `worker/wrangler.toml` the `STRIPE_PRICES` line is one JSON object. Add the 16 pairs to it, for example `"ot_gems_80":"price_..."`, and leave the Dewclaw Plus and Pocket Pup entries exactly as they are. Price ids are not secret.

**The game** (it decides which Buy buttons are switched on). In `site/games/kc-open-trail/js/store-config.js`:

- `WORKER_URL`: the https address of the deployed worker, no slash at the end.
- `STRIPE_PRICE_IDS`: the same 16 ids.
- `SUPPORT_CONTACT`: where a grown-up asks for a refund. Use a support mailbox or a contact page, not a personal address.

Never put the Stripe **secret key** (`sk_...`) in either file or anywhere in the repository. It goes into Cloudflare only (step 3.4).

### 3.3 Holding an item back

An item whose id is left as `OWNER_FILLS_IN` in `store-config.js` shows "Coming soon" and cannot be bought. An item with no id in the worker's `STRIPE_PRICES` cannot be sold even if the game asks. Use this to launch with fewer items. The spec suggests leaving `ot_treat_3`, `ot_treat_10`, `ot_everything` and `ot_tip_3` for later.

### 3.4 Deploy the worker

The worker changes add the game's items next to Dewclaw Plus and Pocket Pup. The existing flows were left as they were and their tests still pass, but this is the same worker your live app uses, so deploy with care.

1. Safest: deploy a **separate test copy** first, with its own name and the Stripe **test** secret key, so the live app is not touched. From the `worker` folder, something like `npx wrangler deploy --name dewclaw-ot-test`, then set its secret with `npx wrangler secret put STRIPE_SECRET_KEY --name dewclaw-ot-test`. I have not run these commands; check them against Cloudflare's current documentation.
2. Settings the game needs on the worker:
   - `STRIPE_PRICES`: now includes the 16 `ot_` ids.
   - `ALLOWED_ORIGIN`: must include the site the game is served from. It is a comma-separated list.
   - `OT_RETURN_URL`: the full https address of the game folder, ending in `/games/kc-open-trail/`. If the game is served from the same site as the Dewclaw app you can leave it unset: it defaults to `APP_ORIGIN` plus `/games/kc-open-trail/`.
   - `STRIPE_TAX`: already `auto`. That needs Stripe Tax set up in the Dashboard (origin address, default tax code).
3. Open `https://<your worker>/ot/prices` in a browser. It lists all 16 SKUs and says, for each, whether a price id is configured and whether Stripe's amount matches. Every item you intend to sell must show `"ok": true`. It shows no secrets.

### 3.5 Test with Stripe test mode

Do this on a phone and on a computer.

1. Publish the game with the test worker's address and the test price ids in `store-config.js`, to a preview address if you can.
2. In the game: Pause, Settings, turn on "Real-money shop", answer the question. Open Shop, Store.
3. Buy the 80-gem pack with Stripe's test card `4242 4242 4242 4242`, any future date, any CVC. You should come back to the game, see a thank-you screen, 80 more gems, and one line in the purchase journal.
4. Reload the page. The gems must not be added twice.
5. Buy a permanent item (a set). You should be shown a **Trail Key**. Write it down.
6. Open the game in a different browser, turn the shop on, Store, Restore purchases, type the Trail Key. The set should appear. Gems must not.
7. Copy the return address from step 3 (with `?cs=...` in it) into the other browser. Nothing should be granted there.
8. Press Buy, then cancel on Stripe's page. Nothing should be granted and the game should say nothing was charged.
9. Try a declined card (`4000 0000 0000 0002`). Nothing should be granted.
10. Check the receipt email Stripe sends, and the product name on it.
11. **Home-screen app on an iPhone.** Install the game to the home screen and buy from there. On some iOS versions a home-screen app and Safari keep separate storage. If Stripe returns you to Safari instead of the app, the purchase lands in a browser that did not start it and the game will refuse it. This has not been tested on a real device. If it happens, tell the developer before going live.
12. Refund one test payment in the Stripe Dashboard so you know where the button is.

Only when all of that works: repeat 3.1 in **live mode**, put the live ids in both places, set the live secret key on the live worker, and deploy.

### 3.6 Running the automated tests

- `node worker/test.js` runs the worker tests with Stripe faked: every SKU, replays, unknown SKUs, tampered amounts, the device check and the Trail Key.
- From `site/games/kc-open-trail`: `NODE_PATH=$(npm root -g) node tests/store.test.js` runs the game in a real browser, including one section against the real worker code with Stripe faked.
- A developer can try the whole store without Stripe by opening the game with `?debug=1&mock=1` at the end of the address. The screen then says "TEST MODE" and no money moves. This mode exists only when the game is served from a developer's own machine (`localhost` or `127.0.0.1`); on the live site the two words do nothing, so a player cannot reach it.

---

## 4. Refunds and disputes

There is no automatic link between Stripe and a player's save. Refunds are done by hand in the Stripe Dashboard.

- The store screen promises: **unused gems are refunded on request within 14 days of purchase.** The game has no server-side balance, so you cannot check whether the gems were used. In practice you take the buyer's word. Decide whether you are comfortable with that; for these amounts it is usually cheaper than arguing.
- **Currency.** The worker asks Stripe to charge in US dollars only (`adaptive_pricing[enabled]=false` on the checkout) and the claim accepts nothing but the catalogue price in US dollars. This was tested against a pretend Stripe, not the real one: before opening the store, make one real test-mode purchase from a non-US card or address and check that the item arrives. If Stripe still shows a local-currency price, also turn Adaptive Pricing off in the Stripe dashboard.
- **A payment whose return link opens somewhere else** (another browser, a private window, an in-app browser): nothing is added there. The game that started the payment has written the payment's id down, so the grown-up opens the game where Pay was pressed, then Store, "Finish adding it". If that browser's data was wiped in between, the item cannot be added by the game: refund the payment in Stripe.
- **Trail Keys cannot be switched off from the game.** A key works on any number of devices. After a refund or a leaked key, delete the record `otkey:<KEY>` in the worker's KV store by hand; devices that already restored keep their items.
- **Two requests at the same moment.** Cloudflare KV has no transactions. The worker now handles claims of one payment, and restore tries from one address, one at a time inside a running copy of itself, and a Trail Key is worked out from the payment (not drawn at random), so a double claim gives one key. Two separate copies of the worker could still each count a restore try; the 20-a-day limit is a brake, not a wall.
- A refund does not remove anything from the game. That is deliberate: **never lock or damage a save over a refund or a dispute.** The store screen says so.
- To find a payment, ask for the email address used on Stripe's page, or the date and amount from the game's purchase journal.
- Because the save lives on the device, a determined person can edit it and give themselves gems. Nothing of real value can be taken that way; do not build anything on the assumption that a gem balance is trustworthy.

---

## 5. Wording a lawyer should check before launch

I am not a lawyer and none of this is legal advice. These are the sentences the store shows today and the questions to put to someone qualified.

**Refunds, as shown in the store**

> Refunds: unused gems are refunded on request within 14 days of purchase.
> A save is never locked over a refund or a payment dispute.

Ask: is this enough for the EU and UK 14-day right to withdraw from a digital purchase, and does the buyer need to tick anything to start using gems straight away? What should be offered for permanent items and for the tip? Does the confirm screen need a link to full terms?

**Privacy, as shown in the store**

> Payments are taken by Stripe on its own page. The game never sees a card number, a name or an email address.
> Privacy: the game has no accounts, no adverts and no tracking. When a grown-up pays or restores, the game sends the item chosen, a random install number made on this device, and the Trail Key if there is one. Nothing else is sent, and nothing is sent at any other time.

What the server actually keeps, so the lawyer can judge:

- For each purchase: a record filed under a scrambled form of Stripe's checkout id, holding the item, the time, and a scrambled form of the install number. Kept about 400 days.
- For each Trail Key: the list of permanent items bought with it. Kept until deleted.
- For restore attempts: a counter per day filed under a scrambled form of the visitor's internet address, to stop people guessing keys. Kept two days. A scrambled address may still count as personal data in the EU and UK.
- Stripe keeps the card details, name, email and billing address under its own terms.

Ask: does this keep the game outside the children's privacy consent rules in the US (COPPA), given that a grown-up makes the purchase? Does the game need a published privacy notice and a named contact? Is anything further needed for the EU and UK?

**The grown-up question**

> Please ask a grown-up to answer: what is 9 × 7?

Ask: is a deterrent of this kind acceptable for a game children play, in the places you sell? It must never be called verification.

**Other things to raise**

- Selling a paid in-game currency to households with children, in the EU, the UK and US states with their own rules. The EU proposal reported on 10 and 11 November 2026 would restrict it for minors; it is not law yet and I have not read the official text.
- Sales tax and VAT on digital goods, and whether Stripe Tax "auto" covers what you owe.
- Whether the tip needs any wording about not being a charitable donation.

---

## 6. What still needs doing or deciding

1. Everything in section 3. Until then nothing can be bought.
2. A real support contact for `SUPPORT_CONTACT`. Until it is filled in, the store says the contact will be listed before the store opens.
3. The iPhone home-screen test in step 3.5 (11).
4. "Gold trim for the den" is granted as an owned item, but nothing in the game draws it yet. Either the den feature shows it or the Supporter set's description should drop it before sale.
5. The den lamps and signs in the four sets appear only if the den feature lists them. Check each set in the game before selling it.
6. Stripe promotion codes are switched off for game items, because a 100%-off code would fail the worker's amount check. Say so if you want coupons and the check can be reworked.
7. Gift codes, a membership and a gem allowance are not built. The spec explains why.
