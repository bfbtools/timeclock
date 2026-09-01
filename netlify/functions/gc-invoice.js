// GET /api/gc-invoice?token=&week=YYYY-MM-DD&company=Opus&adj=<json>&no=<invoiceNo>
// Admin-only. GENERATE-ONLY: returns the GC (Opus) draft-invoice PDF in the BFB
// layout, carrying Adrienne's adjustment (lunch/rate) computed through the SHARED
// slab-gcbill module — one allocator, no drift with Slab. It NEVER sends, logs,
// or writes Drive; Slab files the returned bytes.
//
// Pre-August floor: a week starting before 2026-08-01 is refused ENTIRELY —
// those weeks are settled (and a fresh draft would not match what BT billed
// Opus, e.g. 07-13 BT $27,193.60 vs draft $24,623.20), so we never re-emit them.
import { query, guard, json } from './lib/http.js';
import { etParts } from './lib/model.js';
import { targetWeekStart, fetchWeekData, generateWeekInvoices } from './lib/invoicing.js';
import { gcInvoicePdf } from './lib/gc-pdf.js';
import { COST_CODE_GC } from './lib/config.js';
import GCB from './lib/slab-gcbill.cjs';

const ADJ_FLOOR = '2026-08-01';
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const fullYear = (iso) => { const [y, m, d] = String(iso).split('-'); return `${m}/${d}/${y}`; };

export default guard(async (req) => {
  if (query(req, 'token') !== process.env.ADMIN_TOKEN || !process.env.ADMIN_TOKEN) {
    return json(process.env.ADMIN_TOKEN ? 401 : 403, { ok: false, error: process.env.ADMIN_TOKEN ? 'Unauthorized' : 'ADMIN_TOKEN is not configured' });
  }
  const weekStart = query(req, 'week') || targetWeekStart(etParts().date);
  const company = (query(req, 'company') || '').trim();
  if (!company) return json(400, { ok: false, error: 'company (GC name) required' });

  if (weekStart < ADJ_FLOOR) {
    return json(400, { ok: false, error: `Weeks before ${ADJ_FLOOR} are frozen and cannot be generated here (week ${weekStart}).` });
  }
  let adj = {};
  const rawAdj = query(req, 'adj');
  if (rawAdj) {
    try { adj = JSON.parse(rawAdj); } catch { return json(400, { ok: false, error: 'adj must be valid JSON' }); }
  }

  const data = await fetchWeekData(weekStart);
  const gen = generateWeekInvoices({ ...data, weekStart, company });
  const gcs = gen.gcInvoices.filter((g) => g.gcName === company);
  if (!gcs.length) return json(404, { ok: false, error: `No ${company} GC invoice for week ${weekStart}` });

  // Final line items per project through the shared allocator (lunch reallocation
  // over the GC-rate pool + per-line rate overrides), then combine into one doc.
  // Each project keeps its OWN number `<base>.<gcDraftSeq>` (French 1 .5 / French 2
  // .6) on its section heading — Slab sends `no` from the first bill only.
  const no = query(req, 'no') || '';
  const baseNo = no.split('.')[0];
  let total = 0;
  const projects = gcs
    .sort((a, b) => (a.gcDraftSeq ?? 99) - (b.gcDraftSeq ?? 99) || String(a.gc.project.name).localeCompare(String(b.gc.project.name)))
    .map((g) => {
      const c = GCB.compute(g.gc, adj[g.projectId] || {});
      total += c.total;
      return {
        name: g.gc.project.name,
        invoiceNo: (baseNo && Number.isInteger(g.gcDraftSeq)) ? `${baseNo}.${g.gcDraftSeq}` : '',
        days: c.days.map((d) => ({ date: d.date, lines: d.lines })),
      };
    });

  const g0 = gcs[0].gc;
  const pdf = await gcInvoicePdf({
    gcName: company,
    invoiceNo: no,
    costCode: g0.costCode || COST_CODE_GC,
    period: `${fullYear(g0.workStart)} – ${fullYear(g0.workEnd)}`,
    projects,
    total: r2(total),
    note: `Hours shown are net billable, after a 0.75 hr per-worker, per-day lunch deduction. Carpentry Labor billed at $68.00/hr; General Labor (Carlito) at $40.00/hr. ${company} GC projects only.`,
  });

  return new Response(pdf, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'cache-control': 'no-store',
      'content-disposition': `inline; filename="GCdraftInvoice_${company}_${weekStart}.pdf"`,
    },
  });
});
