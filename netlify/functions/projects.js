// GET /api/projects
// Returns active projects with their clock-in URL and a ready-to-print QR code
// (PNG data URL) for each site. Used by /qr.html to produce the jobsite posters.
// Not gated — the QR codes/URLs are meant to be posted publicly at jobsites, so
// there's nothing secret here. (The invoice preview endpoint keeps its token.)

import QRCode from 'qrcode';
import { json, guard } from './lib/http.js';
import { readTab } from './lib/sheets.js';
import { TABS } from './lib/config.js';

const isActive = (r) => String(r.Active).trim().toUpperCase().startsWith('Y');

export default guard(async (req) => {
  const base = (process.env.SITE_URL || 'https://timeclock.backforty.builders').replace(/\/+$/, '');
  const { rows } = await readTab(TABS.PROJECTS);

  const projects = [];
  for (const p of rows.filter(isActive)) {
    const qrParam = String(p.QRParam || '').trim();
    if (!qrParam) continue;
    const url = `${base}/?site=${encodeURIComponent(qrParam)}`;
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: 'M' });
    projects.push({ siteName: p.SiteName, qrParam, url, qr });
  }

  return json(200, { ok: true, base, count: projects.length, projects });
});
