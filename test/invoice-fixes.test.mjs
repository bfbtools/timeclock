// Tests for the 2026-08-04 invoice-generator fixes:
//   T1 per-shift 15-min rounding (invoice-only)   T2 per-sub numbering
//   T3 GC = <sub #>.5   T4 QBDraft suppression   T5 QB rate bug   T6 date ranges
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSubInvoice, buildGCInvoice, buildQBInvoice } from '../netlify/functions/lib/invoice-lib.js';
import { roundQuarter, projectHoursQuarter } from '../netlify/functions/lib/rollup.js';
import { generateWeekInvoices, nextSubNumber } from '../netlify/functions/lib/invoicing.js';

const P = (ts, action, project, worker = 'W1') =>
  ({ Timestamp: ts, Action: action, Project: project, WorkerID: worker });
const EN = '–'; // en-dash used in the MM/DD–MM/DD/YY period label

/* ---------------------------------------------------------------- T1 rounding */
test('roundQuarter: snaps to the nearest 15 minutes', () => {
  assert.equal(roundQuarter(8 + 23 / 60), 8.5);  // 8h23m → 8.50
  assert.equal(roundQuarter(8 + 56 / 60), 9.0);  // 8h56m → 9.00
  assert.equal(roundQuarter(8 + 7 / 60), 8.0);   // 8h07m → 8.00
  assert.equal(roundQuarter(7 + 37 / 60), 7.5);  // 7h37m → 7.50
  assert.equal(roundQuarter(3 + 8 / 60), 3.25);  // 3h08m → 3.25
});

test('projectHoursQuarter: rounds EACH shift, not the daily total', () => {
  // Two 3h08m shifts on one project/day: per-shift → 3.25+3.25 = 6.5.
  // (Rounding the 6h16m daily total instead would give 6.25 — the wrong answer.)
  const intervals = [
    { minutes: 188, project: 'PRJ_A' }, // 3h08m
    { minutes: 188, project: 'PRJ_A' }, // 3h08m
  ];
  assert.equal(projectHoursQuarter(intervals)['PRJ_A'], 6.5);
});

test('sub invoice: each shift rounds to 15 min (raw scan times untouched)', () => {
  const sub = { SubID: 'S1', CompanyName: 'Diego', DefaultPayRate: '50' };
  const workers = [{ WorkerID: 'W1', First: 'Diego', SubID: 'S1' }];
  const punches = [
    P('2026-07-06 07:00:00', 'IN', 'PRJ_A'), P('2026-07-06 15:23:00', 'OUT', 'PRJ_A'), // 8h23m → 8.50
    P('2026-07-07 07:00:00', 'IN', 'PRJ_A'), P('2026-07-07 15:56:00', 'OUT', 'PRJ_A'), // 8h56m → 9.00
  ];
  const inv = buildSubInvoice({ sub, workers, punches, projectsById: { PRJ_A: { SiteName: 'French Hill' } }, weekStart: '2026-07-06' });
  assert.equal(inv.projects[0].hours, 17.5);       // 8.5 + 9.0
  assert.equal(inv.projects[0].amount, 875);       // 17.5 × 50
  assert.equal(inv.workerLines[0].hours, 17.5);    // worker line ties to project line
  assert.equal(inv.workerLines[0].amount, 875);
  assert.equal(inv.total, 875);
});

test('GC invoice: shift rounds first, THEN the 0.75 lunch still ties', () => {
  const project = { ProjectID: 'OPUS1', SiteName: 'French 1', GCName: 'Opus', GCRate: '68', BillsToGC: 'Y' };
  const workersById = { W1: { WorkerID: 'W1', First: 'Fredy' } };
  const punches = [P('2026-07-06 07:00:00', 'IN', 'OPUS1', 'W1'), P('2026-07-06 15:07:00', 'OUT', 'OPUS1', 'W1')]; // 8h07m → 8.00
  const gc = buildGCInvoice({ gcName: 'Opus', project, workersById, punches, weekStart: '2026-07-06' });
  assert.equal(gc.lunchHours, 0.75);
  assert.equal(gc.days[0].lines[0].hours, 7.25); // 8.00 − 0.75
  assert.equal(gc.days[0].lines[0].amount, 493); // 7.25 × 68
  assert.equal(gc.total, 493);
});

