# HANDOFF

StuckPoint, milestone 3 (tutoring) and the Lab amber redesign. Updated 26 Nov 2026.

## Status

- **Milestones 1 and 2 run** on a real machine. The first real Gemini diagnosis worked on 26 Nov.
- **Milestone 3 is written and tested offline:** streaming Socratic tutor, mastery check, foundations
  review. Not yet run against the real AI.
- **New design ("Lab amber")** on every page: Anek type (one family for English, Telugu and Hindi),
  JetBrains Mono numbers, the motion lab, the misconception map, the big results score.

## Finishing pass (28 Nov)

- **Retention test:** set C (Q21 to Q30) in KIN-02, computed and checked like the others. Results offer
  "Take the retention test"; a returning student enters their student ID on the start page
  (`GET /api/sessions?studentId=`), which opens their latest finished session. Results then show
  pre → post → retention.
- **Teacher view:** `/teacher`, behind `TEACHER_PIN` (cookie holds a hash, 12 hours). Group comparison
  (StuckPoint vs ChatGPT Study Mode): mean pre, post, gain, retention, misconceptions fixed; every session;
  AI health (failures, timeouts, rate limits, typical reply time). Class exports:
  `/api/teacher/export?kind=sessions` and `?kind=answers`.
- **AI check:** `npm run ai:check` runs one real diagnosis call and one streamed tutor reply with your
  `.env`, prints timings, never prints the key.

## Harder questions (KIN-02)

- Student feedback: questions were too basic and had too few numbers. `packs/KIN-02.json` replaces
  KIN-01 as the default (`PACK_ID` in `.env` can switch back). Same 10 misconceptions, same diagnosis.
- Answers are computed and checked by `scripts/generate-kin02.py`; see the README. No teacher review yet.
- Sessions saved under KIN-01 show KIN-02 questions if reopened, because question ids are reused.
  Start new sessions after switching.
- The setup page motion lab now drops from 30 m, so it does not show the 20 m fall time asked in Q17.

## Deployment (Vercel + Turso)

- `lib/db.ts` now talks to **Turso** (hosted SQLite) when `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
  are set, and to the local file `data/stuckpoint.db` otherwise. A file on Vercel is temporary, so the
  study must run on Turso. Every database function is now async.
- The Turso client is `@libsql/client` (its web build: plain HTTPS, nothing native). Add it with
  `npm install @libsql/client` so `package.json` and `package-lock.json` both list it.
- `next.config.ts` ships `packs/` with every server function.
- Step by step: `DEPLOY.md`.

## Milestone 3: tutoring

- Flow: diagnosis → `/session/[id]/tutor` → post-test. The tutor works through the foundations review
  (score 3 or less) and then each misconception in `tutorQueue`, one at a time.
- `app/api/tutor`: one tutor turn, streamed as plain text. The tutor opens the conversation, asks one
  question per reply, never quotes post-test questions, and writes `[READY]` when the student has
  explained the idea in their own words. Every turn is saved to `tutoring_events`.
- `app/api/mastery`: "make" writes 3 questions, an independent solver call answers them, and only
  questions where both agree are kept (at most 2). "submit" scores them on the server and grades the
  student's own-words explanation. Saved to `mastery_checks` (a retry replaces the earlier attempt).
- `app/api/tutor/action`: "done" or "skip" for the current idea. Skip is always available.
- `lib/llm.ts` `streamText`: streaming for Gemini and Claude, with the same retries, fallback model
  and logging as `complete`.
- Five tutor languages: English, Telugu, Hindi, Telugu-English, Hindi-English (`LANGUAGE_RULE` in
  `lib/prompts.ts`). Questions always stay in English.

## Fixes from the first real AI test

- Chip-only reasons ("I pictured the motion") are no longer sent to the AI as evidence
  (`lib/reasons.ts`), and the prompt says generic phrases are too vague. Chips are now sentence starters.
- Every screen numbers questions as the student saw them (`lib/labels.ts`): Q01 to Q10.
- When most answers were guesses, diagnosis says "Not enough evidence yet" instead of "No misconceptions".

## Checked offline

- Type check of all app code; diagnosis, reasons and streaming tests; tutoring plan against a real
  SQLite file; every page rendered in a browser with sample data at desktop and phone width.

## Watch during the study

- Free-tier limits: one student uses roughly 15 to 25 AI calls (diagnosis, about 5 tutor turns per idea,
  3 calls per mastery check). Check `llm_calls` for `rate_limited` errors after the first few students.

## Milestone 2: AI diagnosis

- `lib/llm.ts`: calls Google Gemini (default, free tier) or the Anthropic Messages API with `fetch`
  (no SDK), reads only the final answer text (models may think first), reports rate limits clearly, parses JSON with one retry, times out after 90 s, and logs
  every call to `llm_calls` (purpose, model, latency, tokens, error code).
- `lib/prompts.ts`: the diagnosis prompt. Student reasons are wrapped in `<reason>` tags and treated as
  data only.
- `lib/diagnosis.ts`: the rules, pure and tested: +1 per tagged wrong answer, +1 per AI reading at
  confidence 0.6 or more, guesses never count (student said so, under 4 s, or the AI says so), C0 slips
  reported separately, found at 2+, possible at 1, tutor at most 3, foundations when the score is 3 or less.
- `lib/run-diagnosis.ts`: runs once per session and stores the result in `diagnosis_runs` plus one row per
  code in `diagnoses`. Without a key, or with no reasons written, it uses answer choices only and says so.
  If the AI call fails, the fallback is shown but not stored, so a reload tries again.
- Diagnosis page: found and possible misconceptions with their evidence, what is tutored now and later,
  guesses and slips, a foundations notice, and a loading screen while the AI works.
  Control-group sessions are diagnosed too (for the study data) but not shown the result.
- Tests: `tests/diagnosis.test.ts` (run `npm test`).

### Checked offline

- 13 tests for scoring, the diagnosis rules and JSON parsing pass.
- The AI client against a fake Anthropic server: URL, headers, body, thinking blocks skipped, error
  messages, the JSON retry, and call logging.
- Saving and replacing a stored diagnosis.

### Not checked yet

- A real call to Gemini or Claude with a real key, and the quality of the AI's readings of real student reasons.
  Write the 100 labelled explanations for the evaluation script (milestone 5) to measure this.

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

## Database change

`better-sqlite3` was replaced by Node's built-in `node:sqlite` because it needed Visual Studio build tools
to compile on Windows with Node 26. `lib/db.ts` keeps the same functions, so nothing else changed.
The project now needs Node 22.13 or newer.

## Checked

- Type-check of all app code passes (with stand-in types for React, Next.js, zod and SQLite).
- Scoring: all 20 answer keys and all 80 option tags match the reviewed bank.
- Guess rule: "I guessed" in any case, answers under 4 s, and edge cases.
- Database (`lib/db.ts` on node:sqlite): sessions, phase changes, saving and replacing answers, reads.

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

## Next steps

1. **Streaming tutor**: add `stream` to `lib/llm.ts`, a tutor prompt in `lib/prompts.ts`, an API route that
   streams one reply, and `app/session/[id]/tutor` working through `tutorQueue`, saving to `tutoring_events`.
2. **Mastery check**: two AI-written practice questions, checked by an independent solver call, plus an
   explain-back graded by the AI; save to `mastery_checks`.
3. **Foundations** segment for scores of 3 or lower, using the `foundations` block in the pack.
4. **Teacher view**, **evaluation script** (`eval/`), more unit tests.

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
