// POST /api/punch
//   { workerId, pin, action:'IN'|'OUT', site:<QRParam>, at?, missed? }
// Verifies the PIN, resolves the project from the QR param, and appends a punch
// row. `at` (a "YYYY-MM-DDTHH:mm" local/ET value) + missed=true is used for the
// prior-day clock-out recovery; those rows are marked Source=manual, Edited=Y.

import { json, body, guard } from './lib/http.js';
import { getWorkerById, getProjectByQR, appendPunch, etStamp } from './lib/model.js';

export default guard(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const { workerId, pin, action, site, at, missed } = await body(req);

  if (action !== 'IN' && action !== 'OUT') {
    return json(400, { ok: false, error: 'action must be IN or OUT' });
  }

  const worker = await getWorkerById(workerId);
  if (!worker) return json(404, { ok: false, error: 'Worker not found' });
  if (String(worker.PIN || '').trim() !== String(pin || '').trim()) {
    return json(401, { ok: false, error: 'Wrong PIN' });
  }

  const project = site ? await getProjectByQR(site) : null;
  // Presence proof: a punch must come from a scanned jobsite QR.
  if (!project) return json(400, { ok: false, error: 'No valid jobsite — scan the QR at the site', noSite: true });

  // Timestamp: recovery sends an ET wall-clock value ("YYYY-MM-DDTHH:mm[:ss]");
  // live punches use now (ET). Normalize to "YYYY-MM-DD HH:mm:ss".
  let stamp;
  if (missed && at) {
    stamp = String(at).replace('T', ' ').slice(0, 19);
    if (stamp.length === 16) stamp += ':00';
  } else {
    stamp = etStamp();
  }

  await appendPunch({ project, worker, sub: worker.SubID, action, stamp, missed: !!missed });
  return json(200, { ok: true, at: stamp, action });
});
