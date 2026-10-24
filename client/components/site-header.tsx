import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="site-header page-shell">
      <Link className="brand" href="/" aria-label="The Little Booth home">
        <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>
        <span className="brand-name">the little booth<span className="brand-period">.</span></span>
      </Link>
      <nav className="main-nav" aria-label="Main navigation">
        <Link href="/create">Create a room</Link>
        <Link href="/join">Join a room</Link>
      </nav>
      <Link className="header-cta" href="/create">Let’s take a photo <span aria-hidden="true">↗</span></Link>
    </header>
  );
}
