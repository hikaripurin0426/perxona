import {
  createPresentation,
  fetchAvatarMotions,
  type ConnectEmotion,
  type ConnectIntensity,
} from "@/lib/connect";
import { createChatReply } from "@/lib/openai";
import { isValidRomajiNickname, normalizeNickname } from "@/lib/nickname";
import { withMotionMarkup } from "@/lib/motions";
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

    if (normalized.length === 0) {
      return Response.json(
        { error: "No valid chat messages provided." },
        { status: 400 },
      );
    }

    const rawName =
      typeof body?.learnerName === "string" ? body.learnerName : "";
    const learnerName = normalizeNickname(rawName);
    const rawTutor =
      typeof body?.tutorName === "string" ? body.tutorName.trim() : "";
    const tutorName =
      rawTutor && /^[A-Za-z][A-Za-z0-9 '.-]{0,39}$/.test(rawTutor)
        ? rawTutor
        : null;
    const rawLevel =
      typeof body?.levelLabel === "string" ? body.levelLabel.trim() : "";
    const levelLabel = /^[A-C][12]$/i.test(rawLevel)
      ? rawLevel.toUpperCase()
      : null;
    const avatarId =
      typeof body?.avatarId === "string" ? body.avatarId.trim() : "";
    const voiceId =
      typeof body?.voiceId === "string" ? body.voiceId.trim() : "";

    const motions = avatarId ? await fetchAvatarMotions(avatarId) : [];
    const expressive = await createChatReply(normalized, {
      learnerName: isValidRomajiNickname(learnerName) ? learnerName : null,
      tutorName,
      levelLabel,
      motions,
    });

    let script = withMotionMarkup(expressive.reply, expressive.motionId);
    let reply = expressive.reply;
    let emotion: ConnectEmotion = expressive.emotion;
    let intensity: ConnectIntensity = expressive.intensity;
    let usedConnectPresentation = false;

    if (avatarId) {
      try {
        const presentation = await createPresentation({
          avatarId,
          voiceId: voiceId || undefined,
          message: expressive.reply,
          emotion,
          intensity,
        });
        if (
          typeof presentation.display_text === "string" &&
          presentation.display_text.trim()
        ) {
          reply = presentation.display_text.trim();
        }
        if (
          typeof presentation.presentation === "string" &&
          presentation.presentation.trim()
        ) {
          script = presentation.presentation.trim();
          usedConnectPresentation = true;
        }
      } catch {
        // Motion Markup fallback still works if presentation API fails.
      }
    }

    if (!usedConnectPresentation) {
      script = withMotionMarkup(reply, expressive.motionId);
    }

    return Response.json({
      reply,
      script,
      emotion,
      intensity,
      motionId: expressive.motionId,
    });
  } catch (err) {
    const e = err as Error & { status?: number; payload?: unknown };
    const status = e.status ?? 502;
    if (e.payload) {
      return Response.json(e.payload, { status });
    }
    return Response.json(
      { error: e.message || "Chat failed" },
      { status },
    );
  }
}
