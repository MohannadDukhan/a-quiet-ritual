"use client";

import Link from "next/link";
import { useMemo } from "react";

export type ArchiveEntry = {
  id: string;
  type: "PROMPT" | "JOURNAL";
  content: string;
  promptText: string;
  isCollective: boolean;
  createdAt: string;
  updatedAt: string;
};

function formatNice(iso: string) {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

type ArchiveClientProps = {
  entries: ArchiveEntry[];
};

export function ArchiveClient({ entries }: ArchiveClientProps) {
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
                  <div className="bw-ui bw-cardDate">{formatNice(entry.createdAt)}</div>
                </div>
                <div className="bw-writing bw-cardText bw-cardPreview">{previewContent(entry.content) || " "}</div>
              </Link>
            ) : (
              <Link key={entry.id} href={`/entry/${entry.id}`} className="bw-card bw-cardLink">
                <div className="bw-cardMeta">
                  <div className="bw-ui bw-cardDate">{formatNice(entry.createdAt)}</div>
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
