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
export function renderSubInvoiceEmail(inv, meta = {}) {
  const invNo = meta.invoiceNo || '';
  const headerSub = `Invoice #${invNo} • ${meta.invoiceDate ? fmtLong(meta.invoiceDate) : ''} • Due on receipt`;
  const title = `${(inv.projectNames || []).join(', ')} – Back Forty Builders`;

  const head = tr([th('Project'), th('Dates'), th('Qty', 'right'), th('Rate', 'right'), th('Amount', 'right')]);
  const rows = inv.projects.map((p) => tr([
    td(`<b>${p.name}</b>`), td(dateRange(p.perDay)),
    td(String(p.hours), 'right'), td(p.rate ? money(p.rate) : '—', 'right'), td(money(p.amount), 'right'),
  ])).join('');
  const mats = inv.materials.map((m) => tr([
    td(`Materials${m.note ? ' — ' + m.note : ''}`), td(''), td('', 'right'), td('', 'right'), td(money(m.amount), 'right'),
  ])).join('');

  const card = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:${C.paper};border-radius:12px;overflow:hidden;border:1px solid ${C.line}">
    <div style="background:${C.forge};padding:20px 24px">
      <div style="color:#fff;font-size:20px;font-weight:bold;letter-spacing:.3px">${inv.company}</div>
      <div style="color:${C.kraft};font-size:12px;font-weight:bold;letter-spacing:1px;margin-top:3px">${headerSub}</div>
    </div>
    <div style="height:4px;background:linear-gradient(90deg,${C.ember} 0 40%,${C.kraft} 40% 70%,${C.pine} 70% 100%)"></div>
    <div style="padding:24px 16px 16px">
      <div style="font-size:18px;font-weight:bold;color:${C.ink}">${title}</div>
      <div style="font-size:13px;color:${C.soft};margin-top:4px">Week ${fmt(inv.weekStart)} – ${fmt(inv.weekEnd)}</div>
      <div style="margin-top:14px">${tableEl(head + rows + mats + totalRow('TOTAL', money(inv.total)))}</div>
    </div>
  </div>`;

  return {
    subject: `Invoice #${invNo} — ${inv.company} — week of ${fmt(inv.weekStart)}`,
    html: rosterBody(inv) + card + flagsBlock(inv.flags),
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
    subject: `QB draft #${invNo} — ${qb.company} — week of ${fmt(qb.weekStart)}`,
    html: rosterBody(qb) + details + tableHtml + flagsBlock(qb.flags),
  };
}

// ---- GC draft (internal review) ------------------------------------------
export function renderGCInvoiceEmail(gc, meta = {}) {
  const invNo = meta.invoiceNo ? `#${meta.invoiceNo} ` : '';
  const head = tr([th('Project / worker'), th('Dates'), th('Qty', 'right'), th('Rate', 'right'), th('Amount', 'right')]);
  const wkRange = `${fmt(gc.weekStart)} – ${fmt(gc.weekEnd)}`;
  const rows = gc.projects.map((p) => {
    const parts = [];
    if (p.standard) parts.push(tr([td(`<b>${p.name}</b>`), td(wkRange), td(String(p.standard.hours), 'right'), td(money(p.standard.rate), 'right'), td(money(p.standard.amount), 'right')]));
    p.overrides.forEach((o) => parts.push(tr([td(`&nbsp;&nbsp;↳ ${o.worker} · ${p.name}`), td(wkRange), td(String(o.hours), 'right'), td(money(o.rate), 'right'), td(money(o.amount), 'right')])));
    return parts.join('');
  }).join('');
  const lunch = tr([td(`<span style="color:${C.soft}">Lunch deducted (0.75 hr/worker/day)</span>`), td(''), td(`−${gc.lunchHours}`, 'right'), td(''), td('')]);

  const card = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:${C.paper};border-radius:12px;overflow:hidden;border:1px solid ${C.line}">
    <div style="background:${C.forge};padding:20px 24px">
      <div style="color:#fff;font-size:20px;font-weight:bold">Back Forty Builders</div>
      <div style="color:${C.kraft};font-size:12px;font-weight:bold;letter-spacing:1px;margin-top:3px">GC invoice draft ${invNo}— review before sending</div>
    </div>
    <div style="height:4px;background:linear-gradient(90deg,${C.ember} 0 40%,${C.kraft} 40% 70%,${C.pine} 70% 100%)"></div>
    <div style="padding:24px 16px 16px">
      <div style="font-size:18px;font-weight:bold;color:${C.ink}">${gc.gcName} <span style="font-size:12px;color:${C.soft};font-weight:normal">· cost code ${gc.costCode}</span></div>
      <div style="font-size:13px;color:${C.soft};margin-top:4px">Week ${wkRange}</div>
      <div style="margin-top:14px">${tableEl(head + rows + lunch + totalRow('TOTAL', money(gc.total)))}</div>
    </div>
  </div>`;
  return {
    subject: `GC draft ${invNo}— ${gc.gcName} — week of ${fmt(gc.weekStart)} (review before sending)`,
    html: card + flagsBlock(gc.flags),
  };
}
