"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatDateTime } from "@/lib/time";
import type { ProfileSharedEntryItem } from "@/lib/profile-shared-entries";

type ProfileSharedEntriesFeedProps = {
  initialItems: ProfileSharedEntryItem[];
  initialNextCursor: string | null;
  timeZone: string;
  publicUsername?: string | null;
};

type SharedEntriesResponse = {
  items?: ProfileSharedEntryItem[];
  nextCursor?: string | null;
  error?: string;
};

const PAGE_LIMIT = 10;
const PREVIEW_LENGTH = 180;

function previewText(value: string, maxLength: number = PREVIEW_LENGTH): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength).trimEnd()}...`;
}

function getLoadMoreUrl(nextCursor: string, publicUsername?: string | null): string {
  const params = new URLSearchParams({
    cursor: nextCursor,
    limit: String(PAGE_LIMIT),
  });
  if (publicUsername) {
    params.set("username", publicUsername);
    return `/api/profile/public/shared-entries?${params.toString()}`;
  }
  return `/api/profile/shared-entries?${params.toString()}`;
}

export function ProfileSharedEntriesFeed({
  initialItems,
  initialNextCursor,
  timeZone,
  publicUsername,
}: ProfileSharedEntriesFeedProps) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const itemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setLoadError(null);
    try {
      const response = await fetch(getLoadMoreUrl(nextCursor, publicUsername), {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as SharedEntriesResponse | null;
      if (!response.ok || !data?.items) {
        setLoadError(data?.error || "could not load more entries.");
        return;
      }

      setItems((previous) => [
        ...previous,
        ...data.items!.filter((item) => !itemIds.has(item.id)),
      ]);
      setNextCursor(data.nextCursor ?? null);
    } catch {
      setLoadError("could not load more entries.");
    } finally {
      setLoadingMore(false);
    }
  }, [itemIds, loadingMore, nextCursor, publicUsername]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextCursor) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          void loadMore();
        }
      },
      {
        rootMargin: "220px 0px",
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, nextCursor]);

  if (items.length === 0) {
    return <div className="bw-hint">no shared entries yet.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 0 }}>
      {items.map((entry) => (
        <Link key={entry.id} href={`/collective/${entry.id}`} className="bw-profileFeedRow">
          <div className="bw-profileFeedMeta">
            <span>{formatDateTime(entry.createdAt, timeZone)}</span>
            <span className="bw-collectiveBadge bw-profileFeedBadge">shared</span>
          </div>
          <div className="bw-writing bw-profileFeedText">{previewText(entry.content)}</div>
        </Link>
      ))}

      {loadingMore && <div className="bw-hint bw-profileFeedHint">loading...</div>}
      {loadError && <div className="bw-hint bw-profileFeedHint">{loadError}</div>}
      {!loadingMore && !nextCursor && <div className="bw-hint bw-profileFeedHint">end</div>}

      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
    </div>
  );
}
