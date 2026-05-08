import OpenAI from "openai";

type AiProvider = "openai" | "gemini";

type GeminiTextPart = {
  text?: string;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiTextPart[];
    };
  }>;
};

type GeminiPart =
  | {
      text: string;
    }
  | {
      inline_data: {
        mime_type: string;
        data: string;
      };
    };

export type AiGenerationResult = {
  provider: AiProvider;
  providerLabel: string;
  text: string;
};

function getPreferredProvider(): AiProvider | null {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (provider === "mock") {
    return null;
  }

  if (provider === "openai" || provider === "gemini") {
    return provider;
  }

  if (process.env.GEMINI_API_KEY) {
    return "gemini";
  }

  if (process.env.OPENAI_API_KEY) {
    return "openai";
  }

  return null;
}

function getProviderLabel(provider: AiProvider) {
  return provider === "gemini" ? "Gemini API" : "OpenAI API";
}

function getGeminiText(response: GeminiGenerateContentResponse) {
  return (
    response.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

async function generateWithGemini(parts: GeminiPart[], maxOutputTokens: number) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const thinkingConfig = model.includes("2.5")
    ? {
        thinkingBudget: 0,
      }
    : undefined;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      body: JSON.stringify({
        contents: [
          {
            parts,
          },
        ],
        generationConfig: {
          maxOutputTokens,
          thinkingConfig,
          temperature: 0.7,
        },
      }),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error("Gemini API request failed.");
  }

  const data = (await response.json()) as GeminiGenerateContentResponse;
  const text = getGeminiText(data);

  if (!text) {
    throw new Error("Gemini API returned empty text.");
  }

  return text;
}

export async function generateAiText({
  maxOutputTokens,
  prompt,
  systemInstruction,
}: {
  maxOutputTokens: number;
  prompt: string;
  systemInstruction: string;
}): Promise<AiGenerationResult> {
  const provider = getPreferredProvider();

  if (!provider) {
    throw new Error("AI provider is not configured.");
  }

  if (provider === "gemini") {
    const text = await generateWithGemini(
      [
        {
          text: `${systemInstruction}\n\n${prompt}`,
        },
      ],
      maxOutputTokens,
    );

    return {
      provider,
      providerLabel: getProviderLabel(provider),
      text,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    input: prompt,
    instructions: systemInstruction,
    max_output_tokens: maxOutputTokens,
    model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
  });
  const text = response.output_text.trim();

  if (!text) {
    throw new Error("OpenAI API returned empty text.");
  }

  return {
    provider,
    providerLabel: getProviderLabel(provider),
    text,
  };
}

export async function analyzeAiImage({
  imageBase64,
  maxOutputTokens,
  mimeType,
  prompt,
  systemInstruction,
}: {
  imageBase64: string;
  maxOutputTokens: number;
  mimeType: string;
  prompt: string;
  systemInstruction: string;
}): Promise<AiGenerationResult> {
  const provider = getPreferredProvider();

  if (!provider) {
    throw new Error("AI provider is not configured.");
  }

  if (provider === "gemini") {
    const text = await generateWithGemini(
      [
        {
          text: `${systemInstruction}\n\n${prompt}`,
        },
        {
          inline_data: {
            data: imageBase64,
            mime_type: mimeType,
          },
        },
      ],
      maxOutputTokens,
    );

    return {
      provider,
      providerLabel: getProviderLabel(provider),
      text,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    input: [
      {
        content: [
          {
            text: prompt,
            type: "input_text",
          },
          {
            detail: "auto",
            image_url: `data:${mimeType};base64,${imageBase64}`,
            type: "input_image",
          },
        ],
        role: "user",
      },
    ],
    instructions: systemInstruction,
    max_output_tokens: maxOutputTokens,
    model:
      process.env.OPENAI_VISION_MODEL ??
      process.env.OPENAI_MODEL ??
      "gpt-5.4-mini",
  });
  const text = response.output_text.trim();

  if (!text) {
    throw new Error("OpenAI API returned empty text.");
  }

  return {
    provider,
    providerLabel: getProviderLabel(provider),
    text,
  };
}
