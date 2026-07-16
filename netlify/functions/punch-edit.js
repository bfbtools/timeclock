// POST /api/punch-edit  { workerId, pin, punchId, at, action? }
// Edit an existing punch's time (and optionally IN/OUT) from the Time Log —
// allowed offsite. PIN-gated, can only edit your own punches, and refuses once
// the day falls outside the rolling edit window (see EDIT_WINDOW_DAYS). Edited
// punches are marked Source=manual, Edited=Y so corrections are visible.

import { json, body, guard } from './lib/http.js';
import { authEdit, editWindowStart, etStamp, displayName } from './lib/model.js';
import { readTab, updateRow } from './lib/sheets.js';
import { TABS } from './lib/config.js';
import { dayKey } from './lib/rollup.js';

export default guard(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const { workerId, actingId, pin, punchId, at, action } = await body(req);

  // Self, or an owner editing one of their sub's workers.
  const auth = await authEdit({ targetId: workerId, actingId, pin });
  if (auth.error) return json(auth.status, { ok: false, error: auth.error });

  const { rows } = await readTab(TABS.PUNCHES);
  const punch = rows.find((p) => String(p.PunchID).trim() === String(punchId).trim());
  if (!punch) return json(404, { ok: false, error: 'Punch not found' });
  if (String(punch.WorkerID).trim() !== String(workerId).trim()) {
    return json(403, { ok: false, error: 'Not this worker’s punch' });
  }

  // Normalize the new timestamp ("YYYY-MM-DDTHH:mm[:ss]" → "YYYY-MM-DD HH:mm:ss").
  let stamp = String(at || '').replace('T', ' ').slice(0, 19);
  if (stamp.length === 16) stamp += ':00';
  if (stamp.length < 16) return json(400, { ok: false, error: 'Invalid time' });

  // Refuse edits to a day outside the rolling edit window.
  if (dayKey(stamp) < editWindowStart()) {
    return json(403, { ok: false, error: 'That day is outside the 2-week edit window' });
  }

  const patch = { Timestamp: stamp, Source: 'manual', Edited: 'Y', EditedAt: etStamp(), EditedBy: displayName(auth.acting) };
  if (action === 'IN' || action === 'OUT') patch.Action = action;
  await updateRow(TABS.PUNCHES, punch._rowNumber, patch);

  return json(200, { ok: true, at: stamp });
});
