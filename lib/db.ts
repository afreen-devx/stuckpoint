import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Language, Phase, StudyGroup, TestPhase } from "./types";

/**
 * One small SQLite file, one schema, and a handful of prepared statements.
 * Uses Node's built-in SQLite (node:sqlite, Node 22.13 or newer), so nothing has to be
 * compiled on install. That keeps setup to "npm install" on Windows, Mac and Linux.
 * Every row that belongs to a session also stores the study group, as required
 * for the study mode comparison.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL,
  class_code  TEXT,
  language    TEXT NOT NULL,
  study_group TEXT NOT NULL,
  phase       TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS answers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  study_group TEXT NOT NULL,
  phase       TEXT NOT NULL,
  qid         TEXT NOT NULL,
  choice      INTEGER,
  correct     INTEGER NOT NULL,
  option_tag  TEXT,
  reason      TEXT,
  time_ms     INTEGER NOT NULL,
  guess       INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  UNIQUE (session_id, phase, qid)
);

CREATE TABLE IF NOT EXISTS diagnoses (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     TEXT NOT NULL,
  study_group    TEXT NOT NULL,
  code           TEXT NOT NULL,
  evidence_count INTEGER NOT NULL,
  status         TEXT NOT NULL,
  evidence_json  TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  UNIQUE (session_id, code)
);

CREATE TABLE IF NOT EXISTS diagnosis_runs (
  session_id  TEXT PRIMARY KEY,
  study_group TEXT NOT NULL,
  used_ai     INTEGER NOT NULL,
  note        TEXT,
  result_json TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tutoring_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  study_group TEXT NOT NULL,
  code        TEXT NOT NULL,
  role        TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mastery_checks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL,
  study_group  TEXT NOT NULL,
  code         TEXT NOT NULL,
  q1_correct   INTEGER NOT NULL,
  q2_correct   INTEGER NOT NULL,
  explain_pass INTEGER NOT NULL,
  mastered     INTEGER NOT NULL,
  explanation  TEXT,
  created_at   TEXT NOT NULL,
  UNIQUE (session_id, code)
);

CREATE TABLE IF NOT EXISTS llm_calls (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT NOT NULL,
  study_group   TEXT,
  purpose       TEXT NOT NULL,
  model         TEXT NOT NULL,
  latency_ms    INTEGER NOT NULL,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  ok            INTEGER NOT NULL,
  error_code    TEXT,
  created_at    TEXT NOT NULL
);
`;

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;

  const file = process.env.DB_PATH ?? path.join(process.cwd(), "data", "stuckpoint.db");
  const absolute = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  mkdirSync(path.dirname(absolute), { recursive: true });

  db = new DatabaseSync(absolute);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

export type SessionRow = {
  id: string;
  student_id: string;
  class_code: string | null;
  language: Language;
  study_group: StudyGroup;
  phase: Phase;
  created_at: string;
};

export type AnswerRow = {
  session_id: string;
  study_group: StudyGroup;
  phase: TestPhase;
  qid: string;
  choice: number | null;
  correct: number;
  option_tag: string | null;
  reason: string | null;
  time_ms: number;
  guess: number;
  created_at: string;
};

function now(): string {
  return new Date().toISOString();
}

export function createSession(input: {
  studentId: string;
  classCode: string | null;
  language: Language;
  studyGroup: StudyGroup;
}): SessionRow {
  const row: SessionRow = {
    id: crypto.randomUUID(),
    student_id: input.studentId,
    class_code: input.classCode,
    language: input.language,
    study_group: input.studyGroup,
    phase: "pretest",
    created_at: now(),
  };
  getDb()
    .prepare(
      `INSERT INTO sessions (id, student_id, class_code, language, study_group, phase, created_at)
       VALUES (@id, @student_id, @class_code, @language, @study_group, @phase, @created_at)`,
    )
    .run(row);
  return row;
}

export function getSession(id: string): SessionRow | null {
  const row = getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as unknown as SessionRow | undefined;
  return row ?? null;
}

export function setPhase(id: string, phase: Phase): void {
  getDb().prepare("UPDATE sessions SET phase = ? WHERE id = ?").run(phase, id);
}

/** Save one answer. Revisiting a question replaces the earlier answer. */
export function saveAnswer(input: {
  sessionId: string;
  studyGroup: StudyGroup;
  phase: TestPhase;
  qid: string;
  choice: number | null;
  correct: boolean;
  optionTag: string | null;
  reason: string;
  timeMs: number;
  guess: boolean;
}): void {
  getDb()
    .prepare(
      `INSERT INTO answers
         (session_id, study_group, phase, qid, choice, correct, option_tag, reason, time_ms, guess, created_at)
       VALUES (@sessionId, @studyGroup, @phase, @qid, @choice, @correct, @optionTag, @reason, @timeMs, @guess, @createdAt)
       ON CONFLICT (session_id, phase, qid) DO UPDATE SET
         choice = excluded.choice,
         correct = excluded.correct,
         option_tag = excluded.option_tag,
         reason = excluded.reason,
         time_ms = excluded.time_ms,
         guess = excluded.guess,
         created_at = excluded.created_at`,
    )
    .run({
      sessionId: input.sessionId,
      studyGroup: input.studyGroup,
      phase: input.phase,
      qid: input.qid,
      choice: input.choice,
      correct: input.correct ? 1 : 0,
      optionTag: input.optionTag,
      reason: input.reason,
      timeMs: input.timeMs,
      guess: input.guess ? 1 : 0,
      createdAt: now(),
    });
}

