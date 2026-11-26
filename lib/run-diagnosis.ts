import { z } from "zod";
import { getAnswers, getDiagnosisRun, saveDiagnosisRun, type SessionRow } from "./db";
import { computeDiagnosis, type Diagnosis, type DiagnosisAnswer, type ReasonVerdict } from "./diagnosis";
import { completeJSON, llmConfigured, LlmError } from "./llm";
import { loadPack } from "./pack";
import { diagnosisPrompt } from "./prompts";
import { substantiveReason } from "./reasons";

const VerdictsSchema = z.array(
  z.object({
    q: z.string(),
    code: z.string(),
    confidence: z.number().min(0).max(1),
    guess: z.boolean().optional().default(false),
    evidence: z.string().optional().default(""),
  }),
);

/**
 * Get this session's diagnosis. It is worked out once and stored, so reloading the page
 * never calls the AI again. If the AI fails, the tag-only result is shown but not stored,
 * so a reload tries the AI again.
 */
export async function getOrRunDiagnosis(session: SessionRow): Promise<Diagnosis> {
  const stored = await getDiagnosisRun(session.id);
  if (stored) return JSON.parse(stored.result_json) as Diagnosis;

  const pack = loadPack();
  const answers: DiagnosisAnswer[] = (await getAnswers(session.id, "pretest")).map((a) => ({
    qid: a.qid,
    choice: a.choice,
    correct: a.correct === 1,
    optionTag: a.option_tag,
    reason: a.reason ?? "",
    guess: a.guess === 1,
  }));

  // Only reasons worth reading go to the AI: not a guess, and saying more than a chip on its own.
  const items = answers
    .filter((a) => !a.guess && a.choice !== null && substantiveReason(a.reason) !== "")
    .map((a) => ({ qid: a.qid, choice: a.choice as number, reason: a.reason.trim() }));

  let verdicts: ReasonVerdict[] | null = null;
  let note: string | null = null;
  let store = true;

  if (items.length === 0) {
    note = "No reasons said enough to read, so this diagnosis uses your answer choices only.";
  } else if (!llmConfigured()) {
    note = "The AI is not set up yet, so this diagnosis uses your answer choices only.";
  } else {
    try {
      const { system, user } = diagnosisPrompt(pack, items);
      const raw = await completeJSON<ReasonVerdict[]>(
        { sessionId: session.id, studyGroup: session.study_group, purpose: "diagnosis" },
        { system, messages: [{ role: "user", content: user }], thinking: "low" },
        VerdictsSchema,
      );
      const asked = new Set(items.map((i) => i.qid));
      verdicts = raw.filter((v) => asked.has(v.q));
    } catch (error) {
      const why = error instanceof LlmError ? error.message : "Something went wrong.";
      note = `The AI could not read your reasons (${why}) This diagnosis uses your answer choices only. Reload the page to try again.`;
      store = false;
    }
  }

  const diagnosis = computeDiagnosis(pack, answers, verdicts, note);

  if (store) {
    await saveDiagnosisRun({
      sessionId: session.id,
      studyGroup: session.study_group,
      usedAi: diagnosis.usedAi,
      note,
      resultJson: JSON.stringify(diagnosis),
      codes: [...diagnosis.found, ...diagnosis.possible].map((r) => ({
        code: r.code,
        evidenceCount: r.count,
        status: r.status,
        evidenceJson: JSON.stringify(r.evidence),
      })),
    });
  }
  return diagnosis;
}
