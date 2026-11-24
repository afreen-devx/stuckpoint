import type { Question } from "./pack";

/**
 * Every score in StuckPoint comes from this file.
 * The answer key is the pack's single null tag per question. No model is involved.
 */

const LETTERS = ["A", "B", "C", "D"] as const;

export function letterFor(index: number): string {
  return LETTERS[index] ?? "?";
}

export function indexFromLetter(letter: string): number {
  return LETTERS.indexOf(letter.toUpperCase() as (typeof LETTERS)[number]);
}

/** The index of the correct option: the one option tagged null. */
export function correctIndex(question: Question): number {
  return question.tags.findIndex((tag) => tag === null);
}

export type ScoredChoice = {
  correct: boolean;
  optionTag: string | null;
};

/** Score one answer. A missing choice is simply wrong and has no tag. */
export function scoreChoice(question: Question, choice: number | null): ScoredChoice {
  if (choice === null || choice < 0 || choice >= question.options.length) {
    return { correct: false, optionTag: null };
  }
  return {
    correct: choice === correctIndex(question),
    optionTag: question.tags[choice] ?? null,
  };
}

export function countCorrect(rows: { correct: number }[]): number {
  return rows.filter((row) => row.correct === 1).length;
}
