// Unit tests for admin-punch's pure bits. Run: npm test (node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normStamp, normPin, toYN, genSubId, findSubByCompanyName, buildAddSub, buildEditSub } from '../netlify/functions/admin-punch.js';

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

/* ------------------------------------------------ op:'add-sub' (2026-09-11) */

test('genSubId: first 6 letters, A-Z only, uppercased', () => {
  assert.equal(genSubId('Johnson Electric', []), 'JOHNSO');
  assert.equal(genSubId('acme', []), 'ACME');                    // fewer than 6 letters → use what there is
  assert.equal(genSubId("O'Brien & Sons", []), 'OBRIEN');        // strips punctuation/spaces/ampersand
  assert.equal(genSubId('123 Excavating', []), 'EXCAVA');        // strips leading digits
});

test('genSubId: collision appends 2, 3, 4… until unique', () => {
  assert.equal(genSubId('Johnson Electric', ['JOHNSO']), 'JOHNSO2');
  assert.equal(genSubId('Johnson Electric', ['JOHNSO', 'JOHNSO2']), 'JOHNSO3');
  assert.equal(genSubId('Johnson Electric', ['JOHNSO', 'JOHNSO2', 'JOHNSO3']), 'JOHNSO4');
  // case-insensitive against existing IDs
  assert.equal(genSubId('Johnson Electric', ['johnso']), 'JOHNSO2');
});

test('findSubByCompanyName: matches case-insensitively, ignores surrounding whitespace', () => {
  const subs = [{ SubID: 'ACME', CompanyName: 'Acme Electric ' }];
  assert.ok(findSubByCompanyName(subs, 'acme electric'));
  assert.ok(findSubByCompanyName(subs, 'ACME ELECTRIC'));
  assert.equal(findSubByCompanyName(subs, 'Acme Plumbing'), undefined);
});

test('buildAddSub: happy path builds the exact Subs row shape', () => {
  const r = buildAddSub({ companyName: 'Green Mountain Roofing', phone: '802-555-0100', email: 'gm@example.com', defaultPayRate: 65 }, []);
  assert.equal(r.ok, true);
  assert.equal(r.subId, 'GREENM');
  assert.deepEqual(r.row, {
    SubID: 'GREENM',
    CompanyName: 'Green Mountain Roofing',
    Phone: '802-555-0100',
    Email: 'gm@example.com',
    DefaultPayRate: 65,
    HasEmployees: 'N',
    AutoInvoice: 'Y',
    Active: 'Y',
  });
});

test('buildAddSub: missing/blank phone, email, defaultPayRate default to blank', () => {
  const r = buildAddSub({ companyName: 'Solo Sub' }, []);
  assert.equal(r.ok, true);
  assert.equal(r.row.Phone, '');
  assert.equal(r.row.Email, '');
  assert.equal(r.row.DefaultPayRate, '');
});

test('buildAddSub: SubID collision against an existing Subs list gets suffixed', () => {
  const existing = [{ SubID: 'GREENM', CompanyName: 'Green Mountain Excavating' }];
  const r = buildAddSub({ companyName: 'Green Mountain Roofing' }, existing);
  assert.equal(r.ok, true);
  assert.equal(r.subId, 'GREENM2');
  assert.equal(r.row.SubID, 'GREENM2');
});

test('buildAddSub: duplicate CompanyName (case-insensitive) → 409 "sub exists"', () => {
  const existing = [{ SubID: 'ACME', CompanyName: 'Acme Electric' }];
  const r = buildAddSub({ companyName: 'ACME ELECTRIC' }, existing);
  assert.equal(r.ok, false);
  assert.equal(r.status, 409);
  assert.equal(r.error, 'sub exists');
});

test('buildAddSub: missing companyName → error (400)', () => {
  const r1 = buildAddSub({ companyName: '' }, []);
  assert.equal(r1.ok, false);
  assert.equal(r1.status, 400);
  assert.equal(r1.error, 'companyName required');

  const r2 = buildAddSub({}, []);
  assert.equal(r2.ok, false);
  assert.equal(r2.status, 400);

  const r3 = buildAddSub({ companyName: '   ' }, []);
  assert.equal(r3.ok, false);
  assert.equal(r3.status, 400);
});

