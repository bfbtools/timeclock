// Brand-styled HTML email bodies for the three invoice types. Inline styles
// only (email clients strip <style>). Returns { subject, html }.

const C = { ink: '#3b3830', soft: '#6b6459', line: '#efe0ca', paper: '#f7f0e6', forge: '#2d2e28', ember: '#db563d', pine: '#2e5e4e', kraft: '#d6b07b' };
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function shell(title, subtitle, inner, badge) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:${C.paper};border-radius:12px;overflow:hidden;border:1px solid ${C.line}">
  <div style="background:${C.forge};padding:20px 24px">
    <div style="color:#fff;font-size:20px;font-weight:bold;letter-spacing:.5px">BACK FORTY BUILDERS</div>
    <div style="color:${C.kraft};font-size:11px;font-weight:bold;letter-spacing:3px;margin-top:2px">SUBCONTRACTOR TIME CLOCK</div>
  </div>
  <div style="height:4px;background:linear-gradient(90deg,${C.ember} 0 40%,${C.kraft} 40% 70%,${C.pine} 70% 100%)"></div>
  <div style="padding:24px">
    ${badge ? `<div style="display:inline-block;background:${C.kraft};color:${C.forge};font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:3px 10px;border-radius:4px;margin-bottom:12px">${badge}</div>` : ''}
    <div style="font-size:22px;font-weight:bold;color:${C.ink}">${title}</div>
    <div style="font-size:13px;color:${C.soft};margin-top:4px">${subtitle}</div>
    <div style="margin-top:18px">${inner}</div>
  </div>
</div>`;
}
function row(left, right, opts = {}) {
  const b = opts.bold ? 'font-weight:bold;' : '';
  const c = opts.color || C.ink;
  const border = opts.border === false ? '' : `border-bottom:1px solid ${C.line};`;
  return `<tr><td style="padding:9px 0;${border}color:${c};${b}font-size:14px">${left}</td>
    <td style="padding:9px 0;${border}color:${c};${b}font-size:14px;text-align:right;font-family:'Courier New',monospace">${right}</td></tr>`;
}
const table = (rows) => `<table style="width:100%;border-collapse:collapse">${rows}</table>`;

export function renderSubInvoiceEmail(inv) {
  const lines = inv.projects.map((p) => {
    const days = p.perDay.map((d) => `${fmt(d.date)} ${d.hours}h`).join(' · ');
    const rate = p.rate ? ` @ ${money(p.rate)}/hr` : '';
    return row(`<b>${p.name}</b><br><span style="font-size:12px;color:${C.soft}">${p.hours}h${rate}<br>${days}</span>`, money(p.amount));
  }).join('');
  const mats = inv.materials.map((m) => row(`Materials${m.note ? ' — ' + m.note : ''}`, money(m.amount))).join('');
  const total = row('TOTAL', money(inv.total), { bold: true, border: false, color: C.ember });
  return {
    subject: `Invoice — ${inv.company} — week of ${fmt(inv.weekStart)}`,
    html: shell(inv.company, `Week ${fmt(inv.weekStart)} – ${fmt(inv.weekEnd)}`, table(lines + mats + total)),
  };
}

export function renderQBInvoiceEmail(qb) {
  const lines = qb.byWorker.map((w) => row(`${w.worker}`, `${w.hours}h`)).join('');
  const totals = row(`${qb.item} — ${qb.hours}h @ ${money(qb.rate)}/hr`, money(qb.total), { bold: true, border: false, color: C.ember });
  return {
    subject: `QB draft — ${qb.company} — week of ${fmt(qb.weekStart)}`,
    html: shell(`${qb.company} — QuickBooks draft`, `Week ${fmt(qb.weekStart)} – ${fmt(qb.weekEnd)} · item "${qb.item}"`,
      table(lines + totals), 'Draft for accounting'),
  };
}

export function renderGCInvoiceEmail(gc) {
  const lines = gc.projects.map((p) => {
    const parts = [];
    if (p.standard) parts.push(row(`${p.name} — labor`, `${p.standard.hours}h @ ${money(p.standard.rate)} = ${money(p.standard.amount)}`));
    p.overrides.forEach((o) => parts.push(row(`&nbsp;&nbsp;↳ ${o.worker}`, `${o.hours}h @ ${money(o.rate)} = ${money(o.amount)}`)));
    return parts.join('');
  }).join('');
  const lunch = row(`<span style="color:${C.soft}">Lunch deducted (0.75 hr/worker/day)</span>`, `<span style="color:${C.soft}">−${gc.lunchHours}h</span>`);
  const total = row(`TOTAL · cost code ${gc.costCode}`, money(gc.total), { bold: true, border: false, color: C.ember });
  return {
    subject: `GC draft — ${gc.gcName} — week of ${fmt(gc.weekStart)} (review before sending)`,
    html: shell(`${gc.gcName} — GC invoice draft`, `Week ${fmt(gc.weekStart)} – ${fmt(gc.weekEnd)}`,
      table(lines + lunch + total), 'Draft — review before sending'),
  };
}
