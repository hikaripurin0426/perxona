"use client";

import {
  LESSON_AVATARS,
  matchLessonAvatar,
  type LessonAvatarOption,
} from "@/lib/avatars";
import type { CatalogItem } from "@/lib/types";

type Props = {
  avatars: CatalogItem[];
  avatarId: string;
  disabled?: boolean;
  onAvatarChange: (id: string) => void;
};

function labelOf(item: CatalogItem): string {
  return typeof item.name === "string" && item.name ? item.name : item.id;
}

type ResolvedAvatar = {
  option: LessonAvatarOption;
  catalog: CatalogItem | null;
};

const AVATAR_GROUPS: { gender: "male" | "female"; title: string }[] = [
  { gender: "male", title: "Male" },
  { gender: "female", title: "Female" },
];

function resolveAvatars(avatars: CatalogItem[]): ResolvedAvatar[] {
  return LESSON_AVATARS.map((option) => {
    const catalog =
      avatars.find((item) =>
        matchLessonAvatar(
          typeof item.name === "string" ? item.name : undefined,
          option,
        ),
      ) || null;
    return { option, catalog };
  });
}

function AvatarCard({
  option,
  catalog,
  selected,
  disabled,
  onAvatarChange,
}: {
  option: LessonAvatarOption;
  catalog: CatalogItem | null;
  selected: boolean;
  disabled?: boolean;
  onAvatarChange: (id: string) => void;
}) {
  const available = Boolean(catalog);
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`avatar-card${selected ? " is-selected" : ""}${
        available ? "" : " is-unavailable"
      }`}
      disabled={disabled || !available}
      title={
        available
          ? `${labelOf(catalog!)} · ${option.voiceNameKey}`
          : `${option.label} is not available in your catalog`
      }
      onClick={() => {
        if (catalog) onAvatarChange(catalog.id);
      }}
    >
      <span className="avatar-icon">
        {option.iconSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={option.iconSrc} alt="" />
        ) : (
          <span className="avatar-fallback">{option.code}</span>
        )}
      </span>
      <span className="avatar-label">{option.label}</span>
    </button>
  );
}

export function CatalogSelect({
  avatars,
  avatarId,
  disabled,
  onAvatarChange,
}: Props) {
  const resolved = resolveAvatars(avatars);

  return (
    <div className="catalog">
      <div className="field">
        <span>Avatar</span>
        <div className="avatar-groups" role="listbox" aria-label="Avatar">
          {AVATAR_GROUPS.map((group) => {
            const items = resolved.filter(
              ({ option }) => option.gender === group.gender,
            );
            return (
              <div key={group.gender} className="avatar-group">
                <p className="avatar-group-title">{group.title}</p>
                <div className="avatar-grid">
                  {items.map(({ option, catalog }) => (
                    <AvatarCard
                      key={option.code}
                      option={option}
                      catalog={catalog}
                      selected={Boolean(catalog) && catalog!.id === avatarId}
                      disabled={disabled}
                      onAvatarChange={onAvatarChange}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Prefer Tsubasa (cc050) as the default lesson avatar. */
export function pickCuratedAvatarId(
  avatars: CatalogItem[],
  preferred?: string,
): string {
  const resolved = resolveAvatars(avatars).filter((r) => r.catalog);
  const tsubasa = resolved.find((r) => r.option.code === "cc050");
  if (tsubasa?.catalog) return tsubasa.catalog.id;
  if (preferred && resolved.some((r) => r.catalog!.id === preferred)) {
    return preferred;
  }
  return resolved[0]?.catalog?.id || "";
}
