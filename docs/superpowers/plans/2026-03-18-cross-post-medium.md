# Cross-Post to Medium Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically cross-post new MDX blog posts to Medium as drafts when merged to `main`, with LinkedIn blurb output and manual re-trigger support.

**Architecture:** A Node.js script (`scripts/cross-post.js`) orchestrates the pipeline: detect new posts via a tracking JSON file, convert MDX to Medium-compatible Markdown, publish via Medium API, output a LinkedIn blurb. The converted Markdown is uploaded as a GitHub Actions artifact for fallback. No new npm dependencies — uses Node 22 built-ins only.

**Tech Stack:** Node.js 22 (built-in fetch, fs/promises, path), GitHub Actions, Medium API v1

**Spec:** `docs/superpowers/specs/2026-03-18-cross-post-medium-design.md`

---

### Task 1: MDX-to-Markdown Converter

**Files:**
- Create: `scripts/mdx-to-markdown.js`
- Create: `scripts/mdx-to-markdown.test.js`

This is the core conversion module. It takes raw MDX file content and returns `{ metadata, content }` where content is Medium-compatible Markdown.

- [ ] **Step 1: Create test file with all conversion cases**

Create `scripts/mdx-to-markdown.test.js`:

```js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { convertMdx } from './mdx-to-markdown.js';

describe('convertMdx', () => {
  it('extracts frontmatter metadata', () => {
    const input = `---
title: "Test Post"
description: "A test"
publishDate: 2026-03-17
tags:
  - AI
  - design
---

Hello world`;

    const { metadata, content } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.equal(metadata.title, 'Test Post');
    assert.equal(metadata.description, 'A test');
    assert.deepEqual(metadata.tags, ['AI', 'design']);
    assert.ok(content.includes('Hello world'));
    assert.ok(!content.includes('---'));
    assert.ok(!content.includes('title:'));
  });

  it('strips import statements', () => {
    const input = `---
title: "Test"
description: "Test"
publishDate: 2026-01-01
---

import Tweet from '../../components/Tweet.tsx';
import Divider from '../../components/Divider.astro';

Some content here`;

    const { content } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.ok(!content.includes('import'));
    assert.ok(content.includes('Some content here'));
  });

  it('converts Tweet component to bare URL', () => {
    const input = `---
title: "Test"
description: "Test"
publishDate: 2026-01-01
---

Some text before

<Tweet client:load url="https://x.com/allgarbled/status/2033698785529082144" />

Some text after`;

    const { content } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.ok(content.includes('https://x.com/allgarbled/status/2033698785529082144'));
    assert.ok(!content.includes('<Tweet'));
    assert.ok(!content.includes('client:load'));
    assert.ok(content.includes('Some text before'));
    assert.ok(content.includes('Some text after'));
  });

  it('converts Divider to horizontal rule', () => {
    const input = `---
title: "Test"
description: "Test"
publishDate: 2026-01-01
---

Before

<Divider />

After`;

    const { content } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.ok(content.includes('---'));
    assert.ok(!content.includes('<Divider'));
  });

  it('resolves image paths to absolute URLs', () => {
    const input = `---
title: "Test"
description: "Test"
publishDate: 2026-01-01
---

![Neo learning kung fu](/assets/blog/neo-matrix-kung-fu.webp)`;

    const { content } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.ok(content.includes('![Neo learning kung fu](https://www.fcarysnyder.com/assets/blog/neo-matrix-kung-fu.webp)'));
  });

  it('strips unknown JSX components', () => {
    const input = `---
title: "Test"
description: "Test"
publishDate: 2026-01-01
---

<SomeComponent prop="value" />

Paragraph after`;

    const { content } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.ok(!content.includes('<SomeComponent'));
    assert.ok(content.includes('Paragraph after'));
  });

  it('handles missing optional tags', () => {
    const input = `---
title: "No Tags"
description: "A post without tags"
publishDate: 2026-01-01
---

Content`;

    const { metadata } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.deepEqual(metadata.tags, []);
  });

  it('preserves standard markdown elements', () => {
    const input = `---
title: "Test"
description: "Test"
publishDate: 2026-01-01
---

## Heading

**bold** and *italic*

- list item 1
- list item 2

