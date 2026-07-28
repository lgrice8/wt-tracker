# Cable Session Tracker (Google Drive edition)

A mobile-friendly workout tracker for your A/B cable machine program. Your
weights and session history are stored as a single JSON file in a Google
Drive folder you control, so they're safely backed up to your own Drive and
never tied to any one device or browser.

## How the Drive access works (read this first)

The app authenticates as a **service account** — a robot Google identity
that is *not* your personal login. A service account has **zero access to
anything in your Drive by default**. You explicitly share one folder with
its email address (like sharing a folder with a colleague), and from that
point on it can only ever see and edit files inside that one folder —
nothing else in your Drive, ever. There's no login screen inside the app
and no OAuth consent flow to click through each time; it authenticates
silently using a key file you generate once.

---

## Step 1 — Create a Google Cloud project and enable the Drive API

1. Go to https://console.cloud.google.com and sign in with your Google
   account (free, no billing required for this).
2. Click the project dropdown at the top → **New Project**. Name it anything,
   e.g. "cable-tracker". Create it.
3. With that project selected, go to **APIs & Services → Library**, search
   for **Google Drive API**, and click **Enable**.

## Step 2 — Create a service account and download its key

1. Go to **APIs & Services → Credentials**.
2. Click **Create Credentials → Service account**.
3. Give it any name (e.g. "cable-tracker-bot"), click through the remaining
   steps with defaults, then **Done**.
4. Click on the service account you just created, go to the **Keys** tab.
5. **Add Key → Create new key → JSON** → this downloads a `.json` file.
   **Keep this file private** — it's the credential that grants access.
6. Note the service account's email address (looks like
   `cable-tracker-bot@cable-tracker-123456.iam.gserviceaccount.com`) —
   you'll need it in Step 3.

## Step 3 — Share a Drive folder with the service account

1. In your own Google Drive (drive.google.com), create a new folder —
   e.g. "Cable Tracker Data".
2. Right-click it → **Share** → paste in the service account's email from
   Step 2 → give it **Editor** access → Send/Share.
3. Open the folder and copy its **folder ID** from the URL:
   `https://drive.google.com/drive/folders/`**`THIS_PART_IS_THE_ID`**

## Step 4 — Base64-encode the key file

The JSON key needs to go into a single-line environment variable on Render,
so encode it first:

**Mac/Linux (Terminal):**
```
base64 -i path/to/your-key.json | tr -d '\n' | pbcopy
```
(that copies it straight to your clipboard on Mac; on Linux, drop `| pbcopy`
and copy the printed output instead)

**Windows (PowerShell):**
```
[Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\your-key.json")) | Set-Clipboard
```

Either way, you should end up with one long line of text copied to your
clipboard — that's what you'll paste into Render next.

## Step 5 — Push this code to GitHub

```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cable-tracker-app.git
git push -u origin main
```

## Step 6 — Deploy on Render

1. Go to https://render.com and sign up (free, no card needed).
2. **New +** → **Web Service** → connect your GitHub repo.
3. Fill in:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. Under **Environment Variables**, add two:
   - `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` → paste the long base64 string from Step 4
   - `GOOGLE_DRIVE_FOLDER_ID` → paste the folder ID from Step 3
5. **Create Web Service**. First deploy takes a couple minutes.
6. Once live, visit `https://YOUR-APP-NAME.onrender.com/api/health` in a
   browser. You should see `{"ok":true,"drive":"connected",...}`. If you
   instead see an error message, it will name exactly what's wrong (missing
   env var, bad JSON, folder not shared, etc.) — fix that and Render will
   pick up the change automatically once you push again, or just recheck
   the URL after re-saving the env var (Render redeploys on env var changes).

## Step 7 — Use it on your phone

1. Open your `*.onrender.com` URL in Safari or Chrome on your phone.
2. Share → **Add to Home Screen** for a full-screen, app-like feel.
3. Check your "Cable Tracker Data" folder in Drive afterward — you'll see a
   `cable-tracker-data.json` file appear, holding your weights and history
   in plain readable JSON. You can open it directly any time as a backup.

### One thing to expect

Render's free web services "spin down" after 15 minutes of no traffic. The
first load after a gap like that takes ~30–60 seconds while it wakes back
up. After that it's fast again for as long as you're using it.

---

## Local development (optional)

```
npm install
cp .env.example .env
# edit .env with your base64 key and folder ID
npm start
```
Then open http://localhost:3000

To sanity-check the storage logic itself (no real Google account needed —
runs against a mock):
```
node test-drive-store.js
```

## Project structure

```
server.js               Express server + API routes
driveClient.js           Builds the real Google Drive client from your service account key
driveStore.js             Read/write/find-or-create logic for the JSON data file (unit-tested)
test-drive-store.js        Logic tests using a mock Drive client — no real Google account needed
public/
  index.html               Page shell
  style.css                  Dark, gym-friendly styling
  program.js                  Your A/B exercise program data — edit here to change exercises
  app.js                       All frontend logic: rendering, steppers, rest timer, session logging
package.json
.env.example
```

## Editing your program later

To change an exercise or add/remove one, edit `public/program.js` — plain
JS, no build step. Commit and push; Render redeploys automatically.

## A note on how thoroughly this was tested

The read/write/find-or-create logic in `driveStore.js` — including the part
that prevents two near-simultaneous saves from corrupting each other — was
tested against a realistic mock of the Drive API before this was handed to
you (see `test-drive-store.js`). The credential-loading path was also
verified end-to-end with a dummy key. What could **not** be tested ahead of
time is the live connection to your real Google account, since that
requires your actual credentials and a live network path this build
environment doesn't have. That's exactly what Step 6's `/api/health` check
is for — if something's off in the Google Cloud setup steps, it'll tell you
plainly rather than failing silently.
