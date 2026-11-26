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
    fallbackModel: (process.env.LLM_FALLBACK_MODEL ?? "").trim(),
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

/**
 * How long to wait for one model before giving up on it. A slow free-tier model is skipped for the
 * fallback model instead of leaving a student waiting. Streams get longer, since the reply arrives
 * piece by piece.
 */
const TIMEOUT_MS = 40_000;
const STREAM_TIMEOUT_MS = 60_000;
/** Waits before each retry of a busy reply. Kept short so a student is not left waiting long. */
const RETRY_DELAYS_MS = [2_000, 5_000];
/** Statuses that usually clear up by themselves: rate limit, server error, overloaded. */
const TRANSIENT = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type LlmRequest = {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  /**
   * How long Gemini may think before answering. Lower is faster. Unset uses the model's default
   * (medium on Gemini 3.8 Flash). Ignored for Claude.
   */
  thinking?: "low" | "medium" | "high";
  /** Override the wait before switching to the fallback model, in milliseconds. */
  timeoutMs?: number;
};

/** Gemini generation settings, with the thinking level when one is asked for. */
function geminiConfig(request: LlmRequest) {
  return {
    maxOutputTokens: request.maxTokens ?? 8000,
    ...(request.thinking ? { thinkingConfig: { thinkingLevel: request.thinking } } : {}),
  };
}
type Reply = { status: number; ok: boolean; data: unknown };
type Parsed = { text: string; inputTokens: number; outputTokens: number; errorMessage: string };

