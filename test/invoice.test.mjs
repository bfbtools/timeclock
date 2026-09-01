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

test('GC draft (per project): per-day Carpentry Labor $68 + General Labor $40, lunch net', () => {
  const project = { ProjectID: 'OPUS1', SiteName: 'French 1', BillsToGC: 'Y', GCName: 'Opus', GCRate: '68' };
  const workersById = {
    W1: { WorkerID: 'W1', First: 'Fredy' },                       // standard → $68
    WC: { WorkerID: 'WC', First: 'Carlito', GCRateOverride: '40' }, // override → $40
  };
  const punches = [
    P('2026-07-06 07:00:00', 'IN', 'OPUS1', 'W1'), P('2026-07-06 15:00:00', 'OUT', 'OPUS1', 'W1'), // Fredy 8h → 7.25 billable
    P('2026-07-06 07:00:00', 'IN', 'OPUS1', 'WC'), P('2026-07-06 15:00:00', 'OUT', 'OPUS1', 'WC'), // Carlito 8h → 7.25 billable
  ];
  const gc = buildGCInvoice({ gcName: 'Opus', project, workersById, punches, weekStart: '2026-07-06' });
  assert.equal(gc.costCode, '01 31 00');
  assert.equal(gc.project.name, 'French 1');
  assert.equal(gc.lunchHours, 1.5); // 0.75 × 2 workers
  assert.equal(gc.days.length, 1);
  const [carp, gl] = gc.days[0].lines;
  assert.equal(carp.item, 'Carpentry Labor');
  assert.equal(carp.rate, 68); assert.equal(carp.hours, 7.25); assert.equal(carp.amount, 493);
  assert.deepEqual(carp.onsite, ['Fredy']);
  assert.equal(gl.item, 'General Labor');
  assert.equal(gl.rate, 40); assert.equal(gl.hours, 7.25); assert.equal(gl.amount, 290);
  assert.deepEqual(gl.onsite, ['Carlito']);
  assert.equal(gc.total, 783);                 // 493 + 290
});