/* ------------------------------------------------------------- T2 numbering */
test('nextSubNumber: each sub continues its own sequence from StartInvoiceNo', () => {
  const SI = { SubID: 'SANIG', StartInvoiceNo: '2058' };
  const LOPEZ = { SubID: 'LOPEZ', StartInvoiceNo: '1001' };
  // no history → the configured start
  assert.equal(nextSubNumber(SI, []), 2058);
  assert.equal(nextSubNumber(LOPEZ, []), 1001);
  // one logged sub invoice → the next number
  assert.equal(nextSubNumber(SI, [{ SubID: 'SANIG', Type: 'sub', InvoiceNo: '2058' }]), 2059);
  assert.equal(nextSubNumber(LOPEZ, [{ SubID: 'LOPEZ', Type: 'sub', InvoiceNo: '1001' }]), 1002);
  // old shared-counter rows below the start are ignored
  assert.equal(nextSubNumber(SI, [{ SubID: 'SANIG', Type: 'sub', InvoiceNo: '1011' }]), 2058);
  // another sub's rows don't advance this sub
  assert.equal(nextSubNumber(SI, [{ SubID: 'LOPEZ', Type: 'sub', InvoiceNo: '2058' }]), 2058);
});

test('nextSubNumber: QB (whole) and GC (.5) rows never advance the sequence', () => {
  const SI = { SubID: 'SANIG', StartInvoiceNo: '2058' };
  const log = [
    { SubID: 'SANIG', Type: 'qb', InvoiceNo: '2058' },   // QB reuses the sub number
    { SubID: 'SANIG', Type: 'GC', InvoiceNo: '2058.5' },  // GC roll-up
  ];
  assert.equal(nextSubNumber(SI, log), 2058); // neither counts as a sub number
});

test('nextSubNumber: missing StartInvoiceNo falls back to 1001', () => {
  assert.equal(nextSubNumber({ SubID: 'NEW' }, []), 1001);
});

/* --------------------------------------------- T3 GC linkage + T4 suppression */
test('generateWeekInvoices: QBDraft=N suppresses that sub; GC links to top-hours sub', () => {
  const subs = [
    { SubID: 'SANIG', CompanyName: 'San Ignacio', HasEmployees: 'Y', DefaultPayRate: '50', AutoInvoice: 'Y', Active: 'Y' },
    { SubID: 'LOPEZ', CompanyName: 'Lopez', HasEmployees: 'Y', DefaultPayRate: '45', AutoInvoice: 'Y', Active: 'Y' },
  ];
  const workers = [
    { WorkerID: 'W1', First: 'Fredy', SubID: 'SANIG', Active: 'Y' },
    { WorkerID: 'W2', First: 'Antony', SubID: 'LOPEZ', Active: 'Y' },
  ];
  const projects = [{ ProjectID: 'OPUS1', SiteName: 'French 1', Active: 'Y', BillsToGC: 'Y', GCName: 'Opus', GCRate: '68' }];
  const punches = [
    P('2026-07-06 07:00:00', 'IN', 'OPUS1', 'W1'), P('2026-07-06 15:00:00', 'OUT', 'OPUS1', 'W1'), // SANIG 8h
    P('2026-07-06 07:00:00', 'IN', 'OPUS1', 'W2'), P('2026-07-06 11:00:00', 'OUT', 'OPUS1', 'W2'), // LOPEZ 4h
  ];
  const gen = generateWeekInvoices({ subs, workers, projects, punches, materials: [], weekStart: '2026-07-06' });
  assert.equal(gen.subInvoices.length, 2);
  assert.equal(gen.qbInvoices, undefined);                     // QB drafts fully dropped (both subs)
  assert.equal(gen.gcInvoices[0].primarySubId, 'SANIG');       // 8h > 4h
});

