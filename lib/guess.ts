/**
 * An answer marked as a guess is saved but never counts as evidence of a misconception.
 * Two simple signals, both easy to explain to a judge:
 *   1. the student said so (the "I guessed" chip or the words "I guessed"), or
 *   2. the answer came faster than anyone can read the question.
 * The 4 second cut-off is a first estimate. Tune it after the first real sessions.
 */
export const GUESS_FAST_MS = 4000;

export function isGuess(reason: string, timeMs: number): boolean {
  const saidGuess = /\bi\s+guessed\b/i.test(reason);
  const tooFast = timeMs > 0 && timeMs < GUESS_FAST_MS;
  return saidGuess || tooFast;
}
