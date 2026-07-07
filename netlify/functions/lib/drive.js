// Google Drive upload for materials receipts. Uses the SAME service account as
// Sheets, but with the drive.file scope. The target folder (DRIVE_FOLDER_ID)
// must be shared with the service-account email as Editor. If DRIVE_FOLDER_ID
// isn't configured, upload is skipped and null is returned (material still saves
// without a receipt link).

import { google } from 'googleapis';
import { Readable } from 'node:stream';

function driveClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT is not set');
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  return google.drive({ version: 'v3', auth });
}

// { filename, mimeType, base64 } -> shareable link (or null if not configured).
export async function uploadReceipt({ filename, mimeType, base64 }) {
  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!folderId || !base64) return null;
  const drive = driveClient();
  const res = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: mimeType || 'image/jpeg', body: Readable.from(Buffer.from(base64, 'base64')) },
    fields: 'id, webViewLink',
  });
  // Best-effort: make viewable by link (may be blocked by domain sharing policy).
  try {
    await drive.permissions.create({ fileId: res.data.id, requestBody: { role: 'reader', type: 'anyone' } });
  } catch { /* folder-level sharing still applies */ }
  return res.data.webViewLink || null;
}
