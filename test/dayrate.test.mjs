// The Guaranteed Day (SUB_DAY_RATE_HANDOFF.md). Encodes every boundary row from
// §3, the cross-job allocation example, and the §4a config-validation refusals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subGuarantee, dayTotals, creditDay, allocateUplift } from '../netlify/functions/lib/dayrate.js';

const RULE = { hours: 10, min: 8.5, from: '' };
const cd = (clocked, billable) => creditDay({ clocked, billable, rule: RULE });

/* --------------------------------------------------- §3 boundary table */
test('creditDay: every §3 boundary row', () => {
  // clocked, billable, qualified, credited, uplift
  const rows = [
    [0.00, 0.00, false, 0.00, 0.00],   // a guarantee never invents a day
    [4.26, 4.25, false, 4.25, 0.00],   // real: Helio 2026-08-28
    [8.43, 8.50, false, 8.50, 0.00],   // real: Willy 2026-08-17 — clocked, not billable
    [8.49, 8.50, false, 8.50, 0.00],   // under by a hundredth
    [8.50, 8.50, true, 10.00, 1.50],   // threshold is >=, not >
    [8.51, 8.50, true, 10.00, 1.50],
    [8.61, 8.50, true, 10.00, 1.50],   // real: Elman 2026-08-27
    [8.60, 8.75, true, 10.00, 1.25],   // two shifts (4.20+4.40 clocked; 4.25+4.50 billable)
    [9.25, 9.25, true, 10.00, 0.75],   // 9.25-0.75 lunch=8.5, irrelevant: threshold is clocked
    [10.00, 10.00, true, 10.00, 0.00], // already at the floor
    [12.00, 12.00, true, 12.00, 0.00], // floor never trims a long day
  ];
  for (const [clocked, billable, qualified, credited, uplift] of rows) {
    const r = cd(clocked, billable);
    assert.equal(r.qualified, qualified, `qualified @ clocked ${clocked}`);
    assert.equal(r.credited, credited, `credited @ clocked ${clocked}`);
    assert.equal(r.uplift, uplift, `uplift @ clocked ${clocked}`);
  }
});

test('creditDay: uplift is never negative and the floor never caps', () => {
  assert.equal(cd(20, 20).credited, 20);       // 20h day pays 20
  assert.equal(cd(8.5, 8.5).uplift, 1.5);
  assert.ok(cd(4, 4).uplift >= 0);
});

/* -------------------------------------------------- clocked vs billable */
test('creditDay: 8.43 clocked / 8.50 billable does NOT qualify (clocked basis)', () => {
  // The exact case the spec calls out: testing on billable would wrongly pay 10.
  assert.equal(cd(8.43, 8.50).qualified, false);
  assert.equal(cd(8.43, 8.50).credited, 8.50);
});

/* ------------------------------------------------- effective-date gate */
test('creditDay: guaranteedDayFrom gates out earlier days, keeps on/after', () => {
  const rule = { hours: 10, min: 8.5, from: '2026-08-24' };
  assert.equal(creditDay({ clocked: 9, billable: 9, rule, date: '2026-08-23' }).uplift, 0);   // before → actual
  assert.equal(creditDay({ clocked: 9, billable: 9, rule, date: '2026-08-24' }).credited, 10); // on → applies
  assert.equal(creditDay({ clocked: 9, billable: 9, rule, date: '2026-08-31' }).credited, 10);
});

/* ------------------------------------------------ dayTotals from punches */
test('dayTotals: clocked=raw sum, billable=per-shift quarter, byJob split', () => {
  // 4.00 h on JPL (240 min) + 4.60 h on LAP (276 min) — the §3 allocation example.
  const intervals = [
    { minutes: 240, project: 'JPL' },
    { minutes: 276, project: 'LAP' },
  ];
  const t = dayTotals(intervals);
  assert.equal(t.clocked, 8.6);                 // 516/60
  assert.equal(t.billable, 8.5);                // 4.00 + round(4.60→4.50)
  assert.deepEqual(t.byJob, { JPL: 4.0, LAP: 4.5 });
});

/* ------------------------------------------- cross-job uplift allocation */
test('allocateUplift: 1.50 across JPL 4.00 / LAP 4.50 → 0.71 / 0.79, sums exact', () => {
  const split = allocateUplift(1.5, { JPL: 4.0, LAP: 4.5 });
  assert.deepEqual(split, { JPL: 0.71, LAP: 0.79 });
  assert.equal(Math.round((split.JPL + split.LAP) * 100) / 100, 1.5); // parts sum to the uplift
});

test('allocateUplift: single job takes the whole uplift; zero uplift → {}', () => {
  assert.deepEqual(allocateUplift(1.5, { P01: 8.5 }), { P01: 1.5 });
  assert.deepEqual(allocateUplift(0, { P01: 8.5 }), {});
});

/* --------------------------------------------------- §4a config parsing */
test('subGuarantee: a valid ON config parses', () => {
  assert.deepEqual(
    subGuarantee({ GuaranteedDayOn: 'TRUE', GuaranteedDayHours: '10', GuaranteedDayMin: '8.5', GuaranteedDayFrom: '' }),
    { hours: 10, min: 8.5, from: '' },
  );
  assert.equal(subGuarantee({ GuaranteedDayOn: 'TRUE', GuaranteedDayHours: 10, GuaranteedDayMin: 8.5, GuaranteedDayFrom: '2026-08-24' }).from, '2026-08-24');
});

test('subGuarantee: OFF or absent → null (nothing applies)', () => {
  assert.equal(subGuarantee({ GuaranteedDayOn: 'FALSE', GuaranteedDayHours: 10, GuaranteedDayMin: 8.5 }), null);
  assert.equal(subGuarantee({ GuaranteedDayHours: 10, GuaranteedDayMin: 8.5 }), null);
  assert.equal(subGuarantee(null), null);
});

test('subGuarantee: refuses bad rules rather than coercing (§4a)', () => {
  const on = { GuaranteedDayOn: 'TRUE' };
  assert.equal(subGuarantee({ ...on, GuaranteedDayHours: 'ten', GuaranteedDayMin: 8.5 }), null); // non-numeric
  assert.equal(subGuarantee({ ...on, GuaranteedDayHours: 25, GuaranteedDayMin: 8.5 }), null);    // out of 0–24
  assert.equal(subGuarantee({ ...on, GuaranteedDayHours: -1, GuaranteedDayMin: 0 }), null);      // negative
  assert.equal(subGuarantee({ ...on, GuaranteedDayHours: 8, GuaranteedDayMin: 9 }), null);       // min > hours
});

test('subGuarantee: a malformed start date is ignored (rule still applies every day)', () => {
  const r = subGuarantee({ GuaranteedDayOn: 'TRUE', GuaranteedDayHours: 10, GuaranteedDayMin: 8.5, GuaranteedDayFrom: 'not-a-date' });
  assert.equal(r.from, '');
});
