import { describe, it, expect, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';
import { tryUnlock } from '../../../src/lib/crypto/decrypt';
import type { LockedFile } from '../../../src/lib/crypto/schema';
import { bytesToB64, utf8ToBytes } from '../../../src/lib/crypto/codec';

// Polyfill crypto.subtle in case the Node test runner doesn't expose globalThis.crypto
beforeAll(() => {
  if (!globalThis.crypto) (globalThis as any).crypto = webcrypto;
});

const ITERATIONS = 600000;

async function buildFixture(plaintext: string, passwords: string[]): Promise<LockedFile> {
  const subtle = globalThis.crypto.subtle;

  // Generate master content key
  const master = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, master, utf8ToBytes(plaintext)));

  const wrappedKeys = [];
  for (const pw of passwords) {
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const baseKey = await subtle.importKey('raw', utf8ToBytes(pw), { name: 'PBKDF2' }, false, ['deriveKey']);
    const wrappingKey = await subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['wrapKey', 'unwrapKey'],
    );
    const wrapIv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const wrapped = new Uint8Array(await subtle.wrapKey('raw', master, wrappingKey, { name: 'AES-GCM', iv: wrapIv }));
    wrappedKeys.push({ salt: bytesToB64(salt), iv: bytesToB64(wrapIv), wrapped: bytesToB64(wrapped) });
  }

  return {
    v: 1,
    kdf: 'pbkdf2-sha256',
    iterations: ITERATIONS,
    ciphertext: bytesToB64(ciphertext),
    iv: bytesToB64(iv),
    wrappedKeys,
  };
}

describe('tryUnlock', () => {
  it('decrypts with a correct password', async () => {
    const file = await buildFixture('hello world', ['correct-horse-battery-staple']);
    const result = await tryUnlock('correct-horse-battery-staple', file);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.html).toBe('hello world');
  }, 30000);

  it('returns ok=false for a wrong password', async () => {
    const file = await buildFixture('hello world', ['real-password']);
    const result = await tryUnlock('wrong-password', file);
    expect(result.ok).toBe(false);
  }, 30000);

  it('decrypts when only one of multiple wrappedKeys matches', async () => {
    const file = await buildFixture('multi', ['alice-pw', 'bob-pw', 'carol-pw']);
    const result = await tryUnlock('bob-pw', file);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.html).toBe('multi');
  }, 60000);

  it('returns ok=false when wrappedKeys is empty', async () => {
    const file = await buildFixture('x', []);
    const result = await tryUnlock('any', file);
    expect(result.ok).toBe(false);
  }, 30000);
});
