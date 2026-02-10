import { BwNavButton } from "@/components/ui/bw-nav-button";
import { VerifyEmailState } from "@/components/verify-email-state";

type VerifyEmailPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await searchParams;
  const rawEmail = params.email;
  const rawToken = params.token;
  const email = (Array.isArray(rawEmail) ? rawEmail[0] : rawEmail) || "";
  const token = (Array.isArray(rawToken) ? rawToken[0] : rawToken) || "";

  if (!email || !token) {
    return (
      <div className="bw-bg">
        <div className="bw-top">
          <BwNavButton href="/sign-in">
            sign in
          </BwNavButton>
          <span className="bw-brand">verify email</span>
          <span className="bw-brand" style={{ opacity: 0 }}>
            ghost
          </span>
        </div>

        <main className="bw-stage">
          <div className="bw-hint">invalid verification link.</div>
        </main>
      </div>
    );
  }

  return <VerifyEmailState email={email} token={token} />;
}
