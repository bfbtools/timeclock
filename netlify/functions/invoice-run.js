// Scheduled function — the Saturday-midnight invoicing run.
// Netlify cron is UTC; this is set for Sunday early-UTC and guards to Sunday ET
// (i.e., just after the Mon–Sat week closes). It generates and sends the week's
// invoices once, then logs them. Idempotent: if InvoiceLog already has rows for
// the target week, it no-ops.

import { targetWeekStart, fetchWeekData, generateWeekInvoices, deliverWeek } from './lib/invoicing.js';
import { etParts } from './lib/model.js';
import { readTab } from './lib/sheets.js';
import { TABS } from './lib/config.js';

const json = (status, body) => new Response(JSON.stringify(body, null, 2), { status, headers: { 'content-type': 'application/json' } });

export default async () => {
  const today = etParts().date;
  const isSunday = new Date(today + 'T00:00:00').getDay() === 0;
  if (!isSunday) return json(200, { skipped: 'not Sunday in ET', today });

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

// Sundays 06:00 UTC (≈ 01:00–02:00 ET) — safely just after the Saturday cutoff.
export const config = { schedule: '0 6 * * 0' };
