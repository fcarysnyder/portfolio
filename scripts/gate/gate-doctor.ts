import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { readMasterKeyB64 } from './lib/op';
import { LockedFileSchema, type LockedFile } from '../../src/lib/crypto/schema';
import { b64ToBytes } from '../../src/lib/crypto/codec';

const LOCKED_PATH = path.resolve(process.cwd(), 'public/data/synthetic-readings.locked.json');

interface Check {
  name: string;
  ok: boolean;
  detail: string;
  remediation?: string;
}

async function run(): Promise<Check[]> {
  const checks: Check[] = [];

  // 1. op CLI installed
  try {
    execFileSync('op', ['--version'], { stdio: 'pipe' });
    checks.push({ name: 'op CLI installed', ok: true, detail: 'present' });
  } catch {
    checks.push({
      name: 'op CLI installed',
      ok: false,
      detail: 'not found on PATH',
      remediation: 'Install 1Password CLI: brew install --cask 1password-cli',
    });
    return checks;
  }

  // 2. op signed in (trying to read the master key proves it)
  let masterB64: string | null = null;
  try {
    masterB64 = readMasterKeyB64();
    checks.push({ name: 'op signed in + master key readable', ok: true, detail: 'ok' });
  } catch (err: any) {
    checks.push({ name: 'op signed in + master key readable', ok: false, detail: err.message, remediation: "Run 'op signin'" });
  }

  // 3. PRIVATE_CONTENT_PATH set + file exists
  const sourcePath = process.env.PRIVATE_CONTENT_PATH;
  if (!sourcePath) {
    checks.push({ name: 'PRIVATE_CONTENT_PATH set', ok: false, detail: 'unset', remediation: 'export PRIVATE_CONTENT_PATH=~/code/portfolio-private/synthetic-readings.mdx' });
  } else {
    try {
      await fs.access(sourcePath);
      checks.push({ name: 'PRIVATE_CONTENT_PATH points to a file', ok: true, detail: sourcePath });
    } catch {
      checks.push({ name: 'PRIVATE_CONTENT_PATH points to a file', ok: false, detail: `${sourcePath} not found`, remediation: 'Create the file or fix the path' });
    }
  }

  // 4. PRIVATE_GRANTS_LOG dir writable
  const logPath = process.env.PRIVATE_GRANTS_LOG;
  if (!logPath) {
    checks.push({ name: 'PRIVATE_GRANTS_LOG set', ok: false, detail: 'unset', remediation: 'export PRIVATE_GRANTS_LOG=~/code/portfolio-private/grants.log.json' });
  } else {
    try {
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      checks.push({ name: 'PRIVATE_GRANTS_LOG dir writable', ok: true, detail: path.dirname(logPath) });
    } catch (err: any) {
      checks.push({ name: 'PRIVATE_GRANTS_LOG dir writable', ok: false, detail: err.message });
    }
  }

  // 5. locked.json parses + master decrypts
  if (masterB64) {
    try {
      const raw = await fs.readFile(LOCKED_PATH, 'utf8');
      const locked = LockedFileSchema.parse(JSON.parse(raw)) as LockedFile;
      const masterRaw = b64ToBytes(masterB64);
      const masterKey = await webcrypto.subtle.importKey('raw', masterRaw, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(locked.iv) }, masterKey, b64ToBytes(locked.ciphertext));
      checks.push({ name: 'locked.json parses + master decrypts', ok: true, detail: `${locked.wrappedKeys.length} wrapped key(s)` });
    } catch (err: any) {
      checks.push({ name: 'locked.json parses + master decrypts', ok: false, detail: err.message, remediation: "Run 'npm run encrypt-content' or 'npm run rotate-master'" });
    }
  }

  return checks;
}

run().then((checks) => {
  let allOk = true;
  for (const c of checks) {
    const mark = c.ok ? '✓' : '✗';
    console.log(`${mark} ${c.name} — ${c.detail}`);
    if (!c.ok) {
      allOk = false;
      if (c.remediation) console.log(`   → ${c.remediation}`);
    }
  }
  process.exit(allOk ? 0 : 1);
});
