// GET /api/hours-summary?from=YYYY-MM-DD&to=YYYY-MM-DD&token=<ADMIN_TOKEN>
// Admin-only, READ-ONLY. Per-project + per-worker hours and the punch "issues"
// (unpaired) list for any date range. Reuses rollup.js so pairing/issue logic
// stays in ONE place. Powers Slab's Control Center (Timeclock) page.
//
// The pairing/aggregation is split into a pure `summarize()` (unit-tested in
// test/hours-summary.test.js) and a thin handler that reads the sheet tabs.
import { json, query, guard } from './lib/http.js';
import { readTab } from './lib/sheets.js';
import { TABS } from './lib/config.js';
import { etToday } from './lib/model.js';
import { workerDays, mondayOf } from './lib/rollup.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Pure aggregation — no I/O. Given the raw tab rows + a date range, produce the
// per-project / per-worker hours and the issues list. Exported for unit tests.
export function summarize({ workers, projects, punches, subs, from, to, today }) {
  const projName = {};
  projects.forEach((p) => { projName[String(p.ProjectID).trim()] = p.SiteName || String(p.ProjectID).trim(); });
  const subName = {};
  subs.forEach((s) => { subName[String(s.SubID).trim()] = s.CompanyName || ''; });
  const wMeta = {};
  workers.forEach((w) => {
    wMeta[String(w.WorkerID).trim()] = {
      name: (w.Nickname && String(w.Nickname).trim()) || w.First || String(w.WorkerID).trim(),
      sub: subName[String(w.SubID).trim()] || '',
    };
  });

  const byWorker = new Map();
  punches.forEach((p) => {
    const k = String(p.WorkerID).trim();
    if (!byWorker.has(k)) byWorker.set(k, []);
    byWorker.get(k).push(p);
  });

  const inRange = (d) => d >= from && d <= to;
  const projTotals = {};
  const perWorker = [];
  const issues = [];
  let totalHours = 0;

  for (const [wid, plist] of byWorker) {
    const days = workerDays(plist); // { 'YYYY-MM-DD': { hours, projectHours, unpaired, ... } }
    let wHours = 0; const wByProject = {};
    for (const date of Object.keys(days)) {
      if (!inRange(date)) continue;
      const d = days[date];
      wHours += d.hours;
      for (const [pid, h] of Object.entries(d.projectHours)) {
        wByProject[pid] = round2((wByProject[pid] || 0) + h);
        projTotals[pid] = round2((projTotals[pid] || 0) + h);
      }
      d.unpaired.forEach((u) => issues.push({
        date, workerId: wid,
        name: (wMeta[wid] || {}).name || wid,
        sub: (wMeta[wid] || {}).sub || '',
        reason: u.reason, // 'missing clock-out' | 'clock-out with no clock-in' | 'clock-out not after clock-in'
        project: projName[String((u.punch && u.punch.Project) || '').trim()] || '',
        today: date === today, // today's 'missing clock-out' = still on the clock, NOT an error
      }));
    }
    if (wHours > 0 || Object.keys(wByProject).length) {
      wHours = round2(wHours);
      totalHours = round2(totalHours + wHours);
      perWorker.push({ workerId: wid, name: (wMeta[wid] || {}).name || wid, sub: (wMeta[wid] || {}).sub || '', hours: wHours, byProject: wByProject });
    }
  }

  const perProject = Object.entries(projTotals)
    .map(([pid, hours]) => ({ projectId: pid, name: projName[pid] || pid, hours: round2(hours) }))
    .sort((a, b) => b.hours - a.hours);
  perWorker.sort((a, b) => b.hours - a.hours);
  issues.sort((a, b) => (Number(a.today) - Number(b.today)) || String(a.date).localeCompare(b.date));

  return {
    ok: true, from, to, today, totalHours, perProject, perWorker, issues,
    counts: {
      workers: perWorker.length,
      projects: perProject.length,
      // "real" issues = exclude today's still-on-the-clock open shifts
      issues: issues.filter((i) => !(i.today && i.reason === 'missing clock-out')).length,
    },
  };
}

export default guard(async (req) => {
  const token = query(req, 'token');
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return json(403, { ok: false, error: 'ADMIN_TOKEN is not configured' });
  if (token !== expected) return json(401, { ok: false, error: 'Unauthorized' });

  const today = etToday();
  const from = query(req, 'from') || mondayOf(today); // default: this billing week
  const to = query(req, 'to') || today;

  const [{ rows: workers }, { rows: projects }, { rows: punches }, { rows: subs }] =
    await Promise.all([
      readTab(TABS.WORKERS), readTab(TABS.PROJECTS),
      readTab(TABS.PUNCHES), readTab(TABS.SUBS),
    ]);

  return json(200, summarize({ workers, projects, punches, subs, from, to, today }));
});
