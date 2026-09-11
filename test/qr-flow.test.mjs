// Tests for the front-end's QR-optional clock-in and the Slab Mobile one-time
// message. public/js/app.js can't be imported directly under node:test (it
// touches document/localStorage at module scope, and this repo has no jsdom
// harness — see HANDOFF.md), so the pure decision logic lives in
// public/js/shared.js and is tested here directly. Run: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workerRequiresQr, shouldShowSlabMessage } from '../public/js/shared.js';

test('workerRequiresQr: qrRequired:false on the roster row → QR not required', () => {
  assert.equal(workerRequiresQr({ id: 'W1', qrRequired: false }), false);
});

test('workerRequiresQr: qrRequired:true (or missing) → QR required (default, unchanged)', () => {
  assert.equal(workerRequiresQr({ id: 'W1', qrRequired: true }), true);
  assert.equal(workerRequiresQr({ id: 'W1' }), true); // no field at all (demo data, older payload)
  assert.equal(workerRequiresQr(null), true);         // no worker identified yet
  assert.equal(workerRequiresQr(undefined), true);
});

test('shouldShowSlabMessage: only when the flag is on AND the device has not seen it', () => {
  assert.equal(shouldShowSlabMessage(true, null), true);   // flag on, never seen
  assert.equal(shouldShowSlabMessage(true, undefined), true);
});

test('shouldShowSlabMessage: flag off → never shown, regardless of localStorage', () => {
  assert.equal(shouldShowSlabMessage(false, null), false);
  assert.equal(shouldShowSlabMessage(false, '1'), false);
});

test('shouldShowSlabMessage: already seen on this device → never shown again', () => {
  assert.equal(shouldShowSlabMessage(true, '1'), false);
});
