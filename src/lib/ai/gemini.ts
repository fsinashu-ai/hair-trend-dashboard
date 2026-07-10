import { GoogleGenAI } from "@google/genai";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

// Keep AI requests short enough for Vercel Cron and manual generation routes.
// A failed request is handled by each feature's mock/fallback response.
const geminiTimeoutMs = 15_000;
const geminiRetryAttempts = 1;
const maxPromptCharacters = 24_000;

type GeminiPart =
  | { text: string }
  | { inlineData: { data: string; mimeType: string } };

export type GeminiErrorCode =
  | "not_configured"
  | "invalid_key"
  | "rate_limited"
  | "timeout"
  | "empty_response"
  | "invalid_json"
  | "input_too_long"
  | "request_failed";

export class GeminiServiceError extends Error {
  code: GeminiErrorCode;

  constructor(code: GeminiErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "GeminiServiceError";
  }
}

export type GeminiGenerationResult = {
  model: string;
  provider: "gemini";
  providerLabel: "Gemini API";
  text: string;
};

let client: GoogleGenAI | null = null;
let callCount = 0;

export function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new GeminiServiceError(
      "not_configured",
      "Gemini API is not configured.",
    );
  }

  if (!client) {
    client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        retryOptions: { attempts: geminiRetryAttempts },
        timeout: geminiTimeoutMs,
      },
    });
  }

  return client;
}

function getErrorCode(error: unknown): GeminiErrorCode {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("api key") ||
    normalized.includes("401") ||
    normalized.includes("403")
  ) {
    return "invalid_key";
  }

  if (
    normalized.includes("429") ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("quota")
  ) {
    return "rate_limited";
  }

  if (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("deadline")
  ) {
    return "timeout";
  }

  return "request_failed";
}

function assertInputLength(systemInstruction: string, prompt: string) {
  const characterCount = systemInstruction.length + prompt.length;

  if (characterCount > maxPromptCharacters) {
    throw new GeminiServiceError(
      "input_too_long",
      `Gemini input exceeds ${maxPromptCharacters} characters.`,
    );
  }

  return characterCount;
}

function removeJsonCodeFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function parseGeminiJson<T>(value: string): T {
  const cleaned = removeJsonCodeFence(value);
  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");
  const arrayStart = cleaned.indexOf("[");
  const arrayEnd = cleaned.lastIndexOf("]");
  const isArray =
    arrayStart !== -1 &&
    arrayEnd > arrayStart &&
    (objectStart === -1 || arrayStart < objectStart);
  const jsonText = isArray
    ? cleaned.slice(arrayStart, arrayEnd + 1)
    : objectStart !== -1 && objectEnd > objectStart
      ? cleaned.slice(objectStart, objectEnd + 1)
      : cleaned;

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    throw new GeminiServiceError(
      "invalid_json",
      "Gemini returned invalid JSON.",
    );
  }
}

async function generate({
  feature,
  maxOutputTokens,
  parts,
  prompt,
  responseJsonSchema,
  systemInstruction,
}: {
  feature: string;
  maxOutputTokens: number;
  parts: GeminiPart[];
  prompt: string;
  responseJsonSchema?: unknown;
  systemInstruction: string;
}): Promise<GeminiGenerationResult> {
  const inputCharacters = assertInputLength(systemInstruction, prompt);
  const model = getGeminiModel();
  const requestNumber = ++callCount;

  console.info("[gemini] request", {
    feature,
    inputCharacters,
    model,
    requestNumber,
  });

  try {
    const response = await getGeminiClient().models.generateContent({
      config: {
        maxOutputTokens,
        responseJsonSchema,
        responseMimeType: responseJsonSchema ? "application/json" : undefined,
        systemInstruction,
        temperature: 0.55,
        thinkingConfig: model.includes("2.5")
          ? { thinkingBudget: 0 }
          : undefined,
      },
      contents: [{ parts, role: "user" }],
      model,
    });
    const text = response.text?.trim() ?? "";

    if (!text) {
      throw new GeminiServiceError(
        "empty_response",
        "Gemini returned an empty response.",
      );
    }

    console.info("[gemini] success", {
      feature,
      model,
      outputCharacters: text.length,
      requestNumber,
    });

    return {
      model,
      provider: "gemini",
      providerLabel: "Gemini API",
      text,
    };
  } catch (error) {
    const serviceError =
      error instanceof GeminiServiceError
        ? error
        : new GeminiServiceError(
            getErrorCode(error),
            "Gemini request failed.",
          );

    console.error("[gemini] failure", {
      code: serviceError.code,
      feature,
      model,
      requestNumber,
    });
    throw serviceError;
  }
}

export async function generateGeminiText({
  feature = "text-generation",
  maxOutputTokens,
  prompt,
  systemInstruction,
}: {
  feature?: string;
  maxOutputTokens: number;
  prompt: string;
  systemInstruction: string;
}) {
  return generate({
    feature,
    maxOutputTokens,
    parts: [{ text: prompt }],
    prompt,
    systemInstruction,
  });
}

export async function generateGeminiJson<T>({
  feature = "json-generation",
  maxOutputTokens,
  prompt,
  responseJsonSchema,
  systemInstruction,
}: {
  feature?: string;
  maxOutputTokens: number;
  prompt: string;
  responseJsonSchema: unknown;
  systemInstruction: string;
}) {
  const result = await generate({
    feature,
    maxOutputTokens,
    parts: [{ text: prompt }],
    prompt,
    responseJsonSchema,
    systemInstruction,
  });

  return {
    ...result,
    value: parseGeminiJson<T>(result.text),
  };
}

export async function analyzeGeminiImage({
  feature = "image-analysis",
  imageBase64,
  maxOutputTokens,
  mimeType,
  prompt,
  systemInstruction,
}: {
  feature?: string;
  imageBase64: string;
  maxOutputTokens: number;
  mimeType: string;
  prompt: string;
  systemInstruction: string;
}) {
  return generate({
    feature,
    maxOutputTokens,
    parts: [
      { text: prompt },
      { inlineData: { data: imageBase64, mimeType } },
    ],
    prompt,
    systemInstruction,
  });
}
