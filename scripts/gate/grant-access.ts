import { promises as fs } from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { readMasterKeyB64 } from './lib/op';
import { atomicWriteJson } from './lib/atomic';
import { generatePassword } from './lib/password';
import { appendGrant } from './lib/grants-log';
import { bytesToB64, b64ToBytes, utf8ToBytes } from '../../src/lib/crypto/codec';
import { LockedFileSchema, type LockedFile, type WrappedKey } from '../../src/lib/crypto/schema';

const LOCKED_PATH = path.resolve(process.cwd(), 'public/data/synthetic-readings.locked.json');

async function main() {
  const label = process.argv[2];
  if (!label) {
    console.error('Usage: npm run grant-access -- "<label>"');
    process.exit(2);
  }

  // Load and validate locked.json
  let locked: LockedFile;
  try {
    const raw = await fs.readFile(LOCKED_PATH, 'utf8');
    locked = LockedFileSchema.parse(JSON.parse(raw));
  } catch (err: any) {
    throw new Error(`locked.json missing or corrupt at ${LOCKED_PATH}. Run 'npm run encrypt-content' first, or 'npm run gate-doctor' to diagnose. (${err.message})`);
  }

  // Fetch master key, derive new password key, wrap master under it.
  const masterRaw = b64ToBytes(readMasterKeyB64());
  if (masterRaw.length !== 32) throw new Error('Master key length invalid; expected 32 bytes.');
  const subtle = webcrypto.subtle;
  const masterKey = await subtle.importKey('raw', masterRaw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt', 'wrapKey']);

  const password = generatePassword();
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const baseKey = await subtle.importKey('raw', utf8ToBytes(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  const wrappingKey = await subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: locked.iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey'],
  );
  const wrapIv = webcrypto.getRandomValues(new Uint8Array(12));
  const wrapped = new Uint8Array(await subtle.wrapKey('raw', masterKey, wrappingKey, { name: 'AES-GCM', iv: wrapIv }));

  const entry: WrappedKey = {
    salt: bytesToB64(salt),
    iv: bytesToB64(wrapIv),
    wrapped: bytesToB64(wrapped),
  };

  const updated: LockedFile = { ...locked, wrappedKeys: [...locked.wrappedKeys, entry] };
  await atomicWriteJson(LOCKED_PATH, updated);

  await appendGrant({
    label,
    entryIndex: updated.wrappedKeys.length - 1,
    timestamp: new Date().toISOString(),
  });

  console.log(`Granted access to: ${label}`);
  console.log(`Entry index in locked.json: ${updated.wrappedKeys.length - 1}`);
  console.log('');
  console.log('PASSWORD (copy this — it will not be shown again):');
  console.log(password);
  console.log('');
  console.log("Next: commit + push, then email the password to the recipient.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
