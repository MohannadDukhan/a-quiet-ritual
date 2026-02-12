"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type HeaderSection = "archive" | "collective";

type BwMenuProps = {
  active?: HeaderSection;
};

function getMenuItemClassName(isActive: boolean): string {
  return isActive ? "bw-navText bw-navDropdownItem is-active" : "bw-navText bw-navDropdownItem";
}

export function BwMenu({ active }: BwMenuProps) {
  const pathname = usePathname();
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const signInHref = `/sign-in?next=${encodeURIComponent(pathname || "/")}`;

  return (
    <div ref={containerRef} className="bw-menuWrap bw-navMenuWrap">
      <button
        ref={triggerRef}
        type="button"
        className="bw-navText bw-navMenuButton"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="open menu"
        onClick={() => setOpen((value) => !value)}
      >
        +menu
      </button>

      {open && (
        <div className="bw-navDropdown" role="menu" aria-label="main menu">
          <Link
            className={getMenuItemClassName(active === "archive")}
            href="/archive"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            archive
          </Link>
          <Link
            className={getMenuItemClassName(active === "collective")}
            href="/collective"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            collective
          </Link>
          <Link className="bw-navText bw-navDropdownItem" href="/journal" role="menuitem" onClick={() => setOpen(false)}>
            regular journal
          </Link>
          <Link className="bw-navText bw-navDropdownItem" href="/about" role="menuitem" onClick={() => setOpen(false)}>
            about
          </Link>
          {status === "authenticated" ? (
            <Link className="bw-navText bw-navDropdownItem" href="/account" role="menuitem" onClick={() => setOpen(false)}>
              my account
            </Link>
          ) : (
            <Link className="bw-navText bw-navDropdownItem" href={signInHref} role="menuitem" onClick={() => setOpen(false)}>
              sign in
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
