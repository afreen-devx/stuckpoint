import { notFound, redirect } from "next/navigation";
import type { SavedAnswer, TestQuestion } from "@/components/TestRunner";
import { getAnswers, getSession, type SessionRow } from "./db";
import { loadPack, testSet } from "./pack";
import { phaseHref } from "./session";
import type { TestPhase } from "./types";

/**
 * Everything a test page needs, loaded on the server.
 * The answer key (tags) is deliberately left out of what goes to the browser.
 */
export async function loadTestPage(
  id: string,
  phase: TestPhase,
): Promise<{ session: SessionRow; questions: TestQuestion[]; initialAnswers: SavedAnswer[] }> {
  const session = await getSession(id);
  if (!session) notFound();
  // A student can only be on the step their session is on.
  if (session.phase !== phase) redirect(phaseHref(session.id, session.phase));

  const pack = loadPack();
  const set = testSet(pack, phase);
  const questions: TestQuestion[] = set.map((qid) => {
    const q = pack.questions[qid];
    return {
      qid,
      stem: q.stem,
      options: q.options,
      graph: q.graph ? pack.graphs[q.graph] : undefined,
    };
  });

  const initialAnswers: SavedAnswer[] = (await getAnswers(session.id, phase)).map((a) => ({
    qid: a.qid,
    choice: a.choice,
    reason: a.reason ?? "",
    timeMs: a.time_ms,
  }));

  return { session, questions, initialAnswers };
}
