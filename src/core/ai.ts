import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import type { ConversationMessage } from "../memory/conversations";

// Model is configurable via CLAUDE_MODEL env var.
// Haiku (claude-haiku-4-5): ~4x cheaper, faster, good for inventory/Q&A.
// Sonnet (claude-sonnet-4-6): stronger for complex quote flows.
const MAX_TOKENS = 512;

export async function generateResponse(
  systemPrompt: string,
  history: ConversationMessage[],
  userMessage: string
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  messages.push({
    role: "user",
    content: userMessage,
  });

  const response = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: MAX_TOKENS,
    temperature: 0.4,
    system: systemPrompt,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return "";
  }
  return textBlock.text;
}
