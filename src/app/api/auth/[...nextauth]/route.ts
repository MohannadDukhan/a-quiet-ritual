import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth";

const globalForAuthDebug = globalThis as unknown as {
  __bwAuthEnvLogged?: boolean;
};

if (process.env.NODE_ENV !== "production" && !globalForAuthDebug.__bwAuthEnvLogged) {
  globalForAuthDebug.__bwAuthEnvLogged = true;
  console.info("[auth-env]", {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
    AUTH_URL: process.env.AUTH_URL ?? null,
  });
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
