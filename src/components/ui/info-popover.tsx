"use client";

import { ReactNode, useEffect, useId, useRef, useState } from "react";

type InfoPopoverProps = {
  title: string;
  children: ReactNode;
  triggerAriaLabel?: string;
};

export function InfoPopover({ title, children, triggerAriaLabel = "open info" }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const triggerElement = triggerRef.current;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (restoreFocusRef.current) {
        restoreFocusRef.current.focus();
      } else {
        triggerElement?.focus();
      }
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="bw-infoTrigger"
        aria-label={triggerAriaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        ?
      </button>

      {open && (
        <div className="bw-infoOverlay" onMouseDown={() => setOpen(false)}>
          <div
            className="bw-infoCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="bw-infoTop">
              <h2 id={titleId} className="bw-infoTitle">
                {title}
              </h2>
              <button
                ref={closeRef}
                type="button"
                className="bw-infoClose"
                aria-label="close"
                onClick={() => setOpen(false)}
              >
                close
              </button>
            </div>
            <p className="bw-infoBody">{children}</p>
          </div>
        </div>
      )}
    </>
  );
}
