"use client";

import Link from "next/link";
import { useMemo } from "react";

import { InfoPopover } from "@/components/ui/info-popover";
import { formatDate } from "@/lib/time";

export type ArchiveEntry = {
  id: string;
  type: "PROMPT" | "JOURNAL";
  content: string;
  promptText: string;
  isCollective: boolean;
  collectiveRemovedAt: string | null;
  collectiveRemovedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type ArchiveClientProps = {
  entries: ArchiveEntry[];
  timeZone: string;
};

export function ArchiveClient({ entries, timeZone }: ArchiveClientProps) {
  const empty = useMemo(() => entries.length === 0, [entries.length]);
  function previewContent(content: string) {
    const compact = content.replace(/\s+/g, " ").trim();
    if (compact.length <= 120) return compact;
    return `${compact.slice(0, 120).trimEnd()}...`;
  }

  return (
    <>
      <section className="bw-section">
        <h1 className="bw-accountTitle">private archive</h1>
        <p className="bw-ui bw-journalSub">your private writing history lives here. only you can see this archive.</p>
        <hr className="bw-divider" />
      </section>

      {empty ? (
        <div className="bw-hint" style={{ marginTop: 10 }}>
          nothing here yet.
        </div>
      ) : (
        <div className="bw-lineSection bw-rowList">
          {entries.map((entry) => (
            entry.type === "JOURNAL" ? (
              <Link key={entry.id} href={`/journal/${entry.id}`} className="bw-rowItem bw-rowHover">
                <div className="bw-rowMeta">
                  <span className="bw-ui bw-collectiveBadge">regular journal entry</span>
                  <span>{formatDate(entry.createdAt, timeZone)}</span>
                </div>
                <div className="bw-writing bw-rowBody bw-cardPreview">{previewContent(entry.content) || " "}</div>
              </Link>
            ) : (
              <Link key={entry.id} href={`/entry/${entry.id}`} className="bw-rowItem bw-rowHover">
                <div className="bw-rowMeta">
                  <div className="bw-rowMetaLeft">
                    <span>{formatDate(entry.createdAt, timeZone)}</span>
                    {entry.isCollective && <span className="bw-ui bw-collectiveBadge">shared on collective</span>}
                    {entry.collectiveRemovedAt && (
                      <span className="bw-ui bw-removedBadge">
                        removed from collective
                        <InfoPopover
                          title="removed from collective"
                          triggerAriaLabel="why was this removed?"
                        >
                          admins removed this from the collective because it didn&apos;t fit the community rules. it
                          still remains in your private archive.
                        </InfoPopover>
                      </span>
                    )}
                  </div>
                </div>
                <div className="bw-writing bw-cardPrompt">&quot;{entry.promptText}&quot;</div>
                <div className="bw-writing bw-rowBody bw-cardPreview">{previewContent(entry.content) || " "}</div>
              </Link>
            )
          ))}
        </div>
      )}
    </>
  );
}
