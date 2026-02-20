import { TermsContent } from "@/components/terms/terms-content";
import { AppHeader } from "@/components/layout/app-header";

export default function TermsPage() {
  return (
    <div className="bw-bg">
      <AppHeader />

      <main className="bw-page">
        <section className="bw-section">
          <h1 className="bw-termsPageTitle">BLNDWAVE Terms & Conditions</h1>
          <p className="bw-termsPageLead">
            The full policy text below is shared verbatim.
          </p>
          <div className="bw-termsPanel">
            <TermsContent />
          </div>
        </section>
      </main>
    </div>
  );
}
