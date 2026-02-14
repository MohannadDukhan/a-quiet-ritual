"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { formatDateTime } from "@/lib/time";

export type CollectiveFeedEntry = {
  id: string;
  content: string;
  createdAt: string;
  username: string | null;
};

type CollectiveFeedProps = {
  entries: CollectiveFeedEntry[];
  timeZone: string;
  canModerate: boolean;
};

type ApiResponse = {
  error?: string;
};

const CARD_PREVIEW_LENGTH = 560;

function previewContent(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  if (compact.length <= CARD_PREVIEW_LENGTH) {
    return compact;
  }
  return `${compact.slice(0, CARD_PREVIEW_LENGTH).trimEnd()}...`;
}

function formatHandle(username: string): string {
  return `@${username.trim().toLowerCase()}`;
}

async function parseApiError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as ApiResponse | null;
  return data?.error || "request failed.";
}

export function CollectiveFeed({ entries, timeZone, canModerate }: CollectiveFeedProps) {
  const searchParams = useSearchParams();
  const [items, setItems] = useState(entries);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(entries);
  }, [entries]);

  useEffect(() => {
    if (searchParams.get("removed") === "1") {
      setNotice("removed from collective.");
      setError(null);
    }
  }, [searchParams]);

  async function handleRemove(entryId: string) {
    if (!window.confirm("remove this entry from collective and delete its replies?")) {
      return;
    }

    const previousItems = items;
    setPendingEntryId(entryId);
    setError(null);
    setNotice(null);
    setItems((prev) => prev.filter((entry) => entry.id !== entryId));

    try {
      const response = await fetch("/api/admin/moderation/entry/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setNotice("removed from collective.");
    } catch (requestError) {
      setItems(previousItems);
      const message = requestError instanceof Error ? requestError.message : "request failed.";
      setError(message);
    } finally {
      setPendingEntryId(null);
    }
  }

  return (
    <section className="bw-section">
      {notice && <div className="bw-hint">{notice}</div>}
      {error && <div className="bw-hint">{error}</div>}

      {items.length === 0 ? (
        <div className="bw-empty">no shared entries yet.</div>
      ) : (
        <div className="bw-lineSection bw-rowList">
          {items.map((entry) => (
            <div key={entry.id} className="bw-rowItem">
              <div className="bw-rowMeta">
                <div className="bw-rowMetaLeft">
                  <span>{formatDateTime(entry.createdAt, timeZone)}</span>
                  <span className="bw-fragDot">-</span>
                  {entry.username ? (
                    <Link className="bw-handleLink" href={`/u/${encodeURIComponent(entry.username)}`}>
                      {formatHandle(entry.username)}
                    </Link>
                  ) : (
                    <span>anonymous</span>
                  )}
                </div>
              </div>

              <Link href={`/collective/${entry.id}`} className="bw-rowLinkBlock bw-rowHover">
                <div className="bw-writing bw-rowBody">{previewContent(entry.content)}</div>
                <div className="bw-rowSubtle">click to view replies or reply</div>
              </Link>

              {canModerate && (
                <div className="bw-rowActions">
                  <button
                    className="bw-btnDanger"
                    type="button"
                    disabled={pendingEntryId !== null}
                    onClick={() => {
                      void handleRemove(entry.id);
                    }}
                  >
                    {pendingEntryId === entry.id ? "removing..." : "admin: delete from collective"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
