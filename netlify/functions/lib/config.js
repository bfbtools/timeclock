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

// Week is Monday–Saturday (no Sundays). 1 = Monday per JS getDay()? No —
// JS Date.getDay(): 0=Sun … 6=Sat. Week starts Monday(1), ends Saturday(6).
export const WEEK_START_DOW = 1; // Monday
export const WEEK_END_DOW = 6; // Saturday

// Cost-code references (for GC/QB invoice notes).
export const COST_CODE_GC = '01 31 00';
export const COST_CODE_BT_SUB_LABOR = '06 00 10';
