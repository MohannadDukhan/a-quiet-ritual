"use client";

import { useEffect, useId, useRef } from "react";

import { TermsContent } from "@/components/terms/terms-content";

type TermsModalProps = {
  open: boolean;
  onClose: () => void;
  onReadToEnd?: () => void;
};

const BOTTOM_THRESHOLD_PX = 12;

function reachedBottom(container: HTMLDivElement) {
  const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
  return remaining <= BOTTOM_THRESHOLD_PX;
}

export function TermsModal({ open, onClose, onReadToEnd }: TermsModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !scrollRef.current || !onReadToEnd) return;
    if (reachedBottom(scrollRef.current)) {
      onReadToEnd();
    }
  }, [open, onReadToEnd]);

  if (!open) return null;

  return (
    <div className="bw-uiModalOverlay" onMouseDown={onClose}>
      <div
        className="bw-uiModal bw-termsModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="bw-uiModalX" aria-label="close terms" onClick={onClose}>
          x
        </button>
        <h2 id={titleId} className="bw-uiModalTitle bw-termsTitleText">
          BLNDWAVE Terms & Conditions
        </h2>
        <p id={descriptionId} className="bw-uiModalBody bw-termsModalLead">
          Read through the full terms below.
        </p>

        <div
          ref={scrollRef}
          className="bw-termsModalScroll"
          onScroll={() => {
            if (!scrollRef.current || !onReadToEnd) return;
            if (reachedBottom(scrollRef.current)) {
              onReadToEnd();
            }
          }}
        >
          <TermsContent />
        </div>

        <div className="bw-uiModalActions">
          <button type="button" className="bw-navbtn bw-navbtn-hover bw-uiModalSecondary" onClick={onClose}>
            close
          </button>
        </div>
      </div>
    </div>
  );
}
