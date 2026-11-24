import type { Phase } from "./types";

/**
 * The server owns the flow. A session can only move along the arrows below,
 * so a student cannot jump to the post-test before finishing the pre-test.
 */
const ALLOWED: Record<Phase, Phase[]> = {
  pretest: ["diagnosis"],
  // Diagnosis can go to tutoring, or straight to the post-test when the LLM is unavailable.
  diagnosis: ["tutor", "posttest"],
  tutor: ["mastery", "posttest"],
  mastery: ["tutor", "posttest"],
  posttest: ["results"],
  results: [],
};

export const PHASE_LABEL: Record<Phase, string> = {
  pretest: "Pre-test",
  diagnosis: "Diagnosis",
  tutor: "Tutoring",
  mastery: "Mastery check",
  posttest: "Post-test",
  results: "Results",
};

export function canMoveTo(from: Phase, to: Phase): boolean {
  return ALLOWED[from].includes(to);
}

export function phaseHref(sessionId: string, phase: Phase): string {
  return `/session/${sessionId}/${phase}`;
}
