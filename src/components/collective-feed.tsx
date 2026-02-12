"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { FormEvent, useMemo, useState } from "react";

export type CollectiveFeedReply = {
  id: string;
  content: string;
  createdAt: string;
};

export type CollectiveFeedEntry = {
  id: string;
  content: string;
  createdAt: string;
  replies: CollectiveFeedReply[];
};

type CollectiveFeedProps = {
  entries: CollectiveFeedEntry[];
};

type ReplyApiResponse = {
  reply?: CollectiveFeedReply;
  error?: string;
};

const MAX_REPLY_LENGTH = 1000;

function formatCollectiveTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso)).toLowerCase();
}

export function CollectiveFeed({ entries }: CollectiveFeedProps) {
  const { status } = useSession();
  const [feedEntries, setFeedEntries] = useState(entries);
  const [openReplyEntryId, setOpenReplyEntryId] = useState<string | null>(null);
  const [activeSignInPromptEntryId, setActiveSignInPromptEntryId] = useState<string | null>(null);
  const [draftByEntryId, setDraftByEntryId] = useState<Record<string, string>>({});
  const [errorByEntryId, setErrorByEntryId] = useState<Record<string, string>>({});
  const [submittingEntryId, setSubmittingEntryId] = useState<string | null>(null);

  const signInHref = useMemo(() => `/sign-in?next=${encodeURIComponent("/collective")}`, []);

  function setEntryError(entryId: string, message: string | null) {
    setErrorByEntryId((prev) => {
      if (!message) {
        if (!(entryId in prev)) return prev;
        const next = { ...prev };
        delete next[entryId];
        return next;
      }
      return { ...prev, [entryId]: message };
    });
  }

  function onReplyAction(entryId: string) {
    setEntryError(entryId, null);
    if (status !== "authenticated") {
      setOpenReplyEntryId(null);
      setActiveSignInPromptEntryId(entryId);
      return;
    }

    setActiveSignInPromptEntryId(null);
    setOpenReplyEntryId((current) => (current === entryId ? null : entryId));
  }

  async function handleSubmitReply(event: FormEvent<HTMLFormElement>, entryId: string) {
    event.preventDefault();
    setActiveSignInPromptEntryId(null);
    setEntryError(entryId, null);

    const draft = (draftByEntryId[entryId] || "").trim();
    if (!draft) {
      setEntryError(entryId, "write a reply first.");
      return;
    }
    if (draft.length > MAX_REPLY_LENGTH) {
      setEntryError(entryId, `reply must be ${MAX_REPLY_LENGTH} characters or less.`);
      return;
    }

    setSubmittingEntryId(entryId);

    try {
      const response = await fetch("/api/collective/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId,
          content: draft,
        }),
      });

      const data = (await response.json().catch(() => null)) as ReplyApiResponse | null;

      if (!response.ok || !data?.reply) {
        if (response.status === 401) {
          setOpenReplyEntryId(null);
          setActiveSignInPromptEntryId(entryId);
          return;
        }
        setEntryError(entryId, data?.error || "could not send reply right now.");
        return;
      }
      const createdReply = data.reply;

      setFeedEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                replies: [...entry.replies, createdReply],
              }
            : entry,
        ),
      );

      setDraftByEntryId((prev) => ({ ...prev, [entryId]: "" }));
      setOpenReplyEntryId(null);
    } catch {
      setEntryError(entryId, "could not send reply right now.");
    } finally {
      setSubmittingEntryId(null);
    }
  }

  return (
    <div className="bw-feed">
      {feedEntries.map((entry) => {
        const isReplyOpen = openReplyEntryId === entry.id;
        const showSignInPrompt = activeSignInPromptEntryId === entry.id;
        const replyError = errorByEntryId[entry.id];
        const draft = draftByEntryId[entry.id] || "";
        const isSubmitting = submittingEntryId === entry.id;

        return (
          <article key={entry.id} className="bw-fragment">
            <div className="bw-fragMeta">
              <span>{formatCollectiveTime(entry.createdAt)}</span>
              <span className="bw-fragDot">-</span>
              <span>anonymous</span>
            </div>

            <div className="bw-fragText">{entry.content}</div>

            <div className="bw-replyActionRow">
              <button
                type="button"
                className="bw-btnGhost bw-replyAction"
                onClick={() => onReplyAction(entry.id)}
              >
                reply
              </button>
            </div>

            {isReplyOpen && (
              <form className="bw-replyForm" onSubmit={(event) => handleSubmitReply(event, entry.id)}>
                <textarea
                  className="bw-replyInput"
                  value={draft}
                  onChange={(event) => {
                    const next = event.target.value;
                    setDraftByEntryId((prev) => ({ ...prev, [entry.id]: next }));
                    setEntryError(entry.id, null);
                  }}
                  placeholder="write a reply."
                  maxLength={MAX_REPLY_LENGTH}
                />
                <div className="bw-replyFormRow">
                  <div className="bw-date">{draft.trim().length}/{MAX_REPLY_LENGTH}</div>
                  <button type="submit" className="bw-btn" disabled={isSubmitting}>
                    {isSubmitting ? "sending..." : "send"}
                  </button>
                </div>
              </form>
            )}

            {showSignInPrompt && (
              <div className="bw-replyHint">
                <Link className="bw-link" href={signInHref}>
                  sign in
                </Link>{" "}
                to reply.
              </div>
            )}

            {replyError && <div className="bw-replyHint">{replyError}</div>}

            {entry.replies.length > 0 && (
              <div className="bw-replyList">
                {entry.replies.map((reply) => (
                  <div key={reply.id} className="bw-replyItem">
                    <div className="bw-replyMeta">
                      <span>anonymous</span>
                      <span className="bw-fragDot">-</span>
                      <span>{formatCollectiveTime(reply.createdAt)}</span>
                    </div>
                    <div className="bw-replyText">{reply.content}</div>
                  </div>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
