// POST /api/auth
//   { workerId, pin }      -> verify an existing PIN
//   { workerId, newPin }   -> set the PIN the first time (only if none exists)
// PINs are stored plain in Workers.PIN so the office can retrieve them (per spec).

import { json, body, guard } from './lib/http.js';
import { getWorkerById, setWorkerPin, normStoredPin } from './lib/model.js';

const valid = (p) => /^\d{4}$/.test(String(p || ''));

export default guard(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const { workerId, pin, newPin } = await body(req);

  const worker = await getWorkerById(workerId);
  if (!worker) return json(404, { ok: false, error: 'Worker not found' });

  const stored = String(worker.PIN || '').trim();

  // First-time set
  if (newPin !== undefined) {
    if (!valid(newPin)) return json(400, { ok: false, error: 'PIN must be 4 digits' });
    if (stored) return json(409, { ok: false, error: 'PIN already set' });
    await setWorkerPin(worker, newPin);
    return json(200, { ok: true, action: 'set' });
  }

  // Verify — pad both sides so a PIN whose leading zero was stripped by an earlier
  // USER_ENTERED write (e.g. stored 304) still matches the worker's real 0304.
  if (!stored) return json(409, { ok: false, error: 'No PIN set', needsSet: true });
  return json(200, { ok: normStoredPin(stored) === normStoredPin(pin) });
});
