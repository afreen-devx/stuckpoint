import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, getAnswers, getSession, setPhase } from "@/lib/db";
import { loadPack } from "@/lib/pack";
import { canMoveTo } from "@/lib/session";
import type { StudyGroup } from "@/lib/types";

export const runtime = "nodejs";

const CreateBody = z.object({
  studentId: z.string().regex(/^[A-Z0-9]{2,8}$/, "Student ID must be 2 to 8 capital letters or numbers."),
  classCode: z
    .string()
    .regex(/^[A-Z0-9]{1,12}$/, "Class code must be up to 12 capital letters or numbers.")
    .nullable(),
  language: z.enum(["en", "te", "mix", "hi", "hinglish"]),
  consent: z.boolean().optional(),
});

const MoveBody = z.object({
  id: z.string().uuid(),
  phase: z.enum(["pretest", "diagnosis", "tutor", "mastery", "posttest", "results"]),
});

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Start a new session. In study mode, consent is required and the group is chosen at random. */
export async function POST(request: Request) {
  const parsed = CreateBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid request.");

  const studyMode = process.env.STUDY_MODE === "true";
  if (studyMode && !parsed.data.consent) {
    return bad("Please tick the consent box to take part in the study.");
  }
  const studyGroup: StudyGroup = studyMode ? (Math.random() < 0.5 ? "stuckpoint" : "control") : "stuckpoint";

  const session = createSession({
    studentId: parsed.data.studentId,
    classCode: parsed.data.classCode,
    language: parsed.data.language,
    studyGroup,
  });
  return NextResponse.json({ id: session.id });
}

/**
 * Move a session to its next step. The server checks the move is allowed,
 * and that a test is fully answered before it can be left.
 */
export async function PATCH(request: Request) {
  const parsed = MoveBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return bad("Invalid request.");

  const session = getSession(parsed.data.id);
  if (!session) return bad("That session does not exist.", 404);

  const to = parsed.data.phase;
  if (session.phase === to) return NextResponse.json({ ok: true });
  if (!canMoveTo(session.phase, to)) {
    return bad(`You cannot go from ${session.phase} to ${to}.`, 409);
  }

  // Leaving a test requires every question in its set to be answered.
  if (session.phase === "pretest" || session.phase === "posttest") {
    const pack = loadPack();
    const set = session.phase === "pretest" ? pack.sets.A_pre : pack.sets.B_post;
    const answered = new Set(
      getAnswers(session.id, session.phase)
        .filter((a) => a.choice !== null)
        .map((a) => a.qid),
    );
    const missing = set.filter((qid) => !answered.has(qid));
    if (missing.length > 0) {
      return bad(`Answer every question first. ${missing.length} still open.`, 409);
    }
  }

  setPhase(session.id, to);
  return NextResponse.json({ ok: true });
}
