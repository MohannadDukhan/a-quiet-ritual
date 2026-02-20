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

type ArchiveFilter = "all" | "archive" | "collective" | "journal";
type ArchiveRange = "all" | "7d" | "30d" | "custom";

type ArchiveClientProps = {
  entries: ArchiveEntry[];
  timeZone: string;
  filter: ArchiveFilter;
  range: ArchiveRange;
  customStart: string;
  customEnd: string;
  page: number;
  totalPages: number;
};

function previewContent(content: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  if (compact.length <= 120) return compact;
  return `${compact.slice(0, 120).trimEnd()}...`;
}

function isSameUtcDay(dateIso: string, now: Date = new Date()): boolean {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  );
}

function buildArchiveHref(input: {
  filter: ArchiveFilter;
  range: ArchiveRange;
  customStart?: string;
  customEnd?: string;
  page: number;
}): string {
  const params = new URLSearchParams();
  params.set("filter", input.filter);
  params.set("range", input.range);
  params.set("page", String(Math.max(1, input.page)));

  if (input.range === "custom") {
    if (input.customStart) {
      params.set("start", input.customStart);
    }
    if (input.customEnd) {
      params.set("end", input.customEnd);
    }
  }

  return `/archive?${params.toString()}`;
}

export function ArchiveClient({
  entries,
  timeZone,
  filter,
  range,
  customStart,
  customEnd,
  page,
  totalPages,
}: ArchiveClientProps) {
  const empty = useMemo(() => entries.length === 0, [entries.length]);
  const previousHref =
    page > 1
      ? buildArchiveHref({
          filter,
          range,
          customStart,
          customEnd,
          page: page - 1,
        })
      : null;
  const nextHref =
    page < totalPages
      ? buildArchiveHref({
          filter,
          range,
          customStart,
          customEnd,
          page: page + 1,
        })
      : null;

  return (
    <>
      <section className="bw-section">
        <h1 className="bw-accountTitle">private archive</h1>
        <p className="bw-pageLead">your private writing history lives here. only you can see this archive.</p>
        <hr className="bw-divider" />
      </section>

      <section className="bw-section" aria-label="archive filters">
        <form method="get" className="bw-lineSection" style={{ padding: "12px 0" }}>
          <div className="bw-row" style={{ justifyContent: "flex-start", gap: 8, flexWrap: "wrap" }}>
            <label className="bw-ui bw-date" htmlFor="archive-filter-type">
              type
            </label>
            <select id="archive-filter-type" name="filter" className="bw-input" defaultValue={filter}>
              <option value="all">all</option>
              <option value="archive">archive</option>
              <option value="collective">collective</option>
              <option value="journal">journal</option>
            </select>

            <label className="bw-ui bw-date" htmlFor="archive-filter-range">
              date
            </label>
            <select id="archive-filter-range" name="range" className="bw-input" defaultValue={range}>
              <option value="all">all time</option>
              <option value="7d">last 7 days</option>
              <option value="30d">last 30 days</option>
              <option value="custom">custom range</option>
            </select>

            {range === "custom" && (
              <>
                <input className="bw-input" type="date" name="start" defaultValue={customStart} />
                <input className="bw-input" type="date" name="end" defaultValue={customEnd} />
              </>
            )}

            <input type="hidden" name="page" value="1" />
            <button className="bw-btnGhost" type="submit">
              apply
            </button>
          </div>
        </form>
      </section>

      {empty ? (
        <div className="bw-hint" style={{ marginTop: 10 }}>
          nothing here yet.
        </div>
      ) : (
        <div className="bw-lineSection bw-rowList">
          {entries.map((entry) =>
            entry.type === "JOURNAL" ? (
              <Link
                key={entry.id}
                href={isSameUtcDay(entry.createdAt) ? "/journal" : `/journal/${entry.id}`}
                className="bw-rowItem bw-rowHover"
              >
                <div className="bw-rowMeta">
                  <span className="bw-ui bw-collectiveBadge">regular journal entry</span>
                  <span>{formatDate(entry.createdAt, timeZone)}</span>
                </div>
                <div className="bw-writing bw-rowBody bw-cardPreview">{previewContent(entry.content) || " "}</div>
              </Link>
            ) : (
              <Link key={entry.id} href={`/entries/${entry.id}`} className="bw-rowItem bw-rowHover">
                <div className="bw-rowMeta">
                  <div className="bw-rowMetaLeft bw-badgeGroup">
                    <span>{formatDate(entry.createdAt, timeZone)}</span>
                    {entry.isCollective && <span className="bw-ui bw-collectiveBadge">shared on collective</span>}
                    {entry.collectiveRemovedAt && (
                      <span className="bw-ui bw-removedBadge">
                        removed from collective
                        <InfoPopover title="removed from collective" triggerAriaLabel="why was this removed?">
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
            ),
          )}
        </div>
      )}

      <section className="bw-section" aria-label="archive pagination">
        <div className="bw-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="bw-rowActions" style={{ marginTop: 0 }}>
            {previousHref ? (
              <Link className="bw-btnGhost" href={previousHref}>
                previous
              </Link>
            ) : (
              <span className="bw-btnGhost" style={{ opacity: 0.45 }} aria-disabled="true">
                previous
              </span>
            )}
            {nextHref ? (
              <Link className="bw-btnGhost" href={nextHref}>
                next
              </Link>
            ) : (
              <span className="bw-btnGhost" style={{ opacity: 0.45 }} aria-disabled="true">
                next
              </span>
            )}
          </div>
          <div className="bw-ui bw-date">page {page} of {totalPages}</div>
        </div>
      </section>
    </>
  );
}
