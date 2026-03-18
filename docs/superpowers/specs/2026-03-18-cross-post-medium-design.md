# Cross-Post Blog to Medium — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Author:** Cary Snyder + Claude

## Problem

Blog posts published as MDX on fcarysnyder.com need to be cross-posted to Medium for broader distribution. The process should be automated via GitHub Actions, preserve content fidelity, and not harm the original site's SEO.

## Goals

1. Automatically cross-post new blog posts to Medium as drafts on merge to `main`
2. Set canonical URL to the original blog so SEO stays with the source
3. Generate a LinkedIn blurb for manual sharing
4. Design for future extensibility (Substack, etc.) without implementing it now
5. Never modify source MDX files

## Non-Goals

- Syncing edits to already-published posts (tracked posts are skipped)
- Publishing to Substack (future — system designed to support it)
- AI-generated LinkedIn copy (simple template from frontmatter)

## Architecture

### File Structure

```
scripts/
  cross-post.js            # Orchestrator — detects new posts, runs pipeline
  mdx-to-markdown.js       # MDX → Medium-compatible Markdown conversion
  output/                  # Converted Markdown files (.gitignore'd, uploaded as artifacts)
  publishers/
    medium.js              # Medium API client
    # substack.js          # Future

cross-post-status.json     # Tracks published posts (committed to repo)
README.md                  # Includes cross-posting section (setup, usage, troubleshooting)
```

### MDX → Markdown Conversion (`mdx-to-markdown.js`)

Processes MDX content in memory (never modifies source files):

1. **Extract frontmatter** — parses YAML block, returns `{ title, description, publishDate, tags }` as metadata and the remaining content body
2. **Strip import statements** — removes lines like `import Tweet from '...'`
3. **Convert `<Tweet ... url="..." />`** — regex match on `<Tweet` with any attributes (including Astro directives like `client:load`), extract the `url` prop value, output it on its own line. Medium auto-unfurls Twitter/X URLs into rich embed cards.
4. **Strip Astro directives** — remove `client:load`, `client:visible`, `client:idle`, etc. from any remaining component tags
5. **Strip remaining JSX components** — removes `<Divider />` and any other custom components cleanly
6. **Resolve image paths** — converts paths starting with `/` (e.g., `/assets/blog/foo.png`) to absolute URLs (`https://www.fcarysnyder.com/assets/blog/foo.png`). Medium fetches and caches images from these URLs.
7. **Pass through standard Markdown** — headings, bold, italic, code blocks, blockquotes, and lists are natively supported by Medium's Markdown ingestion

**Component conversion rules:**

| MDX Component | Medium Output |
|---|---|
| `<Tweet client:load url="https://x.com/.../status/123" />` | `https://x.com/.../status/123` (own line, Medium auto-unfurls) |
| `<Divider />` | `---` (horizontal rule) |
| `import ...` | removed |
| `client:load`, `client:visible`, etc. | removed (Astro directives) |
| `![alt](/assets/blog/foo.png)` | `![alt](https://www.fcarysnyder.com/assets/blog/foo.png)` |

### Publisher Interface (`scripts/publishers/`)

Each publisher exports a single async function:

```js
// publish({ title, content, canonicalUrl, tags }) → { id, url }
```

**`medium.js` implementation:**