test('generateWeekInvoices: ONE GC draft per Opus project, carrying its GCDraftSeq', () => {
  const subs = [{ SubID: 'SANIG', CompanyName: 'San Ignacio', HasEmployees: 'Y', DefaultPayRate: '50', AutoInvoice: 'Y', Active: 'Y' }];
  const workers = [{ WorkerID: 'W1', First: 'Fredy', SubID: 'SANIG', Active: 'Y' }];
  const projects = [
    { ProjectID: 'P01', SiteName: 'French 1', Active: 'Y', BillsToGC: 'Y', GCName: 'Opus', GCRate: '68', GCDraftSeq: '5' },
    { ProjectID: 'P02', SiteName: 'French 2', Active: 'Y', BillsToGC: 'Y', GCName: 'Opus', GCRate: '68', GCDraftSeq: '6' },
  ];
  const punches = [
    P('2026-07-06 07:00:00', 'IN', 'P01', 'W1'), P('2026-07-06 15:00:00', 'OUT', 'P01', 'W1'), // French 1
    P('2026-07-07 07:00:00', 'IN', 'P02', 'W1'), P('2026-07-07 15:00:00', 'OUT', 'P02', 'W1'), // French 2
  ];
  const gen = generateWeekInvoices({ subs, workers, projects, punches, materials: [], weekStart: '2026-07-06' });
  assert.equal(gen.gcInvoices.length, 2);                       // one draft PER project
  const byName = Object.fromEntries(gen.gcInvoices.map((g) => [g.gc.project.name, g]));
  assert.equal(byName['French 1'].gcDraftSeq, 5);
  assert.equal(byName['French 2'].gcDraftSeq, 6);
  assert.equal(byName['French 1'].projectId, 'P01');
});

/* ------------------------------------------ company scope (single re-issue) */
// Fixture: two subs both with hours on an Opus project, so a normal run makes
// two sub invoices + one GC draft. The company filter must narrow that.
const scopeFixture = () => ({
  subs: [
    { SubID: 'SANIG', CompanyName: 'San Ignacio LLC', HasEmployees: 'Y', DefaultPayRate: '50', AutoInvoice: 'Y', Active: 'Y' },
    { SubID: 'LOPEZ', CompanyName: 'Lopez Exterior & Interior Construction LLC', HasEmployees: 'Y', DefaultPayRate: '45', AutoInvoice: 'Y', Active: 'Y' },
  ],
  workers: [
    { WorkerID: 'W1', First: 'Fredy', SubID: 'SANIG', Active: 'Y' },
    { WorkerID: 'W2', First: 'Antony', SubID: 'LOPEZ', Active: 'Y' },
  ],
  projects: [{ ProjectID: 'P01', SiteName: 'French 1', Active: 'Y', BillsToGC: 'Y', GCName: 'Opus', GCRate: '68' }],
  punches: [
    P('2026-07-06 07:00:00', 'IN', 'P01', 'W1'), P('2026-07-06 15:00:00', 'OUT', 'P01', 'W1'), // SANIG 8h
    P('2026-07-06 07:00:00', 'IN', 'P01', 'W2'), P('2026-07-06 11:00:00', 'OUT', 'P01', 'W2'), // LOPEZ 4h
  ],
  materials: [], weekStart: '2026-07-06',
});

test('company scope: a sub company → only that sub invoice, no GC, no other sub', () => {
  const gen = generateWeekInvoices({ ...scopeFixture(), company: 'San Ignacio LLC' });
  assert.equal(gen.subInvoices.length, 1);
  assert.equal(gen.subInvoices[0].sub.CompanyName, 'San Ignacio LLC');
  assert.equal(gen.gcInvoices.length, 0);                       // GC excluded when scoping a sub
});

test('company scope: match is case/space-insensitive', () => {
  const gen = generateWeekInvoices({ ...scopeFixture(), company: '  san ignacio llc ' });
  assert.equal(gen.subInvoices.length, 1);
  assert.equal(gen.subInvoices[0].sub.CompanyName, 'San Ignacio LLC');
});

test('company scope: a GC name → only that GC draft, no sub invoices', () => {
  const gen = generateWeekInvoices({ ...scopeFixture(), company: 'Opus' });
  assert.equal(gen.subInvoices.length, 0);
  assert.equal(gen.gcInvoices.length, 1);
  assert.equal(gen.gcInvoices[0].gc.gcName, 'Opus');
});

test('company scope: omitted → full week unchanged (two subs + one GC)', () => {
  const gen = generateWeekInvoices({ ...scopeFixture() });
  assert.equal(gen.subInvoices.length, 2);
  assert.equal(gen.gcInvoices.length, 1);
});

