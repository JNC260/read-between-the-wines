import nodemailer from "nodemailer";
import { config, isProduction } from "./config";

export type Email = {
  to: string;
  subject: string;
  html: string;
  // Extra headers, like List-Unsubscribe on notification emails.
  headers?: Record<string, string>;
};

type Sender = (email: Email) => Promise<void>;

const RESEND_URL = "https://api.resend.com/emails";

// Production: Resend's HTTP API. Railway turns off outgoing SMTP on its
// Hobby plan and recommends Resend, and this one request is all the SDK
// would do for us.
const sendWithResend =
  (apiKey: string): Sender =>
  async ({ to, subject, html, headers }) => {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.EMAIL_FROM,
        to: [to],
        subject,
        html,
        ...(headers && { headers }),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // Resend says why in the body: an unverified sending domain, a revoked
      // key, a malformed address. Worth having in the logs.
      const detail = await response.text().catch(() => "");
      throw new Error(`Resend refused the email (${response.status}): ${detail.slice(0, 500)}`);
    }
  };

// Everywhere else: SMTP to Mailpit, which catches every message so nothing
// reaches a real inbox. lib/config makes sure host and port are set.
const sendWithSmtp = (): Sender => {
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    // Mailpit needs no login, so only send credentials when they're set.
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  });
  return async ({ to, subject, html, headers }) => {
    await transport.sendMail({ from: config.EMAIL_FROM, to, subject, html, headers });
  };
};

// Chosen once at startup. lib/config requires RESEND_API_KEY in production.
export const sendEmail: Sender =
  isProduction && config.RESEND_API_KEY
    ? sendWithResend(config.RESEND_API_KEY)
    : sendWithSmtp();
