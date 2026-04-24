import { NextRequest } from "next/server";
import { z } from "zod/v4";
import { aiRouter } from "@/src/lib/ai-router";
import type { AIProviderSelection } from "ai-router";

// Rate limiting: 10 req/min per IP (AI calls are expensive)
type RateLimitEntry = { count: number; firstRequest: number }
const aiRateLimitMap = new Map<string, RateLimitEntry>()
const AI_RATE_WINDOW = 60 * 1000
const AI_MAX_REQUESTS = 10
const AI_MAX_MAP_SIZE = 10000

setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of aiRateLimitMap.entries()) {
    if (now - entry.firstRequest > AI_RATE_WINDOW * 2) {
      aiRateLimitMap.delete(ip)
    }
  }
}, 5 * 60 * 1000)

const checkAiRateLimit = (clientIP: string): boolean => {
  const now = Date.now()
  const entry = aiRateLimitMap.get(clientIP)
  if (!entry) {
    if (aiRateLimitMap.size >= AI_MAX_MAP_SIZE) {
      const oldest = aiRateLimitMap.keys().next().value
      if (oldest) aiRateLimitMap.delete(oldest)
    }
    aiRateLimitMap.set(clientIP, { count: 1, firstRequest: now })
    return true
  }
  if (now - entry.firstRequest > AI_RATE_WINDOW) {
    entry.count = 1
    entry.firstRequest = now
    return true
  }
  if (entry.count >= AI_MAX_REQUESTS) return false
  entry.count++
  return true
}

const VALID_PROVIDERS = [
  "auto", "groq", "gemini", "claude", "claude-cli", "openai", "mistral",
  "cohere", "together", "fireworks", "cerebras", "openrouter", "deepinfra",
  "sambanova", "novita", "lepton", "hyperbolic", "perplexity",
] as const;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1, "Message content cannot be empty"),
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1, "At least one message is required"),
  provider: z.enum(VALID_PROVIDERS).optional(),
  model: z.string().optional(),
  maxTokens: z.number().int().positive().max(16384).optional(),
  temperature: z.number().min(0).max(2).optional(),
  jsonMode: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkAiRateLimit(clientIP)) {
    return Response.json(
      { error: 'Rate limit exceeded. Maximum 10 requests per minute.' },
      { status: 429 },
    )
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const parsed = ChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { messages, provider, model, maxTokens, temperature, jsonMode } = parsed.data;

    const response = await aiRouter.chat({
      messages,
      ...(provider && { provider: provider as AIProviderSelection }),
      ...(model && { model }),
      ...(maxTokens !== undefined && { maxTokens }),
      ...(temperature !== undefined && { temperature }),
      ...(jsonMode !== undefined && { jsonMode }),
    });

    return Response.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[ai-router] Myholiday POST error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const health = aiRouter.getHealth();
  const available = aiRouter.getAvailableProviders();
  const config = aiRouter.getConfig();

  return Response.json({
    projectName: config.projectName,
    defaultProvider: config.defaultProvider,
    providers: config.providers,
    availableProviders: available,
    health,
  });
}
