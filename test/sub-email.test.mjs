// Sub invoice email: the "Documents generated in Slab." bar shows ONLY when a
// Slab PDF actually attached, and the guaranteed-day note uses the corrected
// strict-> boundary wording. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSubInvoiceEmail } from '../netlify/functions/lib/email-templates.js';

const baseInv = {
  company: 'San Ignacio LLC', period: 'Aug 17–21, 2026', weekStart: '2026-08-17',
  projectNames: ['French 1 - OPUS'], total: 16337.5, readout: [], flags: [],
  guaranteedDayOn: true, guaranteedDayHours: 0, guaranteedDayAmount: 0,
};

test('sub email: Slab bar appears only when a Slab doc attached', () => {
  const off = renderSubInvoiceEmail(baseInv, { invoiceNo: 2063 });
  assert.ok(!off.html.includes('Documents generated in Slab.'), 'no bar without a Slab attachment');

  const on = renderSubInvoiceEmail(baseInv, { invoiceNo: 2063, slabAttached: true, breakdownAttached: true });
  assert.ok(on.html.includes('Documents generated in Slab.'), 'bar shows when a Slab doc attached');
  assert.ok(on.html.includes('with the labor breakdown'), 'body mentions the breakdown when attached');
});

test('sub email: guaranteed-day note uses the strict > 8.5 wording', () => {
  const inv = { ...baseInv, guaranteedDayHours: 1, guaranteedDayAmount: 50 };
  const { html } = renderSubInvoiceEmail(inv, { invoiceNo: 2063 });
  assert.ok(html.includes('more than 8.5 clocked hours'), 'strict-> wording');
  assert.ok(!html.includes('8.5+ clocked hours'), 'stale inclusive wording is gone');
});
