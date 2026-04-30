# Synthetic Readings Case Study — Password-Gated Work Detail Page

**Status:** Approved design, ready for implementation planning
**Date:** 2026-04-30
**Author:** F Cary Snyder (with Claude)

---

## Context

The portfolio currently has five entries in `src/content/work/` whose markdown bodies are unused — the work index and home Selected Projects section render cards that link out to external Figma/Cesium URLs. There is no `[...slug].astro` for `work` (unlike `writing/[...slug].astro`, which renders MDX detail pages cleanly).

Recent project work at CrossnoKaye (Performance Pages for ATLAS — "Synthetic Readings") is fresh and well-documented. Source materials live at `~/Library/CloudStorage/OneDrive-Personal/CrossnoKaye/2026/syntheticReadings/`, including a strong "Dan Winer version" concise case study draft, final UI screenshots, hype/reaction notes, and UXR call notes.

The author wants:
1. A new case study built from these materials, hosted on the portfolio
2. Password protection on this case study only — content must not leak to the public, since it covers internal CrossnoKaye work and may host genuinely sensitive material in the future
3. The portfolio repo is open-source on GitHub, so passwords and plaintext source must never live in the repo
4. A modal-based unlock flow that uses existing components and styles where possible
5. Documentation so future-author can operate the gate confidently

The other four work entries stay as-is (external-link cards) and are out of scope for this spec.

---

## Goals

- Render the new case study at `/work/synthetic-readings` using existing layout/style patterns from `writing/[...slug].astro`
- Add a third card (Synthetic Readings) to the home page Selected Projects section, with a "Ask for access" CTA distinguishing it from the other two
- Adapt the Dan Winer concise case study draft (`case-study-concise-dan-winer-version.md`) into the private MDX source, including image placement from the `final-result/` screenshots
- Encrypt the case study body at build time so the public bundle contains no plaintext
- Allow many passwords (per-recipient), revocable in bulk via master-key rotation
- Keep the site fully static; no server, no SSR, no Worker required for the gate
- Provide operator scripts and a runbook so granting access takes a single command

## Non-goals

- Converting the other four work entries to MDX detail pages (separate future project)
- A `Carousel` MDX component (case study uses standard markdown image stacks like the blog post template; carousel can be added later if desired)
- Per-recipient revocation without rotation (forward-only revocation only — explicit in threat model)
- Defense against motivated, technically-equipped adversaries (gate is for casual viewing protection only)
- Email-receiving automation (a `mailto:` link is sufficient; author handles requests in Gmail manually)

---

## Threat model — explicit

This gate protects against **casual viewing**.

**In scope:**
- Random visitors and search engines never seeing the case study content
- Recruiters who don't have a password not being able to read content via View Source, devtools, or `curl`
- Open-source repo cloners not finding plaintext content, master keys, or passwords
- Per-recipient password issuance with bulk revocation via master rotation

**Out of scope (accepted risks):**
- Offline brute-force attacks on the published `locked.json`. Mitigated but not eliminated by 600,000-iteration PBKDF2 + 16-character random passwords. An attacker willing to spend CPU time can attempt brute force at their leisure on cached/Wayback bundles.
- Per-recipient revocation without rotation. Removing a wrapped-key entry only stops *future* fetches; cached old bundles still carry the entry. The only true revocation is master-key rotation + re-issue.
- Confidential data under NDA. The author commits to not using this gate for content where a determined attacker matters.
- XSS or browser compromise. SessionStorage caching of decrypted HTML accepts that any script with page-level access can read decrypted content; this is an acceptable trade-off for the threat model.

The author will document this threat model verbatim in the operator runbook so future-self does not drift into using the gate for content it wasn't built for.

---

## Architecture

### Two-build model

