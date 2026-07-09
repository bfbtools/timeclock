// /api/projects
//   GET  → every project (active + inactive) with clock-in URL + QR code, for
//          the /qr.html admin page.
//   POST → create a project, or toggle a project's Active flag (writes the Sheet).
// Open (no token) per request — it's an internal admin page. If abuse ever
// becomes a concern, reintroduce a token check in mutate().

import QRCode from 'qrcode';
import { json, body, guard } from './lib/http.js';
import { readTab, appendRow, updateRow } from './lib/sheets.js';
import { TABS } from './lib/config.js';

const isActiveVal = (v) => String(v).trim().toUpperCase().startsWith('Y');
const isShop = (qrParam, siteName) =>
  String(qrParam).trim().toLowerCase() === 'bfbshop' ||
  String(siteName).trim().toLowerCase() === 'bfb shop';

function siteUrl(base, qrParam) {
  return `${base}/?site=${encodeURIComponent(String(qrParam).trim())}`;
}
async function qrFor(url) {
  return QRCode.toDataURL(url, { margin: 1, width: 600, errorCorrectionLevel: 'M' });
}
function baseUrl() {
  return (process.env.SITE_URL || 'https://timeclock.backforty.builders').replace(/\/+$/, '');
}

export default guard(async (req) => {
  if (req.method === 'POST') return mutate(req);

  // GET — list every project with a QR.
  const base = baseUrl();
  const { rows } = await readTab(TABS.PROJECTS);
  const projects = [];
  for (const p of rows) {
    const qrParam = String(p.QRParam || '').trim();
    if (!qrParam) continue;
    const url = siteUrl(base, qrParam);
    projects.push({
      projectId: String(p.ProjectID || '').trim(),
      siteName: p.SiteName,
      qrParam,
      btProject: p.BTProject || '',
      billsToGC: isActiveVal(p.BillsToGC),
      gcName: p.GCName || '',
      gcRate: p.GCRate || '',
      active: isActiveVal(p.Active),
      isShop: isShop(qrParam, p.SiteName),
      url,
      qr: await qrFor(url),
    });
  }
  return json(200, { ok: true, base, count: projects.length, projects });
});

async function mutate(req) {
  const b = await body(req);
  const { rows } = await readTab(TABS.PROJECTS);

  // Toggle Active on an existing project.
  if (b.op === 'active') {
    const row = rows.find((r) => String(r.ProjectID).trim() === String(b.projectId).trim());
    if (!row) return json(404, { ok: false, error: 'Project not found' });
    await updateRow(TABS.PROJECTS, row._rowNumber, { Active: b.active ? 'Y' : 'N' });
    return json(200, { ok: true, projectId: b.projectId, active: !!b.active });
  }

  // Create a new project.
  if (b.op === 'create') {
    const siteName = String(b.siteName || '').trim();
    const qrParam = String(b.qrParam || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!siteName) return json(400, { ok: false, error: 'Site name required' });
    if (!qrParam) return json(400, { ok: false, error: 'QR word required' });
    if (rows.some((r) => String(r.QRParam).trim().toLowerCase() === qrParam)) {
      return json(409, { ok: false, error: `QR word "${qrParam}" is already used` });
    }

    // Next ProjectID like P01, P02…
    let max = 0;
    rows.forEach((r) => { const m = /^P(\d+)$/i.exec(String(r.ProjectID).trim()); if (m) max = Math.max(max, +m[1]); });
    const projectId = 'P' + String(max + 1).padStart(2, '0');

    const billsToGC = !!b.billsToGC;
    const row = {
      ProjectID: projectId,
      SiteName: siteName,
      BTProject: b.btProject || '',
      BillsToGC: billsToGC ? 'Y' : 'N',
      GCName: billsToGC ? (b.gcName || '') : '',
      GCRate: billsToGC ? (b.gcRate || '') : '',
      QRParam: qrParam,
      Active: 'Y',
    };
    await appendRow(TABS.PROJECTS, row);

    const base = baseUrl();
    const url = siteUrl(base, qrParam);
    return json(200, {
      ok: true,
      project: {
        projectId, siteName, qrParam, btProject: row.BTProject,
        billsToGC, gcName: row.GCName, gcRate: row.GCRate,
        active: true, isShop: isShop(qrParam, siteName), url, qr: await qrFor(url),
      },
    });
  }

  return json(400, { ok: false, error: 'Unknown op' });
}
