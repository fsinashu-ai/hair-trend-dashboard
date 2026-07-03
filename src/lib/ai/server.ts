export {
  analyzeGeminiImage as analyzeAiImage,
  generateGeminiJson,
  generateGeminiText as generateAiText,
  GeminiServiceError,
  getGeminiModel,
  isGeminiConfigured,
  parseGeminiJson,
} from "@/lib/ai/gemini";

export type { GeminiGenerationResult as AiGenerationResult } from "@/lib/ai/gemini";
