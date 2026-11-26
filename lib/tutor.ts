import { getAnswers, getDiagnosisRun, getMasteryChecks, getTutoringEvents, type SessionRow } from "./db";
import type { Diagnosis } from "./diagnosis";
import { questionLabel } from "./labels";
import type { Pack } from "./pack";
import { READY_TOKEN, type TutorEvidence } from "./prompts";

/** The code used for the foundations block in tutoring_events. */
export const FOUNDATIONS = "F";

export type TutorItemState = "done" | "skipped" | "current" | "todo";

export type TutorItem = {
  code: string;
  name: string;
  state: TutorItemState;
  /** True, false, or null when no mastery check was taken. */
  mastered: boolean | null;
};

export type TutorTurn = { role: "student" | "tutor"; text: string };

export function storedDiagnosis(sessionId: string): Diagnosis | null {
  const row = getDiagnosisRun(sessionId);
  return row ? (JSON.parse(row.result_json) as Diagnosis) : null;
}

/** The ideas to work through this session, in order, and where the student is. */
export function tutorPlan(session: SessionRow, pack: Pack): { items: TutorItem[]; current: TutorItem | null } {
  const d = storedDiagnosis(session.id);
  const queue = [...(d?.foundations && pack.foundations ? [FOUNDATIONS] : []), ...(d?.tutorQueue ?? [])];
  const events = getTutoringEvents(session.id);
  const checks = new Map(getMasteryChecks(session.id).map((c) => [c.code, c.mastered === 1]));

  let currentFound = false;
  const items = queue.map((code): TutorItem => {
    const name = code === FOUNDATIONS ? (pack.foundations?.title ?? "Foundations") : pack.misconceptions[code].name;
    const skipped = events.some((e) => e.code === code && e.role === "skip");
    const done = events.some((e) => e.code === code && e.role === "done");
    let state: TutorItemState = done ? "done" : skipped ? "skipped" : "todo";
    if (state === "todo" && !currentFound) {
      state = "current";
      currentFound = true;
    }
    return { code, name, state, mastered: checks.has(code) ? (checks.get(code) as boolean) : null };
  });
  return { items, current: items.find((i) => i.state === "current") ?? null };
}

/** The saved conversation for one idea, oldest first. */
export function conversation(sessionId: string, code: string): TutorTurn[] {
  return getTutoringEvents(sessionId)
    .filter((e) => e.code === code && (e.role === "student" || e.role === "tutor"))
    .map((e) => ({ role: e.role as "student" | "tutor", text: e.message }));
}

/** Strip the ready token from a tutor message, and say whether it was there. */
export function readReady(text: string): { text: string; ready: boolean } {
  const ready = text.includes(READY_TOKEN);
  return { text: text.split(READY_TOKEN).join("").trim(), ready };
}

/** What the student did on the pre-test that points at this misconception, for the tutor prompt. */
export function evidenceFor(session: SessionRow, pack: Pack, code: string): TutorEvidence[] {
  const d = storedDiagnosis(session.id);
  const result = [...(d?.found ?? []), ...(d?.possible ?? [])].find((r) => r.code === code);
  const qids = [...new Set((result?.evidence ?? []).map((e) => e.qid))];
  const answers = new Map(getAnswers(session.id, "pretest").map((a) => [a.qid, a]));
  return qids.flatMap((qid) => {
    const a = answers.get(qid);
    const q = pack.questions[qid];
    if (!a || !q || a.choice === null) return [];
    return [{ label: questionLabel(pack, qid), stem: q.stem, chose: q.options[a.choice], reason: (a.reason ?? "").trim() }];
  });
}

/** Post-test question stems, so the tutor and the mastery check never give them away. */
export function postStems(pack: Pack): string[] {
  return pack.sets.B_post.map((qid) => pack.questions[qid].stem);
}