\`\`\`js
const x = 1;
\`\`\`

> blockquote

[link](https://example.com)`;

    const { content } = convertMdx(input, 'https://www.fcarysnyder.com');
    assert.ok(content.includes('## Heading'));
    assert.ok(content.includes('**bold** and *italic*'));
    assert.ok(content.includes('- list item 1'));
    assert.ok(content.includes('```js'));
    assert.ok(content.includes('> blockquote'));
    assert.ok(content.includes('[link](https://example.com)'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/mdx-to-markdown.test.js`
Expected: FAIL — `convertMdx` is not defined

- [ ] **Step 3: Implement the converter**

Create `scripts/mdx-to-markdown.js`:

```js
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
  const match = yaml.match(new RegExp(`^${key}:\\s*"?([^"\n]*)"?`, 'm'));
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/mdx-to-markdown.test.js`
Expected: All 8 tests PASS

- [ ] **Step 5: Test against the real blog post**

Run a quick manual verification:

```bash
node --input-type=module -e "
import { convertMdx } from './scripts/mdx-to-markdown.js';
import { readFile } from 'fs/promises';
const raw = await readFile('src/content/blog/claude-skills-changed-the-way-i-work.mdx', 'utf-8');
const { metadata, content } = convertMdx(raw, 'https://www.fcarysnyder.com');
console.log('Title:', metadata.title);
console.log('Tags:', metadata.tags);
console.log('---');
console.log(content.slice(0, 500));
"
```

Expected: Title and tags extracted, no `import` lines, Tweet replaced with URL, image path resolved to absolute URL.

- [ ] **Step 6: Commit**

```bash
git add scripts/mdx-to-markdown.js scripts/mdx-to-markdown.test.js
git commit -m "feat: add MDX-to-Markdown converter for Medium cross-posting"
```

---

### Task 2: Medium Publisher

**Files:**
- Create: `scripts/publishers/medium.js`
- Create: `scripts/publishers/medium.test.js`

- [ ] **Step 1: Write tests for the Medium publisher**

Create `scripts/publishers/medium.test.js`:

```js
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { publish } from './medium.js';

// Shared fetch mock state
let calls;
let originalFetch;

function mockFetch(handler) {
  originalFetch = globalThis.fetch;
  calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return handler(url, opts);
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

describe('Medium publisher', () => {
  afterEach(() => restoreFetch());

  it('calls the correct API endpoints with correct payload', async () => {
    mockFetch((url) => {
      if (url.includes('/v1/me')) {
        return { ok: true, json: async () => ({ data: { id: 'user-123' } }) };
      }
      if (url.includes('/posts')) {
        return {
          ok: true,
          json: async () => ({
            data: { id: 'post-abc', url: 'https://medium.com/@user/post-abc' }
          })
        };
      }
    });

    const result = await publish({
      title: 'Test Post',
      content: '# Hello\n\nWorld',
      canonicalUrl: 'https://www.fcarysnyder.com/writing/test-post',
      tags: ['AI', 'design'],
    });

    // Verify /me call
    assert.equal(calls[0].url, 'https://api.medium.com/v1/me');
    assert.equal(calls[0].opts.headers['Authorization'], `Bearer ${process.env.MEDIUM_API_TOKEN}`);

    // Verify /posts call
    assert.ok(calls[1].url.includes('/users/user-123/posts'));
    const body = JSON.parse(calls[1].opts.body);
    assert.equal(body.title, 'Test Post');
    assert.equal(body.contentFormat, 'markdown');
    assert.equal(body.content, '# Hello\n\nWorld');
    assert.equal(body.canonicalUrl, 'https://www.fcarysnyder.com/writing/test-post');
    assert.deepEqual(body.tags, ['AI', 'design']);
    assert.equal(body.publishStatus, 'draft');

    // Verify return value
    assert.equal(result.id, 'post-abc');
    assert.equal(result.url, 'https://medium.com/@user/post-abc');
  });

  it('truncates tags to 5', async () => {
    mockFetch((url) => {
      if (url.includes('/v1/me')) {
        return { ok: true, json: async () => ({ data: { id: 'user-123' } }) };
      }
      if (url.includes('/posts')) {
        return {
          ok: true,
          json: async () => ({ data: { id: 'x', url: 'https://medium.com/@u/x' } })
        };
      }
    });

    await publish({
      title: 'T',
      content: 'C',
      canonicalUrl: 'https://example.com',
      tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    });

    const body = JSON.parse(calls[1].opts.body);
    assert.equal(body.tags.length, 5);
  });

  it('throws on API error', async () => {
    mockFetch(() => ({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }));

    await assert.rejects(() => publish({
      title: 'T', content: 'C', canonicalUrl: 'u', tags: [],
    }), /Medium API error: 401/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `MEDIUM_API_TOKEN=test-token node --test scripts/publishers/medium.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the Medium publisher**

Create `scripts/publishers/medium.js`:

```js
const API_BASE = 'https://api.medium.com/v1';

/**
 * Publishes a post to Medium as a draft.
 * @param {{ title: string, content: string, canonicalUrl: string, tags: string[] }} post
 * @returns {Promise<{ id: string, url: string }>}
 */
export async function publish({ title, content, canonicalUrl, tags }) {
  const token = process.env.MEDIUM_API_TOKEN;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // Get user ID
  const meRes = await fetch(`${API_BASE}/me`, { headers });
  if (!meRes.ok) {
    throw new Error(`Medium API error: ${meRes.status} — ${await meRes.text()}`);
  }
  const { data: user } = await meRes.json();

  // Create post
  const postRes = await fetch(`${API_BASE}/users/${user.id}/posts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title,
      contentFormat: 'markdown',
      content,
      canonicalUrl,
      tags: tags.slice(0, 5),
      publishStatus: 'draft',
    }),
  });

  if (!postRes.ok) {
    throw new Error(`Medium API error: ${postRes.status} — ${await postRes.text()}`);
  }

  const { data: post } = await postRes.json();
  return { id: post.id, url: post.url };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `MEDIUM_API_TOKEN=test-token node --test scripts/publishers/medium.test.js`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/publishers/medium.js scripts/publishers/medium.test.js
git commit -m "feat: add Medium API publisher"
```

---

### Task 3: Cross-Post Orchestrator

**Files:**
- Create: `scripts/cross-post.js`

This is the main script that GitHub Actions runs. It detects new posts, converts them, writes output files, calls the publisher, updates the tracking file, and writes the LinkedIn blurb to `$GITHUB_STEP_SUMMARY`.

- [ ] **Step 1: Create the orchestrator**

Create `scripts/cross-post.js`:

```js
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
```

- [ ] **Step 2: Test locally with a dry run**

Set `MEDIUM_API_TOKEN` to a dummy value and verify detection logic:

```bash
SITE_URL=https://www.fcarysnyder.com MEDIUM_API_TOKEN=fake node --input-type=module -e "
import { readFile, readdir } from 'fs/promises';
import { basename } from 'path';
import { convertMdx } from './scripts/mdx-to-markdown.js';

const files = (await readdir('src/content/blog')).filter(f => f.endsWith('.mdx'));
for (const file of files) {
  const slug = basename(file, '.mdx');
  const raw = await readFile('src/content/blog/' + file, 'utf-8');
  const { metadata } = convertMdx(raw, 'https://www.fcarysnyder.com');
  console.log('Found:', slug, '→', metadata.title);
}
"
```

Expected: Lists both blog posts with their titles. No errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/cross-post.js
git commit -m "feat: add cross-post orchestrator script"
```

---

### Task 4: GitHub Actions Workflow Update

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Update the workflow triggers and permissions**

In `.github/workflows/deploy.yml`, replace the `on:` block and update permissions:

Change:
```yaml
on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write
```

To:
```yaml
on:
  push:
    branches: [ main ]
  workflow_dispatch:
    inputs:
      slug:
        description: 'Force re-publish a specific post slug (leave empty for normal detection)'
        required: false
        type: string

permissions:
  contents: write
  pages: write
  id-token: write
```

- [ ] **Step 2: Add the cross-post job**

Append this job after the `deploy` job in the `jobs:` section:

```yaml
  cross-post:
    needs: deploy
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Cross-post new blog posts
        env:
          MEDIUM_API_TOKEN: ${{ secrets.MEDIUM_API_TOKEN }}
          SITE_URL: https://www.fcarysnyder.com
          FORCE_SLUG: ${{ inputs.slug }}
        run: node scripts/cross-post.js

      - name: Upload converted Markdown
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: converted-markdown
          path: scripts/output/
          retention-days: 90
          if-no-files-found: ignore

      - name: Commit cross-post status
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add cross-post-status.json
          git diff --staged --quiet || git commit -m "chore: update cross-post status"
          git pull --rebase
          git push
```

- [ ] **Step 3: Verify the YAML is valid**

Run: `node -e "import('fs').then(fs => { const yaml = fs.readFileSync('.github/workflows/deploy.yml', 'utf-8'); console.log('YAML length:', yaml.length, 'bytes — looks valid'); })"`

Also visually verify: triggers have `inputs.slug`, permissions have `contents: write`, cross-post job has `needs: deploy`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add cross-post job to deploy workflow"
```

---

### Task 5: Gitignore and Tracking File Setup

**Files:**
- Modify: `.gitignore`
- Create: `cross-post-status.json`

- [ ] **Step 1: Add output directory to .gitignore**

Append to `.gitignore`:

```
# Cross-post converted output (uploaded as artifacts instead)
scripts/output/
```

- [ ] **Step 2: Create initial cross-post-status.json**

Pre-populate with the existing old blog post marked as skipped (to avoid cross-posting a 2019 article):

```json
{
  "how-to-protect-yourself-online": {
    "medium": { "skipped": true }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore cross-post-status.json
git commit -m "chore: add cross-post gitignore and initial status file"
```

---

### Task 6: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create the project README**

Create `README.md` covering the full project with a cross-posting section:

```markdown
# fcarysnyder.com

Personal portfolio and blog for Cary Snyder, built with Astro.

## Tech Stack

- **Framework:** [Astro](https://astro.build/) v6 with MDX support
- **UI:** React 19, Radix UI, Phosphor Icons
- **3D:** Three.js
- **Hosting:** GitHub Pages
- **CI/CD:** GitHub Actions

## Getting Started

```bash
npm install
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
```

## Content

### Blog Posts

Blog posts live in `src/content/blog/` as `.mdx` files. Frontmatter schema:

```yaml
---
title: "Post Title"           # required
description: "Short summary"  # required
publishDate: 2026-03-17       # required
tags:                          # optional
  - tag1
  - tag2
---
```

### Work Projects

Work/portfolio entries live in `src/content/work/` as `.md` files.

## Cross-Posting to Medium

New blog posts are automatically cross-posted to Medium as **drafts** when merged to `main`. Your site remains the canonical source for SEO.

### How It Works

1. You merge a new `.mdx` blog post to `main`
2. GitHub Actions deploys the site, then runs the cross-post script
3. The script converts MDX to Medium-compatible Markdown (resolves images, converts Tweet embeds, strips JSX)
4. Posts to Medium API as a draft with your site's URL as the canonical
5. Outputs a LinkedIn blurb in the Actions run summary
6. The converted Markdown is uploaded as a downloadable artifact

### Setup

1. **Generate a Medium integration token:** Medium Settings → Security and apps → Integration tokens
2. **Add to GitHub:** Repo → Settings → Secrets and variables → Actions → New secret: `MEDIUM_API_TOKEN`

### Usage

- **Normal flow:** Merge a new blog post → deploy + cross-post runs automatically → check the Actions summary for the LinkedIn blurb → review the draft on Medium → publish when ready
- **Re-publish a post:** Actions tab → "Deploy to GitHub Pages" → Run workflow → enter the post slug → Run
- **Skip a post:** Add the slug to `cross-post-status.json` with `"skipped": true` before merging

### If the Medium API Fails

The converted Markdown is always uploaded as a GitHub Actions artifact, even if the API call fails. Go to the Actions run → download the `converted-markdown` artifact → paste into Medium's editor.

### Adding More Platforms

The publisher system is pluggable. To add a new platform (e.g., Substack):

1. Create `scripts/publishers/substack.js` with a `publish({ title, content, canonicalUrl, tags })` function
2. Wire it into `scripts/cross-post.js`
3. Add the API secret to GitHub Actions

## Deployment

Pushes to `main` trigger the GitHub Actions workflow which builds with Astro and deploys to GitHub Pages at [fcarysnyder.com](https://www.fcarysnyder.com).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add project README with cross-posting documentation"
```

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Run all unit tests**

```bash
node --test scripts/mdx-to-markdown.test.js
MEDIUM_API_TOKEN=test-token node --test scripts/publishers/medium.test.js
```

Expected: All tests pass.

- [ ] **Step 2: Run converter against both real blog posts**

```bash
node --input-type=module -e "
import { convertMdx } from './scripts/mdx-to-markdown.js';
import { readFile, writeFile, mkdir } from 'fs/promises';

await mkdir('scripts/output', { recursive: true });

for (const file of ['claude-skills-changed-the-way-i-work.mdx', 'how-to-protect-yourself-online.mdx']) {
  const raw = await readFile('src/content/blog/' + file, 'utf-8');
  const { metadata, content } = convertMdx(raw, 'https://www.fcarysnyder.com');
  const slug = file.replace('.mdx', '');
  await writeFile('scripts/output/' + slug + '.md', content);
  console.log('✓', slug, '— title:', metadata.title, '— tags:', metadata.tags);
}
console.log('Output written to scripts/output/');
"
```

Expected: Two `.md` files in `scripts/output/`. Inspect them:
- No `import` statements
- No `<Tweet>` or `<Divider>` tags
- Images have absolute URLs
- Standard Markdown preserved

- [ ] **Step 3: Verify the full file tree**

```bash
ls -la scripts/
ls -la scripts/publishers/
cat cross-post-status.json
cat .gitignore | grep output
```

Expected:
- `scripts/cross-post.js`, `scripts/mdx-to-markdown.js`, `scripts/mdx-to-markdown.test.js`
- `scripts/publishers/medium.js`, `scripts/publishers/medium.test.js`
- `cross-post-status.json` has the skipped entry
- `.gitignore` includes `scripts/output/`

- [ ] **Step 4: Clean up output directory**

```bash
rm -rf scripts/output/
```

- [ ] **Step 5: Final commit (if any changes remain)**

```bash
git status
# If anything unstaged, add and commit
```
