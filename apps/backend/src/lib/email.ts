import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM } =
  process.env;
if (!SMTP_HOST || !SMTP_PORT || !EMAIL_FROM) {
  throw new Error("SMTP_HOST, SMTP_PORT and EMAIL_FROM must be set");
}

// One transport for the whole app, like the Prisma client. Locally this
// points at Mailpit; in production, change the SMTP_* vars to a provider's.
const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  // true for port 465 (TLS from the start); false lets 587 upgrade via STARTTLS.
  secure: SMTP_SECURE === "true",
  // Mailpit needs no login, so only send credentials when they're set.
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

export type Email = {
  to: string;
  subject: string;
  html: string;
};

export const sendEmail = async ({ to, subject, html }: Email): Promise<void> => {
  await transport.sendMail({ from: EMAIL_FROM, to, subject, html });
};
