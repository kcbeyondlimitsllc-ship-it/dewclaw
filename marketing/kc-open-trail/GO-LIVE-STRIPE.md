# KC: Open Trail: turning Stripe on, step by step

Written 2026-11-17 for the owner. Read it on a phone; do the typing on a computer.

**Where things stand.** Nothing is live. No Stripe product exists for the game, no real Stripe or Cloudflare command has been run by the people who wrote this, and the store in the game says "Coming soon". Each step below is yours to do.

**Three things to know first**

- **Stripe is for the website version only.** The Google Play app must never open Stripe: Google's payments policy does not allow it for gems and cosmetics. The game and the worker already block it in the Play app. Google Play is its own guide: `android/kc-open-trail/README.md`.
- **Test first, with pretend money.** Stripe has a test side where no real card is charged. Parts A and B use it. Part D is real money.
- **The secret key never goes in a file.** Not in this folder, not in an email, not in a chat. You type it at a hidden prompt. Price ids (`price_...`) are different: they are public and belong in the files.

Time needed: about an hour for Parts A and B, 30 minutes for D.

You need: this project folder on a computer, Node 18 or newer (`node --version`), your Stripe login, your Cloudflare login.

---

## Part A. Make the 16 items in Stripe's test side

1. Open a terminal in the project folder (the one that holds `site`, `worker` and `tools`).
2. See the plan. This touches nothing and needs no key:
   ```
   node tools/stripe-setup-open-trail.mjs --dry-run
   ```
   You should see 16 lines, from `ot_gems_80 $0.99` to `ot_tip_3 $3.00`.
3. In the Stripe Dashboard, switch to the test side. On newer accounts this is a **Sandbox** (the account menu, top left). On older accounts it is the **Test mode** switch.
4. Still on the test side: Developers, API keys. Copy the **Secret key**. It starts with `sk_test_`.
5. Create the items:
   ```
   node tools/stripe-setup-open-trail.mjs
   ```
   It says "Paste the Stripe key". Paste and press Enter. Nothing shows as you paste; that is on purpose.
6. You should see 16 lines starting `created`, then two blocks, (a) and (b). You do not need to copy them. Step 12 writes them for you.
7. Run step 5 again. It must now say **"All 16 were already in Stripe. Nothing was created."** That proves a second run is safe.

If it says **STOPPED** and names an item: a price with that name already exists in Stripe with the wrong amount. Follow the instruction it prints. It has created nothing.

## Part B. A test worker, and a test purchase

The test worker is a separate copy of the server. Your live Dewclaw app is not touched.

8. In the terminal:
   ```
   cd worker
   npx wrangler login
   npx wrangler kv namespace create DEWCLAW --env test
   ```
   The last command prints an `id`. Open `worker/wrangler.toml`, find `OWNER_FILLS_IN_TEST_KV_ID` near the bottom, and put the id in its place. Save.
9. Deploy the test worker:
   ```
   npx wrangler deploy --env test
   ```
   It prints an address like `https://dewclaw-ot-test.<your-account>.workers.dev`. Keep it. Warnings about `PLAY_PACKAGE`, `PAYPAL_ENV` and `ai` are expected.
10. Give the test worker its two secrets. Each command asks for the value; paste it there.
    ```
    npx wrangler secret put STRIPE_SECRET_KEY --env test
    npx wrangler secret put TOKEN_SECRET --env test
    ```
    - `STRIPE_SECRET_KEY`: the same `sk_test_` key as step 4. **Never a live key here.**
    - `TOKEN_SECRET`: any long random text. Make one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
11. Go back to the project folder: `cd ..`
12. Write the test ids and the two settings into the game. Put in your own test worker address and your support contact:
    ```
    node tools/stripe-setup-open-trail.mjs --write --worker-url=https://dewclaw-ot-test.<your-account>.workers.dev --support-contact=<support email or https page>
    ```
    Paste the test key again when asked. This fills in `site/games/kc-open-trail/js/store-config.js` (`WORKER_URL`, `SUPPORT_CONTACT`, the 16 ids) and the test block of `worker/wrangler.toml`.
    - `SUPPORT_CONTACT` is shown to buyers. Use a support mailbox or a contact page, not a personal address.
    - To hold items back from sale, add for example `--hold=ot_treat_3,ot_treat_10,ot_everything,ot_tip_3`. See `MONETIZATION.md` 3.3 and section 6 (items 4 and 5) before selling the Supporter set and the four sets.
13. Deploy the test worker again so it has the ids:
    ```
    cd worker
    npx wrangler deploy --env test
    cd ..
    ```
