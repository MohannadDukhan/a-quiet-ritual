import Link from "next/link";

export default function CollectivePage() {
  return (
    <div className="bw-bg">
      <div className="bw-top">
        <Link className="bw-link" href="/">
          back
        </Link>
        <span className="bw-brand">collective</span>
        <span className="bw-brand" style={{ opacity: 0 }}>
          ghost
        </span>
      </div>

      <main className="bw-archiveStage">
        <div className="bw-archiveHeader">
          <div className="bw-archiveTitle">collective</div>
          <div className="bw-archiveSub">coming soon. still anonymous. still quiet.</div>
        </div>
      </main>
    </div>
  );
}
