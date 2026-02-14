"use client";

import { useMemo } from "react";

import { ProfileSharedEntriesFeed } from "@/components/profile-shared-entries-feed";
import type { ProfileSharedEntryItem } from "@/lib/profile-shared-entries";

type PublicProfilePanelProps = {
  username: string;
  image: string | null;
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
  username,
  image,
  createdAt,
  timeZone,
  initialSharedEntries,
  initialSharedEntriesNextCursor,
}: PublicProfilePanelProps) {
  const memberSince = useMemo(() => formatMemberSince(createdAt, timeZone), [createdAt, timeZone]);
  const avatarLabel = (username || "anonymous").slice(0, 1).toUpperCase();

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
            </div>
            <div className="bw-ui bw-date">a quiet personal profile</div>
            {memberSince && <div className="bw-ui bw-date">member since {memberSince}</div>}
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
