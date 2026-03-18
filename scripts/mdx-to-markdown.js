/**
 * Converts MDX blog content to Medium-compatible Markdown.
 * Extracts frontmatter, strips JSX/imports, resolves image paths.
 */
export function convertMdx(rawContent, siteUrl) {
  // 1. Extract frontmatter
  const fmMatch = rawContent.match(/^---\n([\s\S]*?)\n---\n/);
  const fmBlock = fmMatch ? fmMatch[1] : '';
  let body = fmMatch ? rawContent.slice(fmMatch[0].length) : rawContent;

  const metadata = {
    title: extractYamlValue(fmBlock, 'title'),
    description: extractYamlValue(fmBlock, 'description'),
    publishDate: extractYamlValue(fmBlock, 'publishDate'),
    tags: extractYamlList(fmBlock, 'tags'),
  };

  // 2. Strip import statements
  body = body.replace(/^import\s+.*$/gm, '');

  // 3. Convert <Tweet ... url="..." /> to bare URL on its own line
  body = body.replace(/<Tweet[\s\S]*?url="([^"]+)"[\s\S]*?\/>/g, '\n$1\n');

  // 4. Convert <Divider /> to horizontal rule
  body = body.replace(/<Divider\s*\/?>/g, '---');

  // 5. Strip Astro client directives from any remaining tags
  body = body.replace(/\s+client:\w+/g, '');

  // 6. Strip any remaining self-closing JSX components
  body = body.replace(/<[A-Z][a-zA-Z]*\s[^>]*\/>/g, '');
  body = body.replace(/<[A-Z][a-zA-Z]*\s*\/>/g, '');

  // 7. Resolve image paths — prepend siteUrl to paths starting with /
  body = body.replace(
    /!\[([^\]]*)\]\((\/[^)]+)\)/g,
    (match, alt, path) => `![${alt}](${siteUrl}${path})`
  );

  // 8. Clean up excessive blank lines (3+ → 2)
  body = body.replace(/\n{3,}/g, '\n\n');

  return { metadata, content: body.trim() };
}

function extractYamlValue(yaml, key) {
  const match = yaml.match(new RegExp(`^${key}:\\s*"?([^"\\n]*)"?`, 'm'));
  return match ? match[1].trim() : '';
}

function extractYamlList(yaml, key) {
  const sectionMatch = yaml.match(new RegExp(`^${key}:\\s*\\n((?:\\s+-\\s+.*\\n?)*)`, 'm'));
  if (!sectionMatch) return [];
  return sectionMatch[1]
    .split('\n')
    .map(line => line.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);
}
