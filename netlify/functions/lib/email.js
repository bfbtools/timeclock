// Email via Google Workspace (Gmail API).
// Sends using the EXISTING service account (GOOGLE_SERVICE_ACCOUNT) with
// domain-wide delegation to impersonate the ACCOUNTING_EMAIL mailbox
// (accounting@backforty.builders). No extra secret and no new dependency for
// sending — reuses the same googleapis client the Sheet uses.
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
// base64, wrapped at 76 chars per RFC 2045 (for message parts).
const b64 = (buf) => Buffer.from(buf).toString('base64').replace(/(.{76})/g, '$1\r\n');
// base64url of the whole raw message (for gmail.users.messages.send).
const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Build a base64url-encoded RFC 822 message. With attachments it's
// multipart/mixed (html part + one part per attachment); otherwise a plain
// text/html message.
function buildRaw({ from, to, cc, subject, html, attachments }) {
  const list = (v) => (Array.isArray(v) ? v : [v]).filter(Boolean).join(', ');
  const top = [
    `From: Back Forty Builders <${from}>`,
    `To: ${list(to)}`,
    ...(cc ? [`Cc: ${list(cc)}`] : []),
    `Subject: ${encHeader(subject)}`,
    'MIME-Version: 1.0',
  ];

  if (attachments && attachments.length) {
    const boundary = `----bfb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    top.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    const parts = [[
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64', '',
      b64(Buffer.from(html, 'utf8')),
    ].join('\r\n')];
    for (const a of attachments) {
      parts.push([
        `Content-Type: ${a.contentType || 'application/octet-stream'}; name="${a.filename}"`,
        `Content-Disposition: attachment; filename="${a.filename}"`,
        'Content-Transfer-Encoding: base64', '',
        b64(a.content),
      ].join('\r\n'));
    }
    const body = parts.map((p) => `--${boundary}\r\n${p}`).join('\r\n') + `\r\n--${boundary}--`;
    return b64url(top.join('\r\n') + '\r\n\r\n' + body);
  }

  top.push('Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64');
  return b64url(top.join('\r\n') + '\r\n\r\n' + b64(Buffer.from(html, 'utf8')));
}

// attachments: [{ filename, content (Buffer), contentType }]
export async function sendEmail({ to, cc, subject, html, attachments }) {
  const from = sender();
  const gmail = gmailClient();
  const raw = buildRaw({ from, to, cc, subject, html, attachments });
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  return res.data;
}
