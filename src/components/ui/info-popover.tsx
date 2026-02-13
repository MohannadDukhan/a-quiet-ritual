"use client";

import { ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type InfoPopoverProps = {
  title: string;
  children: ReactNode;
  triggerAriaLabel?: string;
};

type PopoverPosition = {
  top: number;
  left: number;
};

const SIDE_PADDING = 12;
const VERTICAL_OFFSET = 8;
const FALLBACK_WIDTH = 320;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function InfoPopover({ title, children, triggerAriaLabel = "open info" }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition>({ top: 0, left: 0 });
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  function updatePosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const popoverWidth = popoverRef.current?.offsetWidth || FALLBACK_WIDTH;
    const popoverHeight = popoverRef.current?.offsetHeight || 0;

    const left = clamp(triggerRect.left, SIDE_PADDING, window.innerWidth - popoverWidth - SIDE_PADDING);
    let top = triggerRect.bottom + VERTICAL_OFFSET;
    if (popoverHeight && top + popoverHeight > window.innerHeight - SIDE_PADDING) {
      top = Math.max(SIDE_PADDING, triggerRect.top - popoverHeight - VERTICAL_OFFSET);
    }

    setPosition({ top, left });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open]);

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

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onResize = () => updatePosition();
    const onScroll = () => updatePosition();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);

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
          setOpen((value) => !value);
        }}
      >
        ?
      </button>

      {open &&
        createPortal(
          <div
            className="bw-infoFloating"
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
          >
            <div
              ref={popoverRef}
              className="bw-infoCard"
              role="dialog"
              aria-modal="false"
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
          </div>,
          document.body,
        )}
    </>
  );
}
