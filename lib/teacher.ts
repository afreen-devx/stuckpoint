import { createHash } from "node:crypto";
import type { AnswerRow, LlmCallRow, MasteryCheckRow, SessionRow } from "./db";
import type { Pack } from "./pack";
import type { StudyGroup } from "./types";

/**
 * Class-level numbers for the teacher view and the class export.
 * Pure functions over rows, so they are easy to test and give the same answer everywhere.
 */

export type SessionSummary = {
  id: string;
  studentId: string;
  classCode: string;
  group: StudyGroup;
  language: string;
  phase: string;
  startedAt: string;
  pre: number | null;
  post: number | null;
  retention: number | null;
  gain: number | null;
  /** Misconceptions shown by wrong answers (guesses and slips excluded). */
  showingPre: string[];
  showingPost: string[];
  mastered: number;
};

export type GroupStats = {
  group: StudyGroup;
  sessions: number;
  finished: number;
  meanPre: number | null;
  meanPost: number | null;
  meanGain: number | null;
  meanRetention: number | null;
  retentionTaken: number;
  /** Of the misconceptions showing before, how many were gone after. */
  fixed: number;
  showingBefore: number;
  mastered: number;
};

export type AiStats = { calls: number; failed: number; rateLimited: number; timeouts: number; medianMs: number | null };

const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

function score(rows: AnswerRow[], size: number): number | null {
  const answered = rows.filter((a) => a.choice !== null);
  return size > 0 && answered.length === size ? answered.filter((a) => a.correct === 1).length : null;
}

function showing(rows: AnswerRow[]): string[] {
  const codes = new Set<string>();
  for (const a of rows) {
    if (a.correct === 1 || a.guess === 1 || !a.option_tag || a.option_tag === "C0") continue;
    codes.add(a.option_tag);
  }
  return [...codes].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

export function summarise(
  pack: Pack,
  sessions: SessionRow[],
  answers: AnswerRow[],
  checks: (MasteryCheckRow & { session_id: string })[],
): SessionSummary[] {
  const bySession = new Map<string, AnswerRow[]>();
  for (const a of answers) bySession.set(a.session_id, [...(bySession.get(a.session_id) ?? []), a]);
  return sessions.map((s) => {
    const rows = bySession.get(s.id) ?? [];
    const of = (phase: string) => rows.filter((a) => a.phase === phase);
    const pre = score(of("pretest"), pack.sets.A_pre.length);
    const post = score(of("posttest"), pack.sets.B_post.length);
    return {
      id: s.id,
      studentId: s.student_id,
      classCode: s.class_code ?? "",
      group: s.study_group,
      language: s.language,
      phase: s.phase,
      startedAt: s.created_at,
      pre,
      post,
      retention: score(of("retention"), pack.sets.C_retention.length),
      gain: pre !== null && post !== null ? post - pre : null,
      showingPre: showing(of("pretest")),
      showingPost: post !== null ? showing(of("posttest")) : [],
      mastered: checks.filter((c) => c.session_id === s.id && c.mastered === 1).length,
    };
  });
}

export function groupStats(rows: SessionSummary[]): GroupStats[] {
  return (["stuckpoint", "control"] as StudyGroup[])
    .map((group) => {
      const mine = rows.filter((r) => r.group === group);
      const done = mine.filter((r) => r.pre !== null && r.post !== null);
      const withRet = done.filter((r) => r.retention !== null);
      let fixed = 0;
      let before = 0;
      for (const r of done) {
        before += r.showingPre.length;
        fixed += r.showingPre.filter((c) => !r.showingPost.includes(c)).length;
      }
      return {
        group,
        sessions: mine.length,
        finished: done.length,
        meanPre: mean(done.map((r) => r.pre as number)),
        meanPost: mean(done.map((r) => r.post as number)),
        meanGain: mean(done.map((r) => r.gain as number)),
        meanRetention: mean(withRet.map((r) => r.retention as number)),
        retentionTaken: withRet.length,
        fixed,
        showingBefore: before,
        mastered: mine.reduce((n, r) => n + r.mastered, 0),
      };
    })
    .filter((g) => g.sessions > 0);
}

export function aiStats(calls: LlmCallRow[]): AiStats {
  const ok = calls.filter((c) => c.ok === 1).map((c) => c.latency_ms).sort((a, b) => a - b);
  return {
    calls: calls.length,
    failed: calls.filter((c) => c.ok !== 1).length,
    rateLimited: calls.filter((c) => c.error_code === "rate_limited").length,
    timeouts: calls.filter((c) => c.error_code === "timeout").length,
    medianMs: ok.length ? ok[Math.floor(ok.length / 2)] : null,
  };
}

/* ---------- PIN ---------- */

export const TEACHER_COOKIE = "sp_teacher";

/** The cookie holds a hash of the PIN, never the PIN itself. */
export function pinToken(pin: string): string {
  return createHash("sha256").update(`stuckpoint-teacher:${pin}`).digest("hex");
}

export function teacherPin(): string {
  return (process.env.TEACHER_PIN ?? "").trim();
}

export function isTeacher(cookieValue: string | undefined): boolean {
  const pin = teacherPin();
  return pin.length > 0 && cookieValue === pinToken(pin);
}
