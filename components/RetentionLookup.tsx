"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** For students coming back days later: find their session by student ID and open the retention test. */
export default function RetentionLookup() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function find(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions?studentId=${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.id) throw new Error(data?.error ?? "Could not find that session.");
      router.push(`/session/${data.id}/${data.phase}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find that session.");
      setBusy(false);
    }
  }

  return (
    <form className="return" onSubmit={find}>
      <label className="label" htmlFor="return-id">
        <span>Back for the retention test?</span>
        <span className="label-aside">use the same student ID</span>
      </label>
      <div className="input-row">
        <input
          id="return-id"
          className="input is-small"
          value={id}
          onChange={(e) => setId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
          placeholder="Your student ID, for example S382"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="btn-ghost" disabled={busy || id.length < 2}>
          {busy ? "Finding" : "Find"}
        </button>
      </div>
      {error ? (
        <p className="error-text" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
