# HANDOFF

StuckPoint, milestone 1 partial. Written at the point the build window in this chat ran out.
This file says exactly what exists, what does not, and what to do next. Nothing here is a guess.

## What works

- **Topic pack and validator.** `packs/KIN-01.json` contains the full kinematics pack from the brief
  (20 questions, 5 graphs, 10 misconceptions, sets A and B, empty retention set) plus a human-written
  `foundations` block (5 concepts, each with an explanation, an example and one check question).
  `lib/pack.ts` loads and validates it with zod and throws `PackError` listing every problem when
  a set references a missing question, a question's tag count differs from its option count, a
  question does not have exactly one `null` tag, a tag uses an unknown code, or a graph is missing.
  Empty or short retention sets are warnings, not errors, so the app can run before set C is written.
- **Scoring.** `lib/scoring.ts` derives the correct answer from the single `null` tag and scores a
  choice against it. No model is involved anywhere in scoring.
- **Database.** `lib/db.ts` creates the six tables from the brief (`sessions`, `answers`, `diagnoses`,
  `tutoring_events`, `mastery_checks`, `llm_calls`) in SQLite through `better-sqlite3`, with the study
  group stored on every session row that belongs to a session, as the brief requires. Helpers:
  `createSession`, `getSession`, `setPhase`, `saveAnswer`, `getAnswers`, `getDiagnoses`,
  `getTutoringEvents`, `getMasteryChecks`. Answers are upserted per session, phase and question, so
  revisiting a question replaces the earlier answer.
- **Phase machine.** `lib/session.ts` defines the five steps plus the allowed transitions
  (`pretest -> diagnosis`, `diagnosis -> tutor | posttest`, `tutor|mastery -> tutor | mastery | posttest`,
  `posttest -> results`) and `phaseHref`.
- **CSV log.** `lib/csv.ts` escapes RFC 4180 style and builds one flat session log
  (`buildSessionLog`) with one row per session, answer, diagnosis, tutor turn and mastery check.
- **Design system.** `app/globals.css` implements the blueprint console tokens, the 56px drafting
  grid (drawn as an inline SVG, not a CSS gradient), header, stepper, panels with corner marks,
  option tiles with the letter column and yellow sweep, the terminal styled reasoning box,
  readouts, odometer, question rail, mobile layouts at 900px and 640px, and a reduced-motion block.
- **Components, presentational and wired to props:** `Header`, `Stepper`, `Panel`, `CornerMarks`,
  `Odometer` (inline in `QuestionRail`), `QuestionRail` (odometer, 2x2 readouts, live timer,
  question list), `OptionList` (radio group, A to D letters, selection sweep, dimming),
  `ReasoningBox` (locked until answered, chips, character counter), `GraphFigure` (SVG from the pack
  spec, figure caption, no crosshair). There is no `QuestionConsole` yet: the pieces above are not
  composed into the two column console.
- **Config.** `package.json` (Next 16, React 19, better-sqlite3, zod, vitest dev dependency),
  `tsconfig.json`, `next.config.ts` with `serverExternalPackages: ["better-sqlite3"]`,
  `.env.example`, `.gitignore`. `npm install` succeeds and `better-sqlite3` loads on Node 26.

## What is missing or broken

- **No pages and no API routes.** `app/` contains only `layout.tsx` and `globals.css`. There is no
  `app/page.tsx`, no session pages and no `app/api/*`. `npm run dev` starts, but every URL returns 404.
  The app cannot be used end to end yet.
- **`TestRunner` and `SetupForm` do not exist.** The console components take props but nothing drives
  them. There is no client component that tracks the current question, the timer, the chosen answers,
  the reasoning text, saves answers and advances the phase.
- **No tests.** `tests/` is not written, so `npm test` has nothing to run.
- **No diagnosis, tutor, mastery, results or teacher code.** `lib/diagnosis.ts`, `lib/prompts.ts`,
  `lib/llm/*`, `lib/rate-limit.ts`, `eval/` and the teacher page are all absent. The tables and the
  phase values exist for them.
