# Vault — Budget

A self-contained, mobile-first personal budget tracker. Single `index.html`, no build step, no backend — all data lives encrypted in your browser's localStorage, gated behind a 4-digit PIN.

**Live:** https://anshulsc.github.io/asca-budget/

## Features
- 25th→24th financial cycle, week-wise pacing, envelope budgets with hard limits
- Item-level tracking (bought vs planned), one-tap quick-add
- Recurring/scheduled bills with amortization (e.g. a quarterly pass spread across months)
- "Safe to spend / day" and a forward savings projection (4 / 6 / 12 months)
- Auto-flagged "what to fix" insights + savings history
- PIN lock + encrypted local storage; CSV/JSON export

## Usage
Open the URL on your phone → **Add to Home Screen**. On first launch, set a PIN, then fill in your income and budgets under **Setup**. There is no PIN recovery — forgetting it resets the app.

The published source ships with zeroed income/rent/insurance; your real figures are entered on-device and never leave your browser.
