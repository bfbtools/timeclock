# Back Forty Builders — Subcontractor Time Clock

This project builds the BFB subcontractor time-clock web app (a Netlify-hosted web app + a Google Sheet datastore).

**Before doing anything, read `docs/bfb-timeclock-spec.md` in full.** It contains the complete spec: tech stack/setup, all five screens, the seven-tab data model, the business rules (rates, lunch, Carlito overrides, Mon–Sun week), the invoicing logic, the build order, and the guardrails.

The approved visual styling is `public/assets/BFB_TimeClock_ClockIn_Preview.html` — match it exactly. Brand tokens are in `docs/bfb-brand-guidelines.md`.

**Top guardrails:** do not modify any existing skills or unrelated files. Claude may deploy (push to `main` → Netlify auto-builds) but **always asks first**, and **batches** several changes into one deploy rather than shipping each small change (saves token usage). The human still handles Google/cloud auth, DNS, and secrets — no secrets in the repo (keys live in Netlify env vars only). No geolocation, no selfie capture.

> This is the local code repo (`~/BFB Time Clock`). The PM home (spec authoring, assets) lives in the Google Drive folder `05_Project Management/BFB Time Clock`. GitHub is the source of truth once pushed.