- **Not verified in a browser.** No page has ever rendered, so the design system is unproven in
  practice. Expect small layout fixes on first run.
- **`next/font/google` fetches Geist and Noto Sans Telugu at build time.** This needs network access
  during `next build`. If the build machine is offline, replace the three font imports in
  `app/layout.tsx` with a local font stack.
- **The retention set is empty** (`C_retention: []`), so retention is deliberately unavailable. The
  validator warns about this and `retentionAvailable(pack)` returns false.
- **README is a stub**, see `README.md`.
- **Nothing is pushed.** This workspace has no git remote and no GitHub credentials. All work is in
  local commits on branch `freebuff/45dfe783e21fe5b0e24b623b`. Add a remote and push from a machine
  that has access.

## File map

```text
app/
  globals.css          design tokens and every component style
  layout.tsx           fonts, header, page shell
components/
  Header.tsx           logo mark, name, pack badge (loads the pack, so a broken pack fails here)
  Stepper.tsx          five step track driven by the URL
  Panel.tsx            panel wrapper
  CornerMarks.tsx      four L shaped corner marks
  QuestionRail.tsx     odometer, readouts, live timer, question list
  OptionList.tsx       A to D option tiles, radio group semantics
  ReasoningBox.tsx     locked until answered, chips, counter
  GraphFigure.tsx      SVG graph renderer
lib/
  types.ts             Language, StudyGroup, TestPhase, Phase
  pack.ts              zod schema, validatePack, loadPack, retentionAvailable
  scoring.ts           correctIndex, scoreChoice, countCorrect, letterFor
  db.ts                schema and query helpers
  session.ts           allowed phase transitions, phaseHref
  csv.ts               CSV escaping and the session log
packs/KIN-01.json      the pack
```

## Next steps, in order

1. **Add a `QuestionConsole` component, a `TestRunner` client component and the two test pages.**
   `QuestionConsole` should place `QuestionRail`, the stem, `GraphFigure`, `OptionList` and
   `ReasoningBox` inside one `.panel-wrap` + `.console` markup block, with the footer below the options. `TestRunner` needs: seed answer state from saved rows, track the current index,
   record the time each question is on screen, `POST /api/answers` on Next and on jump, and move the
   phase when the last question is answered. Pages:
   `app/session/[id]/pretest/page.tsx` (Set A) and `app/session/[id]/posttest/page.tsx` (Set B, no
   reasoning box). Guard both with `session.phase` and `redirect(phaseHref(session.id, session.phase))`.
2. **API routes.** `POST /api/sessions` (validate student id `/^[A-Z0-9]{2,8}$/`, class code, language,
   choose a study group only when `STUDY_MODE=true`), `PATCH /api/sessions` (use `canMoveTo`),
   `POST /api/answers` (look the question up in the pack, score with `scoreChoice`, reject a phase
   mismatch, save with `saveAnswer`), `GET /api/export?id=` (return `toCsv(LOG_COLUMNS, buildSessionLog(id))`).
3. **Setup page** (`app/page.tsx`) with a client form: generated student id, editable, uppercase, max 8,
   New button, optional class code, three language tiles, consent checkbox when `STUDY_MODE=true`.
4. **Diagnosis** (`lib/diagnosis.ts`, pure): tag evidence from wrong options, reason evidence from the
   LLM at confidence 0.6 or higher, exclusion for guesses and answers under 4 seconds, C0 reported
   separately, found at 2 or more, possible at exactly 1, top three tutored, rest listed as next
   session. Fall back to tag only evidence when the LLM is unavailable and say so on screen.
5. **Tests before anything else after that:** scoring, the diagnosis rules including guess exclusion
   and thresholds, and pack validation. They are cheap and they protect the honesty claim.
6. **Then** prompts, the streaming tutor, mastery generation with independent verification, results,
   teacher view, evaluation and study mode, in that order (milestones 2 to 5 of the brief).
7. **Check the design in a browser at 400px, 900px and 1280px** before adding more screens.
