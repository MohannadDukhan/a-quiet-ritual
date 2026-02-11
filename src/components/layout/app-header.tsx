import { BwMenu } from "@/components/ui/bw-menu";
import { BwNavButton } from "@/components/ui/bw-nav-button";

type HeaderSection = "home" | "archive" | "collective";

type AppHeaderProps = {
  active?: HeaderSection;
};

export function AppHeader({ active }: AppHeaderProps) {
  return (
    <div className="bw-top">
      <BwNavButton href="/" active={active === "home"} breathe={active !== "home"}>
        home
      </BwNavButton>

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
