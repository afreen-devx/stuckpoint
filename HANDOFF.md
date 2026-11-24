# HANDOFF

StuckPoint, end of milestone 1. Updated 24 Nov 2026.
This file says what exists, what has been checked, and what to do next.

## Status in one line

Milestone 1 is **code-complete but has not been run in a browser yet**. It was type-checked against
stand-in library types and the scoring logic was tested against the real pack, but `npm install`
could not run where it was written. The first `npm run dev` on a real machine is the real test.

## What works (written)

- **Setup page** (`app/page.tsx`, `components/SetupForm.tsx`): generated anonymous ID (editable,
  capitals and digits, 2 to 8 characters, New button), optional class code, three language choices as a
  radio group with arrow-key support, consent box when `STUDY_MODE=true`.
- **Sessions API** (`app/api/sessions/route.ts`): `POST` creates a session (random study group only in
  study mode, consent required); `PATCH` moves the phase only along allowed steps, and refuses to leave a
  test until every question in its set is answered.
- **Answers API** (`app/api/answers/route.ts`): checks the session is on that test and the question is
  in that test's set, scores with `scoreChoice` on the server, marks guesses with `lib/guess.ts`, saves.
  It never sends the score back during the test.
- **Test pages** (`app/session/[id]/pretest`, `.../posttest`, shared loader `lib/test-page.ts`): load the
  questions without the answer key, resume at the first unanswered question, and redirect to the right
  step if the session is elsewhere.
- **TestRunner** (`components/TestRunner.tsx`): current question, choices, reasons, time per question
  (added up across visits), keyboard (A to D or 1 to 4 choose, Enter next, Esc back), jump to answered
  questions, one save at a time, plain error messages.
- **QuestionConsole** (`components/QuestionConsole.tsx`): composes the rail, question, graph, options,
  reasoning box and footer in the blueprint layout.
- **Diagnosis page**: a placeholder. Shows the pre-test score and how many answers were marked as
  guesses, then continues to the post-test. Control-group sessions (study mode) see instructions to
  study with ChatGPT Study Mode for 20 minutes instead.
- **Results page**: pre and post scores, mastery flag (8 or more), a table of misconceptions shown by
  wrong answers before and after (guesses and calculation slips excluded), retention status, CSV
  download, new session link.
- **Export** (`app/api/export?id=`): the full session log as CSV.
- **Pack check** (`npm run pack:check`, `scripts/check-pack.ts`): validates the pack and lists problems.
- **Error and 404 pages**.

## Checked

- Type-check of all app code passes (with stand-in types for React, Next.js, zod and SQLite).
- Scoring: all 20 answer keys and all 80 option tags match the reviewed bank.
- Guess rule: "I guessed" in any case, answers under 4 s, and edge cases.

## Not checked yet

- Nothing has rendered in a real browser. Expect small layout fixes.
- `npm install` with the exact versions in `package.json`.
- The full flow against a real SQLite file.

## First run checklist

1. `npm install`, then `npm run pack:check` (should print OK with retention warnings).
2. `npm run dev`, open http://localhost:3000.
3. Start a session, answer all 10 pre-test questions (try keys A to D, Enter, Esc, jumping back).
4. Continue past the diagnosis placeholder, answer the post-test, check the results and CSV.
5. Try all correct, all wrong, and "I guessed" answers, and check the results table.
6. Check at 400px wide on a phone.

## Next steps, in order (milestone 2 onwards)

1. **Diagnosis** (`lib/diagnosis.ts`, pure, with tests): evidence +1 per tagged wrong option, +1 per
   reason the LLM classifies at confidence 0.6 or more; skip guesses; C0 reported separately; found at
   2 or more, possible at 1; tutor the top 3, list the rest. Falls back to tags only without an LLM.
2. **LLM provider** (`lib/llm.ts`): one small interface (`complete`, `completeJSON`, `stream`) for
   Anthropic, OpenAI or Google, configured by `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`. Log every call
   to `llm_calls`.
3. **Prompts** (`lib/prompts.ts`) for diagnosis, tutor, mastery generation, independent solver and
   explain-back grading, as in the build prompt.
4. **Tutor and mastery pages**, then foundations for scores of 3 or lower.
5. **Teacher view**, **evaluation script** (`eval/`), **unit tests** (vitest).

## File map

```text
app/
  page.tsx                     setup
  layout.tsx, globals.css      shell, fonts, design system
  error.tsx, not-found.tsx
  session/[id]/layout.tsx      stepper
  session/[id]/page.tsx        redirects to the current step
  session/[id]/pretest|posttest/page.tsx
  session/[id]/diagnosis/page.tsx   placeholder until milestone 2
  session/[id]/results/page.tsx
  api/sessions, api/answers, api/export
components/
  SetupForm, TestRunner, QuestionConsole, PhaseButton
  QuestionRail, OptionList, ReasoningBox, GraphFigure, Header, Stepper, Panel, CornerMarks
lib/
  types, pack, scoring, guess, session, db, csv, test-page
packs/KIN-01.json
scripts/check-pack.ts
```