1. `GET https://api.medium.com/v1/me` — retrieve the authenticated user's Medium ID
2. `POST https://api.medium.com/v1/users/{userId}/posts` with:
   - `title` — from frontmatter
   - `contentFormat: "markdown"`
   - `content` — converted Markdown
   - `canonicalUrl` — `https://www.fcarysnyder.com/writing/{slug}`
   - `tags` — from frontmatter (first 5 only; Medium's limit)
   - `publishStatus: "draft"`

Returns `{ id, url }` from the Medium API response.

### New Post Detection & Tracking

**`cross-post-status.json`** (repo root):

```json
{
  "claude-skills-changed-the-way-i-work": {
    "medium": {
      "id": "abc123def",
      "url": "https://medium.com/@user/claude-skills-abc123def",
      "publishedAt": "2026-03-18"
    }
  }
}
```

**Detection logic (`cross-post.js`):**

1. Glob all `.mdx` files in `src/content/blog/`
2. Extract slug from filename (strip `.mdx` extension)
3. Load `cross-post-status.json` (default to `{}` if file does not exist)
4. For each slug NOT in the status file (or forced via `FORCE_SLUG` env var from manual trigger):
   - Read and convert the MDX file
   - Write converted Markdown to `scripts/output/{slug}.md` (for fallback/debugging)
   - Call each enabled publisher
   - Update status file with returned `{ id, url, publishedAt }`
5. If any posts were published, commit updated `cross-post-status.json`
6. Output LinkedIn blurb(s) to `$GITHUB_STEP_SUMMARY`
7. Upload all files in `scripts/output/` as a GitHub Actions artifact (downloadable from the run page for 90 days)

The `scripts/output/` directory is `.gitignore`d — these are derived artifacts, not source files.

### GitHub Actions Workflow

Added as a new job in `.github/workflows/deploy.yml`.

**Permissions change:** The existing workflow has `permissions: contents: read`. This must be changed to `contents: write` so the cross-post job can push the updated `cross-post-status.json`. The existing `workflow_dispatch:` trigger must be replaced with the version below that includes the `slug` input.

```yaml
cross-post:
  needs: deploy  # Images must be live before Medium fetches them
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

**Triggers:**

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      slug:
        description: 'Force re-publish a specific post slug (leave empty for normal detection)'
        required: false
        type: string
```

- `push` to `main` — normal new-post detection
- `workflow_dispatch` with no slug — same as push (detect untracked posts)
- `workflow_dispatch` with slug — force re-publish that post, even if already tracked

**Secrets required:**
- `MEDIUM_API_TOKEN` — generated from Medium Settings → Integration tokens

### LinkedIn Blurb

Written to `$GITHUB_STEP_SUMMARY` (visible in the Actions run page). Template:

```
🚀 I just published: "{title}"

{description}

Read the full post: https://www.fcarysnyder.com/writing/{slug}

{tags as hashtags}
```

No file committed. Copy-paste from the Actions summary to LinkedIn.

### Error Handling

| Scenario | Behavior |
|---|---|
| Medium API fails | Step fails, but converted Markdown is still uploaded as an artifact (the upload step uses `if: always()`). Download it from the Actions run page and paste into Medium manually. `cross-post-status.json` not updated → retries on next run |
| No new posts | Script exits cleanly with success, no commit, no noise |
| Multiple new posts | Processed sequentially, status updated after each success |
| Image 404 on Medium fetch | Medium shows broken image — deploy job completing first prevents this |
| Invalid/expired token | API returns 401, step fails, notification sent |

**Known risk:** Medium's public API has been frozen since ~2017 and may be deprecated. If it stops working, download the converted Markdown from the Actions artifact and paste it into Medium's editor manually. The conversion module is still valuable regardless.

### Extensibility

Adding a new publisher (e.g., Substack):

1. Create `scripts/publishers/substack.js` exporting the same `publish()` interface
2. Add it to the publisher list in `cross-post.js`
3. Add a corresponding secret (`SUBSTACK_API_TOKEN` or equivalent)
4. `cross-post-status.json` tracks each publisher independently per slug

## Setup Instructions

### One-Time Setup

1. **Generate a Medium integration token:**
   - Go to [Medium Settings](https://medium.com/me/settings/security) → Integration tokens
   - Create a new token, copy it

2. **Add the token to GitHub:**
   - Go to your repo → Settings → Secrets and variables → Actions
   - Create a new secret: `MEDIUM_API_TOKEN` = your token

3. **Initialize the tracking file:**
   - `cross-post-status.json` will be created automatically on first run
   - If you want to skip existing posts (avoid cross-posting old articles), pre-populate it:
     ```json
     {
       "how-to-protect-yourself-online": { "medium": { "skipped": true } }
     }
     ```

### Day-to-Day Usage

- **Normal flow:** Write a new `.mdx` post → merge to `main` → deploy runs → cross-post runs → check Actions summary for LinkedIn blurb → review draft on Medium → publish when ready
- **Re-publish a post:** Go to Actions → "Deploy to GitHub Pages" → Run workflow → enter the slug → run
- **Check what's been published:** Look at `cross-post-status.json` in the repo

### Troubleshooting

- **Cross-post didn't trigger:** Check that the deploy job succeeded first (cross-post `needs: deploy`)
- **Medium API error:** Check the Actions log. Common issues: expired token (regenerate), rate limiting (wait and re-trigger)
- **Images broken on Medium:** Ensure the deploy completed before cross-post ran. Re-trigger the workflow manually if needed.
- **Want to skip a post:** Add the slug to `cross-post-status.json` with `"skipped": true` before merging

## README

The project does not currently have a `README.md`. The implementation should create one that covers the full project, with cross-posting as a dedicated section.

**Suggested structure:**

1. **Project overview** — Cary Snyder's portfolio site, built with Astro 6
2. **Tech stack** — Astro, MDX, React, Three.js, Radix UI, deployed to GitHub Pages
3. **Getting started** — `npm install`, `npm run dev`, `npm run build`
4. **Content** — how blog posts work (`src/content/blog/*.mdx`), frontmatter schema, work projects (`src/content/work/*.md`)
5. **Cross-Posting to Medium** — dedicated section covering:
   - What it does — new blog posts auto-cross-post to Medium as drafts on merge to `main`
   - Setup — generate and add the `MEDIUM_API_TOKEN` secret
   - Usage — normal flow (merge → auto-publish), manual re-trigger (workflow_dispatch with slug), finding the LinkedIn blurb in the Actions summary
   - Fallback — if the Medium API fails, download the converted Markdown from the Actions artifact and paste it into Medium manually
   - Skipping posts — how to pre-populate `cross-post-status.json`
   - Adding publishers — brief note on the pluggable pattern for future platforms
6. **Deployment** — GitHub Actions to GitHub Pages, automatic on push to `main`

## Dependencies

No new npm packages required. The script uses:
- `fs/promises` — file reading
- `path` — path resolution
- Node's built-in `fetch` (Node 22) — HTTP requests to Medium API

Zero new dependencies.
