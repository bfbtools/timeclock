// Tests for the 2026-08-04 punch-app bug fixes (from the 07/30 SubBills game plan):
//   Bug 1 double-submit → server-side dedupe (findDuplicatePunch)
//   Bug 2 manual edits record no author → punchRow always attributes an edit
//   Bug 5 GC rate must read Projects.GCRate, not a hardcoded $68
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicatePunch, punchRow } from '../netlify/functions/lib/model.js';
import { buildGCInvoice } from '../netlify/functions/lib/invoice-lib.js';

const W = { WorkerID: 'W1', First: 'Antony' };

/* ------------------------------------------------------- Bug 1: dedupe */
const rowOut = (ts, worker = 'W1', project = 'PRJ_A') =>
  ({ WorkerID: worker, Action: 'OUT', Project: project, Timestamp: ts });

test('findDuplicatePunch: same worker+action+project at the same time is a duplicate', () => {
  const existing = [rowOut('2026-07-13 09:30:00')];
  const dup = findDuplicatePunch(existing, { workerId: 'W1', action: 'OUT', stamp: '2026-07-13 09:30:00', projectId: 'PRJ_A' });
  assert.ok(dup);
});

test('findDuplicatePunch: catches the ~1s-apart double-submit (the real bug signature)', () => {
  const existing = [rowOut('2026-07-13 09:30:00')];
  // second fire lands a second or two later — still the same logical punch
  assert.ok(findDuplicatePunch(existing, { workerId: 'W1', action: 'OUT', stamp: '2026-07-13 09:30:01', projectId: 'PRJ_A' }));
  assert.ok(findDuplicatePunch(existing, { workerId: 'W1', action: 'OUT', stamp: '2026-07-13 09:29:58', projectId: 'PRJ_A' }));
});

test('findDuplicatePunch: does NOT flag a genuinely different punch', () => {
  const existing = [rowOut('2026-07-13 09:30:00')];
  // different action (a real IN after this OUT)
  assert.equal(findDuplicatePunch(existing, { workerId: 'W1', action: 'IN', stamp: '2026-07-13 09:30:00', projectId: 'PRJ_A' }), null);
  // different worker
  assert.equal(findDuplicatePunch(existing, { workerId: 'W2', action: 'OUT', stamp: '2026-07-13 09:30:00', projectId: 'PRJ_A' }), null);
  // different project
  assert.equal(findDuplicatePunch(existing, { workerId: 'W1', action: 'OUT', stamp: '2026-07-13 09:30:00', projectId: 'PRJ_B' }), null);
  // outside the window (2 min > 90s default)
  assert.equal(findDuplicatePunch(existing, { workerId: 'W1', action: 'OUT', stamp: '2026-07-13 09:32:00', projectId: 'PRJ_A' }), null);
});

test('findDuplicatePunch: returns null on an empty/garbage set or bad stamp', () => {
  assert.equal(findDuplicatePunch([], { workerId: 'W1', action: 'OUT', stamp: '2026-07-13 09:30:00' }), null);
  assert.equal(findDuplicatePunch([rowOut('2026-07-13 09:30:00')], { workerId: 'W1', action: 'OUT', stamp: 'not-a-date' }), null);
});

/* --------------------------------------------- Bug 2: edit attribution */
test('punchRow: a manual/edited punch is ALWAYS attributed (never blank author)', () => {
  const r = punchRow({ worker: W, action: 'OUT', stamp: '2026-07-13 16:00:00', missed: true, editedBy: 'Adrienne', editedAt: '2026-08-04 10:00:00', id: 'P-1' });
  assert.equal(r.Source, 'manual');
  assert.equal(r.Edited, 'Y');
  assert.equal(r.EditedBy, 'Adrienne');
  assert.equal(r.EditedAt, '2026-08-04 10:00:00');
});

test('punchRow: a manual edit with no author falls back to "Office", not blank', () => {
  const r = punchRow({ worker: W, action: 'OUT', stamp: '2026-07-13 16:00:00', missed: true, editedAt: '2026-08-04 10:00:00', id: 'P-2' });
  assert.equal(r.EditedBy, 'Office'); // the bug was a blank EditedBy
  assert.equal(r.EditedAt, '2026-08-04 10:00:00');
});

test('punchRow: a live scan leaves the edit fields blank (not an adjustment)', () => {
  const r = punchRow({ worker: W, project: { ProjectID: 'PRJ_A', SiteName: 'French 1' }, action: 'IN', stamp: '2026-07-13 07:00:00', id: 'P-3' });
  assert.equal(r.Source, 'scan');
  assert.equal(r.Edited, '');
  assert.equal(r.EditedBy, '');
  assert.equal(r.EditedAt, '');
});

/* --------------------------------------------- Bug 5: GC reads GCRate */
test('GC invoice: standard rate comes from Projects.GCRate, not a hardcoded $68', () => {
  const gcProjects = [{ ProjectID: 'P1', SiteName: '266 College', GCName: 'Opus', GCRate: '75', BillsToGC: 'Y' }];
  const workersById = { W1: { WorkerID: 'W1', First: 'Fredy' } };
  const punches = [
    { Timestamp: '2026-07-06 07:00:00', Action: 'IN', Project: 'P1', WorkerID: 'W1' },
    { Timestamp: '2026-07-06 15:00:00', Action: 'OUT', Project: 'P1', WorkerID: 'W1' }, // 8h → 7.25 billable
  ];
  const gc = buildGCInvoice({ gcName: 'Opus', gcProjects, workersById, punches, weekStart: '2026-07-06' });
  assert.equal(gc.projects[0].standard.rate, 75);          // reads the project value
  assert.equal(gc.projects[0].standard.amount, 543.75);    // 7.25 × 75 (would be 493 at $68)
});
