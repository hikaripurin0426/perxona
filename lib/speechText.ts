const CJK_RE =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3000-\u303f]/g;
const JP_PUNCT_RE = /[（）「」『』、。・]/g;
const URL_RE = /https?:\/\/[^\s<>"']+/gi;

/**
 * Build TTS text: keep English speech, drop CJK hints and URLs.
 * Motion Markup tags are preserved. Chat UI still shows the full original reply.
 */
export function toEnglishSpeechText(text: string): string {
  const tags: string[] = [];
  const withPlaceholders = text.replace(/\[MOTION\b[^\]]*\]/gi, (tag) => {
    tags.push(tag);
    return `__MOTION_${tags.length - 1}__`;
  });

  let spoken = withPlaceholders
    .replace(URL_RE, " ")
    .replace(CJK_RE, " ")
    .replace(JP_PUNCT_RE, " ")
    .replace(/\(\s*\)/g, "")
    .replace(/\[\s*\]/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  spoken = spoken.replace(/__MOTION_(\d+)__/g, (_, index) => {
    return tags[Number(index)] || "";
  });

  spoken = spoken.replace(/\s{2,}/g, " ").trim();
  return (
    spoken ||
    withPlaceholders
      .replace(URL_RE, " ")
      .replace(/__MOTION_(\d+)__/g, "")
      .replace(/\s{2,}/g, " ")
      .trim() ||
    "Okay."
  );
}
