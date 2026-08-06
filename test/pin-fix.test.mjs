// Tests for the 2026-08-06 PIN leading-zero fix.
//   Root cause: Workers rows were written with USER_ENTERED, so a 4-digit PIN
//   like "0304" was parsed to the number 304 (leading zero dropped) — and since
//   updateRow rewrites the whole row, any edit re-corrupted it. Verify:
//     - Workers-tab writes are RAW (so "0304" stays text);
//     - normStoredPin pads a stripped PIN back to 4 digits for comparison, so an
//       already-corrupted 304 still matches the worker's real 0304.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normStoredPin } from '../netlify/functions/lib/model.js';
import { writeOption } from '../netlify/functions/lib/sheets.js';

test('writeOption: Workers is RAW; date-bearing tabs stay USER_ENTERED', () => {
  assert.equal(writeOption('Workers'), 'RAW');       // PINs/rates: no coercion
  assert.equal(writeOption('Punches'), 'USER_ENTERED');   // timestamps → datetime
  assert.equal(writeOption('Materials'), 'USER_ENTERED');
  assert.equal(writeOption('Subs'), 'USER_ENTERED');
  assert.equal(writeOption('Projects'), 'USER_ENTERED');
  assert.equal(writeOption('InvoiceLog'), 'USER_ENTERED');
});

test('normStoredPin: pads a leading-zero-stripped PIN back to 4 digits', () => {
  assert.equal(normStoredPin('304'), '0304');   // Henry's corrupted PIN → real value
  assert.equal(normStoredPin('12'), '0012');
  assert.equal(normStoredPin('7'), '0007');
  assert.equal(normStoredPin(304), '0304');     // stored as a real number
});

test('normStoredPin: leaves an intact 4-digit PIN unchanged', () => {
  assert.equal(normStoredPin('0304'), '0304');
  assert.equal(normStoredPin('1234'), '1234');
  assert.equal(normStoredPin(' 0304 '), '0304'); // trims
});

test('normStoredPin: blank/unset stays blank (no PIN set)', () => {
  assert.equal(normStoredPin(''), '');
  assert.equal(normStoredPin(null), '');
  assert.equal(normStoredPin(undefined), '');
});

test('a stored 304 now verifies against the entered 0304 (the bug fix)', () => {
  const storedFromSheet = '304';   // what the coerced cell reads back as
  const entered = '0304';          // what Henry types
  assert.equal(normStoredPin(storedFromSheet), normStoredPin(entered));
});
