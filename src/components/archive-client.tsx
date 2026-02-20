"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

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
  startTs: string;
  endTs: string;
  page: number;
  totalPages: number;
};

type DeleteEntryResponse = {
  ok?: boolean;
  error?: string;
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
  startTs?: string;
  endTs?: string;
  page: number;
}): string {
  const params = new URLSearchParams();
  params.set("filter", input.filter);
  params.set("range", input.range);
  params.set("page", String(Math.max(1, input.page)));
  if (input.startTs) {
    params.set("startTs", input.startTs);
  }
  if (input.endTs) {
    params.set("endTs", input.endTs);
  }

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

async function parseDeleteError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as DeleteEntryResponse | null;
  return data?.error || "could not delete right now.";
}

function parseLocalDateInput(value: string): { year: number; month: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const probe = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function ArchiveClient({
  entries,
  timeZone,
  filter,
  range,
  customStart,
  customEnd,
  startTs,
  endTs,
  page,
  totalPages,
}: ArchiveClientProps) {
  const searchParams = useSearchParams();
  const [items, setItems] = useState(entries);
  const [pendingRange, setPendingRange] = useState<ArchiveRange>(range);
  const [pendingCustomStart, setPendingCustomStart] = useState(customStart);
  const [pendingCustomEnd, setPendingCustomEnd] = useState(customEnd);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const empty = useMemo(() => items.length === 0, [items.length]);

  useEffect(() => {
    setItems(entries);
  }, [entries]);

  useEffect(() => {
    setPendingRange(range);
  }, [range]);

  useEffect(() => {
    setPendingCustomStart(customStart);
    setPendingCustomEnd(customEnd);
  }, [customStart, customEnd]);

  useEffect(() => {
    if (searchParams.get("deleted") === "1") {
      setNotice("entry deleted.");
    }
  }, [searchParams]);

  const previousHref =
    page > 1
      ? buildArchiveHref({
          filter,
          range,
          customStart,
          customEnd,
          startTs,
          endTs,
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
          startTs,
          endTs,
          page: page + 1,
        })
      : null;

  async function handleDeleteEntry(entryId: string) {
    if (!window.confirm("delete this entry permanently? this cannot be undone.")) {
      return;
    }

    setDeleteError(null);
    setDeletingEntryId(entryId);
    try {
      const response = await fetch(`/api/entries/${encodeURIComponent(entryId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setDeleteError(await parseDeleteError(response));
        return;
      }

      setItems((previous) => previous.filter((entry) => entry.id !== entryId));
    } catch {
      setDeleteError("could not delete right now.");
    } finally {
      setDeletingEntryId(null);
    }
  }

  function setDateRangeHiddenInputs(form: HTMLFormElement, nextStartTs: string, nextEndTs: string) {
    const startTsInput = form.elements.namedItem("startTs");
    const endTsInput = form.elements.namedItem("endTs");
    if (startTsInput instanceof HTMLInputElement) {
      startTsInput.value = nextStartTs;
    }
    if (endTsInput instanceof HTMLInputElement) {
      endTsInput.value = nextEndTs;
    }
  }

  function handleApplySubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    if (pendingRange === "all") {
      setDateRangeHiddenInputs(form, "", "");
      return;
    }

    if (pendingRange === "custom") {
      const startParts = parseLocalDateInput(pendingCustomStart);
      const endParts = parseLocalDateInput(pendingCustomEnd);
      if (!startParts || !endParts) {
        setDateRangeHiddenInputs(form, "", "");
        return;
      }

      const startLocal = new Date(startParts.year, startParts.month - 1, startParts.day, 0, 0, 0, 0);
      const endLocalExclusive = new Date(endParts.year, endParts.month - 1, endParts.day + 1, 0, 0, 0, 0);

      if (startLocal.getTime() > endLocalExclusive.getTime()) {
        const swappedStartLocal = new Date(endParts.year, endParts.month - 1, endParts.day, 0, 0, 0, 0);
        const swappedEndLocalExclusive = new Date(startParts.year, startParts.month - 1, startParts.day + 1, 0, 0, 0, 0);
        setDateRangeHiddenInputs(form, swappedStartLocal.toISOString(), swappedEndLocalExclusive.toISOString());
        return;
      }

      setDateRangeHiddenInputs(form, startLocal.toISOString(), endLocalExclusive.toISOString());
      return;
    }

    if (pendingRange === "7d" || pendingRange === "30d") {
      const days = pendingRange === "7d" ? 7 : 30;
      const now = new Date();
      const startLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 0, 0, 0, 0);
      setDateRangeHiddenInputs(form, startLocal.toISOString(), now.toISOString());
    }
  }

  return (
    <>
      <section className="bw-section">
        <h1 className="bw-accountTitle">private archive</h1>
        <p className="bw-pageLead">your private writing history lives here. only you can see this archive.</p>
        <hr className="bw-divider" />
      </section>

      <section className="bw-section" aria-label="archive filters">
        <form method="get" className="bw-lineSection" style={{ padding: "12px 0" }} onSubmit={handleApplySubmit}>
          <div className="bw-row" style={{ justifyContent: "flex-start", gap: 8, flexWrap: "wrap" }}>
            <label className="bw-ui bw-date" htmlFor="archive-filter-type">
              type
            </label>
            <select id="archive-filter-type" name="filter" className="bw-input bw-selectInput" defaultValue={filter}>
              <option value="all">all</option>
              <option value="archive">archive</option>
              <option value="collective">collective</option>
              <option value="journal">journal</option>
            </select>

            <label className="bw-ui bw-date" htmlFor="archive-filter-range">
              date
            </label>
            <select
              id="archive-filter-range"
              name="range"
              className="bw-input bw-selectInput"
              value={pendingRange}
              onChange={(event) => {
                setPendingRange(event.target.value as ArchiveRange);
              }}
            >
              <option value="all">all time</option>
              <option value="7d">last 7 days</option>
              <option value="30d">last 30 days</option>
              <option value="custom">custom range</option>
            </select>

            {pendingRange === "custom" && (
              <>
                <input
                  className="bw-input"
                  type="date"
                  name="start"
                  value={pendingCustomStart}
                  onChange={(event) => setPendingCustomStart(event.target.value)}
                />
                <input
                  className="bw-input"
                  type="date"
                  name="end"
                  value={pendingCustomEnd}
                  onChange={(event) => setPendingCustomEnd(event.target.value)}
                />
              </>
            )}

            <input type="hidden" name="startTs" defaultValue={startTs} />
            <input type="hidden" name="endTs" defaultValue={endTs} />
            <input type="hidden" name="page" value="1" />
            <button className="bw-btnGhost" type="submit">
              apply
            </button>
          </div>
        </form>
      </section>

      {notice && <div className="bw-hint">{notice}</div>}
      {deleteError && <div className="bw-hint">{deleteError}</div>}

      {empty ? (
        <div className="bw-hint" style={{ marginTop: 10 }}>
          nothing here yet.
        </div>
      ) : (
        <div className="bw-lineSection bw-rowList">
          {items.map((entry) =>
            entry.type === "JOURNAL" ? (
              <div key={entry.id} className="bw-rowItem bw-rowHover">
                <Link href={isSameUtcDay(entry.createdAt) ? "/journal" : `/journal/${entry.id}`} className="bw-rowLinkBlock">
                  <div className="bw-rowMeta">
                    <span className="bw-ui bw-collectiveBadge">regular journal entry</span>
                    <span>{formatDate(entry.createdAt, timeZone)}</span>
                  </div>
                  <div className="bw-writing bw-rowBody bw-cardPreview">{previewContent(entry.content) || " "}</div>
                </Link>
                <div className="bw-rowActions">
                  <button
                    className="bw-rowDeleteAction bw-btnGhost"
                    type="button"
                    disabled={deletingEntryId !== null}
                    onClick={() => {
                      void handleDeleteEntry(entry.id);
                    }}
                  >
                    {deletingEntryId === entry.id ? "deleting..." : "delete"}
                  </button>
                </div>
              </div>
            ) : (
              <div key={entry.id} className="bw-rowItem bw-rowHover">
                <Link href={`/entries/${entry.id}`} className="bw-rowLinkBlock">
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
                <div className="bw-rowActions">
                  <button
                    className="bw-rowDeleteAction bw-btnGhost"
                    type="button"
                    disabled={deletingEntryId !== null}
                    onClick={() => {
                      void handleDeleteEntry(entry.id);
                    }}
                  >
                    {deletingEntryId === entry.id ? "deleting..." : "delete"}
                  </button>
                </div>
              </div>
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
