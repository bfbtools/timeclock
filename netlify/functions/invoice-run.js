// Scheduled function — the weekly invoicing run.
// The billing week is Mon–Sun (Sunday is a paid workday), so this fires MONDAY
// early-UTC and guards to Monday ET — i.e., just after the Sunday-midnight
// close. It generates and sends the week's invoices once, then logs them.
// Idempotent: if InvoiceLog already has rows for the target week, it no-ops.

import { targetWeekStart, fetchWeekData, generateWeekInvoices, deliverWeek } from './lib/invoicing.js';
import { etParts } from './lib/model.js';
import { readTab } from './lib/sheets.js';
import { TABS } from './lib/config.js';

const json = (status, body) => new Response(JSON.stringify(body, null, 2), { status, headers: { 'content-type': 'application/json' } });

export default async () => {
  const today = etParts().date;
  const isMonday = new Date(today + 'T00:00:00').getDay() === 1;
  if (!isMonday) return json(200, { skipped: 'not Monday in ET', today });

  const weekStart = targetWeekStart(today);
  const log = await readTab(TABS.INVOICE_LOG);
  if (log.rows.some((r) => String(r.WeekStart).trim() === weekStart)) {
    return json(200, { skipped: 'already invoiced', weekStart });
  }

  const data = await fetchWeekData(weekStart);
  const gen = generateWeekInvoices({ ...data, weekStart });
  const results = await deliverWeek({ gen, send: true });
  return json(200, { ok: true, weekStart, weekEnd: data.weekEnd, results });
};

// Mondays 06:00 UTC (≈ 01:00–02:00 ET) — safely just after the Sunday-midnight
// close of the Mon–Sun week.
export const config = { schedule: '0 6 * * 1' };
