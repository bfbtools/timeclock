// Week invoicing orchestration. `generateWeekInvoices` is pure (takes fetched
// rows, returns all three invoice types); `fetchWeekData` reads the Sheet.
// Rules (docs/bfb-timeclock-spec.md § Invoicing):
//   - Independent subs      → sub invoice, ALWAYS auto-sent.
//   - Company subs          → sub invoice auto-sent only if AutoInvoice=Y;
//                             plus a QB draft ($50/hr Carpentry) to accounting@.
//   - GC projects (BillsToGC=Y, grouped by GCName) → GC draft for review.

import { readTab, appendRow } from './sheets.js';
import { TABS } from './config.js';
import { mondayOf, weekRange, dayKey } from './rollup.js';
import { buildSubInvoice, buildQBInvoice, buildGCInvoice } from './invoice-lib.js';
import { etStamp } from './model.js';
import { sendEmail } from './email.js';
import { renderSubInvoiceEmail, renderQBInvoiceEmail, renderGCInvoiceEmail } from './email-templates.js';

const isY = (v) => String(v).trim().toUpperCase().startsWith('Y');
const active = (r) => isY(r.Active);

function addDaysISO(iso, n) {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

export function generateWeekInvoices({ subs, workers, projects, punches, materials, weekStart }) {
  const workersById = {};
  workers.forEach((w) => { workersById[String(w.WorkerID).trim()] = w; });
  const projectsById = {};
  projects.forEach((p) => { projectsById[String(p.ProjectID).trim()] = p; });

  const subInvoices = [];
  const qbInvoices = [];

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

    if (isY(sub.HasEmployees)) {
      const qb = buildQBInvoice({ sub, workers: subWorkers, punches: subPunches, weekStart });
      if (qb.hours > 0) qbInvoices.push({ sub, qb });
    }
  });

  // GC invoices grouped by GCName across BillsToGC=Y projects.
  const gcProjects = projects.filter((p) => active(p) && isY(p.BillsToGC));
  const byGC = new Map();
  gcProjects.forEach((p) => {
    const g = String(p.GCName || '').trim() || 'GC';
    if (!byGC.has(g)) byGC.set(g, []);
    byGC.get(g).push(p);
  });
  const gcInvoices = [];
  for (const [gcName, projs] of byGC) {
    const gc = buildGCInvoice({ gcName, gcProjects: projs, workersById, punches, weekStart });
    if (gc.total > 0) gcInvoices.push({ gcName, gc });
  }

  return { weekStart, subInvoices, qbInvoices, gcInvoices };
}

// Send the generated invoices and log each to InvoiceLog. When `send` is false
// this is a dry run: nothing is emailed and nothing is logged (used by the
// admin preview). Independent + AutoInvoice sub invoices are emailed to
// accounting@ + the sub; company subs that are AutoInvoice=OFF are recorded as
// drafts only. QB and GC are always drafts to accounting@ for review.
export async function deliverWeek({ gen, send }) {
  const acct = process.env.ACCOUNTING_EMAIL || 'accounting@backforty.builders';
  const results = [];
  let seq = 0;

  const logRow = (type, id, total, status, sentTo, ws, we) =>
    appendRow(TABS.INVOICE_LOG, {
      InvoiceID: `INV-${type}-${Date.now()}-${seq++}`, Date: etStamp(),
      SubID: id, WeekStart: ws, WeekEnd: we, Total: total,
      Type: type.toLowerCase(), Status: status, SentTo: sentTo,
    });

  for (const { sub, invoice, autoSend } of gen.subInvoices) {
    const to = [acct, sub.Email].filter(Boolean);
    let status = autoSend ? 'sent' : 'draft';
    let sentTo = autoSend ? to.join(', ') : '';
    if (send && autoSend) {
      try { const { subject, html } = renderSubInvoiceEmail(invoice); await sendEmail({ to, subject, html }); }
      catch (e) { status = 'error'; sentTo = e.message; }
    }
    if (send) await logRow('sub', invoice.subId, invoice.total, status, sentTo, invoice.weekStart, invoice.weekEnd);
    results.push({ type: 'sub', company: sub.CompanyName, total: invoice.total, status, autoSend });
  }

  for (const { sub, qb } of gen.qbInvoices) {
    let status = 'draft', sentTo = acct;
    if (send) {
      try { const { subject, html } = renderQBInvoiceEmail(qb); await sendEmail({ to: acct, subject, html }); }
      catch (e) { status = 'error'; sentTo = e.message; }
      await logRow('QB', qb.subId, qb.total, status, sentTo, qb.weekStart, qb.weekEnd);
    }
    results.push({ type: 'QB', company: qb.company, total: qb.total, status });
  }

  for (const { gc } of gen.gcInvoices) {
    let status = 'draft', sentTo = acct;
    if (send) {
      try { const { subject, html } = renderGCInvoiceEmail(gc); await sendEmail({ to: acct, subject, html }); }
      catch (e) { status = 'error'; sentTo = e.message; }
      await logRow('GC', gc.gcName, gc.total, status, sentTo, gc.weekStart, gc.weekEnd);
    }
    results.push({ type: 'GC', gc: gc.gcName, total: gc.total, status });
  }

  return results;
}
