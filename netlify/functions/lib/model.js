// Domain helpers over the raw Sheet tabs. Column names match the seven-tab
// data model in docs/bfb-timeclock-spec.md. Timestamps are stored as
// Eastern-time wall clock ("YYYY-MM-DD HH:mm:ss") so the Sheet is human-legible
// and date grouping needs no timezone math (the date part IS the ET date).

import { readTab, appendRow, updateRow } from './sheets.js';
import { TABS, TIMEZONE, EDIT_WINDOW_DAYS } from './config.js';
import { mondayOf, weekRange, dayKey, pairDay } from './rollup.js';

/* ----------------------------------------------------------- time (ET) */
const etFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});
// -> { date: 'YYYY-MM-DD', time: 'HH:mm:ss' } for a given Date in ET.
export function etParts(date = new Date()) {
  const p = Object.fromEntries(etFmt.formatToParts(date).map((x) => [x.type, x.value]));
  let hour = p.hour === '24' ? '00' : p.hour; // Intl can emit 24 at midnight
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${hour}:${p.minute}:${p.second}` };
}
export function etStamp(date = new Date()) {
  const { date: d, time } = etParts(date);
  return `${d} ${time}`;
}
export function etToday() {
  return etParts().date;
}
// Earliest ET date a worker may still manually add/edit from the Time Log — a
// rolling window ending today (EDIT_WINDOW_DAYS inclusive). Older days lock.
export function editWindowStart(todayISO = etToday()) {
  const d = new Date(todayISO + 'T00:00:00');
  d.setDate(d.getDate() - (EDIT_WINDOW_DAYS - 1));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
// Date portion of a stored "YYYY-MM-DD HH:mm:ss" stamp.
export function stampDate(stamp) {
  return String(stamp || '').slice(0, 10);
}

/* ----------------------------------------------------------- lookups */
export function displayName(w) {
  return (w.Nickname && String(w.Nickname).trim()) || w.First || '';
}
const yes = (v) => String(v).trim().toUpperCase() === 'Y' || String(v).trim().toUpperCase() === 'YES' || v === true;
export const isActive = (row) => yes(row.Active);

export async function getProjectByQR(qr) {
  const { rows } = await readTab(TABS.PROJECTS);
  return rows.find((p) => isActive(p) && String(p.QRParam).trim() === String(qr).trim()) || null;
}

export async function getSubsById() {
  const { rows } = await readTab(TABS.SUBS);
  const map = new Map();
  rows.forEach((s) => map.set(String(s.SubID).trim(), s));
  return map;
}

export async function getWorkerById(id) {
  const { rows } = await readTab(TABS.WORKERS);
  return rows.find((w) => String(w.WorkerID).trim() === String(id).trim()) || null;
}

// Authorize an edit to `targetId`'s data. Self-edit: the target's own PIN.
// Delegated edit: an `actingId` who must be an OWNER in the SAME sub as the
// target, verified by the ACTING worker's PIN. Returns { target, acting } on
// success, or { error, status } to return directly.
export async function authEdit({ targetId, actingId, pin }) {
  const target = await getWorkerById(targetId);
  if (!target) return { error: 'Worker not found', status: 404 };
  const delegated = actingId && String(actingId).trim() && String(actingId).trim() !== String(targetId).trim();
  const acting = delegated ? await getWorkerById(actingId) : target;
  if (!acting) return { error: 'Worker not found', status: 404 };
  if (String(acting.PIN || '').trim() !== String(pin || '').trim()) return { error: 'Wrong PIN', status: 401 };
  if (delegated) {
    const isOwner = String(acting.Type || '').trim().toLowerCase() === 'owner';
    const sameSub = String(acting.SubID).trim() === String(target.SubID).trim();
    if (!isOwner || !sameSub) return { error: 'Not authorized to edit this worker', status: 403 };
  }
  return { target, acting };
}

export async function getWorkersBySub(subId) {
  const { rows } = await readTab(TABS.WORKERS);
  return rows.filter((w) => isActive(w) && String(w.SubID).trim() === String(subId).trim());
}

export async function getProjectsById() {
  const { rows } = await readTab(TABS.PROJECTS);
  const map = {};
  rows.forEach((p) => { map[String(p.ProjectID).trim()] = p; });
  return map;
}

// Active jobsites for the offsite Time Log site picker: [{ qrParam, siteName }].
export async function getActiveSites() {
  const { rows } = await readTab(TABS.PROJECTS);
  return rows
    .filter((p) => isActive(p) && String(p.QRParam || '').trim())
    .map((p) => ({ id: String(p.ProjectID || '').trim(), qrParam: String(p.QRParam).trim(), siteName: p.SiteName }));
}

// All punches for a set of worker ids whose day falls within [start, end].
export async function getPunchesForWorkers(ids, start, end) {
  const set = new Set(ids.map((i) => String(i).trim()));
  const { rows } = await readTab(TABS.PUNCHES);
  return rows.filter((p) => {
    const d = stampDate(p.Timestamp);
    return set.has(String(p.WorkerID).trim()) && d >= start && d <= end;
  });
}

// Materials for a sub whose day falls within [start, end].
export async function getMaterialsForSub(subId, start, end) {
  const { rows } = await readTab(TABS.MATERIALS);
  return rows.filter((m) => {
    const d = stampDate(m.Timestamp);
    return String(m.SubID).trim() === String(subId).trim() && d >= start && d <= end;
  });
}

/* ----------------------------------------------------------- punch state */
// Given all punch rows for one worker, decide current clock state.
// Uses the latest punch by timestamp: an IN with no later OUT = still in.
export function computeStatus(workerPunches) {
  if (!workerPunches.length) return { status: 'out', openPriorDate: false, openInfo: null, open: null };
  const sorted = [...workerPunches].sort((a, b) => String(a.Timestamp).localeCompare(String(b.Timestamp)));
  const last = sorted[sorted.length - 1];
  if (String(last.Action).toUpperCase() !== 'IN') {
    return { status: 'out', openPriorDate: false, openInfo: null, open: null };
  }
  const openDate = stampDate(last.Timestamp);
  const openTime = String(last.Timestamp).slice(11, 16); // "HH:mm" of the recorded clock-in
  const priorDate = openDate < etToday();
  return {
    status: 'in',
    openPriorDate: priorDate,
    // date/time/punchId let the recovery "Fix my hours" screen prefill the recorded
    // clock-in and edit it (via punch-edit) if it was wrong — not just add the OUT.
    openInfo: priorDate ? { date: openDate, time: openTime, punchId: String(last.PunchID || '').trim() } : null,
    // Where this open shift was clocked in — a live clock-out must scan the same
    // jobsite (see the front end's same-site guard). ProjectID + display name.
    open: { projectId: String(last.Project || '').trim(), siteName: last.Site || '' },
  };
}

// Current Mon–Sun week hours for one worker (shown on the clock screen). Not
// PIN-gated — it's a single aggregate, unlike the detailed Time Log/invoice.
export function currentWeekHours(workerPunches, weekStart, weekEnd) {
  const byDay = new Map();
  (workerPunches || []).forEach((p) => {
    const d = dayKey(p.Timestamp);
    if (d < weekStart || d > weekEnd) return;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(p);
  });
  let minutes = 0;
  byDay.forEach((dp) => { minutes += pairDay(dp).minutes; });
  return Math.round((minutes / 60) * 100) / 100;
}

// Build the /api/site worker list (name, sub, state) for all active workers.
export async function buildRoster() {
  const [{ rows: workers }, { rows: punches }, subs] = await Promise.all([
    readTab(TABS.WORKERS), readTab(TABS.PUNCHES), getSubsById(),
  ]);
  const byWorker = new Map();
  punches.forEach((p) => {
    const k = String(p.WorkerID).trim();
    if (!byWorker.has(k)) byWorker.set(k, []);
    byWorker.get(k).push(p);
  });
  const today = etToday();
  const weekStart = mondayOf(today);
  const { end: weekEnd } = weekRange(weekStart);
  return workers.filter(isActive).map((w) => {
    const punchList = byWorker.get(String(w.WorkerID).trim()) || [];
    const st = computeStatus(punchList);
    const sub = subs.get(String(w.SubID).trim());
    return {
      id: String(w.WorkerID).trim(),
      name: displayName(w),
      sub: sub ? sub.CompanyName : '',
      type: String(w.Type || 'employee').trim().toLowerCase(),
      hasPin: !!String(w.PIN).trim(),
      status: st.status,
      openPriorDate: st.openPriorDate,
      openInfo: st.openInfo,
      open: st.open, // { projectId, siteName } of the current open shift (or null)
      todayHours: currentWeekHours(punchList, today, today), // single-day range
      weekHours: currentWeekHours(punchList, weekStart, weekEnd),
    };
  });
}

/* ----------------------------------------------------------- writes */
export async function setWorkerPin(worker, pin) {
  return updateRow(TABS.WORKERS, worker._rowNumber, { PIN: String(pin) });
}

// `source` overrides the default IN/OUT source label when given (e.g. 'switch'
// for a "Switch to Different Jobsite" pair, whose destination IN is not a
// scanned presence punch). Otherwise: manual (missed-punch recovery) or scan.
export async function appendPunch({ project, worker, sub, action, stamp, missed, source }) {
  const row = {
    PunchID: `P-${Date.now()}-${Math.floor(performance.now() % 1000)}`,
    Timestamp: stamp,
    Site: project ? project.SiteName : '',
    Project: project ? project.ProjectID : '',
    SubID: worker.SubID,
    WorkerID: String(worker.WorkerID).trim(),
    WorkerName: displayName(worker),
    Action: action,
    Source: source || (missed ? 'manual' : 'scan'),
    Edited: missed ? 'Y' : '',
  };
  await appendRow(TABS.PUNCHES, row);
  return row;
}

export async function createFallbackWorker({ first, last, subId }) {
  const id = `W-${Date.now()}`;
  const row = {
    WorkerID: id,
    Type: 'employee',        // office adjusts type on review
    First: first,
    Last: last,
    Nickname: '',
    SubID: subId,
    Email: '',
    PIN: '',                 // set next via /api/auth (set-PIN flow)
    PayRateOverride: '',     // inherits the sub's default rate — never self-set
    GCRateOverride: '',
    Active: 'Y',
    'Pending Review': 'Y',   // office reviews before it counts as confirmed
  };
  await appendRow(TABS.WORKERS, row);
  return row;
}
