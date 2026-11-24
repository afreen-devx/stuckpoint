"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QuestionConsole from "./QuestionConsole";
import type { GraphSpec } from "@/lib/pack";
import { LANGUAGE_LABEL, type Language, type TestPhase } from "@/lib/types";

export type TestQuestion = {
  qid: string;
  stem: string;
  options: string[];
  graph?: GraphSpec;
};

export type SavedAnswer = {
  qid: string;
  choice: number | null;
  reason: string;
  timeMs: number;
};

type AnswerState = { choice: number | null; reason: string; timeMs: number };

/**
 * Runs one test (pre or post): which question is showing, what the student picked,
 * how long each question has been on screen, saving, and moving to the next step.
 * It never sees the answer key. Scoring happens on the server.
 */
export default function TestRunner({
  sessionId,
  phase,
  language,
  studentId,
  questions,
  initialAnswers,
}: {
  sessionId: string;
  phase: TestPhase;
  language: Language;
  studentId: string;
  questions: TestQuestion[];
  initialAnswers: SavedAnswer[];
}) {
  const router = useRouter();
  const isPre = phase === "pretest";

  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() => {
    const seed: Record<string, AnswerState> = {};
    for (const q of questions) seed[q.qid] = { choice: null, reason: "", timeMs: 0 };
    for (const a of initialAnswers) {
      if (seed[a.qid]) seed[a.qid] = { choice: a.choice, reason: a.reason, timeMs: a.timeMs };
    }
    return seed;
  });

  // Resume at the first unanswered question.
  const [index, setIndex] = useState(() => {
    const firstOpen = questions.findIndex((q) => !initialAnswers.some((a) => a.qid === q.qid && a.choice !== null));
    return firstOpen === -1 ? questions.length - 1 : firstOpen;
  });
  const [dir, setDir] = useState<"forward" | "back">("forward");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  // When the current question appeared. Set on the client only, after the first render.
  const [shownAt, setShownAt] = useState(0);
  const busyRef = useRef(false);

  useEffect(() => {
    setShownAt(Date.now());
  }, []);

  const question = questions[index];
  const current = answers[question.qid];

  function select(choice: number) {
    setAnswers((prev) => ({ ...prev, [question.qid]: { ...prev[question.qid], choice } }));
    setNote("");
  }

  function changeReason(reason: string) {
    setAnswers((prev) => ({ ...prev, [question.qid]: { ...prev[question.qid], reason } }));
  }

  /** Save the current question if it has an answer. Adds the time spent on it. */
  async function saveCurrent(): Promise<Record<string, AnswerState>> {
    const answer = answers[question.qid];
    if (answer.choice === null) return answers;
    const spent = shownAt > 0 ? Math.max(0, Date.now() - shownAt) : 0;
    const timeMs = answer.timeMs + spent;

    const res = await fetch("/api/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        phase,
        qid: question.qid,
        choice: answer.choice,
        reason: isPre ? answer.reason.trim() : "",
        timeMs,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? "Could not save that answer. Check your connection and try again.");
    }

    const next = { ...answers, [question.qid]: { ...answer, timeMs } };
    setAnswers(next);
    return next;
  }

  function show(nextIndex: number, direction: "forward" | "back") {
    setDir(direction);
    setIndex(nextIndex);
    setShownAt(Date.now());
  }

  /** Runs one action at a time, so a double press cannot save twice. */
  async function guarded(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNote("");
    try {
      await action();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function finish() {
    const nextPhase = isPre ? "diagnosis" : "results";
    const res = await fetch("/api/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sessionId, phase: nextPhase }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? "Could not move to the next step. Try again.");
    }
    router.push(`/session/${sessionId}/${nextPhase}`);
    router.refresh();
  }

  const goNext = () =>
    guarded(async () => {
      if (answers[question.qid].choice === null) return;
      const saved = await saveCurrent();
      if (index < questions.length - 1) {
        show(index + 1, "forward");
        return;
      }
      const gap = questions.findIndex((q) => saved[q.qid].choice === null);
      if (gap !== -1) {
        setNote(`Question ${gap + 1} has no answer yet. Answer every question to finish.`);
        show(gap, "back");
        return;
      }
      await finish();
    });

  const goTo = (target: number) =>
    guarded(async () => {
      if (target === index || target < 0 || target >= questions.length) return;
      await saveCurrent();
      show(target, target < index ? "back" : "forward");
    });

  // Keyboard: A to D or 1 to 4 choose, Enter goes next, Esc goes back.
  const onKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if (event.key === "Enter") {
        // Buttons handle their own Enter. In the reason box, Enter means "next".
        if (target?.tagName === "BUTTON") return;
        event.preventDefault();
        void goNext();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (index > 0) void goTo(index - 1);
        return;
      }
      if (typing) return;
      const letter = "ABCD".indexOf(event.key.toUpperCase());
      const digit = "1234".indexOf(event.key);
      const pick = event.key.length === 1 ? (letter !== -1 ? letter : digit) : -1;
      if (pick !== -1 && pick < question.options.length) {
        event.preventDefault();
        select(pick);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index, answers, shownAt, question],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const isLast = index === questions.length - 1;
  const finishLabel = isPre ? "Finish pre-test" : "Finish post-test";

  return (
    <QuestionConsole
      qid={question.qid}
      index={index}
      total={questions.length}
      setLabel={isPre ? "Set A" : "Set B"}
      phaseLabel={isPre ? "Pre-test" : "Post-test"}
      studentId={studentId}
      languageLabel={LANGUAGE_LABEL[language]}
      stem={question.stem}
      options={question.options}
      graph={question.graph}
      choice={current.choice}
      reason={current.reason}
      showReasoning={isPre}
      qids={questions.map((q) => q.qid)}
      answered={questions.map((q) => answers[q.qid].choice)}
      since={shownAt}
      dir={dir}
      busy={busy}
      nextLabel={isLast ? finishLabel : "Next question"}
      note={note}
      onSelect={select}
      onReasonChange={changeReason}
      onNext={() => void goNext()}
      onBack={() => void goTo(index - 1)}
      onJump={(target) => void goTo(target)}
    />
  );
}
