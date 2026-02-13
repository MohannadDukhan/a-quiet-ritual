import Link from "next/link";

import { formatDateTime } from "@/lib/time";

export type CollectiveFeedEntry = {
  id: string;
  content: string;
  createdAt: string;
};

type CollectiveFeedProps = {
  entries: CollectiveFeedEntry[];
  timeZone: string;
};

const CARD_PREVIEW_LENGTH = 560;

function previewContent(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  if (compact.length <= CARD_PREVIEW_LENGTH) {
    return compact;
  }
  return `${compact.slice(0, CARD_PREVIEW_LENGTH).trimEnd()}...`;
}

export function CollectiveFeed({ entries, timeZone }: CollectiveFeedProps) {
  return (
    <div className="bw-feed">
      {entries.map((entry) => (
        <Link key={entry.id} href={`/collective/${entry.id}`} className="bw-fragment bw-fragmentLink">
          <div className="bw-ui bw-fragMeta">
            <span>{formatDateTime(entry.createdAt, timeZone)}</span>
            <span className="bw-fragDot">-</span>
            <span>anonymous</span>
          </div>
          <div className="bw-writing bw-fragText">{previewContent(entry.content)}</div>
          <div className="bw-ui bw-fragHint">click to view replies or reply</div>
        </Link>
      ))}
    </div>
  );
}
