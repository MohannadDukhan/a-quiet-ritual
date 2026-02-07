import { SignInForm } from "@/components/sign-in-form";

type SignInPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const rawNext = params.next;
  const nextValue = Array.isArray(rawNext) ? rawNext[0] : rawNext;
  const nextPath = nextValue && nextValue.startsWith("/") ? nextValue : "/";

  const rawSent = params.sent;
  const sentValue = Array.isArray(rawSent) ? rawSent[0] : rawSent;
  const sentInitially = sentValue === "1";

  return <SignInForm nextPath={nextPath} sentInitially={sentInitially} />;
}
