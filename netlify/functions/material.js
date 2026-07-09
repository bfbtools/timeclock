// POST /api/material
//   { workerId, pin, site, amount, note?, receipt?: { filename, mimeType, base64 } }
// Owner/independent captures a materials cost at clock-out. Optional receipt
// photo is uploaded to Drive and its link stored. Appends a Materials row.

import { json, body, guard } from './lib/http.js';
import { authEdit, getProjectByQR, etStamp } from './lib/model.js';
import { appendRow } from './lib/sheets.js';
import { TABS } from './lib/config.js';
import { uploadReceipt } from './lib/drive.js';

export default guard(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const { workerId, actingId, pin, site, amount, note, receipt, date } = await body(req);

  // Self (clock-out / own invoice), or an owner adding onto their sub's invoice.
  const auth = await authEdit({ targetId: workerId, actingId, pin });
  if (auth.error) return json(auth.status, { ok: false, error: auth.error });
  const worker = auth.target;

  const amt = parseFloat(String(amount).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(amt) || amt <= 0) return json(400, { ok: false, error: 'Enter an amount' });

  const project = site ? await getProjectByQR(site) : null;

  let receiptURL = '';
  if (receipt && receipt.base64) {
    try {
      receiptURL = (await uploadReceipt({
        filename: receipt.filename || `receipt-${Date.now()}.jpg`,
        mimeType: receipt.mimeType, base64: receipt.base64,
      })) || '';
    } catch (e) {
      // Don't lose the material if the upload fails — save it, note the miss.
      receiptURL = `upload failed: ${e.message}`;
    }
  }

  // Per-day materials (from the Time Log) carry that day's date; clock-out
  // materials use now.
  const stamp = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? `${date} 12:00:00` : etStamp();

  await appendRow(TABS.MATERIALS, {
    MaterialID: `M-${Date.now()}`,
    Timestamp: stamp,
    SubID: worker.SubID,
    Project: project ? project.ProjectID : '',
    Amount: amt,
    Note: note || '',
    ReceiptURL: receiptURL,
  });

  return json(200, { ok: true, amount: amt, receiptURL });
});
