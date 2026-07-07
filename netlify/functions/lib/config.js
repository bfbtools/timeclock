// Shared constants for the BFB Time Clock backend.
// Business rules live in the spec (docs/bfb-timeclock-spec.md § Business rules);
// this file only names the tabs and the fixed numbers the code needs.

// Google Sheet tab names (the seven-tab data model).
export const TABS = {
  SUBS: 'Subs',
  WORKERS: 'Workers',
  PROJECTS: 'Projects',
  PUNCHES: 'Punches',
  MATERIALS: 'Materials',
  RATE_LOG: 'RateLog',
  INVOICE_LOG: 'InvoiceLog',
};

// Business constants.
export const TIMEZONE = 'America/New_York'; // Johnson, VT
export const LUNCH_HOURS = 0.75; // deducted only on the GC invoice, per worker per day
export const DEFAULT_COMPANY_RATE = 50; // company-sub default pay rate ($/hr)
export const QB_RATE = 50; // QB "Carpentry" invoice rate ($/hr)

// Week starts Monday. JS Date.getDay(): 0=Sun … 6=Sat.
export const WEEK_START_DOW = 1; // Monday
// How many days the billing week spans, starting Monday.
//   6 = Monday–Saturday (spec default, no Sundays)
//   7 = Monday–Sunday   (flip to this to start counting Sunday hours)
// Sunday punches are ALWAYS flagged for review; this only controls whether
// their hours are counted/paid in the week.
export const WEEK_LENGTH_DAYS = 6;

// Cost-code references (for GC/QB invoice notes).
export const COST_CODE_GC = '01 31 00';
export const COST_CODE_BT_SUB_LABOR = '06 00 10';
