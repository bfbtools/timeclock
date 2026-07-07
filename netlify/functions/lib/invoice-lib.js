// Invoice builder — pure functions over rollup output. Used by the live
// "Invoice Draft" tab (Step 4) and the Saturday auto-send (Step 5).
//
// The SUB invoice is what BFB pays the sub: one line per project
// (hours × pay rate) with a per-day breakdown, plus a Materials line if any.
// No lunch deduction here — lunch applies only to the GC invoice (Step 5).

import { num, weekRange, summarizeWorkerWeek } from './rollup.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const nameOf = (w) => (w.Nickname && String(w.Nickname).trim()) || w.First || '';

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
    materials: mats, materialsTotal,
    total: round2(laborTotal + materialsTotal),
    flags,
  };
}
