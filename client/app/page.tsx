import Link from "next/link";
import SiteHeader from "@/components/site-header";

const snapshots = [
  { color: "snapshot--peach", initials: "A", label: "you", tilt: "snapshot--left" },
  { color: "snapshot--sage", initials: "B", label: "your person", tilt: "snapshot--right" },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero page-shell">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> A little closer, wherever you are</p>
            <h1>Make a memory.<br /><span>Keep it together.</span></h1>
            <p className="hero-description">A tiny photobooth for two. Hop in from different places, count down together, and leave with a photo strip worth keeping.</p>
            <div className="hero-actions">
              <Link className="button button--primary" href="/create">Start a photobooth <span aria-hidden="true">↗</span></Link>
              <Link className="button button--quiet" href="/join">Join with a room code</Link>
            </div>
            <div className="hero-note"><span className="avatar-stack" aria-hidden="true"><i>A</i><i>B</i></span><span>Made for your favorite person.</span></div>
          </div>

          <div className="booth-art" aria-label="Illustration of two portraits in a shared photo booth">
            <div className="art-spark art-spark--one">✳</div>
            <div className="art-spark art-spark--two">✦</div>
            <div className="booth-window">
              <div className="booth-window-top"><span className="booth-light" /> <span>THE LITTLE BOOTH</span><span className="booth-counter">01 / 04</span></div>
              <div className="portrait-pair">
                {snapshots.map((snapshot) => (
                  <div className={`snapshot ${snapshot.color} ${snapshot.tilt}`} key={snapshot.label}>
                    <div className="portrait-face"><span className="portrait-hair" /><span className="portrait-eyes">•　•</span><span className="portrait-smile">⌣</span><span className="portrait-blush" /></div>
                    <span className="snapshot-caption">{snapshot.initials} + you</span>
                  </div>
                ))}
              </div>
              <div className="booth-countdown"><span /> <span /> <span /></div>
              <div className="booth-caption">same silly faces, different places</div>
            </div>
            <div className="art-sticker"><span>✿</span> forever<br />in the making</div>
            <div className="art-tape" />
          </div>
        </section>

        <section className="how-it-works page-shell" aria-labelledby="how-title">
          <div className="section-heading"><p className="eyebrow">Good things happen in threes</p><h2 id="how-title">Your next favorite photo is three steps away.</h2></div>
          <div className="steps-grid">
            <article className="step-card"><span className="step-number">01</span><span className="step-icon step-icon--invite" aria-hidden="true">↗</span><h3>Make a room</h3><p>Start a booth and send your person a link. No planning, no pressure.</p></article>
            <article className="step-card"><span className="step-number">02</span><span className="step-icon step-icon--camera" aria-hidden="true">◉</span><h3>Get camera-ready</h3><p>Find your light, pick your pose, and get ready for the countdown.</p></article>
            <article className="step-card"><span className="step-number">03</span><span className="step-icon step-icon--print" aria-hidden="true">▤</span><h3>Keep the strip</h3><p>Snap a set of portraits and save your little piece of together.</p></article>
          </div>
        </section>

        <section className="closing-banner page-shell"><div><p className="eyebrow">Your booth is waiting</p><h2>One link. Two smiles. A very good memory.</h2></div><Link className="button button--light" href="/create">Make your first room <span aria-hidden="true">↗</span></Link></section>
      </main>
      <footer className="site-footer page-shell"><span>© 2026 The Little Booth</span><span>Made with a little extra love <b aria-hidden="true">♥</b></span></footer>
    </>
  );
}
