import { Resend } from "resend";

const EMAIL_SEND_TIMEOUT_MS = 12000;

export class TransactionalEmailError extends Error {
  readonly statusCode: number | null;
  readonly providerCode: string | null;

  constructor(
    message: string,
    options?: {
      statusCode?: number | null;
      providerCode?: string | null;
    },
  ) {
    super(message);
    this.name = "TransactionalEmailError";
    this.statusCode = options?.statusCode ?? null;
    this.providerCode = options?.providerCode ?? null;
  }
}

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
  const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
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
    setTimeout(
      () =>
        reject(
          new TransactionalEmailError("Resend request timed out", {
            providerCode: "timeout",
          }),
        ),
      EMAIL_SEND_TIMEOUT_MS,
    );
  });

  let result: Awaited<typeof sendPromise>;
  try {
    result = await Promise.race([sendPromise, timeoutPromise]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resend request failed";
    if (error instanceof TransactionalEmailError) {
      throw error;
    }
    throw new TransactionalEmailError(message);
  }

  if ("error" in result && result.error) {
    throw new TransactionalEmailError(result.error.message || "Resend rejected email send", {
      statusCode: result.error.statusCode ?? null,
      providerCode: result.error.name ?? null,
    });
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
