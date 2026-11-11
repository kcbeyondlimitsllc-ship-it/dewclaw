# KCBeyond AI studio

Standalone apps, separate from Dewclaw. Nothing here is deployed by the Dewclaw
Netlify site (it publishes `site/` only).

- `index.html` — studio home page linking to each app
- `kc-dash/` — KC Trail Dash, an original running game
- `rainfort/` — Pacific Northwest sleep and focus sounds
- `print-profit/` — print-on-demand profit calculator

Each app is one HTML file with no build step and no server.

## Put it online

In Netlify: Add new site → Import this repository → Base directory `studio`,
Publish directory `studio`, no build command.

## Settings

- `kc-dash/index.html`, `CFG` at the top of the script: KC's coat colours
  (placeholder), the YouTube link, and `storeLive` (set to `true` to show the
  KC gear button once the store is back online).
- `print-profit/index.html`, `PRESETS`: the starting fee rates.
