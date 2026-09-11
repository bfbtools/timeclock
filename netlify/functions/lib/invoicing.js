// Week invoicing orchestration. `generateWeekInvoices` is pure (takes fetched
// rows, returns the invoices); `fetchWeekData` reads the Sheet. Two buckets:
//   - Sub invoices  → auto-sent to accounting@ + the sub (PDF + scan read-out).
//                     Independent always; company subs only if AutoInvoice=Y.
//   - GC drafts     → one PER Opus project (BillsToGC=Y), to accounting@ for review.
// (QuickBooks drafts were dropped 2026-08-07.)

import { readTab, appendRow } from './sheets.js';
import { TABS } from './config.js';
import { mondayOf, weekRange, dayKey, num } from './rollup.js';
import { buildSubInvoice, buildGCInvoice } from './invoice-lib.js';
import { etStamp, etParts } from './model.js';
import { sendEmail } from './email.js';
import { subInvoicePdf } from './pdf.js';
import { invoiceFileName } from './need-to-be-processed.js';
import { renderSubInvoiceEmail } from './email-templates.js';

const isY = (v) => String(v).trim().toUpperCase().startsWith('Y');
const active = (r) => isY(r.Active);
const norm = (s) => String(s || '').trim().toLowerCase();
// First invoice number for a sub with no configured StartInvoiceNo.
const DEFAULT_START_NO = 1001;

