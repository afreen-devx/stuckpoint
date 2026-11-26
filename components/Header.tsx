import Link from "next/link";
import { loadPack } from "@/lib/pack";
import Stepper from "./Stepper";

/** Top bar: logo, topic pack badge, and the step track while a session is open. */
export default function Header() {
  const pack = loadPack();

  return (
    <header className="site-header">
      <div className="site-header-in">
        <Link href="/" className="brand" aria-label="StuckPoint home">
          <svg className="brand-mark" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <rect x="1" y="1" width="24" height="24" rx="2" />
            <path d="M13 5v16M5 13h16" strokeOpacity="0.45" />
            <circle cx="13" cy="13" r="2.6" fill="currentColor" stroke="none" />
          </svg>
          <span className="brand-name">StuckPoint</span>
        </Link>
        <span className="badge">{pack.id}</span>
        <Stepper />
      </div>
    </header>
  );
}
