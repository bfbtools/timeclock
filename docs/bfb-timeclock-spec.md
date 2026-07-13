# Back Forty Builders — Subcontractor Time Clock

> Project context + spec for Claude Code. Read fully before writing code.

## What this is

A QR-launched **web app** that lets subcontractors clock in/out on jobsites, replacing handwritten timesheets. Punches land in a Google Sheet that auto-computes hours and generates weekly invoices. Built for Back Forty Builders (BFB), a GC in Johnson, VT, by Adrienne Parker (PM). BFB employees use Buildertrend to clock in — **this app is for subs only.**

**The app is purely a front-facing time clock.** All account setup is done in the backend (the Google Sheet), not through onboarding screens.

User groups:
- **Employee of a company sub** (San Ignacio, SnowPeak, Lopez) — clocks own hours; hours roll up to the company's invoice.
- **Subcontractor** — a business owner: a one-person **independent**, or a **company** sub owner. Independents (and opted-in company subs) get auto-generated weekly invoices.

## Guardrails — read first

- **Do not modify any existing skills, files, or unrelated projects.** Standalone build.
- **The human does all account/cloud/DNS/deploy actions.** You write code and commit to GitHub; you do NOT authenticate, deploy, create cloud resources, or change DNS on Adrienne's behalf. Surface the steps; she runs them.
- **No secrets in the repo.** Service-account keys and API keys live in Netlify environment variables only.
- **No geolocation, no selfie/photo-of-person capture.** The QR is posted at the jobsite; the scan is the presence proof. Do not add either.
- **Onboarding is backend.** People are added in the Sheet. The only in-app account creation is the "My name isn't here" fallback (see Flow).

## Tech stack

- **Front end:** static site (vanilla HTML/CSS/JS, matching the approved preview). Hosted on **Netlify** at `timeclock.backforty.builders`.
- **Backend:** **Netlify Functions** (Node) for clock punches and invoice generation; a **Netlify Scheduled Function** for the weekly invoicing (fires Monday early-AM, just after the Sunday-midnight week close).
- **Datastore:** the Google Sheet, read/written via the **Google Sheets API v4** using a **service account** (`googleapis` npm). Sheet ID: `1CAVJjOGH0zxfTaEnuUcP6HBhRrtld6UfMZzWZMbPJfc`.
- **Email:** **Resend** (domain-verified for backforty.builders), sending invoices from accounting@backforty.builders.

**Environment variables (Netlify):** `GOOGLE_SERVICE_ACCOUNT` (JSON key), `SHEET_ID`, `RESEND_API_KEY`, `ACCOUNTING_EMAIL=accounting@backforty.builders`.

## Setup steps (Adrienne runs these; you scaffold the code + docs)

1. **GitHub repo** for the project; connect it to Netlify.
2. **Google Cloud:** create a project, enable the Google Sheets API, create a **service account**, download its JSON key. **Share the Google Sheet with the service-account email** (Editor).
3. **Resend:** create an account, verify the **backforty.builders** domain (add the DNS records), get an API key.
4. **Netlify:** set the env vars above; add the custom domain **timeclock.backforty.builders** (one CNAME in DNS).
5. **QR codes:** one per site, pointing to `https://timeclock.backforty.builders/?site=<QRParam>` (QRParam is in the Projects tab).
6. Node is used for local dev/build; **clasp is NOT needed** (that was the old Apps Script plan).

## Styling — source of truth

Match **`assets/BFB_TimeClock_ClockIn_Preview.html`** exactly: warm light theme, header, split-flap flip clock, confirmation animation. Tokens also in **`bfb-brand-guidelines.md`**.
- Fonts: Barlow Condensed Bold (display), Libre Franklin (UI/buttons, ALL CAPS bold ~1.8px tracking), Roboto Mono (flip digits). No Lora.
- Icons: Material Symbols (Rounded).
- Colors: bg `#F7F0E6`, surface `#FFFFFF`, text `#3B3830`/`#6B6459`/`#B8B0A4`, border `#EFE0CA`, Ember `#DB563D` (hover `#BB4832`), Pine `#2E5E4E`, Brass `#DB942C`, Forge `#2D2E28`, Kraft `#D6B07B`.

**On-screen copy** follows the BFB crew voice — plain and practical, bilingual EN/ES. Header: **BACK FORTY BUILDERS**. Buttons: Clock In / Marcar Entrada, Clock Out / Marcar Salida. Prompt: "Who are you? / ¿Quién eres?". Fallback: "My name isn't here / Mi nombre no está". Confirmation: "You're clocked in / Entrada registrada".

## User flow (front-facing)

