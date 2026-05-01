import { describe, it, expect } from 'vitest';
import { LockedFileSchema, type LockedFile } from '../../../src/lib/crypto/schema';

describe('LockedFileSchema', () => {
  const valid: LockedFile = {
    v: 1,
    kdf: 'pbkdf2-sha256',
    iterations: 600000,
    ciphertext: 'AAAA',
    iv: 'BBBB',
    wrappedKeys: [
      { salt: 'CCCC', iv: 'DDDD', wrapped: 'EEEE' },
    ],
  };

  it('accepts a well-formed locked file', () => {
    expect(LockedFileSchema.parse(valid)).toEqual(valid);
  });

  it('rejects a missing iterations field', () => {
    const { iterations, ...bad } = valid;
    expect(() => LockedFileSchema.parse(bad)).toThrow();
  });

  it('rejects an unsupported kdf', () => {
    expect(() => LockedFileSchema.parse({ ...valid, kdf: 'scrypt' })).toThrow();
  });

  it('accepts an empty wrappedKeys array', () => {
    expect(() => LockedFileSchema.parse({ ...valid, wrappedKeys: [] })).not.toThrow();
  });

  it('rejects iterations below 600000', () => {
    expect(() => LockedFileSchema.parse({ ...valid, iterations: 100000 })).toThrow();
  });
});
