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
import { LockedFileSchema, type LockedFile } from '../../src/lib/crypto/schema';

const LOCKED_PATH = path.resolve(process.cwd(), 'public/data/synthetic-readings.locked.json');

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} (type 'rotate' to confirm): `);
  rl.close();
  return answer.trim() === 'rotate';
}

async function main() {
  console.log('MASTER KEY ROTATION');
  console.log('-------------------');
  console.log('This will:');
  console.log('  1. Decrypt current content with the old master key');
  console.log('  2. Generate a new random master key');
  console.log('  3. Re-encrypt content under the new key');
  console.log('  4. Write the new key to BOTH primary + secondary 1Password vaults');
  console.log('  5. Clear all existing wrappedKeys (revokes everyone)');
  console.log('  6. Self-grant a "owner-recovery" password so the gate stays openable');
  console.log('');

  if (!(await confirm('Are you sure?'))) {
    console.log('Aborted.');
    process.exit(0);
  }

  // Load and validate locked.json
  let locked: LockedFile;
  try {
    const raw = await fs.readFile(LOCKED_PATH, 'utf8');
    locked = LockedFileSchema.parse(JSON.parse(raw));
  } catch (err: any) {
    throw new Error(`locked.json missing or corrupt: ${err.message}`);
  }

  const subtle = webcrypto.subtle;

  // Decrypt with old master
  const oldMasterRaw = b64ToBytes(readMasterKeyB64());
  const oldMaster = await subtle.importKey('raw', oldMasterRaw, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
  const plaintext = new Uint8Array(
    await subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(locked.iv) }, oldMaster, b64ToBytes(locked.ciphertext)),
  );

  // Generate new master
  const newMasterRaw = webcrypto.getRandomValues(new Uint8Array(32));
  const newMasterB64 = bytesToB64(newMasterRaw);

  // Re-encrypt with new master
  const newMaster = await subtle.importKey('raw', newMasterRaw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'wrapKey']);
  const newIv = webcrypto.getRandomValues(new Uint8Array(12));
  const newCiphertext = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: newIv }, newMaster, plaintext));

  // Write new master to BOTH vaults; rollback if either fails.
  try {
    writeMasterKeyB64(newMasterB64);
  } catch (err: any) {
    throw new Error(`Primary vault write failed: ${err.message}. Master key NOT rotated.`);
  }
  try {
    writeSecondaryMasterKeyB64(newMasterB64);
  } catch (err: any) {
    // Roll back primary
    writeMasterKeyB64(bytesToB64(oldMasterRaw));
    throw new Error(`Secondary vault write failed: ${err.message}. Primary rolled back. Master key NOT rotated.`);
  }

  // Self-grant recovery password
  const recoveryPw = generatePassword();
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const baseKey = await subtle.importKey('raw', utf8ToBytes(recoveryPw), { name: 'PBKDF2' }, false, ['deriveKey']);
  const wrappingKey = await subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: locked.iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey'],
  );
  const wrapIv = webcrypto.getRandomValues(new Uint8Array(12));
  const wrapped = new Uint8Array(await subtle.wrapKey('raw', newMaster, wrappingKey, { name: 'AES-GCM', iv: wrapIv }));

  const updated: LockedFile = {
    v: 1,
    kdf: 'pbkdf2-sha256',
    iterations: locked.iterations,
    ciphertext: bytesToB64(newCiphertext),
    iv: bytesToB64(newIv),
    wrappedKeys: [
      { salt: bytesToB64(salt), iv: bytesToB64(wrapIv), wrapped: bytesToB64(wrapped) },
    ],
  };

  if (updated.wrappedKeys.length === 0) {
    throw new Error('Refusing to commit locked.json with empty wrappedKeys (would lock everyone out).');
  }

  await atomicWriteJson(LOCKED_PATH, updated);
  await appendGrant({ label: 'owner-recovery (post-rotation)', entryIndex: 0, timestamp: new Date().toISOString() });

  console.log('');
  console.log('Master key rotated successfully.');
  console.log('All previously issued passwords are now invalid.');
  console.log('');
  console.log('RECOVERY PASSWORD (copy this — it will not be shown again):');
  console.log(recoveryPw);
  console.log('');
  console.log('Next: commit + push the updated locked.json. Re-issue passwords to active recipients via grant-access.');
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
