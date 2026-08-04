// Unit tests for admin-punch's pure bits. Run: npm test (node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normStamp, normPin, toYN } from '../netlify/functions/admin-punch.js';

test('normStamp: T-form and space-form → padded seconds', () => {
  assert.equal(normStamp('2026-07-13T16:00'), '2026-07-13 16:00:00');
  assert.equal(normStamp('2026-07-13 16:00'), '2026-07-13 16:00:00');
  assert.equal(normStamp('2026-07-13T16:00:30'), '2026-07-13 16:00:30');
});

test('normStamp: too-short/empty stays short (caller rejects <16)', () => {
  assert.ok(normStamp('').length < 16);
  assert.ok(normStamp('2026-07-13').length < 16);
});

test('normPin: 4 digits ok; empty clears; else rejected', () => {
  assert.deepEqual(normPin('1234'), { ok: true, value: '1234' });
  assert.deepEqual(normPin(' 4253 '), { ok: true, value: '4253' });
  assert.deepEqual(normPin(''), { ok: true, value: '' });      // clear → self-set in app
  assert.deepEqual(normPin(null), { ok: true, value: '' });
  assert.deepEqual(normPin(undefined), { ok: true, value: '' });
  assert.equal(normPin('123').ok, false);                       // 3 digits
  assert.equal(normPin('12345').ok, false);                     // 5 digits
  assert.equal(normPin('abcd').ok, false);                      // non-numeric
});

test('toYN: truthy variants → Y, everything else → N', () => {
  for (const v of [true, 'Y', 'y', 'yes', 'true', '1']) assert.equal(toYN(v), 'Y');
  for (const v of [false, 'N', 'n', 'no', 'false', '0', '', undefined, null]) assert.equal(toYN(v), 'N');
});