1. **Scan the site QR** → app opens; the site/project is set from the `?site=` param (auto, not chosen).
2. **Identify:** pick your name (device-remembered via localStorage; dropdown fallback) → enter 4-digit PIN. First time for a person: they set the PIN (stored in the Sheet so Adrienne can retrieve it).
3. **Clock In / Clock Out** — one state-aware button + distinct in/out confirmation animations. Multiple in/out pairs per day allowed. On scan, an open punch from a **prior date** prompts for the missed clock-out time first. A subcontractor owner's clock-out screen shows a **Materials** field (amount + optional note + optional receipt photo → uploaded to Drive, link stored).
4. **Secondary tab (PIN-gated):** employees → **Time Log** (their week; add a missed punch; entries lock read-only after the Sunday-midnight cutoff, still visible; edits/manual adds flagged). Subcontractor owners/independents → **Invoice [date] Draft** (live preview of the auto-send invoice). The tab requires the person's PIN to open, and the Time Log requires PIN again to add or edit a punch — so no one can view or change someone else's hours or a sub's invoice.

**Account creation is backend** (Adrienne edits the Sheet). The only in-app path is the **"My name isn't here" fallback:** first + last name, pick sub, set a PIN → creates a Worker row flagged `pending review`, inherits the sub's default rate (never self-set), and can clock in immediately.

## Data model (Google Sheet tabs)

- **Subs:** SubID, CompanyName, HasEmployees, DefaultPayRate, AutoInvoice, Email, Active
- **Workers:** WorkerID, Type (employee/independent/owner), First, Last, Nickname, SubID, Email, PIN, PayRateOverride, GCRateOverride, Active
- **Projects:** ProjectID, SiteName, BTProject, BillsToGC, GCName, GCRate, QRParam, Active
- **Punches:** PunchID, Timestamp, Site, Project, SubID, WorkerID, WorkerName, Action (IN/OUT), Source (scan/manual), Edited
- **Materials:** MaterialID, Timestamp, SubID, Project, Amount, Note, ReceiptURL
- **RateLog:** Timestamp, Who, OldRate, NewRate
- **InvoiceLog:** InvoiceID, Date, SubID, WeekStart, WeekEnd, Total, Type (sub/QB/GC), Status, SentTo

(The Sheet is already seeded with Subs, Workers, and Projects.)

## Business rules

- **Pay rate** = what BFB pays the sub. Independents set their own, changeable anytime (log each change to RateLog + email Adrienne). Company subs default $50 with per-employee overrides.
- **GC rate** = what BFB bills the GC. **Project-based** (on the Projects tab), never shown to subs. Applies to any hours on that project regardless of sub.
- **Carlito** (San Ignacio): pay $35 / GC $40 via his per-worker overrides.
- **GC projects:** any project with `BillsToGC=Y` (currently Opus: French 1/2, Camp Johnson, Apple Tree, Sun and Ski at $68; Kenn Construction: Stone Crop at $68).
- **Lunch:** flat 0.75 hr/worker/day deducted **only on the GC invoice**. Not on what BFB pays subs; not on independent invoices.
- **Week:** Monday–Sunday (Sunday is a normal paid workday; set via `WEEK_LENGTH_DAYS` in `lib/config.js`, currently 7).
- **Hours:** pair IN/OUT per worker per day in order; sum intervals; flag unpaired punches.

## Invoicing

- **Independent subs:** auto-generate + auto-send at the **Sunday-midnight** week close (the scheduled run fires Monday early-AM), covering Mon–Sun, to accounting@backforty.builders + the sub. One line per project (hours × rate) with a per-day breakdown in the description; plus a Materials line if any. Via the scheduled function + Resend.
- **Company subs:** per-sub `AutoInvoice` toggle. San Ignacio + Lopez = ON; SnowPeak = OFF (can pull a draft).
- **QB invoice** (company subs): $50/hr, "Carpentry"; drafted from clocked hours; emailed to accounting@.
- **GC invoice** (e.g., Opus): $68/hr with the 0.75 lunch deduction and Carlito separated; generated as a **draft Adrienne reviews and sends** (not auto-fired to the GC); details emailed to accounting@. Cost code ref `01 31 00`. (BT sub-labor code ref `06 00 10`.)

## Suggested build order

1. Repo scaffold + Netlify config + env wiring + Sheets service-account read/write helper.
2. Front end from the preview: clock-in/out, identify (name + PIN), site-from-QR, animations, multi-punch, missed-clock-out recovery, "my name isn't here" fallback.
3. Rollup engine: pairing, daily/weekly hours, lunch, Carlito, Mon–Sun.
4. Employee Time Log; Subcontractor Invoice Draft.
5. Invoicing: independent scheduled auto-send (Resend), company toggle, QB + GC drafts.
6. Materials capture + Drive receipt upload; RateLog + change email.

## Open items for Adrienne

- Sub emails (for invoice copies) in the Subs tab.
- SnowPeak crew: Nelson + Elías (confirm Elías spelling).
