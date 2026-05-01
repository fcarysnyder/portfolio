const WORDS_PER_MINUTE = 238;

export function getReadingTime(text: string): number {
  const stripped = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/^import\s.+from\s.+;?$/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`\[\]()!>~|]/g, '');

  const words = stripped.split(/\s+/).filter(Boolean);
  return Math.max(1, Math.ceil(words.length / WORDS_PER_MINUTE));
}
