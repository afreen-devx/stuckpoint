import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

/**
 * A topic pack is one JSON file in packs/. Everything the tutor teaches comes
 * from this file, so the model never invents the curriculum.
 */

const GraphLineSchema = z.object({
  points: z.array(z.tuple([z.number(), z.number()])).min(2),
  label: z.string().optional(),
});

const GraphSchema = z.object({
  xLabel: z.string(),
  yLabel: z.string(),
  xMax: z.number().positive(),
  yMax: z.number().positive(),
  lines: z.array(GraphLineSchema).min(1),
  marker: z.object({ x: z.number(), label: z.string() }).optional(),
});

const QuestionSchema = z.object({
  stem: z.string().min(1),
  options: z.array(z.string().min(1)),
  // One tag per option: a misconception code, "C0" for a calculation slip, or null for the right answer.
  tags: z.array(z.string().nullable()),
  graph: z.string().optional(),
});

const ConceptSchema = z.object({
  id: z.string(),
  name: z.string(),
  explain: z.string(),
  example: z.string(),
  check: z.object({
    stem: z.string(),
    options: z.array(z.string()),
    answer: z.number().int().min(0).max(3),
    why: z.string(),
  }),
});

const PackSchema = z.object({
  id: z.string(),
  title: z.string(),
  conventions: z.string(),
  misconceptions: z.record(
    z.string(),
    z.object({ name: z.string(), belief: z.string(), truth: z.string() }),
  ),
  graphs: z.record(z.string(), GraphSchema).default({}),
  questions: z.record(z.string(), QuestionSchema),
  sets: z.object({
    A_pre: z.array(z.string()),
    B_post: z.array(z.string()),
    // The team will write this set later. Empty means "not available yet".
    C_retention: z.array(z.string()).default([]),
  }),
  // Human-written foundations for students who score 3/10 or lower.
  foundations: z
    .object({
      title: z.string(),
      intro: z.string(),
      concepts: z.array(ConceptSchema).min(1),
    })
    .optional(),
});

export type Pack = z.infer<typeof PackSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type GraphSpec = z.infer<typeof GraphSchema>;

export type ValidationResult = {
  pack: Pack | null;
  errors: string[];
  warnings: string[];
};

export class PackError extends Error {
  constructor(public problems: string[]) {
    super(`Topic pack is invalid. Fix these problems:\n${problems.join("\n")}`);
    this.name = "PackError";
  }
}

/**
 * Pure validation so tests can throw broken packs at it.
 * Errors stop the app. Warnings are shown but allow it to run.
 */
export function validatePack(raw: unknown): ValidationResult {
  const parsed = PackSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      pack: null,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "pack"}: ${issue.message}`),
      warnings: [],
    };
  }

  const pack = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [qid, question] of Object.entries(pack.questions)) {
    if (question.options.length !== 4) {
      errors.push(`${qid}: needs exactly 4 options, found ${question.options.length}.`);
    }
    if (question.tags.length !== question.options.length) {
      errors.push(
        `${qid}: ${question.tags.length} tags for ${question.options.length} options. Each option needs one tag.`,
      );
    }
    const nullTags = question.tags.filter((tag) => tag === null).length;
    if (nullTags !== 1) {
      errors.push(`${qid}: needs exactly one null tag for the correct answer, found ${nullTags}.`);
    }
    for (const tag of question.tags) {
      if (tag !== null && tag !== "C0" && !pack.misconceptions[tag]) {
        errors.push(`${qid}: unknown misconception code "${tag}".`);
      }
    }
    if (question.graph && !pack.graphs[question.graph]) {
      errors.push(`${qid}: points at graph "${question.graph}" which is not in the pack.`);
    }
  }

  for (const [name, set] of Object.entries(pack.sets)) {
    for (const qid of set) {
      if (!pack.questions[qid]) {
        errors.push(`Set ${name} references missing question ${qid}.`);
      }
    }
    if (new Set(set).size !== set.length) {
      errors.push(`Set ${name} lists the same question twice.`);
    }
    if (name === "C_retention") {
      if (set.length > 0 && set.length < 10) {
        warnings.push(
          `Set C_retention has ${set.length} questions, so retention stays unavailable until it reaches 10.`,
        );
      }
      if (set.length === 0) {
        warnings.push("Set C_retention is empty. Retention results will show as not available yet.");
      }
    } else if (set.length !== 10) {
      warnings.push(`Set ${name} has ${set.length} questions. The flow expects 10.`);
    }
  }

  // Both tests should cover every misconception, otherwise a student can never be diagnosed on one.
  const codesInSet = (qids: string[]) => {
    const codes = new Set<string>();
    for (const qid of qids) {
      for (const tag of pack.questions[qid]?.tags ?? []) if (tag && tag !== "C0") codes.add(tag);
    }
    return codes;
  };
  for (const name of ["A_pre", "B_post"]) {
    const codes = codesInSet(pack.sets[name as "A_pre" | "B_post"]);
    const missing = Object.keys(pack.misconceptions).filter((code) => !codes.has(code));
    if (missing.length > 0) warnings.push(`Set ${name} does not touch ${missing.join(", ")}.`);
  }

  return { pack, errors, warnings };
}

let cached: Pack | null = null;

/** Read packs/<id>.json and validate it. Throws PackError so the failure is loud. */
export function loadPack(packId = "KIN-01"): Pack {
  if (cached && cached.id === packId) return cached;

  const file = path.join(process.cwd(), "packs", `${packId}.json`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new PackError([`Could not read or parse ${file}.`]);
  }

  const { pack, errors } = validatePack(raw);
  if (!pack || errors.length > 0) throw new PackError(errors);
  cached = pack;
  return pack;
}

/** The question ids of one test set, guarded so a missing set is obvious. */
export function setQuestions(pack: Pack, name: "A_pre" | "B_post" | "C_retention"): string[] {
  return pack.sets[name];
}

/** True when the retention set can be used: exactly the ten questions the flow expects. */
export function retentionAvailable(pack: Pack): boolean {
  return pack.sets.C_retention.length === 10;
}
