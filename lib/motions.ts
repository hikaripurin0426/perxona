import type { MotionItem } from "./connect";

const MOTION_TAG_CANDIDATE_RE = /\[MOTION\b[^\]]*(?:\]|$)/gi;
const MOTION_TAG_RE =
  /^\[MOTION\s+([^\s:;\]]+):\d+(?:;([^\s:;\]]+):\d+)?\]$/i;

export function parseMotionIds(script: string): string[] {
  const candidates = [...script.matchAll(MOTION_TAG_CANDIDATE_RE)].map(
    ([match]) => match,
  );
  return candidates.flatMap((candidate) => {
    const match = MOTION_TAG_RE.exec(candidate);
    MOTION_TAG_RE.lastIndex = 0;
    if (!match) return [];
    return [match[1], match[2]].filter(Boolean) as string[];
  });
}

export function stripMotionMarkup(script: string): string {
  return script.replace(MOTION_TAG_CANDIDATE_RE, " ").replace(/\s+/g, " ").trim();
}

export function validateMotionScript(
  script: string,
  motions: MotionItem[],
): string {
  const trimmed = script.trim();
  if (!trimmed) {
    throw Object.assign(new Error("Script is empty"), { status: 502 });
  }
  const known = new Set(motions.map((m) => m.id));
  const unknown = parseMotionIds(trimmed).filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw Object.assign(
      new Error(`Unknown motion IDs: ${[...new Set(unknown)].join(", ")}`),
      { status: 502 },
    );
  }
  return trimmed;
}

/** Prefer motions whose name matches any keyword (case-insensitive). */
export function findMotionByKeywords(
  motions: MotionItem[],
  keywords: string[],
): MotionItem | null {
  const lowered = keywords.map((k) => k.toLowerCase());
  const scored = motions
    .map((motion) => {
      const name = motion.name.toLowerCase();
      const hits = lowered.filter((k) => name.includes(k)).length;
      return { motion, hits };
    })
    .filter(({ hits }) => hits > 0)
    .sort((a, b) => b.hits - a.hits);
  return scored[0]?.motion || null;
}

export function withMotionMarkup(text: string, motionId: string | null): string {
  const clean = stripMotionMarkup(text);
  if (!motionId) return clean;
  return `[MOTION ${motionId}:1] ${clean}`;
}
