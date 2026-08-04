// POST /api/admin-punch?token=<ADMIN_TOKEN>
//   { op:'add'|'edit'|'delete', punchId?, workerId?, action?, at?, projectId? }
// Admin-only (ADMIN_TOKEN), NOT PIN-gated — lets Adrienne fix punch issues from
// Slab's control center when a worker asks her to. Reuses the same row helpers
// as the worker flows, so corrections are marked Source=manual, Edited=Y.
//
// Unlike the worker punch-edit/delete/add endpoints, this has NO 2-week window
// limit (admin override); Slab warns in the UI when the day is a past week.
//
//   add    — append a punch (e.g. the missing clock-out). Resolves the project
//            from `projectId`, or from the referenced `punchId`'s project.
//   edit   — change an existing punch's Timestamp (and optionally Action).
//   delete — remove a punch (e.g. an orphan clock-out).
import { json, body, query, guard } from './lib/http.js';
import { readTab, updateRow, deleteRow, appendRow } from './lib/sheets.js';
import { TABS } from './lib/config.js';
import { appendPunch, etStamp, getWorkerById, getSubsById, isActive, displayName } from './lib/model.js';

// "YYYY-MM-DDTHH:mm[:ss]" (or space form) → "YYYY-MM-DD HH:mm:ss". Exported for tests.
export function normStamp(at) {
  let s = String(at || '').replace('T', ' ').slice(0, 19);
  if (s.length === 16) s += ':00';
  return s;
}

// Admin PIN input → { ok, value } or { ok:false, error }. '' clears the PIN
// (worker then self-sets in the app); a 4-digit string sets it. Exported for tests.
export function normPin(pin) {
  const raw = (pin == null) ? '' : String(pin).trim();
  if (raw && !/^\d{4}$/.test(raw)) return { ok: false, error: 'PIN must be 4 digits (or empty to clear)' };
  return { ok: true, value: raw };
}

// Truthy Active/flag input → 'Y' | 'N'. Exported for tests.
export function toYN(v) {
  return (v === true || ['y', 'yes', 'true', '1'].includes(String(v).trim().toLowerCase())) ? 'Y' : 'N';
}

