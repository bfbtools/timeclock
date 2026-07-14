// Rollup engine — pure functions, no I/O. Turns raw punches into paired
// intervals, daily/weekly hours, and rate-resolved amounts. Business rules:
// docs/bfb-timeclock-spec.md § Business rules + Invoicing.
//
//   - Week starts Monday; span is WEEK_LENGTH_DAYS (currently 7 = Mon–Sun).
//   - Pair IN/OUT per worker per day in time order; sum intervals; flag unpaired.
//   - Pay rate  = what BFB pays the sub  (worker override → sub default → $50).
//   - GC rate   = what BFB bills the GC  (worker override → project GCRate),
//                 project-based, applies to any hours on that project.
//   - Lunch     = flat 0.75 hr / worker / worked-day, deducted ONLY on the GC
//                 invoice (never on sub pay, never on independent invoices).
//
// Timestamps are ET wall-clock strings "YYYY-MM-DD HH:mm:ss" (see model.js).

import { LUNCH_HOURS, DEFAULT_COMPANY_RATE, WEEK_LENGTH_DAYS } from './config.js';

/* --------------------------------------------------------------- numbers */
// Parse a Sheet cell that may be "50", "$50.00", "" etc. → number (NaN-safe).
export function num(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/* ----------------------------------------------------------------- dates */
export function dayKey(stamp) {
  return String(stamp || '').slice(0, 10); // YYYY-MM-DD
}
function toDate(stamp) {
  // "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss" → Date (local wall clock).
  // Build from parts so a SINGLE-digit hour parses: the Sheet stores timestamps
  // as datetime values (USER_ENTERED) and reads them back in the column's display
  // format — e.g. "2026-07-14 6:00:00" — and `new Date("...T6:00:00")` is Invalid
  // Date (ISO needs a 2-digit hour). Matching by parts avoids that NaN.
  const m = String(stamp).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  return new Date(String(stamp).replace(' ', 'T')); // fallback for unexpected formats
}
export function minutesBetween(inStamp, outStamp) {
  return (toDate(outStamp).getTime() - toDate(inStamp).getTime()) / 60000;
}
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
// day-of-week 0=Sun..6=Sat for a YYYY-MM-DD string.
export function dow(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay();
}
export function isSunday(dateStr) {
  return dow(dateStr) === 0;
}
// Monday that starts the week containing dateStr.
export function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const delta = (d.getDay() + 6) % 7; // Sun→6, Mon→0, … Sat→5
  d.setDate(d.getDate() - delta);
  return isoDate(d);
}
// { start: Monday, end: last billing day } for the week containing dateStr.
// Span is WEEK_LENGTH_DAYS (currently 7 = Mon–Sun; 6 = Mon–Sat).
export function weekRange(dateStr) {
  const start = mondayOf(dateStr);
  const end = new Date(start + 'T00:00:00');
  end.setDate(end.getDate() + (WEEK_LENGTH_DAYS - 1));
  return { start, end: isoDate(end) };
}
export function inWeek(dateStr, weekStartMonday) {
  const end = new Date(weekStartMonday + 'T00:00:00');
  end.setDate(end.getDate() + (WEEK_LENGTH_DAYS - 1));
  return dateStr >= weekStartMonday && dateStr <= isoDate(end);
}

/* --------------------------------------------------------------- pairing */
// Pair one worker's punches for ONE day into intervals; flag anything unpaired.
export function pairDay(dayPunches) {
  const sorted = [...dayPunches].sort((a, b) =>
    String(a.Timestamp).localeCompare(String(b.Timestamp)));
  const intervals = [];
  const unpaired = [];
  let open = null;

  for (const p of sorted) {
    const action = String(p.Action || '').trim().toUpperCase();
    if (action === 'IN') {
      if (open) unpaired.push({ punch: open, reason: 'missing clock-out' });
      open = p;
    } else if (action === 'OUT') {
      if (!open) {
        unpaired.push({ punch: p, reason: 'clock-out with no clock-in' });
      } else {
        const minutes = minutesBetween(open.Timestamp, p.Timestamp);
        // `!(minutes > 0)` (not `minutes <= 0`) so an unparseable timestamp
        // (minutes = NaN) is flagged unpaired instead of poisoning the whole
        // week's total (NaN <= 0 is false, so the old guard let NaN through).
        if (!(minutes > 0)) {
          unpaired.push({ punch: open, reason: 'clock-out not after clock-in' });
          unpaired.push({ punch: p, reason: 'clock-out not after clock-in' });
        } else {
          intervals.push({
            in: open, out: p, minutes,
            project: String(open.Project || '').trim(),
          });
        }
        open = null;
      }
    }
  }
  if (open) unpaired.push({ punch: open, reason: 'missing clock-out' });

  const minutes = intervals.reduce((s, i) => s + i.minutes, 0);
  return { intervals, minutes, hours: round2(minutes / 60), unpaired };
}

