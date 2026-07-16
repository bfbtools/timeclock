// Unit tests for admin-punch's pure bits. Run: npm test (node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normStamp } from '../netlify/functions/admin-punch.js';

test('normStamp: T-form and space-form → padded seconds', () => {
  assert.equal(normStamp('2026-07-13T16:00'), '2026-07-13 16:00:00');
  assert.equal(normStamp('2026-07-13 16:00'), '2026-07-13 16:00:00');
  assert.equal(normStamp('2026-07-13T16:00:30'), '2026-07-13 16:00:30');
});

test('normStamp: too-short/empty stays short (caller rejects <16)', () => {
  assert.ok(normStamp('').length < 16);
  assert.ok(normStamp('2026-07-13').length < 16);
});