export function getAnswers(sessionId: string, phase: TestPhase): AnswerRow[] {
  return getDb()
    .prepare("SELECT * FROM answers WHERE session_id = ? AND phase = ? ORDER BY id")
    .all(sessionId, phase) as unknown as AnswerRow[];
}

export function getDiagnoses(sessionId: string) {
  return getDb()
    .prepare("SELECT * FROM diagnoses WHERE session_id = ? ORDER BY evidence_count DESC")
    .all(sessionId) as unknown as {
    code: string;
    evidence_count: number;
    status: string;
    evidence_json: string;
  }[];
}

export function getTutoringEvents(sessionId: string) {
  return getDb()
    .prepare("SELECT * FROM tutoring_events WHERE session_id = ? ORDER BY id")
    .all(sessionId) as unknown as {
    code: string;
    role: string;
    message: string;
    created_at: string;
  }[];
}

export function getMasteryChecks(sessionId: string) {
  return getDb()
    .prepare("SELECT * FROM mastery_checks WHERE session_id = ? ORDER BY id")
    .all(sessionId) as unknown as {
    code: string;
    q1_correct: number;
    q2_correct: number;
    explain_pass: number;
    mastered: number;
    explanation: string | null;
  }[];
}

/** Record one LLM call: what it was for, how long it took, tokens, and whether it worked. */
export function logLlmCall(input: {
  sessionId: string;
  studyGroup: StudyGroup | null;
  purpose: string;
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  ok: boolean;
  errorCode: string | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO llm_calls
         (session_id, study_group, purpose, model, latency_ms, input_tokens, output_tokens, ok, error_code, created_at)
       VALUES (@sessionId, @studyGroup, @purpose, @model, @latencyMs, @inputTokens, @outputTokens, @ok, @errorCode, @createdAt)`,
    )
    .run({
      sessionId: input.sessionId,
      studyGroup: input.studyGroup,
      purpose: input.purpose,
      model: input.model,
      latencyMs: input.latencyMs,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      ok: input.ok ? 1 : 0,
      errorCode: input.errorCode,
      createdAt: now(),
    });
}

export type DiagnosisRunRow = {
  session_id: string;
  used_ai: number;
  note: string | null;
  result_json: string;
  created_at: string;
};

export function getDiagnosisRun(sessionId: string): DiagnosisRunRow | null {
  const row = getDb().prepare("SELECT * FROM diagnosis_runs WHERE session_id = ?").get(sessionId) as unknown as
    | DiagnosisRunRow
    | undefined;
  return row ?? null;
}

/**
 * Store one session's diagnosis: the full result for the page, plus one row per
 * misconception for the teacher view and the CSV log. Saving twice replaces the first.
 */
export function saveDiagnosisRun(input: {
  sessionId: string;
  studyGroup: StudyGroup;
  usedAi: boolean;
  note: string | null;
  resultJson: string;
  codes: { code: string; evidenceCount: number; status: string; evidenceJson: string }[];
}): void {
  const db = getDb();
  const createdAt = now();
  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO diagnosis_runs (session_id, study_group, used_ai, note, result_json, created_at)
       VALUES (@sessionId, @studyGroup, @usedAi, @note, @resultJson, @createdAt)
       ON CONFLICT (session_id) DO UPDATE SET
         used_ai = excluded.used_ai, note = excluded.note, result_json = excluded.result_json, created_at = excluded.created_at`,
    ).run({
      sessionId: input.sessionId,
      studyGroup: input.studyGroup,
      usedAi: input.usedAi ? 1 : 0,
      note: input.note,
      resultJson: input.resultJson,
      createdAt,
    });
    db.prepare("DELETE FROM diagnoses WHERE session_id = ?").run(input.sessionId);
    const insert = db.prepare(
      `INSERT INTO diagnoses (session_id, study_group, code, evidence_count, status, evidence_json, created_at)
       VALUES (@sessionId, @studyGroup, @code, @evidenceCount, @status, @evidenceJson, @createdAt)`,
    );
    for (const row of input.codes) {
      insert.run({
        sessionId: input.sessionId,
        studyGroup: input.studyGroup,
        code: row.code,
        evidenceCount: row.evidenceCount,
        status: row.status,
        evidenceJson: row.evidenceJson,
        createdAt,
      });
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
