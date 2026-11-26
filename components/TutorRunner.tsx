"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MotionLab from "./MotionLab";
import TutorTrack, { type TrackHeader } from "./TutorTrack";

const ERROR_MARK = "\u0000ERROR:";
const READY_TOKEN = "[READY]";
const LETTERS = ["A", "B", "C", "D"];

type Turn = { role: "student" | "tutor"; text: string; ready: boolean };
type CheckQuestion = { stem: string; options: string[] };
type CheckResult = {
  correct: boolean[];
  answers: number[];
  why: string[];
  explainPass: boolean;
  feedback: string;
  mastered: boolean;
};

type Props = {
  sessionId: string;
  header: TrackHeader;
  code: string;
  name: string;
  belief: string;
  evidence: { label: string; chose: string; reason: string }[];
  initialTurns: Turn[];
  aiReady: boolean;
  lab: string | null;
};

/**
 * One misconception, tutored Socratically. The tutor's replies stream in as they are written.
 * When the tutor marks the student ready (or the student asks), a mastery check follows:
 * up to two fresh questions plus an explanation in the student's own words.
 */
export default function TutorRunner(props: Props) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>(props.initialTurns);
  const [live, setLive] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"chat" | "loading-check" | "check" | "result">("chat");
  const [questions, setQuestions] = useState<CheckQuestion[]>([]);
  const [explainPrompt, setExplainPrompt] = useState("");
  const [choices, setChoices] = useState<(number | null)[]>([]);
  const [explanation, setExplanation] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  /** True when the last reply failed after the student's message was saved, so a retry sends nothing new. */
  const [canRetry, setCanRetry] = useState(false);
  const opened = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const streaming = live !== null;
  const studentTurns = turns.filter((t) => t.role === "student").length;
  const ready = turns.some((t) => t.ready);

  async function send(message: string | null) {
    if (streaming || busy) return;
    setError("");
    setCanRetry(false);
    if (message) setTurns((t) => [...t, { role: "student", text: message, ready: false }]);
    setDraft("");
    setLive("");
    let text = "";
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: props.sessionId, code: props.code, message: message ?? undefined }),
      });
      if (!res.ok || !res.body) {
        // Rejected before anything was saved: give the message back so it can be sent again.
        const data = await res.json().catch(() => null);
        if (message) {
          setTurns((t) => t.slice(0, -1));
          setDraft(message);
        }
        throw new Error(data?.error ?? "The tutor could not answer. Try again.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (value) {
          text += decoder.decode(value, { stream: true });
          setLive(text.split(READY_TOKEN).join(""));
        }
        if (done) break;
      }
      const mark = text.indexOf(ERROR_MARK);
      if (mark !== -1) {
        // The message was saved; only the reply failed.
        setCanRetry(true);
        throw new Error(text.slice(mark + ERROR_MARK.length) || "The tutor stopped. Try again.");
      }
      const isReady = text.includes(READY_TOKEN);
      setTurns((t) => [...t, { role: "tutor", text: text.split(READY_TOKEN).join("").trim(), ready: isReady }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The tutor could not answer. Try again.");
      if (turns.length === 0 && !message) setCanRetry(true);
    } finally {
      setLive(null);
    }
  }

  // The tutor opens the conversation the first time this idea is shown.
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (props.aiReady && props.initialTurns.length === 0) void send(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns.length, live, mode]);

  async function action(kind: "done" | "skip") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/tutor/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: props.sessionId, code: props.code, action: kind }),
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

  async function startCheck() {
    setMode("loading-check");
    setError("");
    try {
      const res = await fetch("/api/mastery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: props.sessionId, code: props.code, action: "make" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "The check could not be made. Try again.");
      setQuestions(data.questions);
      setExplainPrompt(data.prompt);
      setChoices(data.questions.map(() => null));
      setExplanation("");
      setResult(null);
      setMode("check");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The check could not be made. Try again.");
      setMode("chat");
    }
  }

  async function submitCheck() {
    if (choices.some((c) => c === null) || explanation.trim().length < 8) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/mastery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: props.sessionId, code: props.code, action: "submit", choices, explanation }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "The check could not be marked. Try again.");
      setResult(data);
      setMode("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The check could not be marked. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      const text = draft.trim();
      if (text) void send(text);
    }
  }

  return (
    <div className="tutor">
      <div className="tutor-main">
        <TutorTrack header={props.header} />
        <h1 className="page-title tutor-title">
          <span className="tutor-code">{props.code}</span> {props.name}
        </h1>

        <ol className="talk" aria-live="polite">
          {turns.map((t, i) => (
            <li key={i} className="turn" data-role={t.role}>
              <span className="who">{t.role === "tutor" ? "Tutor" : "You"}</span>
              <p>{t.text}</p>
            </li>
          ))}
          {streaming ? (
            <li className="turn" data-role="tutor" aria-busy="true">
              <span className="who">Tutor</span>
              <p>
                {live}
                <span className="caret" aria-hidden="true" />
              </p>
            </li>
          ) : null}
        </ol>

        {!props.aiReady ? (
          <p className="result-flag is-bad">The AI is not set up, so the tutor cannot run. Skip this idea to continue.</p>
        ) : null}
        {error ? (
          <p className="error-text tutor-error" role="alert">
            {error}{" "}
            {canRetry && !streaming ? (
              <button type="button" className="btn-ghost" onClick={() => void send(null)}>
                Try again
              </button>
            ) : null}
          </p>
        ) : null}

        {mode === "chat" ? (
          <>
            <div className="composer">
              <span className="reason-prompt" aria-hidden="true">
                ›
              </span>
              <textarea
                ref={input}
                className="composer-input"
                rows={2}
                value={draft}
                maxLength={600}
                disabled={streaming || !props.aiReady || turns.length === 0}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
                placeholder={streaming ? "The tutor is writing" : "Your answer, in any language. Enter to send."}
                aria-label="Your reply to the tutor"
              />
              <button
                type="button"
                className="btn-primary composer-send"
                disabled={streaming || !draft.trim()}
                onClick={() => void send(draft.trim())}
              >
                Send <span className="arr" aria-hidden="true">→</span>
              </button>
            </div>
            <div className="tutor-actions">
              {ready || studentTurns >= 3 ? (
                <button
                  type="button"
                  className={ready ? "btn-primary" : "btn-quiet"}
                  disabled={streaming || busy}
                  onClick={() => void startCheck()}
                >
                  {ready ? "Check my understanding" : "I think I have got it, check me"}{" "}
                  <span className="arr" aria-hidden="true">→</span>
                </button>
              ) : null}
              <button type="button" className="btn-quiet tutor-skip" disabled={streaming || busy} onClick={() => void action("skip")}>
                Skip this idea
              </button>
            </div>
          </>
        ) : null}

        {mode === "loading-check" ? (
          <div className="check">
            <p className="eyebrow">Mastery check</p>
            <p className="lede">Writing two fresh questions and checking their answers independently.</p>
            <div className="dx-progress" role="progressbar" aria-label="Preparing the check">
              <span />
            </div>
          </div>
        ) : null}

        {mode === "check" || mode === "result" ? (
          <div className="check">
            <p className="eyebrow">Mastery check · new questions on the same idea</p>
            {questions.map((q, qi) => (
              <div key={qi} className="check-q">
                <p className="check-stem">
                  <span className="dx-q">{qi + 1}</span>
                  {q.stem}
                </p>
                <div className="options check-options" role="radiogroup" aria-label={`Check question ${qi + 1}`} data-answered={choices[qi] !== null}>
                  {q.options.map((o, oi) => {
                    const mark =
                      result && oi === result.answers[qi] ? "right" : result && choices[qi] === oi ? "wrong" : undefined;
                    return (
                      <button
                        key={oi}
                        type="button"
                        role="radio"
                        className="option"
                        aria-checked={choices[qi] === oi}
                        data-mark={mark}
                        disabled={mode === "result"}
                        onClick={() => setChoices((c) => c.map((v, i) => (i === qi ? oi : v)))}
                      >
                        <span className="option-letter" aria-hidden="true">
                          {LETTERS[oi]}
                        </span>
                        <span className="option-text">{o}</span>
                        <span className="option-indicator" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
                {result ? (
                  <p className={result.correct[qi] ? "check-why is-good" : "check-why is-bad"}>
                    {result.correct[qi] ? "Right. " : "Not this time. "}
                    {result.why[qi]}
                  </p>
                ) : null}
              </div>
            ))}

            <div className="check-q">
              <p className="check-stem">
                <span className="dx-q">{questions.length + 1}</span>
                {explainPrompt}
              </p>
              <div className="composer">
                <span className="reason-prompt" aria-hidden="true">
                  ›
                </span>
                <textarea
                  className="composer-input"
                  rows={2}
                  value={explanation}
                  maxLength={400}
                  disabled={mode === "result"}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="One or two sentences, in any language"
                  aria-label="Explain the idea in your own words"
                />
              </div>
              {result ? (
                <p className={result.explainPass ? "check-why is-good" : "check-why is-bad"}>{result.feedback}</p>
              ) : null}
            </div>

            {mode === "check" ? (
              <div className="tutor-actions">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy || choices.some((c) => c === null) || explanation.trim().length < 8}
                  onClick={() => void submitCheck()}
                >
                  {busy ? "Marking" : "Submit the check"} <span className="arr" aria-hidden="true">→</span>
                </button>
                <button type="button" className="btn-quiet" disabled={busy} onClick={() => setMode("chat")}>
                  Back to the tutor
                </button>
              </div>
            ) : null}

            {mode === "result" && result ? (
              <div className="tutor-actions">
                <p className={result.mastered ? "mastery is-good" : "mastery"}>
                  {result.mastered ? "Mastered" : "Not mastered yet"}
                </p>
                <button type="button" className="btn-primary" disabled={busy} onClick={() => void action("done")}>
                  Next idea <span className="arr" aria-hidden="true">→</span>
                </button>
                {!result.mastered ? (
                  <button type="button" className="btn-quiet" disabled={busy} onClick={() => setMode("chat")}>
                    Talk it through again
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <div ref={bottom} />
      </div>

      <aside className="tutor-side">
        <div className="believed">
          <p className="dx-flag">What the pre-test showed</p>
          <p className="dx-belief">You may have believed: {props.belief}</p>
          {props.evidence.length > 0 ? (
            <ul className="dx-evidence">
              {props.evidence.map((e) => (
                <li key={e.label}>
                  <span className="dx-q">{e.label}</span>
                  Chose &ldquo;{e.chose}&rdquo;{e.reason ? `. Reason: "${e.reason}"` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {props.lab ? <MotionLab h0={20} title="Ball dropped from 20 m" caption={props.lab} /> : null}
      </aside>
    </div>
  );
}
