"use client";

import { ReactNode, useEffect, useId, useRef } from "react";

type BwModalProps = {
  open: boolean;
  title: string;
  description: string;
  primaryLabel: string;
  onPrimary: () => void;
  onClose: () => void;
  children?: ReactNode;
};

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function BwModal({
  open,
  title,
  description,
  primaryLabel,
  onPrimary,
  onClose,
  children,
}: BwModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    primaryRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      if (!dialogRef.current) return;

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="bw-uiModalOverlay" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="bw-uiModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="bw-uiModalX" aria-label="close" onClick={onClose}>
          x
        </button>
        <h2 id={titleId} className="bw-uiModalTitle">
          {title}
        </h2>
        <p id={descriptionId} className="bw-uiModalBody">
          {description}
        </p>
        {children}
        <div className="bw-uiModalActions">
          <button type="button" className="bw-navbtn bw-navbtn-hover bw-uiModalSecondary" onClick={onClose}>
            close
          </button>
          <button
            ref={primaryRef}
            type="button"
            className="bw-navbtn bw-navbtn-hover bw-uiModalPrimary"
            onClick={onPrimary}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
