"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Phase } from "@/lib/types";

/** Moves the session to the next allowed step, then opens that step's page. */
export default function PhaseButton({
  sessionId,
  to,
  children,
}: {
  sessionId: string;
  to: Phase;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, phase: to }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not move to the next step. Try again.");
      }
      router.push(`/session/${sessionId}/${to}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move to the next step. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="form-actions">
      <button type="button" className="btn-primary" onClick={go} disabled={busy}>
        {busy ? "Opening" : children} <span aria-hidden="true">→</span>
      </button>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
