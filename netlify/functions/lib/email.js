// Resend email wrapper. From accounting@backforty.builders (domain-verified).
import { Resend } from 'resend';

export async function sendEmail({ to, cc, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const from = process.env.ACCOUNTING_EMAIL || 'accounting@backforty.builders';
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: `Back Forty Builders <${from}>`,
    to: Array.isArray(to) ? to : [to],
    ...(cc ? { cc: Array.isArray(cc) ? cc : [cc] } : {}),
    subject,
    html,
  });
  if (error) throw new Error(error.message || 'Email send failed');
  return data;
}
