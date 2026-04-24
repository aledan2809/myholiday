import { AIRouter, getProjectPreset } from "ai-router";
import type { AIRequest, AIResponse, AIProviderSelection } from "ai-router";

const preset = getProjectPreset("Myholiday");

export const aiRouter = new AIRouter({
  ...preset,
  projectName: "Myholiday",
});

export type RouteAIOptions = {
  temperature?: number;
  maxTokens?: number;
  provider?: AIProviderSelection;
  jsonMode?: boolean;
};

/**
 * Send a prompt through the AI router with automatic provider fallback.
 * Free providers (Gemini, Mistral, Cohere, etc.) are tried first,
 * falling back to Claude only if all free providers fail.
 */
export async function routeAI(
  prompt: string,
  options?: RouteAIOptions
): Promise<AIResponse> {
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new Error("routeAI: prompt must be a non-empty string");
  }

  const request: AIRequest = {
    messages: [{ role: "user", content: prompt.trim() }],
    ...(options?.temperature !== undefined && { temperature: options.temperature }),
    ...(options?.maxTokens !== undefined && { maxTokens: options.maxTokens }),
    ...(options?.provider !== undefined && { provider: options.provider }),
    ...(options?.jsonMode !== undefined && { jsonMode: options.jsonMode }),
  };

  return aiRouter.chat(request);
}

/**
 * Multi-turn conversation through the AI router.
 */
export async function routeAIChat(
  messages: AIRequest["messages"],
  options?: RouteAIOptions
): Promise<AIResponse> {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error("routeAIChat: messages must be a non-empty array");
  }

  const request: AIRequest = {
    messages,
    ...(options?.temperature !== undefined && { temperature: options.temperature }),
    ...(options?.maxTokens !== undefined && { maxTokens: options.maxTokens }),
    ...(options?.provider !== undefined && { provider: options.provider }),
    ...(options?.jsonMode !== undefined && { jsonMode: options.jsonMode }),
  };

  return aiRouter.chat(request);
}

export { aiRouter as router };