function addDaysISO(iso, n) {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Fetch a Slab-generated sub PDF at send time (POST /api/sub-invoice-pdf, service
// auth). Returns { filename, content } or null on ANY failure — endpoint not
// deployed yet (404), Slab down, or no token — so the invoice still sends from the
// Time Clock's own pdf.js and a sub is never blocked from getting paid. Logs the
// Slab error BODY, not just the status, so a failure is diagnosable.
async function fetchSlabPdf({ company, weekStart, doc }) {
  const token = process.env.SLAB_SERVICE_TOKEN;
  if (!token) return null;
  const base = process.env.SLAB_BASE_URL || 'https://slab.backforty.builders';
  try {
    const r = await fetch(`${base}/api/sub-invoice-pdf`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Slab-Service-Token': token },
      body: JSON.stringify({ subId: company, weekStart, doc }),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data || data.ok === false || !data.contentBase64) {
      console.error(`[slab-pdf] ${doc} ${company} ${weekStart}: HTTP ${r.status} — ${(data && (data.error || data.message)) || '(no/invalid body)'}`);
      return null;
    }
    return { filename: data.filename || `${company}_${doc}_${weekStart}.pdf`, content: Buffer.from(data.contentBase64, 'base64') };
  } catch (e) {
    console.error(`[slab-pdf] ${doc} ${company} ${weekStart}: ${(e && e.message) || e}`);
    return null;
  }
}

// The most recently COMPLETED week for a given ET date.
// The billing week is Mon–Sun, so on any day Mon–Sat the current week is still
// in progress → invoice the prior week. (Sunday can't occur here: the scheduled
// run guards to Monday.) On Sunday itself, mondayOf(Sunday) is that same week's
// Monday, which is intentionally NOT used by the Monday-scheduled run.
export function targetWeekStart(todayISO) {
  const dowSun = new Date(todayISO + 'T00:00:00').getDay() === 0;
  const m = mondayOf(todayISO);
  return dowSun ? m : addDaysISO(m, -7);
}

// Read everything needed to invoice one week.
export async function fetchWeekData(weekStart) {
  const { end } = weekRange(weekStart);
  const [subs, workers, projects, punchesAll, materialsAll] = await Promise.all([
    readTab(TABS.SUBS), readTab(TABS.WORKERS), readTab(TABS.PROJECTS),
    readTab(TABS.PUNCHES), readTab(TABS.MATERIALS),
  ]);
  const inWeek = (stamp) => { const d = dayKey(stamp); return d >= weekStart && d <= end; };
  return {
    weekStart, weekEnd: end,
    subs: subs.rows,
    workers: workers.rows,
    projects: projects.rows,
    punches: punchesAll.rows.filter((p) => inWeek(p.Timestamp)),
    materials: materialsAll.rows.filter((m) => inWeek(m.Timestamp)),
  };
}

// `company` (optional): scope the run to ONE company for a manual re-issue via
// /api/invoice-preview. Matches a sub's CompanyName (→ just that sub invoice) OR
// a GC name like "Opus" (→ just that GC's drafts). Omitted = the full week, so
// the scheduled Monday run is unaffected. Prevents re-issuing one corrected
// company from regenerating/re-sending every other company's invoice.
export function generateWeekInvoices({ subs, workers, projects, punches, materials, weekStart, company, cap }) {
  const workersById = {};
  workers.forEach((w) => { workersById[String(w.WorkerID).trim()] = w; });
  const projectsById = {};
  projects.forEach((p) => { projectsById[String(p.ProjectID).trim()] = p; });

  const subInvoices = [];

  subs.filter(active).forEach((sub) => {
    const subWorkers = workers.filter((w) => active(w) && String(w.SubID).trim() === String(sub.SubID).trim());
    if (!subWorkers.length) return;
    const ids = new Set(subWorkers.map((w) => String(w.WorkerID).trim()));
    const subPunches = punches.filter((p) => ids.has(String(p.WorkerID).trim()));
    const subMaterials = materials.filter((m) => String(m.SubID).trim() === String(sub.SubID).trim());

    const invoice = buildSubInvoice({ sub, workers: subWorkers, punches: subPunches, materials: subMaterials, projectsById, weekStart });
    const independent = !isY(sub.HasEmployees);
    const autoSend = independent || isY(sub.AutoInvoice);
    if (invoice.total > 0 || invoice.projects.length) {
      subInvoices.push({ sub, invoice, independent, autoSend });
    }
    // QuickBooks drafts were dropped 2026-08-07 for BOTH subs — the sub invoice is
    // the QB-entry source now, so a separate QB draft was redundant.
  });

  // One GC draft PER PROJECT (BillsToGC=Y). Each carries its project's GCName, its
  // GCDraftSeq (Projects tab → the fixed decimal used for numbering, e.g. French 1=5),
  // and the primary sub whose invoice number it hangs off (`<sub #>.<seq>`).
  const gcInvoices = [];
  for (const p of projects.filter((pr) => active(pr) && isY(pr.BillsToGC))) {
    const gcName = String(p.GCName || '').trim() || 'GC';
    const gc = buildGCInvoice({ gcName, project: p, workersById, punches, weekStart, ...(cap != null ? { cap } : {}) });
    if (gc.total > 0) {
      gcInvoices.push({ gcName, projectId: gc.project.id, gc, primarySubId: primarySubForGC(gc, subInvoices), gcDraftSeq: num(p.GCDraftSeq) });
    }
  }

  if (company && norm(company)) {
    const want = norm(company);
    return {
      weekStart,
      subInvoices: subInvoices.filter((s) => norm(s.sub.CompanyName) === want),
      gcInvoices: gcInvoices.filter((g) => norm(g.gcName) === want),
    };
  }

  return { weekStart, subInvoices, gcInvoices };
}

// The GC draft is an internal roll-up numbered `<sub #>.<seq>` (a non-payable
// number). Its base sub is the sub with the MOST hours on THIS GC project that
// week — reusing the already-computed sub-invoice project hours (tiebreak: lowest
// SubID). Returns null when no sub had hours on that project.
function primarySubForGC(gc, subInvoices) {
  const pid = gc.project.id;
  let primary = null, bestHrs = 0;
  for (const { sub, invoice } of subInvoices) {
    const hrs = invoice.projects.filter((p) => p.projectId === pid).reduce((s, p) => s + p.hours, 0);
    const sid = String(sub.SubID).trim();
    if (hrs > bestHrs || (hrs === bestHrs && hrs > 0 && primary !== null && sid < primary)) {
      bestHrs = hrs; primary = sid;
    }
  }
  return bestHrs > 0 ? primary : null;
}

// Send the generated invoices and log each to InvoiceLog. When `send` is false
// this is a dry run: nothing is emailed and nothing is logged (used by the
// admin preview). Independent + AutoInvoice sub invoices are emailed to
// accounting@ + the sub; company subs that are AutoInvoice=OFF are recorded as
// drafts only. QB and GC are always drafts to accounting@ for review.
//
// TEST MODE — set TEST_INVOICE_EMAIL to a single address to route EVERY send to
// that address (with a [TEST] subject, and no InvoiceLog write) instead of
// accounting@/the subs. This ONLY takes effect when `allowTestRoute` is true —
// i.e. the manual /api/invoice-preview endpoint. The scheduled Monday run
// (invoice-run.js) does NOT pass it, so it ALWAYS emails the real subs and logs
// normally. That means TEST_INVOICE_EMAIL can safely be left set for repeat
// testing without affecting production. See .env.example.
export async function deliverWeek({ gen, send, allowTestRoute = false }) {
  const acct = process.env.ACCOUNTING_EMAIL || 'accounting@backforty.builders';
  const testTo = allowTestRoute ? (process.env.TEST_INVOICE_EMAIL || '').trim() : '';
  const subj = (s) => (testTo ? `[TEST] ${s}` : s);
  const invoiceDate = etParts().date; // the run date (ISO), shown on each invoice

  // Per-sub invoice numbering: each sub continues its OWN sequence (San Ignacio
  // 2058→, Lopez 1001→), instead of one shared counter that interleaved subs and
  // doc-types and burned ~5 numbers/week. Read the InvoiceLog once and assign a
  // number to each sub up front so the QB draft can REUSE its sub's number and
  // the GC roll-up can be numbered `<sub #>.5`.
  const logRows = await readInvoiceLogRows();
  const numberBySub = new Map();
  for (const { invoice, sub } of gen.subInvoices) {
    numberBySub.set(String(invoice.subId), nextSubNumber(sub, logRows));
  }

  const results = [];
  let seq = 0;

  // comma-joined project names for the InvoiceLog "Projects" column (so the sheet
  // is a complete record Cowork can confirm against, and Slab can show projects).
  const projNames = (o) => ((o && (o.projectNames || (o.projects || []).map((p) => p && p.name).filter(Boolean))) || []).join(', ');
  const logRow = (type, id, invNo, hours, amount, status, sentTo, ws, we, projects) =>
    appendRow(TABS.INVOICE_LOG, {
      InvoiceID: `INV-${type}-${Date.now()}-${seq++}`, InvoiceNo: invNo, Date: etStamp(),
      SubID: id, WeekStart: ws, WeekEnd: we,
      'Total Hours': hours, 'Total Amount': amount,
      Type: type.toLowerCase(), Status: status, SentTo: sentTo, Projects: projects || '',
    });

  for (const { sub, invoice, autoSend } of gen.subInvoices) {
    const invoiceNo = numberBySub.get(String(invoice.subId));
    const to = testTo ? [testTo] : [acct, sub.Email].filter(Boolean);
    let status = autoSend ? 'sent' : 'draft';
    let sentTo = autoSend ? to.join(', ') : '';
    if (send && autoSend) {
      try {
        // Invoice content: prefer the Slab-rendered invoice so it MATCHES the Slab
        // breakdown (Adrienne: both docs match). Fall back to the Time Clock's own
        // pdf.js if Slab is unreachable. Either way the attachment KEEPS the original
        // filename convention (invoiceFileName: YYYY-MM-DD_to_MM-DD_Vendor_Projects_$Total.pdf)
        // so the accounting@ bill-router files it exactly as before.
        const slabInvoice = await fetchSlabPdf({ company: sub.CompanyName, weekStart: invoice.weekStart, doc: 'invoice' });
        const invoicePdf = slabInvoice ? slabInvoice.content : await subInvoicePdf(invoice, { invoiceNo, invoiceDate });
        const invoiceAtt = { filename: invoiceFileName(invoice), content: invoicePdf, contentType: 'application/pdf' };
        const breakdown = await fetchSlabPdf({ company: sub.CompanyName, weekStart: invoice.weekStart, doc: 'breakdown' });
        const slabOn = !!(slabInvoice || breakdown);

        if (testTo) {
          // Test: one preview email to the test address carrying everything.
          const { subject, html } = renderSubInvoiceEmail(invoice, { invoiceNo, invoiceDate, slabAttached: slabOn, breakdownAttached: !!breakdown });
          const atts = [invoiceAtt];
          if (breakdown) atts.push({ filename: breakdown.filename, content: breakdown.content, contentType: 'application/pdf' });
          await sendEmail({ to: [testTo], subject: subj(subject), html, attachments: atts });
        } else {
          // SPLIT the send. The accounting@ bill-router files EVERY PDF on a message
          // (bfb-accounting-script Code.js), so the breakdown must NOT reach it or it
          // would be filed as a bogus bill. accounting@ gets the invoice ALONE (filed
          // exactly as today); the sub gets both matching Slab docs + the bar.
          const acctMail = renderSubInvoiceEmail(invoice, { invoiceNo, invoiceDate }); // no bar, invoice only
          await sendEmail({ to: [acct], subject: subj(acctMail.subject), html: acctMail.html, attachments: [invoiceAtt] });
          if (sub.Email) {
            const subMail = renderSubInvoiceEmail(invoice, { invoiceNo, invoiceDate, slabAttached: slabOn, breakdownAttached: !!breakdown });
            const atts = [invoiceAtt];
            if (breakdown) atts.push({ filename: breakdown.filename, content: breakdown.content, contentType: 'application/pdf' });
            await sendEmail({ to: [sub.Email], subject: subj(subMail.subject), html: subMail.html, attachments: atts });
          }
        }
      } catch (e) { status = 'error'; sentTo = e.message; }
    }
    // Skip the log in test mode: a row here would make the scheduled run treat
    // the week as already invoiced and skip the real send.
    if (send && !testTo) await logRow('sub', invoice.subId, invoiceNo, invoice.totalHours, invoice.total, status, sentTo, invoice.weekStart, invoice.weekEnd, projNames(invoice));
    results.push({ type: 'sub', company: sub.CompanyName, invoiceNo, total: invoice.total, status, autoSend, ...(status === 'error' ? { error: sentTo } : {}), ...(testTo ? { testTo } : {}) });
  }

  // GC (Opus) drafts are NO LONGER emailed here (2026-08-21). They were always
  // internal review-only drafts to accounting@; Slab now owns them — it reads the
  // per-project GC detail from /api/invoice-preview and lets Adrienne adjust the
  // rate + lunch before sending. deliverWeek only sends the SUB invoices; the GC
  // numbering (`<sub #>.<seq>`) is derived on the Slab side from each GC's
  // primarySubId + gcDraftSeq, which the preview response exposes.
  return results;
}

async function readInvoiceLogRows() {
  try { const { rows } = await readTab(TABS.INVOICE_LOG); return rows; }
  catch { return []; }
}

// Next number in a SUB's OWN sequence: one past the highest WHOLE sub-number
// already logged for that sub, but never below the sub's configured StartInvoiceNo
// (Subs tab) — so San Ignacio continues at 2058 and Lopez starts fresh at 1001
// even though neither has new-system history yet. Ignores QB rows (same whole
// number, Type 'qb') and GC rows (a `.5` number), and any pre-existing rows below
// the sub's start (e.g. old shared-counter numbers). Test-mode runs don't log, so
// they never advance the sequence.
export function nextSubNumber(sub, logRows) {
  const start = num(sub && sub.StartInvoiceNo);
  const base = start != null ? start : DEFAULT_START_NO;
  const subId = String(sub && sub.SubID).trim();
  let highest = 0;
  for (const r of logRows) {
    if (String(r.SubID).trim() !== subId) continue;
    if (String(r.Type || '').trim().toLowerCase() !== 'sub') continue;
    const n = Number(String(r.InvoiceNo).trim());
    if (Number.isInteger(n) && n > highest) highest = n;
  }
  return highest >= base ? highest + 1 : base;
}
