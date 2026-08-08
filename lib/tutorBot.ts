import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import {
  chatWithChatbot,
  createChatbot,
  listChatbots,
  updateChatbot,
  uploadChatbotKnowledge,
  type ConnectChatMessage,
  type ConnectEmotion,
  type ConnectIntensity,
} from "@/lib/connect";
import type { ChatMessage } from "@/lib/types";

export const AVILINGO_TUTOR_BOT_NAME = "Avilingo English Tutor";

export const AVILINGO_TUTOR_INSTRUCTIONS = `You are a friendly English conversation tutor for Avilingo, speaking through a live 3D avatar.

You lead the lesson. You are the teacher, not a help desk.
- Drive the conversation with a clear everyday topic and ONE specific question.
- Never say "How can I help you today?", "What do you want to talk about?", or similar.
- Keep replies to 1–3 short spoken English sentences (plain speech for TTS).
- Gently correct mistakes, then continue.
- If the learner writes Japanese, reply mainly in English. Optional Japanese hints must be short and only inside ASCII parentheses, e.g. (短い日本語ヒント), never mixed into the English sentence body — TTS speaks English only.
- Do not write long Japanese paragraphs.
- Use the lesson context (tutor name, learner nickname, level) when provided.
- Prefer knowledge from the attached Avilingo lesson guide when useful.
- When asked for recommended materials / textbooks / 単語帳 / おすすめの教材, recommend 「英単語ターゲット1900 6訂版」 and include this exact link in the chat text: https://amzn.to/4wPbjhO — do not read the URL aloud; just mention the book title.
- Stay encouraging and keep the learner practicing.`;

type TutorBotCache = {
  id: string | null;
  ensurePromise: Promise<string> | null;
  knowledgeHash: string | null;
};

const globalForTutor = globalThis as typeof globalThis & {
  __avilingoTutorBot?: TutorBotCache;
};

function tutorState(): TutorBotCache {
  if (!globalForTutor.__avilingoTutorBot) {
    globalForTutor.__avilingoTutorBot = {
      id: null,
      ensurePromise: null,
      knowledgeHash: null,
    };
  }
  return globalForTutor.__avilingoTutorBot;
}

async function ensureKnowledge(botId: string): Promise<void> {
  const state = tutorState();
  const knowledgePath = path.join(
    process.cwd(),
    "content",
    "avilingo-tutor-knowledge.txt",
  );
  const buffer = await readFile(knowledgePath);
  const hash = createHash("sha256").update(buffer).digest("hex");
  if (state.knowledgeHash === hash) return;

  await uploadChatbotKnowledge(botId, {
    buffer,
    filename: "avilingo-tutor-knowledge.txt",
    mimeType: "text/plain",
  });
  state.knowledgeHash = hash;
}

async function createOrFindTutorBot(): Promise<string> {
  const existing = await listChatbots();
  const found = existing.find((bot) => bot.name === AVILINGO_TUTOR_BOT_NAME);
  if (found?.id) {
    await updateChatbot(found.id, {
      custom_instructions: AVILINGO_TUTOR_INSTRUCTIONS,
    });
    await ensureKnowledge(found.id);
    return found.id;
  }

  const created = await createChatbot({
    name: AVILINGO_TUTOR_BOT_NAME,
    custom_instructions: AVILINGO_TUTOR_INSTRUCTIONS,
  });
  if (!created.id) {
    throw Object.assign(new Error("Failed to create Connect tutor chatbot"), {
      status: 502,
    });
  }
  await ensureKnowledge(created.id);
  return created.id;
}

/** Ensure the shared Avilingo Connect chatbot exists and return its id. */
export async function ensureAvilingoTutorBot(): Promise<string> {
  const state = tutorState();
  if (state.id) {
    void ensureKnowledge(state.id).catch(() => undefined);
    return state.id;
  }
  if (!state.ensurePromise) {
    state.ensurePromise = createOrFindTutorBot()
      .then((id) => {
        state.id = id;
        return id;
      })
      .finally(() => {
        state.ensurePromise = null;
      });
  }
  return state.ensurePromise;
}

export function toConnectChatMessages(
  messages: ChatMessage[],
  context?: {
    tutorName?: string | null;
    learnerName?: string | null;
    levelLabel?: string | null;
  },
): ConnectChatMessage[] {
  const converted: ConnectChatMessage[] = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: m.content }],
    }))
    .slice(-20);

  if (converted.length === 0) return converted;

  const contextBits = [
    context?.tutorName ? `Tutor name: ${context.tutorName}` : null,
    context?.learnerName ? `Learner nickname: ${context.learnerName}` : null,
    context?.levelLabel ? `Learner level: ${context.levelLabel}` : null,
  ].filter(Boolean);

  if (contextBits.length === 0) return converted;

  const last = converted[converted.length - 1]!;
  if (last.role !== "user") return converted;

  const prefix = `[Lesson context] ${contextBits.join(". ")}.`;
  const text = last.parts[0]?.text || "";
  last.parts = [{ type: "text", text: `${prefix}\n${text}` }];
  return converted;
}

