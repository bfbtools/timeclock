// POST /api/punch-delete  { workerId, actingId, pin, punchId }
// Remove a punch from the Time Log. PIN-gated (self, or an owner acting on a
// crew member — same rules as editing), can only remove that worker's own
// punch, and only within the rolling edit window.

import { json, body, guard } from './lib/http.js';
import { authEdit, editWindowStart } from './lib/model.js';
import { readTab, deleteRow } from './lib/sheets.js';
import { TABS } from './lib/config.js';
import { dayKey } from './lib/rollup.js';

export default guard(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const { workerId, actingId, pin, punchId } = await body(req);

  const auth = await authEdit({ targetId: workerId, actingId, pin });
  if (auth.error) return json(auth.status, { ok: false, error: auth.error });

  const { rows } = await readTab(TABS.PUNCHES);
  const punch = rows.find((p) => String(p.PunchID).trim() === String(punchId).trim());
  if (!punch) return json(404, { ok: false, error: 'Punch not found' });
  if (String(punch.WorkerID).trim() !== String(workerId).trim()) {
    return json(403, { ok: false, error: 'Not this worker’s punch' });
  }
  if (dayKey(punch.Timestamp) < editWindowStart()) {
    return json(403, { ok: false, error: 'That day is outside the 2-week edit window' });
  }

  await deleteRow(TABS.PUNCHES, punch._rowNumber);
  return json(200, { ok: true });
});
