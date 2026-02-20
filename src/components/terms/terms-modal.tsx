"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { TermsContent } from "@/components/terms/terms-content";

type TermsModalProps = {
  open: boolean;
  onClose: () => void;
  onAgree?: () => void;
  agreeing?: boolean;
};

const BOTTOM_THRESHOLD_PX = 12;

function reachedBottom(container: HTMLDivElement) {
  const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
  return remaining <= BOTTOM_THRESHOLD_PX;
}

export function TermsModal({ open, onClose, onAgree, agreeing = false }: TermsModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canAgree, setCanAgree] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!agreeing) {
          onClose();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [agreeing, open, onClose]);

  const setScrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;
    if (!node) {
      return;
    }
    node.scrollTop = 0;
    setCanAgree(reachedBottom(node));
  }, []);

  if (!open) return null;

  return (
    <div className="bw-uiModalOverlay" onMouseDown={() => !agreeing && onClose()}>
      <div
        className="bw-uiModal bw-termsModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="bw-uiModalX"
          aria-label="close terms"
          onClick={onClose}
          disabled={agreeing}
        >
          x
        </button>
        <h2 id={titleId} className="bw-uiModalTitle bw-termsTitleText">
          BLNDWAVE Terms & Conditions
        </h2>
        <p id={descriptionId} className="bw-uiModalBody bw-termsModalLead">
          Read through the full terms below.
        </p>

        <div
          ref={setScrollContainerRef}
          className="bw-termsModalScroll"
          onScroll={() => {
            if (!scrollRef.current) return;
            if (reachedBottom(scrollRef.current)) {
              setCanAgree(true);
            }
          }}
        >
          <TermsContent />
        </div>

        {!canAgree && <div className="bw-hint">scroll to the bottom to enable</div>}
        <div className="bw-uiModalActions">
          <button
            type="button"
            className="bw-navbtn bw-navbtn-hover bw-uiModalSecondary"
            onClick={onClose}
            disabled={agreeing}
          >
            cancel
          </button>
          <button
            type="button"
            className="bw-navbtn bw-navbtn-hover bw-uiModalPrimary"
            onClick={onAgree}
            disabled={!canAgree || agreeing || !onAgree}
          >
            {agreeing ? "creating..." : "i agree"}
          </button>
        </div>
      </div>
    </div>
  );
}
