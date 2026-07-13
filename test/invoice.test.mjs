// Unit tests for the sub-invoice builder. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSubInvoice, buildGCInvoice, buildQBInvoice } from '../netlify/functions/lib/invoice-lib.js';

const P = (ts, action, project, worker = 'W1') =>
  ({ Timestamp: ts, Action: action, Project: project, WorkerID: worker });

test('independent: one project, per-day breakdown, labor total', () => {
  const sub = { SubID: 'S1', CompanyName: 'Diego Independent', DefaultPayRate: '50' };
  const workers = [{ WorkerID: 'W1', First: 'Diego', SubID: 'S1', Type: 'independent' }];
  const punches = [
    P('2026-07-06 07:00:00', 'IN', 'PRJ_A'), P('2026-07-06 15:00:00', 'OUT', 'PRJ_A'), // Mon 8h
    P('2026-07-07 07:00:00', 'IN', 'PRJ_A'), P('2026-07-07 12:00:00', 'OUT', 'PRJ_A'), // Tue 5h
  ];
  const inv = buildSubInvoice({
    sub, workers, punches, projectsById: { PRJ_A: { SiteName: 'French Hill' } }, weekStart: '2026-07-06',
  });
  assert.equal(inv.weekEnd, '2026-07-12'); // Mon–Sun week ends Sunday
  assert.equal(inv.projects.length, 1);
  assert.equal(inv.projects[0].name, 'French Hill');
  assert.equal(inv.projects[0].hours, 13);
  assert.equal(inv.projects[0].rate, 50);
  assert.equal(inv.projects[0].amount, 650);
  assert.deepEqual(inv.projects[0].perDay, [
    { date: '2026-07-06', hours: 8 }, { date: '2026-07-07', hours: 5 },
  ]);
  assert.equal(inv.laborTotal, 650);
  assert.equal(inv.total, 650);
});

test('materials add a line and roll into the total', () => {
  const sub = { SubID: 'S1', CompanyName: 'Diego', DefaultPayRate: '50' };
  const workers = [{ WorkerID: 'W1', First: 'Diego', SubID: 'S1' }];
  const punches = [P('2026-07-06 08:00:00', 'IN', 'PRJ_A'), P('2026-07-06 12:00:00', 'OUT', 'PRJ_A')]; // 4h
  const materials = [{ Amount: '$120.50', Note: 'lumber', Project: 'PRJ_A' }];
  const inv = buildSubInvoice({ sub, workers, punches, materials, weekStart: '2026-07-06' });
  assert.equal(inv.laborTotal, 200);          // 4 × 50
  assert.equal(inv.materialsTotal, 120.5);
  assert.equal(inv.total, 320.5);
  assert.equal(inv.materials[0].note, 'lumber');
});

test('company sub: per-worker rates (Carlito $35) aggregate by project', () => {
  const sub = { SubID: 'SANIG', CompanyName: 'San Ignacio', DefaultPayRate: '50' };
  const workers = [
    { WorkerID: 'W1', First: 'Fredy', SubID: 'SANIG' },
    { WorkerID: 'WC', First: 'Carlito', SubID: 'SANIG', PayRateOverride: '35' },
  ];
  const punches = [
    P('2026-07-06 07:00:00', 'IN', 'PRJ_A', 'W1'), P('2026-07-06 15:00:00', 'OUT', 'PRJ_A', 'W1'), // Fredy 8h @50 = 400
    P('2026-07-06 07:00:00', 'IN', 'PRJ_A', 'WC'), P('2026-07-06 17:00:00', 'OUT', 'PRJ_A', 'WC'), // Carlito 10h @35 = 350
  ];
  const inv = buildSubInvoice({ sub, workers, punches, weekStart: '2026-07-06' });
  assert.equal(inv.projects[0].hours, 18);
  assert.equal(inv.projects[0].rate, null);   // mixed rates → no single rate shown
  assert.equal(inv.projects[0].amount, 750);  // 400 + 350
  assert.equal(inv.total, 750);
  // worker lines expose the per-person split
  const carlito = inv.workerLines.find((l) => l.worker === 'Carlito');
  assert.equal(carlito.rate, 35);
  assert.equal(carlito.amount, 350);
});

