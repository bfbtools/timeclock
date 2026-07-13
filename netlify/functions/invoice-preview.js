// GET /api/invoice-preview?token=...&week=YYYY-MM-DD&send=0
// Admin-only. Dry-runs the week's invoicing so Adrienne can see exactly what
// the weekly job WOULD generate (totals, who auto-sends, GC/QB drafts) before
// it fires — and can trigger a real run on demand with &send=1 (e.g. to pull a
// SnowPeak draft or re-run a week). Gated by ADMIN_TOKEN so financials aren't
// public. Defaults to the most recently completed Mon–Sun week.

import { json, query, guard } from './lib/http.js';
import { etParts } from './lib/model.js';
import { targetWeekStart, fetchWeekData, generateWeekInvoices, deliverWeek } from './lib/invoicing.js';

export default guard(async (req) => {
  const token = query(req, 'token');
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return json(403, { ok: false, error: 'ADMIN_TOKEN is not configured' });
  if (token !== expected) return json(401, { ok: false, error: 'Unauthorized' });

  const weekStart = query(req, 'week') || targetWeekStart(etParts().date);
  const send = query(req, 'send') === '1';

  const data = await fetchWeekData(weekStart);
  const gen = generateWeekInvoices({ ...data, weekStart });
  const results = await deliverWeek({ gen, send }); // send=false → dry run (no email, no log)

  return json(200, {
    ok: true, dryRun: !send, weekStart, weekEnd: data.weekEnd,
    counts: { sub: gen.subInvoices.length, qb: gen.qbInvoices.length, gc: gen.gcInvoices.length },
    subInvoices: gen.subInvoices.map((s) => ({ company: s.sub.CompanyName, total: s.invoice.total, autoSend: s.autoSend, independent: s.independent })),
    qbInvoices: gen.qbInvoices.map((q) => ({ company: q.qb.company, hours: q.qb.totalHours, total: q.qb.total })),
    gcInvoices: gen.gcInvoices.map((g) => ({ gc: g.gc.gcName, lunchHours: g.gc.lunchHours, total: g.gc.total })),
    results,
  });
});
