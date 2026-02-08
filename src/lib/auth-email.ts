import { Resend } from "resend";

const EMAIL_SEND_TIMEOUT_MS = 12000;
const RESEND_WRAPPER_ID = "src/lib/auth-email.ts:sendTransactionalEmail";

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

function maskEmailAddress(email: string): string {
  const value = email.trim().toLowerCase();
  const atIndex = value.indexOf("@");
  if (atIndex <= 0 || atIndex === value.length - 1) {
    return "***";
  }

  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);
  const visibleLocal = local.slice(0, 2);
  return `${visibleLocal}***@${domain}`;
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

  console.info("[TEMP DEBUG][auth-email] resend send attempt", {
    wrapper: RESEND_WRAPPER_ID,
    resendClient: "resend npm package (Resend.emails.send over HTTP API)",
    resendApiKeyPresent: Boolean(process.env.RESEND_API_KEY),
    envEmailFrom: process.env.EMAIL_FROM ?? null,
    from,
    toMasked: maskEmailAddress(input.to),
  });

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
    console.error("[TEMP DEBUG][auth-email] resend transport error", {
      wrapper: RESEND_WRAPPER_ID,
      from,
      toMasked: maskEmailAddress(input.to),
      resendApiKeyPresent: Boolean(process.env.RESEND_API_KEY),
      message,
    });
    if (error instanceof TransactionalEmailError) {
      throw error;
    }
    throw new TransactionalEmailError(message);
  }

  if ("error" in result && result.error) {
    console.error("[TEMP DEBUG][auth-email] resend provider rejection", {
      wrapper: RESEND_WRAPPER_ID,
      from,
      toMasked: maskEmailAddress(input.to),
      statusCode: result.error.statusCode ?? null,
      providerCode: result.error.name ?? null,
      message: result.error.message || "Resend rejected email send",
    });
    throw new TransactionalEmailError(result.error.message || "Resend rejected email send", {
      statusCode: result.error.statusCode ?? null,
      providerCode: result.error.name ?? null,
    });
  }

  console.info("[TEMP DEBUG][auth-email] resend send success", {
    wrapper: RESEND_WRAPPER_ID,
    from,
    toMasked: maskEmailAddress(input.to),
    emailId: "data" in result && result.data ? result.data.id : null,
  });
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