14. Check it. Open these two addresses in a browser:
    - `<test worker address>/health` should show `"stripe":true`.
    - `<test worker address>/ot/prices` should show `"ok":true` for every item you are selling. It shows no secrets.
15. Publish the site the way you normally do (Netlify publishes the `site` folder).
    - For this short while the real game address has a **test** store. No real money can move, but do Part B and Part D in one sitting.
    - If you would rather test on a Netlify preview address, that address must be added to `ALLOWED_ORIGIN` and set as `OT_RETURN_URL` in the `[env.test.vars]` block first. Ask a developer.
16. Do the test purchases in `MONETIZATION.md` section 3.5, on a phone and on a computer. The short version:
    - Pause, Settings, turn on "Real-money shop", answer the question. Shop, Store.
    - Buy 80 gems with card `4242 4242 4242 4242`, any future date, any CVC. You come back with 80 more gems.
    - Reload. The gems are not added twice.
    - Buy a set. Write down the **Trail Key**. Restore it in another browser.
    - Press Buy, then cancel on Stripe's page. Nothing is granted.
    - Test side sends no receipt emails by itself. That is normal.
    - If a checkout fails with a message about **tax**, see Part C step 17, and fill the same tax settings in on the test side.

**Do not go on until step 16 works.** If something fails, write down the exact message and stop.

## Part C. Decisions and settings in the Stripe Dashboard (live side)

17. **Stripe Tax: decide.** The worker setting is `STRIPE_TAX`, and it is shared with Dewclaw. It is `auto` today.
    - **`auto` (keep it; recommended for a US launch).** Stripe adds tax only where you have registered to collect it, and watches your sales in other places and emails you when you come near a threshold. Costs 0.5% per sale, only where you are registered. Needs, in Settings, Tax: your head office address (Oregon) and a default product tax code. The script gives the 16 items the code `txcd_10201000` (downloaded video games), which is the one Stripe's own example uses for in-game coins.
    - **`managed`.** Stripe becomes the seller of record and files the tax everywhere. Costs 3.5% per sale on top of card fees. Worth a look later if you sell much in Europe or the UK.
    - **`off`.** No tax handling at all.
    - Ask your accountant two things: is that tax code right for gems, the sets and the $3 thank-you, and what do you owe on sales to the EU and UK. This guide cannot answer either.
18. Settings, Business, **Public details**: support email and website are filled in. They appear on receipts.
19. Settings, Business, **Customer emails**: "Successful payments" is on, so buyers get a receipt.
20. Settings, **Payment methods**: cards and wallets on. Turn **off** methods that take days to clear (bank debits such as ACH). The game hands over an item only when Stripe says "paid" straight away; a slow payment would leave the buyer waiting with nothing.
21. Know your **statement descriptor** (Settings, Business). Game purchases appear on a card statement under the account's name, the same as Dewclaw. When someone writes "what is this charge", that is why.
22. Update the business description to mention the game, so Stripe's own review is not surprised by game sales.

## Part D. Go live (real money)

23. On the **live** side of Stripe: Developers, API keys, **Create restricted key**. Give it only **Products: Write** and **Prices: Write**. Everything else "None". Copy it (`rk_live_...`). You will delete it in step 31.
24. Look before you create:
    ```
    node tools/stripe-setup-open-trail.mjs --live --dry-run
    ```
    Paste the `rk_live_` key. It should say 16 would be created. It creates nothing.
25. Create the live items and write the live ids. The live worker address is the one Dewclaw already uses (it is in `site/config.js`, the `cloud` line):
    ```
    node tools/stripe-setup-open-trail.mjs --live --write --worker-url=https://dewclaw.<your-account>.workers.dev
    ```
    Use the same `--hold=` list as in step 12 if you held items back. A live key is refused without `--live`, so a slip cannot create real products.
26. Before deploying the live worker, two checks. They only read.
    ```
    cd worker
    npx wrangler secret list --env=""
    ```
    (If wrangler does not accept `--env=""` here, run `npx wrangler secret list` without it; with no `--env` it means the live worker.)
    - `STRIPE_SECRET_KEY` must be in the list. It is your existing live key. **Leave it alone.**
    - **Do not add or change `TOKEN_SECRET` or `STRIPE_SECRET_KEY` on the live worker today.** Either change can sign out people who bought Dewclaw Plus on the web. The note in `wrangler.toml` explains why.
    - In the Cloudflare dashboard, open the `dewclaw` worker, Settings, Variables. If you see a plain (not secret) variable there that is **not** in `worker/wrangler.toml`, the deploy below keeps it only because of `--keep-vars`.
