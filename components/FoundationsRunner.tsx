"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TutorTrack, { type TrackHeader } from "./TutorTrack";

type Concept = {
  id: string;
  name: string;
  explain: string;
  example: string;
  check: { stem: string; options: string[]; answer: number; why: string };
};

const LETTERS = ["A", "B", "C", "D"];

/**
 * The foundations review for students who scored 3 or less. The content is written and checked
 * by the team, not by the AI: one idea at a time, a worked example, and a quick check question.
 */
export default function FoundationsRunner({
  sessionId,
  header,
  foundations,
}: {
  sessionId: string;
  header: TrackHeader;
  foundations: { title: string; intro: string; concepts: Concept[] };
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<(number | null)[]>(foundations.concepts.map(() => null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const concept = foundations.concepts[index];
  const choice = picked[index];
  const last = index === foundations.concepts.length - 1;

  async function finish() {
    setBusy(true);
    setError("");
    const right = foundations.concepts.filter((c, i) => picked[i] === c.check.answer).length;
    try {
      const res = await fetch("/api/tutor/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code: "F", action: "done", note: `${right} of ${foundations.concepts.length} checks right` }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not move on. Try again.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move on. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="tutor">
      <div className="tutor-main">
        <TutorTrack header={header} />
        <h1 className="page-title tutor-title">{foundations.title}</h1>
        {index === 0 ? <p className="lede">{foundations.intro}</p> : null}

        <section className="found" key={concept.id}>
          <p className="dx-flag found-step">
            {concept.id} · {index + 1} of {foundations.concepts.length}
          </p>
          <h2 className="dx-name">{concept.name}</h2>
          <p className="found-explain">{concept.explain}</p>
          <p className="found-example">
            <span className="who">Example</span>
            {concept.example}
          </p>

          <p className="check-stem">{concept.check.stem}</p>
          <div className="options check-options" role="radiogroup" aria-label="Quick check" data-answered={choice !== null}>
            {concept.check.options.map((o, oi) => (
              <button
                key={oi}
                type="button"
                role="radio"
                className="option"
                aria-checked={choice === oi}
                data-mark={choice === null ? undefined : oi === concept.check.answer ? "right" : choice === oi ? "wrong" : undefined}
                disabled={choice !== null}
                onClick={() => setPicked((p) => p.map((v, i) => (i === index ? oi : v)))}
              >
                <span className="option-letter" aria-hidden="true">
                  {LETTERS[oi]}
                </span>
                <span className="option-text">{o}</span>
                <span className="option-indicator" aria-hidden="true" />
              </button>
            ))}
          </div>
          {choice !== null ? (
            <p className={choice === concept.check.answer ? "check-why is-good" : "check-why is-bad"}>
              {choice === concept.check.answer ? "Right. " : "Not quite. "}
              {concept.check.why}
            </p>
          ) : null}
        </section>

        {error ? (
          <p className="error-text tutor-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="tutor-actions">
          {last ? (
            <button type="button" className="btn-primary" disabled={choice === null || busy} onClick={() => void finish()}>
              {busy ? "Opening" : "On to your misconceptions"} <span className="arr" aria-hidden="true">→</span>
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={choice === null} onClick={() => setIndex(index + 1)}>
              Next idea <span className="arr" aria-hidden="true">→</span>
            </button>
          )}
          {index > 0 ? (
            <button type="button" className="btn-quiet" onClick={() => setIndex(index - 1)}>
              <span className="back-arrow" aria-hidden="true">
                ←
              </span>{" "}
              Back
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
