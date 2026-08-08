import {
  getUserLevelAdmin,
  isFirebaseAdminConfigured,
  saveLevelAssessmentAdmin,
} from "@/lib/firebaseAdmin";
import { isConnectConfigured } from "@/lib/connect";
import { assessEnglishLevelWithConnect } from "@/lib/tutorBot";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isConnectConfigured()) {
      return Response.json(
        {
          error:
            "Perxona Connect is not configured. Set PERXONA_CONNECT_EMAIL and PERXONA_CONNECT_PASSWORD.",
        },
        { status: 501 },
      );
    }

    const body = await request.json();
    const messages = body?.messages;
    const uid = typeof body?.uid === "string" ? body.uid.trim() : "";

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

    const assessment = await assessEnglishLevelWithConnect(normalized, { uid });

    let saved = false;
    let savedVia: "connect-chatbot-tool" | "admin-fallback" | null = null;

    if (uid && isFirebaseAdminConfigured()) {
      const existing = await getUserLevelAdmin(uid);
      if (
        existing?.level === assessment.level &&
        existing?.levelLabel === assessment.levelLabel
      ) {
        // Likely written by the Connect Function Tool during chat.
        saved = true;
        savedVia = assessment.toolEnabled
          ? "connect-chatbot-tool"
          : "admin-fallback";
      } else {
        await saveLevelAssessmentAdmin(uid, {
          level: assessment.level,
          levelLabel: assessment.levelLabel,
          reason: assessment.reason,
        });
        saved = true;
        savedVia = "admin-fallback";
      }
    }

    return Response.json({
      level: assessment.level,
      levelLabel: assessment.levelLabel,
      reason: assessment.reason,
      provider: "connect-chatbot",
      toolEnabled: assessment.toolEnabled,
      saved,
      savedVia,
    });
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
