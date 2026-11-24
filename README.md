# StuckPoint

A kinematics tutor that finds exactly where a learner is stuck, tutors that misconception
Socratically, and proves learning with a fixed answer key.

Status: **milestone 1 runs; milestone 2 (AI diagnosis) is written and tested offline.** Setup, pre-test,
post-test, fixed-key scoring, results and CSV export work. The diagnosis reads students' reasons with Gemini or Claude
when `LLM_API_KEY` is set, and falls back to answer choices only without it. Tutoring comes next. Read [HANDOFF.md](HANDOFF.md) for exactly what is done and what is next.

## Run it

Needs Node.js 22.13 or newer (check with `node -v`).

```bash
npm install
cp .env.example .env   # optional for now: only the LLM steps need values
npm run dev
```

Open http://localhost:3000, start a session, take the pre-test, continue past the diagnosis
placeholder, take the post-test, and download the CSV from the results page.
Run `npm run pack:check` to validate the question pack.

## What is here

- `packs/KIN-01.json`: the kinematics topic pack. Twenty questions, five graph specs, ten
  misconceptions, pre-test set A, post-test set B, an empty retention slot and a human-written
  foundations block. The model never invents the curriculum.
- `lib/pack.ts`: zod schema plus a validator that fails loudly on a broken pack.
- `lib/scoring.ts`: scoring against the pack's fixed answer key only. No AI grading, ever.
- `lib/session.ts`: the five step phase machine.
- `lib/db.ts`: SQLite tables and helpers, using Node's built-in `node:sqlite` (nothing to compile).
- `lib/csv.ts`: session log as CSV.
- `lib/llm.ts`, `lib/prompts.ts`: the AI client (Gemini or Claude) and every prompt.
- `lib/diagnosis.ts`, `lib/run-diagnosis.ts`: the diagnosis rules (tested in `tests/`) and running them once per session.
- `lib/guess.ts`: marks an answer as a guess (the student said "I guessed", or answered in under 4 s).
- `app/`: setup page, session pages (pre-test, diagnosis placeholder, post-test, results) and API routes
  (`/api/sessions`, `/api/answers`, `/api/export`).
- `app/globals.css` and `components/`: the blueprint console design system, `TestRunner` (test state,
  timing, keyboard, saving) and `SetupForm`.

## Libraries and APIs

- Next.js 16 (App Router), React 19, TypeScript
- node:sqlite, Node's built-in SQLite (server only). Requires Node 22.13 or newer.
- zod (pack and later LLM JSON validation)
- next/font: Geist, Geist Mono, Noto Sans Telugu (downloaded at build time)
- vitest (dev dependency, no tests written yet)

- Google Gemini API (free tier, default) or Anthropic Messages API (Claude), called with `fetch` from the
  server only. Set `LLM_PROVIDER` (`google` or `anthropic`), `LLM_MODEL` and `LLM_API_KEY` in `.env`.
  On Gemini's free tier, Google says content may be used to improve its products; reasons contain no names.

## Data

Anonymous student IDs only. No names, emails, phone numbers or photos are stored. The database file
lives in `data/` and is gitignored.

## Design rules

Dark single theme, no purple, no gradients (the drafting grid is an inline SVG), no glows, no emoji,
no em dashes in UI text, animations off under `prefers-reduced-motion`, body text contrast 4.5:1 or
better, keyboard operable, mobile first at 400px.
