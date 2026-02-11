"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export function BwMenu() {
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

  async function handleSignOut() {
    setOpen(false);
    await signOut({ callbackUrl: "/" });
  }

  return (
    <div ref={containerRef} className="bw-menuWrap">
      <button
        ref={triggerRef}
        type="button"
        className="bw-navbtn bw-navbtn-hover bw-menuTrigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="open menu"
        onClick={() => setOpen((value) => !value)}
      >
        menu
      </button>

      {open && (
        <div className="bw-menuPanel" role="menu" aria-label="main menu">
          <Link className="bw-menuItem" href="/journal" role="menuitem" onClick={() => setOpen(false)}>
            regular journal
          </Link>
          <Link className="bw-menuItem" href="/about" role="menuitem" onClick={() => setOpen(false)}>
            about
          </Link>
          {status === "authenticated" ? (
            <button type="button" className="bw-menuItem bw-menuAction" role="menuitem" onClick={handleSignOut}>
              sign out
            </button>
          ) : (
            <Link className="bw-menuItem" href={signInHref} role="menuitem" onClick={() => setOpen(false)}>
              sign in
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
