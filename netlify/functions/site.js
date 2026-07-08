// GET /api/site?site=<QRParam>
// Bootstrap payload for the clock screen: the project (from the QR param), the
// roster of active workers with their current clock state, and the sub list for
// the "my name isn't here" fallback. No PINs are ever returned.

import { json, query, guard } from './lib/http.js';
import { getProjectByQR, buildRoster, getSubsById, getActiveSites } from './lib/model.js';

export default guard(async (req) => {
  const qr = query(req, 'site');

  const [project, roster, subs, sites] = await Promise.all([
    qr ? getProjectByQR(qr) : Promise.resolve(null),
    buildRoster(),
    getSubsById(),
    getActiveSites(),
  ]);

  return json(200, {
    project: project
      ? { id: project.ProjectID, siteName: project.SiteName, qrParam: project.QRParam }
      : null,
    workers: roster,
    subs: [...subs.values()]
      .filter((s) => String(s.Active).trim().toUpperCase().startsWith('Y'))
      .map((s) => ({ id: String(s.SubID).trim(), company: s.CompanyName })),
    sites, // active jobsites, for the offsite Time Log site picker
  });
});
