// Brand-styled HTML email bodies for the three invoice types. Inline styles
// only (email clients strip <style>). Returns { subject, html }.
// meta = { invoiceNo, invoiceDate } (invoiceDate is an ISO 'YYYY-MM-DD').

const C = { ink: '#3b3830', soft: '#6b6459', line: '#efe0ca', paper: '#f7f0e6', forge: '#2d2e28', ember: '#db563d', pine: '#2e5e4e', kraft: '#d6b07b' };
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtLong = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const weekday = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
const mmddyy = (iso) => { const [y, m, d] = iso.split('-'); return `${m}-${d}-${y.slice(2)}`; };

// ---- shared pieces -------------------------------------------------------
function row(left, right, opts = {}) {
  const b = opts.bold ? 'font-weight:bold;' : '';
  const c = opts.color || C.ink;
  const border = opts.border === false ? '' : `border-bottom:1px solid ${C.line};`;
  return `<tr><td style="padding:9px 0;${border}color:${c};${b}font-size:14px">${left}</td>
    <td style="padding:9px 0;${border}color:${c};${b}font-size:14px;text-align:right;font-family:'Courier New',monospace">${right}</td></tr>`;
}
const table = (rows) => `<table style="width:100%;border-collapse:collapse">${rows}</table>`;

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

  const lines = inv.projects.map((p) => {
    const days = p.perDay.map((d) => `${fmt(d.date)} ${d.hours}h`).join(' · ');
    const rate = p.rate ? ` @ ${money(p.rate)}/hr` : '';
    return row(`<b>${p.name}</b><br><span style="font-size:12px;color:${C.soft}">${p.hours}h${rate}<br>${days}</span>`, money(p.amount));
  }).join('');
  const mats = inv.materials.map((m) => row(`Materials${m.note ? ' — ' + m.note : ''}`, money(m.amount))).join('');
  const total = row('TOTAL', money(inv.total), { bold: true, border: false, color: C.ink }); // black

  const card = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:${C.paper};border-radius:12px;overflow:hidden;border:1px solid ${C.line}">
    <div style="background:${C.forge};padding:20px 24px">
      <div style="color:#fff;font-size:20px;font-weight:bold;letter-spacing:.3px">${inv.company}</div>
      <div style="color:${C.kraft};font-size:12px;font-weight:bold;letter-spacing:1px;margin-top:3px">${headerSub}</div>
    </div>
    <div style="height:4px;background:linear-gradient(90deg,${C.ember} 0 40%,${C.kraft} 40% 70%,${C.pine} 70% 100%)"></div>
    <div style="padding:24px">
      <div style="font-size:18px;font-weight:bold;color:${C.ink}">${title}</div>
      <div style="font-size:13px;color:${C.soft};margin-top:4px">Week ${fmt(inv.weekStart)} – ${fmt(inv.weekEnd)}</div>
      <div style="margin-top:16px">${table(lines + mats + total)}</div>
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
  const th = `padding:8px 8px;border-bottom:2px solid ${C.forge};font-size:12px;font-weight:bold;color:${C.forge};text-transform:uppercase;letter-spacing:.5px`;
  const td = `padding:8px 8px;border-bottom:1px solid ${C.line};font-size:13px;color:${C.ink}`;
  const tdr = `${td};text-align:right;font-family:'Courier New',monospace`;
  const head = `<tr>
    <th style="${th};text-align:left">Product/Service</th>
    <th style="${th};text-align:left">Description</th>
    <th style="${th};text-align:right">Qty</th>
    <th style="${th};text-align:right">Rate</th>
    <th style="${th};text-align:right">Amount</th></tr>`;
  const body = qb.lines.map((l) => `<tr>
    <td style="${td}"><b>${l.item}</b></td>
    <td style="${td}">${l.description}</td>
    <td style="${tdr}">${l.qty}</td>
    <td style="${tdr}">${money(l.rate)}</td>
    <td style="${tdr}">${money(l.amount)}</td></tr>`).join('');
  const totalRow = `<tr>
    <td colspan="4" style="padding:12px 8px;text-align:right;font-size:14px;font-weight:bold;color:${C.ink}">Total</td>
    <td style="padding:12px 8px;text-align:right;font-size:15px;font-weight:bold;color:${C.ink};font-family:'Courier New',monospace">${money(qb.total)}</td></tr>`;

  const details = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto 12px;color:${C.ink}">
    <div style="font-size:13px"><b>Invoice details</b></div>
    <div style="font-size:13px;color:${C.soft};margin-top:2px">Invoice #${invNo}${meta.invoiceDate ? ' • ' + fmtLong(meta.invoiceDate) : ''} • Due on receipt</div>
  </div>`;
  const tableHtml = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto">
    <table style="width:100%;border-collapse:collapse">${head}${body}${totalRow}</table>
  </div>`;

  return {
    subject: `QB draft #${invNo} — ${qb.company} — week of ${fmt(qb.weekStart)}`,
    html: rosterBody(qb) + details + tableHtml + flagsBlock(qb.flags),
  };
}

// ---- GC draft (internal review; unchanged layout) ------------------------
export function renderGCInvoiceEmail(gc, meta = {}) {
  const invNo = meta.invoiceNo ? `#${meta.invoiceNo} ` : '';
  const lines = gc.projects.map((p) => {
    const parts = [];
    if (p.standard) parts.push(row(`${p.name} — labor`, `${p.standard.hours}h @ ${money(p.standard.rate)} = ${money(p.standard.amount)}`));
    p.overrides.forEach((o) => parts.push(row(`&nbsp;&nbsp;↳ ${o.worker}`, `${o.hours}h @ ${money(o.rate)} = ${money(o.amount)}`)));
    return parts.join('');
  }).join('');
  const lunch = row(`<span style="color:${C.soft}">Lunch deducted (0.75 hr/worker/day)</span>`, `<span style="color:${C.soft}">−${gc.lunchHours}h</span>`);
  const total = row(`TOTAL · cost code ${gc.costCode}`, money(gc.total), { bold: true, border: false, color: C.ink });
  const card = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:${C.paper};border-radius:12px;overflow:hidden;border:1px solid ${C.line}">
    <div style="background:${C.forge};padding:20px 24px">
      <div style="color:#fff;font-size:20px;font-weight:bold">Back Forty Builders</div>
      <div style="color:${C.kraft};font-size:12px;font-weight:bold;letter-spacing:1px;margin-top:3px">GC invoice draft ${invNo}— review before sending</div>
    </div>
    <div style="height:4px;background:linear-gradient(90deg,${C.ember} 0 40%,${C.kraft} 40% 70%,${C.pine} 70% 100%)"></div>
    <div style="padding:24px">
      <div style="font-size:18px;font-weight:bold;color:${C.ink}">${gc.gcName}</div>
      <div style="font-size:13px;color:${C.soft};margin-top:4px">Week ${fmt(gc.weekStart)} – ${fmt(gc.weekEnd)}</div>
      <div style="margin-top:16px">${table(lines + lunch + total)}</div>
    </div>
  </div>`;
  return {
    subject: `GC draft ${invNo}— ${gc.gcName} — week of ${fmt(gc.weekStart)} (review before sending)`,
    html: card + flagsBlock(gc.flags),
  };
}
