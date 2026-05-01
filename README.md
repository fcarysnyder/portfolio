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

Blog posts live in `src/content/blog/` and can be either `.md` or `.mdx` files.

- Use `.md` for standard writing (headings, links, images, lists, etc.).
- Use `.mdx` when you need component embeds (for example, custom Astro/React components).

Frontmatter schema:

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

### Gated case studies (password-protected)

Some case studies are encrypted client-side and require a per-recipient password. To generate a password, update content, or rotate the master key, see [Case Study Gate Operator Runbook](docs/case-study-gate-runbook.md). Quick reference:

- Generate a password: `npm run grant-access -- <slug> "Recipient Label"`
- Re-encrypt content: `npm run encrypt-content -- <slug>`
- Verify environment: `npm run gate-doctor`

## Cross-Posting to Medium

New blog posts are automatically converted to Medium-compatible Markdown when merged to `main`. Your site remains the canonical source for SEO.

### How It Works

1. You merge a new blog post to `main`
2. GitHub Actions deploys the site, then runs the conversion script
3. The script converts supported posts to Medium-compatible Markdown (resolves images, converts Tweet embeds, strips JSX)
4. The converted Markdown is uploaded as a downloadable GitHub Actions artifact
5. A LinkedIn blurb is output in the Actions run summary
6. Download the artifact and paste into Medium's editor (or let IFTTT handle it via RSS — see below)

### Usage

- **Normal flow:** Merge a new blog post → deploy + convert runs automatically → check the Actions summary for the LinkedIn blurb → download the converted Markdown artifact → paste into Medium
- **Re-convert a post:** Actions tab → "Deploy to GitHub Pages" → Run workflow → enter the post slug → Run
- **Skip a post:** Add the slug to `cross-post-status.json` with `"skipped": true` before merging

> Note: the current cross-post converter processes `.mdx` posts. `.md` posts publish on the site normally, but are not yet included in the Medium conversion step.

### RSS Feed

The site publishes an RSS feed at [`/rss.xml`](https://www.fcarysnyder.com/rss.xml) with all blog posts. This is used for cross-posting via IFTTT and can be consumed by any RSS reader.

### IFTTT → Medium (Manual Trigger)

To cross-post a new blog post to Medium via IFTTT:

1. **One-time setup:** Create an IFTTT applet:
   - **Trigger (If):** RSS Feed → "New feed item" → Feed URL: `https://www.fcarysnyder.com/rss.xml`
   - **Action (Then):** Medium → "Create story"
   - In the Medium action, set the **Canonical URL** to `{{EntryUrl}}` so your blog stays the SEO source
   - Set **Content** to `{{EntryContent}}` and **Title** to `{{EntryTitle}}`
2. **To cross-post:** After your post is live, manually run the IFTTT applet (or enable auto-run when you're ready to fully automate)

### Adding More Platforms

The publisher system is pluggable. To add a new platform (e.g., Substack):

1. Create `scripts/publishers/substack.js` with a `publish({ title, content, canonicalUrl, tags })` function
2. Wire it into `scripts/cross-post.js`
3. Add the API secret to GitHub Actions

## Deployment

Pushes to `main` trigger the GitHub Actions workflow which builds with Astro and deploys to GitHub Pages at [fcarysnyder.com](https://www.fcarysnyder.com).
