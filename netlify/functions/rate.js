// POST /api/rate  { workerId, pin, newRate }
// An independent/owner changes their own pay rate. Updates the worker's
// PayRateOverride, logs the change to RateLog, and emails accounting@ so the
// office is notified. (Rates are never self-set for company employees — only
// owners/independents can call this; the client gates by type and this verifies
// the PIN.)

import { json, body, guard } from './lib/http.js';
import { getWorkerById, getSubsById, displayName, etStamp } from './lib/model.js';
import { updateRow, appendRow } from './lib/sheets.js';
import { TABS } from './lib/config.js';
import { sendEmail } from './lib/email.js';

export default guard(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const { workerId, pin, newRate } = await body(req);

  const worker = await getWorkerById(workerId);
  if (!worker) return json(404, { ok: false, error: 'Worker not found' });
  if (String(worker.PIN || '').trim() !== String(pin || '').trim()) {
    return json(401, { ok: false, error: 'Wrong PIN' });
  }
  const type = String(worker.Type || 'employee').toLowerCase();
  if (type === 'employee') return json(403, { ok: false, error: 'Employees cannot change their rate' });

  const rate = parseFloat(String(newRate).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(rate) || rate <= 0) return json(400, { ok: false, error: 'Enter a valid rate' });

  const subs = await getSubsById();
  const sub = subs.get(String(worker.SubID).trim());
  const oldRate = String(worker.PayRateOverride || '').trim() || (sub ? sub.DefaultPayRate : '') || '';

  await updateRow(TABS.WORKERS, worker._rowNumber, { PayRateOverride: rate });
  const who = `${displayName(worker)}${sub ? ' (' + sub.CompanyName + ')' : ''}`;
  await appendRow(TABS.RATE_LOG, { Timestamp: etStamp(), Who: who, OldRate: oldRate, NewRate: rate });

  // Notify the office (best-effort — don't fail the change if email hiccups).
  try {
    const to = process.env.ACCOUNTING_EMAIL || 'accounting@backforty.builders';
    await sendEmail({
      to,
      subject: `Pay rate changed — ${who}`,
      html: `<p><strong>${who}</strong> changed their pay rate.</p>`
        + `<p>Old: $${oldRate || '—'} → New: <strong>$${rate}</strong>/hr</p>`
        + `<p style="color:#6b6459;font-size:12px">Logged ${etStamp()} (RateLog).</p>`,
    });
  } catch { /* logged in RateLog regardless */ }

  return json(200, { ok: true, oldRate, newRate: rate });
});
