# Dewclaw

- `site/` — the web app, deployed by Netlify (site **dewclaw-app**) on every push to `main`.
- `worker/` — the Cloudflare Worker `dewclaw` (Stripe billing, DewclawMD, Plus), deployed by Cloudflare Workers Builds on every push. Root directory for the build: `worker`, deploy command: `npx wrangler deploy`.
- The only secret is `STRIPE_SECRET_KEY`, set in the Cloudflare dashboard.
