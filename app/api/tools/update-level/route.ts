import {
  isFirebaseAdminConfigured,
  saveLevelAssessmentAdmin,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    const secret = process.env.AVILINGO_TOOL_SECRET;
    if (!secret) {
      return Response.json(
        { error: "AVILINGO_TOOL_SECRET is not configured." },
        { status: 501 },
      );
    }

    const headerKey =
      request.headers.get("x-avilingo-tool-key") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!headerKey || headerKey !== secret) {
      return unauthorized();
    }

    if (!isFirebaseAdminConfigured()) {
      return Response.json(
        {
          error:
            "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY).",
        },
        { status: 501 },
      );
    }

    const body = await request.json();
    const uid = typeof body?.uid === "string" ? body.uid.trim() : "";
    const levelLabel =
      typeof body?.levelLabel === "string"
        ? body.levelLabel.trim().toUpperCase()
        : "";
    const reason =
      typeof body?.reason === "string" ? body.reason.trim() : undefined;
    let level =
      typeof body?.level === "number" ? Math.round(body.level) : NaN;

    const labelToLevel: Record<string, number> = {
      A1: 1,
      A2: 2,
      B1: 3,
      B2: 4,
      C1: 5,
    };
    if (!Number.isFinite(level) && levelLabel) {
      level = labelToLevel[levelLabel] ?? NaN;
    }
    const levelToLabel: Record<number, string> = {
      1: "A1",
      2: "A2",
      3: "B1",
      4: "B2",
      5: "C1",
    };
    const resolvedLabel = levelToLabel[level] || levelLabel;
    if (!uid || !resolvedLabel || !Number.isFinite(level)) {
      return Response.json(
        {
          error:
            "Body must include uid, and level (1-5) or levelLabel (A1-C1).",
        },
        { status: 400 },
      );
    }

    await saveLevelAssessmentAdmin(uid, {
      level,
      levelLabel: resolvedLabel,
      reason,
    });

    return Response.json({
      ok: true,
      uid,
      level,
      levelLabel: resolvedLabel,
      savedVia: "connect-chatbot-tool",
    });
  } catch (err) {
    const e = err as Error & { status?: number };
    return Response.json(
      { error: e.message || "Failed to update level" },
      { status: e.status ?? 502 },
    );
  }
}
