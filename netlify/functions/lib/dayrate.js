// The "Guaranteed Day" — a per-sub floor on a worker's PAID hours for a
// calendar day. Set once per sub company (San Ignacio LLC to start) and
// inherited by every worker under it; there is no per-person override.
//
// Rule (Adrienne, 2026-08-29; boundary corrected 2026-09-02): per worker, per
// calendar day — if CLOCKED hours are STRICTLY GREATER than `min` (8.5) the day
// pays `hours` (10); otherwise (including exactly 8.50) it pays the actual
// billable hours. NB: this pay boundary is strict `>`; the GC-invoice lunch
// threshold in buildGCInvoice is the same 8.5 but INCLUSIVE `>=`. Same number,
// opposite branch at exactly 8.50 — do not collapse them into one comparison.
// Two deliberate choices (SUB_DAY_RATE_HANDOFF.md §2):
//   - The threshold is tested against RAW CLOCKED hours, NOT net of lunch.
//   - The floor is applied to BILLABLE hours (each shift rounded to the nearest
//     0.25 h, then summed) — the unit the invoice is already in.
//   - It is a floor, never a cap: a 12 h day pays 12.00, not 10.00.
// It touches ONLY the sub invoice (what BFB pays the sub). It must never reach
// the GC invoice — BFB absorbs the difference (§2c).
//
// Pure arithmetic, mirroring slab-dashboard/public/slab-dayrate.js so the two
// apps cannot drift. `dayTotals` reuses rollup's own quarter-rounding, so the
// billable here is byte-identical to what buildSubInvoice already produces.

import { projectHoursQuarter } from './rollup.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const isYes = (v) => ['TRUE', 'Y', 'YES', '1', 'ON'].includes(String(v ?? '').trim().toUpperCase());

// Parse + validate a sub's guarantee config from its Subs row. Returns null when
// off OR misconfigured — a bad rule never silently pays, it simply doesn't apply
// (and the admin write op rejects bad input up front; this is the safety net).
export function subGuarantee(sub) {
  if (!sub || !isYes(sub.GuaranteedDayOn)) return null;
  const hours = Number(sub.GuaranteedDayHours);
  const min = Number(sub.GuaranteedDayMin);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) return null;
  if (!Number.isFinite(min) || min < 0 || min > 24) return null;
  if (min > hours) return null; // a rule that could never pay anybody
  const rawFrom = String(sub.GuaranteedDayFrom ?? '').trim();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(rawFrom) ? rawFrom : '';
  return { hours, min, from };
}

// One worker-day's totals from its paired intervals (already the day's punches,
// possibly across several jobs). clocked = Σ raw shift hours; billable = Σ
// per-shift quarter-rounded hours; byJob = per-project billable (for allocation).
export function dayTotals(intervals) {
  const byJob = projectHoursQuarter(intervals || []);
  const billable = Object.values(byJob).reduce((a, b) => a + b, 0);
  const clocked = (intervals || []).reduce((s, iv) => s + (iv && iv.minutes ? iv.minutes : 0) / 60, 0);
  return { clocked: round2(clocked), billable: round2(billable), byJob };
}

// Apply the rule to one worker-day. `clocked`/`billable` are already summed
// across the day's jobs. Returns the credited figure + the uplift (>= 0).
export function creditDay({ clocked, billable, rule, date }) {
  const b = round2(billable);
  const c = round2(clocked);
  // Off, or before an explicit start date (§2d: blank from = every day incl. past).
  if (!rule || (rule.from && date && String(date) < rule.from)) {
    return { date, clocked: c, billable: b, credited: b, uplift: 0, qualified: false };
  }
  const qualified = c > rule.min;                         // CLOCKED threshold, STRICT > (exactly 8.50 → actual)
  const credited = qualified ? Math.max(b, rule.hours) : b; // floor, never a cap
  return { date, clocked: c, billable: b, credited: round2(credited), uplift: round2(credited - b), qualified };
}

// Credit one worker's whole week: apply the rule to each worked day and split
// each day's uplift across its jobs. `days` = summarizeWorkerWeek output (each
// { date, intervals }). Returns the per-day rows (for hours-summary credit[]),
// the week's total uplift HOURS, and the per-project uplift totals. The single
// place the per-worker accumulation lives, so the invoice and hours-summary
// cannot compute it two different ways.
export function creditWorker({ days, rule } = {}) {
  const rows = [];
  let upliftHours = 0;
  const byProject = {};
  for (const d of days || []) {
    const { clocked, billable, byJob } = dayTotals(d.intervals);
    const day = creditDay({ clocked, billable, rule, date: d.date });
    const byJobUplift = allocateUplift(day.uplift, byJob); // sums EXACTLY to day.uplift
    rows.push({ ...day, byJob: byJobUplift });
    upliftHours = round2(upliftHours + day.uplift);
    for (const [pid, h] of Object.entries(byJobUplift)) byProject[pid] = round2((byProject[pid] || 0) + h);
  }
  return { rows, upliftHours, byProject };
}

// Split a day's uplift across the jobs it spanned, in proportion to the billable
// hours each carried, using largest-remainder on hundredths of an hour so the
// parts sum to the uplift EXACTLY and no job silently absorbs the rounding (§3).
export function allocateUplift(uplift, byJob) {
  const u = Math.round(round2(uplift) * 100); // hundredths of an hour
  const jobs = Object.entries(byJob || {}).filter(([, h]) => h > 0);
  const totalB = jobs.reduce((s, [, h]) => s + h, 0);
  if (u <= 0 || totalB <= 0) return {};
  const parts = jobs.map(([pid, h]) => {
    const exact = (u * h) / totalB;
    const floor = Math.floor(exact);
    return { pid, floor, rem: exact - floor };
  });
  let left = u - parts.reduce((s, p) => s + p.floor, 0);
  parts.sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < parts.length && left > 0; i++, left -= 1) parts[i].floor += 1;
  const out = {};
  for (const p of parts) out[p.pid] = p.floor / 100;
  return out;
}
