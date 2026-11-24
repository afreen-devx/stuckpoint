import type { Pack } from "./pack";

/**
 * The diagnosis rules. Pure functions only, so they are easy to test and explain.
 *
 * Evidence for a misconception code:
 *   +1 for each wrong answer whose chosen option is tagged with that code
 *   +1 for each reason the AI reads as that code, with confidence 0.6 or more
 *      (a correct answer with a wrong reason counts too)
 * Answers marked as guesses never count. Calculation slips (C0) are reported separately.
 * Found = 2 or more pieces of evidence. Possible = exactly 1.
 */

export const CONFIDENCE_MIN = 0.6;
export const TUTOR_LIMIT = 3;
export const FOUNDATIONS_MAX_SCORE = 3;

export type DiagnosisAnswer = {
  qid: string;
  choice: number | null;
  correct: boolean;
  optionTag: string | null;
  reason: string;
  guess: boolean;
};

/** What the AI said about one reason. */
export type ReasonVerdict = {
  q: string;
  code: string;
  confidence: number;
  guess: boolean;
  evidence: string;
};

export type Evidence = { qid: string; kind: "answer" | "reason"; detail: string };

export type CodeResult = {
  code: string;
  name: string;
  belief: string;
  truth: string;
  count: number;
  status: "found" | "possible";
  evidence: Evidence[];
};

export type Diagnosis = {
  usedAi: boolean;
  note: string | null;
  score: number;
  total: number;
  found: CodeResult[];
  possible: CodeResult[];
  /** Codes to tutor this session, at most three. */
  tutorQueue: string[];
  /** Everything else that showed up, for a later session. */
  later: string[];
  /** Questions not counted because they were guesses. */
  guessed: string[];
  /** Wrong answers that were calculation slips. */
  slips: string[];
  /** True when the score is low enough to start with the basics. */
  foundations: boolean;
};

const LETTERS = ["A", "B", "C", "D"];

function codeOrder(code: string): number {
  return Number(code.replace(/\D/g, "")) || 0;
}

export function computeDiagnosis(
  pack: Pack,
  answers: DiagnosisAnswer[],
  verdicts: ReasonVerdict[] | null,
  note: string | null = null,
): Diagnosis {
  const verdictFor = new Map((verdicts ?? []).map((v) => [v.q, v]));
  const evidence = new Map<string, Evidence[]>();
  const add = (code: string, item: Evidence) => evidence.set(code, [...(evidence.get(code) ?? []), item]);
  const guessed: string[] = [];
  const slips: string[] = [];

  for (const answer of answers) {
    const verdict = verdictFor.get(answer.qid);
    if (answer.guess || verdict?.guess) {
      guessed.push(answer.qid);
      continue;
    }

    const question = pack.questions[answer.qid];
    if (!answer.correct && answer.choice !== null && answer.optionTag) {
      if (answer.optionTag === "C0") {
        slips.push(answer.qid);
      } else if (pack.misconceptions[answer.optionTag]) {
        const text = question?.options[answer.choice] ?? "";
        add(answer.optionTag, {
          qid: answer.qid,
          kind: "answer",
          detail: `Chose ${LETTERS[answer.choice]}: ${text}`,
        });
      }
    }

    if (verdict && pack.misconceptions[verdict.code] && verdict.confidence >= CONFIDENCE_MIN) {
      add(verdict.code, {
        qid: answer.qid,
        kind: "reason",
        detail: verdict.evidence ? `Reason: "${verdict.evidence}"` : `Reason: "${answer.reason}"`,
      });
    }
  }

  const results: CodeResult[] = [...evidence.entries()]
    .map(([code, items]) => ({
      code,
      ...pack.misconceptions[code],
      count: items.length,
      status: (items.length >= 2 ? "found" : "possible") as "found" | "possible",
      evidence: items,
    }))
    .sort((a, b) => b.count - a.count || codeOrder(a.code) - codeOrder(b.code));

  const found = results.filter((r) => r.status === "found");
  const possible = results.filter((r) => r.status === "possible");
  const pool = found.length > 0 ? found : possible;
  const tutorQueue = pool.slice(0, TUTOR_LIMIT).map((r) => r.code);
  const later = results.map((r) => r.code).filter((code) => !tutorQueue.includes(code));
  const score = answers.filter((a) => a.correct).length;

  return {
    usedAi: verdicts !== null,
    note,
    score,
    total: answers.length,
    found,
    possible,
    tutorQueue,
    later,
    guessed,
    slips,
    foundations: score <= FOUNDATIONS_MAX_SCORE,
  };
}
