/** Roman-letter nickname: 2–20 letters, no spaces or symbols. */
const NICKNAME_RE = /^[A-Za-z]{2,20}$/;

export function normalizeNickname(raw: string): string {
  return raw.trim();
}

export function isValidRomajiNickname(value: string): boolean {
  return NICKNAME_RE.test(normalizeNickname(value));
}

export function nicknameValidationMessage(value: string): string | null {
  const nick = normalizeNickname(value);
  if (!nick) return "Enter a nickname.";
  if (!/^[A-Za-z]*$/.test(nick)) {
    return "Use Roman letters only (A–Z), no spaces or symbols.";
  }
  if (nick.length < 2) return "Use at least 2 letters.";
  if (nick.length > 20) return "Keep it to 20 letters or fewer.";
  return null;
}
