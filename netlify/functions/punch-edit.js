// POST /api/punch-edit  { workerId, pin, punchId, at, action? }
// Edit an existing punch's time (and optionally IN/OUT) from the Time Log —
// allowed offsite. PIN-gated, can only edit your own punches, and refuses once
// the week has locked (past the Saturday cutoff). Edited punches are marked
// Source=manual, Edited=Y so corrections are visible for review.

import { json, body, guard } from './lib/http.js';
import { getWorkerById, etToday } from './lib/model.js';
import { readTab, updateRow } from './lib/sheets.js';
import { TABS } from './lib/config.js';
import { mondayOf, weekRange, dayKey } from './lib/rollup.js';

export default guard(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const { workerId, pin, punchId, at, action } = await body(req);

  const worker = await getWorkerById(workerId);
  if (!worker) return json(404, { ok: false, error: 'Worker not found' });
  if (String(worker.PIN || '').trim() !== String(pin || '').trim()) {
    return json(401, { ok: false, error: 'Wrong PIN' });
  }

  const { rows } = await readTab(TABS.PUNCHES);
  const punch = rows.find((p) => String(p.PunchID).trim() === String(punchId).trim());
  if (!punch) return json(404, { ok: false, error: 'Punch not found' });
  if (String(punch.WorkerID).trim() !== String(workerId).trim()) {
    return json(403, { ok: false, error: 'Not your punch' });
  }

  // Normalize the new timestamp ("YYYY-MM-DDTHH:mm[:ss]" → "YYYY-MM-DD HH:mm:ss").
  let stamp = String(at || '').replace('T', ' ').slice(0, 19);
  if (stamp.length === 16) stamp += ':00';
  if (stamp.length < 16) return json(400, { ok: false, error: 'Invalid time' });

  // Refuse edits to a locked (already-closed) week.
  const { end } = weekRange(mondayOf(dayKey(stamp)));
  if (etToday() > end) return json(403, { ok: false, error: 'That week is closed and locked' });

  const patch = { Timestamp: stamp, Source: 'manual', Edited: 'Y' };
  if (action === 'IN' || action === 'OUT') patch.Action = action;
  await updateRow(TABS.PUNCHES, punch._rowNumber, patch);

  return json(200, { ok: true, at: stamp });
});
