# Handoff — next session

## Current status
- App is **built and deployed live** at https://timeclock.backforty.builders
  (Netlify, deploying from the **public** repo github.com/bfbtools/timeclock).
- **Deploy = `git push`** from `~/BFB Time Clock`. The repo is public so pushes
  auto-deploy; commits are authored as the **bfbtools** identity
  (`300975488+bfbtools@users.noreply.github.com`, already the repo's git config)
  so Netlify's contributor check accepts them. After a deploy, **hard-refresh
  (Cmd+Shift+R)** to beat browser cache.
- **Language:** the app opens with a required language-choice gate
  (Español / English), default Spanish; the choice persists per device; EN/ES
  toggle stays in the header.
- **Admin page `/qr.html`:** Print All (shop board, Spanish-first, excludes BFB
  Shop + inactive) · per-card "Print This Jobsite" (single poster) · "Add New
  Jobsite/Project" (writes Projects tab; GC name has a gray autocomplete of
  existing GCs) · Active toggles (write the Sheet). **No login anywhere on the
  site.** `ADMIN_TOKEN` is used ONLY by `/api/invoice-preview` (financial
  dry-run) — keep it there.
- **Tests:** `npm test` → 21 passing (pure rollup/invoice logic).
- Google chain verified against the live Sheet; all print/UI verified in preview.

## TODO — next session

### 1. New feature: "Switch to Different Jobsite" (on clock-out)
For the rare case where a worker stops on one project but keeps working on a
**different** project the same day. Add a **secondary button on the clock-OUT
flow**: "Switch to Different Jobsite" (bilingual, Spanish-first).
- **Brian wants to pay them for the COMMUTE** between the two jobsites.
- **Design questions to settle with Adrienne first:**
  - How is commute pay calculated? (paid gap = time between clock-out here and
    clock-in at the next site? a flat commute amount? paid at what rate — the
    worker's pay rate? billed to which project/GC?)
  - Flow: tap "Switch to Different Jobsite" → clock OUT of current site → choose
    or scan the new site → clock IN there; record/flag the commute for pay.
- **Likely touches:** clock-out flow (`public/index.html`, `public/js/app.js`),
  `punch.js` / punch model, and the rollup/invoicing if commute becomes a paid
  line or paid gap (`lib/rollup.js`, `lib/invoice-lib.js`, Materials or a new
  concept).

### 2. Write test directions for ALL flows
Adrienne wants clear **step-by-step directions to test every flow end-to-end**:
clock in/out, first-time PIN set vs enter, multi-punch/day, missed-clock-out
recovery, "my name isn't here" fallback, Time Log (view + add + edit a punch),
Invoice Draft, Materials at owner clock-out, rate change, the in-app QR scanner,
the language gate, and `/qr.html` (add / toggle / print all / print one).
- Test users already in the Sheet: **Adrienne** (Type=owner) + **Brian**
  (Type=employee) under a **`TEST`** sub (Subs tab, AutoInvoice=N). PINs may be
  blank → set on first use.

## Gotchas
- The local preview (static / netlify dev) caches JS/CSS hard; to see changes use
  `?cb=` + swap the `styles.css`/`app.js` href, or just test on the **live site**
  with a hard-refresh.
- Timestamps are stored as **ET wall-clock** `"YYYY-MM-DD HH:mm:ss"`.
- Week is **Mon–Sat**; `WEEK_LENGTH_DAYS` in `lib/config.js` → 7 enables Sundays
  (Sunday hours are always flagged either way).
- Service-account key lives in `~/Downloads/bfb-time-clock-3a1486ea1193.json`
  (used by local check scripts; never committed).
