# FlowMoney — private personal finance, installable on your phone

FlowMoney is a static web app (PWA). It runs entirely in your browser and keeps your data **on the device you use it on**.
Host it free on Vercel, open the link on your phone, and install it to the home screen.

## How it works (read this once)
- **No server holds your data.** Vercel/GitHub only serve the app's code (HTML/JS/CSS). Your salary, transactions and loans live in an
  on-device SQLite database (WebAssembly) saved in your browser's IndexedDB. Nothing is uploaded, there is no analytics, and the app makes no network requests for your data.
- **Each device has its own data.** Your phone and computer do **not** sync. Move data with *Settings → Export backup* on one device and *Restore from backup* on the other.
- **Phone layout only on phones.** A compact layout (bottom tab bar, bottom-sheet forms, card lists) applies only on phones. Desktop and tablet look exactly as before.
  The phone layer is scoped to `html[data-phone]` and was pixel-diffed against the previous desktop/tablet rendering (identical).
- The finance logic lives in `server/src/{services,validators,seed,utils}` and is shared: the browser app imports it directly, and the Node tests exercise the same code.

## Run on your computer
```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 34 tests of the shared finance + backup logic
npm run build        # production build in client/dist
npm run preview      # serve the production build locally (this is where PWA install can be tried)
```
Needs Node 20+ (22 LTS recommended). `better-sqlite3` is now **optional** and only used by the tests and the export script, so a failed native build no longer blocks the app.

## Bring your existing desktop data over (one time)
The old version stored data in `data/flowmoney.sqlite`. The new version stores it in the browser, so it is not picked up automatically:
1. From the project folder: `npm run export-data` → writes `flowmoney-backup-YYYY-MM-DD.json`.
2. Open the new app → **Settings → Restore from backup…** → choose that file → confirm.
3. To get it onto your phone: send the file to the phone (cloud drive / email to yourself / USB), open the installed app → Settings → Restore from backup.
The file contains your financial data in plain text — delete it from shared places afterwards.

## Put it on GitHub and Vercel
1. Create a GitHub repository and push this folder (commit `package-lock.json`; `data/` and backups are git-ignored — never commit a backup file).
   ```bash
   git init && git add . && git commit -m "FlowMoney"
   git branch -M main && git remote add origin https://github.com/<you>/flowmoney.git && git push -u origin main
   ```
2. On vercel.com: **Add New → Project →** import the repo. Leave **Root Directory** as the repo root. `vercel.json` already sets the build command (`npm run build`) and output (`client/dist`). Click **Deploy**.
3. Open the Vercel URL on your phone (it is HTTPS, which installing requires).
   - **Android / Chrome:** menu → *Install app* (or *Settings → Install on this device* inside FlowMoney).
   - **iPhone / Safari:** Share → *Add to Home Screen*. Do this: installed apps are exempt from Safari's storage clearing.
4. Every push to `main` redeploys. Updates reach installed phones the next time the app opens; your data is untouched.
`.github/workflows/ci.yml` runs the tests and a build on every push (optional).

Note: a Vercel URL is public. Anyone opening it sees an empty app with *their own* local data — never yours — but don't share the link if you'd rather keep the app itself private.

## Privacy, accurately
- Data is stored in this browser's IndexedDB. Clearing site data, "Erase all data", or an uninstalled/evicted browser profile removes it. **Export backups regularly.**
- Backups are plain JSON (not encrypted). Anyone with the file can read it.
- Anyone with your unlocked phone/browser profile can open the app. There is no passcode inside the app.
- The only requests the app makes are loading its own files from the site it's hosted on.
- Two tabs open at once: the last one to save wins (other tabs refresh automatically). Use one tab at a time.

## What's built
Dashboard (salary, spent, saved, **remaining**, Loan/EMI, Saving, **Necessary expenses**, Misc, year heatmap with month-end sums), transactions with running "left after" balance,
loans with EMI/prepayment tracking, profile and salary history, savings goal, **Reports** (year/month charts, month-end totals table, comparisons, loans),
**Settings** (install, storage status, backup export, validated restore with preview and an automatic safety copy, guarded erase, demo data), offline support, phone layout.

## Not built yet
Excel/CSV savings import and its undo, budgets, recurring transactions, CSV export, category management, light theme/currency options, savings accounts UI, app passcode, encrypted backups.

## Verification status — what was actually run
- **34 tests pass** (financial rules, remaining/running balance, month-end status, reports, backup round-trip/validation/rollback, reset, UUIDs). They also pass when run through the real browser-database adapter code (against a stand-in for sql.js).
- **Rendering:** your real components were rendered with demo data and screenshotted in Chromium at phone (390×844), tablet (820) and desktop (1440) sizes. Desktop and tablet are **pixel-identical** with and without the phone layer. A bug found this way (bottom sheet hidden behind the tab bar) was fixed.
- **Not verified here (no network, no real phone):** `npm install` with the new packages, a real `vite build`, the actual sql.js WebAssembly engine, IndexedDB persistence, the service worker / offline mode, the install prompt, the iOS share sheet for backups, the Recharts Reports page, and the Vercel deployment itself. Please run `npm install && npm run build && npm run preview` and tell me the exact error text if anything fails.

## Troubleshooting
- **Blank page / "Could not open the on-device database":** open the browser console and send me the message. Private-browsing modes can block IndexedDB; use a normal window.
- **Old version still showing after an update:** close and reopen the installed app once (the service worker updates in the background).
- **Restore says the file isn't a FlowMoney backup:** use a file made by *Export backup* or `npm run export-data`.
- **iPhone data disappeared:** Safari can clear storage for sites not added to the Home Screen and unused for a week. Install it and keep backups.
