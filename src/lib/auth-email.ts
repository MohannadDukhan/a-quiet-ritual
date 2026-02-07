import { Resend } from "resend";

const EMAIL_SEND_TIMEOUT_MS = 12000;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  return new Resend(apiKey);
}

function getFromAddress() {
  const from = (process.env.EMAIL_FROM || "").trim();
  if (!from) {
    throw new Error("EMAIL_FROM is not set");
  }
  return from;
}

export function getAuthBaseUrl() {
  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (!baseUrl) {
    throw new Error("AUTH_URL or NEXTAUTH_URL must be set");
  }
  return baseUrl.replace(/\/+$/, "");
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const resend = getResendClient();
  const from = getFromAddress();

  const sendPromise = resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Resend request timed out")), EMAIL_SEND_TIMEOUT_MS);
  });

  const result = await Promise.race([sendPromise, timeoutPromise]);
  if ("error" in result && result.error) {
    throw new Error(result.error.message || "Resend rejected email send");
  }
}

export async function sendEmailVerificationEmail(input: {
  to: string;
  verificationUrl: string;
}) {
  const host = new URL(input.verificationUrl).host;
  const safeHost = escapeHtml(host);
  const safeUrl = escapeHtml(input.verificationUrl);

  await sendTransactionalEmail({
    to: input.to,
    subject: `Verify your email for ${host}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p>Verify your email for <strong>${safeHost}</strong>.</p>
        <p><a href="${safeUrl}">verify email</a></p>
        <p style="font-size:12px;color:#666;">This link expires in 1 hour.</p>
      </div>
    `,
    text: `Verify your email for ${host}\n${input.verificationUrl}\n\nThis link expires in 1 hour.`,
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
}) {
  const host = new URL(input.resetUrl).host;
  const safeHost = escapeHtml(host);
  const safeUrl = escapeHtml(input.resetUrl);

  await sendTransactionalEmail({
    to: input.to,
    subject: `Reset your password for ${host}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p>Reset your password for <strong>${safeHost}</strong>.</p>
        <p><a href="${safeUrl}">reset password</a></p>
        <p style="font-size:12px;color:#666;">This link expires in 1 hour.</p>
      </div>
    `,
    text: `Reset your password for ${host}\n${input.resetUrl}\n\nThis link expires in 1 hour.`,
  });
}
