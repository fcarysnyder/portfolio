import { execFileSync } from 'node:child_process';

const PRIMARY_REF = process.env.GATE_OP_PRIMARY_REF ?? 'op://Personal/portfolio-case-study-master-key/password';
const SECONDARY_REF = process.env.GATE_OP_SECONDARY_REF ?? 'op://Personal-Backup/portfolio-case-study-master-key/password';

function readRef(ref: string): string {
  try {
    return execFileSync('op', ['read', ref], { encoding: 'utf8' }).trim();
  } catch (err: any) {
    if (err.message?.includes('not currently signed in') || err.stderr?.toString().includes('not currently signed in')) {
      throw new Error("1Password CLI not signed in. Run 'op signin' first, then retry.");
    }
    throw new Error(`Failed to read ${ref} from 1Password: ${err.stderr?.toString() ?? err.message}`);
  }
}

export function readMasterKeyB64(): string {
  return readRef(PRIMARY_REF);
}

export function readSecondaryMasterKeyB64(): string {
  return readRef(SECONDARY_REF);
}

export function writeMasterKeyB64(value: string): void {
  writeRef(PRIMARY_REF, value);
}

export function writeSecondaryMasterKeyB64(value: string): void {
  writeRef(SECONDARY_REF, value);
}

function writeRef(ref: string, value: string): void {
  const match = /^op:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(ref);
  if (!match) throw new Error(`Cannot parse op ref: ${ref}`);
  const [, vault, item, field] = match;
  try {
    execFileSync('op', ['item', 'edit', item, `${field}=${value}`, '--vault', vault], { stdio: 'pipe' });
  } catch (err: any) {
    if (err.message?.includes('not currently signed in') || err.stderr?.toString().includes('not currently signed in')) {
      throw new Error("1Password CLI not signed in. Run 'op signin' first, then retry.");
    }
    throw new Error(`Failed to write ${ref}: ${err.stderr?.toString() ?? err.message}`);
  }
}
