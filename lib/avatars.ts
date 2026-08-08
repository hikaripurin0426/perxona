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
    label: "Waiter",
    iconSrc: "/avatar_images/cc066.png",
    voiceNameKey: "Male - fresh and upbeat",
    gender: "male",
  },
  {
    code: "cc006",
    nameKey: "cc006_male_fainance",
    label: "Finance",
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
    voiceNameKey: "Female - cute and fast(For English)",
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
    label: "cc033",
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

export function findVoiceIdByNameKey(
  voices: { id: string; name?: string }[],
  voiceNameKey: string,
): string {
  const key = voiceNameKey.toLowerCase().replace(/\s+/g, " ").trim();
  const exact = voices.find((voice) => {
    const name = (voice.name || "").toLowerCase().replace(/\s+/g, " ").trim();
    return name === key;
  });
  if (exact) return exact.id;

  const partial = voices.find((voice) => {
    const name = (voice.name || "").toLowerCase().replace(/\s+/g, " ").trim();
    return name.includes(key) || key.includes(name);
  });
  return partial?.id || "";
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
