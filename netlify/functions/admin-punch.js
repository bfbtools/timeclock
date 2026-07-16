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
import { readTab, updateRow, deleteRow } from './lib/sheets.js';
import { TABS } from './lib/config.js';
import { appendPunch } from './lib/model.js';

// "YYYY-MM-DDTHH:mm[:ss]" (or space form) → "YYYY-MM-DD HH:mm:ss". Exported for tests.
export function normStamp(at) {
  let s = String(at || '').replace('T', ' ').slice(0, 19);
  if (s.length === 16) s += ':00';
  return s;
}

export default guard(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const token = query(req, 'token');
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return json(403, { ok: false, error: 'ADMIN_TOKEN is not configured' });
  if (token !== expected) return json(401, { ok: false, error: 'Unauthorized' });

  const { op, punchId, workerId, action, at, projectId } = await body(req);

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
    const patch = { Timestamp: stamp, Source: 'manual', Edited: 'Y' };
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
    const row = await appendPunch({ project, worker, sub: worker.SubID, action, stamp, missed: true });
    return json(200, { ok: true, op, at: stamp, punchId: row.PunchID });
  }

  return json(400, { ok: false, error: 'unknown op (use add | edit | delete)' });
});
