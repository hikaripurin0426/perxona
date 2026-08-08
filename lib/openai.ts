import type { ChatMessage } from "./types";

export const ENGLISH_TUTOR_SYSTEM_PROMPT = `You are a friendly English conversation tutor speaking through an AI avatar in a live lesson.

You lead the lesson. You are the teacher, not a help desk or chatbot.
- Drive the conversation: pick a clear everyday topic, give a short prompt or example, then ask ONE specific question the learner can answer.
- Never say things like "How can I help you today?", "What do you want to talk about?", or "Let me know if you need anything."
- After the learner replies, acknowledge briefly, gently correct if needed, then move the topic forward with a new prompt or question.
- Keep most of your reply in natural, spoken English (1–3 short sentences).
- Gently correct mistakes: briefly show a better phrase, then continue.
- If they write in Japanese, reply mainly in English with a short Japanese hint only when helpful.
- Do not use markdown, bullet lists, or stage directions. Plain speech only — your text will be read aloud by TTS.
- Stay encouraging and keep the learner practicing.`;

function buildTutorSystemPrompt(options?: {
  learnerName?: string | null;
  tutorName?: string | null;
  levelLabel?: string | null;
}): string {
  const parts = [ENGLISH_TUTOR_SYSTEM_PROMPT];
  const tutor = options?.tutorName?.trim();
  if (tutor) {
    parts.push(
      `Your name is "${tutor}". You are this person — introduce and refer to yourself as ${tutor} when natural. Stay in character as ${tutor}, a friendly English tutor.`,
    );
  }
  const nick = options?.learnerName?.trim();
  if (nick) {
    parts.push(
      `The learner's nickname is "${nick}". Address them by this name naturally from time to time (not in every sentence). Pronounce and spell it exactly as given.`,
    );
  }
  const level = options?.levelLabel?.trim();
  if (level) {
    parts.push(
      `The learner's assessed level is ${level}. Match vocabulary, sentence length, and topic difficulty to ${level}. For A1–A2 use very simple words and short questions; for B1+ allow slightly richer language while still leading clearly.`,
    );
  } else {
    parts.push(
      `The learner's level is not assessed yet. Start with simple A2-style English and everyday topics. If they struggle, simplify; if they handle it easily, raise the challenge a little.`,
    );
  }
  return parts.join("\n\n");
}

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
  options?: {
    learnerName?: string | null;
    tutorName?: string | null;
    levelLabel?: string | null;
  },
): Promise<string> {
  const apiKey = requireApiKey();
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const baseUrl = (
    process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  ).replace(/\/$/, "");

  const payloadMessages: ChatMessage[] = [
    {
      role: "system",
      content: buildTutorSystemPrompt({
        learnerName: options?.learnerName,
        tutorName: options?.tutorName,
        levelLabel: options?.levelLabel,
      }),
    },
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

export type LevelAssessment = {
  level: number;
  levelLabel: string;
  reason: string;
};

const LEVEL_ASSESS_SYSTEM_PROMPT = `You assess an English learner's CEFR-style level from a short lesson transcript.

Return ONLY a JSON object with:
- "level": integer 1–5 where 1=A1, 2=A2, 3=B1, 4=B2, 5=C1
- "levelLabel": one of "A1","A2","B1","B2","C1" matching level
- "reason": one short sentence in English explaining the rating

Judge from the learner's (user) messages: vocabulary, grammar, fluency, and complexity. Ignore the tutor's (assistant) messages except as context.`;

const LABEL_TO_LEVEL: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
};

const LEVEL_TO_LABEL: Record<number, string> = {
  1: "A1",
  2: "A2",
  3: "B1",
  4: "B2",
  5: "C1",
};

function parseLevelJson(raw: string): LevelAssessment {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw Object.assign(new Error("Level assessment returned non-JSON"), {
      status: 502,
    });
  }
  const parsed = JSON.parse(jsonMatch[0]) as {
    level?: unknown;
    levelLabel?: unknown;
    reason?: unknown;
  };

  let level =
    typeof parsed.level === "number"
      ? Math.round(parsed.level)
      : typeof parsed.levelLabel === "string"
        ? LABEL_TO_LEVEL[parsed.levelLabel.toUpperCase()]
        : NaN;

  if (!Number.isFinite(level) || level < 1 || level > 5) {
    throw Object.assign(new Error("Invalid level in assessment response"), {
      status: 502,
      payload: parsed,
    });
  }

  const levelLabel = LEVEL_TO_LABEL[level]!;

  const reason =
    typeof parsed.reason === "string" && parsed.reason.trim()
      ? parsed.reason.trim()
      : "Assessed from lesson conversation.";

  return { level, levelLabel, reason };
}

export async function assessEnglishLevel(
  messages: ChatMessage[],
): Promise<LevelAssessment> {
  const apiKey = requireApiKey();
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const baseUrl = (
    process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  ).replace(/\/$/, "");

  const transcript = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role === "user" ? "Learner" : "Tutor"}: ${m.content}`)
    .join("\n");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: LEVEL_ASSESS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Assess this learner from the transcript:\n\n${transcript}`,
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error("OpenAI level assessment failed"), {
      status: 502,
      payload,
    });
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw Object.assign(new Error("OpenAI returned an empty assessment"), {
      status: 502,
      payload,
    });
  }

  return parseLevelJson(content);
}

export function isChatEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
