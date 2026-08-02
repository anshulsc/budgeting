# Vault — Budget

A self-contained, mobile-first personal budget tracker. Distributed as a single `index.html` built from `src/`, gated behind a 4-digit PIN, with optional cloud sync through the shared Asca Gym Firebase backend.

**Live:** https://anshulsc.github.io/asca-budget/

## Features
- 25th→24th financial cycle, week-wise pacing, envelope budgets with hard limits
- Item-level tracking (bought vs planned), one-tap quick-add
- Recurring/scheduled bills with amortization (e.g. a quarterly pass spread across months)
- "Safe to spend / day" and a forward savings projection (4 / 6 / 12 months)
- Auto-flagged "what to fix" insights + savings history
- Lent & borrowed IOU tracker, kept outside all budget math
- PIN lock + encrypted local storage; CSV/JSON export
- **Cloud sync** (Setup → Cloud Sync): sign in with the same account as the
  [Asca Gym app](https://anshulsc.github.io/asca-life/) and your budget syncs
  to a private `budget/{username}` node in the shared Firebase Realtime
  Database — pushed after every save, pulled and merged on unlock, so it
  follows you across devices. Every transaction and IOU is stored month-wise,
  then date by date, each under its own id
  (`data/exp/2026-08/2026-08-02/{id}`), so the full ledger is directly
  browsable in the RTDB console. Without signing in, data stays on-device only.

## Build
**Never edit the top-level `index.html` directly** — it is generated. Edit the
files in `src/` and rerun:

```bash
node build.js
```

- `src/index.html` — app markup (openable directly during development)
- `src/style.css` — all styling
- `src/firebase-sync.js` — `FB` module: Firebase Auth + Realtime Database over
  plain REST (same `asca-gym` project, API key and username→email scheme as the
  gym tracker)
- `src/app.js` — all app logic, including the sync glue (debounced push after
  save, pull + union-merge on unlock)

The `budget/` section of the shared database rules must be published for sync
to work — the **Copy database rules** button (Setup → Cloud Sync, signed in)
holds the full ruleset for the Firebase console.

## Usage
Open the URL on your phone → **Add to Home Screen**. On first launch, set a PIN, then fill in your income and budgets under **Setup**. There is no PIN recovery — forgetting it resets the app.

The published source ships with zeroed income/rent/insurance; your real figures are entered on-device. They leave your browser only if you sign in to cloud sync, and then only to your own access-controlled database node.
