// Files a sub invoice PDF straight into the "Need To Be Processed" Drive folder
// at send time — the delivery mechanism for the BFB bill pipeline (Slab handoff
// 2026-08-03, TODO 1a).
//
// Since ~Jul 20 the independent subs (Lopez, San Ignacio) are self-billed:
// accounting@ composes the invoice and sends it to accounting@. Those self-sent
// threads land unlabeled, so the accounting-side `routeBills` router — which
// only pulls attachments off LABELED threads — never sees them, and the
// invoices silently stopped reaching the folder. Writing the PDF here, at the
// moment we send, removes the Gmail round-trip entirely (nothing to drift).
//
// Filename matches the hand-dropped BFB convention already in the folder:
//   2026-07-20_to_07-24_LopezExtIntConstruction_French1_$5663.10.pdf
//   YYYY-MM-DD_to_MM-DD_<VendorPascalCase>_<Proj1>-<Proj2>_$<Total>.pdf
// The date range is the Mon–Fri WORK week, not the Mon–Sun billing span the
// email body prints.
//
// Idempotent + non-throwing: before writing it scans the folder for an existing
// file sharing the same "<weekStart>_to_<friday>_<vendor>_" prefix and skips if
// one is present — so a re-run, a backfill, or `routeBills` filing the (now
// possibly labeled) thread can't double-file. It never rejects: a Drive hiccup
// returns { error } instead of breaking the already-completed email send.

import { google } from 'googleapis';
import { Readable } from 'node:stream';

const NEED_FOLDER = process.env.NEED_TO_BE_PROCESSED_FOLDER_ID || '16TD-htSaANX0fnK5hP97Fgi4B_SoDIuw';

// Read-write Drive client on the shared "Back Forty" drive. Reuses the SAME
// service account as Sheets/Gmail (GOOGLE_SERVICE_ACCOUNT); that account must be
// a Content Manager on Need To Be Processed (slab-reader@bfb-time-clock… is).
function driveRW() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT is not set');
  const creds = JSON.parse(raw);
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

const pad = (n) => String(n).padStart(2, '0');
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d;
}
// Mon–Fri label from the Monday weekStart: "2026-07-20_to_07-24".
function weekRangeLabel(weekStartISO) {
  const fri = addDays(weekStartISO, 4);
  return `${weekStartISO}_to_${pad(fri.getMonth() + 1)}-${pad(fri.getDate())}`;
}
// "Lopez Exterior & Interior Construction LLC" -> "LopezExteriorInteriorConstruction"
function vendorToken(company) {
  const toks = String(company || 'Vendor')
    .split(/[^A-Za-z0-9]+/).filter(Boolean)
    .filter((w) => !/^(llc|inc|corp|co|ltd)$/i.test(w))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return toks.join('') || 'Vendor';
}
// ["French 1","JPL","Lapinsky"] -> "French1-JPL-Lapinsky" (spaces/punct stripped, case kept)
function projectToken(names) {
  const toks = (names || []).map((n) => String(n).replace(/[^A-Za-z0-9]+/g, '')).filter(Boolean);
  return toks.length ? toks.join('-') : 'NoProject';
}
// $5955 for whole dollars, $5663.10 otherwise (matches the folder convention).
function totalToken(n) {
  const v = Number(n || 0);
  return '$' + (Number.isInteger(v) ? String(v) : v.toFixed(2));
}

// The stable prefix used for the idempotency scan: date-range + vendor.
function filePrefix(invoice) {
  return `${weekRangeLabel(invoice.weekStart)}_${vendorToken(invoice.company)}_`;
}

export function invoiceFileName(invoice) {
  return `${filePrefix(invoice)}${projectToken(invoice.projectNames)}_${totalToken(invoice.total)}.pdf`;
}

// Write the sub invoice PDF into Need To Be Processed. Idempotent + non-throwing.
// Returns { filed, name } on write, { skipped, name, existing } if already there,
// or { error, name } on any Drive failure.
export async function fileSubInvoicePdf({ pdf, invoice }) {
  const name = invoiceFileName(invoice);
  const prefix = filePrefix(invoice);
  try {
    const drive = driveRW();
    // The folder is small; list it and match the prefix in JS rather than rely
    // on Drive's word-boundary `name contains` fuzziness.
    const list = await drive.files.list({
      q: `'${NEED_FOLDER}' in parents and trashed=false`,
      fields: 'files(id,name)',
      pageSize: 500,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const existing = (list.data.files || []).find((f) => (f.name || '').startsWith(prefix));
    if (existing) return { skipped: true, name, existing: existing.name };

    const res = await drive.files.create({
      requestBody: { name, parents: [NEED_FOLDER] },
      media: { mimeType: 'application/pdf', body: Readable.from(pdf) },
      fields: 'id,name',
      supportsAllDrives: true,
    });
    return { filed: true, name: res.data.name || name };
  } catch (e) {
    return { error: String((e && e.message) || e), name };
  }
}
