import { NextResponse } from "next/server";
import { z } from "zod";
import { addTutoringEvent, getSession, getTutoringEvents, saveMasteryCheck } from "@/lib/db";
import { completeJSON, llmConfigured, LlmError } from "@/lib/llm";
import { loadPack } from "@/lib/pack";
import { explainGradePrompt, masteryQuestionsPrompt, solverPrompt } from "@/lib/prompts";
import { postStems, tutorPlan } from "@/lib/tutor";

export const runtime = "nodejs";

const Question = z.object({
  stem: z.string().min(10),
  options: z.array(z.string().min(1)).length(4),
  answer: z.number().int().min(0).max(3),
  why: z.string().default(""),
});
type Question = z.infer<typeof Question>;

const Make = z.object({ sessionId: z.string().uuid(), code: z.string().regex(/^M\d+$/), action: z.literal("make") });
const Submit = z.object({
  sessionId: z.string().uuid(),
  code: z.string().regex(/^M\d+$/),
  action: z.literal("submit"),
  choices: z.array(z.number().int().min(0).max(3)).max(2),
  explanation: z.string().trim().min(1).max(400),
});

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * The mastery check for one idea.
 * "make": the AI writes 3 questions, a second, independent AI call solves them, and only the questions
 *   where both agree are kept (at most 2). Answers stay on the server.
 * "submit": the choices are scored against the kept answers, and the own-words explanation is graded.
 *   Mastered means every kept question right and the explanation passed.
 */
export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const make = Make.safeParse(raw);
  const submit = Submit.safeParse(raw);
  if (!make.success && !submit.success) return bad("Invalid request.");
  const { sessionId, code } = make.success ? make.data : submit.data!;

  const session = getSession(sessionId);
  if (!session) return bad("That session does not exist.", 404);
  if (session.phase !== "tutor") return bad("Tutoring is finished. Refresh the page.", 409);
  if (!llmConfigured()) return bad("The AI is not set up, so the check cannot run.", 503);

  const pack = loadPack();
  const { current } = tutorPlan(session, pack);
  if (!current || current.code !== code) return bad("That idea is not the current one. Refresh the page.", 409);
  const ctx = { sessionId: session.id, studyGroup: session.study_group, purpose: "mastery" };

  try {
    if (make.success) {
      const gen = masteryQuestionsPrompt(pack, code, postStems(pack));
      const written = await completeJSON<Question[]>(
        ctx,
        { system: gen.system, messages: [{ role: "user", content: gen.user }] },
        z.array(Question).min(1).max(4),
      );
      const solve = solverPrompt(pack, written);
      const solved = await completeJSON<number[]>(
        { ...ctx, purpose: "mastery-solver" },
        { system: solve.system, messages: [{ role: "user", content: solve.user }] },
        z.array(z.number().int()),
      );
      // Keep only questions the independent solver answered the same way.
      const kept = written.filter((q, i) => solved[i] === q.answer).slice(0, 2);
      addTutoringEvent({
        sessionId: session.id,
        studyGroup: session.study_group,
        code,
        role: "check",
        message: JSON.stringify({ questions: kept, written: written.length }),
      });
      return NextResponse.json({
        questions: kept.map((q) => ({ stem: q.stem, options: q.options })),
        prompt: `In your own words, explain the idea behind "${pack.misconceptions[code].name}".`,
      });
    }

    // Submit: score against the questions saved by the last "make".
    const data = submit.data!;
    const last = [...getTutoringEvents(session.id)].reverse().find((e) => e.code === code && e.role === "check");
    if (!last) return bad("Start the check first.", 409);
    const kept = (JSON.parse(last.message) as { questions: Question[] }).questions;
    if (data.choices.length !== kept.length) return bad("Answer every question first.");
    const correct = kept.map((q, i) => data.choices[i] === q.answer);

    const grade = explainGradePrompt(pack, code, session.language, data.explanation);
    const verdict = await completeJSON<{ pass: boolean; feedback: string }>(
      { ...ctx, purpose: "mastery-explain" },
      { system: grade.system, messages: [{ role: "user", content: grade.user }] },
      z.object({ pass: z.boolean(), feedback: z.string().default("") }),
    );

    const mastered = correct.every(Boolean) && verdict.pass;
    // -1 marks a question that was not asked because the solver disagreed with it.
    const flag = (i: number) => (i < correct.length ? (correct[i] ? 1 : 0) : -1);
    saveMasteryCheck({
      sessionId: session.id,
      studyGroup: session.study_group,
      code,
      q1Correct: flag(0),
      q2Correct: flag(1),
      explainPass: verdict.pass,
      mastered,
      explanation: data.explanation,
    });

    return NextResponse.json({
      correct,
      answers: kept.map((q) => q.answer),
      why: kept.map((q) => q.why),
      explainPass: verdict.pass,
      feedback: verdict.feedback,
      mastered,
    });
  } catch (error) {
    const why = error instanceof LlmError ? error.message : "Something went wrong.";
    return bad(`The check could not run: ${why}`, 503);
  }
}
