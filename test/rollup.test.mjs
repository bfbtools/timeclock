// Unit tests for the rollup engine. Run: npm test  (node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  num, dayKey, minutesBetween, mondayOf, weekRange, inWeek, isSunday,
  pairDay, workerDays, projectHours, resolvePayRate, resolveGCRate,
  gcBillableHours, summarizeWorkerWeek,
} from '../netlify/functions/lib/rollup.js';

// helper to build a punch row
const P = (ts, action, project = 'PRJ1', extra = {}) =>
  ({ Timestamp: ts, Action: action, Project: project, ...extra });

test('num parses money-ish strings', () => {
  assert.equal(num('50'), 50);
  assert.equal(num('$50.00'), 50);
  assert.equal(num(35), 35);
  assert.equal(num(''), null);
  assert.equal(num(null), null);
  assert.equal(num('abc'), null);
});

test('dates: dayKey, minutesBetween, Sunday, Monday-of-week', () => {
  assert.equal(dayKey('2026-07-06 07:30:00'), '2026-07-06');
  assert.equal(minutesBetween('2026-07-06 07:00:00', '2026-07-06 09:30:00'), 150);
  assert.equal(isSunday('2026-07-05'), true);   // 2026-07-05 is a Sunday
  assert.equal(isSunday('2026-07-06'), false);  // Monday
  // Week containing Wed 2026-07-08 starts Mon 2026-07-06, ends Sun 2026-07-12
  assert.equal(mondayOf('2026-07-08'), '2026-07-06');
  assert.deepEqual(weekRange('2026-07-08'), { start: '2026-07-06', end: '2026-07-12' });
});

test('inWeek: Mon–Sun included', () => {
  const mon = '2026-07-06';
  assert.equal(inWeek('2026-07-06', mon), true);  // Mon
  assert.equal(inWeek('2026-07-11', mon), true);  // Sat
  assert.equal(inWeek('2026-07-12', mon), true);  // Sun — now the last day of the week
  assert.equal(inWeek('2026-07-13', mon), false); // next Mon — out of week
  assert.equal(inWeek('2026-07-05', mon), false); // previous Sun
});

test('pairDay: simple single in/out', () => {
  const r = pairDay([P('2026-07-06 07:00:00', 'IN'), P('2026-07-06 15:00:00', 'OUT')]);
  assert.equal(r.hours, 8);
  assert.equal(r.intervals.length, 1);
  assert.equal(r.unpaired.length, 0);
});

test('pairDay: multiple pairs in one day (multi-punch)', () => {
  const r = pairDay([
    P('2026-07-06 07:00:00', 'IN'), P('2026-07-06 11:00:00', 'OUT'),
    P('2026-07-06 12:00:00', 'IN'), P('2026-07-06 15:30:00', 'OUT'),
  ]);
  assert.equal(r.hours, 7.5); // 4 + 3.5
  assert.equal(r.intervals.length, 2);
  assert.equal(r.unpaired.length, 0);
});

test('pairDay: out-of-order punches are sorted before pairing', () => {
  const r = pairDay([P('2026-07-06 15:00:00', 'OUT'), P('2026-07-06 07:00:00', 'IN')]);
  assert.equal(r.hours, 8);
  assert.equal(r.unpaired.length, 0);
});

test('pairDay: missing clock-out flags the open IN', () => {
  const r = pairDay([P('2026-07-06 07:00:00', 'IN')]);
  assert.equal(r.hours, 0);
  assert.equal(r.unpaired.length, 1);
  assert.equal(r.unpaired[0].reason, 'missing clock-out');
});

test('pairDay: two INs then one OUT — first IN unpaired, second pairs', () => {
  const r = pairDay([
    P('2026-07-06 07:00:00', 'IN'),
    P('2026-07-06 08:00:00', 'IN'),
    P('2026-07-06 12:00:00', 'OUT'),
  ]);
  assert.equal(r.intervals.length, 1);
  assert.equal(r.hours, 4); // 08:00→12:00
  assert.equal(r.unpaired.length, 1);
  assert.equal(r.unpaired[0].reason, 'missing clock-out');
});

