// Brand-styled HTML email bodies for the three invoice types. Inline styles
// only (email clients strip <style>). Returns { subject, html }.
// meta = { invoiceNo, invoiceDate } (invoiceDate is an ISO 'YYYY-MM-DD').

const C = { ink: '#3b3830', soft: '#6b6459', line: '#efe0ca', paper: '#f7f0e6', forge: '#2d2e28', ember: '#db563d', pine: '#2e5e4e', kraft: '#d6b07b' };
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtLong = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const weekday = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
const mmddyy = (iso) => { const [y, m, d] = iso.split('-'); return `${m}-${d}-${y.slice(2)}`; };
// A project's date range from its sorted perDay list: "Jul 8" or "Jul 8 – Jul 10".
const dateRange = (perDay) => {
  if (!perDay || !perDay.length) return '';
  const a = perDay[0].date, b = perDay[perDay.length - 1].date;
  return a === b ? fmt(a) : `${fmt(a)} – ${fmt(b)}`;
};

// ---- shared table helpers (Project/Description · … · Qty · Rate · Amount) ----
const thStyle = (align) => `padding:8px;border-bottom:2px solid ${C.forge};font-size:11px;font-weight:bold;color:${C.forge};text-transform:uppercase;letter-spacing:.5px;text-align:${align}`;
const tdStyle = (align) => `padding:8px;border-bottom:1px solid ${C.line};font-size:13px;color:${C.ink};text-align:${align}` + (align === 'right' ? `;font-family:'Courier New',monospace` : '');
const th = (label, align = 'left') => `<th style="${thStyle(align)}">${label}</th>`;
const td = (v, align = 'left') => `<td style="${tdStyle(align)}">${v}</td>`;
const tr = (cells) => `<tr>${cells.join('')}</tr>`;
const totalRow = (label, value) => `<tr>
    <td colspan="4" style="padding:12px 8px;text-align:right;font-size:14px;font-weight:bold;color:${C.ink}">${label}</td>
    <td style="padding:12px 8px;text-align:right;font-size:15px;font-weight:bold;color:${C.ink};font-family:'Courier New',monospace">${value}</td></tr>`;
const tableEl = (inner) => `<table style="width:100%;border-collapse:collapse">${inner}</table>`;

// The message body: the Mon–Sun week and who was onsite each day.
function rosterBody(inv) {
  const wk = `Week of ${weekday(inv.weekStart)} ${mmddyy(inv.weekStart)} to ${weekday(inv.weekEnd)} ${mmddyy(inv.weekEnd)}`;
  const days = (inv.days || []).map((d) =>
    `<div style="font-size:13px;color:${C.ink};padding:3px 0"><b style="font-family:'Courier New',monospace">${mmddyy(d.date)}</b> &nbsp;Onsite: ${d.names.join(', ') || '—'}</div>`).join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto 16px;color:${C.ink}">
    <div style="font-size:15px;font-weight:bold;margin-bottom:8px">${wk}</div>
    ${days || `<div style="font-size:13px;color:${C.soft}">No onsite days logged this week.</div>`}
  </div>`;
}

function flagsBlock(flags) {
  if (!flags || !flags.length) return '';
  const items = flags.map((f) => `<li style="font-size:12px;color:${C.soft};margin:2px 0">${f.worker ? f.worker + ', ' : ''}${fmt(f.date)} — ${f.reason}</li>`).join('');
  return `<div style="max-width:640px;margin:12px auto 0"><div style="font-size:12px;font-weight:bold;color:${C.ember}">Needs review</div><ul style="margin:4px 0;padding-left:18px">${items}</ul></div>`;
}

// ---- sub invoice ---------------------------------------------------------
// The invoice itself is a PDF attachment (built in lib/pdf.js); the email body
// is the note + the actual-scan-times read-out (the true record behind the
// rounded PDF).
const tclock = (stamp) => {
  const m = String(stamp).match(/\d{4}-\d{2}-\d{2}[ T](\d{1,2}):(\d{2})/);
  if (!m) return '';
  let h = +m[1]; const ap = h >= 12 ? 'p' : 'a'; h = h % 12 || 12;
  return `${h}:${m[2]}${ap}`;
};
const dayLabel = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
function readoutBlock(inv) {
  if (!inv.readout || !inv.readout.length) return '';
  const rows = inv.readout.map((r) => {
    const segs = r.segments.map((s) => `${dayLabel(s.date)} ${tclock(s.in)}–${tclock(s.out)} (${s.hours}h)`).join(' · ');
    return `<div style="padding:6px 0;border-top:1px solid ${C.line}"><b style="font-size:13px;color:${C.ink}">${r.worker}</b> <span style="font-family:'Courier New',monospace;font-size:11px;color:${C.pine};font-weight:bold">${r.hours}h</span><div style="font-family:'Courier New',monospace;font-size:11px;color:${C.ink};line-height:1.7;margin-top:2px">${segs}</div></div>`;
  }).join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto 16px;background:${C.paper};border:1px solid ${C.line};border-radius:10px;padding:12px 14px">
    <div style="font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;color:${C.forge}">Timeclock read-out — actual scan times</div>
    <div style="font-size:11px;color:${C.soft};margin:2px 0 6px">Real stamps with each day's hours and a weekly total per person. 0-hour mis-punches omitted. Invoice qty is these hours rounded to 15 min.</div>
    ${rows}</div>`;
}
export function renderSubInvoiceEmail(inv, meta = {}) {
  const invNo = meta.invoiceNo || '';
  const note = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto 16px;color:${C.ink}">
    <div style="font-size:16px;font-weight:bold">${inv.company}</div>
    <div style="font-size:13px;color:${C.soft};margin-top:2px">Invoice #${invNo}${meta.invoiceDate ? ' • ' + fmtLong(meta.invoiceDate) : ''}${inv.period ? ' • work period ' + inv.period : ''} • Due on receipt</div>
    <div style="font-size:14px;margin-top:10px">The invoice for <b>${(inv.projectNames || []).join(', ')}</b> is attached as a PDF. Total <b>${money(inv.total)}</b>.</div>
    ${inv.guaranteedDayOn && inv.guaranteedDayAmount > 0 ? `<div style="font-size:12px;color:${C.soft};margin-top:6px">Includes a guaranteed-day uplift of ${inv.guaranteedDayHours} hr (${money(inv.guaranteedDayAmount)}) — days of 8.5+ clocked hours are paid at 10. Itemized on the attached PDF.</div>` : ''}
  </div>`;
  return {
    subject: `Invoice #${invNo} — ${inv.company} — ${inv.period || fmt(inv.weekStart)}`,
    html: note + readoutBlock(inv) + flagsBlock(inv.flags),
  };
}

