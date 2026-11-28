import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, getAnswers, getSession, latestSessionFor, setPhase } from "@/lib/db";
import { loadPack, retentionAvailable, testSet } from "@/lib/pack";
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
  phase: z.enum(["pretest", "diagnosis", "tutor", "mastery", "posttest", "results", "retention"]),
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

  const session = await createSession({
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

  const session = await getSession(parsed.data.id);
  if (!session) return bad("That session does not exist.", 404);

  const to = parsed.data.phase;
  if (session.phase === to) return NextResponse.json({ ok: true });
  if (!canMoveTo(session.phase, to)) {
    return bad(`You cannot go from ${session.phase} to ${to}.`, 409);
  }

  const pack = loadPack();
  if (to === "retention" && !retentionAvailable(pack)) {
    return bad("The retention test is not available yet.", 409);
  }

  // Leaving a test requires every question in its set to be answered.
  if (session.phase === "pretest" || session.phase === "posttest" || session.phase === "retention") {
    const set = testSet(pack, session.phase);
    const answered = new Set(
      (await getAnswers(session.id, session.phase))
        .filter((a) => a.choice !== null)
        .map((a) => a.qid),
    );
    const missing = set.filter((qid) => !answered.has(qid));
    if (missing.length > 0) {
      return bad(`Answer every question first. ${missing.length} still open.`, 409);
    }
  }

  await setPhase(session.id, to);
  return NextResponse.json({ ok: true });
}

/**
 * Find a returning student's session by their anonymous ID, for the retention test:
 * GET /api/sessions?studentId=S382. Returns the latest session that has reached the results.
 */
export async function GET(request: Request) {
  const studentId = new URL(request.url).searchParams.get("studentId")?.trim().toUpperCase() ?? "";
  if (!/^[A-Z0-9]{2,8}$/.test(studentId)) return bad("Enter the student ID you used before.");
  const session = await latestSessionFor(studentId);
  if (!session) return bad("No finished session found for that ID. Check it and try again.", 404);
  return NextResponse.json({ id: session.id, phase: session.phase });
}
