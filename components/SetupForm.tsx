"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@/lib/types";

const LANGUAGES: { value: Language; label: string; native: string }[] = [
  { value: "en", label: "English", native: "Simple English" },
  { value: "te", label: "Telugu", native: "తెలుగు" },
  { value: "mix", label: "Telugu-English mix", native: "Telugu in English letters" },
];

/** A random anonymous id like S382. Never a name. */
function newStudentId(): string {
  return `S${Math.floor(100 + Math.random() * 900)}`;
}

/** Keep only A to Z and 0 to 9, in capitals, up to the given length. */
function clean(value: string, max: number): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, max);
}

export default function SetupForm({ studyMode }: { studyMode: boolean }) {
  const router = useRouter();
  // Empty on the server, filled in the browser, so both renders match.
  const [studentId, setStudentId] = useState("");
  const [classCode, setClassCode] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setStudentId(newStudentId());
  }, []);

  const idValid = /^[A-Z0-9]{2,8}$/.test(studentId);
  const canStart = idValid && (!studyMode || consent) && !busy;

  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (!canStart) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, classCode: classCode || null, language, consent }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.id) throw new Error(data?.error ?? "Could not start a session. Try again.");
      router.push(`/session/${data.id}/pretest`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a session. Try again.");
      setBusy(false);
    }
  }

  /** Arrow keys move the language choice, like a radio group. */
  function onLanguageKey(event: React.KeyboardEvent) {
    const i = LANGUAGES.findIndex((l) => l.value === language);
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (i + 1) % LANGUAGES.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (i + LANGUAGES.length - 1) % LANGUAGES.length;
    if (next === -1) return;
    event.preventDefault();
    setLanguage(LANGUAGES[next].value);
    const buttons = (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>("[role=radio]");
    buttons[next]?.focus();
  }

  return (
    <form onSubmit={start} noValidate>
      <div className="field">
        <label className="label" htmlFor="student-id">
          Student ID
        </label>
        <div className="input-row">
          <input
            id="student-id"
            className="input"
            value={studentId}
            onChange={(e) => setStudentId(clean(e.target.value, 8))}
            autoComplete="off"
            spellCheck={false}
            maxLength={8}
            aria-describedby="student-id-hint"
            aria-invalid={studentId.length > 0 && !idValid}
          />
          <button type="button" className="btn-ghost" onClick={() => setStudentId(newStudentId())}>
            New
          </button>
        </div>
        <p className="hint" id="student-id-hint">
          Anonymous, 2 to 8 letters or numbers. No names or emails. Keep it if you are in the class study.
        </p>
      </div>

      <div className="field">
        <label className="label" htmlFor="class-code">
          Class code (optional)
        </label>
        <input
          id="class-code"
          className="input"
          value={classCode}
          onChange={(e) => setClassCode(clean(e.target.value, 12))}
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          placeholder="From your teacher, if you have one"
        />
      </div>

      <div className="field">
        <span className="label" id="language-label">
          Tutor language
        </span>
        <div className="lang-grid" role="radiogroup" aria-labelledby="language-label" onKeyDown={onLanguageKey}>
          {LANGUAGES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              className="lang-option"
              aria-checked={language === option.value}
              tabIndex={language === option.value ? 0 : -1}
              onClick={() => setLanguage(option.value)}
            >
              {option.label}
              <span className="lang-native">{option.native}</span>
            </button>
          ))}
        </div>
        <p className="hint">Questions stay in English. The tutor explains in the language you pick.</p>
      </div>

      {studyMode ? (
        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            I am 18 or over and agree to take part in this class study. Only my anonymous ID, answers,
            one-line reasons and timings are recorded. My reasons are sent to an external AI service to
            find misconceptions, so I will not write my name or personal details in them. I can stop at any time.
          </span>
        </label>
      ) : null}

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={!canStart}>
          {busy ? "Starting" : "Start the pre-test"} <span aria-hidden="true">→</span>
        </button>
        <span className="hint">10 questions. Scored against fixed answers, never by the AI.</span>
      </div>
    </form>
  );
}
