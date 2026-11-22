# Ship Android builds to Google Play from GitHub

Once the one-time setup below is done, a new build of **Dewclaw** or **KC: Open Trail**
goes to Play Console with a few taps on GitHub. You never upload an `.aab` by hand again.

The workflow is `.github/workflows/android-play.yml` ("Android Play upload").
A second workflow, "Android build check", builds both apps with a throwaway key on
every change, to catch a broken build before you need it. It uses no secrets and
uploads nothing.

---

## One-time setup

About 20 minutes. Steps 1–3 happen in Google Cloud, step 4 in Play Console,
step 5 on GitHub.

### 1. A Google Cloud project

1. Open **console.cloud.google.com**. Sign in with the account that owns the Play
   developer account.
2. Pick an existing project in the top bar, or make one:
   **console.cloud.google.com/projectcreate**. Any name works, for example `play-uploads`.

### 2. Switch on the Play API

1. Open **console.developers.google.com/apis/api/androidpublisher.googleapis.com**.
   Check that your project is the one selected in the top bar.
2. Press **Enable**.

### 3. A service account and its key

A service account is a robot user. GitHub signs in as it.

1. **IAM & Admin → Service accounts → Create service account**.
2. Name: `github-play-upload`. Press **Create and continue**.
3. **Roles: leave empty.** It needs no Cloud roles. Press **Done**.
4. Copy its email address. It looks like
   `github-play-upload@<project>.iam.gserviceaccount.com`.
5. Open it → **Keys → Add key → Create new key → JSON → Create**. A `.json` file
   downloads. **It downloads only once.** Treat it like a password.

> **"Key creation is disabled"?** Google Cloud organizations created since May 2024
> block JSON keys by default. A personal Gmail project without an organization is
> usually not blocked. If you are blocked, tell Claude. There is a keyless
> option ("Workload Identity Federation") that needs about 6 more Cloud steps and
> a small change to the workflow.

### 4. Invite the robot into Play Console

1. **Play Console → Users and permissions → Invite new users**.
2. Email: the service account email from step 3.
3. Leave **Account permissions** empty (no admin).
4. Under **App permissions → Add app**, add **Dewclaw** and **KC: Open Trail**.
5. For each app, tick only these two:
   - **Release apps to testing tracks** (internal, closed, open testing)
   - **View app information (read-only)**
6. Do **not** tick "Release to production…". The robot then cannot ship to everyone
   by mistake. Want the `production` choice in the workflow to work later? Add
   that permission then.
7. Press **Invite user**. A robot account does not need to accept the invite.

Older guides say to link the Cloud project on a Play Console "API access" page.
Google's current setup guide has no such step, and the page seems to be gone. If
your Console still shows it, linking the project there does no harm.

### 5. GitHub secrets

On GitHub: **repository → Settings → Secrets and variables → Actions →
New repository secret**. Add 9 secrets:

| Secret name | What to paste |
|---|---|
| `PLAY_SERVICE_ACCOUNT_JSON` | The whole `.json` file from step 3 (open it in a text editor, copy all) |
| `DEWCLAW_KEYSTORE_B64` | from `release-upload/github-secrets/` |
| `DEWCLAW_KEYSTORE_PASSWORD` | 〃 |
| `DEWCLAW_KEY_ALIAS` | 〃 |
| `DEWCLAW_KEY_PASSWORD` | 〃 |
| `KCOPENTRAIL_KEYSTORE_B64` | 〃 |
| `KCOPENTRAIL_KEYSTORE_PASSWORD` | 〃 |
| `KCOPENTRAIL_KEY_ALIAS` | 〃 |
| `KCOPENTRAIL_KEY_PASSWORD` | 〃 |

The folder `release-upload/github-secrets/` on the computer where the apps were
built has one file per secret, named exactly like the secret, and a `README.txt`.
Paste each file's whole content. **Delete that folder when you are done.** The
originals stay in `release-upload/keys-KEEP-PRIVATE/`.

Afterwards you can delete the downloaded `.json` file too. If you ever need a new
one, make a new key in step 3 and delete the old key there.

**Optional, a second check before each upload:** Settings → Environments → `play`
(it appears after the first run, or create it) → **Required reviewers** → add
yourself. Every upload then waits for your **Approve** tap.

