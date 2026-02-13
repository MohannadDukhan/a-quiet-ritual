"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatDateTime } from "@/lib/time";
import type { AdminModerationTodayData } from "@/lib/admin-moderation";
import type { ResolvedPromptDay } from "@/lib/prompt-service";

type AdminModerationPanelProps = {
  initialData: AdminModerationTodayData;
  initialPromptDays: ResolvedPromptDay[];
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

function formatPromptDateLabel(dateId: string): string {
  const date = new Date(`${dateId}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return dateId;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(date)
    .toLowerCase();
}

export function AdminModerationPanel({ initialData, initialPromptDays, timeZone }: AdminModerationPanelProps) {
  const [data, setData] = useState(initialData);
  const [promptDays, setPromptDays] = useState(initialPromptDays);
  const [editingPromptDate, setEditingPromptDate] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
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

  async function refreshPromptDays() {
    const response = await fetch("/api/admin/prompts/upcoming", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }
    const payload = (await response.json().catch(() => null)) as { days?: ResolvedPromptDay[] } | null;
    if (!payload?.days) {
      throw new Error("request failed.");
    }
    setPromptDays(payload.days);
    const firstDay = payload.days[0];
    if (firstDay) {
      setData((prev) => ({
        ...prev,
        prompt: {
          ...prev.prompt,
          text: firstDay.promptText,
        },
      }));
    }
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

  async function savePrompt(date: string, promptText: string) {
    const response = await fetch("/api/admin/prompts/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, promptText }),
    });
    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }

    const payload = (await response.json().catch(() => null)) as { day?: ResolvedPromptDay } | null;
    if (!payload?.day) {
      throw new Error("request failed.");
    }
    const updatedDay = payload.day;

    setPromptDays((prev) => prev.map((day) => (day.date === updatedDay.date ? updatedDay : day)));
    setData((prev) => {
      const todayDate = promptDays[0]?.date;
      if (!todayDate || updatedDay.date !== todayDate) {
        return prev;
      }
      return {
        ...prev,
        prompt: {
          ...prev.prompt,
          text: updatedDay.promptText,
        },
      };
    });
  }

  async function handleRemoveEntry(entryId: string) {
    if (!window.confirm("remove this entry from collective and delete its replies?")) {
      return;
    }

    const previousData = data;
    setPendingAction(`remove-entry:${entryId}`);
    setError(null);
    setNotice(null);
    setData((prev) => ({
      ...prev,
      entries: prev.entries.filter((entry) => entry.id !== entryId),
    }));

    try {
      await postJson("/api/admin/moderation/entry/remove", { entryId });
      setNotice("entry removed from collective.");
    } catch (requestError) {
      setData(previousData);
      const message = requestError instanceof Error ? requestError.message : "request failed.";
      setError(message);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRemoveReply(replyId: string) {
    if (!window.confirm("remove this reply?")) {
      return;
    }

    const previousData = data;
    setPendingAction(`remove-reply:${replyId}`);
    setError(null);
    setNotice(null);
    setData((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) => ({
        ...entry,
        replies: entry.replies.filter((reply) => reply.id !== replyId),
      })),
    }));

    try {
      await postJson("/api/admin/moderation/reply/remove", { replyId });
      setNotice("reply removed.");
    } catch (requestError) {
      setData(previousData);
      const message = requestError instanceof Error ? requestError.message : "request failed.";
      setError(message);
    } finally {
      setPendingAction(null);
    }
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

  function beginEditPrompt(day: ResolvedPromptDay) {
    setEditingPromptDate(day.date);
    setPromptDraft(day.promptText);
    setError(null);
    setNotice(null);
  }

  function cancelEditPrompt() {
    setEditingPromptDate(null);
    setPromptDraft("");
    setError(null);
  }

  async function handleSavePrompt(date: string) {
    const trimmed = promptDraft.trim();
    if (!trimmed) {
      setError("prompt text cannot be empty.");
      return;
    }

    setPendingAction(`save-prompt:${date}`);
    setError(null);
    setNotice(null);

    try {
      await savePrompt(date, trimmed);
      setEditingPromptDate(null);
      setPromptDraft("");
      setNotice("prompt updated.");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "request failed.";
      setError(message);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleResetPrompt(date: string) {
    if (!window.confirm("reset this date to the default prompt rotation?")) {
      return;
    }

    setPendingAction(`reset-prompt:${date}`);
    setError(null);
    setNotice(null);

    try {
      await savePrompt(date, "");
      if (editingPromptDate === date) {
        setEditingPromptDate(null);
        setPromptDraft("");
      }
      setNotice("prompt reset to default.");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "request failed.";
      setError(message);
    } finally {
      setPendingAction(null);
    }
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
                      className="bw-btnDanger"
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
        <div className="bw-row" style={{ marginBottom: 12 }}>
          <div className="bw-ui bw-date">prompts (today + next 7)</div>
          <button
            className="bw-btnGhost"
            type="button"
            disabled={pendingAction !== null}
            onClick={() => {
              void runAction(
                "refresh-prompts",
                async () => {
                  await refreshPromptDays();
                },
                "prompts refreshed.",
              );
            }}
          >
            refresh
          </button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {promptDays.map((day, index) => {
            const isEditing = editingPromptDate === day.date;
            const isSaving = pendingAction === `save-prompt:${day.date}` || pendingAction === `reset-prompt:${day.date}`;
            return (
              <div key={day.date} className="bw-fragment">
                <div className="bw-ui bw-fragMeta">
                  <span>{formatPromptDateLabel(day.date)}</span>
                  {index === 0 && <span className="bw-collectiveBadge">today</span>}
                  {day.overridden && <span className="bw-collectiveBadge">overridden</span>}
                </div>

                {isEditing ? (
                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                    <textarea
                      className="bw-writing bw-replyInput"
                      value={promptDraft}
                      onChange={(event) => setPromptDraft(event.target.value)}
                      maxLength={1000}
                    />
                    <div className="bw-row" style={{ justifyContent: "flex-start", gap: 8, flexWrap: "wrap" }}>
                      <button
                        className="bw-btn"
                        type="button"
                        disabled={pendingAction !== null}
                        onClick={() => {
                          void handleSavePrompt(day.date);
                        }}
                      >
                        {isSaving ? "saving..." : "save"}
                      </button>
                      <button className="bw-btnGhost" type="button" disabled={pendingAction !== null} onClick={cancelEditPrompt}>
                        cancel
                      </button>
                      {day.overridden && (
                        <button
                          className="bw-btnGhost"
                          type="button"
                          disabled={pendingAction !== null}
                          onClick={() => {
                            void handleResetPrompt(day.date);
                          }}
                        >
                          reset to default
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bw-writing bw-fragText">{day.promptText}</div>
                    <div className="bw-row" style={{ marginTop: 8, justifyContent: "flex-start", gap: 8, flexWrap: "wrap" }}>
                      <button
                        className="bw-btnGhost"
                        type="button"
                        disabled={pendingAction !== null}
                        onClick={() => beginEditPrompt(day)}
                      >
                        edit
                      </button>
                      {day.overridden && (
                        <button
                          className="bw-btnGhost"
                          type="button"
                          disabled={pendingAction !== null}
                          onClick={() => {
                            void handleResetPrompt(day.date);
                          }}
                        >
                          reset to default
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
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
