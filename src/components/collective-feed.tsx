import Link from "next/link";

export type CollectiveFeedEntry = {
  id: string;
  content: string;
  createdAt: string;
};

type CollectiveFeedProps = {
  entries: CollectiveFeedEntry[];
};

const CARD_PREVIEW_LENGTH = 560;

function formatCollectiveTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso)).toLowerCase();
}

function previewContent(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  if (compact.length <= CARD_PREVIEW_LENGTH) {
    return compact;
  }
  return `${compact.slice(0, CARD_PREVIEW_LENGTH).trimEnd()}...`;
}

export function CollectiveFeed({ entries }: CollectiveFeedProps) {
  return (
    <div className="bw-feed">
      {entries.map((entry) => (
        <Link key={entry.id} href={`/collective/${entry.id}`} className="bw-fragment bw-fragmentLink">
          <div className="bw-ui bw-fragMeta">
            <span>{formatCollectiveTime(entry.createdAt)}</span>
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
