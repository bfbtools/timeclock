// GET /api/team?ownerId=&pin=
// Owner-only: the owner's sub crew (self + employees) with current-week and
// today hours, for the Team screen where a Sub/Owner edits their crew's hours.

import { json, query, guard } from './lib/http.js';
import {
  getWorkerById, getWorkersBySub, getPunchesForWorkers,
  currentWeekHours, displayName, etToday,
} from './lib/model.js';
import { mondayOf, weekRange } from './lib/rollup.js';

export default guard(async (req) => {
  const ownerId = query(req, 'ownerId');
  const pin = query(req, 'pin');

  const owner = await getWorkerById(ownerId);
  if (!owner) return json(404, { ok: false, error: 'Worker not found' });
  if (String(owner.PIN || '').trim() !== String(pin || '').trim()) {
    return json(401, { ok: false, error: 'Wrong PIN' });
  }
  if (String(owner.Type || '').trim().toLowerCase() !== 'owner') {
    return json(403, { ok: false, error: 'Owners only' });
  }

  const crew = await getWorkersBySub(owner.SubID); // active workers in the sub (incl. owner)
  const ids = crew.map((w) => String(w.WorkerID).trim());
  const today = etToday();
  const weekStart = mondayOf(today);
  const { end: weekEnd } = weekRange(weekStart);
  const punches = await getPunchesForWorkers(ids, weekStart, weekEnd);

  const byWorker = new Map();
  punches.forEach((p) => {
    const k = String(p.WorkerID).trim();
    if (!byWorker.has(k)) byWorker.set(k, []);
    byWorker.get(k).push(p);
  });

  const members = crew.map((w) => {
    const id = String(w.WorkerID).trim();
    const list = byWorker.get(id) || [];
    return {
      id,
      name: displayName(w),
      type: String(w.Type || 'employee').trim().toLowerCase(),
      self: id === String(ownerId).trim(),
      weekHours: currentWeekHours(list, weekStart, weekEnd),
      todayHours: currentWeekHours(list, today, today),
    };
  });
  members.sort((a, b) => (b.self ? 1 : 0) - (a.self ? 1 : 0)); // owner first

  return json(200, { ok: true, members });
});
