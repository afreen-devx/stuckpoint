import type { Pack } from "./pack";

/**
 * Students see questions numbered by their place in the test ("Q03"), not by their id in the pack.
 * Every screen uses this so the numbers always match what the student saw.
 */
export function questionLabel(pack: Pack, qid: string): string {
  for (const set of [pack.sets.A_pre, pack.sets.B_post, pack.sets.C_retention]) {
    const i = set.indexOf(qid);
    if (i !== -1) return `Q${String(i + 1).padStart(2, "0")}`;
  }
  return qid;
}

/** Same, with the test named, for screens that show both tests ("Pre Q03", "Post Q05"). */
export function questionLabelWithTest(pack: Pack, qid: string): string {
  if (pack.sets.A_pre.includes(qid)) return `Pre ${questionLabel(pack, qid)}`;
  if (pack.sets.B_post.includes(qid)) return `Post ${questionLabel(pack, qid)}`;
  if (pack.sets.C_retention.includes(qid)) return `Retention ${questionLabel(pack, qid)}`;
  return questionLabel(pack, qid);
}
