"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { FormEvent, useMemo, useState } from "react";

export type CollectiveReplyItem = {
  id: string;
  content: string;
  createdAt: string;
};

type CollectiveRepliesPanelProps = {
  entryId: string;
  initialReplies: CollectiveReplyItem[];
  signInNextPath: string;
  canReply: boolean;
};

type ReplyApiResponse = {
  reply?: CollectiveReplyItem;
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

export function CollectiveRepliesPanel({
  entryId,
  initialReplies,
  signInNextPath,
  canReply,
}: CollectiveRepliesPanelProps) {
  const { status } = useSession();
  const [replies, setReplies] = useState(initialReplies);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const signInHref = useMemo(
    () => `/sign-in?next=${encodeURIComponent(signInNextPath)}`,
    [signInNextPath],
  );

  async function handleSubmitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmed = draft.trim();
    if (!trimmed) {
      setError("write a reply first.");
      return;
    }
    if (trimmed.length > MAX_REPLY_LENGTH) {
      setError(`reply must be ${MAX_REPLY_LENGTH} characters or less.`);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/collective/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId,
          content: trimmed,
        }),
      });
      const data = (await response.json().catch(() => null)) as ReplyApiResponse | null;

      if (!response.ok || !data?.reply) {
        if (response.status === 401) {
          setError("sign in to reply.");
          return;
        }
        setError(data?.error || "could not send reply right now.");
        return;
      }
      const createdReply = data.reply;

      setReplies((prev) => [...prev, createdReply]);
      setDraft("");
    } catch {
      setError("could not send reply right now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bw-repliesBlock">
      <div className="bw-date">replies</div>

      {replies.length === 0 ? (
        <div className="bw-replyHint">no replies yet.</div>
      ) : (
        <div className="bw-replyList">
          {replies.map((reply) => (
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

      {canReply ? (
        status === "authenticated" ? (
          <form className="bw-replyForm" onSubmit={handleSubmitReply}>
            <textarea
              className="bw-replyInput"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              placeholder="write a reply."
              maxLength={MAX_REPLY_LENGTH}
            />
            <div className="bw-replyFormRow">
              <div className="bw-date">{draft.trim().length}/{MAX_REPLY_LENGTH}</div>
              <button type="submit" className="bw-btn" disabled={submitting}>
                {submitting ? "sending..." : "send reply"}
              </button>
            </div>
          </form>
        ) : (
          <div className="bw-replyHint">
            <Link className="bw-link" href={signInHref}>
              sign in
            </Link>{" "}
            to reply.
          </div>
        )
      ) : (
        <div className="bw-replyHint">new replies are only open for today&rsquo;s collective entries.</div>
      )}

      {error && <div className="bw-replyHint">{error}</div>}
    </section>
  );
}
