import { BwNavButton } from "@/components/ui/bw-nav-button";

export default function AboutPage() {
  return (
    <div className="bw-bg">
      <div className="bw-top">
        <BwNavButton href="/">
          back
        </BwNavButton>
        <span className="bw-brand">about</span>
        <div className="bw-navwrap">
          <BwNavButton href="/archive">
            archive
          </BwNavButton>
          <BwNavButton href="/collective">
            collective
          </BwNavButton>
          <BwNavButton href="/about" active>
            about
          </BwNavButton>
        </div>
      </div>

      <main className="bw-aboutWrap">
        <h1 className="bw-aboutTitle">about</h1>

        <section className="bw-aboutSection">
          <p className="bw-aboutText">
            a quiet ritual is a minimalist journaling space. it&rsquo;s meant to feel like a calm daily ritual, not a
            productivity app.
          </p>
        </section>

        <section className="bw-aboutSection">
          <p className="bw-aboutText">
            this is a small experiment built by blndwave and @mvrinara (instagram). the idea was pitched as something
            soft and human, and the project became a small collaboration built for the love of journaling and
            reflection.
          </p>
        </section>

        <section className="bw-aboutSection">
          <p className="bw-aboutText">
            the collective is an optional shared page for today&rsquo;s prompt. if you choose to share, your response
            appears there anonymously. your private archive still stays yours.
          </p>
        </section>

        <section className="bw-aboutSection">
          <p className="bw-aboutText">
            we have zero tolerance for hate, threats, or harassment. we&rsquo;re trying to build a respectful, loving
            space. content that violates this isn&rsquo;t welcome.
          </p>
        </section>

        <p className="bw-aboutThanks">thanks for being here.</p>
      </main>
    </div>
  );
}
