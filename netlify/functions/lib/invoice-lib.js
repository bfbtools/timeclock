// Invoice builder — pure functions over rollup output. Used by the live
// "Invoice Draft" tab (Step 4) and the weekly auto-send (Step 5).
//
// The SUB invoice is what BFB pays the sub: one line per project
// (hours × pay rate) with a per-day breakdown, plus a Materials line if any.
// No lunch deduction here — lunch applies only to the GC invoice (Step 5).

import { num, weekRange, summarizeWorkerWeek, projectHoursQuarter } from './rollup.js';
import { LUNCH_HOURS, QB_RATE, COST_CODE_GC } from './config.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const nameOf = (w) => (w.Nickname && String(w.Nickname).trim()) || w.First || '';
const firstNameOf = (w) => (w.First && String(w.First).trim()) || (w.Nickname && String(w.Nickname).trim()) || '';
// date -> Set(firstName)  becomes  [{ date, names:[...] }] sorted by date
const rosterDays = (roster) => [...roster.entries()].sort().map(([date, names]) => ({ date, names: [...names].sort() }));

// Work-period label for invoice titles/refs/line descriptions: full date on BOTH
// sides, "MM/DD/YY–MM/DD/YY" (a single-day period collapses to "MM/DD/YY"). The
// generator used to stamp a single date; a RANGE disambiguates multi-day/catch-up
// bills for A/P recon (see memory bill-title-date-range). Adrienne asked for the
// year written out on both dates (2026-08-07). Falls back to the billing week.
function periodLabel(startISO, endISO) {
  if (!startISO) return '';
  const mdy = (iso) => { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y.slice(2)}`; };
  if (!endISO || startISO === endISO) return mdy(startISO);
  return `${mdy(startISO)}–${mdy(endISO)}`;
}
// The worked span from a roster (date -> names) Map, clamped to the billing week.
function workedSpan(roster, weekStart, weekEnd) {
  const dates = [...roster.keys()].sort();
  return { workStart: dates[0] || weekStart, workEnd: dates[dates.length - 1] || weekEnd };
}

// Build the sub-facing invoice for one sub for one week.
//   sub          : Subs row
//   workers      : Workers rows belonging to this sub
//   punches      : Punches rows (any range; filtered to the week per worker)
//   materials    : Materials rows for this sub in the week (optional)
//   projectsById : { projectId: Projects row } for names
export function buildSubInvoice({ sub, workers, punches, materials = [], projectsById = {}, weekStart }) {
  const { end } = weekRange(weekStart);

  const byWorker = new Map();
  for (const p of punches) {
    const k = String(p.WorkerID).trim();
    if (!byWorker.has(k)) byWorker.set(k, []);
    byWorker.get(k).push(p);
  }

  const projAgg = new Map(); // projectId -> { hours, amount, perDay:Map, rates:Set }
  const roster = new Map();  // date -> Set(firstName) — who was onsite that day
  const flags = [];
  const workerLines = [];
  const readout = []; // per worker: ACTUAL (unrounded) scan times for the email read-out

  for (const w of workers) {
    const s = summarizeWorkerWeek({
      worker: w, sub, weekStartMonday: weekStart,
      punches: byWorker.get(String(w.WorkerID).trim()) || [],
    });
    s.flags.forEach((f) => flags.push({ worker: nameOf(w), ...f }));

    // Actual scan times (unrounded) — raw in/out per shift, 0-hour mis-punches
    // dropped. The email shows this as the true record behind the rounded invoice.
    const segments = [];
    let actual = 0;
    for (const d of s.days) {
      for (const iv of d.intervals) {
        const h = iv.minutes / 60;
        if (h < 0.1) continue; // drop 0-hour mis-punches
        segments.push({ date: d.date, in: iv.in.Timestamp, out: iv.out.Timestamp, hours: round2(h) });
        actual += h;
      }
    }
    if (segments.length) readout.push({ worker: nameOf(w), hours: round2(actual), segments });

    // Per-shift 15-min rounding: aggregate from quarter-hour-snapped intervals,
    // not the raw daily totals, so the worker line ties to the project lines.
    let workerHours = 0;
    for (const d of s.days) {
      const ph = projectHoursQuarter(d.intervals);
      const dayHours = Object.values(ph).reduce((a, b) => a + b, 0);
      if (dayHours > 0) {
        if (!roster.has(d.date)) roster.set(d.date, new Set());
        roster.get(d.date).add(firstNameOf(w));
      }
      for (const [proj, hrs] of Object.entries(ph)) {
        workerHours += hrs;
        if (!projAgg.has(proj)) projAgg.set(proj, { hours: 0, amount: 0, perDay: new Map(), rates: new Set() });
        const a = projAgg.get(proj);
        a.hours += hrs;
        a.amount += hrs * s.payRate;
        a.rates.add(s.payRate);
        a.perDay.set(d.date, (a.perDay.get(d.date) || 0) + hrs);
      }
    }
    workerHours = round2(workerHours);
    if (workerHours > 0) workerLines.push({ worker: nameOf(w), hours: workerHours, rate: s.payRate, amount: round2(workerHours * s.payRate) });
  }

  const projects = [...projAgg.entries()].map(([pid, a]) => ({
    projectId: pid,
    name: (projectsById[pid] && projectsById[pid].SiteName) || pid,
    hours: round2(a.hours),
    rate: a.rates.size === 1 ? [...a.rates][0] : null, // null when workers mix rates
    amount: round2(a.amount),
    perDay: [...a.perDay.entries()].sort().map(([date, hours]) => ({ date, hours: round2(hours) })),
  })).sort((x, y) => x.name.localeCompare(y.name));

  const laborTotal = round2(projects.reduce((s, p) => s + p.amount, 0));
  const mats = materials.map((m) => ({
    amount: num(m.Amount) || 0,
    note: m.Note || '',
    project: String(m.Project || '').trim(),
  }));
  const materialsTotal = round2(mats.reduce((s, m) => s + m.amount, 0));

  const { workStart, workEnd } = workedSpan(roster, weekStart, end);
  // Sub's own contact block for the PDF, from optional Subs-tab columns.
  const g = (k) => (sub && sub[k] != null ? String(sub[k]).trim() : '');
  const contact = {
    name: g('Contact'),
    address: g('Address'),
    cityStateZip: [g('City'), [g('State'), g('Zip')].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    phone: g('Phone'),
    email: g('Email'),
  };
  return {
    subId: sub && String(sub.SubID).trim(),
    company: sub && sub.CompanyName,
    contact,
    weekStart, weekEnd: end,
    workStart, workEnd, period: periodLabel(workStart, workEnd),
    projects, workerLines, laborTotal, readout,
    projectNames: projects.map((p) => p.name),
    totalHours: round2(projects.reduce((s, p) => s + p.hours, 0)),
    materials: mats, materialsTotal,
    total: round2(laborTotal + materialsTotal),
    days: rosterDays(roster),
    flags,
  };
}

// ---------------------------------------------------------------------------
// GC invoice — what BFB bills the general contractor. Per project, hours ×
// GCRate ($68), with the flat 0.75 hr/worker/worked-day LUNCH deducted, and any
// per-worker GC-rate override (Carlito @ $40) SEPARATED onto its own line.
// Held as a DRAFT for Adrienne to review (never auto-fired to the GC).
// ONE GC draft PER PROJECT (Adrienne 2026-08-07). Per work DAY, two line items:
//   - "Carpentry Labor" = all non-override workers onsite, at the project GCRate ($68)
//   - "General Labor"    = per-worker GCRateOverride (Carlito @ $40); one line per
//                          distinct override rate
// Each line lists the onsite names. Hours are NET billable = per-shift-rounded
// hours minus the flat 0.75 hr/worker/worked-day LUNCH (spread across the worker's
// projects that day). No lunch line in the table — the email carries a bottom note.
//   gcName       : the GC this project bills to (e.g. Opus)
//   project      : ONE Projects row (BillsToGC=Y)
//   workersById  : { workerId: Workers row }  (any sub — GC rate is project-based)
//   punches      : Punches rows for the week
export function buildGCInvoice({ gcName, project, workersById, punches, weekStart }) {
  const { end } = weekRange(weekStart);
  const projId = String(project.ProjectID).trim();
  const gcRate = num(project.GCRate) || 0;

  const byWorker = new Map();
  for (const p of punches) {
    if (String(p.Project).trim() !== projId) continue;
    const k = String(p.WorkerID).trim();
    if (!byWorker.has(k)) byWorker.set(k, []);
    byWorker.get(k).push(p);
  }

  // date -> { carpentry:{hours, onsite:Set}, general: Map(rate -> {hours, onsite:Set}) }
  const byDay = new Map();
  const flags = [];
  let grossTotal = 0, netTotal = 0;

  for (const [wid, wp] of byWorker) {
    const worker = workersById[wid] || { WorkerID: wid };
    const s = summarizeWorkerWeek({ worker, sub: null, punches: wp, weekStartMonday: weekStart });
    s.flags.forEach((f) => flags.push({ worker: nameOf(worker), ...f }));
    const override = num(worker.GCRateOverride);
    for (const d of s.days) {
      const ph = projectHoursQuarter(d.intervals);            // per-shift 15-min rounded (all projects)
      const projHrs = ph[projId] || 0;
      if (projHrs <= 0) continue;
      const dayTotal = Object.values(ph).reduce((a, b) => a + b, 0); // spread lunch across the day
      const factor = dayTotal > 0 ? Math.max(0, dayTotal - LUNCH_HOURS) / dayTotal : 0;
      const net = projHrs * factor;
      grossTotal += projHrs; netTotal += net;
      if (net <= 0) continue;
      if (!byDay.has(d.date)) byDay.set(d.date, { carpentry: { hours: 0, onsite: new Set() }, general: new Map() });
      const day = byDay.get(d.date);
      const who = nameOf(worker);
      if (override !== null) {
        const g = day.general.get(override) || { hours: 0, onsite: new Set() };
        g.hours += net; g.onsite.add(who); day.general.set(override, g);
      } else {
        day.carpentry.hours += net; day.carpentry.onsite.add(who);
      }
    }
  }

  const days = [...byDay.entries()].sort().map(([date, d]) => {
    const lines = [];
    if (d.carpentry.hours > 0) {
      const hours = round2(d.carpentry.hours);
      lines.push({ item: 'Carpentry Labor', rate: gcRate, hours, amount: round2(hours * gcRate), onsite: [...d.carpentry.onsite].sort() });
    }
    for (const [rate, g] of [...d.general.entries()].sort((a, b) => a[0] - b[0])) {
      const hours = round2(g.hours);
      if (hours > 0) lines.push({ item: 'General Labor', rate, hours, amount: round2(hours * rate), onsite: [...g.onsite].sort() });
    }
    return { date, lines };
  }).filter((d) => d.lines.length);

  const workStart = days.length ? days[0].date : weekStart;
  const workEnd = days.length ? days[days.length - 1].date : end;
  return {
    gcName, costCode: COST_CODE_GC,
    project: { id: projId, name: project.SiteName || projId },
    weekStart, weekEnd: end, workStart, workEnd, period: periodLabel(workStart, workEnd),
    days,
    lunchHours: round2(grossTotal - netTotal),
    totalHours: round2(days.reduce((s, d) => s + d.lines.reduce((t, l) => t + l.hours, 0), 0)),
    total: round2(days.reduce((s, d) => s + d.lines.reduce((t, l) => t + l.amount, 0), 0)),
    flags,
  };
}

// ---------------------------------------------------------------------------
// QB invoice — company-sub labor drafted for QuickBooks, emailed to accounting@.
// QuickBooks-style line items, one per project × role:
//   - "Carpentry"      = hours by workers on the sub's default rate ($50)
//   - "General Labor"  = hours by workers with a per-worker pay-rate override
//                        (e.g. Carlito @ $35), one line per such worker
// No lunch deduction. `carpentryRate` is the label rate for standard hours.
export function buildQBInvoice({ sub, workers, punches, projectsById = {}, weekStart, carpentryRate }) {
  const { end } = weekRange(weekStart);
  // Rate bug fix: the "Carpentry" line reads the sub's DefaultPayRate (Lopez $45,
  // San Ignacio $50), NOT a hardcoded $50 — an explicit override still wins.
  // Previously this path defaulted to QB_RATE ($50), overstating Lopez ~$430/wk.
  const rate = carpentryRate != null ? carpentryRate
    : (num(sub && sub.DefaultPayRate) != null ? num(sub.DefaultPayRate) : QB_RATE);
  const byWorker = new Map();
  for (const p of punches) {
    const k = String(p.WorkerID).trim();
    if (!byWorker.has(k)) byWorker.set(k, []);
    byWorker.get(k).push(p);
  }

  // projectId -> { carpentry:hours, overrides: Map(workerId -> {name, rate, hours}) }
  const agg = new Map();
  const roster = new Map();
  const flags = [];
  for (const w of workers) {
    const s = summarizeWorkerWeek({
      worker: w, sub, weekStartMonday: weekStart,
      punches: byWorker.get(String(w.WorkerID).trim()) || [],
    });
    s.flags.forEach((f) => flags.push({ worker: nameOf(w), ...f }));
    const override = num(w.PayRateOverride); // null when on the sub default
    for (const d of s.days) {
      const ph = projectHoursQuarter(d.intervals); // per-shift 15-min rounding
      const dayHours = Object.values(ph).reduce((a, b) => a + b, 0);
      if (dayHours > 0) {
        if (!roster.has(d.date)) roster.set(d.date, new Set());
        roster.get(d.date).add(firstNameOf(w));
      }
      for (const [proj, hrs] of Object.entries(ph)) {
        if (!agg.has(proj)) agg.set(proj, { carpentry: 0, overrides: new Map() });
        const a = agg.get(proj);
        if (override !== null) {
          const wid = String(w.WorkerID).trim();
          const o = a.overrides.get(wid) || { name: nameOf(w), rate: override, hours: 0 };
          o.hours += hrs; a.overrides.set(wid, o);
        } else {
          a.carpentry += hrs;
        }
      }
    }
  }

  const { workStart, workEnd } = workedSpan(roster, weekStart, end);
  const period = periodLabel(workStart, workEnd); // MM/DD–MM/DD/YY work period
  const lines = [];
  const projList = [...agg.entries()]
    .map(([pid, a]) => ({ name: (projectsById[pid] && projectsById[pid].SiteName) || pid, a }))
    .sort((x, y) => x.name.localeCompare(y.name));
  for (const { name, a } of projList) {
    if (a.carpentry > 0) {
      const qty = round2(a.carpentry);
      lines.push({ item: 'Carpentry', description: `${name} – ${period}`, qty, rate, amount: round2(qty * rate) });
    }
    for (const o of a.overrides.values()) {
      const qty = round2(o.hours);
      lines.push({ item: 'General Labor', description: `${o.name} – ${name} – ${period}`, qty, rate: o.rate, amount: round2(qty * o.rate) });
    }
  }

  return {
    subId: sub && String(sub.SubID).trim(),
    company: sub && sub.CompanyName,
    weekStart, weekEnd: end,
    workStart, workEnd, period,
    lines,
    totalHours: round2(lines.reduce((s, l) => s + l.qty, 0)),
    total: round2(lines.reduce((s, l) => s + l.amount, 0)),
    days: rosterDays(roster),
    flags,
  };
}
