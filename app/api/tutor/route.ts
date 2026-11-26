import { NextResponse } from "next/server";
import { z } from "zod";
import { addTutoringEvent, getSession } from "@/lib/db";
import { llmConfigured, LlmError, streamText } from "@/lib/llm";
import { loadPack } from "@/lib/pack";
import { tutorOpening, tutorSystemPrompt, wrapStudent } from "@/lib/prompts";
import { conversation, evidenceFor, FOUNDATIONS, postStems, tutorPlan } from "@/lib/tutor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Marks an error in the text stream. The browser shows the message instead of a tutor reply. */
const ERROR_MARK = "\u0000ERROR:";

const Body = z.object({
  sessionId: z.string().uuid(),
  code: z.string().regex(/^M\d+$/),
  message: z.string().trim().max(600).optional(),
});

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * One tutor turn. Saves the student's message (if any), streams the tutor's reply as plain text,
 * and saves the reply when it is complete. With no message, the tutor opens the conversation.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return bad("Invalid message.");
  const { sessionId, code, message } = parsed.data;

  const session = getSession(sessionId);
  if (!session) return bad("That session does not exist.", 404);
  if (session.phase !== "tutor") return bad("Tutoring is finished for this session. Refresh the page.", 409);
  if (!llmConfigured()) return bad("The AI is not set up, so the tutor cannot run. Skip to the post-test.", 503);

  const pack = loadPack();
  const { current } = tutorPlan(session, pack);
  if (!current || current.code !== code || code === FOUNDATIONS) return bad("That idea is not the current one. Refresh the page.", 409);

  const history = conversation(session.id, code);
  if (message) {
    addTutoringEvent({ sessionId: session.id, studyGroup: session.study_group, code, role: "student", message });
    history.push({ role: "student", text: message });
  } else if (history.length > 0 && history[history.length - 1].role !== "student") {
    // No message is allowed only to open the conversation, or to retry after a failed reply.
    return bad("Write a reply first.");
  }

  const evidence = evidenceFor(session, pack, code);
  const system = tutorSystemPrompt({
    pack,
    code,
    evidence,
    language: session.language,
    postStems: postStems(pack),
    studentTurns: history.filter((t) => t.role === "student").length,
  });
  const messages = [
    { role: "user" as const, content: tutorOpening(evidence[0]?.label ?? null) },
    ...history.map((t) =>
      t.role === "student"
        ? { role: "user" as const, content: wrapStudent(t.text) }
        : { role: "assistant" as const, content: t.text },
    ),
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const reply = await streamText(
          { sessionId: session.id, studyGroup: session.study_group, purpose: "tutor" },
          { system, messages, maxTokens: 4000 },
          (piece) => controller.enqueue(encoder.encode(piece)),
        );
        addTutoringEvent({ sessionId: session.id, studyGroup: session.study_group, code, role: "tutor", message: reply });
      } catch (error) {
        const why = error instanceof LlmError ? error.message : "Something went wrong.";
        controller.enqueue(encoder.encode(`${ERROR_MARK}${why}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
