// Tests for the per-worker/per-sub QRRequired flag (docs/bfb-timeclock-spec.md
// "QR Required"). Both Sheet columns are OPTIONAL; a missing column resolves
// to `true` for everyone — today's behavior, unchanged. Run: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQrFlag, resolveQrRequired, rosterRow, subForSite } from '../netlify/functions/lib/model.js';

test('parseQrFlag: recognizes TRUE/FALSE, yes/no, 1/0, any case, and real booleans', () => {
  for (const v of [true, 'TRUE', 'true', 'YES', 'yes', 'Y', 'y', '1', 1]) assert.equal(parseQrFlag(v), true, `expected true for ${JSON.stringify(v)}`);
  for (const v of [false, 'FALSE', 'false', 'NO', 'no', 'N', 'n', '0', 0]) assert.equal(parseQrFlag(v), false, `expected false for ${JSON.stringify(v)}`);
});

test('parseQrFlag: blank/absent/unrecognized all resolve to undefined (fall through)', () => {
  assert.equal(parseQrFlag(''), undefined);
  assert.equal(parseQrFlag(undefined), undefined);
  assert.equal(parseQrFlag(null), undefined);
  assert.equal(parseQrFlag('   '), undefined);
  assert.equal(parseQrFlag('maybe'), undefined); // unrecognized text — never guessed
});

test('resolveQrRequired: worker\'s own cell wins over the sub\'s', () => {
  const worker = { QRRequired: 'FALSE' };
  const sub = { QRRequired: 'TRUE' };
  assert.equal(resolveQrRequired(worker, sub), false);
});

test('resolveQrRequired: falls through to the sub\'s cell when the worker\'s is blank', () => {
  const worker = { QRRequired: '' };
  const sub = { QRRequired: 'no' };
  assert.equal(resolveQrRequired(worker, sub), false);
  assert.equal(resolveQrRequired({}, { QRRequired: 'yes' }), true);
});

test('resolveQrRequired: defaults to true with neither column present (today\'s behavior)', () => {
  assert.equal(resolveQrRequired({}, {}), true);
  assert.equal(resolveQrRequired({}, null), true);
  assert.equal(resolveQrRequired(null, null), true);
  assert.equal(resolveQrRequired(undefined, undefined), true);
});

test('resolveQrRequired: an unrecognized worker cell falls through to the sub, not to a guess', () => {
  assert.equal(resolveQrRequired({ QRRequired: 'sometimes' }, { QRRequired: 'FALSE' }), false);
});

test('rosterRow: carries qrRequired resolved from the worker + sub rows', () => {
  const worker = { WorkerID: 'W1', First: 'Fredy', Type: 'employee', PIN: '1234', SubID: 'S1', QRRequired: 'FALSE' };
  const sub = { SubID: 'S1', CompanyName: 'San Ignacio', QRRequired: 'TRUE' };
  const row = rosterRow({ worker, sub, punchList: [], today: '2026-09-07', weekStart: '2026-09-01', weekEnd: '2026-09-07' });
  assert.equal(row.qrRequired, false); // worker's own FALSE beats the sub's TRUE
  assert.equal(row.id, 'W1');
});

test('rosterRow: no QRRequired column anywhere → qrRequired true', () => {
  const worker = { WorkerID: 'W2', First: 'Nelson', Type: 'employee', PIN: '', SubID: 'S2' };
  const sub = { SubID: 'S2', CompanyName: 'SnowPeak' };
  const row = rosterRow({ worker, sub, punchList: [], today: '2026-09-07', weekStart: '2026-09-01', weekEnd: '2026-09-07' });
  assert.equal(row.qrRequired, true);
});

test('subForSite: carries the sub\'s own qrRequired for the /api/site sub list', () => {
  assert.deepEqual(subForSite({ SubID: 'S1', CompanyName: 'San Ignacio', QRRequired: 'FALSE' }),
    { id: 'S1', company: 'San Ignacio', qrRequired: false });
  assert.deepEqual(subForSite({ SubID: 'S3', CompanyName: 'Lopez' }),
    { id: 'S3', company: 'Lopez', qrRequired: true }); // no column → true
});
