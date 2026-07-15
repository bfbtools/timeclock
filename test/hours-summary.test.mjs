// Unit tests for the hours-summary aggregation. Run: npm test  (node --test)
// Tests the pure summarize() with fixtures — no Sheets/network needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../netlify/functions/hours-summary.js';

const workers = [
  { WorkerID: 'SI06', Nickname: 'Willy', First: 'William', SubID: 'S1' },
  { WorkerID: 'LO02', Nickname: '', First: 'Ana', SubID: 'S2' },
];
const subs = [
  { SubID: 'S1', CompanyName: 'San Ignacio LLC' },
  { SubID: 'S2', CompanyName: 'Lopez Exterior' },
];
const projects = [
  { ProjectID: 'P01', SiteName: 'French 1' },
  { ProjectID: 'P03', SiteName: 'Lapinsky' },
];
// Willy: clean 8h on P01 (07-13) + an orphan clock-out that day (real issue) +
//        an open shift today (07-15) = still on the clock, NOT a real issue.
// Ana:   clean 5h on P03 (07-14).
const punches = [
  { WorkerID: 'SI06', Project: 'P01', Action: 'IN',  Timestamp: '2026-07-13 07:00:00' },
  { WorkerID: 'SI06', Project: 'P01', Action: 'OUT', Timestamp: '2026-07-13 15:00:00' },
  { WorkerID: 'SI06', Project: 'P01', Action: 'OUT', Timestamp: '2026-07-13 16:00:00' }, // orphan → issue
  { WorkerID: 'SI06', Project: 'P01', Action: 'IN',  Timestamp: '2026-07-15 08:00:00' }, // open today
  { WorkerID: 'LO02', Project: 'P03', Action: 'IN',  Timestamp: '2026-07-14 07:00:00' },
  { WorkerID: 'LO02', Project: 'P03', Action: 'OUT', Timestamp: '2026-07-14 12:00:00' },
];

test('summarize: hours per project + total (full week)', () => {
  const r = summarize({ workers, projects, punches, subs, from: '2026-07-13', to: '2026-07-15', today: '2026-07-15' });
  assert.equal(r.totalHours, 13);
  assert.deepEqual(r.perProject, [
    { projectId: 'P01', name: 'French 1', hours: 8 },
    { projectId: 'P03', name: 'Lapinsky', hours: 5 },
  ]);
  assert.equal(r.counts.workers, 2);
  assert.equal(r.counts.projects, 2);
});

test('summarize: per-worker hours + names/subs', () => {
  const r = summarize({ workers, projects, punches, subs, from: '2026-07-13', to: '2026-07-15', today: '2026-07-15' });
  const willy = r.perWorker.find((w) => w.workerId === 'SI06');
  const ana = r.perWorker.find((w) => w.workerId === 'LO02');
  assert.equal(willy.name, 'Willy');            // Nickname wins
  assert.equal(willy.sub, 'San Ignacio LLC');
  assert.deepEqual(willy.byProject, { P01: 8 });
  assert.equal(ana.name, 'Ana');                // falls back to First when no Nickname
  assert.equal(ana.hours, 5);
  assert.equal(r.perWorker[0].workerId, 'SI06'); // sorted desc by hours
});

test('summarize: issues — orphan is real, today open shift is not', () => {
  const r = summarize({ workers, projects, punches, subs, from: '2026-07-13', to: '2026-07-15', today: '2026-07-15' });
  assert.equal(r.issues.length, 2);
  const real = r.issues.find((i) => !i.today);
  assert.equal(real.reason, 'clock-out with no clock-in');
  assert.equal(real.date, '2026-07-13');
  assert.equal(real.name, 'Willy');
  assert.equal(real.project, 'French 1');
  const openToday = r.issues.find((i) => i.today);
  assert.equal(openToday.reason, 'missing clock-out');
  // counts.issues excludes today's still-on-the-clock shift
  assert.equal(r.counts.issues, 1);
});

test('summarize: date range filters out-of-range days', () => {
  // to=07-14 excludes today's 07-15 open shift entirely
  const r = summarize({ workers, projects, punches, subs, from: '2026-07-13', to: '2026-07-14', today: '2026-07-15' });
  assert.equal(r.totalHours, 13);
  assert.equal(r.issues.length, 1);            // only the 07-13 orphan remains
  assert.equal(r.issues[0].reason, 'clock-out with no clock-in');
  assert.equal(r.counts.issues, 1);
});
