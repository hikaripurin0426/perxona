import type { ChatMessage } from "./types";

export const ENGLISH_TUTOR_SYSTEM_PROMPT = `You are a friendly English conversation tutor speaking through an AI avatar in a live lesson.

Rules:
- Keep most of your reply in natural, spoken English (1–3 short sentences).
- Gently correct the learner's English when needed: briefly show a better phrase, then continue the conversation.
- Adapt to the learner's level; if they write in Japanese, reply mainly in English with a short Japanese hint only when helpful.
- Ask one follow-up question to keep the conversation going.
- Do not use markdown, bullet lists, or stage directions. Plain speech only — your text will be read aloud by TTS.
- Stay encouraging and on-topic for everyday English practice.`;

function requireApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw Object.assign(
      new Error("OPENAI_API_KEY not configured. Set it in .env.local to enable chat."),
      { status: 501 },
    );
  }
  return key;
}

export async function createChatReply(
  messages: ChatMessage[],
): Promise<string> {
  const apiKey = requireApiKey();
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const baseUrl = (
    process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  ).replace(/\/$/, "");

  const payloadMessages: ChatMessage[] = [
    { role: "system", content: ENGLISH_TUTOR_SYSTEM_PROMPT },
    ...messages.filter((m) => m.role !== "system"),
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: payloadMessages,
      temperature: 0.7,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error("OpenAI request failed"), {
      status: 502,
      payload,
    });
  }

  const reply = payload?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    throw Object.assign(new Error("OpenAI returned an empty reply"), {
      status: 502,
      payload,
    });
  }
  return reply.trim();
}

export function isChatEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
