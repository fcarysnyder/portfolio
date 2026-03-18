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
