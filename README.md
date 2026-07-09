# IMFine — Test PWA

A daily check-in app for people living alone. One tap a day; if a check-in is
missed, an escalating rescue chain alerts the person's Guardians.

This is the **test build**. It runs entirely on the phone (no accounts, no server,
no keys) so you can feel the whole experience and install it to your home screen.
Real cross-device linking and real WhatsApp/SMS/email come in Phase 2 (Supabase +
Twilio + Stripe).

---

## What's in this folder

- `index.html` — the whole app (all screens + logic).
- `manifest.webmanifest` — makes it installable to the home screen.
- `sw.js` — service worker for offline use.
- `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — app icons.

---

## Option A — Test it in 2 minutes on your computer

1. Double-click `index.html`. It opens in your browser and works immediately.
   (Note: on `file://` the install prompt and offline mode won't appear — that
   needs a real web address, see Option B. The app itself still works.)

## Option B — Put it on your phone (recommended) via Vercel (free)

You do NOT need to be a developer. Two ways:

### B1. Drag-and-drop (easiest)
1. Go to https://vercel.com and click **Sign Up** (use "Continue with GitHub" or email).
2. On your dashboard, click **Add New… → Project**.
3. Choose the option to **deploy a folder / upload** (Vercel also accepts drag-and-drop
   of this folder in the deploy screen).
4. Drag this entire `imfine-pwa` folder in. Click **Deploy**.
5. After ~30 seconds you get a live web address like `https://imfine-xxxx.vercel.app`.

### B2. Via GitHub (better for updates)
1. Create a free account at https://github.com.
2. Click **New repository**, name it `imfine-pwa`, keep it **Public**, click **Create**.
3. On the repo page, click **uploading an existing file**, then drag in ALL the files
   from this folder. Click **Commit changes**.
4. Go to https://vercel.com → **Add New… → Project** → **Import** your `imfine-pwa` repo → **Deploy**.
5. You get a live address. Any time you re-upload files to GitHub, Vercel auto-updates.

### Install it on the phone
- Open the Vercel web address in your phone's browser.
- **iPhone (Safari):** tap the Share icon → **Add to Home Screen**.
- **Android (Chrome):** tap the ⋮ menu → **Install app** / **Add to Home Screen**.
- IMFine now behaves like a normal app with its own icon.

---

## How to test the full experience

1. Open the app → **"I'm checking in"** → enter a name and time → **Continue**.
2. Tap the big **I'm OK** button — you're checked in.
3. Tap **Add a Guardian**, enter any name + email → a 6-digit code appears.
4. Tap the ⚙️ gear (bottom-right) → **Switch role / Welcome** → choose **I'm a Guardian**.
5. Enter the code shown → you're now looking at the Guardian's dashboard.
6. Tap ⚙️ → **Simulate a missed check-in** and watch the rescue chain run and the
   Guardian get alerted with a location. Use the ⚙️ Free/Premium buttons to see
   how the alert channel changes (Email on Free, WhatsApp + Voice on Premium).

> The ⚙️ "Testing tools" panel is only for this phase and will be removed before launch.

---

## Phase 2 (when you're ready to make it real)

To have two different phones actually linked and to send real messages, we add:
- **Supabase** — the shared database + login + the server-side rescue clock.
- **WhatsApp (via Twilio)** — real Guardian alerts (no SMS sender registration needed).
- **Stripe** — the SGD 2.99 / month and SGD 24.99 / year subscriptions.

Each of those is a free account to create; I'll give you a numbered, click-by-click
guide and the code changes when you decide to proceed.