// All of one worker's punches → per-day breakdown keyed by YYYY-MM-DD.
export function workerDays(punches) {
  const byDay = new Map();
  for (const p of punches) {
    const k = dayKey(p.Timestamp);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(p);
  }
  const days = {};
  for (const [date, dayPunches] of byDay) {
    const paired = pairDay(dayPunches);
    days[date] = {
      date,
      hours: paired.hours,
      intervals: paired.intervals,
      unpaired: paired.unpaired,
      sunday: isSunday(date),
      projectHours: projectHours(paired.intervals),
    };
  }
  return days;
}

// Sum hours per project id within a set of intervals.
export function projectHours(intervals) {
  const map = {};
  for (const iv of intervals) {
    const key = iv.project || '(none)';
    map[key] = round2((map[key] || 0) + iv.minutes / 60);
  }
  return map;
}

/* ------------------------------------------------------------------ rates */
// What BFB pays for this worker's hours.
export function resolvePayRate(worker, sub) {
  const override = num(worker && worker.PayRateOverride);
  if (override !== null) return override;            // e.g. Carlito $35
  const subDefault = num(sub && sub.DefaultPayRate);
  if (subDefault !== null) return subDefault;
  return DEFAULT_COMPANY_RATE;                       // $50 fallback
}
// What BFB bills the GC for this worker's hours on a project.
export function resolveGCRate(worker, project) {
  const override = num(worker && worker.GCRateOverride);
  if (override !== null) return override;            // e.g. Carlito $40
  return num(project && project.GCRate);             // project-based rate
}

/* ------------------------------------------------------------------ lunch */
// GC-billable hours for a worker on one worked day = worked − 0.75 (min 0).
// Lunch is deducted ONLY for the GC invoice.
export function gcBillableHours(workedHours) {
  if (!workedHours || workedHours <= 0) return 0;
  return round2(Math.max(0, workedHours - LUNCH_HOURS));
}

/* --------------------------------------------------- weekly worker summary */
// Summarize one worker across a week (Mon–Sun) for sub-pay purposes.
// `punches` may span more than the week; only in-week, non-Sunday days count.
export function summarizeWorkerWeek({ worker, sub, punches, weekStartMonday }) {
  const week = weekStartMonday || (punches.length ? mondayOf(dayKey(punches[0].Timestamp)) : null);
  const allDays = workerDays(punches);

  const days = [];
  let weekMinutes = 0;
  let unpairedCount = 0;
  const flags = [];

  for (const date of Object.keys(allDays).sort()) {
    const d = allDays[date];
    const dayMinutes = d.intervals.reduce((s, i) => s + i.minutes, 0);

    if (week && !inWeek(date, week)) {
      // A day outside the week's billing span (e.g. a stray punch from another
      // week in the punch set). If Sundays are ever disabled (WEEK_LENGTH_DAYS
      // = 6), a worked Sunday would land here — surface it rather than drop it.
      if (mondayOf(date) === week && d.sunday && (dayMinutes > 0 || d.unpaired.length)) {
        flags.push({ date, reason: 'worked Sunday — outside the billing week; not counted, please review' });
      }
      continue;
    }

    // Sunday is a normal paid weekday (Mon–Sun week) — counted, not flagged.
    weekMinutes += dayMinutes;
    unpairedCount += d.unpaired.length;
    d.unpaired.forEach((u) => flags.push({ date, reason: u.reason }));
    days.push(d);
  }

  const payRate = resolvePayRate(worker, sub);
  const weekHours = round2(weekMinutes / 60);
  return {
    workerId: worker && String(worker.WorkerID).trim(),
    weekStart: week,
    days,
    weekHours,
    payRate,
    pay: round2(weekHours * payRate),
    unpairedCount,
    flags,
  };
}