### 6. KC: Open Trail: the first upload is by hand

Google's API can only update an app that already has one bundle in Play Console.
For a brand-new app the API answers "Package not found". So:

1. Upload `kc-open-trail-1.0.0-1.aab` by hand in Play Console (Test and release →
   Internal testing → Create new release), as you are doing now.
2. Press **Roll out** on that release once.

Until an app has had one release rolled out on any track, Google accepts only
**draft** releases from the API. The workflow sees this and sends a draft, which you
then roll out in Console. After the first roll-out, uploads go out by themselves.
Dewclaw is already in open testing, so its uploads go out straight away.

---

## How to ship a build

1. GitHub → **Actions** → **Android Play upload** → **Run workflow**.
2. Pick:
   - **app**: `dewclaw` or `kc-open-trail`
   - **track**: `internal` (default; testers get it within minutes), `alpha`
     (closed testing), `beta` (open testing), `production` (needs the extra
     permission from step 4)
   - **release notes** (optional, English, up to 500 characters)
   - leave the rest empty
3. Press the green **Run workflow**. It takes about 5–8 minutes.
4. A green tick means Play has the build. Check it in Play Console under that track.

### What version it gets

- **Version code** (the number Play checks): the highest code Play already has for
  the app, on any track or in any uploaded bundle, **plus 1**. You never edit it.
  To force a number, type it in **version_code**. It must be above what Play has.
- **Version name** (what people see, like `1.0.1`): `appVersionName` in the app's
  `twa-manifest.json`, unless you type one in **version_name**. Raise it in
  `twa-manifest.json` when you want people to see a new number.

### What the workflow does

1. Asks Play for the highest version code and whether the app was ever rolled out.
   This is read-only and changes nothing on Play.
2. Builds the app from this repo (`android/<app>/build.sh`).
3. Signs it with the upload key from the secrets. The key file is deleted at the
   end, even if a step fails.
4. Checks the bundle before uploading: package name, version, target SDK 36, the
   billing permission with DelegationService switched on, no advertising ID, no
   permissions the app should not have. It also checks that the signing key's
   SHA-256 is the app's real upload key (listed in `android/play-apps.json`). If any
   check fails, nothing is uploaded.
5. Keeps the `.aab` as a download on the run page (**Artifacts**, 30 days). The repo
   is public, so anyone signed in to GitHub can download it. It holds no secrets.
   It is the same app people get from Play.
6. Uploads to the track you picked: status **completed** (out to that track's
   testers), or **draft** while the app has never been rolled out.

---

## If it fails

Open the red run → the red step → copy the log, or **⋯ → Download log archive**.
Send it to Claude. The log never contains passwords or keys.

| What the log says | What to do |
|---|---|
| `PLAY_SERVICE_ACCOUNT_JSON is not set` | Add that secret (setup step 5). |
| `Google sign-in for the service account failed` | The JSON secret is incomplete. Paste the whole file again. |
| `403` / `The caller does not have permission` | Step 4: invite the service account and give it both apps. The invite can take a few minutes to start working. |
| `Package not found` / `404` | The app has no bundle in Play Console yet. Upload the first one by hand (step 6). |
| `Only releases with status draft may be created on draft app` | Roll out one release in Console first, or run with status `draft`. |
| `could not open the keystore` | A keystore secret is wrong. Paste it again from `github-secrets`. |
| `signed with …, but this app's upload key is …` | The wrong key is in the secrets for this app. Check the app's `…_KEYSTORE_B64` secret. |
| `Version code … has already been used` | Run again. If it repeats, type a higher number in **version_code**. |
| `targetSdkVersion` | Google raised the required Android version. Tell Claude. |

## Without GitHub (fallback)

Every app folder can still be built by hand with `build.sh` (see that app's
`README.md`) and uploaded in Play Console.

---

## Not tested yet

There are no Google credentials yet, so nobody has run the upload step against
the real Play API. The build, the checks, the key handling and the version-code
logic are tested: the "Android build check" workflow and `node --test tools/play/`
run them against a mocked Play. The first real run will show whether Play accepts
the upload. If it does not, send Claude the log.
