// POST /api/switch
//   { workerId, pin, fromSite:<QRParam>, toSite:<QRParam> }
// "Switch to Different Jobsite": one tap clocks the worker OUT of the current
// site and IN to the chosen site at the SAME wall-clock instant. Because there
// is no gap between the two, the drive between jobsites is never unpaid — it
// simply folds into the destination site's running shift. There is no separate
// commute pay or rate (per Adrienne/Brian: "no pay gap, pay isn't different"),
// and nothing new to bill — the hours are ordinary paired hours on the
// destination project.
//
// Both rows are tagged Source=switch so the office can see the pair came from a
// switch. Note the destination IN is NOT a scanned presence punch (the worker
// is still at the origin site when they pick the destination), which is the
// accepted trade-off for the one-tap flow.

import { json, body, guard } from './lib/http.js';
import { getWorkerById, getProjectByQR, appendPunch, etStamp } from './lib/model.js';

export default guard(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const { workerId, pin, fromSite, toSite } = await body(req);

  const worker = await getWorkerById(workerId);
  if (!worker) return json(404, { ok: false, error: 'Worker not found' });
  if (String(worker.PIN || '').trim() !== String(pin || '').trim()) {
    return json(401, { ok: false, error: 'Wrong PIN' });
  }

  // Destination must resolve to a real active project.
  const toProject = toSite ? await getProjectByQR(toSite) : null;
  if (!toProject) {
    return json(400, { ok: false, error: 'Pick a valid jobsite to switch to', noSite: true });
  }
  const fromProject = fromSite ? await getProjectByQR(fromSite) : null;

  // One timestamp for both punches → zero unpaid gap. Append OUT first, then IN,
  // so day-pairing (stable sort on equal timestamps) closes the origin shift
  // before opening the destination shift.
  const stamp = etStamp();
  await appendPunch({ project: fromProject, worker, action: 'OUT', stamp, source: 'switch' });
  await appendPunch({ project: toProject, worker, action: 'IN', stamp, source: 'switch' });

  return json(200, { ok: true, at: stamp, site: toProject.SiteName });
});
