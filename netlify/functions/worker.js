// POST /api/worker
//   { first, last, subId }
// The "my name isn't here" fallback. Creates a Worker row flagged
// PendingReview=Y that inherits the sub's default rate (never self-set) and can
// clock in immediately. The PIN is set right after via /api/auth (set-PIN flow).

import { json, body, guard } from './lib/http.js';
import { createFallbackWorker, getSubsById, displayName } from './lib/model.js';

export default guard(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const { first, last, subId } = await body(req);

  if (!first || !last) return json(400, { ok: false, error: 'First and last name required' });
  if (!subId) return json(400, { ok: false, error: 'Sub required' });

  const subs = await getSubsById();
  const sub = subs.get(String(subId).trim());
  if (!sub) return json(404, { ok: false, error: 'Sub not found' });

  const row = await createFallbackWorker({ first, last, subId });

  return json(200, {
    ok: true,
    worker: {
      id: row.WorkerID,
      name: displayName(row),
      sub: sub.CompanyName,
      type: 'employee',
      hasPin: false,
      status: 'out',
      openPriorDate: false,
      openInfo: null,
    },
  });
});
