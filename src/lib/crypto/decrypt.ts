import { type LockedFile, LockedFileSchema } from './schema';
import { b64ToBytes, bytesToUtf8, utf8ToBytes } from './codec';

export type UnlockResult = { ok: true; html: string } | { ok: false };

export async function tryUnlock(password: string, file: LockedFile): Promise<UnlockResult> {
  // Validate shape; refuse to operate on malformed input.
  const parsed = LockedFileSchema.safeParse(file);
  if (!parsed.success) return { ok: false };

  const subtle = globalThis.crypto.subtle;
  const baseKey = await subtle.importKey('raw', utf8ToBytes(password), { name: 'PBKDF2' }, false, ['deriveKey']);

  let unwrappedMaster: CryptoKey | null = null;
  for (const wk of file.wrappedKeys) {
    try {
      const wrappingKey = await subtle.deriveKey(
        { name: 'PBKDF2', salt: b64ToBytes(wk.salt), iterations: file.iterations, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['unwrapKey'],
      );
      const candidate = await subtle.unwrapKey(
        'raw',
        b64ToBytes(wk.wrapped),
        wrappingKey,
        { name: 'AES-GCM', iv: b64ToBytes(wk.iv) },
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt'],
      );
      if (!unwrappedMaster) unwrappedMaster = candidate;
    } catch {
      // auth fail -> wrong password for this entry; keep going
    }
  }

  if (!unwrappedMaster) return { ok: false };

  try {
    const plaintext = await subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBytes(file.iv) },
      unwrappedMaster,
      b64ToBytes(file.ciphertext),
    );
    return { ok: true, html: bytesToUtf8(new Uint8Array(plaintext)) };
  } catch {
    return { ok: false };
  }
}
