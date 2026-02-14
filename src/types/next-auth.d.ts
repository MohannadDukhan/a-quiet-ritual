import "next-auth";
import "next-auth/jwt";

type AppUserRole = "USER" | "ADMIN";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      email?: string | null;
      role?: AppUserRole;
      username?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppUserRole;
    username?: string | null;
    picture?: string | null;
  }
}
