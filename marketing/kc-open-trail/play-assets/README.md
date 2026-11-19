# Play Store graphics for KC: Open Trail

Made 2026-11-17 by running the real game (as the Play app, `?src=play`) in headless Chromium with Playwright. Where each file goes in Play Console is in `../play-store-listing.md`, section 2.

| File or folder | Size | What it is |
|---|---|---|
| `icon-512.png` | 512 x 512, 32-bit PNG | Store icon. A copy of the app's own icon, `site/games/kc-open-trail/icons/maskable-512.png` (made by the game's `tools/make-icons.js`), so the store and the home screen match. |
| `feature-graphic-1024x500.png` | 1024 x 500, 24-bit PNG, no alpha | One real frame of the game (KC at Cathedral Park, St. Johns Bridge behind) with the title and a dark fade added. No buttons, badges or pretend screens. |
| `phone-portrait/` | 1080 x 1920 | 8 phone screenshots |
| `phone-landscape/` | 1920 x 1080 | 7 phone screenshots (16:9) |
| `tablet-7/` | 1920 x 1200 | 4 screenshots at a 7-inch tablet's layout (optional in Play Console) |
| `tablet-10/` | 1920 x 1200 | 4 screenshots at a 10-inch tablet's layout (optional in Play Console) |
| `source/` | | The scripts and the page that made them. Not for upload. |

## What is real and what was arranged

- Every screenshot is the game's own picture with its own HUD and touch buttons, at a phone or tablet screen size. Nothing was painted on afterwards.
- The script places KC, sets the time of day, hops on a ride, starts a job, opens the Shop or turns the festival on, using the game's debug hooks (`?debug=1`, which draw nothing on screen).
- Before each picture the two first steps of a new save are completed, so the pictures show the game as it looks after the first few minutes.
- Passing notices (the place-name banner, toasts, the first-run "drag here" tip) are hidden, as if they had timed out.
- The 3D picture is rendered at the full size of the screenshot. On a real phone the game caps sharpness for speed, so a real phone looks slightly softer.
- KC's hat and bandana in `skate` and `dressed` are bones-only items from the in-game tailor. Nothing from a paid set appears in any picture.
- No picture shows a dollar price, a store tab or a checkout. The script checks this and fails if it finds one.
- Frame rate cannot be judged from these: headless Chromium draws in software.

## Make them again

```sh
cd site/games/kc-open-trail && python3 -m http.server 8931          # leave running
# in another terminal, from the repo root:
NODE_PATH=$(npm root -g) node marketing/kc-open-trail/play-assets/source/capture.js                       # all sets, about 10 minutes
NODE_PATH=$(npm root -g) node marketing/kc-open-trail/play-assets/source/capture.js phone-portrait canoe  # one picture
NODE_PATH=$(npm root -g) node marketing/kc-open-trail/play-assets/source/make-feature.js                  # the feature graphic
```

`capture.js` prints `ok` for each picture and exits with an error if the game logged an error, was not in the Play channel, or showed a dollar price. Look at every picture afterwards all the same: people and animals walk about, so a passer-by can end up in front of the camera.

The feature graphic's backdrop (`source/feature-backdrop-2720x1000.png`) was taken once by hand with the HUD hidden; `make-feature.js` only lays the title over it.

## Known rough edges (in the game, not fixed here)

- On phones held upright the touch buttons cover the lower right of the view, so KC is partly behind them in some portrait pictures. That is how the game looks on a phone.
- At some sizes between a phone and a small tablet (about 540 px wide, upright) the "go here" chip sits under the top-right buttons. The sizes used here do not show it.