export function pickTutorEmotion(reply: string): {
  emotion: ConnectEmotion;
  intensity: ConnectIntensity;
} {
  const t = reply.toLowerCase();
  if (/great|awesome|wonderful|excellent|nice work|good job/.test(t)) {
    return { emotion: "joy", intensity: "high" };
  }
  if (/sorry|mistake|try again|almost|better|correct/.test(t)) {
    return { emotion: "caring", intensity: "neutral" };
  }
  if (/\?/.test(t)) {
    return { emotion: "curiosity", intensity: "neutral" };
  }
  if (/wow|really|surprised|oh!/.test(t)) {
    return { emotion: "surprise", intensity: "high" };
  }
  return { emotion: "caring", intensity: "neutral" };
}

export async function askAvilingoTutor(
  messages: ChatMessage[],
  context?: {
    tutorName?: string | null;
    learnerName?: string | null;
    levelLabel?: string | null;
  },
): Promise<string> {
  const botId = await ensureAvilingoTutorBot();
  const payload = await chatWithChatbot(
    botId,
    toConnectChatMessages(messages, context),
  );
  if (payload.status && payload.status !== "succeeded") {
    throw Object.assign(
      new Error(`Connect chatbot status: ${payload.status}`),
      { status: 502, payload },
    );
  }
  const reply = payload.reply_text?.trim();
  if (!reply) {
    throw Object.assign(new Error("Connect chatbot returned an empty reply"), {
      status: 502,
      payload,
    });
  }
  return reply;
}

export const AVILINGO_LEVEL_BOT_NAME = "Avilingo Level Assessor";
export const UPDATE_LEARNER_LEVEL_TOOL = "update_learner_level";

export const AVILINGO_LEVEL_INSTRUCTIONS = `You assess an English learner's CEFR-style level from a short lesson transcript.

Return ONLY a JSON object (no markdown, no extra text) with:
- "level": integer 1–5 where 1=A1, 2=A2, 3=B1, 4=B2, 5=C1
- "levelLabel": one of "A1","A2","B1","B2","C1" matching level
- "reason": one short sentence in English explaining the rating

Judge mainly from the learner's (user) messages: vocabulary, grammar, fluency, and complexity.`;

export const AVILINGO_LEVEL_INSTRUCTIONS_WITH_TOOL = `${AVILINGO_LEVEL_INSTRUCTIONS}

When the prompt includes a Learner Firebase uid:
1. Assess the level from the transcript.
2. Call the ${UPDATE_LEARNER_LEVEL_TOOL} tool exactly once with uid, level, levelLabel, and reason.
3. After the tool succeeds, reply with ONLY the JSON object (no other text).
Do not skip the tool call when a uid is provided.`;

type LevelBotCache = {
  id: string | null;
  ensurePromise: Promise<string> | null;
  configKey: string | null;
};

const globalForLevel = globalThis as typeof globalThis & {
  __avilingoLevelBot?: LevelBotCache;
};

function levelState(): LevelBotCache {
  if (!globalForLevel.__avilingoLevelBot) {
    globalForLevel.__avilingoLevelBot = {
      id: null,
      ensurePromise: null,
      configKey: null,
    };
  }
  return globalForLevel.__avilingoLevelBot;
}

