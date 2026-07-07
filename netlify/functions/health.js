// Health check — verifies the Google Sheets service-account connection.
//
// Once the env vars are set (locally via `netlify dev`, or in production), open
//   /api/health
// It reads the seeded tabs and reports how many rows it can see. Use this to
// confirm the service account is authorized and the Sheet is shared correctly
// BEFORE building anything else on top. It returns counts only — no PII, no PINs.

import { readTab } from './lib/sheets.js';
import { TABS } from './lib/config.js';

export default async function handler() {
  try {
    const [subs, workers, projects] = await Promise.all([
      readTab(TABS.SUBS),
      readTab(TABS.WORKERS),
      readTab(TABS.PROJECTS),
    ]);

    return json(200, {
      ok: true,
      sheetId: process.env.SHEET_ID ? 'set' : 'MISSING',
      tabs: {
        [TABS.SUBS]: subs.rows.length,
        [TABS.WORKERS]: workers.rows.length,
        [TABS.PROJECTS]: projects.rows.length,
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return json(500, { ok: false, error: err.message });
  }
}

function json(status, body) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
