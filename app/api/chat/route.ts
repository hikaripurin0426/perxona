import {
  createPresentation,
  fetchAvatarMotions,
  isConnectConfigured,
} from "@/lib/connect";
import {
  findMotionByKeywords,
  withMotionMarkup,
} from "@/lib/motions";
import { isValidRomajiNickname, normalizeNickname } from "@/lib/nickname";
import { toEnglishSpeechText } from "@/lib/speechText";
import { askAvilingoTutor, pickTutorEmotion } from "@/lib/tutorBot";
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

    const reply = await askAvilingoTutor(normalized, {
      tutorName,
      learnerName: isValidRomajiNickname(learnerName) ? learnerName : null,
      levelLabel,
    });

    const { emotion, intensity } = pickTutorEmotion(reply);
    const displayReply = reply;
    const speechText = toEnglishSpeechText(reply);
    let script = speechText;
    let usedConnectPresentation = false;

    const motions = avatarId ? await fetchAvatarMotions(avatarId) : [];
    const cue =
      findMotionByKeywords(motions, [
        "talk",
        "speak",
        "explain",
        "nod",
        "gesture",
        "wave",
      ]) || motions[0] || null;

    if (avatarId && speechText) {
      try {
        const presentation = await createPresentation({
          avatarId,
          voiceId: voiceId || undefined,
          message: speechText,
          emotion,
          intensity,
        });
        if (
          typeof presentation.presentation === "string" &&
          presentation.presentation.trim()
        ) {
          // Keep English-only for TTS even if upstream echoes other text.
          script = toEnglishSpeechText(presentation.presentation.trim());
          usedConnectPresentation = true;
        }
      } catch {
        // Fall back to Motion Markup below.
      }
    }

    if (!usedConnectPresentation) {
      script = withMotionMarkup(speechText, cue?.id || null);
    }

    return Response.json({
      reply: displayReply,
      script,
      emotion,
      intensity,
      motionId: cue?.id || null,
      provider: "connect-chatbot",
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