/** POST JSON with a timeout, and turn network failures into readable errors. */
async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<Reply> {
  const signal = AbortSignal.timeout(timeoutMs);
  const failed = (error: unknown) => {
    const timedOut = signal.aborted || (error instanceof Error && error.name === "TimeoutError");
    return new LlmError(
      timedOut ? "timeout" : "http_error",
      timedOut ? "The AI took too long to answer." : "Could not reach the AI service.",
    );
  };
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    throw failed(error);
  }
  let data: unknown = {};
  try {
    data = await res.json();
  } catch (error) {
    // A reply cut off by the timeout is a timeout, not an empty answer.
    if (signal.aborted) throw failed(error);
  }
  return { status: res.status, ok: res.ok, data };
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
    request.timeoutMs ?? TIMEOUT_MS,
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
      generationConfig: geminiConfig(request),
    },
    request.timeoutMs ?? TIMEOUT_MS,
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
  let usedModel = s.model;

  // Busy or rate-limited replies usually clear quickly: wait and retry, then try the
  // fallback model (LLM_FALLBACK_MODEL) if one is set.
  const models = [s.model];
  if (s.fallbackModel && s.fallbackModel !== s.model) models.push(s.fallbackModel);
  const call = s.provider === "google" ? callGemini : callAnthropic;

  try {
    let lastError: LlmError | null = null;
    for (const model of models) {
      usedModel = model;
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);
        let result: Awaited<ReturnType<typeof call>>;
        try {
          result = await call(model, s.apiKey, request);
        } catch (error) {
          // Too slow or unreachable: waiting again on the same model rarely helps, so move on.
          if (error instanceof LlmError && (error.code === "timeout" || error.code === "http_error")) {
            lastError = error;
            break;
          }
          throw error;
        }
        const { reply, parsed } = result;
        inputTokens += parsed.inputTokens;
        outputTokens += parsed.outputTokens;

        if (reply.ok) {
          if (!parsed.text) throw new LlmError("bad_response", "The AI returned an empty answer.");
          return parsed.text;
        }
        if (reply.status === 429) {
          lastError = new LlmError("rate_limited", "The AI's free limit was reached. Wait a minute and try again.");
        } else {
          const detail = parsed.errorMessage ? ` ${parsed.errorMessage}` : "";
          lastError = new LlmError("http_error", `The AI service returned ${reply.status}.${detail}`);
        }
        if (!TRANSIENT.has(reply.status)) throw lastError;
      }
    }
    throw lastError ?? new LlmError("http_error", "The AI service is busy. Try again in a minute.");
  } catch (error) {
    errorCode = error instanceof LlmError ? error.code : "unknown";
    throw error;
  } finally {
    // Logging must never break the request it describes.
    try {
      await logLlmCall({
        sessionId: ctx.sessionId,
        studyGroup: ctx.studyGroup,
        purpose: ctx.purpose,
        model: `${s.provider}/${usedModel}`,
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

/* ---------- Streaming (tutor replies) ---------- */

type Usage = { input: number; output: number };

/** Open a streaming request. Returns the raw response so the caller can check the status first. */
async function openStream(
  provider: Provider,
  model: string,
  apiKey: string,
  request: LlmRequest,
  signal: AbortSignal,
): Promise<Response> {
  const google = provider === "google";
  const url = google
    ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`
    : "https://api.anthropic.com/v1/messages";
  const headers: Record<string, string> = google
    ? { "x-goog-api-key": apiKey }
    : { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
  const body = google
    ? {
        system_instruction: { parts: [{ text: request.system }] },
        contents: request.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: geminiConfig(request),
      }
    : { model, max_tokens: request.maxTokens ?? 8000, system: request.system, messages: request.messages, stream: true };
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    throw new LlmError(signal.aborted ? "timeout" : "http_error", signal.aborted ? "The AI took too long to answer." : "Could not reach the AI service.");
  }
}

/** Read server-sent events and pass each piece of answer text on. Thinking parts are skipped. */
async function readStream(res: Response, provider: Provider, onText: (piece: string) => void, usage: Usage): Promise<string> {
  if (!res.body) throw new LlmError("bad_response", "The AI returned an empty answer.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  const handle = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }
    let piece = "";
    if (provider === "google") {
      const e = event as GeminiResponse;
      for (const part of e.candidates?.[0]?.content?.parts ?? []) if (!part.thought && part.text) piece += part.text;
      if (e.usageMetadata) {
        usage.input = e.usageMetadata.promptTokenCount ?? usage.input;
        usage.output = e.usageMetadata.candidatesTokenCount ?? usage.output;
      }
      if (e.error?.message) throw new LlmError("http_error", `The AI stopped: ${e.error.message}`);
    } else {
      const e = event as {
        type?: string;
        delta?: { type?: string; text?: string };
        message?: { usage?: { input_tokens?: number } };
        usage?: { output_tokens?: number };
        error?: { message?: string };
      };
      if (e.type === "content_block_delta" && e.delta?.type === "text_delta" && e.delta.text) piece = e.delta.text;
      if (e.type === "message_start") usage.input = e.message?.usage?.input_tokens ?? 0;
      if (e.type === "message_delta") usage.output = e.usage?.output_tokens ?? usage.output;
      if (e.type === "error") throw new LlmError("http_error", `The AI stopped: ${e.error?.message ?? "unknown error"}`);
    }
    if (piece) {
      text += piece;
      onText(piece);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      handle(buffer.slice(0, newline).replace(/\r$/, ""));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
    if (done) break;
  }
  if (buffer) handle(buffer.trim());
  return text.trim();
}

/**
 * Stream one reply, calling onText with each new piece as it arrives. Returns the full text.
 * Busy replies are retried and fall back to LLM_FALLBACK_MODEL before any text is sent.
 * Every call is logged, like complete().
 */
export async function streamText(ctx: CallContext, request: LlmRequest, onText: (piece: string) => void): Promise<string> {
  const s = settings();
  if (!isProvider(s.provider)) {
    throw new LlmError("unsupported_provider", `LLM_PROVIDER "${s.provider}" is not supported. Use google or anthropic.`);
  }
  if (!s.model || !s.apiKey) {
    throw new LlmError("not_configured", "The AI is not set up. Add LLM_MODEL and LLM_API_KEY to .env.");
  }
  const provider: Provider = s.provider;
  const models = [s.model];
  if (s.fallbackModel && s.fallbackModel !== s.model) models.push(s.fallbackModel);

  const started = Date.now();
  const usage: Usage = { input: 0, output: 0 };
  let usedModel = s.model;
  let errorCode: string | null = null;

  try {
    let lastError: LlmError | null = null;
    for (const model of models) {
      usedModel = model;
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);
        const signal = AbortSignal.timeout(request.timeoutMs ?? STREAM_TIMEOUT_MS);
        let sent = false;
        const forward = (piece: string) => {
          sent = true;
          onText(piece);
        };
        let res: Response;
        try {
          res = await openStream(provider, model, s.apiKey, request, signal);
          if (res.ok) {
            const text = await readStream(res, provider, forward, usage);
            if (!text) throw new LlmError("bad_response", "The AI returned an empty answer.");
            return text;
          }
        } catch (error) {
          // Nothing shown yet and the model is too slow: try the fallback model. Once text has
          // reached the student, a failure is reported instead, so no reply is ever half replaced.
          const slow = signal.aborted || (error instanceof LlmError && (error.code === "timeout" || error.code === "http_error"));
          if (!sent && slow) {
            lastError = error instanceof LlmError ? error : new LlmError("timeout", "The AI took too long to answer.");
            break;
          }
          if (signal.aborted) throw new LlmError("timeout", "The AI took too long to finish its reply.");
          throw error;
        }
        const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        lastError =
          res.status === 429
            ? new LlmError("rate_limited", "The AI's free limit was reached. Wait a minute and try again.")
            : new LlmError("http_error", `The AI service returned ${res.status}.${data.error?.message ? ` ${data.error.message}` : ""}`);
        if (!TRANSIENT.has(res.status)) throw lastError;
      }
    }
    throw lastError ?? new LlmError("http_error", "The AI service is busy. Try again in a minute.");
  } catch (error) {
    errorCode = error instanceof LlmError ? error.code : "unknown";
    throw error;
  } finally {
    try {
      await logLlmCall({
        sessionId: ctx.sessionId,
        studyGroup: ctx.studyGroup,
        purpose: ctx.purpose,
        model: `${provider}/${usedModel}`,
        latencyMs: Date.now() - started,
        inputTokens: usage.input,
        outputTokens: usage.output,
        ok: errorCode === null,
        errorCode,
      });
    } catch {
      /* ignore */
    }
  }
}
