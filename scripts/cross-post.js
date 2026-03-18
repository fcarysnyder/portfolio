import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { join, basename } from 'path';
import { convertMdx } from './mdx-to-markdown.js';
import { publish as publishToMedium } from './publishers/medium.js';

const BLOG_DIR = 'src/content/blog';
const STATUS_FILE = 'cross-post-status.json';
const OUTPUT_DIR = 'scripts/output';
const SITE_URL = process.env.SITE_URL || 'https://www.fcarysnyder.com';
const FORCE_SLUG = process.env.FORCE_SLUG || '';

async function main() {
  // Load tracking file
  let status = {};
  try {
    status = JSON.parse(await readFile(STATUS_FILE, 'utf-8'));
  } catch {
    // File doesn't exist yet — start fresh
  }

  // Find all MDX blog posts
  const files = (await readdir(BLOG_DIR)).filter(f => f.endsWith('.mdx'));
  const newPosts = [];

  for (const file of files) {
    const slug = basename(file, '.mdx');

    // Skip if already tracked (unless forced)
    if (FORCE_SLUG) {
      if (slug !== FORCE_SLUG) continue;
    } else if (status[slug]?.medium) {
      continue;
    }

    const raw = await readFile(join(BLOG_DIR, file), 'utf-8');
    const { metadata, content } = convertMdx(raw, SITE_URL);

    // Write converted Markdown to output dir
    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(join(OUTPUT_DIR, `${slug}.md`), content, 'utf-8');

    const canonicalUrl = `${SITE_URL}/writing/${slug}`;

    // Publish to Medium
    console.log(`Publishing "${metadata.title}" to Medium...`);
    const result = await publishToMedium({
      title: metadata.title,
      content,
      canonicalUrl,
      tags: metadata.tags,
    });

    console.log(`  → Draft created: ${result.url}`);

    // Update tracking
    status[slug] = status[slug] || {};
    status[slug].medium = {
      id: result.id,
      url: result.url,
      publishedAt: new Date().toISOString().split('T')[0],
    };

    newPosts.push({ slug, metadata, canonicalUrl, mediumUrl: result.url });
  }

  if (newPosts.length === 0) {
    console.log('No new posts to cross-post.');
    return;
  }

  // Save updated tracking file
  await writeFile(STATUS_FILE, JSON.stringify(status, null, 2) + '\n', 'utf-8');
  console.log(`Updated ${STATUS_FILE} with ${newPosts.length} new post(s).`);

  // Write LinkedIn blurb(s) to GitHub Actions summary
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    let summary = '';
    for (const { slug, metadata, canonicalUrl, mediumUrl } of newPosts) {
      const hashtags = metadata.tags
        .map(t => `#${t.replace(/\s+/g, '')}`)
        .join(' ');

      summary += `## Cross-posted: ${metadata.title}\n\n`;
      summary += `**Medium draft:** ${mediumUrl}\n\n`;
      summary += `### LinkedIn Blurb\n\n`;
      summary += `> 🚀 I just published: "${metadata.title}"\n>\n`;
      summary += `> ${metadata.description}\n>\n`;
      summary += `> Read the full post: ${canonicalUrl}\n>\n`;
      summary += `> ${hashtags}\n\n`;
      summary += `---\n\n`;
    }
    await writeFile(summaryFile, summary, { flag: 'a' });
  }
}

main().catch(err => {
  console.error('Cross-post failed:', err.message);
  process.exit(1);
});
