import { createFillHandler } from "../../../lib/ai-handler";
import { createOpenRouterProvider, FillError } from "../../../lib/ai-provider";

export const runtime = "nodejs";
export const maxDuration = 65;

export const POST = createFillHandler(() => {
  if (
    process.env.AI_FILL_ENABLED !== "true" ||
    !process.env.OPENROUTER_API_KEY
  ) {
    throw new FillError(
      "AI fill is not configured on this server. The app operator must enable it with a server-side OpenRouter key. You can keep filling manually.",
      503,
    );
  }
  return createOpenRouterProvider({
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || "openai/gpt-5.6-luna",
  });
});
