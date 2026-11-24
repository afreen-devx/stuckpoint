import type { z } from "zod";
import { logLlmCall } from "./db";
import { extractJson } from "./json";
import type { StudyGroup } from "./types";

/**
 * The one place StuckPoint talks to a language model.
 * Everything runs on the server; the API key never reaches the browser.
 *
 * Settings come from .env:
 *   LLM_PROVIDER  google (Gemini, has a free tier) or anthropic (Claude, paid)
 *   LLM_MODEL     for example gemini-3.8-flash, or claude-sonnet-5-5
 *   LLM_API_KEY   your key from Google AI Studio or the Claude Console
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type CallContext = {
  sessionId: string;
  studyGroup: StudyGroup | null;
  /** What the call is for, saved in llm_calls: "diagnosis", "tutor", "mastery", ... */
  purpose: string;
};

/** A readable error with a short code we can log and show. */
export type LlmErrorCode =
  | "not_configured"
  | "unsupported_provider"
  | "http_error"
  | "rate_limited"
  | "timeout"
  | "bad_response"
  | "invalid_json";

export class LlmError extends Error {
  code: LlmErrorCode;
  constructor(code: LlmErrorCode, message: string) {
    super(message);
    this.name = "LlmError";
    this.code = code;
  }
}

const PROVIDERS = ["google", "anthropic"] as const;
type Provider = (typeof PROVIDERS)[number];

function settings() {
  return {
    provider: (process.env.LLM_PROVIDER ?? "google").trim().toLowerCase(),
    model: (process.env.LLM_MODEL ?? "").trim(),
    apiKey: (process.env.LLM_API_KEY ?? "").trim(),
  };
}

function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}

/** True when a supported provider, a model and a key are all set. Pages use this to fall back gracefully. */
export function llmConfigured(): boolean {
  const s = settings();
  return isProvider(s.provider) && s.model.length > 0 && s.apiKey.length > 0;
}

const TIMEOUT_MS = 90_000;

type LlmRequest = { system: string; messages: ChatMessage[]; maxTokens?: number };
type Reply = { status: number; ok: boolean; data: unknown };
type Parsed = { text: string; inputTokens: number; outputTokens: number; errorMessage: string };

/** POST JSON with a timeout, and turn network failures into readable errors. */
async function post(url: string, headers: Record<string, string>, body: unknown): Promise<Reply> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new LlmError(
      timedOut ? "timeout" : "http_error",
      timedOut ? "The AI took too long to answer." : "Could not reach the AI service.",
    );
  }
  return { status: res.status, ok: res.ok, data: await res.json().catch(() => ({})) };
}

/* ---------- Anthropic (Claude) ---------- */

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
};

async function callAnthropic(model: string, apiKey: string, request: LlmRequest): Promise<{ reply: Reply; parsed: Parsed }> {
  const reply = await post(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    {
      model,
      // Generous, because thinking tokens count towards this limit.
      max_tokens: request.maxTokens ?? 8000,
      system: request.system,
      messages: request.messages,
    },
  );
  const data = reply.data as AnthropicResponse;
  return {
    reply,
    parsed: {
      // Current Claude models may think first; keep only the final text blocks.
      text: (data.content ?? [])
        .filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text)
        .join("")
        .trim(),
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      errorMessage: data.error?.message ?? "",
    },
  };
}

/* ---------- Google (Gemini) ---------- */

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
};

async function callGemini(model: string, apiKey: string, request: LlmRequest): Promise<{ reply: Reply; parsed: Parsed }> {
  const reply = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { "x-goog-api-key": apiKey },
    {
      system_instruction: { parts: [{ text: request.system }] },
      // Gemini calls the assistant role "model".
      contents: request.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: request.maxTokens ?? 8000 },
    },
  );
  const data = reply.data as GeminiResponse;
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return {
    reply,
    parsed: {
      // Skip any thought parts; keep the answer text.
      text: parts
        .filter((p) => !p.thought && typeof p.text === "string")
        .map((p) => p.text)
        .join("")
        .trim(),
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      errorMessage: data.error?.message ?? "",
    },
  };
}

/** Send one request to the configured provider and return the model's text. Every call is logged. */
export async function complete(ctx: CallContext, request: LlmRequest): Promise<string> {
  const s = settings();
  if (!isProvider(s.provider)) {
    throw new LlmError("unsupported_provider", `LLM_PROVIDER "${s.provider}" is not supported. Use google or anthropic.`);
  }
  if (!s.model || !s.apiKey) {
    throw new LlmError("not_configured", "The AI is not set up. Add LLM_MODEL and LLM_API_KEY to .env.");
  }

  const started = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  let errorCode: string | null = null;

  try {
    const call = s.provider === "google" ? callGemini : callAnthropic;
    const { reply, parsed } = await call(s.model, s.apiKey, request);
    inputTokens = parsed.inputTokens;
    outputTokens = parsed.outputTokens;

    if (reply.status === 429) {
      throw new LlmError("rate_limited", "The AI's free limit was reached. Wait a minute and try again.");
    }
    if (!reply.ok) {
      const detail = parsed.errorMessage ? ` ${parsed.errorMessage}` : "";
      throw new LlmError("http_error", `The AI service returned ${reply.status}.${detail}`);
    }
    if (!parsed.text) throw new LlmError("bad_response", "The AI returned an empty answer.");
    return parsed.text;
  } catch (error) {
    errorCode = error instanceof LlmError ? error.code : "unknown";
    throw error;
  } finally {
    // Logging must never break the request it describes.
    try {
      logLlmCall({
        sessionId: ctx.sessionId,
        studyGroup: ctx.studyGroup,
        purpose: ctx.purpose,
        model: `${s.provider}/${s.model}`,
        latencyMs: Date.now() - started,
        inputTokens,
        outputTokens,
        ok: errorCode === null,
        errorCode,
      });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Ask for JSON and check it against a schema. One retry if the shape is wrong,
 * telling the model what was wrong.
 */
export async function completeJSON<T>(
  ctx: CallContext,
  request: LlmRequest,
  schema: z.ZodType<T>,
): Promise<T> {
  let messages = request.messages;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await complete(ctx, { ...request, messages });
    try {
      let json: unknown;
      try {
        json = extractJson(text);
      } catch (error) {
        throw new LlmError("invalid_json", error instanceof Error ? error.message : "Invalid JSON.");
      }
      const parsed = schema.safeParse(json);
      if (parsed.success) return parsed.data;
      const problem = parsed.error.issues[0];
      throw new LlmError("invalid_json", `JSON did not match: ${problem?.path.join(".")} ${problem?.message}`);
    } catch (error) {
      if (attempt === 1) throw error;
      const reason = error instanceof Error ? error.message : "invalid JSON";
      messages = [
        ...request.messages,
        { role: "assistant", content: text },
        { role: "user", content: `That reply could not be used (${reason}). Reply again with only the JSON, in exactly the format asked for.` },
      ];
    }
  }
  throw new LlmError("invalid_json", "The AI did not return usable JSON.");
}
