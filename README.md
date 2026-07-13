# Back Forty Builders — Subcontractor Time Clock

QR-launched web app that lets **subcontractors** clock in/out on jobsites.
Punches land in a Google Sheet that auto-computes hours and generates weekly
invoices. (BFB employees use Buildertrend — this app is for subs only.)

Full spec: [`docs/bfb-timeclock-spec.md`](docs/bfb-timeclock-spec.md) ·
Brand: [`docs/bfb-brand-guidelines.md`](docs/bfb-brand-guidelines.md) ·
Approved UI: [`public/assets/BFB_TimeClock_ClockIn_Preview.html`](public/assets/BFB_TimeClock_ClockIn_Preview.html)

## Stack

- **Front end:** static HTML/CSS/JS in `public/`, hosted on Netlify at `timeclock.backforty.builders`.
- **Backend:** Netlify Functions (Node 20, ESM) in `netlify/functions/`.
- **Datastore:** Google Sheet (`SHEET_ID`) via the Sheets API v4 + a service account.
- **Email:** Resend (from `accounting@backforty.builders`).
- **Scheduled invoicing:** a Netlify Scheduled Function (wired in Build Step 5).

## Repo layout

```
bfb-timeclock/
├── public/                     # static site (Netlify publish dir)
│   ├── index.html              # the time-clock app
│   ├── qr.html                 # admin: print jobsite QR codes
│   ├── assets/                 # approved design reference
│   ├── css/  js/               # (front end, Build Step 2)
├── netlify/functions/          # serverless API
│   ├── health.js               # GET  /api/health — verifies Sheets connection
│   ├── site.js                 # GET  /api/site?site=QR — project + roster + subs
│   ├── auth.js                 # POST /api/auth — verify / set a worker PIN
│   ├── punch.js                # POST /api/punch — write an IN/OUT punch
│   ├── worker.js               # POST /api/worker — "my name isn't here" fallback
│   ├── timelog.js              # GET  /api/timelog — a worker's week (PIN-gated)
│   ├── invoice.js              # GET  /api/invoice — sub invoice draft (PIN-gated)
│   ├── invoice-run.js          # SCHEDULED — weekly auto-send (Mon 06:00 UTC, after Sun-midnight close)
│   ├── invoice-preview.js      # GET  /api/invoice-preview — admin dry-run/manual run
│   ├── material.js             # POST /api/material — owner materials + receipt
│   ├── rate.js                 # POST /api/rate — change pay rate (RateLog + email)
│   ├── projects.js             # /api/projects — GET sites+QR (open); POST add/toggle (admin)
│   └── lib/
│       ├── sheets.js           # Google Sheets read/write helper
│       ├── model.js            # domain helpers (roster, punch state, ET time)
│       ├── rollup.js           # pairing, hours, rates, lunch, Mon–Sun (tested)
│       ├── invoice-lib.js      # sub / QB / GC invoice builders (tested)
│       ├── invoicing.js        # week orchestration: generate + send + log
│       ├── email.js            # Resend wrapper
│       ├── email-templates.js  # branded HTML invoice emails
│       ├── drive.js            # Drive receipt upload (drive.file scope)
│       ├── http.js             # JSON response / body helpers
│       └── config.js           # tab names + business constants
├── docs/                       # spec + brand guidelines (reference copies)
├── netlify.toml                # build/functions/redirects config
├── .env.example                # env-var template (copy to .env for local dev)
└── package.json
```

## Environment variables

Set these in **Netlify → Site settings → Environment variables** (production) and
in a local `.env` file (never committed) for `netlify dev`. See `.env.example`.

| Variable | What it is |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT` | Full service-account JSON key, as a single value. |
| `SHEET_ID` | The datastore Sheet ID (`1CAVJjOG…MbPJfc`). |
| `RESEND_API_KEY` | Resend API key (domain `backforty.builders` verified). |
| `ACCOUNTING_EMAIL` | `accounting@backforty.builders` (from/copy address). |
| `ADMIN_TOKEN` | Long random string; gates only the invoice preview (`/api/invoice-preview`). |
| `DRIVE_FOLDER_ID` | *(optional)* Drive folder for receipt photos; unset = materials save without a receipt link. |
| `SITE_URL` | *(optional)* Public base URL for QR links; defaults to the production domain. |

## Setup steps (Adrienne runs these — code is scaffolded, you do the cloud/auth)

1. **GitHub:** create a repo, push this project, connect it to Netlify.
2. **Google Cloud:** create a project → enable the **Google Sheets API** →
   create a **service account** → create & download a **JSON key**.
   **Share the Google Sheet with the service-account email as Editor.**
   Also **add a `PendingReview` column to the Workers tab** — the
   "my name isn't here" fallback writes `Y` there for new people you review.
3. **Resend:** create an account → verify the **backforty.builders** domain
   (add the DNS records it gives you) → create an API key.
4. **Netlify:** set the four env vars above → add custom domain
   **timeclock.backforty.builders** (one CNAME in DNS).
5. **QR codes:** open **`/qr.html`** on the live site and print one QR per site
   (it reads the Projects tab and builds `…/?site=<QRParam>` for each active
   site). No login needed — the codes are meant to be posted publicly. Post each
   at its jobsite.

6. **Drive (for materials receipts):** in Google Cloud, **enable the Google
   Drive API**; create a Drive folder, **share it with the service-account
   email** as Editor, and put its folder ID in `DRIVE_FOLDER_ID`. Optional —
   materials still save without it, just with no receipt link.

> Receipt upload uses the same service account as Sheets (drive.file scope);
> no extra key needed.

## Verify the backend (do this after step 2 + local `.env`)

```bash
npm install
npm run dev          # netlify dev — serves the site + functions locally
# then open http://localhost:8888/api/health
```

A healthy response lists row counts for Subs / Workers / Projects. If it errors,
the message says what's wrong (missing env var, bad JSON, or Sheet not shared).

## Build order (per spec)

1. ✅ Scaffold + Netlify config + Sheets read/write helper.
2. ✅ Front end from the approved preview + API functions (site/auth/punch/worker).
3. ✅ Rollup engine (pairing, hours, lunch, Carlito, Mon–Sun) + unit tests (`npm test`).
4. ✅ PIN-gated Time Log (employees) + Invoice Draft (owners/independents).
5. ✅ Invoicing: Monday scheduled auto-send (after Sun-midnight close), AutoInvoice toggle, QB + GC drafts, InvoiceLog, admin dry-run.
6. ✅ Materials capture + Drive receipt upload; RateLog + rate-change email.

**All six build steps complete.** Remaining to go live: your cloud setup
(Netlify env vars + deploy) and the optional Drive folder for receipts.

## Guardrails

- Standalone build — nothing outside this repo is touched.
- **Adrienne** does all Google/Netlify/Resend/DNS/deploy/auth actions.
- **No secrets in the repo** — keys live in env vars only.
- **No geolocation, no selfie/photo-of-person capture.**
- Onboarding is backend (edit the Sheet); the only in-app path is the
  "My name isn't here" fallback.
