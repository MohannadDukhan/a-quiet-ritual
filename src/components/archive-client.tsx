"use client";

import Link from "next/link";
import { useMemo } from "react";

import { formatDate } from "@/lib/time";

export type ArchiveEntry = {
  id: string;
  type: "PROMPT" | "JOURNAL";
  content: string;
  promptText: string;
  isCollective: boolean;
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
      <div className="bw-row" style={{ marginBottom: 14 }}>
        <div className="bw-ui bw-date">private archive</div>
      </div>

      {empty ? (
        <div className="bw-hint" style={{ marginTop: 10 }}>
          nothing here yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {entries.map((entry) => (
            entry.type === "JOURNAL" ? (
              <Link key={entry.id} href={`/journal/${entry.id}`} className="bw-card bw-cardLink">
                <div className="bw-cardMeta">
                  <span className="bw-ui bw-collectiveBadge">regular journal entry</span>
                  <div className="bw-ui bw-cardDate">{formatDate(entry.createdAt, timeZone)}</div>
                </div>
                <div className="bw-writing bw-cardText bw-cardPreview">{previewContent(entry.content) || " "}</div>
              </Link>
            ) : (
              <Link key={entry.id} href={`/entry/${entry.id}`} className="bw-card bw-cardLink">
                <div className="bw-cardMeta">
                  <div className="bw-ui bw-cardDate">{formatDate(entry.createdAt, timeZone)}</div>
                  {entry.isCollective && <span className="bw-ui bw-collectiveBadge">shared on collective</span>}
                </div>
                <div className="bw-writing bw-cardPrompt">&quot;{entry.promptText}&quot;</div>
                <div className="bw-writing bw-cardText bw-cardPreview">{previewContent(entry.content) || " "}</div>
              </Link>
            )
          ))}
        </div>
      )}
    </>
  );
}
