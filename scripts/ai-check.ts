/**
 * Checks the real AI connection in about 30 seconds, using the app's own code and your .env:
 *   npm run ai:check
 * 1. A diagnosis call (JSON back), like the one after the pre-test.
 * 2. A streamed tutor reply, like the tutor page, timed to the first word.
 * It never prints your API key. The calls are logged like any other, under session "ai-check".
 */
import { z } from "zod";
import { completeJSON, llmConfigured, LlmError, streamText } from "../lib/llm.ts";
import { loadPack } from "../lib/pack.ts";
import { diagnosisPrompt, tutorOpening, tutorSystemPrompt } from "../lib/prompts.ts";
import { postStems } from "../lib/tutor.ts";

const ctx = { sessionId: "ai-check", studyGroup: null, purpose: "ai-check" };
const key = (process.env.LLM_API_KEY ?? "").trim();
console.log(`Provider ${process.env.LLM_PROVIDER ?? "google"}, model ${process.env.LLM_MODEL || "(not set)"}, fallback ${process.env.LLM_FALLBACK_MODEL || "(none)"}, key ${key ? `set (${key.length} characters)` : "MISSING"}`);
if (!llmConfigured()) {
  console.log("\nNot set up: add LLM_MODEL and LLM_API_KEY to .env, then run this again.");
  process.exit(1);
}

const pack = loadPack();
let failed = false;

// 1. Diagnosis: one wrong answer with a clear reason should come back as M1.
const q1 = pack.questions[pack.sets.A_pre[0]];
const wrong = q1.tags.findIndex((t) => t === "M1");
try {
  const t0 = Date.now();
  const { system, user } = diagnosisPrompt(pack, [{ qid: pack.sets.A_pre[0], choice: wrong, reason: "it stops at the top so there is no acceleration" }]);
  const verdicts = await completeJSON<{ q: string; code: string; confidence: number }[]>(
    { ...ctx, purpose: "ai-check-diagnosis" },
    { system, messages: [{ role: "user", content: user }], thinking: "low" },
    z.array(z.object({ q: z.string(), code: z.string(), confidence: z.number() }).passthrough()),
  );
  const v = verdicts[0];
  console.log(`\n1. Diagnosis: OK in ${((Date.now() - t0) / 1000).toFixed(1)} s. Read the reason as ${v?.code ?? "nothing"} (confidence ${v?.confidence ?? "-"}). Expected M1.`);
} catch (error) {
  failed = true;
  console.log(`\n1. Diagnosis: FAILED. ${error instanceof LlmError ? error.message : String(error)}`);
}

// 2. Tutor: stream an opening reply in Telugu-English mix and time the first word.
try {
  const t0 = Date.now();
  let first = 0;
  const evidence = [{ label: "Q01", stem: q1.stem, chose: q1.options[wrong], reason: "it stops at the top so there is no acceleration" }];
  const system = tutorSystemPrompt({ pack, code: "M1", evidence, language: "mix", postStems: postStems(pack), studentTurns: 0 });
  process.stdout.write("\n2. Tutor (Telugu-English mix): ");
  const reply = await streamText(
    { ...ctx, purpose: "ai-check-tutor" },
    { system, messages: [{ role: "user", content: tutorOpening("Q01") }], maxTokens: 4000, thinking: "low" },
    (piece) => {
      if (!first) first = Date.now();
      process.stdout.write(piece);
    },
  );
  console.log(`\n   OK. First words after ${((first - t0) / 1000).toFixed(1)} s, done in ${((Date.now() - t0) / 1000).toFixed(1)} s, ${reply.length} characters.`);
} catch (error) {
  failed = true;
  console.log(`\n   FAILED. ${error instanceof LlmError ? error.message : String(error)}`);
}

console.log(failed ? "\nSomething failed. Send a screenshot of this window." : "\nAll good: the AI works for diagnosis and tutoring.");
process.exit(failed ? 1 : 0);
