import { TERMS_TEXT } from "@/content/terms";

type TermsContentProps = {
  className?: string;
};

export function TermsContent({ className }: TermsContentProps) {
  const resolvedClassName = className ? `bw-termsText ${className}` : "bw-termsText";

  return <pre className={resolvedClassName}>{TERMS_TEXT}</pre>;
}
