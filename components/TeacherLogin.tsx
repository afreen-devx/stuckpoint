"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TeacherLogin() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/teacher/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(data?.error ?? "Could not sign in.");
    setBusy(false);
  }

  return (
    <form className="setup-form" onSubmit={submit}>
      <div>
        <label className="label" htmlFor="pin">
          <span>Teacher PIN</span>
        </label>
        <div className="input-row">
          <input id="pin" className="input" type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="off" />
        </div>
      </div>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={busy || !pin}>
          {busy ? "Checking" : "Open the teacher view"} <span className="arr" aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}