export default guard(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const token = query(req, 'token');
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return json(403, { ok: false, error: 'ADMIN_TOKEN is not configured' });
  if (token !== expected) return json(401, { ok: false, error: 'Unauthorized' });

  const b = await body(req);
  const { op, punchId, workerId, action, at, projectId, editedBy } = b;
  const who = (editedBy && String(editedBy).trim()) || 'Office'; // Slab passes the active profile name; else "Office"

  if (op === 'delete') {
    if (!punchId) return json(400, { ok: false, error: 'punchId required' });
    const { rows } = await readTab(TABS.PUNCHES);
    const p = rows.find((r) => String(r.PunchID).trim() === String(punchId).trim());
    if (!p) return json(404, { ok: false, error: 'Punch not found' });
    await deleteRow(TABS.PUNCHES, p._rowNumber);
    return json(200, { ok: true, op, punchId });
  }

  if (op === 'edit') {
    if (!punchId) return json(400, { ok: false, error: 'punchId required' });
    const stamp = normStamp(at);
    if (stamp.length < 16) return json(400, { ok: false, error: 'Invalid time' });
    const { rows } = await readTab(TABS.PUNCHES);
    const p = rows.find((r) => String(r.PunchID).trim() === String(punchId).trim());
    if (!p) return json(404, { ok: false, error: 'Punch not found' });
    const patch = { Timestamp: stamp, Source: 'manual', Edited: 'Y', EditedAt: etStamp(), EditedBy: who };
    if (action === 'IN' || action === 'OUT') patch.Action = action;
    await updateRow(TABS.PUNCHES, p._rowNumber, patch);
    return json(200, { ok: true, op, at: stamp });
  }

  if (op === 'add') {
    if (action !== 'IN' && action !== 'OUT') return json(400, { ok: false, error: 'action must be IN or OUT' });
    const stamp = normStamp(at);
    if (stamp.length < 16) return json(400, { ok: false, error: 'Invalid time' });
    const [{ rows: workers }, { rows: projects }, { rows: punches }] = await Promise.all([
      readTab(TABS.WORKERS), readTab(TABS.PROJECTS), readTab(TABS.PUNCHES),
    ]);
    const worker = workers.find((w) => String(w.WorkerID).trim() === String(workerId || '').trim());
    if (!worker) return json(404, { ok: false, error: 'Worker not found' });
    // Resolve the project: explicit projectId, else inherit from the referenced punch.
    let pid = projectId;
    if (!pid && punchId) {
      const rp = punches.find((r) => String(r.PunchID).trim() === String(punchId).trim());
      pid = rp && rp.Project;
    }
    const proj = projects.find((pr) => String(pr.ProjectID).trim() === String(pid || '').trim());
    const project = proj
      ? { SiteName: proj.SiteName, ProjectID: proj.ProjectID }
      : (pid ? { SiteName: '', ProjectID: pid } : null);
    // Double-submit guard: `punches` is the current tab — swallow a duplicate add.
    const row = await appendPunch({ project, worker, sub: worker.SubID, action, stamp, missed: true, editedBy: who, editedAt: etStamp(), dedupeAgainst: punches });
    return json(200, { ok: true, op, at: stamp, punchId: row.PunchID, deduped: !!row._deduped });
  }

  // add-worker — create a new employee under a sub AND backfill a week of hours in
  // one shot (for workers who don't clock in — the office logs them). Writes a
  // Workers row (PayRateOverride = their rate) then IN/OUT punch pairs per day, so
  // the weekly invoice generator rolls them up like any other worker.
  //   { op:'add-worker', first, nickname?, subName, payRate?, days:[{date,projectId,hours}] }
  if (op === 'add-worker') {
    const first = String(b.first || '').trim();
    const nickname = String(b.nickname || '').trim();
    const subName = String(b.subName || '').trim();
    const payRate = (b.payRate === '' || b.payRate == null) ? '' : b.payRate;
    const days = Array.isArray(b.days) ? b.days : [];
    if (!first && !nickname) return json(400, { ok: false, error: 'a name is required' });
    if (!subName) return json(400, { ok: false, error: 'a sub is required' });

    const [{ rows: subs }, { rows: projects }] = await Promise.all([readTab(TABS.SUBS), readTab(TABS.PROJECTS)]);
    const sub = subs.find((s) => String(s.CompanyName || '').trim().toLowerCase() === subName.toLowerCase());
    if (!sub) return json(404, { ok: false, error: 'sub not found: ' + subName });

    const wid = `W-${Date.now()}${Math.floor(Math.random() * 100)}`;
    await appendRow(TABS.WORKERS, {
      WorkerID: wid, First: first, Nickname: nickname, SubID: sub.SubID,
      PayRateOverride: payRate, Type: 'employee', Active: 'Y',
    });

    const worker = { WorkerID: wid, SubID: sub.SubID, First: first, Nickname: nickname };
    const pad = (n) => String(n).padStart(2, '0');
    let daysLogged = 0, punches = 0;
    for (const d of days) {
      const hrs = Number(d && d.hours) || 0;
      const date = String((d && d.date) || '').slice(0, 10);
      if (hrs <= 0 || date.length !== 10) continue;
      const proj = projects.find((p) => String(p.ProjectID).trim() === String((d && d.projectId) || '').trim());
      const project = proj ? { SiteName: proj.SiteName, ProjectID: proj.ProjectID } : null;
      const startMin = 7 * 60;                          // clock IN at 07:00
      let endMin = startMin + Math.round(hrs * 60);     // OUT = start + hours
      if (endMin > 1439) endMin = 1439;                 // clamp within the day
      const inStamp = `${date} 07:00:00`;
      const outStamp = `${date} ${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}:00`;
      await appendPunch({ project, worker, sub: sub.SubID, action: 'IN', stamp: inStamp, missed: true, editedBy: who, editedAt: etStamp() });
      await appendPunch({ project, worker, sub: sub.SubID, action: 'OUT', stamp: outStamp, missed: true, editedBy: who, editedAt: etStamp() });
      daysLogged++; punches += 2;
    }
    return json(200, { ok: true, op, workerId: wid, worker: nickname || first, subId: sub.SubID, daysLogged, punches });
  }

  // ---- Worker admin (Slab Directory: sub employees) ---------------------------
  // list-workers — full Workers rows (optionally scoped to one sub via subId or
  //   subName), for the Directory crew editor. The PIN value is NEVER returned —
  //   only `hasPin` — so it can't reach the browser; use set-pin to change it.
  //   Includes INACTIVE workers so the office can reactivate them.
  //   { op:'list-workers', subId? , subName? }
  if (op === 'list-workers') {
    const { rows } = await readTab(TABS.WORKERS);
    const subsById = await getSubsById();
    const wantSub = String(b.subId || '').trim();
    const wantName = String(b.subName || '').trim().toLowerCase();
    const workers = rows
      .filter((w) => String(w.WorkerID || '').trim())
      .filter((w) => {
        if (wantSub) return String(w.SubID || '').trim() === wantSub;
        if (wantName) {
          const s = subsById.get(String(w.SubID || '').trim());
          return s && String(s.CompanyName || '').trim().toLowerCase() === wantName;
        }
        return true;
      })
      .map((w) => {
        const s = subsById.get(String(w.SubID || '').trim());
        return {
          workerId: String(w.WorkerID).trim(),
          type: String(w.Type || '').trim(),
          first: w.First || '',
          last: w.Last || '',
          nickname: w.Nickname || '',
          name: displayName(w),
          email: w.Email || '',
          subId: String(w.SubID || '').trim(),
          subCompany: s ? (s.CompanyName || '') : '',
          payRateOverride: (w.PayRateOverride === '' || w.PayRateOverride == null) ? '' : w.PayRateOverride,
          gcRateOverride: (w.GCRateOverride === '' || w.GCRateOverride == null) ? '' : w.GCRateOverride,
          active: isActive(w),
          hasPin: !!String(w.PIN || '').trim(),
          pendingReview: String(w['Pending Review'] || '').trim().toUpperCase() === 'Y',
        };
      });
    return json(200, { ok: true, op, count: workers.length, workers });
  }

  // edit-worker — patch a worker's profile by WorkerID. Only provided fields
  //   change. `active:false` deactivates (drops from clock-in + rollups).
  //   { op:'edit-worker', workerId, first?, last?, nickname?, email?, payRate?, gcRate?, type?, active? }
  if (op === 'edit-worker') {
    if (!workerId) return json(400, { ok: false, error: 'workerId required' });
    const w = await getWorkerById(workerId);
    if (!w) return json(404, { ok: false, error: 'Worker not found' });
    const patch = {};
    const setStr = (key, col) => { if (b[key] !== undefined) patch[col] = String(b[key] == null ? '' : b[key]).trim(); };
    setStr('first', 'First');
    setStr('last', 'Last');
    setStr('nickname', 'Nickname');
    setStr('email', 'Email');
    setStr('payRate', 'PayRateOverride');
    setStr('gcRate', 'GCRateOverride');
    setStr('type', 'Type');
    if (b.active !== undefined) patch.Active = toYN(b.active);
    if (b.pendingReview !== undefined) patch['Pending Review'] = toYN(b.pendingReview) === 'Y' ? 'Y' : '';
    if (!Object.keys(patch).length) return json(400, { ok: false, error: 'no fields to update' });
    await updateRow(TABS.WORKERS, w._rowNumber, patch);
    return json(200, { ok: true, op, workerId: String(w.WorkerID).trim(), updated: Object.keys(patch) });
  }

  // set-pin — admin set OR clear a worker's PIN. Empty/absent pin CLEARS it so the
  //   worker sets their own in the mobile app (self-serve set-PIN flow); a 4-digit
  //   pin sets it directly. Unlike /api/auth this CAN overwrite an existing PIN.
  //   { op:'set-pin', workerId, pin? }   // pin omitted/'' → clear
  if (op === 'set-pin') {
    if (!workerId) return json(400, { ok: false, error: 'workerId required' });
    const w = await getWorkerById(workerId);
    if (!w) return json(404, { ok: false, error: 'Worker not found' });
    const { ok: pinOk, value: pinVal, error: pinErr } = normPin(b.pin);
    if (!pinOk) return json(400, { ok: false, error: pinErr });
    await updateRow(TABS.WORKERS, w._rowNumber, { PIN: pinVal });
    return json(200, { ok: true, op, workerId: String(w.WorkerID).trim(), hasPin: !!pinVal, cleared: !pinVal });
  }

  return json(400, { ok: false, error: 'unknown op (use add | edit | delete | add-worker | list-workers | edit-worker | set-pin)' });
});
