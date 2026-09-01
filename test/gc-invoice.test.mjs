// GC invoice: the renderer + integration with the shared slab-gcbill allocator.
// The allocator's own arithmetic (incl. 41.25→57.50→$32,703) is covered by the
// 277 assertions that ship WITH slab-gcbill; these pin the Time Clock's use of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { gcInvoicePdf } from '../netlify/functions/lib/gc-pdf.js';
const GCB = createRequire(import.meta.url)('../netlify/functions/lib/slab-gcbill.cjs');

const gi = () => ({
  lunchHours: 5, total: 7200,
  days: [{ date: '2026-08-03', lines: [
    { item: 'Carpentry Labor', rate: 68, hours: 100, amount: 6800, onsite: ['A'] },
    { item: 'General Labor', rate: 40, hours: 10, amount: 400, onsite: ['Carlito'] },
  ] }],
});

test('compute: unadjusted returns the generated figure', () => {
  assert.equal(GCB.compute(gi(), {}).total, 7200);
});

test('compute: lunch override reallocates the GC-rate pool ONLY (General Labor untouched)', () => {
  const c = GCB.compute(gi(), { lunch: 10 });      // pool gross 105 − 10 = 95
  assert.equal(c.days[0].lines[0].hours, 95);       // carpentry ($68 pool) reallocated
  assert.equal(c.days[0].lines[1].hours, 10);       // general ($40) unchanged
  assert.equal(c.total, 6860);                      // 95×68 + 10×40
});

test('compute: rate override hits one line by day:line key', () => {
  const c = GCB.compute(gi(), { rates: { '0:0': 70 } });
  assert.equal(c.total, 7400);                      // 100×70 + 10×40
});

test('gcInvoicePdf: renders a combined multi-project PDF', async () => {
  const pdf = await gcInvoicePdf({
    gcName: 'Opus', invoiceNo: '2062.5', costCode: '01 31 00', period: '08/03/2026 – 08/07/2026',
    projects: [
      { name: 'French 1', days: [{ date: '2026-08-03', lines: [{ item: 'Carpentry Labor', rate: 68, hours: 100, amount: 6800, onsite: ['Helio', 'Elder'] }] }] },
      { name: 'French 2', days: [{ date: '2026-08-03', lines: [{ item: 'Carpentry Labor', rate: 68, hours: 18.66, amount: 1268.88, onsite: ['Julio'] }] }] },
    ],
    total: 8068.88, note: 'Opus GC projects only.',
  });
  assert.ok(Buffer.isBuffer(pdf) && pdf.length > 1500);
  assert.equal(pdf.slice(0, 5).toString(), '%PDF-');
});
