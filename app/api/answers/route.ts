import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, saveAnswer } from "@/lib/db";
import { isGuess } from "@/lib/guess";
import { loadPack } from "@/lib/pack";
import { scoreChoice } from "@/lib/scoring";

export const runtime = "nodejs";

const Body = z.object({
  sessionId: z.string().uuid(),
  phase: z.enum(["pretest", "posttest"]),
  qid: z.string().regex(/^Q\d+$/),
  choice: z.number().int().min(0).max(3),
  reason: z.string().max(160).default(""),
  timeMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
});

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Save one answer. The score is worked out here from the pack's answer key,
 * and is never sent back to the browser during the test.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return bad("Invalid answer.");
  const { sessionId, phase, qid, choice, timeMs } = parsed.data;

  const session = getSession(sessionId);
  if (!session) return bad("That session does not exist.", 404);
  if (session.phase !== phase) {
    return bad("This test is already finished. Refresh the page to continue.", 409);
  }

  const pack = loadPack();
  const set = phase === "pretest" ? pack.sets.A_pre : pack.sets.B_post;
  if (!set.includes(qid)) return bad("That question is not part of this test.");
  const question = pack.questions[qid];

  // Reasons are only collected on the pre-test.
  const reason = phase === "pretest" ? parsed.data.reason.trim() : "";
  const { correct, optionTag } = scoreChoice(question, choice);

  saveAnswer({
    sessionId,
    studyGroup: session.study_group,
    phase,
    qid,
    choice,
    correct,
    optionTag,
    reason,
    timeMs,
    // Same rule on both tests, so the before and after comparison is fair.
    // The post-test has no reasons, so only the time part applies there.
    guess: isGuess(reason, timeMs),
  });

  return NextResponse.json({ ok: true });
}
