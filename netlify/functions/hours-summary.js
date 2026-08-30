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
import { subGuarantee, creditWorker } from './lib/dayrate.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Pure aggregation — no I/O. Given the raw tab rows + a date range, produce the
// per-project / per-worker hours and the issues list. Exported for unit tests.
export function summarize({ workers, projects, punches, subs, from, to, today }) {
  const projName = {};
  projects.forEach((p) => { projName[String(p.ProjectID).trim()] = p.SiteName || String(p.ProjectID).trim(); });
  const subName = {};
  const subById = {};
  subs.forEach((s) => { const id = String(s.SubID).trim(); subName[id] = s.CompanyName || ''; subById[id] = s; });
  const wMeta = {};
  workers.forEach((w) => {
    const subId = String(w.SubID).trim();
    wMeta[String(w.WorkerID).trim()] = {
      name: (w.Nickname && String(w.Nickname).trim()) || w.First || String(w.WorkerID).trim(),
      sub: subName[subId] || '', subId,
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
  const shifts = []; // one row per worker shift: paired in→out, plus broken (unpaired) rows
  const credit = []; // Guaranteed Day: per-worker-per-day credit rows (additive; §4b)
  let totalHours = 0;

  const pName = (pid) => projName[String(pid || '').trim()] || '';
  // per-punch adjustment attribution (who/when), forward-only (blank on unedited/old rows)
  const pe = (p) => ({
    edited: String((p && p.Edited) || '').trim().toUpperCase() === 'Y',
    editedBy: (p && p.EditedBy) || '',
    editedAt: (p && p.EditedAt) || '',
  });

  for (const [wid, plist] of byWorker) {
    const days = workerDays(plist); // { 'YYYY-MM-DD': { hours, projectHours, unpaired, ... } }
    const wm = wMeta[wid] || {};
    let wHours = 0; const wByProject = {};
    for (const date of Object.keys(days)) {
      if (!inRange(date)) continue;
      const d = days[date];
      wHours += d.hours;
      for (const [pid, h] of Object.entries(d.projectHours)) {
        wByProject[pid] = round2((wByProject[pid] || 0) + h);
        projTotals[pid] = round2((projTotals[pid] || 0) + h);
      }
      // paired shifts (in → out)
      d.intervals.forEach((iv) => {
        const ein = pe(iv.in), eout = pe(iv.out);
        shifts.push({
          date, workerId: wid, name: wm.name || wid, sub: wm.sub || '',
          projectId: String(iv.project || '').trim(), project: pName(iv.project),
          inAt: (iv.in && iv.in.Timestamp) || '', outAt: (iv.out && iv.out.Timestamp) || '',
          punchInId: (iv.in && iv.in.PunchID) || '', punchOutId: (iv.out && iv.out.PunchID) || '',
          inEdited: ein.edited, inEditedBy: ein.editedBy, inEditedAt: ein.editedAt,
          outEdited: eout.edited, outEditedBy: eout.editedBy, outEditedAt: eout.editedAt,
          hours: round2(iv.minutes / 60), issue: null, today: date === today,
        });
      });
      // broken shifts (an unpaired punch) — become a red row with the Fix button
      d.unpaired.forEach((u) => {
        const p = u.punch || {};
        const isOut = String(p.Action || '').trim().toUpperCase() === 'OUT';
        const e = pe(p);
        shifts.push({
          date, workerId: wid, name: wm.name || wid, sub: wm.sub || '',
          projectId: String(p.Project || '').trim(), project: pName(p.Project),
          inAt: isOut ? '' : (p.Timestamp || ''), outAt: isOut ? (p.Timestamp || '') : '',
          punchInId: isOut ? '' : (p.PunchID || ''), punchOutId: isOut ? (p.PunchID || '') : '',
          inEdited: isOut ? false : e.edited, inEditedBy: isOut ? '' : e.editedBy, inEditedAt: isOut ? '' : e.editedAt,
          outEdited: isOut ? e.edited : false, outEditedBy: isOut ? e.editedBy : '', outEditedAt: isOut ? e.editedAt : '',
          hours: 0, issue: u.reason, punchId: p.PunchID || '', punchAction: p.Action || '',
          today: date === today,
        });
      });
      d.unpaired.forEach((u) => {
        const e = pe(u.punch);
        issues.push({
          date, workerId: wid,
          name: (wMeta[wid] || {}).name || wid,
          sub: (wMeta[wid] || {}).sub || '',
          reason: u.reason, // 'missing clock-out' | 'clock-out with no clock-in' | 'clock-out not after clock-in'
          project: projName[String((u.punch && u.punch.Project) || '').trim()] || '',
          // identifiers so an admin can fix this exact punch from Slab:
          punchId: (u.punch && u.punch.PunchID) || '',
          at: (u.punch && u.punch.Timestamp) || '',
          punchAction: (u.punch && u.punch.Action) || '',
          projectId: String((u.punch && u.punch.Project) || '').trim(),
          edited: e.edited, editedBy: e.editedBy, editedAt: e.editedAt,
          today: date === today, // today's 'missing clock-out' = still on the clock, NOT an error
        });
      });
    }
    // Guaranteed Day credit rows (§4b) — additive; shifts[] and actual clocked
    // hours are never touched. Only for workers whose sub has the policy ON; the
    // per-job `byJob` split sums exactly to each day's uplift (Q4).
    const rule = subGuarantee(subById[wm.subId]);
    if (rule) {
      const rangeDays = Object.keys(days).filter(inRange).sort()
        .map((date) => ({ date, intervals: days[date].intervals }));
      for (const r of creditWorker({ days: rangeDays, rule }).rows) {
        if (r.billable <= 0 && r.clocked <= 0) continue; // skip pure-issue days (no worked interval)
        credit.push({
          date: r.date, workerId: wid, name: wm.name || wid, sub: wm.sub || '',
          clocked: r.clocked, billable: r.billable, credited: r.credited, uplift: r.uplift,
          qualified: r.qualified, byJob: r.byJob,
          rule: { hours: rule.hours, min: rule.min, basis: 'clocked' },
        });
      }
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
  shifts.sort((a, b) => String(a.date).localeCompare(b.date)
    || String(a.sub).localeCompare(b.sub)
    || String(a.name).localeCompare(b.name)
    || String(a.inAt || a.outAt).localeCompare(b.inAt || b.outAt));
  // subs that actually have punches this range, for the table tabs
  const subsList = [...new Set(shifts.map((s) => s.sub).filter(Boolean))].sort();
  credit.sort((a, b) => String(a.date).localeCompare(b.date) || String(a.name).localeCompare(b.name));

  return {
    ok: true, from, to, today, totalHours, perProject, perWorker, issues, shifts, credit, subs: subsList,
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
