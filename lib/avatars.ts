export type LessonAvatarOption = {
  /** Stable code used for icon filename matching */
  code: string;
  /** Substring expected in Connect catalog avatar name */
  nameKey: string;
  /** UI label */
  label: string;
  /** Public URL for the icon, or null if missing */
  iconSrc: string | null;
  /** Substring expected in Connect catalog voice name */
  voiceNameKey: string;
  /** Display group in the avatar picker */
  gender: "male" | "female";
};

/**
 * Curated avatars available in the English lesson UI.
 * Icons live in /public/avatar_images (served as /avatar_images/...).
 * Each avatar has a fixed voice — not user-selectable.
 */
export const LESSON_AVATARS: LessonAvatarOption[] = [
  {
    code: "cc066",
    nameKey: "cc066_male_waiter",
    label: "James",
    iconSrc: "/avatar_images/cc066.png",
    voiceNameKey: "Male - fresh and upbeat",
    gender: "male",
  },
  {
    code: "cc006",
    nameKey: "cc006_male_fainance",
    label: "Michael",
    iconSrc: "/avatar_images/cc006.png",
    voiceNameKey: "Male - warm and expressive",
    gender: "male",
  },
  {
    code: "cc057a01",
    nameKey: "cc057a01_male_Kagurazaka_lv3",
    label: "Kagurazaka",
    iconSrc: "/avatar_images/cc057a01.png",
    voiceNameKey: "Male - calm and approachable",
    gender: "male",
  },
  {
    code: "cc050",
    nameKey: "cc050_female_tsubasa",
    label: "Tsubasa",
    iconSrc: "/avatar_images/cc050.png",
    voiceNameKey: "Female - cute and fast (For English)",
    gender: "female",
  },
  {
    code: "cc049",
    nameKey: "cc049_female_aya",
    label: "Aya",
    iconSrc: "/avatar_images/cc049.png",
    voiceNameKey: "Female - formal and fast",
    gender: "female",
  },
  {
    code: "cc046",
    nameKey: "cc046_vroid_female",
    label: "VRoid",
    iconSrc: "/avatar_images/cc046.png",
    voiceNameKey: "Female - warm and cheerful",
    gender: "female",
  },
  {
    code: "cc033",
    nameKey: "cc033",
    label: "Sarah",
    iconSrc: "/avatar_images/cc033.png",
    voiceNameKey: "Female - child and bright",
    gender: "female",
  },
];

export function matchLessonAvatar(
  catalogName: string | undefined,
  option: LessonAvatarOption,
): boolean {
  const name = (catalogName || "").toLowerCase();
  if (!name) return false;
  const key = option.nameKey.toLowerCase();
  const code = option.code.toLowerCase();
  return name.includes(key) || name.includes(code);
}

function normalizeVoiceName(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findVoiceIdByNameKey(
  voices: { id: string; name?: string }[],
  voiceNameKey: string,
): string {
  const key = normalizeVoiceName(voiceNameKey);
  if (!key) return "";

  const ranked = [...voices].sort((a, b) => {
    const aEn = /english|en-us|en us|for english/i.test(a.name || "") ? 1 : 0;
    const bEn = /english|en-us|en us|for english/i.test(b.name || "") ? 1 : 0;
    return bEn - aEn;
  });

  const exact = ranked.find(
    (voice) => normalizeVoiceName(voice.name || "") === key,
  );
  if (exact) return exact.id;

  const partial = ranked.find((voice) => {
    const name = normalizeVoiceName(voice.name || "");
    return name.includes(key) || key.includes(name);
  });
  if (partial) return partial.id;

  // Fall back to distinctive phrase match (e.g. "cute and fast for english").
  const tokens = key.split(" ").filter((token) => token.length > 2);
  if (tokens.length < 2) return "";
  const scored = ranked
    .map((voice) => {
      const name = normalizeVoiceName(voice.name || "");
      const hits = tokens.filter((token) => name.includes(token)).length;
      const englishBonus = /english/.test(name) ? 1 : 0;
      return { voice, hits: hits + englishBonus, name };
    })
    .filter(({ hits }) => hits >= Math.min(3, tokens.length))
    .sort((a, b) => b.hits - a.hits);

  return scored[0]?.voice.id || "";
}

export function findLessonAvatarOptionByCatalogId(
  avatars: { id: string; name?: string }[],
  avatarId: string,
): LessonAvatarOption | null {
  const catalog = avatars.find((item) => item.id === avatarId);
  if (!catalog) return null;
  return (
    LESSON_AVATARS.find((option) =>
      matchLessonAvatar(
        typeof catalog.name === "string" ? catalog.name : undefined,
        option,
      ),
    ) || null
  );
}

export function resolveVoiceIdForAvatar(
  avatarId: string,
  avatars: { id: string; name?: string }[],
  voices: { id: string; name?: string }[],
): string {
  const option = findLessonAvatarOptionByCatalogId(avatars, avatarId);
  if (!option) return "";
  return findVoiceIdByNameKey(voices, option.voiceNameKey);
}

/** Fixed lesson scene — not user-selectable. */
export const FIXED_SCENE_NAME_KEY =
  "sova_interior_37_Inside_Training_B01_Chloe";

export function findFixedSceneId(
  scenes: { id: string; name?: string }[],
): string {
  const key = FIXED_SCENE_NAME_KEY.toLowerCase();
  const match = scenes.find((scene) => {
    const name = (scene.name || "").toLowerCase();
    return name.includes(key) || scene.id.toLowerCase() === key;
  });
  return match?.id || "";
}
