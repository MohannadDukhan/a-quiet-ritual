import Image from "next/image";
import Link from "next/link";

import { BwMenu } from "@/components/ui/bw-menu";
import { BwNavButton } from "@/components/ui/bw-nav-button";

type HeaderSection = "archive" | "collective";

type AppHeaderProps = {
  active?: HeaderSection;
  showLogo?: boolean;
};

export function AppHeader({ active, showLogo = false }: AppHeaderProps) {
  return (
    <div className="bw-top">
      {showLogo ? (
        <Link href="/" className="bw-logoLink" aria-label="a quiet ritual">
          <Image
            src="/logo.png"
            alt="a quiet ritual"
            width={568}
            height={185}
            className="bw-logo"
            sizes="(max-width: 640px) 118px, 144px"
            priority
          />
        </Link>
      ) : (
        <BwNavButton href="/">
          home
        </BwNavButton>
      )}

      <div className="bw-navwrap">
        <BwNavButton href="/archive" active={active === "archive"}>
          archive
        </BwNavButton>
        <BwNavButton href="/collective" active={active === "collective"}>
          collective
        </BwNavButton>
        <BwMenu />
      </div>
    </div>
  );
}