**Build A — Local-only encrypt step (author's machine):**

Inputs (none in the repo):
- Source MDX at `$PRIVATE_CONTENT_PATH/synthetic-readings.mdx` — recommend a separate private GitHub repo (`portfolio-private`) cloned to `~/code/portfolio-private/`
- Master content key — random 256-bit AES-GCM key, stored in 1Password at `portfolio/case-study-master-key`, fetched via `op` CLI; backed up in a secondary 1Password vault
- Per-recipient passwords — generated cryptographically random at issuance time (16 chars), printed once, never persisted

Scripts (all run locally only):
1. `npm run encrypt-content` — reads source MDX, compiles to HTML in-memory via `@mdx-js/mdx`, encrypts with master key (AES-256-GCM, fresh random IV), writes `public/data/synthetic-readings.locked.json` atomically (path under `public/` so Astro serves it as a static asset at `/data/synthetic-readings.locked.json`)
2. `npm run grant-access "Label"` — generates password, derives PBKDF2-HMAC-SHA256 key (600,000 iterations, fresh per-entry salt), wraps master key with AES-256-GCM, appends `{salt, iv, wrapped}` to `locked.json` (no labels in public file), appends `{label, entryIndex, timestamp}` to grants log at `$PRIVATE_GRANTS_LOG` (outside repo), prints password to stdout, exits
3. `npm run rotate-master` — confirmation prompt → fetches old master from 1Password → decrypts current ciphertext → generates new master → re-encrypts content → writes new master to *both* primary and secondary 1Password vaults (refuses to proceed if either write fails) → clears `wrappedKeys` array → calls `grant-access "owner-recovery"` to ensure non-empty wrappedKeys → prints recovery password
4. `npm run gate-doctor` — pre-flight checks: `op` signed in, master key fetchable, source MDX exists, grants log writable, locked.json parses and matches schema, master key successfully decrypts ciphertext

**Build B — Cloudflare Pages:**

Just runs `astro build`. The committed `synthetic-readings.locked.json` ships as a static asset. No secrets in CI. No source MDX anywhere CI can reach.

### Locked JSON schema

```json
{
  "v": 1,
  "kdf": "pbkdf2-sha256",
  "iterations": 600000,
  "ciphertext": "<base64>",
  "iv": "<base64>",
  "wrappedKeys": [
    { "salt": "<base64>", "iv": "<base64>", "wrapped": "<base64>" }
  ]
}
```

`v`, `kdf`, and `iterations` live in the file (not just the script) so future migrations (raised iterations, Argon2id via WASM) can coexist with old files. Client reads these fields rather than assuming.

### Runtime — `/work/synthetic-readings` page

- Astro renders public scaffold: nav, back link, title, hero image, public teaser paragraph, plus a `<GatedContent>` React island with `client:load`
- `<GatedContent>` checks `sessionStorage["unlock:synthetic-readings"]`:
  - **Cache hit**: render decrypted HTML from cache
  - **Cache miss**: fetch `locked.json`, render placeholder, auto-open `<PasswordModal>`
- On password submit: `tryUnlock(password, lockedData)` runs in a Web Worker so PBKDF2 doesn't jank the main thread
- `tryUnlock` iterates *all* `wrappedKeys` (no early return), attempts AES-GCM unwrap on each, then decrypts content with first successfully unwrapped master
- On success: stash decrypted HTML in `sessionStorage`, close modal, render content
- On failure: single error message ("Incorrect password."), no distinction between "no wrap matched" and "auth tag failed"

### Repo hygiene

- `.gitignore` adds `private/`, `.env.local`, etc. (defense in depth — these paths shouldn't exist anyway)
- Pre-commit hook (Husky or shell) blocks commits touching paths under `private/` or `*.mdx` files matching the gated case study slug. Hook contains a header comment explaining it is defense-in-depth in case a future contributor reintroduces the bad pattern.
- CSP forward-looking note: when CSP is tightened, ensure `connect-src 'self'` permits `locked.json` fetch and `crypto.subtle` is not blocked.

---

## Components

### New files (12)

**Page route:**
1. `src/pages/work/[...slug].astro` — dynamic route mirroring `writing/[...slug].astro` structure (back link, title block, prose styles, prev/next nav). Renders MDX work entries; for entries with `gated: true` frontmatter, renders `<GatedContent>` island in place of body.

**React components:**
2. `src/components/work/GatedContent.tsx` — React island. Props: `lockedDataUrl: string`. Manages unlock state, sessionStorage cache, modal mounting, decrypted HTML rendering via `dangerouslySetInnerHTML` inside a wrapper styled to match `.post-content`.
3. `src/components/work/PasswordModal.tsx` — adapts patterns from `src/components/photography/PhotoModal.tsx` (portal, focus trap, escape key, body scroll lock, `previousFocus` restore on close). Closeable only after successful unlock or via "Ask for access" link. Uses existing tokens: `var(--gradient-subtle)`, `var(--gray-800)`, `var(--shadow-md)`, `var(--accent-regular)`.

**Crypto module:**
4. `src/lib/crypto/decrypt.ts` — pure-function module. Exports `tryUnlock(password, lockedData) → {ok: true, html} | {ok: false}`. Reads `iterations` and `kdf` from file per schema. No early-return on success. Single failure mode regardless of cause.

**Build scripts (in `scripts/gate/`):**
5. `encrypt-content.ts`
6. `grant-access.ts`
7. `rotate-master.ts`
8. `gate-doctor.ts`

**Content stub (public, in this repo):**
9. `src/content/work/synthetic-readings.mdx` — frontmatter only (`gated: true`, title, publishDate, img, img_alt, description as public teaser, tags, color, cta="Ask for access"). No body. The dynamic route reads frontmatter, renders the standard scaffold (back link, title, hero, teaser), and mounts `<GatedContent lockedDataUrl="/data/synthetic-readings.locked.json">` in place of where MDX body would render. The `.mdx` extension is chosen for consistency with future gated entries that may want inline components in the public scaffold; for this entry it is effectively frontmatter-only.

**Case study source (private, in separate repo):**
The full case study prose lives at `~/code/portfolio-private/synthetic-readings.mdx` — adapted from `case-study-concise-dan-winer-version.md` with image embeds from `final-result/`. This file is the input to `encrypt-content` and never enters this repo.

**Documentation:**
10. `docs/case-study-gate-runbook.md` — operator runbook (TL;DR + detailed reference, see below)

**Build outputs (committed, regenerated by scripts):**
11. `public/data/synthetic-readings.locked.json` — encrypted artifact (served at `/data/synthetic-readings.locked.json`)

**Pre-commit hook:**
12. `.githooks/pre-commit` (or Husky equivalent) — blocks commits to `private/` and gated MDX paths

### Modified files (3)

13. `src/pages/index.astro` — extend Selected Projects filter to include "Synthetic Readings," sort by publishDate desc
14. `src/components/PortfolioPreview.astro` — branch on `gated` frontmatter flag: swap CTA text to "Ask for access" and render a small `Lock` icon (from `@lucide/astro`) next to the existing tag pill
15. `src/content/config.ts` — extend `work` schema with `gated: z.boolean().optional()`; switch loader pattern to accept `**/*.{md,mdx}`

---

## Data flow

**Authoring (when content changes):**
1. Edit `~/code/portfolio-private/synthetic-readings.mdx`
2. `npm run encrypt-content`
3. Commit + push the updated `locked.json`
4. Cloudflare Pages auto-deploys (~2 min)

**Granting access (when issuing a password):**
1. `npm run grant-access "Recipient label"`
2. Copy the printed password
3. Commit + push the updated `locked.json`
4. Email password to recipient while Cloudflare deploys

**Rendering (visitor experience):**
1. Visitor lands on `/work/synthetic-readings`
2. Astro renders public scaffold + `<GatedContent>` hydration root
3. `<GatedContent>` checks sessionStorage → cache hit renders immediately; cache miss fetches `locked.json` and auto-opens modal
4. Visitor enters password → Web Worker runs PBKDF2 + tries all wrapped keys + decrypts on first match
5. Worker returns `{ok, html}`:
   - Success: cache decrypted HTML in sessionStorage, close modal, render
   - Failure: show single error message, clear input, refocus

### SessionStorage caching

Cache the **decrypted HTML** (not the master key). Faster subsequent renders within session; accepted XSS trade-off per threat model. Cache dies on tab close.

---

## Error handling

### Visitor-facing (modal)

| Failure | User sees | Reality |
|---|---|---|
| Wrong password | "Incorrect password." inline error, input cleared, refocused | All unwraps failed OR unwrap succeeded but content auth failed. Single message. |
| Empty submit | "Enter a password to continue." | Client-side validation, no worker call. |
| Locked JSON fetch fails | "We couldn't load this case study. Try refreshing, or [email me]." | Network/404/parse error. Detail logged to console only. |
| Web Crypto unavailable | Same fallback | Browser too old or CSP blocks subtle. |
| Worker timeout (>10s) | "Something went wrong. Try refreshing." | Worker.terminate() guard. |

### Visitor-facing (page)

| Failure | User sees |
|---|---|
| JS disabled | Static scaffold + `<noscript>`: "JavaScript is required. [email me]." |
| Hydration error | React error boundary shows the same `<noscript>` content |

### Operator-facing (scripts)

All scripts fail loudly with structured exit messages. Examples:
- `op` not signed in → "Error: 1Password CLI not signed in. Run 'op signin' first, then retry."
- Missing master key → "Error: Master key not found at 'portfolio/case-study-master-key'. Run 'npm run rotate-master' or restore from secondary vault."
- Source MDX missing → "Error: Source MDX not found. Set PRIVATE_CONTENT_PATH and verify file exists at <path>."
- Corrupt locked.json → "Error: locked.json missing or corrupt. Run 'npm run encrypt-content' first, or 'npm run gate-doctor' to diagnose."
- Atomic write fails → `.tmp` left in place; error tells operator to inspect before deleting
- `rotate-master` secondary write fails → rollback (no state change), explicit error
- `rotate-master` empty wrappedKeys after self-grant → refuses to commit

### Console hygiene

All unexpected runtime errors flow through `logGateError(err, context)` — structured logs in dev, silent in prod. No stack traces visible to a security-curious recruiter.

---

## Operator runbook (`docs/case-study-gate-runbook.md`)

### Part 1 — TL;DR cheat sheet (one screen)

**Grant access:**
1. `op signin`
2. `npm run grant-access "Jane @ Acme"`
3. `git add src/data/synthetic-readings.locked.json && git commit -m "grant access" && git push`
4. Email password to recipient

**Update content:**
1. Edit `~/code/portfolio-private/synthetic-readings.mdx`
2. `npm run encrypt-content`
3. Commit + push

**Rotate master (panic button):**
1. `npm run rotate-master` (prompts confirmation; prints recovery password)
2. Commit + push
3. Re-issue passwords to anyone still active via `grant-access`

### Part 2 — Detailed reference

- **One-time setup:** 1Password items, env vars (`PRIVATE_CONTENT_PATH`, `PRIVATE_GRANTS_LOG`), private repo clone, hook installation, `gate-doctor` verification
- **Each script:** purpose, inputs, outputs, side effects, success indicators, every failure mode + exact error message + remediation
- **Grants log format:** field-by-field, how to read and audit
- **Threat model:** copied verbatim from this design doc
- **Disaster scenarios:** lost laptop, lost 1Password access, accidentally committed source MDX, Cloudflare build failed, recruiter says password doesn't work, suspected master key compromise — each with remediation
- **Pre-commit hook:** what it blocks, why, when (and when not) to bypass

The runbook gets updated whenever scripts change. Implementation plan includes a checklist item to that effect.

---

## Testing

### Automated (Vitest)

- `tryUnlock` round-trip unit test with fixture locked.json: correct password returns `{ok: true, html}`, wrong password returns `{ok: false}`
- Schema parse test: malformed locked.json fails loudly
- Script smoke test: `encrypt-content` → `grant-access` → unlock with printed password, end-to-end on fixture, runs in CI on PRs touching `scripts/gate/**`

### Manual (pre-first-deploy checklist)

- Fresh incognito tab → modal auto-opens on `/work/synthetic-readings`
- Wrong password → error, modal stays open
- Correct password → renders, sessionStorage populated
- Refresh tab → no re-prompt
- New tab → re-prompts
- "Ask for access" link → mailto opens with prefilled subject + body
- View source → no plaintext present
- Direct fetch of `locked.json` → no labels visible
- Two passwords issued → both unlock independently
- `rotate-master` → both old passwords fail, recovery password works

### Out of scope

- Brute-force resistance (accepted in threat model)
- Cross-browser edge cases beyond current Chrome/Firefox/Safari

---

## Lockout-prevention mitigations

- Master key in primary + secondary 1Password vaults; `rotate-master` requires both writes to succeed
- Source MDX in separate private GitHub repo (off-machine backup); never co-located with master key
- `rotate-master` self-grants a recovery password before committing; refuses empty wrappedKeys
- Atomic writes (`.tmp` + rename) on every locked.json mutation
- `gate-doctor` script for pre-flight verification before risky operations

The runbook's "Disaster scenarios" section maps every realistic lockout to a concrete recovery path.

---

## Open questions (none blocking)

None. All design questions resolved through brainstorming.

## Risks

- **PBKDF2 wall time on low-end devices**: 600k iterations may take 2-3 seconds on older mobile. Web Worker prevents UI jank but the wait is noticeable. Acceptable; mitigated by sessionStorage caching after first unlock.
- **Master key loss**: covered by secondary vault backup. If both vaults are lost, content is permanently encrypted — but the *site* still works (page just shows the gate forever); only the case study is lost. Author accepts this.
- **Schema drift**: schema versioning in locked.json mitigates this; client reads `v`, `kdf`, `iterations` from file rather than assuming.
- **Cloudflare build doesn't auto-trigger**: very rare; runbook includes manual redeploy step.