test('pairDay: OUT with no IN is flagged', () => {
  const r = pairDay([P('2026-07-06 12:00:00', 'OUT')]);
  assert.equal(r.intervals.length, 0);
  assert.equal(r.unpaired.length, 1);
  assert.equal(r.unpaired[0].reason, 'clock-out with no clock-in');
});

test('projectHours splits by project', () => {
  const r = pairDay([
    P('2026-07-06 07:00:00', 'IN', 'A'), P('2026-07-06 10:00:00', 'OUT', 'A'),
    P('2026-07-06 10:00:00', 'IN', 'B'), P('2026-07-06 13:00:00', 'OUT', 'B'),
  ]);
  const ph = projectHours(r.intervals);
  assert.equal(ph.A, 3);
  assert.equal(ph.B, 3);
});

test('rates: worker override wins, else sub default, else $50', () => {
  assert.equal(resolvePayRate({ PayRateOverride: '35' }, { DefaultPayRate: '50' }), 35); // Carlito
  assert.equal(resolvePayRate({ PayRateOverride: '' }, { DefaultPayRate: '50' }), 50);
  assert.equal(resolvePayRate({}, {}), 50);
  assert.equal(resolveGCRate({ GCRateOverride: '40' }, { GCRate: '68' }), 40); // Carlito GC
  assert.equal(resolveGCRate({ GCRateOverride: '' }, { GCRate: '68' }), 68);
});

test('lunch: 0.75 deducted from GC-billable hours only, min 0', () => {
  assert.equal(gcBillableHours(8), 7.25);
  assert.equal(gcBillableHours(0.5), 0);   // less than lunch → 0, not negative
  assert.equal(gcBillableHours(0), 0);
});

test('workerDays: groups punches into days with flags', () => {
  const days = workerDays([
    P('2026-07-06 07:00:00', 'IN'), P('2026-07-06 15:00:00', 'OUT'),
    P('2026-07-07 07:00:00', 'IN'), // missing out
  ]);
  assert.equal(days['2026-07-06'].hours, 8);
  assert.equal(days['2026-07-07'].unpaired.length, 1);
});

test('summarizeWorkerWeek: sums Mon–Sun, applies pay rate, flags unpaired only', () => {
  const worker = { WorkerID: 'W-CARLITO', PayRateOverride: '35' };
  const sub = { DefaultPayRate: '50' };
  const punches = [
    P('2026-07-06 07:00:00', 'IN'), P('2026-07-06 15:00:00', 'OUT'), // Mon 8h
    P('2026-07-07 07:00:00', 'IN'), P('2026-07-07 12:00:00', 'OUT'), // Tue 5h
    P('2026-07-11 08:00:00', 'IN'),                                  // Sat unpaired
    P('2026-07-12 09:00:00', 'IN'), P('2026-07-12 17:00:00', 'OUT'), // Sun 8h — now counted
  ];
  const s = summarizeWorkerWeek({ worker, sub, punches, weekStartMonday: '2026-07-06' });
  assert.equal(s.weekHours, 21);       // 8 + 5 + 8 (Sun); Sat has no paired hours
  assert.equal(s.payRate, 35);
  assert.equal(s.pay, 735);            // 21 × 35
  assert.equal(s.unpairedCount, 1);    // the Sat open IN
  // Sunday is a normal weekday now — no "Sunday" flag.
  assert.ok(!s.flags.some((f) => f.reason.includes('Sunday')));
});

test('summarizeWorkerWeek: Sunday inside the week is counted like any weekday', () => {
  const worker = { WorkerID: 'W1' };
  const sub = { DefaultPayRate: '50' };
  const punches = [P('2026-07-05 09:00:00', 'IN'), P('2026-07-05 17:00:00', 'OUT')]; // Sun
  // Week starting Mon 2026-06-29 runs Mon–Sun and ends Sun 2026-07-05.
  const s = summarizeWorkerWeek({ worker, sub, punches, weekStartMonday: '2026-06-29' });
  assert.equal(s.weekHours, 8); // Sunday now inside the Mon–Sun week and counted
  assert.ok(!s.flags.some((f) => f.reason.includes('Sunday')));
});
