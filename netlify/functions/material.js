// POST /api/material
//   { workerId, pin, site, amount, note?, receipt?: { filename, mimeType, base64 } }
// Owner/independent captures a materials cost at clock-out. Optional receipt
// photo is uploaded to Drive and its link stored. Appends a Materials row.

import { json, body, guard } from './lib/http.js';
import { getWorkerById, getProjectByQR, etStamp } from './lib/model.js';
import { appendRow } from './lib/sheets.js';
import { TABS } from './lib/config.js';
import { uploadReceipt } from './lib/drive.js';

export default guard(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const { workerId, pin, site, amount, note, receipt } = await body(req);

  const worker = await getWorkerById(workerId);
  if (!worker) return json(404, { ok: false, error: 'Worker not found' });
  if (String(worker.PIN || '').trim() !== String(pin || '').trim()) {
    return json(401, { ok: false, error: 'Wrong PIN' });
  }

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

  await appendRow(TABS.MATERIALS, {
    MaterialID: `M-${Date.now()}`,
    Timestamp: etStamp(),
    SubID: worker.SubID,
    Project: project ? project.ProjectID : '',
    Amount: amt,
    Note: note || '',
    ReceiptURL: receiptURL,
  });

  return json(200, { ok: true, amount: amt, receiptURL });
});
