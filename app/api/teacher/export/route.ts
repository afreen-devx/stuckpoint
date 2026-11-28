import { NextResponse, type NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { allAnswers, allMasteryChecks, allSessions } from "@/lib/db";
import { loadPack } from "@/lib/pack";
import { isTeacher, summarise, TEACHER_COOKIE } from "@/lib/teacher";

export const runtime = "nodejs";

/**
 * Whole-class exports for the study analysis (teacher PIN required):
 *   ?kind=sessions  one row per session: group, scores, gain, misconceptions before and after
 *   ?kind=answers   one row per answer, every test, with the misconception tag
 */
export async function GET(request: NextRequest) {
  if (!isTeacher(request.cookies.get(TEACHER_COOKIE)?.value)) {
    return NextResponse.json({ error: "Enter the teacher PIN first." }, { status: 401 });
  }
  const kind = request.nextUrl.searchParams.get("kind") === "answers" ? "answers" : "sessions";
  const [sessions, answers] = await Promise.all([allSessions(), allAnswers()]);

  let csv: string;
  if (kind === "sessions") {
    const rows = summarise(loadPack(), sessions, answers, await allMasteryChecks()).map((r) => ({
      session_id: r.id,
      student_id: r.studentId,
      class_code: r.classCode,
      group: r.group,
      language: r.language,
      phase: r.phase,
      started_at: r.startedAt,
      pre: r.pre,
      post: r.post,
      gain: r.gain,
      retention: r.retention,
      showing_pre: r.showingPre.join(" "),
      showing_post: r.showingPost.join(" "),
      ideas_mastered: r.mastered,
    }));
    csv = toCsv(
      ["session_id", "student_id", "class_code", "group", "language", "phase", "started_at", "pre", "post", "gain", "retention", "showing_pre", "showing_post", "ideas_mastered"],
      rows,
    );
  } else {
    const who = new Map(sessions.map((s) => [s.id, s]));
    csv = toCsv(
      ["session_id", "student_id", "group", "test", "qid", "choice", "correct", "option_tag", "guess", "time_ms", "reason", "at"],
      answers.map((a) => ({
        session_id: a.session_id,
        student_id: who.get(a.session_id)?.student_id ?? "",
        group: a.study_group,
        test: a.phase,
        qid: a.qid,
        choice: a.choice,
        correct: a.correct,
        option_tag: a.option_tag,
        guess: a.guess,
        time_ms: a.time_ms,
        reason: a.reason ?? "",
        at: a.created_at,
      })),
    );
  }
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stuckpoint-class-${kind}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