test('GC invoice: $68 rate, 0.75 lunch/day deducted, Carlito separated @ $40', () => {
  const gcProjects = [{ ProjectID: 'OPUS1', SiteName: 'French 1', BillsToGC: 'Y', GCName: 'Opus', GCRate: '68' }];
  const workersById = {
    W1: { WorkerID: 'W1', First: 'Fredy' },                       // standard → $68
    WC: { WorkerID: 'WC', First: 'Carlito', GCRateOverride: '40' }, // override → $40
  };
  const punches = [
    P('2026-07-06 07:00:00', 'IN', 'OPUS1', 'W1'), P('2026-07-06 15:00:00', 'OUT', 'OPUS1', 'W1'), // Fredy 8h → 7.25 billable
    P('2026-07-06 07:00:00', 'IN', 'OPUS1', 'WC'), P('2026-07-06 15:00:00', 'OUT', 'OPUS1', 'WC'), // Carlito 8h → 7.25 billable
  ];
  const gc = buildGCInvoice({ gcName: 'Opus', gcProjects, workersById, punches, weekStart: '2026-07-06' });
  assert.equal(gc.costCode, '01 31 00');
  assert.equal(gc.lunchHours, 1.5); // 0.75 × 2 workers
  const proj = gc.projects[0];
  assert.equal(proj.standard.hours, 7.25);
  assert.equal(proj.standard.rate, 68);
  assert.equal(proj.standard.amount, 493);     // 7.25 × 68
  assert.equal(proj.overrides.length, 1);
  assert.equal(proj.overrides[0].worker, 'Carlito');
  assert.equal(proj.overrides[0].rate, 40);
  assert.equal(proj.overrides[0].amount, 290); // 7.25 × 40
  assert.equal(gc.total, 783);                 // 493 + 290
});

test('GC invoice: lunch never makes a short day negative', () => {
  const gcProjects = [{ ProjectID: 'OPUS1', SiteName: 'French 1', GCRate: '68' }];
  const workersById = { W1: { WorkerID: 'W1', First: 'Fredy' } };
  const punches = [P('2026-07-06 07:00:00', 'IN', 'OPUS1', 'W1'), P('2026-07-06 07:30:00', 'OUT', 'OPUS1', 'W1')]; // 0.5h
  const gc = buildGCInvoice({ gcName: 'Opus', gcProjects, workersById, punches, weekStart: '2026-07-06' });
  assert.equal(gc.projects[0]?.standard?.hours ?? 0, 0); // 0.5 − 0.75 → 0, not negative
  assert.equal(gc.total, 0);
});

test('QB invoice: Carpentry at $50, General Labor for override workers, no lunch', () => {
  const sub = { SubID: 'SANIG', CompanyName: 'San Ignacio', DefaultPayRate: '50' };
  const workers = [
    { WorkerID: 'W1', First: 'Fredy', SubID: 'SANIG' },                           // default -> Carpentry $50
    { WorkerID: 'W3', First: 'Carlito', SubID: 'SANIG', PayRateOverride: '35' },  // override -> General Labor $35
  ];
  const punches = [
    P('2026-07-06 07:00:00', 'IN', 'PRJ_A', 'W1'), P('2026-07-06 15:00:00', 'OUT', 'PRJ_A', 'W1'), // Fredy 8h
    P('2026-07-06 07:00:00', 'IN', 'PRJ_A', 'W3'), P('2026-07-06 11:00:00', 'OUT', 'PRJ_A', 'W3'), // Carlito 4h
  ];
  const qb = buildQBInvoice({ sub, workers, punches, weekStart: '2026-07-06' });
  const carp = qb.lines.find((l) => l.item === 'Carpentry');
  const gen = qb.lines.find((l) => l.item === 'General Labor');
  assert.equal(carp.qty, 8); assert.equal(carp.rate, 50); assert.equal(carp.amount, 400); // full 8h, no lunch
  assert.equal(gen.qty, 4); assert.equal(gen.rate, 35); assert.equal(gen.amount, 140);
  assert.equal(qb.totalHours, 12);
  assert.equal(qb.total, 540);
});
