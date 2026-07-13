// Email via Google Workspace (Gmail API).
// Sends using the EXISTING service account (GOOGLE_SERVICE_ACCOUNT) with
// domain-wide delegation to impersonate the ACCOUNTING_EMAIL mailbox
// (accounting@backforty.builders). No extra secret and no new dependency —
// reuses the same googleapis client the Sheet uses.
//
// One-time setup in Google (admin):
//   1. Enable the Gmail API in the service account's Cloud project.
//   2. Google Workspace Admin → Security → API controls → Domain-wide
//      delegation: add the service account's numeric Client ID with the scope
//      https://www.googleapis.com/auth/gmail.send
import { google } from 'googleapis';

function sender() {
  return process.env.ACCOUNTING_EMAIL || 'accounting@backforty.builders';
}

function gmailClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT is not set.');
  let creds;
  try { creds = JSON.parse(raw); }
  catch { throw new Error('GOOGLE_SERVICE_ACCOUNT is not valid JSON.'); }
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: sender(), // impersonate accounting@ (requires domain-wide delegation)
  });
  return google.gmail({ version: 'v1', auth });
}

// RFC 2047-encode a header value only if it contains non-ASCII.
function encHeader(s) {
  return /[^\x00-\x7F]/.test(s)
    ? `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`
    : s;
}

// Build a base64url-encoded RFC 822 message for gmail.users.messages.send.
function buildRaw({ from, to, cc, subject, html }) {
  const list = (v) => (Array.isArray(v) ? v : [v]).filter(Boolean).join(', ');
  const headers = [
    `From: Back Forty Builders <${from}>`,
    `To: ${list(to)}`,
    ...(cc ? [`Cc: ${list(cc)}`] : []),
    `Subject: ${encHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html, 'utf8').toString('base64'),
  ];
  return Buffer.from(headers.join('\r\n'), 'utf8')
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendEmail({ to, cc, subject, html }) {
  const from = sender();
  const gmail = gmailClient();
  const raw = buildRaw({ from, to, cc, subject, html });
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  return res.data;
}
