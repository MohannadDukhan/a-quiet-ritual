import Link from "next/link";

import { BwMenu } from "@/components/ui/bw-menu";

type HeaderSection = "archive" | "collective";
type BrandTone = "light" | "dark";

type AppHeaderProps = {
  active?: HeaderSection;
  brandTone?: BrandTone;
};

export function AppHeader({ active, brandTone = "light" }: AppHeaderProps) {
  const brandToneClass = brandTone === "dark" ? "bw-brandDark" : "bw-brandLight";

  return (
    <div className="bw-top bw-navBar">
      <div className="bw-navSide" aria-hidden="true" />

      <Link href="/" className={`bw-navLogoLink bw-wordmark ${brandToneClass}`} aria-label="BLNDWAVE home">
        BLNDWAVE
      </Link>

      <div className="bw-navSide bw-navSideRight">
        <BwMenu active={active} />
      </div>
    </div>
  );
}
