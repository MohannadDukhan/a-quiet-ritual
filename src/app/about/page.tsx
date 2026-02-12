import { AppHeader } from "@/components/layout/app-header";

export default function AboutPage() {
  return (
    <div className="bw-bg">
      <AppHeader />

      <main className="bw-aboutWrap">
        <h1 className="bw-writing bw-aboutTitle">about</h1>

        <section className="bw-aboutSection">
          <p className="bw-writing bw-aboutText">
            a quiet ritual is a minimalist journaling space. it&rsquo;s meant to feel like a calm daily ritual, not a
            productivity app.
          </p>
          <p className="bw-writing bw-aboutText">
            no streaks. no scores. no pressure. just a daily prompt, a place to write, and an archive that stays
            simple.
          </p>
        </section>

        <section className="bw-aboutSection">
          <p className="bw-writing bw-aboutText">
            this is a small experiment built by blndwave and @mvrinara (instagram). the idea was pitched as something
            soft and human, and the project became a small collaboration built for the love of journaling and
            reflection.
          </p>
        </section>

        <section className="bw-aboutSection">
          <p className="bw-writing bw-aboutText">
            the collective is an optional shared page for today&rsquo;s prompt. if you choose to share, your response
            appears there anonymously. your private archive still stays yours.
          </p>
        </section>

        <section className="bw-aboutSection">
          <p className="bw-writing bw-aboutText">
            we have zero tolerance for hate, threats, or harassment. we&rsquo;re trying to build a respectful, loving
            space. content that violates this isn&rsquo;t welcome.
          </p>
        </section>

        <p className="bw-writing bw-aboutThanks">thanks for being here.</p>
      </main>
    </div>
  );
}
