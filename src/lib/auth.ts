import bcrypt from "bcrypt";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

import { consumeMemoryRateLimit } from "@/lib/memory-rate-limit";
import { ensurePrimaryAdminUserByUserId, isOwnerEmail } from "@/lib/admin-role";
import { prisma } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function getIpFromAuthorizeRequest(req: unknown): string {
  const headers = (req as { headers?: Record<string, string | undefined> } | undefined)?.headers;
  if (!headers) return "unknown";

  const forwardedFor = headers["x-forwarded-for"] || headers["X-Forwarded-For"];
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headers["x-real-ip"] || headers["X-Real-IP"];
  if (realIp) return realIp;

  return "unknown";
}

type ExtendedAuthOptions = NextAuthOptions & {
  trustHost?: boolean;
  debug?: boolean;
};

export const authOptions: ExtendedAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  debug: process.env.NODE_ENV !== "production",
  useSecureCookies: process.env.NODE_ENV === "production",
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          throw new Error("INVALID_CREDENTIALS");
        }

        const email = parsed.data.email.trim().toLowerCase();
        const password = parsed.data.password;
        const ip = getIpFromAuthorizeRequest(req);

        const ipLimit = consumeMemoryRateLimit({
          namespace: "credentials-ip",
          key: ip,
          limit: 20,
          windowMs: 15 * 60 * 1000,
        });
        if (!ipLimit.ok) {
          throw new Error("TOO_MANY_ATTEMPTS");
        }

        const emailLimit = consumeMemoryRateLimit({
          namespace: "credentials-email-ip",
          key: `${email}:${ip}`,
          limit: 8,
          windowMs: 15 * 60 * 1000,
        });
        if (!emailLimit.ok) {
          throw new Error("TOO_MANY_ATTEMPTS");
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            emailVerified: true,
          },
        });

        if (!user?.passwordHash) {
          throw new Error("INVALID_CREDENTIALS");
        }

        if (!user.emailVerified) {
          throw new Error("VERIFY_EMAIL_FIRST");
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
          throw new Error("INVALID_CREDENTIALS");
        }

        return {
          id: user.id,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (typeof user?.email === "string" && user.email.length > 0) {
        token.email = user.email.trim().toLowerCase();
      }

      const userId = user?.id || token.sub;
      if (!userId) {
        token.isOwner = isOwnerEmail(typeof token.email === "string" ? token.email : null);
        return token;
      }

      token.sub = userId;
      const sessionUser = await ensurePrimaryAdminUserByUserId(userId);
      if (sessionUser) {
        token.role = sessionUser.role;
        token.username = sessionUser.username;
        token.email = sessionUser.email;
      }

      token.isOwner = isOwnerEmail(typeof token.email === "string" ? token.email : null);
      if (process.env.NODE_ENV !== "production") {
        console.debug("[auth][owner]", { userId, isOwner: token.isOwner === true });
      }

      // Ensure legacy large avatar payloads are never persisted in JWT cookies.
      delete (token as { picture?: unknown }).picture;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (token.role === "ADMIN" || token.role === "USER") {
          session.user.role = token.role;
        }
        if (typeof token.username === "string" || token.username === null) {
          session.user.username = token.username ?? null;
        }
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
        session.user.isOwner = token.isOwner === true;
      }
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}