// ---- QB draft (QuickBooks line-item format, no top info) ------------------
export function renderQBInvoiceEmail(qb, meta = {}) {
  const invNo = meta.invoiceNo || '';
  const head = tr([th('Product/Service'), th('Description'), th('Qty', 'right'), th('Rate', 'right'), th('Amount', 'right')]);
  const body = qb.lines.map((l) => tr([
    td(`<b>${l.item}</b>`), td(l.description),
    td(String(l.qty), 'right'), td(money(l.rate), 'right'), td(money(l.amount), 'right'),
  ])).join('');

  const details = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto 12px;color:${C.ink}">
    <div style="font-size:13px"><b>Invoice details</b></div>
    <div style="font-size:13px;color:${C.soft};margin-top:2px">Invoice #${invNo}${meta.invoiceDate ? ' • ' + fmtLong(meta.invoiceDate) : ''} • Due on receipt</div>
  </div>`;
  const tableHtml = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto">${tableEl(head + body + totalRow('Total', money(qb.total)))}</div>`;

  return {
    subject: `QB draft #${invNo} — ${qb.company} — ${qb.period || fmt(qb.weekStart)}`,
    html: rosterBody(qb) + details + tableHtml + flagsBlock(qb.flags),
  };
}

// ---- GC draft (internal review) — ONE per project, per-day two-line format ----
// Columns: Date · Item | Rate | Hours | Amount. Two lines per work day (Carpentry
// Labor / General Labor), each with its onsite names. Hours are NET of lunch; the
// lunch note sits at the bottom (no lunch row in the table).
export function renderGCInvoiceEmail(gc, meta = {}) {
  const invNo = meta.invoiceNo != null ? `#${meta.invoiceNo}` : '';
  const mdy = (iso) => { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y.slice(2)}`; };
  const wkRange = gc.period || `${fmt(gc.weekStart)} – ${fmt(gc.weekEnd)}`;
  const head = tr([th('Date · Item'), th('Rate', 'right'), th('Hours', 'right'), th('Amount', 'right')]);
  const rows = (gc.days || []).map((day) => day.lines.map((l) => tr([
    td(`<span style="font-family:'Courier New',monospace;color:${C.soft}">${mdy(day.date)}</span> <b>${l.item}</b><div style="font-size:11px;color:${C.soft};margin-top:2px">Onsite: ${(l.onsite || []).join(', ') || '—'}</div>`),
    td(money(l.rate), 'right'), td(String(l.hours), 'right'), td(money(l.amount), 'right'),
  ])).join('')).join('');
  const gcTotalRow = `<tr>
    <td style="padding:12px 8px;text-align:right;font-size:14px;font-weight:bold;color:${C.ink}">TOTAL</td><td></td>
    <td style="padding:12px 8px;text-align:right;font-size:14px;font-weight:bold;color:${C.ink};font-family:'Courier New',monospace">${gc.totalHours}</td>
    <td style="padding:12px 8px;text-align:right;font-size:15px;font-weight:bold;color:${C.ink};font-family:'Courier New',monospace">${money(gc.total)}</td></tr>`;
  const note = `<div style="font-size:12px;color:${C.soft};margin-top:12px">Hours are net billable after <b>0.75 hr/worker/day lunch</b>. Carpentry ${money(gc.days?.[0]?.lines?.[0]?.rate || 68)}/hr; General Labor at each worker's GC override rate.</div>`;

  const card = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:${C.paper};border-radius:12px;overflow:hidden;border:1px solid ${C.line}">
    <div style="background:${C.forge};padding:20px 24px">
      <div style="color:#fff;font-size:20px;font-weight:bold">${gc.gcName} &nbsp;·&nbsp; ${gc.project ? gc.project.name : ''}</div>
      <div style="color:${C.kraft};font-size:12px;font-weight:bold;letter-spacing:1px;margin-top:3px">GC DRAFT ${invNo} — review before sending</div>
    </div>
    <div style="height:4px;background:linear-gradient(90deg,${C.ember} 0 40%,${C.kraft} 40% 70%,${C.pine} 70% 100%)"></div>
    <div style="padding:24px 16px 16px">
      <div style="font-size:13px;color:${C.soft}">cost code ${gc.costCode} &nbsp;·&nbsp; Work period ${wkRange}</div>
      <div style="margin-top:14px">${tableEl(head + rows + gcTotalRow)}</div>
      ${note}
    </div>
  </div>`;
  return {
    subject: `GC draft ${invNo} — ${gc.gcName} · ${gc.project ? gc.project.name : ''} — ${gc.period || fmt(gc.weekStart)} (review before sending)`,
    html: card + flagsBlock(gc.flags),
  };
}
