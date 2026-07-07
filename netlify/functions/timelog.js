// GET /api/timelog?workerId=&pin=
// PIN-gated. Returns the worker's current Mon–Sat week: each day's paired hours
// and individual punches, weekly total, review flags, and whether the week is
// locked (read-only after the Saturday cutoff). Manual/edited punches are
// marked so the Time Log can show them as flagged.

import { json, query, guard } from './lib/http.js';
import { getWorkerById, etToday, displayName } from './lib/model.js';
import { getPunchesForWorkers } from './lib/model.js';
import { mondayOf, weekRange, dayKey, pairDay, summarizeWorkerWeek } from './lib/rollup.js';

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function datesInclusive(start, end) {
  const out = []; const d = new Date(start + 'T00:00:00'); const e = new Date(end + 'T00:00:00');
  while (d <= e) { out.push(iso(d)); d.setDate(d.getDate() + 1); }
  return out;
}
function hhmm(stamp) { return String(stamp).slice(11, 16); } // "HH:mm"

export default guard(async (req) => {
  const workerId = query(req, 'workerId');
  const pin = query(req, 'pin');

  const worker = await getWorkerById(workerId);
  if (!worker) return json(404, { ok: false, error: 'Worker not found' });
  if (String(worker.PIN || '').trim() !== String(pin || '').trim()) {
    return json(401, { ok: false, error: 'Wrong PIN' });
  }

  const weekStart = mondayOf(etToday());
  const { end: weekEnd } = weekRange(weekStart);
  const locked = etToday() > weekEnd; // past the Saturday cutoff

  const punches = await getPunchesForWorkers([workerId], weekStart, weekEnd);
  const byDay = new Map();
  punches.forEach((p) => {
    const k = dayKey(p.Timestamp);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(p);
  });

  const days = datesInclusive(weekStart, weekEnd).map((date) => {
    const dayPunches = byDay.get(date) || [];
    const paired = pairDay(dayPunches);
    return {
      date,
      hours: paired.hours,
      unpaired: paired.unpaired.length,
      punches: dayPunches
        .map((p) => ({
          time: hhmm(p.Timestamp),
          action: String(p.Action).toUpperCase(),
          manual: String(p.Source).toLowerCase() === 'manual',
          edited: String(p.Edited).trim().toUpperCase() === 'Y',
        }))
        .sort((a, b) => a.time.localeCompare(b.time)),
    };
  });

  const summary = summarizeWorkerWeek({ worker, sub: null, punches, weekStartMonday: weekStart });

  return json(200, {
    ok: true,
    worker: { id: workerId, name: displayName(worker), type: String(worker.Type || 'employee').toLowerCase() },
    weekStart, weekEnd, locked,
    days, weekHours: summary.weekHours, flags: summary.flags,
  });
});
