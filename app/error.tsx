"use client";

/** Shown when something breaks on the server, for example an invalid topic pack. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="shell setup-shell">
      <div className="panel">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="page-title">StuckPoint hit an error</h1>
        <p className="lede">The details are below. If it mentions the topic pack, fix packs/KIN-01.json and reload.</p>
        <pre className="fatal">{error.message}</pre>
        <div className="form-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn-primary" onClick={reset}>
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
