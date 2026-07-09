// POST /api/punch
//   { workerId, pin, action:'IN'|'OUT', site:<QRParam>, at?, missed? }
// Verifies the PIN, resolves the project from the QR param, and appends a punch
// row. `at` (a "YYYY-MM-DDTHH:mm" local/ET value) + missed=true is used for the
// prior-day clock-out recovery; those rows are marked Source=manual, Edited=Y.

import { json, body, guard } from './lib/http.js';
import { authEdit, getProjectByQR, appendPunch, etStamp, editWindowStart } from './lib/model.js';

export default guard(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const { workerId, actingId, pin, action, site, at, missed } = await body(req);

  if (action !== 'IN' && action !== 'OUT') {
    return json(400, { ok: false, error: 'action must be IN or OUT' });
  }

  // Self (live scan or own missed-punch), or an owner adding for their crew.
  const auth = await authEdit({ targetId: workerId, actingId, pin });
  if (auth.error) return json(auth.status, { ok: false, error: auth.error });
  const worker = auth.target;

  const project = site ? await getProjectByQR(site) : null;
  // Presence proof for LIVE punches only: a real-time clock in/out must come
  // from a scanned jobsite QR. Manual corrections (missed punches from the Time
  // Log) are allowed offsite — the worker picks the jobsite in the form.
  if (!missed && !project) {
    return json(400, { ok: false, error: 'No valid jobsite — scan the QR at the site', noSite: true });
  }

  // Timestamp: recovery sends an ET wall-clock value ("YYYY-MM-DDTHH:mm[:ss]");
  // live punches use now (ET). Normalize to "YYYY-MM-DD HH:mm:ss".
  let stamp;
  if (missed && at) {
    stamp = String(at).replace('T', ' ').slice(0, 19);
    if (stamp.length === 16) stamp += ':00';
    // Manual adds are limited to the rolling edit window.
    if (stamp.slice(0, 10) < editWindowStart()) {
      return json(403, { ok: false, error: 'That day is outside the 2-week edit window' });
    }
  } else {
    stamp = etStamp();
  }

  await appendPunch({ project, worker, sub: worker.SubID, action, stamp, missed: !!missed });
  return json(200, { ok: true, at: stamp, action });
});
