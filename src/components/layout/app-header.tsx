import Link from "next/link";
import { Montserrat } from "next/font/google";

import { BwMenu } from "@/components/ui/bw-menu";

type HeaderSection = "archive" | "collective";
type BrandTone = "light" | "dark";

const brandWaveFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

type AppHeaderProps = {
  active?: HeaderSection;
  brandTone?: BrandTone;
};

export function AppHeader({ active, brandTone = "light" }: AppHeaderProps) {
  const brandToneClass = brandTone === "dark" ? "bw-brandDark" : "bw-brandLight";

  return (
    <div className="bw-top bw-navBar">
      <div className="bw-navSide" aria-hidden="true" />

      <Link href="/" className={`bw-navLogoLink bw-brand ${brandToneClass}`} aria-label="blndwave home">
        <span className="bw-brandBlnd">blnd</span>
        <span className={`${brandWaveFont.className} bw-brandWave`}>wave</span>
      </Link>

      <div className="bw-navSide bw-navSideRight">
        <BwMenu active={active} />
      </div>
    </div>
  );
}
