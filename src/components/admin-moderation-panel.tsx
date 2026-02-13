"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatDateTime } from "@/lib/time";
import type { AdminModerationTodayData } from "@/lib/admin-moderation";

type AdminModerationPanelProps = {
  initialData: AdminModerationTodayData;
  timeZone: string;
};

type ApiResponse = {
  error?: string;
};

const PREVIEW_LENGTH = 140;

function previewText(value: string, maxLength: number = PREVIEW_LENGTH): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength).trimEnd()}...`;
}

async function parseApiError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as ApiResponse | null;
  return data?.error || "request failed.";
}

export function AdminModerationPanel({ initialData, timeZone }: AdminModerationPanelProps) {
  const [data, setData] = useState(initialData);
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const bannedUserIds = useMemo(
    () => new Set(data.bannedUsers.map((user) => user.id)),
    [data.bannedUsers],
  );

  async function refreshModerationData() {
    const response = await fetch("/api/admin/moderation/today", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }
    const nextData = (await response.json()) as AdminModerationTodayData;
    setData(nextData);
  }

  async function runAction(actionKey: string, request: () => Promise<void>, successNotice: string) {
    setPendingAction(actionKey);
    setError(null);
    setNotice(null);

    try {
      await request();
      await refreshModerationData();
      setNotice(successNotice);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "request failed.";
      setError(message);
    } finally {
      setPendingAction(null);
    }
  }

  async function postJson(url: string, payload: Record<string, string>) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }
  }

  async function handleRemoveEntry(entryId: string) {
    if (!window.confirm("remove this entry from collective and delete its replies?")) {
      return;
    }

    await runAction(
      `remove-entry:${entryId}`,
      async () => {
        await postJson("/api/admin/moderation/entry/remove", { entryId });
      },
      "entry removed from collective.",
    );
  }

  async function handleRemoveReply(replyId: string) {
    if (!window.confirm("remove this reply?")) {
      return;
    }

    await runAction(
      `remove-reply:${replyId}`,
      async () => {
        await postJson("/api/admin/moderation/reply/remove", { replyId });
      },
      "reply removed.",
    );
  }

  async function handleBanUser(userId: string, email: string | null) {
    if (!window.confirm(`ban ${email || "this user"} from collective posting?`)) {
      return;
    }

    await runAction(
      `ban-user:${userId}`,
      async () => {
        await postJson("/api/admin/moderation/user/ban", { userId });
      },
      "user banned from collective.",
    );
  }

  async function handleUnbanUser(userId: string, email: string | null) {
    await runAction(
      `unban-user:${userId}`,
      async () => {
        await postJson("/api/admin/moderation/user/unban", { userId });
      },
      `${email || "user"} unbanned.`,
    );
  }

  function toggleReplies(entryId: string) {
    setExpandedEntries((prev) => ({
      ...prev,
      [entryId]: !prev[entryId],
    }));
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="bw-card">
        <h1 className="bw-accountTitle">admin</h1>
        <div className="bw-ui bw-date">today&apos;s prompt: {data.prompt.text}</div>
      </div>

      <section className="bw-card">
        <div className="bw-row" style={{ marginBottom: 12 }}>
          <div className="bw-ui bw-date">today&apos;s collective</div>
          <button
            className="bw-btnGhost"
            type="button"
            disabled={pendingAction !== null}
            onClick={() => {
              void runAction(
                "refresh",
                async () => {
                  await refreshModerationData();
                },
                "moderation data refreshed.",
              );
            }}
          >
            refresh
          </button>
        </div>

        {data.entries.length === 0 ? (
          <div className="bw-hint">no collective entries for today.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {data.entries.map((entry) => {
              const authorBanned = bannedUserIds.has(entry.userId);
              const showReplies = Boolean(expandedEntries[entry.id]);
              const repliesLabel = showReplies ? "hide replies" : `show replies (${entry.replies.length})`;

              return (
                <div key={entry.id} className="bw-fragment">
                  <div className="bw-ui bw-fragMeta">
                    <span>{formatDateTime(entry.createdAt, timeZone)}</span>
                    <span className="bw-fragDot">-</span>
                    <span>{entry.userEmail}</span>
                  </div>
                  <div className="bw-writing bw-fragText">{previewText(entry.content)}</div>
                  <div className="bw-row" style={{ marginTop: 8, gap: 8, justifyContent: "flex-start", flexWrap: "wrap" }}>
                    <Link className="bw-btnGhost" href={`/collective/${entry.id}`}>
                      open
                    </Link>
                    <button
                      className="bw-btnGhost"
                      type="button"
                      disabled={pendingAction !== null}
                      onClick={() => {
                        void (authorBanned
                          ? handleUnbanUser(entry.userId, entry.userEmail)
                          : handleBanUser(entry.userId, entry.userEmail));
                      }}
                    >
                      {authorBanned ? "unban user" : "ban user"}
                    </button>
                    <button
                      className="bw-btn"
                      type="button"
                      disabled={pendingAction !== null}
                      onClick={() => {
                        void handleRemoveEntry(entry.id);
                      }}
                    >
                      remove from collective
                    </button>
                    {entry.replies.length > 0 && (
                      <button
                        className="bw-btnGhost"
                        type="button"
                        disabled={pendingAction !== null}
                        onClick={() => toggleReplies(entry.id)}
                      >
                        {repliesLabel}
                      </button>
                    )}
                  </div>

                  {showReplies && entry.replies.length > 0 && (
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {entry.replies.map((reply) => {
                        const replyUserId = reply.userId;
                        const replyUserBanned = replyUserId ? bannedUserIds.has(replyUserId) : false;
                        return (
                          <div key={reply.id} className="bw-replyItem">
                            <div className="bw-ui bw-replyMeta">
                              <span>{formatDateTime(reply.createdAt, timeZone)}</span>
                              <span className="bw-fragDot">-</span>
                              <span>{reply.userEmail || "deleted user"}</span>
                            </div>
                            <div className="bw-writing bw-replyText">{previewText(reply.content)}</div>
                            <div className="bw-row" style={{ marginTop: 8, gap: 8, justifyContent: "flex-start", flexWrap: "wrap" }}>
                              {replyUserId && (
                                <button
                                  className="bw-btnGhost"
                                  type="button"
                                  disabled={pendingAction !== null}
                                  onClick={() => {
                                    void (replyUserBanned
                                      ? handleUnbanUser(replyUserId, reply.userEmail)
                                      : handleBanUser(replyUserId, reply.userEmail));
                                  }}
                                >
                                  {replyUserBanned ? "unban user" : "ban user"}
                                </button>
                              )}
                              <button
                                className="bw-btnGhost"
                                type="button"
                                disabled={pendingAction !== null}
                                onClick={() => {
                                  void handleRemoveReply(reply.id);
                                }}
                              >
                                remove reply
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="bw-card">
        <div className="bw-ui bw-date" style={{ marginBottom: 12 }}>banned users</div>
        {data.bannedUsers.length === 0 ? (
          <div className="bw-hint">no banned users.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {data.bannedUsers.map((user) => (
              <div key={user.id} className="bw-accountRow">
                <span className="bw-accountValue">{user.email}</span>
                <button
                  className="bw-btnGhost"
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() => {
                    void handleUnbanUser(user.id, user.email);
                  }}
                >
                  unban
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {notice && <div className="bw-hint">{notice}</div>}
      {error && <div className="bw-hint">{error}</div>}
    </div>
  );
}
