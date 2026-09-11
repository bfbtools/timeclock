// GET /api/invoice-preview?token=...&week=YYYY-MM-DD&send=0&company=...
// Admin-only. Dry-runs the week's invoicing so Adrienne can see exactly what
// the weekly job WOULD generate (totals, who auto-sends) before it fires — and
// can trigger a real run on demand with &send=1 (e.g. to re-issue one corrected
// company). Gated by ADMIN_TOKEN so financials aren't public. Defaults to the
// most recently completed Mon–Sun week.
//
//   &company=San Ignacio LLC  → scope to ONE company: only that sub invoice is
//     generated/sent, so re-issuing a corrected sub doesn't also re-send every
//     other sub (the "duplicate Lopez" bug). Omit for the full week (the
//     scheduled Monday run is unaffected). Matches subInvoices[].company.
//
// GC (Opus) drafts are NO LONGER emailed — Slab owns them. This endpoint returns
// each GC draft's full per-day detail (`gcInvoices[]`) so Slab can render it and
// let Adrienne adjust the rate + lunch before sending.

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
  const company = query(req, 'company') || '';

  const capIn = Number(query(req, 'cap'));  // San Ignacio GC billing cap (default 9 in buildGCInvoice)
  const data = await fetchWeekData(weekStart);
  const gen = generateWeekInvoices({ ...data, weekStart, company, ...(Number.isFinite(capIn) && capIn > 0 ? { cap: capIn } : {}) });
  // allowTestRoute: this manual endpoint honors TEST_INVOICE_EMAIL (routes to the
  // test address). The scheduled run does not, so it always emails real subs.
  // Only SUB invoices are sent here; GC drafts are returned as data for Slab.
  const results = await deliverWeek({ gen, send, allowTestRoute: true }); // send=false → dry run

  return json(200, {
    ok: true, dryRun: !send, weekStart, weekEnd: data.weekEnd, company: company || null,
    counts: { sub: gen.subInvoices.length, gc: gen.gcInvoices.length },
    // Guaranteed Day (SUB_DAY_RATE_HANDOFF §9): emit the pieces on EVERY sub —
    // laborTotal + materialsTotal + guaranteedDayAmount = total. `guaranteedDayOn`
    // separates "no policy" (Lopez) from "policy on, nobody fell short" (both 0).
    // `guaranteedDayByProject` is the authoritative per-job split (sums to hours).
    subInvoices: gen.subInvoices.map((s) => ({
      company: s.sub.CompanyName,
      laborTotal: s.invoice.laborTotal,
      materialsTotal: s.invoice.materialsTotal,
      guaranteedDayOn: s.invoice.guaranteedDayOn,
      guaranteedDayHours: s.invoice.guaranteedDayHours,
      guaranteedDayAmount: s.invoice.guaranteedDayAmount,
      guaranteedDayByProject: s.invoice.guaranteedDayByProject,
      // Per-project invoice lines so Slab's sub-invoice renders REAL rates/amounts
      // instead of deriving a blended rate (total/hours). One entry per job for the
      // week, matching the Time Clock's own PDF row unit (pdf.js): { projectId,
      // name, hours (quarter-rounded billable), rate (null when workers mix rates —
      // Slab prints "—", never a blend), amount (Σ worker hrs × real pay rate),
      // perDay[] for the DATES range }. Uplift stays out of these lines (it's on
      // guaranteedDay* + folds into total), matching the invoice's separate uplift row.
      projects: s.invoice.projects,
      total: s.invoice.total,
      autoSend: s.autoSend,
      independent: s.independent,
    })),
    // Full GC detail for Slab: per-day lines (item, rate, hours, amount, onsite),
    // net totalHours + lunchHours (gross = the two summed), and the pieces Slab
    // uses to number the draft (`<primarySubId's #>.<gcDraftSeq>`) and to re-cost
    // it under an adjusted rate/lunch.
    gcInvoices: gen.gcInvoices.map((g) => ({
      gc: g.gc.gcName,
      project: g.gc.project,
      primarySubId: g.primarySubId,
      gcDraftSeq: g.gcDraftSeq,
      period: g.gc.period,
      costCode: g.gc.costCode,
      lunchHours: g.gc.lunchHours,
      totalHours: g.gc.totalHours,
      total: g.gc.total,
      days: g.gc.days,
    })),
    results,
  });
});