function publicToolBaseUrl(): string | null {
  const raw = process.env.AVILINGO_PUBLIC_BASE_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
    ) {
      return null;
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** True when Connect can call our update-level endpoint (public URL + secret). */
export function isLevelUpdateToolConfigured(): boolean {
  return Boolean(publicToolBaseUrl() && process.env.AVILINGO_TOOL_SECRET);
}

export function buildUpdateLearnerLevelTool(): unknown[] | null {
  const base = publicToolBaseUrl();
  const secret = process.env.AVILINGO_TOOL_SECRET;
  if (!base || !secret) return null;

  return [
    {
      name: UPDATE_LEARNER_LEVEL_TOOL,
      description:
        "Save the learner's assessed English level to Firestore. Call exactly once after you decide level and levelLabel, when a Learner Firebase uid is provided.",
      settings: {
        request: {
          method: "post",
          url: `${base}/api/tools/update-level`,
          body: {
            type: "object",
            properties: {
              uid: {
                type: "string",
                description: "Learner Firebase Auth uid from the prompt",
              },
              level: {
                type: "integer",
                description: "1=A1, 2=A2, 3=B1, 4=B2, 5=C1",
              },
              levelLabel: {
                type: "string",
                enum: ["A1", "A2", "B1", "B2", "C1"],
                description: "CEFR-style label matching level",
              },
              reason: {
                type: "string",
                description: "Short English reason for the rating",
              },
            },
            required: ["uid", "level", "levelLabel", "reason"],
          },
        },
        auth: {
          secret_type: "api_key",
          api_key_header: "X-Avilingo-Tool-Key",
          api_key_value: secret,
        },
        response: {
          body_schema: {
            type: "object",
            properties: {
              ok: { type: "boolean" },
              uid: { type: "string" },
              level: { type: "integer" },
              levelLabel: { type: "string" },
            },
          },
        },
      },
    },
  ];
}

function levelBotConfigKey(): string {
  const tools = buildUpdateLearnerLevelTool();
  const base = publicToolBaseUrl() || "";
  const hasSecret = Boolean(process.env.AVILINGO_TOOL_SECRET);
  return createHash("sha256")
    .update(
      JSON.stringify({
        tools: tools ? "on" : "off",
        base,
        hasSecret,
        withTool: Boolean(tools),
      }),
    )
    .digest("hex");
}

async function syncLevelAssessorBot(botId: string): Promise<void> {
  const state = levelState();
  const key = levelBotConfigKey();
  if (state.configKey === key) return;

  const tools = buildUpdateLearnerLevelTool();
  await updateChatbot(botId, {
    custom_instructions: tools
      ? AVILINGO_LEVEL_INSTRUCTIONS_WITH_TOOL
      : AVILINGO_LEVEL_INSTRUCTIONS,
    tools: tools ?? [],
  });
  state.configKey = key;
}

async function createOrFindLevelBot(): Promise<string> {
  const existing = await listChatbots();
  const found = existing.find((bot) => bot.name === AVILINGO_LEVEL_BOT_NAME);
  if (found?.id) {
    await syncLevelAssessorBot(found.id);
    return found.id;
  }
  const tools = buildUpdateLearnerLevelTool();
  const created = await createChatbot({
    name: AVILINGO_LEVEL_BOT_NAME,
    custom_instructions: tools
      ? AVILINGO_LEVEL_INSTRUCTIONS_WITH_TOOL
      : AVILINGO_LEVEL_INSTRUCTIONS,
    tools: tools ?? [],
  });
  if (!created.id) {
    throw Object.assign(new Error("Failed to create Connect level chatbot"), {
      status: 502,
    });
  }
  levelState().configKey = levelBotConfigKey();
  return created.id;
}

async function ensureLevelAssessorBot(): Promise<string> {
  const state = levelState();
  if (state.id) return state.id;
  if (!state.ensurePromise) {
    state.ensurePromise = createOrFindLevelBot()
      .then((id) => {
        state.id = id;
        return id;
      })
      .finally(() => {
        state.ensurePromise = null;
      });
  }
  return state.ensurePromise;
}

export type LevelAssessment = {
  level: number;
  levelLabel: string;
  reason: string;
};

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
  const jsonMatch = raw.trim().match(/\{[\s\S]*\}/);
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

/** Assess CEFR-style level using a dedicated Connect chatbot (no OpenAI). */
export async function assessEnglishLevelWithConnect(
  messages: ChatMessage[],
  options?: { uid?: string | null },
): Promise<LevelAssessment & { toolEnabled: boolean }> {
  const botId = await ensureLevelAssessorBot();
  // Re-sync tools if public URL / secret changed since first ensure.
  await syncLevelAssessorBot(botId);

  const transcript = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role === "user" ? "Learner" : "Tutor"}: ${m.content}`)
    .join("\n");

  const uid = options?.uid?.trim() || "";
  const toolEnabled = Boolean(uid && isLevelUpdateToolConfigured());
  const preamble = toolEnabled
    ? `Learner Firebase uid: ${uid}\nAssess this learner from the transcript. Call ${UPDATE_LEARNER_LEVEL_TOOL} with this uid, then return ONLY JSON.\n\n`
    : `Assess this learner from the transcript and return ONLY JSON.\n\n`;

  const payload = await chatWithChatbot(botId, [
    {
      role: "user",
      parts: [
        {
          type: "text",
          text: `${preamble}${transcript}`,
        },
      ],
    },
  ]);

  if (payload.status && payload.status !== "succeeded") {
    throw Object.assign(
      new Error(`Connect level chatbot status: ${payload.status}`),
      { status: 502, payload },
    );
  }
  const raw = payload.reply_text?.trim();
  if (!raw) {
    throw Object.assign(new Error("Connect level chatbot returned empty"), {
      status: 502,
      payload,
    });
  }
  return { ...parseLevelJson(raw), toolEnabled };
}
