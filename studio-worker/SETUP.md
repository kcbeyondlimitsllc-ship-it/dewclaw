# Studio server setup

This turns on the two paid features. Until every step is done the apps stay in
their free state: Rainfort's Plus sounds are open to everyone and PrintProfit's
listing writer is hidden.

## 1. Stripe: create two one-time prices

In the Stripe dashboard, Product catalog → Add product:

| Product | Price | Type |
|---|---|---|
| Rainfort Plus | $9.99 | One time |
| PrintProfit listing pack (100 listings) | $5.00 | One time |

Copy each price ID (`price_...`).

## 2. Cloudflare: deploy the worker

1. Workers & Pages → Create → Import a repository → this repo.
2. Root directory `studio-worker`, deploy command `npx wrangler deploy`.
3. In `wrangler.toml`, fill in:
   - `STUDIO_PRICES` with the two price IDs
   - `APP_ORIGIN` with the studio website address (for example `https://kcbeyond.netlify.app`)
   - `ALLOWED_ORIGIN` with the same address
4. Settings → Variables and secrets → add the secret `STRIPE_SECRET_KEY`.
5. Optional: add the secret `ANTHROPIC_API_KEY` so listings are written by
   Claude. Without it the worker uses Cloudflare Workers AI, which is free
   inside Cloudflare's daily allowance.

Open the worker's address in a browser. It should show `"selling"` with both
products and `"ai"` as `claude` or `workers-ai`.

## 3. Website: point the apps at the server

In `studio/config.js`, set `cloud` to the worker's address and make the two
price lines match what you created in Stripe.

## Test before going live

Use a Stripe test-mode key and test prices first, buy each product with card
`4242 4242 4242 4242`, and check that the code unlocks on a second browser.

## Limits you can change (worker variables)

- `FREE_DAILY` (default 3): free listings per visitor per day. `0` turns free listings off.
- `DAILY_TOTAL` (default 400): listings per day across everyone. This is the cost ceiling.
- `PACK_CREDITS` (default 100): listings in one pack.
- `MODEL` (default `claude-haiku-5-5`): the Claude model used when a key is set.

## Tests

`node test.mjs` in this folder (Node 18+, no packages).
