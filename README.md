# StuckPoint

A kinematics tutor that finds exactly where a learner is stuck, tutors that misconception
Socratically, and proves learning with a fixed answer key.

Status: **milestone 1 is incomplete.** The pack, scoring, database, phase machine, CSV log and the
blueprint console components exist. There are no pages or API routes yet, so the app does not run
end to end. Read [HANDOFF.md](HANDOFF.md) for exactly what is done, what is missing and the next steps.

## Run it

```bash
npm install
cp .env.example .env   # optional for now: only the LLM steps need values
npm run dev
```

`npm run dev` starts, but every URL currently returns 404 because no page exists yet.
There is no LLM call in this milestone, so an empty `.env` is fine.

## What is here

- `packs/KIN-01.json`: the kinematics topic pack. Twenty questions, five graph specs, ten
  misconceptions, pre-test set A, post-test set B, an empty retention slot and a human-written
  foundations block. The model never invents the curriculum.
- `lib/pack.ts`: zod schema plus a validator that fails loudly on a broken pack.
- `lib/scoring.ts`: scoring against the pack's fixed answer key only. No AI grading, ever.
- `lib/session.ts`: the five step phase machine.
- `lib/db.ts`: SQLite tables and helpers (`better-sqlite3`).
- `lib/csv.ts`: session log as CSV.
- `app/globals.css` and `components/`: the blueprint console design system.

## Libraries and APIs

- Next.js 16 (App Router), React 19, TypeScript
- better-sqlite3 (SQLite, server only)
- zod (pack and later LLM JSON validation)
- next/font: Geist, Geist Mono, Noto Sans Telugu (downloaded at build time)
- vitest (dev dependency, no tests written yet)

No LLM provider is wired yet. `LLM_PROVIDER`, `LLM_MODEL` and `LLM_API_KEY` are documented in
`.env.example` and will be read on the server only.

## Data

Anonymous student IDs only. No names, emails, phone numbers or photos are stored. The database file
lives in `data/` and is gitignored.

## Design rules

Dark single theme, no purple, no gradients (the drafting grid is an inline SVG), no glows, no emoji,
no em dashes in UI text, animations off under `prefers-reduced-motion`, body text contrast 4.5:1 or
better, keyboard operable, mobile first at 400px.
