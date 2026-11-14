# Dewclaw

- `site/` — the web app, deployed by Netlify (site **dewclaw-app**) on every push to `main`.
- `worker/` — the Cloudflare Worker `dewclaw` (Stripe billing, DewclawMD, Plus), deployed by Cloudflare Workers Builds on every push. Root directory for the build: `worker`, deploy command: `npx wrangler deploy`.
- The only secret is `STRIPE_SECRET_KEY`, set in the Cloudflare dashboard.

## Guide pages

`site/dogs/`, `site/cats/`, the calculators, `site/body-condition-score/`, `site/how-we-calculate/`, `site/for-shelters/`, `site/engine.js`, `site/sitemap.xml` and `site/robots.txt` are generated. Do not edit them by hand:

```
node tools/build-pages.mjs
```

The script cuts the care engine out of `site/index.html`, so run it again and commit the result whenever the breed data or the engine changes. The site address is the `ORIGIN` constant at the top (or `DEWCLAW_ORIGIN=https://… node tools/build-pages.mjs`); the same address is in the `<head>` of `site/index.html`.

`marketing/` holds the growth playbook, the Play listing and launch copy. It is not deployed.
