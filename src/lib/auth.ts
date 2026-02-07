import { PrismaAdapter } from "@auth/prisma-adapter";
import { getServerSession, type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";

import { prisma } from "@/lib/db";

const smtpPort = Number(process.env.EMAIL_SERVER_PORT ?? "587");

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
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
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number.isNaN(smtpPort) ? 587 : smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
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
