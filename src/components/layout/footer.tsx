import Link from "next/link";

export function Footer() {
  return (
    <footer className="bw-footer">
      <Link href="/terms" className="bw-footerLink">
        terms & conditions
      </Link>
    </footer>
  );
}
