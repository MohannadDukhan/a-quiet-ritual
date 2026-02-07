import Link from "next/link";

import { ResetPasswordForm } from "@/components/reset-password-form";

type ResetPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const rawEmail = params.email;
  const rawToken = params.token;
  const email = (Array.isArray(rawEmail) ? rawEmail[0] : rawEmail) || "";
  const token = (Array.isArray(rawToken) ? rawToken[0] : rawToken) || "";

  if (!email || !token) {
    return (
      <div className="bw-bg">
        <div className="bw-top">
          <Link className="bw-link" href="/sign-in">
            sign in
          </Link>
          <span className="bw-brand">reset password</span>
          <span className="bw-brand" style={{ opacity: 0 }}>
            ghost
          </span>
        </div>

        <main className="bw-stage">
          <div className="bw-hint">invalid reset link.</div>
        </main>
      </div>
    );
  }

  return <ResetPasswordForm email={email} token={token} />;
}
