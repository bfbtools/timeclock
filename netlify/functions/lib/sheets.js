// Google Sheets read/write helper.
//
// Auth: a Google service account. Its JSON key is provided via the
// GOOGLE_SERVICE_ACCOUNT env var (never committed). The service-account email
// must be shared on the Sheet as an Editor.
//
// Everything here is generic: rows are treated as objects keyed by the tab's
// header row (row 1). Higher-level business logic lives in the function files.

import { google } from 'googleapis';

let _client = null;

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT is not set. Add the service-account JSON key to the environment.');
  }
  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT is not valid JSON. Paste the full key file contents as a single value.');
  }
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function sheets() {
  if (_client) return _client;
  _client = google.sheets({ version: 'v4', auth: getAuth() });
  return _client;
}

function spreadsheetId() {
  const id = process.env.SHEET_ID;
  if (!id) throw new Error('SHEET_ID is not set.');
  return id;
}

/**
 * Read a whole tab. Returns { headers: string[], rows: object[] } where each
 * row object is keyed by header, plus `_rowNumber` (1-based sheet row) so
 * callers can update the exact row later.
 */
export async function readTab(tabName) {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${tabName}`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const values = res.data.values || [];
  if (values.length === 0) return { headers: [], rows: [] };
  const headers = values[0].map((h) => String(h).trim());
  const rows = values.slice(1).map((row, i) => {
    const obj = { _rowNumber: i + 2 }; // +2: skip header, 1-based
    headers.forEach((h, c) => {
      obj[h] = row[c] !== undefined ? row[c] : '';
    });
    return obj;
  });
  return { headers, rows };
}

/** Read just the header row of a tab. */
export async function readHeaders(tabName) {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${tabName}!1:1`,
  });
  const values = res.data.values || [];
  return (values[0] || []).map((h) => String(h).trim());
}

/**
 * Append one row to a tab from an object keyed by column header.
 * Missing columns are written blank; unknown keys are ignored.
 */
export async function appendRow(tabName, obj) {
  const headers = await readHeaders(tabName);
  const row = headers.map((h) => (obj[h] !== undefined && obj[h] !== null ? obj[h] : ''));
  await sheets().spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${tabName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
  return row;
}

/**
 * Overwrite a single row (1-based sheet row number) from an object keyed by
 * column header. Only the columns present in `obj` are changed — others are
 * re-read from the sheet so nothing is clobbered.
 */
export async function updateRow(tabName, rowNumber, obj) {
  const headers = await readHeaders(tabName);
  const current = await sheets().spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${tabName}!${rowNumber}:${rowNumber}`,
  });
  const existing = (current.data.values && current.data.values[0]) || [];
  const row = headers.map((h, c) => {
    if (Object.prototype.hasOwnProperty.call(obj, h)) return obj[h] ?? '';
    return existing[c] !== undefined ? existing[c] : '';
  });
  const lastCol = colLetter(headers.length);
  await sheets().spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${tabName}!A${rowNumber}:${lastCol}${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
  return row;
}

/** Convenience: read a tab and return only rows matching a predicate. */
export async function findRows(tabName, predicate) {
  const { rows } = await readTab(tabName);
  return rows.filter(predicate);
}

// A(1) → "A", 27 → "AA", etc.
function colLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
