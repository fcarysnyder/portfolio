# Case Study Gate — Operator Runbook

The gate protects multiple case studies; each one has its own `<slug>.locked.json` under `public/data/`. Commands that operate on a single case study take the slug as a positional arg.

Current slugs: `synthetic-readings`, `omniscience-commanding`.

## Part 1 — TL;DR cheat sheet

### Grant access to a recipient
1. `op signin`
2. `npm run grant-access -- <slug> "Recipient Label"`
3. Copy the printed password
4. `git add public/data/<slug>.locked.json && git commit -m "grant: <slug> <label>" && git push`
5. Email password to recipient (Cloudflare Pages auto-deploys in ~2 min)

Example: `npm run grant-access -- omniscience-commanding "Dan @ Acme"`

### Update a case study's content
1. Edit the source MDX (e.g., `~/code/portfolio-private/<slug>.mdx`)
2. `export PRIVATE_CONTENT_PATH=~/code/portfolio-private/<slug>.mdx`
3. `npm run encrypt-content -- <slug>`
4. `git add public/data/<slug>.locked.json && git commit -m "content: <slug> <what changed>" && git push`

### Rotate the master key (panic button — invalidates all passwords on every case study)
1. `npm run rotate-master` (type 'rotate' to confirm)
2. Copy the recovery password — it unlocks every rotated case study
3. `git add public/data/*.locked.json && git commit -m "rotate master" && git push`
4. Re-issue passwords to anyone still active via `grant-access` (per slug)

---

## Part 2 — Detailed reference

### One-time setup

**1Password items:**
- Primary: `op://Personal/portfolio-case-study-master-key/password` — base64 32-byte AES-256-GCM key
- Secondary: `op://Personal-Backup/portfolio-case-study-master-key/password` — same value (for rotation safety)

The same master key encrypts every `<slug>.locked.json`. You don't have a per-case-study master.

Generate the initial value: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

If your vault names differ, override via env vars:
- `GATE_OP_PRIMARY_REF`
- `GATE_OP_SECONDARY_REF`

**Env vars in your shell profile:**
- `PRIVATE_CONTENT_PATH` — full path to the source MDX you're currently editing (e.g., `~/code/portfolio-private/<slug>.mdx`). Re-export per slug when switching.
- `PRIVATE_GRANTS_LOG` — full path to the grants log (e.g., `~/code/portfolio-private/grants.log.json`)

**Private content repo:**
Source MDX lives outside this repo. Recommended: a separate private GitHub repo at `~/code/portfolio-private/` so the content is git-versioned and backed up off-machine. Never co-locate the master key with the source.

**Hook:**
First clone of this repo: `npm install` runs the `prepare` script, which sets `core.hooksPath` to `.githooks/`. Verify with `git config core.hooksPath` → should print `.githooks`.

**Verify your environment:** `npm run gate-doctor`

### Each script

**`npm run gate-doctor`**
- Purpose: pre-flight verification before risky operations
- Inputs: env vars, 1Password CLI session, every `public/data/*.locked.json`
- Outputs: pass/fail summary per file; non-zero exit if any fail
- Side effects: none
- Failure modes:
  - `op CLI installed → not found` → install via `brew install --cask 1password-cli`
  - `op signed in → not signed in` → `op signin`
  - `PRIVATE_CONTENT_PATH unset` → set in shell profile
  - `<slug>: parses + master decrypts → fail` → `npm run encrypt-content -- <slug>` or `npm run rotate-master`

**`npm run encrypt-content -- <slug>`**
- Purpose: re-encrypt one case study's content from source MDX
- Inputs: `<slug>` positional arg, `PRIVATE_CONTENT_PATH`, master key from 1Password
- Outputs: `public/data/<slug>.locked.json` (atomic write; preserves existing wrappedKeys)
- Side effects: that single locked.json is rewritten; existing passwords still work because wrappedKeys are preserved
- Run after: editing source MDX
- Failure modes:
  - Missing `<slug>` arg → usage hint
  - `Source MDX not found` → check `PRIVATE_CONTENT_PATH`; you may have it pointed at a different slug's source
  - `Master key length invalid` → master key in 1Password is malformed; rotate
  - MDX compile error → fix syntax in the source

