/**
 * One-off test: send via Resend HTTP API (same as Resend dashboard "Send email").
 *
 * Do NOT put your real API key in this file. Use an environment variable:
 *
 *   cd scripts && npm install
 *   RESEND_API_KEY=re_xxxxxxxx node ./send-resend-onboarding.mjs
 *
 * Replace re_xxxxxxxx with your real API key from Resend → API Keys.
 *
 * Optional: RESEND_TEST_TO=you@gmail.com RESEND_TEST_FROM=onboarding@resend.dev
 *
 * Production Dolli uses SMTP (SMTP_HOST=smtp.resend.com, SMTP_USER=resend, SMTP_PASSWORD=re_...)
 * in /etc/dolli/prod.env — this script is only for verifying the key works.
 */

import { Resend } from 'resend';

const apiKey = (process.env.RESEND_API_KEY || '').trim();
if (!apiKey || apiKey === 're_xxxxxxxxx') {
  console.error('Set RESEND_API_KEY to your real key (replace re_xxxxxxxxx), e.g.:');
  console.error('  RESEND_API_KEY=re_yourKeyHere node ./send-resend-onboarding.mjs');
  process.exit(1);
}

const resend = new Resend(apiKey);

const from = (process.env.RESEND_TEST_FROM || 'onboarding@resend.dev').trim();
const to = (process.env.RESEND_TEST_TO || 'i.amirsktl@gmail.com').trim();

const { data, error } = await resend.emails.send({
  from,
  to,
  subject: 'Hello World',
  html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
});

if (error) {
  console.error('Resend error:', error);
  process.exit(1);
}

console.log('Sent OK:', data);
