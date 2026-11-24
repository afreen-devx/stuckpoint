import Link from "next/link";
import { loadPack } from "@/lib/pack";

/** Logo mark, app name and the topic pack badge. */
export default function Header() {
  const pack = loadPack();

  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="StuckPoint home">
        <svg
          className="brand-mark"
          viewBox="0 0 26 26"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          aria-hidden="true"
        >
          <rect x="1" y="1" width="24" height="24" rx="2" />
          <path d="M13 4.5v17M4.5 13h17" />
          <circle cx="13" cy="13" r="2.4" fill="var(--accent)" stroke="none" />
        </svg>
        <span className="brand-name">StuckPoint</span>
      </Link>
      <span className="badge">{pack.id}</span>
    </header>
  );
}
