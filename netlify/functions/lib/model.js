// Domain helpers over the raw Sheet tabs. Column names match the seven-tab
// data model in docs/bfb-timeclock-spec.md. Timestamps are stored as
// Eastern-time wall clock ("YYYY-MM-DD HH:mm:ss") so the Sheet is human-legible
// and date grouping needs no timezone math (the date part IS the ET date).

import { readTab, appendRow, updateRow } from './sheets.js';
import { TABS, TIMEZONE } from './config.js';

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
  if (!workerPunches.length) return { status: 'out', openPriorDate: false, openInfo: null };
  const sorted = [...workerPunches].sort((a, b) => String(a.Timestamp).localeCompare(String(b.Timestamp)));
  const last = sorted[sorted.length - 1];
  if (String(last.Action).toUpperCase() !== 'IN') {
    return { status: 'out', openPriorDate: false, openInfo: null };
  }
  const openDate = stampDate(last.Timestamp);
  const priorDate = openDate < etToday();
  return {
    status: 'in',
    openPriorDate: priorDate,
    openInfo: priorDate ? { date: openDate } : null,
  };
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
  return workers.filter(isActive).map((w) => {
    const st = computeStatus(byWorker.get(String(w.WorkerID).trim()) || []);
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
    };
  });
}

/* ----------------------------------------------------------- writes */
export async function setWorkerPin(worker, pin) {
  return updateRow(TABS.WORKERS, worker._rowNumber, { PIN: String(pin) });
}

export async function appendPunch({ project, worker, sub, action, stamp, missed }) {
  const row = {
    PunchID: `P-${Date.now()}-${Math.floor(performance.now() % 1000)}`,
    Timestamp: stamp,
    Site: project ? project.SiteName : '',
    Project: project ? project.ProjectID : '',
    SubID: worker.SubID,
    WorkerID: String(worker.WorkerID).trim(),
    WorkerName: displayName(worker),
    Action: action,
    Source: missed ? 'manual' : 'scan',
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
