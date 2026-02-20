"use client";

import { useMemo, useState } from "react";

import { ProfileSharedEntriesFeed } from "@/components/profile-shared-entries-feed";
import type { ProfileSharedEntryItem } from "@/lib/profile-shared-entries";

type PublicProfilePanelProps = {
  profileUserId: string;
  username: string;
  image: string | null;
  initialCollectiveBanned: boolean;
  canManageCollective: boolean;
  createdAt: string;
  timeZone: string;
  initialSharedEntries: ProfileSharedEntryItem[];
  initialSharedEntriesNextCursor: string | null;
};

function formatMemberSince(createdAt: string, timeZone: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
    timeZone,
  })
    .format(date)
    .toLowerCase();
}

export function PublicProfilePanel({
  profileUserId,
  username,
  image,
  initialCollectiveBanned,
  canManageCollective,
  createdAt,
  timeZone,
  initialSharedEntries,
  initialSharedEntriesNextCursor,
}: PublicProfilePanelProps) {
  const memberSince = useMemo(() => formatMemberSince(createdAt, timeZone), [createdAt, timeZone]);
  const avatarLabel = (username || "anonymous").slice(0, 1).toUpperCase();
  const [collectiveBanned, setCollectiveBanned] = useState(initialCollectiveBanned);
  const [banPending, setBanPending] = useState(false);
  const [banError, setBanError] = useState<string | null>(null);

  async function toggleCollectiveBan() {
    setBanPending(true);
    setBanError(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(profileUserId)}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned: !collectiveBanned }),
      });
      const payload = (await response.json().catch(() => null)) as { collectiveBanned?: boolean; error?: string } | null;
      if (!response.ok || typeof payload?.collectiveBanned !== "boolean") {
        setBanError(payload?.error || "request failed.");
        return;
      }
      setCollectiveBanned(payload.collectiveBanned);
    } catch {
      setBanError("request failed.");
    } finally {
      setBanPending(false);
    }
  }

  return (
    <div className="bw-profileWrap">
      <section className="bw-profileHeader" aria-label="profile header">
        <div className="bw-profileHeaderRow">
          <div className="bw-profileAvatarWrap">
            {image ? (
              // Data URLs are stored in User.image, so plain img avoids next/image remote constraints.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="bw-profileAvatar" src={image} alt={`${username} avatar`} />
            ) : (
              <div className="bw-profileAvatar bw-profileAvatarFallback">
                <span className="bw-ui bw-date">{avatarLabel}</span>
              </div>
            )}
          </div>

          <div className="bw-profileIdentity">
            <div className="bw-profileIdentityTop">
              <h1 className="bw-profileName">@{username}</h1>
              {canManageCollective && (
                <button className="bw-btnGhost" type="button" disabled={banPending} onClick={() => void toggleCollectiveBan()}>
                  {banPending ? "saving..." : collectiveBanned ? "unban from collective" : "ban from collective"}
                </button>
              )}
            </div>
            <div className="bw-ui bw-date">a quiet personal profile</div>
            {memberSince && <div className="bw-ui bw-date">member since {memberSince}</div>}
            {canManageCollective && collectiveBanned && <div className="bw-ui bw-date">currently banned from collective</div>}
            {canManageCollective && banError && <div className="bw-hint">{banError}</div>}
          </div>
        </div>
      </section>

      <section className="bw-profileFeedSection" aria-label="shared entries">
        <div className="bw-ui bw-date" style={{ marginBottom: 10 }}>
          shared entries
        </div>
        <ProfileSharedEntriesFeed
          initialItems={initialSharedEntries}
          initialNextCursor={initialSharedEntriesNextCursor}
          timeZone={timeZone}
          publicUsername={username}
        />
      </section>
    </div>
  );
}