27. Run the worker's own tests, then deploy the live worker:
    ```
    node test.js
    npx wrangler deploy --env="" --keep-vars
    cd ..
    ```
    `--env=""` means "the live one, not the test one". This is the same worker Dewclaw uses. If Dewclaw misbehaves afterwards, undo with `npx wrangler rollback --env=""` (or Cloudflare dashboard, the worker, Deployments).
28. Check it:
    - `https://dewclaw.<your-account>.workers.dev/health` shows `"stripe":true`.
    - `.../ot/prices` shows `"ok":true` for every item on sale, and `"returnUrl"` ending in `/games/kc-open-trail/`.
29. Publish the site. The game now holds live ids and the live worker address.
30. **One real purchase, then refund it.** On your own phone, buy the 80 gems for $0.99 with your own card.
    - The gems arrive. A receipt email arrives. The product name on it reads well.
    - In the Stripe Dashboard (live side): Payments, open that payment, **Refund**. Stripe keeps its fee (about $0.33). Now you know where the button is.
    - Also open the Dewclaw app's Plus screen and check its prices still load.
31. Delete the `rk_live_` key from step 23 (Developers, API keys). It has done its job.

**Allowed origins, in one line.** The worker only answers the site named in `ALLOWED_ORIGIN`, and sends buyers back to `APP_ORIGIN` + `/games/kc-open-trail/`. Both are already `https://dewclaw-app.netlify.app`, which is where the game lives, so nothing changes. Only if the game moves to another domain: add that domain to `ALLOWED_ORIGIN` (comma-separated, `https://` and host only, no slash at the end) and set `OT_RETURN_URL` to the full game address.

## Part E. What to look at in Stripe after launch

- **Payments** (daily at first). Each game payment shows `sku` and `game: kc-open-trail` under Metadata.
- **Refund requests.** Refund when asked. The store promises unused gems back within 14 days. Never argue over these amounts.
- **Disputes.** A dispute costs $15 whatever happens, more than most items. Do not fight one. If Stripe shows an "early fraud warning" on a payment, refund it at once; that usually prevents the dispute.
- **Tax, thresholds.** Stripe emails the account owner when sales near a state's limit. Act on those emails.
- **After refunding a permanent item**, the Trail Key still works. To cancel it, delete the record `otkey:<KEY>` in the worker's KV storage (Cloudflare dashboard). See `MONETIZATION.md` section 4.
- "I paid and nothing arrived": ask them to open the game in the same browser, Store, "Finish adding it". If the browser's data was wiped, refund.

## Part F. Switching it all off again

Fastest first. Each one alone stops new sales. People who already paid can still collect.

1. **The whole store, in the game.** In `site/games/kc-open-trail/js/store-config.js` set `WORKER_URL` back to `'OWNER_FILLS_IN'`. Publish the site. Every item says "Coming soon" and no checkout can start.
2. **One item.** In the same file set that item's id to `'OWNER_FILLS_IN'`. Publish.
3. **On the server too.** Remove the `ot_...` pairs from the `STRIPE_PRICES` line under `[vars]` in `worker/wrangler.toml` (leave every Dewclaw and `pp_` pair), then `npx wrangler deploy --env="" --keep-vars` from the `worker` folder. The worker then refuses to sell them whatever the game says.
4. **In Stripe.** Archive the price (Product catalogue, the product, the price, Archive). The worker stops selling an archived price within about an hour.
5. **The test worker**, when you no longer need it: `npx wrangler delete --env test` from the `worker` folder.

Do **not** delete `STRIPE_SECRET_KEY` from the live worker to stop game sales. That would also stop Dewclaw Plus.

---

## What was checked, and what was not

- The script was tested against a pretend Stripe on the build machine: creating, running twice, a wrong amount, the live-key guard and `--write`. Run it yourself with `node --test tools/stripe-setup-open-trail.test.mjs`. **It has never talked to the real Stripe.** The dry run in step 24 is there so the first real contact creates nothing.
- `worker/wrangler.toml` was checked with `wrangler deploy --dry-run` for both the live and the test settings (wrangler 4.164). Nothing was deployed.
- Stripe's fees, the tax code, the Dashboard menu names and the payment-method advice come from Stripe's public pages as read on 2026-11-17. Menus move; if a name differs, search the Dashboard for it.
- Not built yet, and worth asking a developer for soon: a line naming the game on card statements, the refund sentence shown on Stripe's payment page, a server-side block on slow payment methods, and automatic handling of refunds and disputes. None of them stops a first sale.
- The privacy policy and terms pages (`site/kc-open-trail/privacy.html`, `terms.html`) have a contact line that still says `OWNER_FILLS_IN`, and they have not been read by a lawyer. Fill in the contact before step 29.