test('GC draft: lunch never makes a short day negative (no line at all)', () => {
  const project = { ProjectID: 'OPUS1', SiteName: 'French 1', GCRate: '68' };
  const workersById = { W1: { WorkerID: 'W1', First: 'Fredy' } };
  const punches = [P('2026-07-06 07:00:00', 'IN', 'OPUS1', 'W1'), P('2026-07-06 07:30:00', 'OUT', 'OPUS1', 'W1')]; // 0.5h
  const gc = buildGCInvoice({ gcName: 'Opus', project, workersById, punches, weekStart: '2026-07-06' });
  assert.equal(gc.days.length, 0); // 0.5 − 0.75 → 0, no billable line
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

/* --------------------------------- GC billing cap (San Ignacio, from Aug 1) */
// weekStart>=2026-08-01 + SubID SANIG: worker-day billed at 9 clocked hrs max,
// lunch (0.75) only when the day clocked >= 8.5. Others: actual − lunch.
const carpHrs = (gc) => gc.days.reduce((t, d) => t + d.lines.filter((l) => l.item === 'Carpentry Labor').reduce((s, l) => s + l.hours, 0), 0);
const gcOneDay = (subId, inT, outT, weekStart, day = '2026-08-03') => buildGCInvoice({
  gcName: 'Opus', project: { ProjectID: 'P01', SiteName: 'French 1', GCRate: '68' },
  workersById: { W: { WorkerID: 'W', First: 'X', SubID: subId } },
  punches: [P(`${day} ${inT}`, 'IN', 'P01', 'W'), P(`${day} ${outT}`, 'OUT', 'P01', 'W')],
  weekStart,
});

test('GC cap: San Ignacio 10.5h day caps to 9, then lunch → 8.25', () => {
  assert.equal(round2(carpHrs(gcOneDay('SANIG', '06:00:00', '16:30:00', '2026-08-03'))), 8.25);
});
test('GC cap: San Ignacio under 8.5h day gets NO lunch', () => {
  assert.equal(round2(carpHrs(gcOneDay('SANIG', '07:00:00', '15:00:00', '2026-08-03'))), 8);   // 8.0, no lunch
});
test('GC cap: San Ignacio 8.75h day (>=8.5) loses lunch → 8.00', () => {
  assert.equal(round2(carpHrs(gcOneDay('SANIG', '07:00:00', '15:45:00', '2026-08-03'))), 8);
});
test('GC cap: a non-San-Ignacio sub is unchanged (10.5 → 9.75)', () => {
  assert.equal(round2(carpHrs(gcOneDay('LOPEZ', '06:00:00', '16:30:00', '2026-08-03'))), 9.75);
});
test('GC cap: pre-August San Ignacio week is NOT capped (10.5 → 9.75)', () => {
  assert.equal(round2(carpHrs(gcOneDay('SANIG', '06:00:00', '16:30:00', '2026-07-27', '2026-07-27'))), 9.75);
});

/* ------------------------------------------------ Guaranteed Day (sub floor) */
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const SANIG_G = { SubID: 'SANIG', CompanyName: 'San Ignacio LLC', DefaultPayRate: '50', GuaranteedDayOn: 'TRUE', GuaranteedDayHours: '10', GuaranteedDayMin: '8.5' };
const W1 = [{ WorkerID: 'W1', First: 'Fredy', SubID: 'SANIG' }];

test('guaranteed day: an 8.5 h clocked day is credited 10 and folds into total', () => {
  const punches = [P('2026-07-06 07:00:00', 'IN', 'PRJ_A'), P('2026-07-06 15:30:00', 'OUT', 'PRJ_A')]; // 8.5 h
  const inv = buildSubInvoice({ sub: SANIG_G, workers: W1, punches, weekStart: '2026-07-06' });
  assert.equal(inv.laborTotal, 425);           // 8.5 × 50, pre-uplift
  assert.equal(inv.guaranteedDayOn, true);
  assert.equal(inv.guaranteedDayHours, 1.5);   // 10 − 8.5
  assert.equal(inv.guaranteedDayAmount, 75);   // 1.5 × 50
  assert.equal(inv.total, 500);                // 425 + 75, uplift off LABOR only
  assert.deepEqual(inv.guaranteedDayByProject, [{ projectId: 'PRJ_A', name: 'PRJ_A', hours: 1.5 }]);
});

test('guaranteed day: cross-job uplift split sums EXACTLY to the uplift', () => {
  const punches = [
    P('2026-07-06 07:00:00', 'IN', 'PRJ_A'), P('2026-07-06 11:00:00', 'OUT', 'PRJ_A'), // 4.00 h
    P('2026-07-06 11:00:00', 'IN', 'PRJ_B'), P('2026-07-06 15:36:00', 'OUT', 'PRJ_B'), // 4.60 h → 4.50 billable
  ];
  const inv = buildSubInvoice({ sub: SANIG_G, workers: W1, punches, weekStart: '2026-07-06' });
  assert.equal(inv.guaranteedDayHours, 1.5);
  const split = Object.fromEntries(inv.guaranteedDayByProject.map((x) => [x.projectId, x.hours]));
  assert.deepEqual(split, { PRJ_A: 0.71, PRJ_B: 0.79 });
  assert.equal(round2(split.PRJ_A + split.PRJ_B), inv.guaranteedDayHours); // sums exactly
});

test('guaranteed day: a day UNDER the clocked threshold pays actual, no uplift', () => {
  const punches = [P('2026-07-06 07:00:00', 'IN', 'PRJ_A'), P('2026-07-06 11:00:00', 'OUT', 'PRJ_A')]; // 4 h
  const inv = buildSubInvoice({ sub: SANIG_G, workers: W1, punches, weekStart: '2026-07-06' });
  assert.equal(inv.guaranteedDayOn, true);      // policy is on...
  assert.equal(inv.guaranteedDayHours, 0);      // ...but nobody qualified
  assert.equal(inv.total, 200);
});

test('guaranteed day: a sub with NO policy is untouched (Lopez)', () => {
  const lopez = { SubID: 'LOPEZ', CompanyName: 'Lopez', DefaultPayRate: '45' };
  const punches = [P('2026-07-06 07:00:00', 'IN', 'PRJ_A', 'L1'), P('2026-07-06 17:00:00', 'OUT', 'PRJ_A', 'L1')]; // 10 h
  const inv = buildSubInvoice({ sub: lopez, workers: [{ WorkerID: 'L1', First: 'Carlito', SubID: 'LOPEZ' }], punches, weekStart: '2026-07-06' });
  assert.equal(inv.guaranteedDayOn, false);
  assert.equal(inv.guaranteedDayHours, 0);
  assert.equal(inv.guaranteedDayAmount, 0);
  assert.equal(inv.total, 450);                 // 10 × 45, unchanged
});