test('company scope: unknown company → nothing (no accidental full-week send)', () => {
  const gen = generateWeekInvoices({ ...scopeFixture(), company: 'Nobody Inc' });
  assert.equal(gen.subInvoices.length, 0);
  assert.equal(gen.gcInvoices.length, 0);
});

/* --------------------------------------------- sub email scan-times read-out */
test('sub invoice read-out: ACTUAL (unrounded) scan times, 0-hour junk dropped', () => {
  const sub = { SubID: 'S1', CompanyName: 'Diego', DefaultPayRate: '50' };
  const workers = [{ WorkerID: 'W1', First: 'Diego', SubID: 'S1' }];
  const punches = [
    P('2026-07-06 06:47:00', 'IN', 'PRJ_A'), P('2026-07-06 15:10:00', 'OUT', 'PRJ_A'), // 8h23m = 8.38 actual → 8.5 invoice
    P('2026-07-07 14:00:00', 'IN', 'PRJ_A'), P('2026-07-07 14:00:20', 'OUT', 'PRJ_A'), // 20-sec junk → dropped
  ];
  const inv = buildSubInvoice({ sub, workers, punches, weekStart: '2026-07-06' });
  const r = inv.readout.find((x) => x.worker === 'Diego');
  assert.equal(r.segments.length, 1);       // 20-sec mis-punch dropped
  assert.equal(r.segments[0].hours, 8.38);  // ACTUAL, not the 8.5 invoice qty
  assert.equal(r.hours, 8.38);              // weekly actual total
  assert.equal(inv.projects[0].hours, 8.5); // invoice qty IS the 15-min rounding
});

/* ------------------------------------------------------------- T5 QB rate bug */
test('QB invoice: Carpentry reads the sub DefaultPayRate, not a hardcoded $50', () => {
  const sub = { SubID: 'LOPEZ', CompanyName: 'Lopez', DefaultPayRate: '45' };
  const workers = [{ WorkerID: 'W1', First: 'Antony', SubID: 'LOPEZ' }];
  const punches = [P('2026-07-06 07:00:00', 'IN', 'PRJ_A'), P('2026-07-06 15:00:00', 'OUT', 'PRJ_A')]; // 8h
  const qb = buildQBInvoice({ sub, workers, punches, weekStart: '2026-07-06' });
  const carp = qb.lines.find((l) => l.item === 'Carpentry');
  assert.equal(carp.rate, 45);        // was $50 → overstated Lopez ~$430/wk
  assert.equal(carp.amount, 360);     // 8 × 45
  // an explicit carpentryRate still wins
  const qb2 = buildQBInvoice({ sub, workers, punches, weekStart: '2026-07-06', carpentryRate: 60 });
  assert.equal(qb2.lines.find((l) => l.item === 'Carpentry').rate, 60);
});

/* ------------------------------------------------------------- T6 date ranges */
test('date ranges: invoices carry the MM/DD–MM/DD/YY work period', () => {
  const sub = { SubID: 'S1', CompanyName: 'Diego', DefaultPayRate: '50' };
  const workers = [{ WorkerID: 'W1', First: 'Diego', SubID: 'S1' }];
  const punches = [
    P('2026-07-06 07:00:00', 'IN', 'PRJ_A'), P('2026-07-06 15:00:00', 'OUT', 'PRJ_A'), // Mon
    P('2026-07-08 07:00:00', 'IN', 'PRJ_A'), P('2026-07-08 15:00:00', 'OUT', 'PRJ_A'), // Wed
  ];
  const projectsById = { PRJ_A: { SiteName: 'French Hill' } };
  const inv = buildSubInvoice({ sub, workers, punches, projectsById, weekStart: '2026-07-06' });
  assert.equal(inv.period, `07/06/26${EN}07/08/26`); // full year on both sides

  const qb = buildQBInvoice({ sub, workers, punches, projectsById, weekStart: '2026-07-06' });
  assert.equal(qb.period, `07/06/26${EN}07/08/26`);
  assert.match(qb.lines[0].description, /07\/06\/26–07\/08\/26$/); // line desc carries the range

  // single worked day collapses to MM/DD/YY
  const one = buildSubInvoice({ sub, workers, punches: punches.slice(0, 2), projectsById, weekStart: '2026-07-06' });
  assert.equal(one.period, '07/06/26');
});
