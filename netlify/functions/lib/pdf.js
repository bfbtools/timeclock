// Sub invoice rendered as a PDF (attached to the sub invoice email).
// Pure pdf-lib (standard fonts, no external files) so it bundles on Netlify.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtLong = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dateRange = (pd) => { if (!pd || !pd.length) return ''; const a = pd[0].date, b = pd[pd.length - 1].date; return a === b ? fmt(a) : `${fmt(a)} – ${fmt(b)}`; };

const INK = rgb(0.23, 0.22, 0.19);
const SOFT = rgb(0.42, 0.39, 0.35);
const LINE = rgb(0.86, 0.80, 0.70);
const M = 50;              // left margin
const RIGHT = 562;         // right edge (612 - 50)
const COL = { proj: 50, dates: 250, qtyR: 380, rateR: 462, amtR: 562 }; // R = right-aligned edge

export async function subInvoicePdf(inv, meta = {}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 792 - 56;
  const left = (s, x, size = 10, f = font, color = INK) => page.drawText(String(s), { x, y, size, font: f, color });
  const right = (s, xR, size = 10, f = font, color = INK) => {
    const w = f.widthOfTextAtSize(String(s), size);
    page.drawText(String(s), { x: xR - w, y, size, font: f, color });
  };
  const rule = (thickness = 0.5, color = LINE) => page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness, color });

  // header band
  page.drawRectangle({ x: 0, y: 792 - 74, width: 612, height: 74, color: rgb(0.176, 0.180, 0.157) });
  page.drawRectangle({ x: 0, y: 792 - 78, width: 612, height: 4, color: rgb(0.859, 0.337, 0.239) });
  page.drawText(inv.company, { x: M, y: 792 - 40, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`Invoice #${meta.invoiceNo || ''}   •   ${meta.invoiceDate ? fmtLong(meta.invoiceDate) : ''}   •   Due on receipt`,
    { x: M, y: 792 - 60, size: 10, font: bold, color: rgb(0.839, 0.690, 0.482) });

  y = 792 - 108;
  // title (wrap on width)
  const title = `${(inv.projectNames || []).join(', ')} – Back Forty Builders`;
  for (const ln of wrap(title, bold, 14, RIGHT - M)) { left(ln, M, 14, bold); y -= 18; }
  left(`Week ${fmt(inv.weekStart)} – ${fmt(inv.weekEnd)}`, M, 10, font, SOFT); y -= 22;

  // table header
  left('PROJECT', COL.proj, 9, bold, SOFT);
  left('DATES', COL.dates, 9, bold, SOFT);
  right('QTY', COL.qtyR, 9, bold, SOFT);
  right('RATE', COL.rateR, 9, bold, SOFT);
  right('AMOUNT', COL.amtR, 9, bold, SOFT);
  y -= 7; rule(1, INK); y -= 16;

  for (const p of inv.projects) {
    left(p.name, COL.proj, 10, bold);
    left(dateRange(p.perDay), COL.dates, 10);
    right(String(p.hours), COL.qtyR, 10);
    right(p.rate ? money(p.rate) : '—', COL.rateR, 10);
    right(money(p.amount), COL.amtR, 10);
    y -= 8; rule(); y -= 16;
  }
  for (const m of inv.materials) {
    left(`Materials${m.note ? ' — ' + m.note : ''}`, COL.proj, 10);
    right(money(m.amount), COL.amtR, 10);
    y -= 8; rule(); y -= 16;
  }

  y -= 4;
  right('TOTAL', COL.rateR, 12, bold);
  right(money(inv.total), COL.amtR, 12, bold);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

// Greedy word-wrap to a max width; returns array of lines.
function wrap(str, font, size, maxWidth) {
  const words = String(str).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
