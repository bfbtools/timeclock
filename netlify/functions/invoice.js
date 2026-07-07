// GET /api/invoice?workerId=&pin=
// PIN-gated. For a sub OWNER or INDEPENDENT, returns the live draft of this
// week's sub invoice (what BFB pays): one line per project (hours × pay rate)
// with a per-day breakdown, plus any materials. This is the same structure the
// Saturday auto-send uses (Step 5). Employees don't get an invoice (they use
// the Time Log) — the client routes by worker type, and this guards too.

import { json, query, guard } from './lib/http.js';
import {
  getWorkerById, getSubsById, getWorkersBySub,
  getProjectsById, getPunchesForWorkers, getMaterialsForSub, etToday,
} from './lib/model.js';
import { mondayOf, weekRange } from './lib/rollup.js';
import { buildSubInvoice } from './lib/invoice-lib.js';

export default guard(async (req) => {
  const workerId = query(req, 'workerId');
  const pin = query(req, 'pin');

  const worker = await getWorkerById(workerId);
  if (!worker) return json(404, { ok: false, error: 'Worker not found' });
  if (String(worker.PIN || '').trim() !== String(pin || '').trim()) {
    return json(401, { ok: false, error: 'Wrong PIN' });
  }

  const type = String(worker.Type || 'employee').toLowerCase();
  if (type === 'employee') {
    return json(200, { ok: true, notOwner: true }); // employees use the Time Log
  }

  const subs = await getSubsById();
  const sub = subs.get(String(worker.SubID).trim());
  if (!sub) return json(404, { ok: false, error: 'Sub not found' });

  const weekStart = mondayOf(etToday());
  const { end: weekEnd } = weekRange(weekStart);

  const workers = await getWorkersBySub(sub.SubID);
  const ids = workers.map((w) => String(w.WorkerID).trim());
  const [punches, materials, projectsById] = await Promise.all([
    getPunchesForWorkers(ids, weekStart, weekEnd),
    getMaterialsForSub(sub.SubID, weekStart, weekEnd),
    getProjectsById(),
  ]);

  const invoice = buildSubInvoice({ sub, workers, punches, materials, projectsById, weekStart });
  return json(200, { ok: true, invoice });
});
