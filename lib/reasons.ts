/**
 * The quick-insert chips under the reason box, and the rule for when a reason says anything.
 * Chips are sentence starters: a student taps one and finishes the sentence.
 * A chip on its own ("I pictured the motion") tells us nothing about a misconception,
 * so it is never sent to the AI as evidence.
 */

export const GUESS_CHIP = "I guessed";

/** Starters shown as chips. Each ends with a space so the student keeps typing. */
export const STARTER_CHIPS = ["Because ", "I used the formula ", "I pictured that ", "On the graph I looked at "];

/** Chip texts from older versions of the app, still stripped from saved reasons. */
const OLD_CHIPS = ["I used a formula", "I pictured the motion", "I read the graph", "It seemed obvious"];

const FILLER = [...STARTER_CHIPS.map((c) => c.trim()), ...OLD_CHIPS];

/**
 * The part of a reason that carries meaning: chip text removed, then checked for length.
 * Returns "" when nothing useful is left.
 */
export function substantiveReason(reason: string): string {
  let text = ` ${reason} `;
  for (const filler of FILLER) {
    const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`(^|[\\s.,;])${escaped}(?=$|[\\s.,;])`, "gi"), " ");
  }
  const left = text.replace(/[\s.,;:!?-]+/g, " ").trim();
  // Fewer than two words, or under 6 letters, is not enough to read a misconception from.
  const words = left.split(" ").filter(Boolean);
  if (words.length < 2 || left.replace(/\s/g, "").length < 6) return "";
  return reason.trim();
}