/* ------------------------------------------------ op:'edit-sub' (2026-09-14) */

test('buildEditSub: subId required → 400', () => {
  const r1 = buildEditSub({ phone: '802-555-0100' }, []);
  assert.equal(r1.ok, false);
  assert.equal(r1.status, 400);
  assert.equal(r1.error, 'subId required');

  const r2 = buildEditSub({ subId: '   ', phone: '802-555-0100' }, []);
  assert.equal(r2.ok, false);
  assert.equal(r2.status, 400);
  assert.equal(r2.error, 'subId required');
});

test('buildEditSub: unknown subId → 404', () => {
  const r = buildEditSub({ subId: 'NOPE', phone: '802-555-0100' }, [{ SubID: 'ACME', Phone: '111', Email: 'a@x.com' }]);
  assert.equal(r.ok, false);
  assert.equal(r.status, 404);
  assert.equal(r.error, 'Sub not found');
});

test('buildEditSub: phone-only update leaves email alone', () => {
  const existing = [{ SubID: 'ACME', Phone: '111-111-1111', Email: 'old@acme.com', _rowNumber: 5 }];
  const r = buildEditSub({ subId: 'ACME', phone: '802-555-0100' }, existing);
  assert.equal(r.ok, true);
  assert.deepEqual(r.patch, { Phone: '802-555-0100' });
  assert.ok(!('Email' in r.patch));
});

test('buildEditSub: email-only update leaves phone alone', () => {
  const existing = [{ SubID: 'ACME', Phone: '111-111-1111', Email: 'old@acme.com', _rowNumber: 5 }];
  const r = buildEditSub({ subId: 'ACME', email: 'new@acme.com' }, existing);
  assert.equal(r.ok, true);
  assert.deepEqual(r.patch, { Email: 'new@acme.com' });
  assert.ok(!('Phone' in r.patch));
});

test('buildEditSub: both given → both patched', () => {
  const existing = [{ SubID: 'ACME', Phone: '111-111-1111', Email: 'old@acme.com', _rowNumber: 5 }];
  const r = buildEditSub({ subId: 'ACME', phone: '802-555-0100', email: 'new@acme.com' }, existing);
  assert.equal(r.ok, true);
  assert.deepEqual(r.patch, { Phone: '802-555-0100', Email: 'new@acme.com' });
});

test('buildEditSub: neither phone nor email given → 400 "phone or email required"', () => {
  const existing = [{ SubID: 'ACME', Phone: '111-111-1111', Email: 'old@acme.com' }];
  const r = buildEditSub({ subId: 'ACME' }, existing);
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(r.error, 'phone or email required');
});

test('buildEditSub: trims string inputs', () => {
  const existing = [{ SubID: 'ACME', Phone: '111-111-1111', Email: 'old@acme.com', _rowNumber: 5 }];
  const r = buildEditSub({ subId: '  ACME  ', phone: '  802-555-0100  ' }, existing);
  assert.equal(r.ok, true);
  assert.equal(r.patch.Phone, '802-555-0100');
});

test('buildEditSub: ok-case returned phone/email reflect current effective values — new value for what was sent, existing row value for what was not', () => {
  const existing = [{ SubID: 'ACME', Phone: '111-111-1111', Email: 'old@acme.com', _rowNumber: 5 }];

  const phoneOnly = buildEditSub({ subId: 'ACME', phone: '802-555-0100' }, existing);
  assert.equal(phoneOnly.phone, '802-555-0100');   // new
  assert.equal(phoneOnly.email, 'old@acme.com');    // unchanged, from the row

  const emailOnly = buildEditSub({ subId: 'ACME', email: 'new@acme.com' }, existing);
  assert.equal(emailOnly.phone, '111-111-1111');    // unchanged, from the row
  assert.equal(emailOnly.email, 'new@acme.com');    // new

  const both = buildEditSub({ subId: 'ACME', phone: '802-555-0100', email: 'new@acme.com' }, existing);
  assert.equal(both.phone, '802-555-0100');
  assert.equal(both.email, 'new@acme.com');
});
