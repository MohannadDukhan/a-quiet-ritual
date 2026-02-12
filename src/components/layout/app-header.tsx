import Image from "next/image";
import Link from "next/link";

import { BwMenu } from "@/components/ui/bw-menu";

type HeaderSection = "archive" | "collective";

type AppHeaderProps = {
  active?: HeaderSection;
};

export function AppHeader({ active }: AppHeaderProps) {
  return (
    <div className="bw-top bw-navBar">
      <div className="bw-navSide" aria-hidden="true" />

      <Link href="/" className="bw-logoLink bw-navLogoLink" aria-label="a quiet ritual">
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

      <div className="bw-navSide bw-navSideRight">
        <BwMenu active={active} />
      </div>
    </div>
  );
}
