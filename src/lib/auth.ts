import { PrismaAdapter } from "@auth/prisma-adapter";
import { getServerSession, type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";

import { prisma } from "@/lib/db";

const EMAIL_SEND_TIMEOUT_MS = 12000;

type ExtendedAuthOptions = NextAuthOptions & {
  trustHost?: boolean;
  debug?: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendMagicLinkWithResend({
  identifier,
  url,
  provider,
}: {
  identifier: string;
  url: string;
  provider: { from?: string | null };
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const message = "RESEND_API_KEY is not set";
    console.error("[next-auth][email] failed:", message);
    throw new Error(message);
  }

  const from = (provider.from || process.env.EMAIL_FROM || "").trim();
  if (!from) {
    const message = "EMAIL_FROM is not set";
    console.error("[next-auth][email] failed:", message);
    throw new Error(message);
  }

  const host = new URL(url).host;
  const safeHost = escapeHtml(host);
  const safeUrl = escapeHtml(url);
  const resend = new Resend(apiKey);

  const sendPromise = resend.emails.send({
    from,
    to: identifier,
    subject: `Sign in to ${host}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p>Sign in to <strong>${safeHost}</strong>.</p>
        <p><a href="${safeUrl}">continue with email</a></p>
        <p style="font-size:12px;color:#666;">If you did not request this, you can ignore this email.</p>
      </div>
    `,
    text: `Sign in to ${host}\n${url}\n\nIf you did not request this, you can ignore this email.`,
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Resend request timed out")), EMAIL_SEND_TIMEOUT_MS);
  });

  const result = await Promise.race([sendPromise, timeoutPromise]);

  if ("error" in result && result.error) {
    const message = result.error.message || "Resend rejected email send";
    console.error("[next-auth][email] failed:", message);
    throw new Error(message);
  }
}

export const authOptions: ExtendedAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  debug: process.env.NODE_ENV !== "production",
  useSecureCookies: process.env.NODE_ENV === "production",
  session: {
    strategy: "database",
    maxAge: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/sign-in?sent=1",
  },
  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM,
      maxAge: 15 * 60,
      sendVerificationRequest: sendMagicLinkWithResend,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}
