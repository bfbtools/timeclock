// POST /api/worker
//   { first, last, subId }
// The "my name isn't here" fallback. Creates a Worker row flagged
// PendingReview=Y that inherits the sub's default rate (never self-set) and can
// clock in immediately. The PIN is set right after via /api/auth (set-PIN flow).

import { json, body, guard } from './lib/http.js';
import { createFallbackWorker, getSubsById, displayName } from './lib/model.js';
import { sendEmail } from './lib/email.js';

export default guard(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const { first, last, subId } = await body(req);

  if (!first || !last) return json(400, { ok: false, error: 'First and last name required' });
  if (!subId) return json(400, { ok: false, error: 'Sub required' });

  const subs = await getSubsById();
  const sub = subs.get(String(subId).trim());
  if (!sub) return json(404, { ok: false, error: 'Sub not found' });

  const row = await createFallbackWorker({ first, last, subId });

  // Notify accounting of a self-added worker (non-blocking — never fail signup).
  try {
    const acct = process.env.ACCOUNTING_EMAIL || 'accounting@backforty.builders';
    await sendEmail({
      to: acct,
      subject: `New worker self-added: ${first} ${last} (${sub.CompanyName})`,
      html: `<p>A worker added themselves through the Time Clock and is flagged <b>pending review</b>.</p>
        <ul>
          <li><b>Name:</b> ${first} ${last}</li>
          <li><b>Sub / company:</b> ${sub.CompanyName}</li>
          <li><b>Worker ID:</b> ${row.WorkerID}</li>
        </ul>
        <p>Set their type and pay rate in the Workers tab, then clear the Pending Review flag.</p>`,
    });
  } catch (e) { /* email is best-effort; the worker is already created */ }

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
