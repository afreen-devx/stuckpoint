import { NextResponse } from "next/server";
import { z } from "zod";
import { addTutoringEvent, getSession } from "@/lib/db";
import { loadPack } from "@/lib/pack";
import { tutorPlan } from "@/lib/tutor";

export const runtime = "nodejs";

const Body = z.object({
  sessionId: z.string().uuid(),
  code: z.string().regex(/^(F|M\d+)$/),
  action: z.enum(["done", "skip"]),
  /** Foundations only: how many check questions were right, for the log. */
  note: z.string().max(200).optional(),
});

/** Finish or skip the current idea, so the tutor moves to the next one. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { sessionId, code, action, note } = parsed.data;

  const session = getSession(sessionId);
  if (!session) return NextResponse.json({ error: "That session does not exist." }, { status: 404 });
  if (session.phase !== "tutor") return NextResponse.json({ error: "Tutoring is finished. Refresh the page." }, { status: 409 });

  const { current } = tutorPlan(session, loadPack());
  if (!current || current.code !== code) {
    return NextResponse.json({ error: "That idea is not the current one. Refresh the page." }, { status: 409 });
  }

  addTutoringEvent({ sessionId: session.id, studyGroup: session.study_group, code, role: action, message: note ?? "" });
  return NextResponse.json({ ok: true });
}
