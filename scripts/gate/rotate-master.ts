import { promises as fs } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { webcrypto } from 'node:crypto';
import {
  readMasterKeyB64,
  writeMasterKeyB64,
  writeSecondaryMasterKeyB64,
} from './lib/op';
import { atomicWriteJson } from './lib/atomic';
import { generatePassword } from './lib/password';
import { appendGrant } from './lib/grants-log';
import { bytesToB64, b64ToBytes, utf8ToBytes } from '../../src/lib/crypto/codec';
import { LockedFileSchema, type LockedFile, type WrappedKey } from '../../src/lib/crypto/schema';

const LOCKED_DIR = path.resolve(process.cwd(), 'public/data');

async function listLockedFiles(): Promise<string[]> {
  const entries = await fs.readdir(LOCKED_DIR);
  return entries
    .filter((f) => f.endsWith('.locked.json'))
    .sort()
    .map((f) => path.join(LOCKED_DIR, f));
}

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} (type 'rotate' to confirm): `);
  rl.close();
  return answer.trim() === 'rotate';
}

interface RotatedFile {
  filePath: string;
  slug: string;
  updated: LockedFile;
}

async function main() {
  console.log('MASTER KEY ROTATION');
  console.log('-------------------');
  console.log('This will:');
  console.log('  1. Decrypt every locked.json with the old master key');
  console.log('  2. Generate a new random master key');
  console.log('  3. Re-encrypt every locked.json under the new key');
  console.log('  4. Write the new key to BOTH primary + secondary 1Password vaults');
  console.log('  5. Clear all existing wrappedKeys (revokes everyone)');
  console.log('  6. Self-grant a single shared "owner-recovery" password to every file');
  console.log('');

  const lockedFiles = await listLockedFiles();
  if (lockedFiles.length === 0) {
    throw new Error(`No locked.json files found in ${LOCKED_DIR}.`);
  }
  console.log('Files to rotate:');
  for (const f of lockedFiles) console.log(`  - ${path.basename(f)}`);
  console.log('');

  if (!(await confirm('Are you sure?'))) {
    console.log('Aborted.');
    process.exit(0);
  }

  const subtle = webcrypto.subtle;

  // Decrypt all with old master (in memory)
  const oldMasterB64 = readMasterKeyB64();
  const oldMasterRaw = b64ToBytes(oldMasterB64);
  const oldMaster = await subtle.importKey('raw', oldMasterRaw, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
  const decrypted: { filePath: string; slug: string; locked: LockedFile; plaintext: Uint8Array }[] = [];
  for (const filePath of lockedFiles) {
    const slug = path.basename(filePath).replace(/\.locked\.json$/, '');
    let locked: LockedFile;
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      locked = LockedFileSchema.parse(JSON.parse(raw));
    } catch (err: any) {
      throw new Error(`${filePath} missing or corrupt: ${err.message}`);
    }
    let plaintext: Uint8Array;
    try {
      plaintext = new Uint8Array(
        await subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(locked.iv) }, oldMaster, b64ToBytes(locked.ciphertext)),
      );
    } catch (err: any) {
      throw new Error(`Decrypt failed for ${slug} under old master: ${err.message}. Aborting before any writes.`);
    }
    decrypted.push({ filePath, slug, locked, plaintext });
  }

  // Generate new master and re-encrypt all in memory.
  const newMasterRaw = webcrypto.getRandomValues(new Uint8Array(32));
  const newMasterB64 = bytesToB64(newMasterRaw);
  const newMaster = await subtle.importKey('raw', newMasterRaw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'wrapKey']);

  // One shared recovery password unlocks every rotated file.
  const recoveryPw = generatePassword();
  const baseKey = await subtle.importKey('raw', utf8ToBytes(recoveryPw), { name: 'PBKDF2' }, false, ['deriveKey']);

  const rotated: RotatedFile[] = [];
  for (const { filePath, slug, locked, plaintext } of decrypted) {
    const newIv = webcrypto.getRandomValues(new Uint8Array(12));
    const newCiphertext = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: newIv }, newMaster, plaintext));

    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const wrappingKey = await subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: locked.iterations, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['wrapKey'],
    );
    const wrapIv = webcrypto.getRandomValues(new Uint8Array(12));
    const wrapped = new Uint8Array(await subtle.wrapKey('raw', newMaster, wrappingKey, { name: 'AES-GCM', iv: wrapIv }));

    const wrappedEntry: WrappedKey = {
      salt: bytesToB64(salt),
      iv: bytesToB64(wrapIv),
      wrapped: bytesToB64(wrapped),
    };

    const updated: LockedFile = {
      v: 1,
      kdf: 'pbkdf2-sha256',
      iterations: locked.iterations,
      ciphertext: bytesToB64(newCiphertext),
      iv: bytesToB64(newIv),
      wrappedKeys: [wrappedEntry],
    };

    if (updated.wrappedKeys.length === 0) {
      throw new Error(`Refusing to commit ${slug} with empty wrappedKeys (would lock everyone out).`);
    }

    rotated.push({ filePath, slug, updated });
  }

  // Write new master to BOTH vaults; rollback if either fails.
  try {
    writeMasterKeyB64(newMasterB64);
  } catch (err: any) {
    throw new Error(`Primary vault write failed: ${err.message}. Master key NOT rotated; no files changed.`);
  }
  try {
    writeSecondaryMasterKeyB64(newMasterB64);
  } catch (err: any) {
    writeMasterKeyB64(oldMasterB64);
    throw new Error(`Secondary vault write failed: ${err.message}. Primary rolled back. Master key NOT rotated; no files changed.`);
  }

  // Persist all re-encrypted files.
  for (const { filePath, updated } of rotated) {
    await atomicWriteJson(filePath, updated);
  }
  for (const { slug } of rotated) {
    await appendGrant({ slug, label: 'owner-recovery (post-rotation)', entryIndex: 0, timestamp: new Date().toISOString() });
  }

  console.log('');
  console.log('Master key rotated successfully.');
  console.log(`Re-encrypted ${rotated.length} file(s): ${rotated.map((r) => r.slug).join(', ')}`);
  console.log('All previously issued passwords are now invalid.');
  console.log('');
  console.log('RECOVERY PASSWORD (copy this — it will not be shown again):');
  console.log(recoveryPw);
  console.log('');
  console.log('This single password unlocks every rotated case study.');
  console.log('Next: commit + push the updated locked.json files. Re-issue per-recipient passwords via grant-access.');
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
