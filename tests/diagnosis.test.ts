import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeDiagnosis, type DiagnosisAnswer, type ReasonVerdict } from "../lib/diagnosis";
import { extractJson } from "../lib/json";
import { isGuess } from "../lib/guess";
import type { Pack } from "../lib/pack";
import { correctIndex, scoreChoice } from "../lib/scoring";

const pack = JSON.parse(readFileSync(path.join(process.cwd(), "packs", "KIN-01.json"), "utf8")) as Pack;

/** Build a pre-test answer the way the answers API would save it. */
function answer(qid: string, choice: number, reason = "", timeMs = 20000): DiagnosisAnswer {
  const scored = scoreChoice(pack.questions[qid], choice);
  return { qid, choice, correct: scored.correct, optionTag: scored.optionTag, reason, guess: isGuess(reason, timeMs) };
}
const right = (qid: string) => answer(qid, correctIndex(pack.questions[qid]));

describe("scoring", () => {
  it("matches the reviewed answer key", () => {
    const key: Record<string, number> = { Q1: 1, Q3: 1, Q5: 1, Q7: 1, Q9: 1, Q11: 1, Q12: 0, Q13: 1, Q15: 2, Q16: 0, Q19: 3, Q20: 1 };
    for (const [qid, idx] of Object.entries(key)) expect(correctIndex(pack.questions[qid])).toBe(idx);
  });
});

describe("diagnosis rules", () => {
  it("two wrong answers with the same tag make a misconception found", () => {
    // Q5 option A and Q7 option D are both tagged M4 (graph as picture).
    const answers = [answer("Q5", 0), answer("Q7", 3), ...["Q1", "Q3", "Q9", "Q11", "Q13", "Q15", "Q17", "Q19"].map(right)];
    const d = computeDiagnosis(pack, answers, null);
    expect(d.found.map((r) => r.code)).toEqual(["M4"]);
    expect(d.found[0].count).toBe(2);
    expect(d.usedAi).toBe(false);
  });

  it("one wrong answer alone is only possible", () => {
    const d = computeDiagnosis(pack, [answer("Q3", 0), ...["Q1", "Q5", "Q7", "Q9"].map(right)], null);
    expect(d.found).toEqual([]);
    expect(d.possible.map((r) => r.code)).toEqual(["M2"]);
    expect(d.tutorQueue).toEqual(["M2"]);
  });

  it("a wrong answer plus a matching AI reason is found", () => {
    const answers = [answer("Q1", 0, "it stops at the top so nothing acts on it")];
    const verdicts: ReasonVerdict[] = [{ q: "Q1", code: "M1", confidence: 0.9, guess: false, evidence: "it stops" }];
    const d = computeDiagnosis(pack, answers, verdicts);
    expect(d.found.map((r) => r.code)).toEqual(["M1"]);
    expect(d.found[0].evidence.map((e) => e.kind)).toEqual(["answer", "reason"]);
    expect(d.usedAi).toBe(true);
  });

  it("a correct answer with a wrong reason still counts", () => {
    const d = computeDiagnosis(pack, [right("Q1")], [{ q: "Q1", code: "M3", confidence: 0.8, guess: false, evidence: "" }]);
    expect(d.possible.map((r) => r.code)).toEqual(["M3"]);
  });

  it("low-confidence AI readings are ignored", () => {
    const d = computeDiagnosis(pack, [right("Q1")], [{ q: "Q1", code: "M3", confidence: 0.59, guess: false, evidence: "" }]);
    expect(d.possible).toEqual([]);
  });

  it("guesses never count, whether marked by the student, by time, or by the AI", () => {
    const answers = [answer("Q3", 0, "I guessed"), answer("Q5", 0, "", 2000), answer("Q7", 3, "no idea")];
    const d = computeDiagnosis(pack, answers, [{ q: "Q7", code: "M4", confidence: 0.9, guess: true, evidence: "" }]);
    expect(d.found).toEqual([]);
    expect(d.possible).toEqual([]);
    expect(d.guessed.sort()).toEqual(["Q3", "Q5", "Q7"]);
  });

  it("calculation slips are reported, not diagnosed", () => {
    const d = computeDiagnosis(pack, [answer("Q9", 2)], null);
    expect(d.slips).toEqual(["Q9"]);
    expect(d.possible).toEqual([]);
  });

  it("unknown codes from the AI are ignored", () => {
    const d = computeDiagnosis(pack, [right("Q1")], [{ q: "Q1", code: "M99", confidence: 1, guess: false, evidence: "" }]);
    expect(d.possible).toEqual([]);
  });

  it("tutors at most three, ranked by evidence, and lists the rest for later", () => {
    const answers = [
      answer("Q1", 0, "r"), // M1
      answer("Q3", 0, "r"), // M2
      answer("Q5", 0, "r"), // M4
      answer("Q9", 0, "r"), // M6
      answer("Q13", 0, "r"), // M8
    ];
    const verdicts: ReasonVerdict[] = ["M1", "M2", "M4", "M6", "M8"].map((code, i) => ({
      q: answers[i].qid, code, confidence: 0.9, guess: false, evidence: "",
    }));
    const d = computeDiagnosis(pack, answers, verdicts);
    expect(d.found.length).toBe(5);
    expect(d.tutorQueue).toEqual(["M1", "M2", "M4"]);
    expect(d.later).toEqual(["M6", "M8"]);
  });

  it("starts with foundations when the score is 3 or lower", () => {
    const low = computeDiagnosis(pack, [right("Q1"), right("Q3"), right("Q5"), answer("Q7", 0)], null);
    expect(low.foundations).toBe(true);
    const high = computeDiagnosis(pack, ["Q1", "Q3", "Q5", "Q7"].map(right), null);
    expect(high.foundations).toBe(false);
  });
});

describe("reading JSON from the AI", () => {
  it("finds JSON inside text and code fences", () => {
    expect(extractJson('Here you go:\n```json\n[{"q":"Q1"}]\n```')).toEqual([{ q: "Q1" }]);
    expect(extractJson('Sure. {"pass": true} Done.')).toEqual({ pass: true });
  });
  it("rejects replies with no JSON", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});