**`npm run grant-access -- <slug> "Label"`**
- Purpose: issue a new password to a recipient, scoped to one case study
- Inputs: `<slug>` and label (positional args), master key from 1Password, existing locked.json
- Outputs: appended wrappedKey in `<slug>.locked.json` (atomic), grant entry appended to grants log (with slug), password printed once
- Side effects: that locked.json grows by one wrappedKey; grants log grows by one entry
- Run after: receiving an access request via email
- Failure modes:
  - Missing `<slug>` or label → usage hint
  - locked.json missing → `npm run encrypt-content -- <slug>` first

**`npm run rotate-master`**
- Purpose: invalidate ALL existing passwords across ALL case studies + rotate master key
- Inputs: confirmation prompt (type "rotate"), old master key, both 1Password vaults
- Outputs: every `public/data/*.locked.json` re-encrypted under the new master, each with a single shared recovery wrappedKey; one recovery password printed
- Side effects: BOTH 1Password vaults are updated; if secondary write fails, primary is rolled back; no locked.json file is touched until both vault writes succeed
- Run after: suspected master key compromise OR you want bulk revocation across the whole gate
- Failure modes:
  - Decrypt fails on any file → aborts before any writes (no partial state)
  - Primary vault write fails → no state change; rotation aborted
  - Secondary vault write fails → primary rolled back; rotation aborted

### Grants log format

`PRIVATE_GRANTS_LOG` points to a JSON array of objects:
```json
[
  { "slug": "synthetic-readings",   "label": "Jane @ Acme", "entryIndex": 0, "timestamp": "2026-04-30T15:00:00.000Z" },
  { "slug": "omniscience-commanding", "label": "Bob @ Beta", "entryIndex": 1, "timestamp": "2026-05-01T09:00:00.000Z" }
]
```

`entryIndex` corresponds to the position in `<slug>.locked.json#wrappedKeys`. `slug` tells you which file the entry belongs to. Use both to know which entry to remove if you want to revoke a single recipient (note: forward-only — see threat model).

Older entries written before slug tracking was added will be missing the `slug` field; assume they were for `synthetic-readings`.

### Threat model

This gate protects against **casual viewing**.

In scope:
- Random visitors and search engines never seeing the case study content
- Recruiters without a password not being able to read content via View Source, devtools, or `curl`
- Open-source repo cloners not finding plaintext content, master keys, or passwords
- Per-recipient password issuance with bulk revocation via master rotation

Out of scope (accepted risks):
- Offline brute-force on the published `locked.json`
- Per-recipient revocation without rotation (forward-only — cached old bundles still carry the wrapped key)
- Confidential data under NDA — DO NOT use this gate for material where a determined attacker matters
- XSS or browser compromise (sessionStorage caches decrypted HTML)

### Disaster scenarios

**"I lost my laptop."**
- Get a new laptop. `op signin` (1Password recovery). Clone this repo and the private content repo. `source ~/.zshrc`. `npm run gate-doctor`. You're back.

**"I lost access to my primary 1Password vault."**
- Read master key from secondary vault: `op read $GATE_OP_SECONDARY_REF`. Restore primary by recreating the item with the same value, OR run `npm run rotate-master` (which writes to both).

**"I accidentally committed the source MDX."**
- The pre-commit hook should have blocked this. If it didn't (e.g., you bypassed with `--no-verify`), `git rm` the file, force-push, and treat the content as compromised. If the content was sensitive, run `npm run rotate-master` and re-encrypt to fresh ciphertext (note: forward-only; the old commit is still in history).

**"Cloudflare Pages build failed."**
- Check `wrangler pages deployment list` or the Cloudflare dashboard. The build runs `astro build` — if it fails, the locked.json + assets must be out of sync. Run `npm run build` locally; fix; recommit.

**"A recruiter says the password doesn't work."**
- Check the grants log: did you actually issue them a password for the right slug? Run `npm run gate-doctor` to verify locked.json is current. Generate a fresh password via `npm run grant-access -- <slug> "label"`. Sometimes copy-paste mangles characters — re-send.

**"I suspect the master key was compromised."**
- `npm run rotate-master`. Re-issue passwords to active recipients on each slug. Old bundles in caches are still attackable but new content is safe under the new master.

### Pre-commit hook

Located at `.githooks/pre-commit`. Blocks commits touching `private/` or known gated source MDX paths. Defense-in-depth — these paths shouldn't exist in this repo regardless. If you ever need to bypass it for a legitimate reason: don't. The hook is there because you've been clear-eyed about why you don't want plaintext in the repo. If you really need to override, edit the hook itself to allow the specific path; never use `--no-verify`.
