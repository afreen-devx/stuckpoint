import Link from "next/link";
import Panel from "@/components/Panel";

export default function NotFound() {
  return (
    <main className="shell">
      <Panel>
        <p className="eyebrow">404</p>
        <h1 className="page-title">This page or session does not exist</h1>
        <p className="lede">Check the link, or start a new session from the setup page.</p>
        <Link className="btn-primary" href="/">
          Go to setup
        </Link>
      </Panel>
    </main>
  );
}
