// GC (Opus) draft-invoice PDF — the document BFB bills the general contractor.
// Matches the layout Adrienne chose (the July `GCdraftInvoice_Opus_*.pdf`):
// a rounded cream card on white, dark header with rounded top + rust/tan/green
// stripe, "GC Draft Invoice #<no> — review before sending", green per-project
// sections, per-day Carpentry $68 / General $40 rows each with an `Onsite:`
// sub-line, a TOTAL, and a closing lunch note.
//
// PURE RENDERER. It draws whatever line items it is handed — it does NOT compute
// lunch or rates. That arithmetic (lunch reallocation over the GC-rate pool, rate
// overrides) is the shared `slab-gcbill` module; this file only lays it out, so
// there is one allocator and no drift between Slab and the Time Clock.
//
// inv = { gcName, invoiceNo, costCode, period,
//   projects: [ { name, days: [ { date, lines: [ { item, rate, hours, amount, onsite:[names] } ] } ] } ],
//   total, note }
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hrs = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
const mdy = (iso) => { const [y, m, d] = String(iso).split('-'); return `${m}/${d}/${y.slice(2)}`; };

const INK = rgb(0.17, 0.16, 0.14);
const SOFT = rgb(0.44, 0.41, 0.37);
const GREEN = rgb(0.17, 0.41, 0.30);
const LINE = rgb(0.87, 0.83, 0.75);
const CREAM = rgb(0.957, 0.933, 0.882);
const BAND = rgb(0.168, 0.153, 0.137);
const TAN = rgb(0.839, 0.690, 0.482);
const RUST = rgb(0.859, 0.337, 0.239);

const PAGE_W = 612, PAGE_H = 792;
const CM = 22;                        // page edge → card
const CX = CM, CW = PAGE_W - 2 * CM;  // card left / width
const PAD = 30;                       // card edge → content
const M = CX + PAD;                   // content left
const RIGHT = CX + CW - PAD;          // content right
const R = 14;                         // corner radius
const HEADER_H = 74;
const COL = { rateR: 424, hoursR: 500, amtR: RIGHT };  // order: DATE/ITEM · RATE · HOURS · AMOUNT

const roundedRect = (w, h, r) => `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
const roundedTop = (w, h, r) => `M 0 ${r} Q 0 0 ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h} H 0 Z`;

export async function gcInvoicePdf(inv, meta = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  let page, y;
  const left = (s, x, size = 10, f = font, c = INK) => page.drawText(String(s), { x, y, size, font: f, color: c });
  const right = (s, xR, size = 10, f = font, c = INK) => page.drawText(String(s), { x: xR - f.widthOfTextAtSize(String(s), size), y, size, font: f, color: c });
  const rule = (c = LINE) => page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness: 0.5, color: c });

  const chrome = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    const cardTop = PAGE_H - CM;
    page.drawSvgPath(roundedRect(CW, PAGE_H - 2 * CM, R), { x: CX, y: cardTop, color: CREAM });
    page.drawSvgPath(roundedTop(CW, HEADER_H, R), { x: CX, y: cardTop, color: BAND });
    const seg = CW / 3, sy = cardTop - HEADER_H - 4;
    page.drawRectangle({ x: CX, y: sy, width: seg, height: 4, color: RUST });
    page.drawRectangle({ x: CX + seg, y: sy, width: seg, height: 4, color: TAN });
    page.drawRectangle({ x: CX + 2 * seg, y: sy, width: seg, height: 4, color: GREEN });
    y = cardTop - 34; left('Back Forty Builders', M, 20, bold, rgb(1, 1, 1));
    y = cardTop - 54; left(`GC Draft Invoice #${inv.invoiceNo || ''} — review before sending`, M, 10.5, bold, TAN);
    y = cardTop - HEADER_H - 28;
  };
  const colHead = () => {
    left('DATE / ITEM', M, 9, bold, SOFT);
    right('RATE', COL.rateR, 9, bold, SOFT);
    right('HOURS', COL.hoursR, 9, bold, SOFT);
    right('AMOUNT', COL.amtR, 9, bold, SOFT);
    y -= 8; page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness: 1, color: INK }); y -= 16;
  };
  // head=false: a page break for the TOTAL/note must NOT redraw the column
  // headers (that produced a page 2 with headings and no rows).
  const need = (h, head = true) => { if (y - h < CM + PAD) { chrome(); if (head) colHead(); } };

  chrome();
  left(inv.gcName || 'GC', M, 15, bold, INK);
  left(`  ·  cost code ${inv.costCode || '01 31 00'}`, M + bold.widthOfTextAtSize(inv.gcName || 'GC', 15), 10, font, SOFT);
  y -= 15; left(`Week of ${inv.period || ''}`, M, 10, font, SOFT); y -= 14;
  colHead();

  for (const p of inv.projects || []) {
    need(36);
    left(p.name, M, 11, bold, GREEN);
    if (p.invoiceNo) left(`·  #${p.invoiceNo}`, M + bold.widthOfTextAtSize(p.name, 11) + 10, 9.5, font, SOFT);
    y -= 14;
    for (const d of p.days || []) {
      for (const l of d.lines || []) {
        need(31);
        left(mdy(d.date), M, 9.5, mono, INK);
        left(l.item || 'Labor', M + 68, 11, bold, INK);
        right(hrs(l.hours), COL.hoursR, 10.5, mono);
        right(money(l.rate), COL.rateR, 10.5, mono);
        right(money(l.amount), COL.amtR, 10.5, mono);
        y -= 12;
        left(`Onsite: ${(l.onsite || []).join(', ') || '—'}`, M, 8.5, font, SOFT);
        y -= 6; rule(); y -= 10;
      }
    }
  }

  need(30, false); y -= 6;
  const amt = money(inv.total);
  right('TOTAL', COL.amtR - bold.widthOfTextAtSize(amt, 13) - 20, 13, bold);
  right(amt, COL.amtR, 13, bold);
  y -= 20;

  if (inv.note) {
    need(50, false);
    for (const ln of wrap('Note: ' + inv.note, font, 8.5, RIGHT - M)) { left(ln, M, 8.5, font, SOFT); y -= 12; }
  }

  return Buffer.from(await doc.save());
}

function wrap(str, f, size, maxW) {
  const words = String(str).split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (f.widthOfTextAtSize(t, size) > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
