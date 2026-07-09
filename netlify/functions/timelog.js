// GET /api/timelog?workerId=&pin=
// PIN-gated. Returns the worker's rolling edit window (last EDIT_WINDOW_DAYS,
// ending today — Mon–Sun weeks, Sunday counted). Each day carries its paired
// hours and individual punches; every day in the window is editable (older days
// simply aren't returned). Manual/edited punches are marked so the Time Log can
// show them as flagged.

import { json, query, guard } from './lib/http.js';
import { authEdit, etToday, editWindowStart, displayName } from './lib/model.js';
import { getPunchesForWorkers } from './lib/model.js';
import { dayKey, pairDay, mondayOf } from './lib/rollup.js';

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
  const actingId = query(req, 'actingId');
  const pin = query(req, 'pin');

  // Self, or an owner viewing/editing one of their sub's workers.
  const auth = await authEdit({ targetId: workerId, actingId, pin });
  if (auth.error) return json(auth.status, { ok: false, error: auth.error });
  const worker = auth.target;

  const windowEnd = etToday();
  const windowStart = editWindowStart(windowEnd);

  const punches = await getPunchesForWorkers([workerId], windowStart, windowEnd);
  const byDay = new Map();
  punches.forEach((p) => {
    const k = dayKey(p.Timestamp);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(p);
  });

  const weekMon = mondayOf(windowEnd); // Monday of the current (Mon–Sun) week
  let totalMinutes = 0;
  let weekMinutes = 0;
  const flags = [];
  // Most-recent day first so today sits at the top of the scroll box.
  const days = datesInclusive(windowStart, windowEnd).reverse().map((date) => {
    const dayPunches = byDay.get(date) || [];
    const paired = pairDay(dayPunches);
    totalMinutes += paired.minutes;
    if (date >= weekMon) weekMinutes += paired.minutes;
    paired.unpaired.forEach((u) => flags.push({ date, reason: u.reason }));
    return {
      date,
      hours: paired.hours,
      unpaired: paired.unpaired.length,
      punches: dayPunches
        .map((p) => ({
          id: String(p.PunchID || '').trim(),
          time: hhmm(p.Timestamp),
          action: String(p.Action).toUpperCase(),
          manual: String(p.Source).toLowerCase() === 'manual',
          edited: String(p.Edited).trim().toUpperCase() === 'Y',
        }))
        .sort((a, b) => a.time.localeCompare(b.time)),
    };
  });

  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
  const currentWeekHours = Math.round((weekMinutes / 60) * 100) / 100;

  return json(200, {
    ok: true,
    worker: { id: workerId, name: displayName(worker), type: String(worker.Type || 'employee').toLowerCase() },
    windowStart, windowEnd,
    // Back-compat aliases (older field names the front end reads):
    weekStart: windowStart, weekEnd: windowEnd, locked: false,
    days, weekHours: totalHours, currentWeekHours, flags,
  });
});
