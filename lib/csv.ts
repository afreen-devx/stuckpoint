import { getAnswers, getDiagnoses, getMasteryChecks, getSession, getTutoringEvents } from "./db";

/** RFC 4180 style escaping: quote anything that contains a comma, quote or newline. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const head = columns.join(",");
  const body = rows.map((row) => columns.map((column) => cell(row[column])).join(","));
  return [head, ...body].join("\n");
}

/** Columns of the session log. One row per recorded event. */
export const LOG_COLUMNS = [
  "record",
  "at",
  "phase",
  "qid",
  "choice",
  "correct",
  "option_tag",
  "reason",
  "time_ms",
  "guess",
  "code",
  "detail",
];

/**
 * A flat log of one session: who (anonymous id), what was answered, what was
 * diagnosed, what was said in tutoring, and how mastery went.
 */
export async function buildSessionLog(sessionId: string): Promise<Record<string, unknown>[]> {
  const session = await getSession(sessionId);
  if (!session) return [];

  const rows: Record<string, unknown>[] = [
    {
      record: "session",
      at: session.created_at,
      phase: session.phase,
      code: session.class_code ?? "",
      detail: `student ${session.student_id}, language ${session.language}, group ${session.study_group}`,
    },
  ];

  for (const answer of await getAnswers(sessionId, "pretest")) {
    rows.push({
      record: "answer",
      at: answer.created_at,
      phase: "pretest",
      qid: answer.qid,
      choice: answer.choice,
      correct: answer.correct,
      option_tag: answer.option_tag,
      reason: answer.reason,
      time_ms: answer.time_ms,
      guess: answer.guess,
    });
  }
  for (const answer of await getAnswers(sessionId, "posttest")) {
    rows.push({
      record: "answer",
      at: answer.created_at,
      phase: "posttest",
      qid: answer.qid,
      choice: answer.choice,
      correct: answer.correct,
      option_tag: answer.option_tag,
      reason: "",
      time_ms: answer.time_ms,
      guess: answer.guess,
    });
  }
  for (const diagnosis of await getDiagnoses(sessionId)) {
    rows.push({
      record: "diagnosis",
      code: diagnosis.code,
      detail: `${diagnosis.status}, evidence ${diagnosis.evidence_count}: ${diagnosis.evidence_json}`,
    });
  }
  for (const event of await getTutoringEvents(sessionId)) {
    rows.push({
      record: "tutor",
      at: event.created_at,
      code: event.code,
      phase: event.role,
      detail: event.message,
    });
  }
  for (const check of await getMasteryChecks(sessionId)) {
    rows.push({
      record: "mastery",
      code: check.code,
      detail: `q1 ${check.q1_correct}, q2 ${check.q2_correct}, explain ${check.explain_pass}, mastered ${check.mastered}. ${check.explanation ?? ""}`,
    });
  }

  return rows;
}
