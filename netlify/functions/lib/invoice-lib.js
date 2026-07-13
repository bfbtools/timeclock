// Invoice builder — pure functions over rollup output. Used by the live
// "Invoice Draft" tab (Step 4) and the weekly auto-send (Step 5).
//
// The SUB invoice is what BFB pays the sub: one line per project
// (hours × pay rate) with a per-day breakdown, plus a Materials line if any.
// No lunch deduction here — lunch applies only to the GC invoice (Step 5).

import { num, weekRange, summarizeWorkerWeek } from './rollup.js';
import { LUNCH_HOURS, QB_RATE, COST_CODE_GC } from './config.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const nameOf = (w) => (w.Nickname && String(w.Nickname).trim()) || w.First || '';
const firstNameOf = (w) => (w.First && String(w.First).trim()) || (w.Nickname && String(w.Nickname).trim()) || '';
// date -> Set(firstName)  becomes  [{ date, names:[...] }] sorted by date
const rosterDays = (roster) => [...roster.entries()].sort().map(([date, names]) => ({ date, names: [...names].sort() }));

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

  for (const w of workers) {
    const s = summarizeWorkerWeek({
      worker: w, sub, weekStartMonday: weekStart,
      punches: byWorker.get(String(w.WorkerID).trim()) || [],
    });
    s.flags.forEach((f) => flags.push({ worker: nameOf(w), ...f }));
    if (s.weekHours > 0) workerLines.push({ worker: nameOf(w), hours: s.weekHours, rate: s.payRate, amount: s.pay });

    for (const d of s.days) {
      const dayHours = Object.values(d.projectHours).reduce((a, b) => a + b, 0);
      if (dayHours > 0) {
        if (!roster.has(d.date)) roster.set(d.date, new Set());
        roster.get(d.date).add(firstNameOf(w));
      }
      for (const [proj, hrs] of Object.entries(d.projectHours)) {
        if (!projAgg.has(proj)) projAgg.set(proj, { hours: 0, amount: 0, perDay: new Map(), rates: new Set() });
        const a = projAgg.get(proj);
        a.hours += hrs;
        a.amount += hrs * s.payRate;
        a.rates.add(s.payRate);
        a.perDay.set(d.date, (a.perDay.get(d.date) || 0) + hrs);
      }
    }
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

  return {
    subId: sub && String(sub.SubID).trim(),
    company: sub && sub.CompanyName,
    weekStart, weekEnd: end,
    projects, workerLines, laborTotal,
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
//   gcName       : the GC these projects bill to
//   gcProjects   : Projects rows with BillsToGC=Y and this GCName
//   workersById  : { workerId: Workers row }  (any sub — GC rate is project-based)
//   punches      : Punches rows for the week
export function buildGCInvoice({ gcName, gcProjects, workersById, punches, weekStart }) {
  const { end } = weekRange(weekStart);
  const projIds = new Set(gcProjects.map((p) => String(p.ProjectID).trim()));
  const projById = {};
  gcProjects.forEach((p) => { projById[String(p.ProjectID).trim()] = p; });

  const relevant = punches.filter((p) => projIds.has(String(p.Project).trim()));
  const byWorker = new Map();
  for (const p of relevant) {
    const k = String(p.WorkerID).trim();
    if (!byWorker.has(k)) byWorker.set(k, []);
    byWorker.get(k).push(p);
  }

  // projectId -> { standardHours, overrides: Map(workerId -> {name, rate, hours}) }
  const agg = new Map();
  const flags = [];
  let lunchTotal = 0;

  for (const [wid, wp] of byWorker) {
    const worker = workersById[wid] || { WorkerID: wid };
    const s = summarizeWorkerWeek({ worker, sub: null, punches: wp, weekStartMonday: weekStart });
    s.flags.forEach((f) => flags.push({ worker: nameOf(worker), ...f }));

    for (const d of s.days) {
      const dayTotal = Object.values(d.projectHours).reduce((a, b) => a + b, 0);
      if (dayTotal <= 0) continue;
      const billable = Math.max(0, dayTotal - LUNCH_HOURS);
      lunchTotal += Math.min(LUNCH_HOURS, dayTotal);
      const factor = dayTotal > 0 ? billable / dayTotal : 0; // spread lunch across the day's projects

      for (const [proj, hrs] of Object.entries(d.projectHours)) {
        if (!projIds.has(proj)) continue;
        const adj = hrs * factor;
        if (!agg.has(proj)) agg.set(proj, { standardHours: 0, overrides: new Map() });
        const a = agg.get(proj);
        const override = num(worker.GCRateOverride);
        if (override !== null) {
          const o = a.overrides.get(wid) || { name: nameOf(worker), rate: override, hours: 0 };
          o.hours += adj;
          a.overrides.set(wid, o);
        } else {
          a.standardHours += adj;
        }
      }
    }
  }

  const projects = [...agg.entries()].map(([pid, a]) => {
    const proj = projById[pid];
    const gcRate = num(proj && proj.GCRate) || 0;
    const standard = a.standardHours > 0
      ? { hours: round2(a.standardHours), rate: gcRate, amount: round2(a.standardHours * gcRate) }
      : null;
    const overrides = [...a.overrides.values()].map((o) => ({
      worker: o.name, hours: round2(o.hours), rate: o.rate, amount: round2(o.hours * o.rate),
    }));
    const hours = round2(a.standardHours + [...a.overrides.values()].reduce((s, o) => s + o.hours, 0));
    const amount = round2((standard ? standard.amount : 0) + overrides.reduce((s, o) => s + o.amount, 0));
    return { projectId: pid, name: (proj && proj.SiteName) || pid, standard, overrides, hours, amount };
  }).sort((x, y) => x.name.localeCompare(y.name));

  return {
    gcName, weekStart, weekEnd: end, costCode: COST_CODE_GC,
    lunchHours: round2(lunchTotal),
    projects,
    total: round2(projects.reduce((s, p) => s + p.amount, 0)),
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
export function buildQBInvoice({ sub, workers, punches, projectsById = {}, weekStart, carpentryRate = QB_RATE }) {
  const { end } = weekRange(weekStart);
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
      const dayHours = Object.values(d.projectHours).reduce((a, b) => a + b, 0);
      if (dayHours > 0) {
        if (!roster.has(d.date)) roster.set(d.date, new Set());
        roster.get(d.date).add(firstNameOf(w));
      }
      for (const [proj, hrs] of Object.entries(d.projectHours)) {
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

  const wk = weekLabelSlash(weekStart);
  const lines = [];
  const projList = [...agg.entries()]
    .map(([pid, a]) => ({ name: (projectsById[pid] && projectsById[pid].SiteName) || pid, a }))
    .sort((x, y) => x.name.localeCompare(y.name));
  for (const { name, a } of projList) {
    if (a.carpentry > 0) {
      const qty = round2(a.carpentry);
      lines.push({ item: 'Carpentry', description: `${name} – Week of ${wk}`, qty, rate: carpentryRate, amount: round2(qty * carpentryRate) });
    }
    for (const o of a.overrides.values()) {
      const qty = round2(o.hours);
      lines.push({ item: 'General Labor', description: `${o.name} – ${name} – Week of ${wk}`, qty, rate: o.rate, amount: round2(qty * o.rate) });
    }
  }

  return {
    subId: sub && String(sub.SubID).trim(),
    company: sub && sub.CompanyName,
    weekStart, weekEnd: end,
    lines,
    totalHours: round2(lines.reduce((s, l) => s + l.qty, 0)),
    total: round2(lines.reduce((s, l) => s + l.amount, 0)),
    days: rosterDays(roster),
    flags,
  };
}

// "2026-07-06" -> "07/06/26" (for QB line-item "Week of ..." descriptions).
function weekLabelSlash(iso) {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y.slice(2)}`;
}
