import { assessEnglishLevel } from "@/lib/openai";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "Request body must include a non-empty 'messages' array." },
        { status: 400 },
      );
    }

    const normalized: ChatMessage[] = messages
      .filter(
        (m: unknown): m is ChatMessage =>
          typeof m === "object" &&
          m !== null &&
          "role" in m &&
          "content" in m &&
          typeof (m as ChatMessage).content === "string",
      )
      .map((m: ChatMessage) => ({
        role: m.role,
        content: m.content,
      }));

    const userTurns = normalized.filter((m) => m.role === "user");
    if (userTurns.length < 3) {
      return Response.json(
        { error: "Need at least 3 user messages to assess level." },
        { status: 400 },
      );
    }

    const assessment = await assessEnglishLevel(normalized);
    return Response.json(assessment);
  } catch (err) {
    const e = err as Error & { status?: number; payload?: unknown };
    const status = e.status ?? 502;
    if (e.payload) {
      return Response.json(e.payload, { status });
    }
    return Response.json(
      { error: e.message || "Level assessment failed" },
      { status },
    );
  }
}
